import { norm, shouldIgnorePath } from "./sandbox.js";
function readPkg(files) {
    const pkg = files.find((f) => norm(f.path) === "package.json") ??
        files
            .filter((f) => norm(f.path).endsWith("/package.json"))
            .sort((a, b) => norm(a.path).split("/").length - norm(b.path).split("/").length)[0];
    if (!pkg)
        return null;
    try {
        const j = JSON.parse(pkg.content);
        return {
            deps: { ...j.dependencies, ...j.devDependencies },
            scripts: j.scripts ?? {},
        };
    }
    catch {
        return null;
    }
}
export function detectFramework(files) {
    const filtered = files.filter((f) => !shouldIgnorePath(f.path));
    const paths = filtered.map((f) => norm(f.path));
    const pkg = readPkg(filtered);
    const deps = pkg?.deps ?? {};
    const scripts = pkg?.scripts ?? {};
    const hasNext = Boolean(deps.next);
    const hasVite = Boolean(deps.vite);
    const hasCra = Boolean(deps["react-scripts"]);
    const isSsrNext = hasNext &&
        !scripts.export &&
        !paths.some((p) => p === "next.config.js" && filtered.find((f) => f.path === p)?.content.includes("output: 'export'"));
    let id = "unknown";
    if (paths.some((p) => /index\.html$/i.test(p)) && !pkg)
        id = "static";
    else if (hasVite)
        id = "vite";
    else if (hasNext && paths.some((p) => /^app\/page\./i.test(p)))
        id = "nextjs_app";
    else if (hasNext && paths.some((p) => /^pages\/index\./i.test(p)))
        id = "nextjs_pages";
    else if (hasCra)
        id = "cra";
    else if (pkg)
        id = "react";
    const content = filtered.map((f) => f.content).join("\n");
    if (/@base44\/|BASE44_/i.test(content))
        id = id === "unknown" ? "base44" : id;
    if (/lovable\.dev/i.test(content))
        id = id === "vite" ? "lovable" : id;
    const pm = paths.includes("pnpm-lock.yaml")
        ? "pnpm"
        : paths.includes("yarn.lock")
            ? "yarn"
            : "npm";
    const entryFiles = paths.filter((p) => /index\.html$/i.test(p) ||
        /^src\/main\./i.test(p) ||
        /^app\/page\./i.test(p) ||
        /^pages\/index\./i.test(p));
    return {
        id,
        label: id,
        packageManager: pm,
        scripts,
        isSsrNext,
        hasStaticExport: Boolean(scripts.export) || paths.some((p) => p.includes("next.config")),
        entryFiles: entryFiles.slice(0, 8),
    };
}

import { getTemplateById } from "@/lib/templates/template-catalog";
import { getCoreTemplate, resolveTemplateId } from "@/lib/templates/template-archetypes";
import type { TemplateSourceFile } from "@/lib/templates/template-source-types";

function routeToPagePath(route: string): string {
  if (route === "/" || !route) return "app/page.tsx";
  const seg = route.replace(/^\//, "").replace(/\[([^\]]+)\]/g, "[$1]");
  return `app/${seg}/page.tsx`;
}

function componentFileName(name: string): string {
  return `components/${name.toLowerCase().replace(/\s+/g, "-")}.tsx`;
}

function buildLayout(appTitle: string): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${appTitle}",
  description: "Built from a Vodex template — customize with prompts in the builder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">{children}</body>
    </html>
  );
}
`;
}

function buildGlobalsCss(accent: string): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --accent: ${accent};
}

body {
  font-family: ui-sans-serif, system-ui, sans-serif;
}
`;
}

function buildHomePage(
  appTitle: string,
  tagline: string,
  sections: string[],
  primaryCta: string,
): string {
  const sectionBlocks = sections
    .map(
      (s, i) => `        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">${s}</h2>
          <p className="mt-2 text-sm text-slate-300">Template section ${i + 1} — extend with prompts in Vodex.</p>
        </section>`,
    )
    .join("\n");

  return `"use client";

import Link from "next/link";
import { sampleRecords } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Vodex template</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">${appTitle}</h1>
        <p className="mt-3 max-w-2xl text-slate-300">${tagline}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
            ${primaryCta}
          </button>
          <Link href="/settings" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white">
            Settings
          </Link>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
${sectionBlocks}
      </div>
      <p className="mt-8 text-xs text-slate-500">{sampleRecords.length} sample records loaded from lib/mock-data.ts</p>
    </main>
  );
}
`;
}

function routePageExportName(route: string): string {
  const parts = route.replace(/^\//, "").split("/").filter(Boolean);
  const last = (parts[parts.length - 1] ?? "home").replace(/\[|\]/g, "") || "home";
  return `${last
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("")}Page`;
}

function buildRoutePage(route: string, appTitle: string): string {
  const exportName = routePageExportName(route);
  return `export default function ${exportName}() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-sky-400">${appTitle}</p>
      <h1 className="mt-2 text-2xl font-bold text-white">${route}</h1>
      <p className="mt-3 text-slate-300">This route ships with the template. Ask Vodex to expand it.</p>
    </main>
  );
}
`;
}

function buildComponentStub(name: string, accent: string): string {
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  return `type Props = { title?: string };

export function ${name.replace(/\s+/g, "")}({ title = "${name}" }: Props) {
  return (
    <div className="rounded-xl border border-white/10 p-4" style={{ borderColor: "${accent}33" }}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">Template component — ready to customize.</p>
    </div>
  );
}

export default ${name.replace(/\s+/g, "")};
`;
}

function buildMockData(tables: { name: string; columns: string[] }[]): string {
  const rows =
    tables.length > 0
      ? tables
          .map(
            (t) => `  {
    id: "1",
    table: "${t.name}",
    ${t.columns
      .filter((c) => c !== "id")
      .slice(0, 3)
      .map((c) => `${c}: "sample"`)
      .join(",\n    ")}
  }`,
          )
          .join(",\n")
      : `  { id: "1", label: "Sample item", status: "active" }`;

  return `export type SampleRecord = {
  id: string;
  table?: string;
  label?: string;
  status?: string;
  [key: string]: string | undefined;
};

export const sampleRecords: SampleRecord[] = [
${rows}
];

export const templateStats = {
  users: 128,
  sessions: 412,
  conversion: "4.2%",
};
`;
}

function buildTypesFile(): string {
  return `export type NavItem = { href: string; label: string };

export type TemplateMeta = {
  version: string;
  seededAt: string;
};
`;
}

function buildAppShell(appTitle: string, routes: string[]): string {
  const links = routes
    .filter((r) => r !== "/")
    .slice(0, 5)
    .map((r) => `    { href: "${r}", label: "${r.replace(/^\//, "") || "Home"}" },`)
    .join("\n");

  return `import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
${links}
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 border-b border-white/10 px-6 py-3 text-sm">
        <span className="font-semibold text-white">${appTitle}</span>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="text-slate-400 hover:text-white">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
`;
}

/** Real starter files duplicated into the user workspace (not prompt-only). */
export function getTemplateSourceFiles(templateId: string): TemplateSourceFile[] {
  const catalog = getTemplateById(templateId);
  const core = getCoreTemplate(templateId);
  const resolved = resolveTemplateId(templateId) ?? templateId;

  const appTitle = catalog?.name ?? core?.name ?? "Template App";
  const tagline = catalog?.description ?? core?.description ?? "A Vodex template workspace.";
  const accent = catalog?.accent ?? "#38bdf8";
  const routes = core?.defaultRoutes ?? ["/", "/settings"];
  const components = core?.defaultComponents ?? ["Hero", "Feature grid"];
  const tables = core?.defaultDataModel ?? [{ name: "items", columns: ["id", "label", "status"] }];
  const primaryCta = core?.defaultActions[0] ?? "Get started";

  const files: TemplateSourceFile[] = [
    { path: "app/layout.tsx", content: buildLayout(appTitle) },
    { path: "app/globals.css", content: buildGlobalsCss(accent) },
    { path: "app/page.tsx", content: buildHomePage(appTitle, tagline, components.slice(0, 4), primaryCta) },
    { path: "lib/mock-data.ts", content: buildMockData(tables) },
    { path: "lib/types.ts", content: buildTypesFile() },
    { path: componentFileName("app-shell"), content: buildAppShell(appTitle, routes) },
    { path: "README.md", content: `# ${appTitle}\n\nVodex template \`${resolved}\`. Edit files or prompt the builder to customize.\n` },
  ];

  for (const route of routes) {
    if (route === "/") continue;
    files.push({ path: routeToPagePath(route), content: buildRoutePage(route, appTitle) });
  }

  for (const comp of components.slice(0, 6)) {
    const path = componentFileName(comp);
    if (!files.some((f) => f.path === path)) {
      files.push({ path, content: buildComponentStub(comp, accent) });
    }
  }

  return files;
}

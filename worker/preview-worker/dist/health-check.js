function isViteSpaShell(trimmed) {
    const hasRoot = /id=["']root["']/i.test(trimmed) ||
        /id=["']app["']/i.test(trimmed) ||
        trimmed.includes("generated-app-preview-root");
    if (!hasRoot || trimmed.length < 120)
        return false;
    return (/<script\s+[^>]*type=["']module["']/i.test(trimmed) ||
        /\/assets\//i.test(trimmed) ||
        /src=["'][^"']+\.js["']/i.test(trimmed));
}
export function checkPreviewHealth(html) {
    const trimmed = html.trim();
    if (isViteSpaShell(trimmed)) {
        return { previewRenderable: true, blockedReason: null };
    }
    if (trimmed.length < 80) {
        return { previewRenderable: false, blockedReason: "Preview HTML is empty or too short" };
    }
    const lower = trimmed.toLowerCase();
    if (!lower.includes("<html") && !lower.includes("<body")) {
        return { previewRenderable: false, blockedReason: "Preview HTML missing document structure" };
    }
    const visible = lower.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").length;
    if (visible < 40) {
        return { previewRenderable: false, blockedReason: "Preview appears blank" };
    }
    return { previewRenderable: true, blockedReason: null };
}

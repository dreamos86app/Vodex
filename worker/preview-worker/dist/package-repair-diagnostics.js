export const VITE_BINARY_MISSING_CODE = "VITE_BINARY_MISSING_AFTER_INSTALL";
export const VITE_BUILD_OOM_CODE = "VITE_BUILD_OOM";
export function truncateForDiagnostics(text, max = 12_000) {
    if (text.length <= max)
        return text;
    return `${text.slice(0, max)}\n…[truncated]`;
}
export function emptyPackageRepairDiagnostics() {
    return {
        executed: false,
        repairChanged: false,
        viteDetectedInOriginal: false,
        viteInjected: false,
        pluginReactInjected: false,
        viteConfigCreated: false,
        packageJsonRelative: null,
        projectRoot: null,
        originalPackageJson: null,
        finalPackageJson: null,
        beforeInstall: null,
        afterInstall: null,
        repairs: [],
        summary: "not run",
        errorCode: null,
    };
}

import { buildVite } from "./vite-builder.js";
/** CRA uses build/ output — vite-builder resolves via framework id passed separately in job-runner */
export async function buildCra(root, framework, files) {
    return buildVite(root, framework, files);
}

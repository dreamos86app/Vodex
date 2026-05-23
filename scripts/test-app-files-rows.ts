import {
  buildZipImportAppFileRows,
  ZIP_IMPORT_APP_FILE_INSERT_KEYS,
} from "../src/lib/projects/app-file-rows";

function assert(cond: boolean, msg: string, errors: string[]) {
  if (!cond) errors.push(msg);
}

async function main() {
  const errors: string[] = [];

  const rows = buildZipImportAppFileRows("proj-1", "owner-1", [
    { path: "src/index.ts", content: "export {}", sizeBytes: 12 },
  ]);
  assert(rows[0]?.owner_id === "owner-1", "owner_id included", errors);
  assert(rows[0]?.source === "zip_import", "zip_import source", errors);
  assert(ZIP_IMPORT_APP_FILE_INSERT_KEYS.includes("owner_id"), "owner_id in contract keys", errors);

  if (errors.length) {
    errors.forEach((e) => console.error("✗", e));
    process.exit(1);
  }
  console.log("✓ app-files row helper tests OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import {
  ZIP_IMPORT_BUCKET,
  buildZipImportStoragePath,
  formatImportStorageError,
  importStorageNotConfiguredUserMessage,
  isStorageBucketMissingError,
  sanitizeZipArchiveFilename,
} from "../src/lib/import/zip-storage";

function assert(cond: boolean, msg: string, errors: string[]) {
  if (!cond) errors.push(msg);
}

async function main() {
  const errors: string[] = [];

  assert(ZIP_IMPORT_BUCKET === "zip-imports", "bucket name zip-imports", errors);

  const path1 = buildZipImportStoragePath("user-1", "proj-1", "my-app.zip");
  assert(path1 === "user-1/proj-1/my-app.zip", "scoped storage path", errors);
  assert(
    buildZipImportStoragePath("user-1", "proj-1", "../../evil.zip") === "user-1/proj-1/evil.zip",
    "basename-only filename prevents traversal segments",
    errors,
  );
  assert(sanitizeZipArchiveFilename("My App.zip") === "My_App.zip", "sanitize spaces", errors);

  assert(isStorageBucketMissingError("Bucket not found"), "detect bucket missing", errors);
  assert(!isStorageBucketMissingError("permission denied"), "ignore other errors", errors);

  const formatted = formatImportStorageError("Bucket not found");
  assert(
    formatted.error === importStorageNotConfiguredUserMessage(),
    "user-safe missing bucket message",
    errors,
  );
  assert(formatted.code === "IMPORT_STORAGE_NOT_CONFIGURED", "storage error code", errors);
  assert(formatted.adminDetail.bucket === "zip-imports", "admin bucket detail", errors);

  if (errors.length) {
    errors.forEach((e) => console.error("✗", e));
    process.exit(1);
  }
  console.log("✓ zip storage helper tests OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

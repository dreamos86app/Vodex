import type { ZipImportFile } from "@/lib/import/zip-file-validator";

const EXT_MIME: Record<string, string> = {
  ts: "text/typescript",
  tsx: "text/typescript",
  js: "text/javascript",
  jsx: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  mdx: "text/markdown",
  css: "text/css",
  scss: "text/css",
  html: "text/html",
  htm: "text/html",
  svg: "image/svg+xml",
  txt: "text/plain",
  yml: "text/yaml",
  yaml: "text/yaml",
};

function mimeForPath(path: string): string {
  const i = path.lastIndexOf(".");
  const ext = i >= 0 ? path.slice(i + 1).toLowerCase() : "";
  return EXT_MIME[ext] ?? "text/plain";
}

export type AppFileInsertRow = {
  project_id: string;
  owner_id: string;
  path: string;
  content: string;
  mime_type: string;
  size_bytes: number;
  source: string;
};

/** Build app_files upsert rows for imported text sources. */
export function buildZipImportAppFileRows(
  projectId: string,
  ownerId: string,
  files: ZipImportFile[],
): AppFileInsertRow[] {
  return files.map((f) => ({
    project_id: projectId,
    owner_id: ownerId,
    path: f.path,
    content: f.content,
    mime_type: mimeForPath(f.path),
    size_bytes: f.sizeBytes,
    source: "zip_import",
  }));
}

export const ZIP_IMPORT_APP_FILE_INSERT_KEYS = [
  "project_id",
  "owner_id",
  "path",
  "content",
  "mime_type",
  "size_bytes",
  "source",
] as const;

export function importSetupUpdatingUserMessage(): string {
  return "Import setup is updating. Please refresh and try again.";
}

export type AppFilesSchemaAdminDetail = {
  missingHint: string;
  migration: string;
  postgrestReload: string;
  supabaseProjectRef?: string;
};

export function appFilesSchemaAdminDetail(): AppFilesSchemaAdminDetail {
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
  return {
    missingHint: "app_files.mime_type (and related import metadata columns)",
    migration: "supabase/migrations/20260623130000_app_files_import_metadata.sql",
    postgrestReload: "NOTIFY pgrst, 'reload schema';",
    supabaseProjectRef: ref,
  };
}

/** PostgREST / schema-cache errors when app_files columns are missing. */
export function isAppFilesSchemaError(message: string): boolean {
  return /schema cache|could not find the .* column.*app_files|column .* does not exist/i.test(
    message,
  );
}

export function formatAppFilesSchemaError(rawMessage: string): {
  error: string;
  code: "IMPORT_SCHEMA_UPDATING";
  adminDetail: AppFilesSchemaAdminDetail;
  rawMessage: string;
} {
  return {
    error: importSetupUpdatingUserMessage(),
    code: "IMPORT_SCHEMA_UPDATING",
    adminDetail: appFilesSchemaAdminDetail(),
    rawMessage,
  };
}

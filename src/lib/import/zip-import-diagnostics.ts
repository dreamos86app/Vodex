import { ZIP_IMPORT_BUCKET } from "@/lib/import/zip-storage";
import { appFilesSchemaAdminDetail } from "@/lib/projects/app-file-rows";

export type ZipImportFailureStep =
  | "project_create"
  | "storage_setup"
  | "storage_upload"
  | "app_files_upsert"
  | "imported_projects_insert";

export type ZipImportAdminDetail = {
  step: ZipImportFailureStep;
  rawMessage: string;
  postgrestCode?: string;
  table?: string;
  missingColumn?: string;
  insertPayloadKeys?: string[];
  supabaseProjectRef?: string;
  supabaseUrl?: string;
  bucket?: string;
  projectId?: string;
  importId?: string;
  migrationHint?: string;
  postgrestReload?: string;
};

const MISSING_COLUMN_RE =
  /could not find the '([^']+)' column|column "([^"]+)" (?:of relation "([^"]+)" )?does not exist|null value in column "([^"]+)"/i;

export function parseMissingColumn(message: string): { column?: string; table?: string } {
  const m = message.match(MISSING_COLUMN_RE);
  if (!m) return {};
  const column = m[1] ?? m[2] ?? m[4];
  const table = m[3] ?? (message.includes("app_files") ? "app_files" : undefined);
  return { column, table };
}

export function supabaseProjectRef(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
}

export function buildZipImportAdminDetail(input: {
  step: ZipImportFailureStep;
  rawMessage: string;
  insertPayloadKeys?: string[];
  projectId?: string;
  importId?: string;
  migrationHint?: string;
}): ZipImportAdminDetail {
  const { column, table } = parseMissingColumn(input.rawMessage);
  const schema = appFilesSchemaAdminDetail();
  return {
    step: input.step,
    rawMessage: input.rawMessage,
    table: table ?? (input.step.includes("app_files") ? "app_files" : undefined),
    missingColumn: column,
    insertPayloadKeys: input.insertPayloadKeys,
    supabaseProjectRef: supabaseProjectRef(),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    bucket: input.step.startsWith("storage") ? ZIP_IMPORT_BUCKET : undefined,
    projectId: input.projectId,
    importId: input.importId ?? input.projectId,
    migrationHint: input.migrationHint ?? schema.migration,
    postgrestReload: schema.postgrestReload,
  };
}

export function zipImportFailureUserMessage(step: ZipImportFailureStep): string {
  if (step === "app_files_upsert") {
    return "Import setup is updating. Please refresh and try again.";
  }
  if (step.startsWith("storage")) {
    return "Import storage is not configured yet. Please contact the workspace owner or try again after setup.";
  }
  return "ZIP import failed. Please try again.";
}

export function zipImportFailureCode(step: ZipImportFailureStep): string {
  if (step === "app_files_upsert") return "IMPORT_APP_FILES_FAILED";
  if (step.startsWith("storage")) return "IMPORT_STORAGE_NOT_CONFIGURED";
  if (step === "imported_projects_insert") return "IMPORT_METADATA_FAILED";
  return "IMPORT_FAILED";
}

export function isDevImportDiagnostics(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function formatZipImportFailure(input: {
  step: ZipImportFailureStep;
  rawMessage: string;
  insertPayloadKeys?: string[];
  projectId?: string;
}): {
  error: string;
  code: string;
  hint?: string;
  adminDetail: ZipImportAdminDetail;
  devError?: string;
} {
  const adminDetail = buildZipImportAdminDetail(input);
  const body: {
    error: string;
    code: string;
    hint?: string;
    adminDetail: ZipImportAdminDetail;
    devError?: string;
  } = {
    error: zipImportFailureUserMessage(input.step),
    code: zipImportFailureCode(input.step),
    hint: input.rawMessage,
    adminDetail,
  };
  if (isDevImportDiagnostics()) {
    body.devError = input.rawMessage;
    body.error = input.rawMessage;
  }
  return body;
}

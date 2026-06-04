function errorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const e = error as { message?: string; details?: string; hint?: string };
  return `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  return (error as { code?: string }).code;
}

/** Table missing from DB or PostgREST cache. */
export function isStatusTableMissingError(error: unknown): boolean {
  const msg = errorMessage(error);
  const code = errorCode(error);
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

/** Column missing — table exists; reload schema cache or apply latest migration. */
export function isStatusPermissionDeniedError(error: unknown): boolean {
  const msg = errorMessage(error);
  const code = errorCode(error);
  return code === "42501" || msg.includes("permission denied");
}

export function isStatusColumnMissingError(error: unknown): boolean {
  const msg = errorMessage(error);
  const code = errorCode(error);
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("could not find the column") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

/** @deprecated prefer isStatusTableMissingError / isStatusColumnMissingError */
export function isStatusSchemaMissingError(error: unknown): boolean {
  return isStatusTableMissingError(error) || isStatusColumnMissingError(error);
}

export const STATUS_SCHEMA_INSTALL_HINT =
  "Status tables are missing. Apply supabase/migrations/20260802120000_p29_status_announcements_schema_repair.sql (and earlier status migrations if needed), then run: NOTIFY pgrst, 'reload schema';";

export const STATUS_SCHEMA_CACHE_HINT =
  "Tables exist but PostgREST schema cache is stale. In Supabase SQL Editor run: NOTIFY pgrst, 'reload schema'; then click Refresh schema check.";

export function uptimePercentForStatus(status: string): number {
  switch (status) {
    case "operational":
      return 100;
    case "maintenance":
      return 92;
    case "degraded":
      return 96;
    case "partial_outage":
      return 85;
    case "major_outage":
      return 55;
    default:
      return 100;
  }
}

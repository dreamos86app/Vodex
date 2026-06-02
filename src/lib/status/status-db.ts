/** Supabase/PostgREST errors when status tables are missing from schema cache. */
export function isStatusSchemaMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("platform_announcements") ||
    msg.includes("status_components") ||
    msg.includes("could not find the table")
  );
}

export const STATUS_SCHEMA_INSTALL_HINT =
  "Apply migration supabase/migrations/20260720120000_platform_status.sql and 20260721120000_platform_status_p16.sql in Supabase, then run: NOTIFY pgrst, 'reload schema';";

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

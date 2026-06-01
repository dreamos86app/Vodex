import { isDreamosOwnerEmail } from "@/lib/admin-owner";

/** Server-only: full build/preview diagnostics for platform owners. */
export function canViewBuildDiagnostics(email: string | null | undefined): boolean {
  return isDreamosOwnerEmail(email);
}

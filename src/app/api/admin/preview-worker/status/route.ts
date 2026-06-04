import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const status = await loadPreviewWorkerStatus();
  return NextResponse.json(status);
}

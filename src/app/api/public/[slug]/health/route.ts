import { NextResponse } from "next/server";
import { probePublishedAppHealth } from "@/lib/publish/published-app-runtime";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const safe = slug?.trim().toLowerCase();
  if (!safe) {
    return NextResponse.json({ status: "failed", ok: false }, { status: 404 });
  }

  const probe = await probePublishedAppHealth(safe);
  return NextResponse.json(
    {
      status: probe.ok ? "ok" : probe.status,
      ok: probe.ok,
      slug: probe.slug,
      source: probe.source,
      renderVerified: probe.renderVerified,
      diagnostics: probe.diagnostics,
    },
    { status: probe.ok ? 200 : 503 },
  );
}

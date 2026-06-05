import { NextResponse } from "next/server";
import {
  loadPublishedAppBySlug,
  normalizePublishedRoute,
  resolvePublishedAppHtml,
  markPublishedRenderVerified,
} from "@/lib/publish/published-app-runtime";

export const dynamic = "force-dynamic";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
  "X-Frame-Options": "SAMEORIGIN",
};

/** Serves published app HTML directly — no iframe shell. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug, path: pathSegments } = await ctx.params;
  const safe = slug?.trim().toLowerCase();
  if (!safe) return new NextResponse("Not found", { status: 404 });

  const published = await loadPublishedAppBySlug(safe);
  if (!published) return new NextResponse("Not found", { status: 404 });

  const url = new URL(req.url);
  const routeFromQuery = url.searchParams.get("route")?.trim();
  const routePath = routeFromQuery
    ? normalizePublishedRoute(routeFromQuery.split("/").filter(Boolean))
    : normalizePublishedRoute(pathSegments);

  const result = await resolvePublishedAppHtml({ published, routePath });

  if (result.renderVerified && result.source !== "error") {
    void markPublishedRenderVerified(safe, true);
  }

  return new NextResponse(result.html, {
    status: result.statusCode,
    headers: HTML_HEADERS,
  });
}

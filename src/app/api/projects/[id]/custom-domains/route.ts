import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getEntitlements } from "@/lib/billing/plan-entitlements";
import { normalizePlanId } from "@/lib/billing/plans";
import {
  buildCustomDomainDnsInstructions,
  normalizeCustomDomainHostname,
  verifyCustomDomainDns,
} from "@/lib/publish/custom-domain-dns";

export const dynamic = "force-dynamic";

async function ownerPlan(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("plan_id").eq("id", userId).maybeSingle();
  return getEntitlements(normalizePlanId((data as { plan_id?: string } | null)?.plan_id ?? "free"));
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data: rows } = (await admin
    .from("custom_domains" as never)
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })) as { data: Record<string, unknown>[] | null };

  return NextResponse.json({ domains: rows ?? [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ent = await ownerPlan(supabase, user.id);
  if (!ent.canUseCustomDomain) {
    return NextResponse.json({ error: "Upgrade to Starter+ for custom domains" }, { status: 403 });
  }

  const body = (await req.json()) as { hostname?: string; action?: string; domainId?: string };
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  if (body.action === "verify" && body.domainId) {
    const { data: row } = (await admin
      .from("custom_domains" as never)
      .select("*")
      .eq("id", body.domainId)
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle()) as { data: Record<string, unknown> | null };

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const hostname = String(row.hostname ?? "");
    const token = String(row.verification_token ?? "");
    const dns = await verifyCustomDomainDns(hostname, token);
    const verified = dns.txtVerified && dns.cnameVerified;
    const status = verified ? "active" : dns.txtVerified || dns.cnameVerified ? "verified" : "pending_dns";

    await admin
      .from("custom_domains" as never)
      .update({
        status,
        last_checked_at: new Date().toISOString(),
        verified_at: verified ? new Date().toISOString() : null,
        dns_records: dns.records,
        failure_reason: verified ? null : dns.errors.join("; ") || "DNS not configured",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", body.domainId);

    return NextResponse.json({ ok: verified, status, dns });
  }

  if (body.action === "remove" && body.domainId) {
    await admin
      .from("custom_domains" as never)
      .delete()
      .eq("id", body.domainId)
      .eq("project_id", projectId)
      .eq("owner_id", user.id);
    return NextResponse.json({ ok: true });
  }

  const rawHost = body.hostname?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!rawHost || !rawHost.includes(".")) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { hostname } = normalizeCustomDomainHostname(rawHost);
  const token = crypto.randomUUID().replace(/-/g, "");
  const instructions = buildCustomDomainDnsInstructions(rawHost, token);

  const { data, error } = await admin
    .from("custom_domains" as never)
    .insert({
      project_id: projectId,
      owner_id: user.id,
      hostname,
      verification_token: token,
      status: "pending_dns",
      dns_records: instructions,
    } as never)
    .select("*")
    .maybeSingle();

  if (error) {
    const code = error.code === "23505" ? "domain_taken" : "db_error";
    return NextResponse.json({ error: error.message, code }, { status: code === "domain_taken" ? 409 : 500 });
  }

  return NextResponse.json({ domain: data, instructions });
}

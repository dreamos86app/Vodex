import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/send-resend-email";
import { MARKETING_EMAIL_TEMPLATES } from "@/lib/email/marketing-email-templates";
import { getAppUrl } from "@/lib/app-url";

type TargetPlan = "all_opted_in" | "free" | "starter" | "pro" | "infinity";

export async function POST(req: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await req.json()) as {
    templateId?: string;
    targetPlan?: TargetPlan;
    targetEmail?: string;
    testOnly?: boolean;
  };

  const template = MARKETING_EMAIL_TEMPLATES.find((t) => t.id === body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const appUrl = getAppUrl().replace(/\/$/, "");

  let recipients: Array<{ id: string; email: string; full_name?: string | null }> = [];

  if (body.testOnly && body.targetEmail?.trim()) {
    recipients = [{ id: owner.user.id, email: body.targetEmail.trim().toLowerCase(), full_name: null }];
  } else if (body.targetEmail?.trim()) {
    const { data: profile } = await db
      .from("profiles")
      .select("id, email, full_name, marketing_emails_opt_in")
      .eq("email", body.targetEmail.trim().toLowerCase())
      .maybeSingle();
    if (!profile?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!body.testOnly && !profile.marketing_emails_opt_in) {
      return NextResponse.json({ error: "User opted out of marketing emails" }, { status: 400 });
    }
    recipients = [profile];
  } else {
    const { data: rows } = await db
      .from("profiles")
      .select("id, email, full_name, plan_id, marketing_emails_opt_in")
      .eq("marketing_emails_opt_in", true)
      .limit(5000);
    const target = body.targetPlan ?? "all_opted_in";
    recipients = (rows ?? []).filter((p: { plan_id?: string }) => {
      if (target === "all_opted_in") return true;
      const plan = (p.plan_id ?? "free").toLowerCase();
      if (target === "free") return plan === "free";
      if (target === "starter") return plan === "starter";
      if (target === "pro") return plan === "pro";
      if (target === "infinity") return plan.startsWith("infinity") || plan === "enterprise";
      return true;
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No opted-in recipients" }, { status: 400 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const unsubscribeUrl = `${appUrl}/settings/notifications`;
    const html = template.buildHtml({
      appUrl,
      unsubscribeUrl,
      name: r.full_name?.split(/\s+/)[0] ?? undefined,
    });
    const result = await sendResendEmail({
      to: r.email,
      subject: template.subject,
      text: template.preheader,
      html,
      devConsoleFallback: true,
      devLabel: "marketing",
    });
    if (result.deliveredToInbox || result.channel === "dev_console") sent += 1;
    else if (result.error) errors.push(result.error);
  }

  if (!body.testOnly) {
    await db.from("email_campaigns").insert({
      template_id: template.id,
      subject: template.subject,
      target_scope: body.targetEmail ? "single" : body.targetPlan ?? "all_opted_in",
      target_email: body.targetEmail ?? null,
      recipient_count: sent,
      status: sent > 0 ? "sent" : "failed",
      created_by: owner.user.id,
    });
  }

  return NextResponse.json({
    ok: sent > 0,
    sent,
    attempted: recipients.length,
    errors: errors.slice(0, 3),
  });
}

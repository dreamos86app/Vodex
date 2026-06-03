export type MarketingEmailTemplateId =
  | "welcome"
  | "getting_started"
  | "credits_low"
  | "new_feature"
  | "upgrade_offer";

export type MarketingEmailTemplate = {
  id: MarketingEmailTemplateId;
  label: string;
  subject: string;
  preheader: string;
  buildHtml: (ctx: { appUrl: string; unsubscribeUrl: string; name?: string }) => string;
};

function layout(body: string, ctx: { appUrl: string; unsubscribeUrl: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vodex</title></head>
<body style="margin:0;padding:0;background:#f0f9ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#e0f2fe 0%,#f8fafc 40%);padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(14,116,244,0.12);">
<tr><td style="padding:28px 32px 8px;background:linear-gradient(135deg,#0ea5e9,#6366f1);">
<span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;">Vodex</span>
</td></tr>
<tr><td style="padding:24px 32px 32px;font-size:15px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:0 32px 28px;font-size:12px;color:#64748b;line-height:1.5;">
<p style="margin:0 0 8px;">© ${new Date().getFullYear()} Vodex · <a href="${ctx.appUrl}" style="color:#2563eb;">Open Vodex</a></p>
<p style="margin:0;">You're receiving product emails because you opted in. <a href="${ctx.unsubscribeUrl}" style="color:#2563eb;">Manage email preferences</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export const MARKETING_EMAIL_TEMPLATES: MarketingEmailTemplate[] = [
  {
    id: "welcome",
    label: "Welcome to Vodex",
    subject: "Welcome to Vodex — start building",
    preheader: "Your AI-native app workspace is ready.",
    buildHtml: (ctx) =>
      layout(
        `<p>Hi${ctx.name ? ` ${ctx.name}` : ""},</p>
<p>Welcome to <strong>Vodex</strong>. You can describe an app in plain language and ship a real preview in minutes.</p>
<p style="margin:24px 0;"><a href="${ctx.appUrl}/create" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Create your first app</a></p>
<p>Questions? Reply to this email or visit our help center.</p>`,
        ctx,
      ),
  },
  {
    id: "getting_started",
    label: "Getting started / first app",
    subject: "Build your first app on Vodex",
    preheader: "A quick guide to your first generation.",
    buildHtml: (ctx) =>
      layout(
        `<p>Ready to ship something real?</p>
<ol style="padding-left:20px;">
<li>Open the builder and describe your app idea.</li>
<li>Review the live preview and iterate in chat.</li>
<li>Connect integrations from your app dashboard when you're ready to go live.</li>
</ol>
<p><a href="${ctx.appUrl}/create" style="color:#2563eb;font-weight:600;">Start building →</a></p>`,
        ctx,
      ),
  },
  {
    id: "credits_low",
    label: "Credits running low",
    subject: "Your Vodex credits are running low",
    preheader: "Upgrade or wait for your monthly reset.",
    buildHtml: (ctx) =>
      layout(
        `<p>Your build or action credits are nearly used up for this period.</p>
<p>Upgrade for more capacity, or wait for your plan reset — your projects stay saved either way.</p>
<p><a href="${ctx.appUrl}/pricing" style="color:#2563eb;font-weight:600;">View plans →</a></p>`,
        ctx,
      ),
  },
  {
    id: "new_feature",
    label: "New feature announcement",
    subject: "New on Vodex",
    preheader: "Fresh improvements to generation and publishing.",
    buildHtml: (ctx) =>
      layout(
        `<p>We've shipped new improvements to Vodex — faster generation, richer dashboards, and smoother publishing.</p>
<p><a href="${ctx.appUrl}/changelog" style="color:#2563eb;font-weight:600;">Read the changelog →</a></p>`,
        ctx,
      ),
  },
  {
    id: "upgrade_offer",
    label: "Upgrade / special offer",
    subject: "Unlock more on Vodex",
    preheader: "More credits, integrations, and collaboration.",
    buildHtml: (ctx) =>
      layout(
        `<p>Upgrade to unlock more build credits, Pro integrations, and collaboration for your workspace.</p>
<p><a href="${ctx.appUrl}/pricing" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;">See pricing</a></p>`,
        ctx,
      ),
  },
];

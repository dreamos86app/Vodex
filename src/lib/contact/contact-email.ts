import { getEmailConfig } from "@/lib/email/email-config";
import { sendResendEmail } from "@/lib/email/send-resend-email";
import type { ContactEmailStatus, ContactRequestRecord } from "@/lib/contact/contact-types";

export type ContactNotificationTarget = {
  to: string;
  bcc?: string[];
  label: string;
};

export function resolveContactNotificationTarget(input: {
  ownerUserEmail?: string | null;
  isPlatformContact?: boolean;
}): ContactNotificationTarget {
  const cfg = getEmailConfig();
  if (input.ownerUserEmail && !input.isPlatformContact) {
    const bcc =
      cfg.platformContactCopy && cfg.contactNotificationsTo !== input.ownerUserEmail
        ? [cfg.contactNotificationsTo]
        : undefined;
    return {
      to: input.ownerUserEmail,
      bcc,
      label: "app_owner",
    };
  }
  return {
    to: cfg.contactNotificationsTo,
    label: "platform",
  };
}

export function buildContactNotificationEmail(input: {
  request: Pick<
    ContactRequestRecord,
    | "source"
    | "name"
    | "email"
    | "subject"
    | "message"
    | "reason"
    | "project_id"
    | "app_slug"
    | "created_at"
  >;
  projectName?: string | null;
}): { subject: string; text: string; html: string } {
  const r = input.request;
  const subjectLine = r.subject?.trim() || r.reason?.trim() || "New contact request";
  const subject = `[Vodex Contact] ${subjectLine}`;
  const lines = [
    "New contact request on Vodex",
    "",
    `Source: ${r.source}`,
    r.project_id ? `Project ID: ${r.project_id}` : null,
    input.projectName ? `Project: ${input.projectName}` : null,
    r.app_slug ? `App slug: ${r.app_slug}` : null,
    r.reason ? `Reason: ${r.reason}` : null,
    "",
    `From: ${r.name} <${r.email}>`,
    `Time: ${new Date(r.created_at).toISOString()}`,
    "",
    "Message:",
    r.message,
    "",
    "Reply directly to this email to respond to the sender.",
  ].filter(Boolean) as string[];

  const text = lines.join("\n");
  const html = [
    "<h2>New contact request</h2>",
    `<p><strong>Source:</strong> ${escapeHtml(r.source)}</p>`,
    r.project_id ? `<p><strong>Project ID:</strong> ${escapeHtml(r.project_id)}</p>` : "",
    input.projectName ? `<p><strong>Project:</strong> ${escapeHtml(input.projectName)}</p>` : "",
    r.app_slug ? `<p><strong>App slug:</strong> ${escapeHtml(r.app_slug)}</p>` : "",
    r.reason ? `<p><strong>Reason:</strong> ${escapeHtml(r.reason)}</p>` : "",
    `<p><strong>From:</strong> ${escapeHtml(r.name)} &lt;${escapeHtml(r.email)}&gt;</p>`,
    `<p><strong>Time:</strong> ${escapeHtml(new Date(r.created_at).toISOString())}</p>`,
    "<hr/>",
    `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(r.message)}</pre>`,
  ].join("");

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactNotificationEmail(input: {
  request: ContactRequestRecord;
  ownerUserEmail?: string | null;
  projectName?: string | null;
  isPlatformContact?: boolean;
}): Promise<{ emailStatus: ContactEmailStatus; error?: string; message: string }> {
  const cfg = getEmailConfig();
  const target = resolveContactNotificationTarget({
    ownerUserEmail: input.ownerUserEmail,
    isPlatformContact: input.isPlatformContact,
  });
  const { subject, text, html } = buildContactNotificationEmail({
    request: input.request,
    projectName: input.projectName,
  });

  const bcc =
    target.bcc ??
    (input.isPlatformContact || target.label === "platform"
      ? [cfg.contactNotificationsTo]
      : undefined);

  const result = await sendResendEmail({
    to: target.to,
    bcc,
    subject,
    text,
    html,
    replyTo: input.request.email,
    devConsoleFallback: true,
    devLabel: `contact:${input.request.id.slice(0, 8)}`,
  });

  if (result.channel === "dev_console") {
    return {
      emailStatus: "skipped_no_config",
      message: result.message,
    };
  }
  if (result.deliveredToInbox) {
    return { emailStatus: "sent", message: result.message };
  }
  return {
    emailStatus: "failed",
    error: result.error,
    message: result.message,
  };
}

import { getEmailConfig } from "@/lib/email/email-config";

export type ResendDeliveryChannel = "resend" | "dev_console" | "none";

export type SendResendEmailInput = {
  to: string | string[];
  bcc?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | string[];
  /** When true, log to server console in dev if Resend is not configured. */
  devConsoleFallback?: boolean;
  /** Label for dev console logging */
  devLabel?: string;
};

export type SendResendEmailResult = {
  deliveredToInbox: boolean;
  channel: ResendDeliveryChannel;
  message: string;
  error?: string;
  resendId?: string;
};

function normalizeRecipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean);
}

/** Server-only transactional email via Resend. Never exposes API key to client. */
export async function sendResendEmail(
  input: SendResendEmailInput,
): Promise<SendResendEmailResult> {
  const cfg = getEmailConfig();
  const recipients = normalizeRecipients(input.to);
  if (recipients.length === 0) {
    return {
      deliveredToInbox: false,
      channel: "none",
      message: "No email recipients configured.",
      error: "missing_recipients",
    };
  }

  if (!cfg.resendApiKey) {
    if (!cfg.isProduction && input.devConsoleFallback) {
      console.info(
        `[email:${input.devLabel ?? "dev"}] Resend not configured. Would send to`,
        recipients.join(", "),
        "subject:",
        input.subject,
      );
      console.info(`[email:${input.devLabel ?? "dev"}] Body preview:\n${input.text.slice(0, 800)}`);
      return {
        deliveredToInbox: false,
        channel: "dev_console",
        message: "Email not configured (RESEND_API_KEY missing). Logged to server console in dev.",
      };
    }
    return {
      deliveredToInbox: false,
      channel: "none",
      message: cfg.isProduction
        ? "Email sending is not configured on the server."
        : "Email not configured (RESEND_API_KEY missing).",
      error: "RESEND_API_KEY missing",
    };
  }

  try {
    const body: Record<string, unknown> = {
      from: cfg.from,
      to: recipients,
      subject: input.subject,
      text: input.text,
    };
    if (input.html) body.html = input.html;
    if (input.replyTo) {
      body.reply_to = Array.isArray(input.replyTo) ? input.replyTo : [input.replyTo];
    }
    if (input.bcc) {
      body.bcc = Array.isArray(input.bcc) ? input.bcc : [input.bcc];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const error = `Resend failed (${res.status}): ${errText.slice(0, 300)}`;
      return {
        deliveredToInbox: false,
        channel: "none",
        message: "Could not send email via Resend.",
        error,
      };
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      deliveredToInbox: true,
      channel: "resend",
      message: `Email sent to ${recipients.join(", ")}.`,
      resendId: json.id,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      deliveredToInbox: false,
      channel: "none",
      message: "Email provider error.",
      error,
    };
  }
}

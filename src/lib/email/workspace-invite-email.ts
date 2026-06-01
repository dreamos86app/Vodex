import { APP_URL, BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand/brand-config";
import { sendResendEmail } from "@/lib/email/send-resend-email";

export type WorkspaceInviteEmailInput = {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  acceptUrl: string;
  expiresAt: Date;
};

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "editor") return "Editor";
  if (r === "viewer") return "Viewer";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function buildWorkspaceInviteEmailHtml(input: WorkspaceInviteEmailInput): string {
  const expires = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const role = roleLabel(input.role);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0c10;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#12151c;border-radius:16px;border:1px solid #2a3140;overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#6b9fff;letter-spacing:0.06em;text-transform:uppercase;">${BRAND_NAME}</p>
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:600;color:#f4f7fd;line-height:1.3;">You&apos;re invited to join a workspace</h1>
        </td></tr>
        <tr><td style="padding:8px 28px 0;">
          <p style="margin:0;font-size:15px;color:#9ca8bc;line-height:1.55;">
            <strong style="color:#e8edf5;">${input.inviterName}</strong>
            (${input.inviterEmail}) invited you to collaborate on
            <strong style="color:#e8edf5;">${input.workspaceName}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:20px 28px 0;">
          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#1e6bff22;color:#6b9fff;font-size:12px;font-weight:600;">${role}</span>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <a href="${input.acceptUrl}" style="display:inline-block;background:#1e6bff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:0 28px 12px;">
          <p style="margin:0;font-size:12px;color:#8b9cb3;line-height:1.55;padding:12px 14px;background:#1a2030;border-radius:10px;border:1px solid #2a3140;">
            <strong style="color:#c5d0e0;">Credits:</strong> By default, AI usage in this workspace consumes your own credits unless the workspace owner enables workspace-sponsored billing.
          </p>
        </td></tr>
        <tr><td style="padding:0 28px 24px;">
          <p style="margin:0;font-size:12px;color:#6b7a90;line-height:1.5;">This link expires on ${expires}. If the button doesn&apos;t work, copy and paste:</p>
          <p style="margin:8px 0 0;font-size:11px;color:#6b9fff;word-break:break-all;">${input.acceptUrl}</p>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;border-top:1px solid #2a3140;">
          <p style="margin:0;font-size:11px;color:#5c6778;">Questions? ${SUPPORT_EMAIL}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#5c6778;">${BRAND_NAME} · ${APP_URL.replace(/^https?:\/\//, "")}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWorkspaceInviteEmail(input: WorkspaceInviteEmailInput) {
  const subject = `You're invited to join a ${BRAND_NAME} workspace`;
  const text = [
    `${input.inviterName} (${input.inviterEmail}) invited you to "${input.workspaceName}" on ${BRAND_NAME}.`,
    `Role: ${roleLabel(input.role)}`,
    ``,
    `Accept: ${input.acceptUrl}`,
    `Expires: ${input.expiresAt.toISOString()}`,
    ``,
    `Support: ${SUPPORT_EMAIL}`,
  ].join("\n");

  return sendResendEmail({
    to: input.to,
    subject,
    text,
    html: buildWorkspaceInviteEmailHtml(input),
    devConsoleFallback: true,
    devLabel: "workspace-invite",
  });
}

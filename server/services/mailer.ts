// Tiny transactional email helper. Today only one consumer exists — the
// "board shared with you" email fired from POST /api/boards/:id/shares — so
// the surface area is intentionally small. We talk to SendGrid's REST API
// directly via fetch to avoid pulling in another SDK; if a different
// provider is ever standardized we can swap the implementation behind the
// same exported helpers.
//
// Configuration (all optional):
//   - SENDGRID_API_KEY: if unset, all sends become no-ops that log a warning.
//     This keeps local/dev environments quiet without forcing every developer
//     to provision a real key.
//   - MAIL_FROM_EMAIL: required when SENDGRID_API_KEY is set.
//   - MAIL_FROM_NAME: optional display name for the From: header.
//   - APP_BASE_URL / BASE_URL: used to build absolute deep links into the app.

export interface SendEmailParams {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html: string;
}

function getFromAddress(): { email: string; name?: string } | null {
  const email = process.env.MAIL_FROM_EMAIL?.trim();
  if (!email) return null;
  const name = process.env.MAIL_FROM_NAME?.trim();
  return name ? { email, name } : { email };
}

export function getAppBaseUrl(reqHost?: string | null): string {
  const fromEnv = (process.env.APP_BASE_URL || process.env.BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (reqHost) return `https://${reqHost}`.replace(/\/$/, "");
  return "";
}

// Sends a transactional email via SendGrid. Returns true on success, false
// if the send was skipped or failed; callers should treat email as best
// effort and never block their primary flow on the result.
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[mailer] SENDGRID_API_KEY not set — skipping email send",
      JSON.stringify({ event: "mailer.skipped.no_api_key", to: params.to, subject: params.subject }),
    );
    return false;
  }
  const from = getFromAddress();
  if (!from) {
    console.error(
      "[mailer] MAIL_FROM_EMAIL not set — cannot send",
      JSON.stringify({ event: "mailer.skipped.no_from", to: params.to, subject: params.subject }),
    );
    return false;
  }

  const body = {
    personalizations: [
      {
        to: [params.toName ? { email: params.to, name: params.toName } : { email: params.to }],
        subject: params.subject,
      },
    ],
    from,
    content: [
      { type: "text/plain", value: params.text },
      { type: "text/html", value: params.html },
    ],
  };

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[mailer] SendGrid responded with non-2xx",
        JSON.stringify({
          event: "mailer.send.failed",
          status: res.status,
          to: params.to,
          subject: params.subject,
          body: text.slice(0, 500),
        }),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[mailer] Email send threw",
      JSON.stringify({
        event: "mailer.send.error",
        to: params.to,
        subject: params.subject,
        error: (err as Error)?.message ?? String(err),
      }),
    );
    return false;
  }
}

export interface BoardSharedEmailParams {
  recipientEmail: string;
  recipientName?: string | null;
  sharerName: string;
  boardTitle: string;
  boardUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBoardSharedEmail(params: BoardSharedEmailParams): Promise<boolean> {
  const { recipientEmail, recipientName, sharerName, boardTitle, boardUrl } = params;
  const safeSharer = escapeHtml(sharerName);
  const safeTitle = escapeHtml(boardTitle);
  const safeUrl = escapeHtml(boardUrl);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi,";

  const subject = `${sharerName} shared "${boardTitle}" with you`;

  const text = [
    recipientName ? `Hi ${recipientName},` : "Hi,",
    "",
    `${sharerName} shared the board "${boardTitle}" with you on Atlas.`,
    "",
    `Open it here: ${boardUrl}`,
    "",
    "If you'd rather not get these emails, you can turn them off in your account settings.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>${greeting}</p>
    <p><strong>${safeSharer}</strong> shared the board <strong>"${safeTitle}"</strong> with you.</p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Open board</a>
    </p>
    <p style="color: #555; font-size: 13px;">Or paste this link into your browser:<br /><a href="${safeUrl}">${safeUrl}</a></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #888; font-size: 12px;">You're receiving this because someone shared a board with you. You can turn off these emails in your account settings.</p>
  </body>
</html>`;

  return sendEmail({
    to: recipientEmail,
    toName: recipientName ?? undefined,
    subject,
    text,
    html,
  });
}

export interface BoardUnsharedEmailParams {
  recipientEmail: string;
  recipientName?: string | null;
  removerName: string;
  boardTitle: string;
}

export async function sendBoardUnsharedEmail(params: BoardUnsharedEmailParams): Promise<boolean> {
  const { recipientEmail, recipientName, removerName, boardTitle } = params;
  const safeRemover = escapeHtml(removerName);
  const safeTitle = escapeHtml(boardTitle);
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi,";

  const subject = `${removerName} removed your access to "${boardTitle}"`;

  const text = [
    recipientName ? `Hi ${recipientName},` : "Hi,",
    "",
    `${removerName} removed your access to the board "${boardTitle}" on Atlas.`,
    "",
    "You won't see this board in your Shared tab anymore. If you think this was a mistake, reach out to them directly.",
    "",
    "If you'd rather not get these emails, you can turn them off in your account settings.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>${greeting}</p>
    <p><strong>${safeRemover}</strong> removed your access to the board <strong>"${safeTitle}"</strong>.</p>
    <p style="color: #555;">You won't see this board in your Shared tab anymore. If you think this was a mistake, reach out to them directly.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #888; font-size: 12px;">You're receiving this because someone changed your access to a shared board. You can turn off these emails in your account settings.</p>
  </body>
</html>`;

  return sendEmail({
    to: recipientEmail,
    toName: recipientName ?? undefined,
    subject,
    text,
    html,
  });
}

export interface BoardLeftEmailParams {
  ownerEmail: string;
  ownerName?: string | null;
  leaverName: string;
  boardTitle: string;
  boardUrl: string;
}

export async function sendBoardLeftEmail(params: BoardLeftEmailParams): Promise<boolean> {
  const { ownerEmail, ownerName, leaverName, boardTitle, boardUrl } = params;
  const safeLeaver = escapeHtml(leaverName);
  const safeTitle = escapeHtml(boardTitle);
  const safeUrl = escapeHtml(boardUrl);
  const greeting = ownerName ? `Hi ${escapeHtml(ownerName)},` : "Hi,";

  const subject = `${leaverName} left "${boardTitle}"`;

  const text = [
    ownerName ? `Hi ${ownerName},` : "Hi,",
    "",
    `${leaverName} just left your shared board "${boardTitle}" on Atlas.`,
    "",
    `They no longer have access. You can manage who the board is shared with here: ${boardUrl}`,
    "",
    "If you'd rather not get these emails, you can turn them off in your account settings.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>${greeting}</p>
    <p><strong>${safeLeaver}</strong> just left your shared board <strong>"${safeTitle}"</strong>.</p>
    <p style="color: #555;">They no longer have access. You can manage who the board is shared with from the board page.</p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="display: inline-block; background: #111; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Open board</a>
    </p>
    <p style="color: #555; font-size: 13px;">Or paste this link into your browser:<br /><a href="${safeUrl}">${safeUrl}</a></p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #888; font-size: 12px;">You're receiving this because you own a shared board on Atlas. You can turn off these emails in your account settings.</p>
  </body>
</html>`;

  return sendEmail({
    to: ownerEmail,
    toName: ownerName ?? undefined,
    subject,
    text,
    html,
  });
}

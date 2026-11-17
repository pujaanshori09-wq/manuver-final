import { env, isProd } from '../config/env.js';
import { logger } from './logger.js';

export type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY (development) the
 * message is written to the log instead, so flows stay testable without an account.
 * Note: a Resend account without a verified domain can only send to its owner's address.
 */
export async function sendEmail(mail: Email): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (isProd) throw new Error('RESEND_API_KEY is required in production');
    logger.info({ to: mail.to, subject: mail.subject }, `[email] (not sent, no RESEND_API_KEY)\n${mail.text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn({ status: res.status, body: body.slice(0, 300) }, 'Resend rejected the email');
    throw new Error(`Email not sent (${res.status})`);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Small branded layout: dark header, one message, one button, plain-text fallback link. */
export function layout(opts: { title: string; intro: string; button: string; url: string; footer: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0b0b0c;padding:20px 28px"><span style="color:#ff5a1f;font-size:24px;font-weight:700;letter-spacing:-0.5px">manuver</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px">${esc(opts.title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#3f3f46">${esc(opts.intro)}</p>
<a href="${esc(opts.url)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">${esc(opts.button)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#71717a">${esc(opts.footer)}<br><a href="${esc(opts.url)}" style="color:#71717a;word-break:break-all">${esc(opts.url)}</a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${opts.title}\n\n${opts.intro}\n\n${opts.button}: ${opts.url}\n\n${opts.footer}`;
  return { html, text };
}

/** The public origin used in email links (the tunnel in development, the domain in production). */
export function publicOrigin(): string {
  return (env.OAUTH_ORIGINS[0] ?? env.PUBLIC_BASE_URL).replace(/\/+$/, '');
}

// Gmail email sending via Nodemailer (SMTP). Configuration comes from .env:
//
//   GMAIL_USER          — the Gmail address that sends (e.g. petvibe.clinic@gmail.com)
//   GMAIL_APP_PASSWORD  — a 16-character Google "app password" for that account
//   EMAIL_FROM_NAME     — display name shown in recipients' inboxes (default "PetVibe Care")
//   EMAIL_TEST_TO       — optional: redirect every email to one address (dev/testing)
//
// Gmail app passwords require 2-Step Verification on the Google account. Create
// one at https://myaccount.google.com/apppasswords (see also the README).
//
// When GMAIL_USER / GMAIL_APP_PASSWORD are missing, the app keeps working in
// simulated mode — emails are logged to the console instead of sent, which is
// exactly what dev runs want. sendMail() never throws: a failed SMTP send is
// logged and reported as `false` so it can't take down a booking flow.
import nodemailer from 'nodemailer'
import 'dotenv/config'

const user = process.env.GMAIL_USER || ''
const pass = process.env.GMAIL_APP_PASSWORD || ''
const fromName = process.env.EMAIL_FROM_NAME || 'PetVibe Care'
const testTo = process.env.EMAIL_TEST_TO || ''

export const emailConfigured = Boolean(user && pass)

// Created lazily so an unconfigured dev box never tries to reach Gmail.
let transporter = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: { user, pass },
    })
  }
  return transporter
}

// Send one email. Returns true when the message was actually handed to Gmail
// (or would have been, in simulated mode); false on failure. Never throws.
export async function sendMail({ to, subject, text, html }) {
  if (!emailConfigured) {
    console.log(`[email:simulated] to ${to} — ${subject}`)
    return true
  }
  const target = testTo || to
  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${user}>`,
      to: target,
      subject: testTo ? `[TEST] ${subject}` : subject,
      text,
      ...(html ? { html } : {}),
    })
    console.log(`[email:sent] to ${target} — ${subject}`)
    return true
  } catch (e) {
    console.error(`[email:failed] to ${target} — ${subject}: ${e.message}`)
    return false
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Minimal branded HTML wrapper (deep teal + amber from the site palette) so
// notification emails don't look like plain text dumps. `text` stays the
// canonical body; `html` is only a fancier rendering of the same content.
export function emailHtml(subject, body) {
  const paragraphs = String(body)
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6">${escapeHtml(p)}</p>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#E8F3EE;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1F2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8F3EE;padding:24px 0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #d7e7e0">
          <tr>
            <td style="background:#0A4D52;padding:20px 28px">
              <span style="color:#ffffff;font-size:20px;font-weight:700">PetVibe Care 🐾</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px">
              <h2 style="margin:0 0 16px;color:#0A4D52;font-size:18px">${escapeHtml(subject)}</h2>
              ${paragraphs}
              <p style="margin:24px 0 0;color:#6b7280;font-size:12px;border-top:1px solid #eee;padding-top:12px">
                PetVibe Care — you're receiving this because you have an account or booking with us.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

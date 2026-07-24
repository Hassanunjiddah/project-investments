// Small helper to send transactional email via Resend REST API.
// Uses the RESEND_API_KEY + SENDER_EMAIL secrets set on the Supabase project.

export type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmailViaResend(input: ResendSendInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('SENDER_EMAIL') ?? 'onboarding@resend.dev';

  if (!apiKey) {
    // Fail loud so the edge function returns 500 (rather than pretending it sent)
    throw new Error('RESEND_API_KEY is not configured on this Supabase project.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body.slice(0, 400)}`);
  }
}

// Build the invitation HTML — Prism Capital branded, print-safe layout.
export function renderInviteEmail(params: {
  projectName: string;
  managerName: string;
  code: string;
  signInUrl: string;
  maxInvestmentNaira?: number | null;
}): { html: string; text: string; subject: string } {
  const { projectName, managerName, code, signInUrl, maxInvestmentNaira } = params;
  const capLine = maxInvestmentNaira
    ? `<p style="margin:16px 0 0 0;color:#4E5A52;font-size:14px;line-height:1.6;">You have been allocated up to <strong style="color:#0F1512;">₦${maxInvestmentNaira.toLocaleString()}</strong> on this project.</p>`
    : '';

  const subject = `Invitation to invest in ${projectName} · Prism Capital`;

  // Design tokens (kept in sync with src/constants/colors.ts light palette).
  //   BRAND_700 #166534 · INK_TEXT #0F1512 · INK_MUTED #4E5A52
  //   INK_LINE #D5DED8 · INK_FAINT #F1F4EF · GOLD_500 #B08D2E · BRAND_50 #EEF7F0

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <!-- Preheader (hidden) -->
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(managerName)} has invited you to invest in ${escapeHtml(projectName)}. Your 8-character code is ${escapeHtml(code)}.</div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
          <!-- Top green rule -->
          <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>

          <!-- Header band -->
          <tr>
            <td style="padding:28px 32px 6px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;letter-spacing:0.4px;">INVITATION</span>
                  </td>
                </tr>
                <tr><td colspan="2"><span style="font-size:12px;color:#4E5A52;">Institutional Private Placements</span></td></tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 32px 4px 32px;">
              <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#0F1512;font-weight:600;letter-spacing:-0.4px;">You have been invited to invest</h1>
              <p style="margin:0;color:#4E5A52;font-size:15px;line-height:1.6;">
                <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong> has invited you to invest in
                <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> — a Shariah-compliant project on Prism Capital's institutional platform.
              </p>
              ${capLine}
            </td>
          </tr>

          <!-- Code panel (gold accent) -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div style="border:1px solid #EED28A;border-radius:14px;background:#FEF9E9;padding:20px 20px 18px 20px;">
                <p style="margin:0 0 8px 0;color:#7A5300;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Your one-time sign-in code</p>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;color:#0F1512;font-weight:700;padding:6px 0 0 0;">${escapeHtml(code)}</div>
                <p style="margin:12px 0 0 0;color:#7A5300;font-size:12px;">Valid for 14 days · single use</p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <a href="${signInUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px;font-size:14px;letter-spacing:0.2px;">Sign in to review the project →</a>
              <p style="margin:14px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;word-break:break-all;">${signInUrl}</p>
            </td>
          </tr>

          <!-- Next steps -->
          <tr>
            <td style="padding:8px 32px 22px 32px;">
              <table role="presentation" width="100%" style="border-top:1px solid #D5DED8;margin-top:6px;">
                <tr><td style="padding-top:18px;">
                  <p style="margin:0 0 10px 0;color:#166534;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Next steps</p>
                  <ol style="margin:0;padding-left:20px;color:#0F1512;font-size:14px;line-height:1.75;">
                    <li>Open the sign-in page (button above or paste the link).</li>
                    <li>Enter your email and the 8-character code.</li>
                    <li>Set a password for future sign-ins.</li>
                    <li>Review project terms, then pledge whole units of the project.</li>
                  </ol>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Trust markers -->
          <tr>
            <td style="padding:6px 32px 22px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td width="50%" style="padding:12px 8px 0 0;">
                    <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;font-weight:600;">Four-eyes approvals</p>
                    <p style="margin:2px 0 0 0;color:#0F1512;font-size:12px;line-height:1.5;">Every distribution passes maker-checker review.</p>
                  </td>
                  <td width="50%" style="padding:12px 0 0 8px;">
                    <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;font-weight:600;">Double-entry ledger</p>
                    <p style="margin:2px 0 0 0;color:#0F1512;font-size:12px;line-height:1.5;">Every kobo posted to Prism's audited books.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
              <p style="margin:0 0 6px 0;color:#4E5A52;font-size:11px;line-height:1.6;">
                You received this email because <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong> invited you to a Prism Capital project. If you don't recognise this invitation you can safely ignore this message.
              </p>
              <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">
                Private placement · Institutional investors only · Prism Capital
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `PRISM CAPITAL · Institutional Private Placements

You have been invited to invest in "${projectName}".

${managerName} has invited you to review this Shariah-compliant project on Prism Capital's institutional platform.
${maxInvestmentNaira ? `\nYou have been allocated up to NGN ${maxInvestmentNaira.toLocaleString()} on this project.\n` : ''}
YOUR ONE-TIME SIGN-IN CODE
${code}
Valid for 14 days · single use

Sign in: ${signInUrl}

NEXT STEPS
1. Open the sign-in page.
2. Enter your email and the 8-character code above.
3. Set a password for future sign-ins.
4. Review project terms, then pledge whole units.

—
Private placement · Institutional investors only · Prism Capital
`;

  return { html, text, subject };
}

function escapeHtml(input: string): string {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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

// Build the invitation HTML.
export function renderInviteEmail(params: {
  projectName: string;
  managerName: string;
  code: string;
  signInUrl: string;
  maxInvestmentNaira?: number | null;
}): { html: string; text: string; subject: string } {
  const { projectName, managerName, code, signInUrl, maxInvestmentNaira } = params;
  const capLine = maxInvestmentNaira
    ? `You've been allocated up to <strong>₦${maxInvestmentNaira.toLocaleString()}</strong> on this project.`
    : '';

  const subject = `You've been invited to invest in ${projectName}`;

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f7fa;padding:32px 0;">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:32px 32px 16px 32px;">
          <h1 style="margin:0 0 8px 0;color:#0f172a;font-size:22px;line-height:1.3;">You're invited to invest</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            ${escapeHtml(managerName)} has invited you to invest in
            <strong style="color:#0f172a;">${escapeHtml(projectName)}</strong> on RibhShare — a Shariah-compliant investment platform.
          </p>
          ${capLine ? `<p style="margin:12px 0 0 0;color:#475569;font-size:14px;line-height:1.6;">${capLine}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 24px 32px;">
          <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Your first-time sign-in code</p>
          <div style="background:#0f766e;color:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:26px;letter-spacing:6px;padding:16px 20px;border-radius:12px;text-align:center;font-weight:700;">${code}</div>
          <p style="margin:12px 0 0 0;color:#64748b;font-size:12px;">Valid for 14 days. One-time use.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px 32px;">
          <a href="${signInUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:14px;">Sign in to review the project</a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px 32px;">
          <p style="margin:0 0 6px 0;color:#0f172a;font-size:13px;font-weight:600;">Next steps</p>
          <ol style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.7;">
            <li>Tap the button above (or paste the link into your browser).</li>
            <li>Enter your email and the 8-character code above.</li>
            <li>Set a password for future sign-ins.</li>
            <li>Review the project terms and commit your investment.</li>
          </ol>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">You received this email because ${escapeHtml(managerName)} invited you to a RibhShare project. If you don't recognize this invitation you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </div>`;

  const text = `You're invited to invest in "${projectName}" on RibhShare.

Your first-time sign-in code: ${code}
Valid for 14 days. One-time use.

Sign in here: ${signInUrl}

Next steps:
1. Open the sign-in page.
2. Enter your email and the code above.
3. Set a password for future sign-ins.
4. Review the project terms and commit your investment.
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

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
  minUnits?: number | null;
}): { html: string; text: string; subject: string } {
  const { projectName, managerName, code, signInUrl, minUnits } = params;
  const capLine = minUnits
    ? `<p style="margin:16px 0 0 0;color:#4E5A52;font-size:14px;line-height:1.6;">Minimum subscription: <strong style="color:#0F1512;">${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'}</strong> on this project.</p>`
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
${minUnits ? `\nMinimum subscription: ${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'} on this project.\n` : ''}
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

// Staff invitation — sent when the CEO creates a Line Manager account.
// Same visual shell as the investor invite, with a role-onboarding framing.
export function renderStaffInviteEmail(params: {
  fullName: string;
  roleLabel: string;
  code: string;
  signInUrl: string;
}): { html: string; text: string; subject: string } {
  const { fullName, roleLabel, code, signInUrl } = params;
  const subject = `You've been invited to join Prism Capital as a ${roleLabel}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">You have been invited to join Prism Capital as a ${escapeHtml(roleLabel)}. Your 8-character code is ${escapeHtml(code)}.</div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
          <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>

          <tr>
            <td style="padding:28px 32px 6px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;letter-spacing:0.4px;">TEAM INVITATION</span>
                  </td>
                </tr>
                <tr><td colspan="2"><span style="font-size:12px;color:#4E5A52;">Institutional Private Placements</span></td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 4px 32px;">
              <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#0F1512;font-weight:600;letter-spacing:-0.4px;">Welcome to the team, ${escapeHtml(fullName)}</h1>
              <p style="margin:0;color:#4E5A52;font-size:15px;line-height:1.6;">
                You have been invited to join Prism Capital as a
                <strong style="color:#0F1512;">${escapeHtml(roleLabel)}</strong>. Use the one-time code below to sign in for the first time and set your password.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div style="border:1px solid #EED28A;border-radius:14px;background:#FEF9E9;padding:20px 20px 18px 20px;">
                <p style="margin:0 0 8px 0;color:#7A5300;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Your one-time sign-in code</p>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;color:#0F1512;font-weight:700;padding:6px 0 0 0;">${escapeHtml(code)}</div>
                <p style="margin:12px 0 0 0;color:#7A5300;font-size:12px;">Valid for 14 days · single use</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <a href="${signInUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px;font-size:14px;letter-spacing:0.2px;">Set up your account →</a>
              <p style="margin:14px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;word-break:break-all;">${signInUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 22px 32px;">
              <table role="presentation" width="100%" style="border-top:1px solid #D5DED8;margin-top:6px;">
                <tr><td style="padding-top:18px;">
                  <p style="margin:0 0 10px 0;color:#166534;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Next steps</p>
                  <ol style="margin:0;padding-left:20px;color:#0F1512;font-size:14px;line-height:1.75;">
                    <li>Open the setup page (button above or paste the link).</li>
                    <li>Enter your email and the 8-character code.</li>
                    <li>Set a password for future sign-ins.</li>
                    <li>Create projects and invite investors from your dashboard.</li>
                  </ol>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
              <p style="margin:0 0 6px 0;color:#4E5A52;font-size:11px;line-height:1.6;">
                You received this email because the CEO of Prism Capital invited you to join the team. If you don't recognise this invitation you can safely ignore this message.
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

Welcome to the team, ${fullName}.

You have been invited to join Prism Capital as a ${roleLabel}.

YOUR ONE-TIME SIGN-IN CODE
${code}
Valid for 14 days · single use

Set up your account: ${signInUrl}

NEXT STEPS
1. Open the setup page.
2. Enter your email and the 8-character code above.
3. Set a password for future sign-ins.
4. Create projects and invite investors from your dashboard.

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

// -----------------------------------------------------------------------------
// Project update notification email
// -----------------------------------------------------------------------------

const UPDATE_KIND_LABELS: Record<string, string> = {
  RISK: 'Risk update',
  FUND_USE: 'Fund use',
  ENGAGEMENT: 'Engagement',
  MILESTONE: 'Milestone',
  ANNOUNCEMENT: 'Announcement',
};

export function renderProjectUpdateEmail(params: {
  projectName: string;
  managerName: string;
  updateKind: string;
  updateTitle: string;
  updateBody: string;
  amountNaira?: number | null;
  projectUrl: string;
}): { html: string; text: string; subject: string } {
  const {
    projectName,
    managerName,
    updateKind,
    updateTitle,
    updateBody,
    amountNaira,
    projectUrl,
  } = params;
  const kindLabel = UPDATE_KIND_LABELS[updateKind] ?? updateKind;
  const subject = `${kindLabel}: ${updateTitle} · ${projectName}`;
  const amountLine =
    amountNaira && amountNaira > 0
      ? `<p style="margin:8px 0 0 0;color:#4E5A52;font-size:13px;">Amount: <strong style="color:#0F1512;">₦${amountNaira.toLocaleString()}</strong></p>`
      : '';
  const bodyBlock = updateBody
    ? `<p style="margin:14px 0 0 0;color:#0F1512;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(updateBody)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
        <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 6px 32px;">
          <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
          <div style="font-size:12px;color:#4E5A52;margin-top:2px;">Project update · ${escapeHtml(projectName)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 4px 32px;">
          <span style="display:inline-block;background:#EEF7F0;color:#166534;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${escapeHtml(kindLabel)}</span>
          <h1 style="margin:12px 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0F1512;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(updateTitle)}</h1>
          <p style="margin:0;color:#4E5A52;font-size:13px;">Posted by <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong></p>
          ${amountLine}
          ${bodyBlock}
        </td></tr>
        <tr><td style="padding:22px 32px 10px 32px;">
          <a href="${projectUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;font-size:14px;">Open project →</a>
        </td></tr>
        <tr><td style="padding:14px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
          <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">You are receiving this because you hold a confirmed position in <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> on Prism Capital.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `PRISM CAPITAL — ${projectName}
${kindLabel}: ${updateTitle}
Posted by ${managerName}
${amountNaira && amountNaira > 0 ? `Amount: NGN ${amountNaira.toLocaleString()}\n` : ''}
${updateBody}

Open project: ${projectUrl}
`;

  return { subject, html, text };
}

// -----------------------------------------------------------------------------
// Profit declaration approved email
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Generic branded notification email — used for approval requests, decisions,
// and new-message alerts where a bespoke layout isn't warranted.
// -----------------------------------------------------------------------------

export function renderGenericNotifyEmail(params: {
  /** Small uppercase label above the heading, e.g. "Approval required". */
  kicker: string;
  heading: string;
  /** Paragraphs rendered in order. */
  bodyLines: string[];
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
  subject: string;
}): { html: string; text: string; subject: string } {
  const { kicker, heading, bodyLines, ctaLabel, ctaUrl, footerNote, subject } = params;

  const paragraphs = bodyLines
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:10px 0 0 0;color:#0F1512;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(line)}</p>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
        <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 6px 32px;">
          <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
          <div style="font-size:12px;color:#4E5A52;margin-top:2px;">Institutional Private Placements</div>
        </td></tr>
        <tr><td style="padding:16px 32px 4px 32px;">
          <span style="display:inline-block;background:#EEF7F0;color:#166534;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${escapeHtml(kicker)}</span>
          <h1 style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0F1512;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(heading)}</h1>
          ${paragraphs}
        </td></tr>
        <tr><td style="padding:22px 32px 10px 32px;">
          <a href="${ctaUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;font-size:14px;">${escapeHtml(ctaLabel)} →</a>
        </td></tr>
        <tr><td style="padding:14px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
          <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">${escapeHtml(footerNote)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `PRISM CAPITAL — ${kicker}
${heading}

${bodyLines.filter(Boolean).join('\n\n')}

${ctaLabel}: ${ctaUrl}
`;

  return { subject, html, text };
}

export function renderDeclarationApprovedEmail(params: {
  projectName: string;
  label: string;
  isFinal: boolean;
  perUnitNaira: number;
  investorPoolNaira: number;
  totalUnits: number;
  investorUnits: number | null;
  reference: string | null;
  projectUrl: string;
}): { html: string; text: string; subject: string } {
  const {
    projectName,
    label,
    isFinal,
    perUnitNaira,
    investorPoolNaira,
    totalUnits,
    investorUnits,
    reference,
    projectUrl,
  } = params;

  const badge = isFinal ? 'Final distribution' : 'Interim distribution';
  const subject = `${badge}: ${label} · ${projectName}`;
  const investorPayoutLine =
    investorUnits && investorUnits > 0
      ? `<p style="margin:8px 0 0 0;color:#4E5A52;font-size:13px;">Your estimated share: <strong style="color:#0F1512;">₦${(perUnitNaira * investorUnits).toLocaleString()}</strong> (${investorUnits.toLocaleString()} unit${investorUnits === 1 ? '' : 's'})</p>`
      : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
        <tr><td style="height:4px;background:#B08D2E;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 6px 32px;">
          <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
          <div style="font-size:12px;color:#4E5A52;margin-top:2px;">Distribution approved · ${escapeHtml(projectName)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 4px 32px;">
          <span style="display:inline-block;background:#FEF9E9;color:#7A5300;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;border:1px solid #EED28A;">${escapeHtml(badge)}</span>
          <h1 style="margin:12px 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0F1512;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(label)}</h1>
          ${reference ? `<p style="margin:0;color:#4E5A52;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;">Ref · ${escapeHtml(reference)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;">
          <div style="border:1px solid #D5DED8;border-radius:12px;padding:16px 18px;background:#F9FAF7;">
            <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.8px;font-weight:600;text-transform:uppercase;">Per-unit payout</p>
            <p style="margin:4px 0 12px 0;color:#0F1512;font-size:22px;font-weight:700;">₦${perUnitNaira.toLocaleString()}</p>
            <p style="margin:0;color:#4E5A52;font-size:12px;">Investor pool: <strong style="color:#0F1512;">₦${investorPoolNaira.toLocaleString()}</strong> · Across ${totalUnits.toLocaleString()} unit${totalUnits === 1 ? '' : 's'}</p>
            ${investorPayoutLine}
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px 10px 32px;">
          <a href="${projectUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;font-size:14px;">View statement →</a>
          <p style="margin:12px 0 0 0;color:#4E5A52;font-size:12px;line-height:1.6;">This distribution has passed the four-eyes checker review and been posted to the ledger.</p>
        </td></tr>
        <tr><td style="padding:14px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
          <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">You are receiving this because you hold a confirmed position in <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> on Prism Capital.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `PRISM CAPITAL — ${projectName}
${badge}: ${label}
${reference ? `Ref: ${reference}\n` : ''}
Per-unit payout: NGN ${perUnitNaira.toLocaleString()}
Investor pool: NGN ${investorPoolNaira.toLocaleString()} across ${totalUnits.toLocaleString()} units
${investorUnits && investorUnits > 0 ? `Your estimated share: NGN ${(perUnitNaira * investorUnits).toLocaleString()} (${investorUnits} unit${investorUnits === 1 ? '' : 's'})\n` : ''}
View statement: ${projectUrl}
`;

  return { subject, html, text };
}

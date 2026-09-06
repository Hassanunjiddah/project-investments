// Edge function invoked by Postgres triggers (via pg_net) whenever a project
// posts an update or a profit declaration is approved. Fans out one email
// per confirmed investor via Resend.
//
// Auth model: the trigger includes an `x-webhook-secret` header matching the
// NOTIFY_WEBHOOK_SECRET env var on this Supabase project. All DB reads use
// the service role client (bypasses RLS) because the caller is Postgres, not
// a signed-in user.
//
// Payload shapes:
//   { "type": "PROJECT_UPDATE",         "recordId": "<project_update uuid>" }
//   { "type": "DECLARATION_APPROVED",   "recordId": "<profit_declaration uuid>" }
//   { "type": "DECLARATION_SUBMITTED",  "recordId": "<profit_declaration uuid>" }
//   { "type": "DECLARATION_REJECTED",   "recordId": "<profit_declaration uuid>" }
//   { "type": "PROJECT_SUBMITTED",      "recordId": "<project uuid>" }
//   { "type": "PROJECT_DECIDED",        "recordId": "<project uuid>" }
//   { "type": "NEW_MESSAGE",            "recordId": "<message uuid>" }
//   { "type": "PROOF_SUBMITTED",        "recordId": "<invite uuid>" }
//   { "type": "PROFIT_PROPOSED",         "recordId": "<profit_declaration uuid>" }
//   { "type": "DRAWDOWN_REQUESTED",     "recordId": "<fund_drawdown uuid>" }
//   { "type": "DRAWDOWN_DECIDED",       "recordId": "<fund_drawdown uuid>" }
//   { "type": "WITHDRAWAL_REQUESTED",   "recordId": "<withdrawal_request uuid>" }
//   { "type": "WITHDRAWAL_DECIDED",     "recordId": "<withdrawal_request uuid>" }
//
// Idempotency: we don't retry within the function. Duplicate trigger fires
// would send duplicate emails — this is acceptable for the current volume.

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseClient.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import {
  sendEmailViaResend,
  renderProjectUpdateEmail,
  renderDeclarationApprovedEmail,
  renderGenericNotifyEmail,
} from '../_shared/email.ts';

type NotifyType =
  | 'PROJECT_UPDATE'
  | 'DECLARATION_APPROVED'
  | 'DECLARATION_SUBMITTED'
  | 'DECLARATION_REJECTED'
  | 'PROJECT_SUBMITTED'
  | 'PROJECT_DECIDED'
  | 'NEW_MESSAGE'
  | 'PROOF_SUBMITTED'
  | 'PROFIT_PROPOSED'
  | 'DRAWDOWN_REQUESTED'
  | 'DRAWDOWN_DECIDED'
  | 'WITHDRAWAL_REQUESTED'
  | 'WITHDRAWAL_DECIDED';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // -- 1. Verify webhook secret --------------------------------------------
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (!expected) {
      throw new HttpError(500, 'NOTIFY_WEBHOOK_SECRET not configured');
    }
    const provided = req.headers.get('x-webhook-secret');
    if (provided !== expected) {
      throw new HttpError(401, 'Invalid webhook secret');
    }

    // -- 2. Parse & validate payload -----------------------------------------
    const body = await req.json();
    const type = String(body.type ?? '') as NotifyType;
    const recordId = String(body.recordId ?? '');
    if (!type || !recordId) {
      throw new HttpError(400, 'type and recordId are required');
    }

    const admin = createServiceClient();
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
    if (!appUrl) throw new HttpError(500, 'APP_URL not configured');

    // -- 3. Dispatch ---------------------------------------------------------
    if (type === 'PROJECT_UPDATE') {
      const result = await handleProjectUpdate(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'DECLARATION_APPROVED') {
      const result = await handleDeclarationApproved(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'DECLARATION_SUBMITTED') {
      const result = await handleDeclarationSubmitted(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'DECLARATION_REJECTED') {
      const result = await handleDeclarationRejected(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'PROJECT_SUBMITTED') {
      const result = await handleProjectSubmitted(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'PROJECT_DECIDED') {
      const result = await handleProjectDecided(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'NEW_MESSAGE') {
      const result = await handleNewMessage(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'PROOF_SUBMITTED') {
      return jsonResponse(await handleProofSubmitted(admin, recordId, appUrl));
    }
    if (type === 'PROFIT_PROPOSED') {
      return jsonResponse(await handleProfitProposed(admin, recordId, appUrl));
    }
    if (type === 'DRAWDOWN_REQUESTED') {
      return jsonResponse(await handleDrawdownRequested(admin, recordId, appUrl));
    }
    if (type === 'DRAWDOWN_DECIDED') {
      return jsonResponse(await handleDrawdownDecided(admin, recordId, appUrl));
    }
    if (type === 'WITHDRAWAL_REQUESTED') {
      return jsonResponse(await handleWithdrawalRequested(admin, recordId, appUrl));
    }
    if (type === 'WITHDRAWAL_DECIDED') {
      return jsonResponse(await handleWithdrawalDecided(admin, recordId, appUrl));
    }
    throw new HttpError(400, `Unknown notification type: ${type}`);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleProjectUpdate(admin: any, updateId: string, appUrl: string) {
  const { data: update, error: updateErr } = await admin
    .from('project_updates')
    .select(
      'id, project_id, kind, title, body, amount_minor, posted_by, projects:project_id(name), poster:posted_by(full_name)',
    )
    .eq('id', updateId)
    .single();
  if (updateErr || !update) {
    throw new HttpError(404, `project_update not found: ${updateErr?.message ?? updateId}`);
  }

  const projectName = update.projects?.name ?? 'Your project';
  const managerName = update.poster?.full_name ?? 'The project manager';
  const projectUrl = `${appUrl}/projects/${update.project_id}`;
  const amountNaira = update.amount_minor ? Math.round(update.amount_minor / 100) : null;

  const investors = await listConfirmedInvestorEmails(admin, update.project_id);
  const { subject, html, text } = renderProjectUpdateEmail({
    projectName,
    managerName,
    updateKind: update.kind,
    updateTitle: update.title,
    updateBody: update.body ?? '',
    amountNaira,
    projectUrl,
  });

  return await sendToRecipients(investors, subject, html, text);
}

// deno-lint-ignore no-explicit-any
async function handleDeclarationApproved(admin: any, declId: string, appUrl: string) {
  const { data: decl, error: declErr } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, is_final, per_unit_minor, investor_pool_minor, total_units_at_declaration, declared_by, projects:project_id(name), declarer:declared_by(email, full_name)',
    )
    .eq('id', declId)
    .single();
  if (declErr || !decl) {
    throw new HttpError(404, `profit_declaration not found: ${declErr?.message ?? declId}`);
  }

  const projectName = decl.projects?.name ?? 'Your project';
  const projectUrl = `${appUrl}/projects/${decl.project_id}`;
  const perUnitNaira = Math.round(Number(decl.per_unit_minor ?? 0) / 100);
  const investorPoolNaira = Math.round(Number(decl.investor_pool_minor ?? 0) / 100);

  // Fetch confirmed investors together with their unit counts, so each email
  // can show a personalised "your share" line.
  const { data: rows, error: invErr } = await admin
    .from('invites')
    .select('email, units_allotted, units_pledged, profiles:investor_id(email)')
    .eq('project_id', decl.project_id)
    .eq('status', 'CONFIRMED');
  if (invErr) throw new HttpError(500, invErr.message);

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const row of rows ?? []) {
    // deno-lint-ignore no-explicit-any
    const r: any = row;
    const email: string | null = r.profiles?.email ?? r.email ?? null;
    if (!email) continue;
    const units: number | null =
      typeof r.units_allotted === 'number'
        ? r.units_allotted
        : typeof r.units_pledged === 'number'
          ? r.units_pledged
          : null;

    const { subject, html, text } = renderDeclarationApprovedEmail({
      projectName,
      label: decl.label ?? (decl.is_final ? 'Final distribution' : 'Interim distribution'),
      isFinal: !!decl.is_final,
      perUnitNaira,
      investorPoolNaira,
      totalUnits: decl.total_units_at_declaration ?? 0,
      investorUnits: units,
      reference: decl.reference ?? null,
      projectUrl,
    });
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      results.push({ email, ok: true });
    } catch (err) {
      results.push({
        email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Also tell the declaring Line Manager their declaration passed review.
  const declarerEmail: string | null = decl.declarer?.email ?? null;
  if (declarerEmail) {
    const { subject, html, text } = renderGenericNotifyEmail({
      kicker: 'Declaration approved',
      heading: 'Your profit declaration was approved',
      bodyLines: [
        `${decl.label ?? decl.reference ?? 'Your declaration'} on ${projectName} has passed the four-eyes review and been posted to the ledger.`,
        `Investor pool: ₦${investorPoolNaira.toLocaleString()} · ₦${perUnitNaira.toLocaleString()} per unit.`,
      ],
      ctaLabel: 'Open project',
      ctaUrl: projectUrl,
      footerNote: `You are receiving this because you declared this distribution on ${projectName}.`,
      subject: `Declaration approved: ${decl.label ?? decl.reference ?? projectName} · Prism Capital`,
    });
    try {
      await sendEmailViaResend({ to: declarerEmail, subject, html, text });
      results.push({ email: declarerEmail, ok: true });
    } catch (err) {
      results.push({
        email: declarerEmail,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    type: 'DECLARATION_APPROVED',
    declarationId: declId,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

// deno-lint-ignore no-explicit-any
async function handleDeclarationSubmitted(admin: any, declId: string, appUrl: string) {
  const { data: decl, error } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, is_final, investor_pool_minor, projects:project_id(name), declarer:declared_by(full_name)',
    )
    .eq('id', declId)
    .single();
  if (error || !decl) {
    throw new HttpError(404, `profit_declaration not found: ${error?.message ?? declId}`);
  }

  const projectName = decl.projects?.name ?? 'a project';
  const declarerName = decl.declarer?.full_name ?? 'A line manager';
  const poolNaira = Math.round(Number(decl.investor_pool_minor ?? 0) / 100);
  const approvers = await listRoleEmails(admin, ['CEO', 'ADMIN']);

  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Approval required',
    heading: 'A profit declaration awaits your review',
    bodyLines: [
      `${declarerName} declared ${decl.label ?? decl.reference ?? 'a distribution'} on ${projectName}.`,
      `Investor pool: ₦${poolNaira.toLocaleString()}${decl.is_final ? ' · Final distribution' : ''}.`,
      'It needs your four-eyes approval before it is posted to the ledger.',
    ],
    ctaLabel: 'Review declaration',
    ctaUrl: `${appUrl}/projects/${decl.project_id}`,
    footerNote: 'You are receiving this as a Prism Capital approver.',
    subject: `Approval required: ${decl.label ?? decl.reference ?? projectName} · Prism Capital`,
  });

  return { type: 'DECLARATION_SUBMITTED', ...(await sendToRecipients(approvers, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleDeclarationRejected(admin: any, declId: string, appUrl: string) {
  const { data: decl, error } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, rejection_note, projects:project_id(name), declarer:declared_by(email)',
    )
    .eq('id', declId)
    .single();
  if (error || !decl) {
    throw new HttpError(404, `profit_declaration not found: ${error?.message ?? declId}`);
  }
  const declarerEmail: string | null = decl.declarer?.email ?? null;
  if (!declarerEmail) return { type: 'DECLARATION_REJECTED', sent: 0, failed: 0, results: [] };

  const projectName = decl.projects?.name ?? 'your project';
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Declaration rejected',
    heading: 'Your profit declaration was rejected',
    bodyLines: [
      `${decl.label ?? decl.reference ?? 'Your declaration'} on ${projectName} was rejected by the reviewer.`,
      decl.rejection_note ? `Reviewer note: ${decl.rejection_note}` : '',
      'You can correct the figures and declare again.',
    ],
    ctaLabel: 'Open project',
    ctaUrl: `${appUrl}/projects/${decl.project_id}`,
    footerNote: `You are receiving this because you declared this distribution on ${projectName}.`,
    subject: `Declaration rejected: ${decl.label ?? decl.reference ?? projectName} · Prism Capital`,
  });

  return {
    type: 'DECLARATION_REJECTED',
    ...(await sendToRecipients([declarerEmail], subject, html, text)),
  };
}

// deno-lint-ignore no-explicit-any
async function handleProjectSubmitted(admin: any, projectId: string, appUrl: string) {
  const { data: project, error } = await admin
    .from('projects')
    .select('id, name, code, target_minor, creator:created_by(full_name)')
    .eq('id', projectId)
    .single();
  if (error || !project) {
    throw new HttpError(404, `project not found: ${error?.message ?? projectId}`);
  }

  const targetNaira = Math.round(Number(project.target_minor ?? 0) / 100);
  const approvers = await listRoleEmails(admin, ['CEO', 'ADMIN']);

  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Approval required',
    heading: 'A project awaits your approval',
    bodyLines: [
      `${project.creator?.full_name ?? 'A line manager'} submitted ${project.code ? project.code + ' · ' : ''}${project.name}.`,
      targetNaira > 0 ? `Target raise: ₦${targetNaira.toLocaleString()}.` : '',
      'Review the brief, terms, and unit structure, then approve or reject it.',
    ],
    ctaLabel: 'Review project',
    ctaUrl: `${appUrl}/projects/${project.id}`,
    footerNote: 'You are receiving this as a Prism Capital approver.',
    subject: `Approval required: ${project.name} · Prism Capital`,
  });

  return { type: 'PROJECT_SUBMITTED', ...(await sendToRecipients(approvers, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleProjectDecided(admin: any, projectId: string, appUrl: string) {
  const { data: project, error } = await admin
    .from('projects')
    .select('id, name, code, approval_status, rejection_note, creator:created_by(email)')
    .eq('id', projectId)
    .single();
  if (error || !project) {
    throw new HttpError(404, `project not found: ${error?.message ?? projectId}`);
  }
  const ownerEmail: string | null = project.creator?.email ?? null;
  if (!ownerEmail) return { type: 'PROJECT_DECIDED', sent: 0, failed: 0, results: [] };

  const approved = project.approval_status === 'APPROVED';
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: approved ? 'Project approved' : 'Project rejected',
    heading: approved ? 'Your project was approved' : 'Your project was rejected',
    bodyLines: [
      `${project.code ? project.code + ' · ' : ''}${project.name} has been ${approved ? 'approved' : 'rejected'} by the CEO.`,
      approved
        ? 'You can now invite investors and begin the capital raise.'
        : project.rejection_note
          ? `Reviewer note: ${project.rejection_note}`
          : 'You can revise the project details and resubmit it for approval.',
    ],
    ctaLabel: 'Open project',
    ctaUrl: `${appUrl}/projects/${project.id}`,
    footerNote: 'You are receiving this because you own this project on Prism Capital.',
    subject: `${approved ? 'Approved' : 'Rejected'}: ${project.name} · Prism Capital`,
  });

  return {
    type: 'PROJECT_DECIDED',
    ...(await sendToRecipients([ownerEmail], subject, html, text)),
  };
}

// deno-lint-ignore no-explicit-any
async function handleNewMessage(admin: any, messageId: string, appUrl: string) {
  const { data: msg, error } = await admin
    .from('messages')
    .select(
      'id, thread_id, sender_id, body, thread:thread_id(project_id, investor_id, owner_id, manager_id), sender:sender_id(full_name)',
    )
    .eq('id', messageId)
    .single();
  if (error || !msg?.thread) {
    throw new HttpError(404, `message not found: ${error?.message ?? messageId}`);
  }

  // Mirror in-app trigger: counterparty (investor / owner / LM). CEO/ADMIN
  // messages notify every other participant on the thread.
  const thread = msg.thread;
  const participants = [thread.investor_id, thread.owner_id, thread.manager_id].filter(
    Boolean,
  ) as string[];
  let recipientIds: string[];
  if (participants.includes(msg.sender_id)) {
    recipientIds = participants.filter((id) => id !== msg.sender_id);
  } else {
    recipientIds = participants;
  }

  const emails = await emailsForUserIds(admin, recipientIds);

  const { data: project } = await admin
    .from('projects')
    .select('name')
    .eq('id', thread.project_id)
    .single();

  const senderName = msg.sender?.full_name ?? 'A participant';
  const projectName = project?.name ?? 'a project';
  const preview = String(msg.body ?? '').slice(0, 300);

  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'New message',
    heading: `${senderName} sent you a message`,
    bodyLines: [`Regarding ${projectName}:`, `“${preview}”`],
    ctaLabel: 'Reply in the app',
    ctaUrl: `${appUrl}/messages/${msg.thread_id}`,
    footerNote: `You are receiving this because you participate in this conversation on Prism Capital.`,
    subject: `New message from ${senderName} · ${projectName} · Prism Capital`,
  });

  return { type: 'NEW_MESSAGE', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleProofSubmitted(admin: any, inviteId: string, appUrl: string) {
  const { data: invite, error } = await admin
    .from('invites')
    .select(
      'id, project_id, email, projects:project_id(name, created_by), investor:investor_id(full_name, email)',
    )
    .eq('id', inviteId)
    .single();
  if (error || !invite) {
    throw new HttpError(404, `invite not found: ${error?.message ?? inviteId}`);
  }
  const lmId = invite.projects?.created_by;
  if (!lmId) return { type: 'PROOF_SUBMITTED', sent: 0, failed: 0, results: [] };
  const emails = await emailsForUserIds(admin, [lmId]);
  const projectName = invite.projects?.name ?? 'a project';
  const investorLabel = invite.investor?.full_name ?? invite.email ?? 'An investor';
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Payment proof',
    heading: 'Payment proof awaits confirmation',
    bodyLines: [`${investorLabel} submitted proof on ${projectName}.`],
    ctaLabel: 'Review proof',
    ctaUrl: `${appUrl}/projects/${invite.project_id}?tab=investors`,
    footerNote: 'You are receiving this because you manage this project on Prism Capital.',
    subject: `Payment proof · ${projectName} · Prism Capital`,
  });
  return { type: 'PROOF_SUBMITTED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleProfitProposed(admin: any, declId: string, appUrl: string) {
  const { data: decl, error } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, investor_pool_minor, projects:project_id(name, created_by), owner:declared_by(full_name)',
    )
    .eq('id', declId)
    .single();
  if (error || !decl) {
    throw new HttpError(404, `profit_declaration not found: ${error?.message ?? declId}`);
  }
  const lmId = decl.projects?.created_by;
  if (!lmId) return { type: 'PROFIT_PROPOSED', sent: 0, failed: 0, results: [] };
  const emails = await emailsForUserIds(admin, [lmId]);
  const projectName = decl.projects?.name ?? 'a project';
  const ownerName = decl.owner?.full_name ?? 'The project owner';
  const poolNaira = Math.round(Number(decl.investor_pool_minor ?? 0) / 100);
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Profit proposal',
    heading: `${ownerName} proposed a profit distribution`,
    bodyLines: [
      `${projectName} · ${decl.reference ?? 'proposal'}`,
      `Investor pool ≈ ₦${poolNaira.toLocaleString('en-NG')}. Review and forward for CEO approval.`,
    ],
    ctaLabel: 'Review proposal',
    ctaUrl: `${appUrl}/projects/${decl.project_id}?tab=profits`,
    footerNote: 'You are receiving this because you mediate this project on Prism Capital.',
    subject: `Profit proposed · ${projectName} · Prism Capital`,
  });
  return { type: 'PROFIT_PROPOSED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleDrawdownRequested(admin: any, drawdownId: string, appUrl: string) {
  const { data: row, error } = await admin
    .from('fund_drawdowns')
    .select(
      'id, project_id, amount_minor, purpose, category, reference, projects:project_id(name, created_by), requester:requested_by(full_name)',
    )
    .eq('id', drawdownId)
    .single();
  if (error || !row) {
    throw new HttpError(404, `fund_drawdown not found: ${error?.message ?? drawdownId}`);
  }
  const lmId = row.projects?.created_by;
  if (!lmId) return { type: 'DRAWDOWN_REQUESTED', sent: 0, failed: 0, results: [] };
  const emails = await emailsForUserIds(admin, [lmId]);
  const projectName = row.projects?.name ?? 'a project';
  const amountNaira = Math.round(Number(row.amount_minor ?? 0) / 100);
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Drawdown request',
    heading: 'New drawdown request needs review',
    bodyLines: [
      `${row.requester?.full_name ?? 'Project owner'} · ${projectName}`,
      `${row.reference ?? ''} · ₦${amountNaira.toLocaleString('en-NG')} · ${row.category ?? 'FUND_USE'}`,
      row.purpose ? `Purpose: ${row.purpose}` : '',
    ].filter(Boolean),
    ctaLabel: 'Review drawdown',
    ctaUrl: `${appUrl}/projects/${row.project_id}?tab=drawdowns`,
    footerNote: 'You are receiving this because you manage this project on Prism Capital.',
    subject: `Drawdown request · ${projectName} · Prism Capital`,
  });
  return { type: 'DRAWDOWN_REQUESTED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleDrawdownDecided(admin: any, drawdownId: string, appUrl: string) {
  const { data: row, error } = await admin
    .from('fund_drawdowns')
    .select(
      'id, project_id, status, reference, decision_note, amount_minor, requested_by, projects:project_id(name)',
    )
    .eq('id', drawdownId)
    .single();
  if (error || !row?.requested_by) {
    throw new HttpError(404, `fund_drawdown not found: ${error?.message ?? drawdownId}`);
  }
  const emails = await emailsForUserIds(admin, [row.requested_by]);
  const approved = row.status === 'APPROVED';
  const projectName = row.projects?.name ?? 'a project';
  const amountNaira = Math.round(Number(row.amount_minor ?? 0) / 100);
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Drawdown decision',
    heading: approved ? 'Your drawdown was approved' : 'Your drawdown was declined',
    bodyLines: [
      `${projectName} · ${row.reference ?? ''} · ₦${amountNaira.toLocaleString('en-NG')}`,
      row.decision_note ? `Note: ${row.decision_note}` : '',
    ].filter(Boolean),
    ctaLabel: 'Open project',
    ctaUrl: `${appUrl}/projects/${row.project_id}?tab=drawdowns`,
    footerNote: 'You are receiving this because you requested this drawdown on Prism Capital.',
    subject: `Drawdown ${approved ? 'approved' : 'declined'} · ${projectName} · Prism Capital`,
  });
  return { type: 'DRAWDOWN_DECIDED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleWithdrawalRequested(admin: any, withdrawalId: string, appUrl: string) {
  const { data: row, error } = await admin
    .from('withdrawal_requests')
    .select(
      'id, project_id, amount_minor, reference, kind, projects:project_id(name, created_by), investor:investor_id(full_name)',
    )
    .eq('id', withdrawalId)
    .single();
  if (error || !row) {
    throw new HttpError(404, `withdrawal_request not found: ${error?.message ?? withdrawalId}`);
  }
  const lmId = row.projects?.created_by;
  if (!lmId) return { type: 'WITHDRAWAL_REQUESTED', sent: 0, failed: 0, results: [] };
  const emails = await emailsForUserIds(admin, [lmId]);
  const projectName = row.projects?.name ?? 'a project';
  const amountNaira = Math.round(Number(row.amount_minor ?? 0) / 100);
  const isOwner = row.kind === 'OWNER';
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Withdrawal request',
    heading: isOwner
      ? 'Project owner requested a manager-share withdrawal'
      : 'Investor requested a profit withdrawal',
    bodyLines: [
      `${row.investor?.full_name ?? (isOwner ? 'Project owner' : 'Investor')} · ${projectName}`,
      `${row.reference ?? ''} · ₦${amountNaira.toLocaleString('en-NG')}`,
    ],
    ctaLabel: 'Review withdrawal',
    ctaUrl: `${appUrl}/projects/${row.project_id}?tab=withdrawals`,
    footerNote: 'You are receiving this because you manage this project on Prism Capital.',
    subject: `Withdrawal request · ${projectName} · Prism Capital`,
  });
  return { type: 'WITHDRAWAL_REQUESTED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// deno-lint-ignore no-explicit-any
async function handleWithdrawalDecided(admin: any, withdrawalId: string, appUrl: string) {
  const { data: row, error } = await admin
    .from('withdrawal_requests')
    .select(
      'id, project_id, status, reference, decision_note, amount_minor, investor_id, projects:project_id(name)',
    )
    .eq('id', withdrawalId)
    .single();
  if (error || !row?.investor_id) {
    throw new HttpError(404, `withdrawal_request not found: ${error?.message ?? withdrawalId}`);
  }
  const emails = await emailsForUserIds(admin, [row.investor_id]);
  const approved = row.status === 'APPROVED';
  const projectName = row.projects?.name ?? 'a project';
  const amountNaira = Math.round(Number(row.amount_minor ?? 0) / 100);
  const { subject, html, text } = renderGenericNotifyEmail({
    kicker: 'Withdrawal decision',
    heading: approved ? 'Your withdrawal was approved' : 'Your withdrawal was declined',
    bodyLines: [
      `${projectName} · ${row.reference ?? ''} · ₦${amountNaira.toLocaleString('en-NG')}`,
      row.decision_note ? `Note: ${row.decision_note}` : '',
    ].filter(Boolean),
    ctaLabel: 'View statements',
    ctaUrl: `${appUrl}/statements`,
    footerNote: 'You are receiving this because you requested this withdrawal on Prism Capital.',
    subject: `Withdrawal ${approved ? 'approved' : 'declined'} · ${projectName} · Prism Capital`,
  });
  return { type: 'WITHDRAWAL_DECIDED', ...(await sendToRecipients(emails, subject, html, text)) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function emailsForUserIds(admin: any, userIds: string[]): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: profiles } = await admin.from('profiles').select('id, email').in('id', ids);
  return (profiles ?? [])
    // deno-lint-ignore no-explicit-any
    .map((p: any) => p.email)
    .filter(Boolean)
    .map((e: string) => e.toLowerCase());
}

// deno-lint-ignore no-explicit-any
async function listRoleEmails(admin: any, roles: string[]): Promise<string[]> {
  const { data, error } = await admin.from('profiles').select('email').in('role', roles);
  if (error) throw new HttpError(500, error.message);
  const emails = new Set<string>();
  for (const row of data ?? []) {
    if (row.email) emails.add(String(row.email).toLowerCase());
  }
  return [...emails];
}

// deno-lint-ignore no-explicit-any
async function listConfirmedInvestorEmails(admin: any, projectId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('invites')
    .select('email, profiles:investor_id(email)')
    .eq('project_id', projectId)
    .eq('status', 'CONFIRMED');
  if (error) throw new HttpError(500, error.message);
  const emails = new Set<string>();
  for (const row of data ?? []) {
    // deno-lint-ignore no-explicit-any
    const r: any = row;
    const email: string | null = r.profiles?.email ?? r.email ?? null;
    if (email) emails.add(email.toLowerCase());
  }
  return [...emails];
}

async function sendToRecipients(
  emails: string[],
  subject: string,
  html: string,
  text: string,
) {
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const email of emails) {
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      results.push({ email, ok: true });
    } catch (err) {
      results.push({
        email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

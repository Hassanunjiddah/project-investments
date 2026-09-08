/**
 * Live E2E against the linked Supabase project.
 * Usage: E2E_PASSWORD='…' node scripts/e2e-live.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PASS = process.env.E2E_PASSWORD;
if (!PASS) {
  console.error('Set E2E_PASSWORD to the shared test-account password, then re-run.');
  process.exit(2);
}

const ACCOUNTS = {
  lm: 'linemanager@ribhshare.com',
  ceo: 'ceo@ribhshare.com',
  investor: 'investor@ribhshare.com',
};

function client() {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fail(step, err) {
  const msg =
    err?.message ||
    err?.error_description ||
    (typeof err === 'string' ? err : JSON.stringify(err));
  throw new Error(`${step}: ${msg}`);
}

async function signIn(email) {
  const sb = client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: PASS });
  if (error) fail(`sign-in ${email}`, error);
  if (!data.session) fail(`sign-in ${email}`, 'no session');
  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('id', data.user.id)
    .single();
  if (pErr) fail(`profile ${email}`, pErr);
  return { sb, user: data.user, profile };
}

async function invoke(sb, name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    let extra = error.message;
    try {
      extra = await error.context?.text?.();
    } catch {
      /* ignore */
    }
    fail(`fn ${name}`, extra || error);
  }
  if (data?.error) fail(`fn ${name}`, data.error);
  return data;
}

const results = [];
function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

let projectId;

try {
  console.log('=== Prism live E2E ===\n');

  const lm = await signIn(ACCOUNTS.lm);
  pass('LM sign-in', lm.profile.role);
  const ceo = await signIn(ACCOUNTS.ceo);
  pass('CEO sign-in', ceo.profile.role);
  const inv = await signIn(ACCOUNTS.investor);
  pass('Investor sign-in', inv.profile.role);

  const { data: leftovers, error: leftErr } = await ceo.sb.from('projects').select('id, code');
  if (leftErr) fail('list leftovers', leftErr);
  for (const row of leftovers ?? []) {
    await ceo.sb.from('audit_events').delete().eq('project_id', row.id);
    const { error: wipeErr } = await ceo.sb.from('projects').delete().eq('id', row.id);
    if (wipeErr) {
      console.log(`WARN  leftover ${row.code} left in place (${wipeErr.message})`);
    }
  }
  if (leftovers?.length) pass('Checked leftover projects', `${leftovers.length} row(s)`);

  const { count: projectCount, error: countErr } = await lm.sb
    .from('projects')
    .select('id', { count: 'exact', head: true });
  if (countErr) fail('empty projects', countErr);
  pass('Projects before create', `${projectCount ?? 0} row(s)`);

  const created = await invoke(lm.sb, 'create-project', {
    name: `E2E Rice Aggregation ${Date.now()}`,
    sector: 'Agriculture',
    location: 'Kano',
    targetMinor: 10_000_000_00,
    durationValue: 6,
    durationUnit: 'MONTHS',
    summary: 'End-to-end verification project for cost lines and additional capital.',
    fullDetails:
      'This project exists only to verify create, approve, invite, cost-line, and raise flows.',
    risks: 'Test-only project; capital is not real.',
    timeline: 'Six months from approval.',
    payAccount: {
      bankName: 'Access Bank',
      accountName: 'Prism E2E',
      accountNumber: '0123456789',
    },
    estimatedRoiBps: 1800,
    isPublic: false,
    profitSplitInvestorBps: 7000,
    totalUnits: 10,
    minUnitsPerInvestor: 1,
    raiseFeeBps: 250,
    platformFeeBps: 750,
    profitDeclarationFrequency: 'MONTHLY',
  });
  projectId = created.projectId;
  pass('LM create-project', `${created.code} ${created.approvalStatus}`);

  const briefPath = `${projectId}/${randomUUID()}/brief.txt`;
  const brief = new TextEncoder().encode('E2E project brief — overview for CEO review.');
  const { error: upErr } = await lm.sb.storage
    .from('project-documents')
    .upload(briefPath, brief, { contentType: 'text/plain', upsert: false });
  if (upErr) fail('upload brief', upErr);
  const { error: docErr } = await lm.sb.from('project_docs').insert({
    project_id: projectId,
    kind: 'OVERVIEW',
    title: 'E2E brief',
    file_name: 'brief.txt',
    storage_path: briefPath,
    mime_type: 'text/plain',
    file_size_bytes: brief.byteLength,
    uploaded_by: lm.user.id,
  });
  if (docErr) fail('insert project_docs', docErr);
  pass('Upload OVERVIEW brief');

  const submitted = await invoke(lm.sb, 'submit-project', { projectId });
  pass('LM submit-project', submitted.approvalStatus);

  const approved = await invoke(ceo.sb, 'approve-project', {
    projectId,
    approvalStatus: 'APPROVED',
  });
  pass('CEO approve-project', approved.project?.approval_status ?? approved.approvalStatus);

  const { data: line, error: lineErr } = await lm.sb
    .from('project_cost_lines')
    .insert({
      project_id: projectId,
      occurred_on: '2026-09-08',
      description: 'Warehouse lease',
      class: 'OPEX',
      nature: 'ONE_TIME',
      quantity: 1,
      unit_cost_minor: 250_000_00,
      annual_frequency: 1,
      created_by: lm.user.id,
    })
    .select('id, total_minor, description')
    .single();
  if (lineErr) fail('create cost line', lineErr);
  const costLineId = line.id;
  pass('LM add cost line', `${line.description} total=${line.total_minor}`);

  const receiptPath = `${projectId}/costlines/${randomUUID()}/receipt.txt`;
  const receipt = new TextEncoder().encode('E2E receipt for warehouse lease.');
  const { error: recUp } = await lm.sb.storage
    .from('project-documents')
    .upload(receiptPath, receipt, { contentType: 'text/plain' });
  if (recUp) fail('upload cost-line receipt', recUp);
  const { error: recPatch } = await lm.sb
    .from('project_cost_lines')
    .update({
      doc_storage_path: receiptPath,
      doc_file_name: 'receipt.txt',
      doc_mime_type: 'text/plain',
    })
    .eq('id', costLineId);
  if (recPatch) fail('attach cost-line receipt', recPatch);
  pass('Attach cost-line document');

  const { data: round, error: roundErr } = await lm.sb.rpc('request_funding_round', {
    p_project_id: projectId,
    p_additional_units: 5,
    p_reason: 'Working capital exhausted after warehouse lease.',
    p_cost_line_ids: [costLineId],
  });
  if (roundErr) fail('request_funding_round', roundErr);
  const roundId = round.id;
  pass(
    'LM request additional units',
    `${round.additional_units} units @ ${round.unit_price_minor} status=${round.status}`,
  );

  const { data: pending, error: pendErr } = await ceo.sb.rpc('list_pending_funding_rounds');
  if (pendErr) fail('list_pending_funding_rounds', pendErr);
  if (!pending?.some((r) => r.id === roundId)) fail('list pending rounds', 'round not visible to CEO');
  pass('CEO sees pending raise', `${pending.length} pending`);

  const { data: decided, error: decErr } = await ceo.sb.rpc('decide_funding_round', {
    p_round_id: roundId,
    p_status: 'APPROVED',
    p_note: 'E2E approve',
  });
  if (decErr) fail('decide_funding_round', decErr);
  pass('CEO approve raise', decided.status);

  const { data: bumped, error: bumpErr } = await lm.sb
    .from('projects')
    .select('total_units, target_minor')
    .eq('id', projectId)
    .single();
  if (bumpErr) fail('read bumped target', bumpErr);
  if (bumped.total_units !== 15) fail('unit bump', `expected 15 got ${bumped.total_units}`);
  if (bumped.target_minor !== 15_000_000_00) {
    fail('target bump', `expected 1500000000 got ${bumped.target_minor}`);
  }
  pass('Target/units updated', `${bumped.total_units} units / ${bumped.target_minor} kobo`);

  const invited = await invoke(lm.sb, 'send-invitation', {
    projectId,
    email: ACCOUNTS.investor,
    roundId,
  });
  const inviteId = invited.invite.id;
  pass(
    'LM invite investor into raise',
    `status=${invited.invite.status} emailSent=${invited.emailSent}`,
  );

  const { error: accErr } = await inv.sb.rpc('accept_invite', { p_invite_id: inviteId });
  if (accErr) fail('accept_invite', accErr);
  pass('Investor accept invite');

  const { data: pledged, error: pledgErr } = await inv.sb.rpc('pledge_units', {
    p_invite_id: inviteId,
    p_units: 1,
  });
  if (pledgErr) fail('pledge_units', pledgErr);
  pass(
    'Investor pledge 1 unit',
    `status=${pledged.status} units=${pledged.units_pledged ?? pledged.units_allotted}`,
  );

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('inviteId', inviteId);
  form.append('file', new Blob([png], { type: 'image/png' }), 'proof.png');
  const { data: sessionData } = await inv.sb.auth.getSession();
  const proofRes = await fetch(`${URL}/functions/v1/submit-payment-proof`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: ANON,
    },
    body: form,
  });
  const proofJson = await proofRes.json();
  if (!proofRes.ok) fail('submit-payment-proof', proofJson.error || proofJson);
  pass('Investor submit payment proof', proofJson.invite?.status);

  const confirmed = await invoke(lm.sb, 'confirm-invite-payment', { inviteId });
  pass('LM confirm payment', confirmed.invite?.status);

  const { data: invLines, error: invLineErr } = await inv.sb
    .from('project_cost_lines')
    .select('id, description')
    .eq('project_id', projectId);
  if (invLineErr) fail('investor read cost lines', invLineErr);
  if (!invLines?.some((l) => l.id === costLineId)) {
    fail('investor read cost lines', 'confirmed investor cannot see cost line');
  }
  pass('Investor can read cost lines', `${invLines.length} line(s)`);

  const { error: delErr } = await lm.sb.from('projects').delete().eq('id', projectId);
  if (delErr) {
    const { error: ceoDel } = await ceo.sb.from('projects').delete().eq('id', projectId);
    if (ceoDel) fail('cleanup delete project', ceoDel);
  }
  projectId = null;
  pass('Cleanup delete E2E project');

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed.`);
  process.exit(0);
} catch (e) {
  console.error(`\nFAIL  ${e.message}`);
  if (projectId) {
    try {
      const ceo = await signIn(ACCOUNTS.ceo);
      await ceo.sb.from('projects').delete().eq('id', projectId);
      console.error('Cleaned up leftover project', projectId);
    } catch (cleanErr) {
      console.error('Cleanup failed:', cleanErr.message);
    }
  }
  process.exit(1);
}

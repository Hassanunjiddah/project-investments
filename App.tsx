import React, { useMemo, useState } from 'react';
// ---------- helpers ----------
const naira = (kobo) =>
  '₦' + (kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const bps = (b) => (b / 100).toFixed(0) + '%';
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const STAGES = ['INITIATION', 'ACCEPTANCE', 'PROGRESS', 'END'];
const STAGE_LABEL = {
  INITIATION: 'Initiation',
  ACCEPTANCE: 'Acceptance',
  PROGRESS: 'Progress',
  END: 'End',
};
const DOC_KINDS = [
  { v: 'OVERVIEW', label: 'Project overview' },
  { v: 'FUND_USE', label: 'Fund use' },
  { v: 'RISK', label: 'Risk / mitigation' },
  { v: 'DECISION', label: 'Key decision' },
];
// ---------- seed data ----------
const USERS = {
  u_ceo: { id: 'u_ceo', name: 'Aisha (CEO)', role: 'CEO' },
  u_admin: { id: 'u_admin', name: 'Bilal (Admin)', role: 'ADMIN' },
  u_lm1: { id: 'u_lm1', name: 'Khadija (Line Manager)', role: 'LINE_MANAGER' },
  u_lm2: { id: 'u_lm2', name: 'Yusuf (Line Manager)', role: 'LINE_MANAGER' },
  u_inv1: { id: 'u_inv1', name: 'Ibrahim (Investor)', role: 'INVESTOR' },
  u_inv2: { id: 'u_inv2', name: 'Fatima (Investor)', role: 'INVESTOR' },
};
// An invite carries a teaser (need / risks / projected profit) but NOT full details until accepted.
// status: INVITED -> ACCEPTED -> COMMITTED -> PROOF_SUBMITTED -> CONFIRMED  (or DECLINED)
const seedProjects = () => [
  {
    id: 'PRJ-104',
    name: 'Kano Solar Cold-Chain',
    sector: 'Agri / Energy',
    location: 'Kano',
    createdBy: 'u_lm1',
    stage: 'PROGRESS',
    approval: 'APPROVED',
    targetKobo: 250000000,
    raisedKobo: 90000000,
    investorShareBps: 7000,
    managerShareBps: 3000,
    expectedProfitKobo: 50000000,
    noticeDays: 90,
    penaltyBps: 500,
    summary:
      'Solar-powered cold storage for perishable produce, reducing post-harvest loss for smallholder farmers.',
    fullDetails:
      'Two 40ft solar cold rooms in Kano with offtake agreements from three produce cooperatives. Mudarabah structure: investors provide capital (rabb-al-mal), the manager operates (mudarib). Returns are paid only from realised profit; capital is at risk. Audited quarterly.',
    risks:
      'Equipment downtime, diesel backup cost, seasonal demand swings, FX on imported parts. Mitigation: maintenance contract, dual cooperatives, parts buffer stock.',
    timeline:
      'Initiation Q1 - Acceptance Q1 - Progress Q2-Q4 - End Q1 next year',
    payAccount: {
      bankName: 'Wema Bank',
      accountName: 'RibhShare / PRJ-104 Escrow',
      accountNumber: '0123456104',
    },
    invited: [
      {
        invId: 'iv1',
        userId: 'u_inv1',
        proposedKobo: 30000000,
        status: 'CONFIRMED',
        proofName: 'transfer-receipt.pdf',
        confirmedBy: 'u_lm1',
      },
    ],
    docs: [
      {
        id: 'd1',
        kind: 'OVERVIEW',
        title: 'Project overview pack',
        fileName: 'PRJ-104-overview.pdf',
        date: '2026-01-10',
        note: 'Need, risk and profit-share summary.',
      },
      {
        id: 'd2',
        kind: 'FUND_USE',
        title: 'Cold room 1 procurement',
        amountKobo: 42000000,
        fileName: 'invoice-coldroom-1.pdf',
        date: '2026-02-02',
        note: 'Supplier invoice + delivery note.',
      },
    ],
    messages: [
      {
        id: 'm1',
        authorId: 'u_lm1',
        body: 'Cold room 1 commissioned, running at target temperature.',
        date: '2026-02-05',
      },
    ],
  },
  {
    id: 'PRJ-118',
    name: 'Lagos Last-Mile Logistics',
    sector: 'Logistics',
    location: 'Lagos',
    createdBy: 'u_lm2',
    stage: 'ACCEPTANCE',
    approval: 'PENDING',
    targetKobo: 400000000,
    raisedKobo: 0,
    realisedProfitKobo: 0,
    investorShareBps: 7000,
    managerShareBps: 3000,
    expectedProfitKobo: 80000000,
    noticeDays: 90,
    penaltyBps: 500,
    summary:
      'Electric tricycle fleet for last-mile delivery across Lagos mainland.',
    fullDetails:
      'Fleet of 40 electric tricycles with swappable batteries and three charging hubs. Revenue from per-delivery fees under contracts with two e-commerce platforms. Mudarabah: profit shared 70/30, losses borne by capital providers per their share.',
    risks:
      'Battery degradation, charging-hub uptime, platform contract renewal risk. Mitigation: battery warranty, redundant hubs, staggered contracts.',
    timeline:
      'Initiation now - Acceptance pending CEO - Progress on approval - End +12 months',
    payAccount: {
      bankName: 'Wema Bank',
      accountName: 'RibhShare / PRJ-118 Escrow',
      accountNumber: '0123456118',
    },
    invited: [
      {
        invId: 'iv2',
        userId: 'u_inv2',
        proposedKobo: 50000000,
        status: 'INVITED',
        proofName: null,
        confirmedBy: null,
      },
    ],
    docs: [
      {
        id: 'd3',
        kind: 'OVERVIEW',
        title: 'Overview pack',
        fileName: 'PRJ-118-overview.pdf',
        date: '2026-03-01',
        note: 'Teaser: need, risk, profit share.',
      },
    ],
    messages: [],
  },
  {
    id: 'PRJ-121',
    name: 'Abuja Modular Housing',
    sector: 'Real Estate',
    location: 'Abuja',
    createdBy: 'u_lm1',
    stage: 'INITIATION',
    approval: 'APPROVED',
    targetKobo: 600000000,
    raisedKobo: 0,
    realisedProfitKobo: 0,
    investorShareBps: 7000,
    managerShareBps: 3000,
    expectedProfitKobo: 120000000,
    noticeDays: 90,
    penaltyBps: 500,
    summary:
      'Modular affordable housing units built off-site for faster delivery.',
    fullDetails:
      'Twelve 2-bedroom modular units on serviced land in Abuja, pre-sold off-plan. Profit on completion and sale; Mudarabah 70/30.',
    risks:
      'Construction delay, material price inflation, off-plan buyer default. Mitigation: fixed-price supplier, milestone draws, buyer deposits.',
    timeline:
      'Initiation now - Acceptance next - Progress build phase - End on sale',
    payAccount: {
      bankName: 'Wema Bank',
      accountName: 'RibhShare / PRJ-121 Escrow',
      accountNumber: '0123456121',
    },
    invited: [],
    docs: [],
    messages: [],
  },
];
// ---------- ui primitives ----------
const C = {
  bg: '#f4f8fb',
  panel: '#ffffff',
  panel2: '#eef4fb',
  line: '#d6e3f0',
  text: '#13233b',
  sub: '#5d7591',
  accent: '#0ea5e9',
  good: '#16c784',
  warn: '#f59e0b',
  bad: '#f43f5e',
  chip: '#e3f2fd',
  gold: '#f5a623',
};
const Card = ({ children, style }) => (
  <div
    style={{
      background: C.panel,
      border: '1px solid ' + C.line,
      borderRadius: 14,
      padding: 18,
      ...style,
    }}
  >
    {children}
  </div>
);
const Label = ({ children }) => (
  <div
    style={{
      color: C.sub,
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);
const Stat = ({ label, value, sub }) => (
  <div style={{ flex: 1, minWidth: 140 }}>
    <Label>{label}</Label>
    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    {sub && (
      <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>{sub}</div>
    )}
  </div>
);
const Pill = ({ children, tone }) => {
  const map = { good: C.good, warn: C.warn, bad: C.bad, accent: C.accent };
  const col = map[tone] || C.sub;
  return (
    <span
      style={{
        background: col + '22',
        color: col,
        border: '1px solid ' + col + '55',
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
};
const Brand = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        background: 'linear-gradient(135deg,' + C.accent + ',' + C.gold + ')',
      }}
    />
    <div style={{ fontWeight: 800, fontSize: 18 }}>
      RibhShare{' '}
      <span style={{ color: C.sub, fontWeight: 500 }}>· Projects</span>
    </div>
  </div>
);
const Row = ({ children, style }) => (
  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...style }}>
    {children}
  </div>
);
const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginBottom: 10 }}>
    <div style={{ color: C.sub, fontSize: 12, marginBottom: 5 }}>{label}</div>
    {children}
  </label>
);
const inputStyle = {
  width: '100%',
  background: C.panel2,
  color: C.text,
  border: '1px solid ' + C.line,
  borderRadius: 9,
  padding: '10px 12px',
  fontSize: 14,
  boxSizing: 'border-box',
};
const btn = (tone) => ({
  background:
    tone === 'ghost' ? 'transparent' : tone === 'bad' ? C.bad : C.accent,
  color: tone === 'ghost' ? C.text : '#fff',
  border: tone === 'ghost' ? '1px solid ' + C.line : 'none',
  borderRadius: 9,
  padding: '9px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
});
const StageBadge = ({ stage }) => {
  const tone =
    stage === 'END' ? 'good' : stage === 'PROGRESS' ? 'accent' : 'warn';
  return <Pill tone={tone}>{STAGE_LABEL[stage]}</Pill>;
};
const ApprovalBadge = ({ approval }) => (
  <Pill
    tone={
      approval === 'APPROVED' ? 'good' : approval === 'PENDING' ? 'warn' : 'bad'
    }
  >
    {approval}
  </Pill>
);
const ProgressBar = ({ pct }) => (
  <div
    style={{
      height: 8,
      background: C.panel2,
      borderRadius: 999,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        width: Math.min(100, pct) + '%',
        height: '100%',
        background: C.accent,
      }}
    />
  </div>
);
// ---------- role picker / shell ----------
const RolePicker = ({ onPick }) => (
  <div
    style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}
  >
    <Card style={{ maxWidth: 760, width: '100%' }}>
      <Brand />
      <h2 style={{ margin: '16px 0 4px' }}>Sign in to your workspace</h2>
      <div style={{ color: C.sub, marginBottom: 18 }}>
        Choose your role. Access is fixed per role — there is no self sign-up.
      </div>
      <Row>
        {Object.values(USERS).map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u)}
            style={{
              ...btn('ghost'),
              flex: '1 1 220px',
              textAlign: 'left',
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700 }}>{u.name}</div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>
              {u.role.replace('_', ' ')}
            </div>
          </button>
        ))}
      </Row>
    </Card>
  </div>
);
const NavItem = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...btn('ghost'),
      border: 'none',
      background: active ? C.chip : 'transparent',
      color: active ? C.text : C.sub,
      width: '100%',
      textAlign: 'left',
      marginBottom: 4,
    }}
  >
    {children}
  </button>
);
const Shell = ({ me, nav, onNav, onSignOut, children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      display: 'grid',
      gridTemplateColumns: '230px 1fr',
    }}
  >
    <aside
      style={{
        background: C.panel2,
        borderRight: '1px solid ' + C.line,
        padding: 16,
      }}
    >
      <Brand />
      <div style={{ margin: '18px 0 10px', color: C.sub, fontSize: 12 }}>
        {me.name}
      </div>
      {nav.map((n) => (
        <NavItem
          key={n.key}
          active={n.key === nav.active}
          onClick={() => onNav(n.key)}
        >
          {n.label}
        </NavItem>
      ))}
      <div style={{ marginTop: 18 }}>
        <button onClick={onSignOut} style={btn('ghost')}>
          Sign out
        </button>
      </div>
    </aside>
    <main style={{ padding: 26, overflow: 'auto' }}>{children}</main>
  </div>
);
const PageHead = ({ title, sub, right }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 18,
      gap: 12,
      flexWrap: 'wrap',
    }}
  >
    <div>
      <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
      {sub && <div style={{ color: C.sub, marginTop: 4 }}>{sub}</div>}
    </div>
    {right}
  </div>
);
// ---------- documentation (document-upload based) ----------
const kindLabel = (v) =>
  (DOC_KINDS.find((k) => k.v === v) || { label: v }).label;
const DocList = ({ docs }) => {
  if (!docs.length)
    return <div style={{ color: C.sub }}>No documents uploaded yet.</div>;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {docs.map((d) => (
        <div
          key={d.id}
          style={{
            border: '1px solid ' + C.line,
            borderRadius: 10,
            padding: 12,
            background: C.panel2,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontWeight: 700 }}>{d.title}</div>
            <Pill
              tone={
                d.kind === 'RISK'
                  ? 'warn'
                  : d.kind === 'OVERVIEW'
                  ? 'accent'
                  : 'good'
              }
            >
              {kindLabel(d.kind)}
            </Pill>
          </div>
          {typeof d.amountKobo === 'number' && (
            <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
              Amount: {naira(d.amountKobo)}
            </div>
          )}
          {d.note && (
            <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
              {d.note}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <span
              style={{
                background: C.chip,
                padding: '3px 9px',
                borderRadius: 7,
                fontSize: 12,
              }}
            >
              📎 {d.fileName || 'document.pdf'}
            </span>
            <span style={{ color: C.sub, fontSize: 12 }}>{d.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
// Tick a kind, add a short description, and UPLOAD a document. No free-form typing of the content itself.
const AddDocForm = ({ onAdd }) => {
  const [kind, setKind] = useState('FUND_USE');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState('');
  const needsAmount = kind === 'FUND_USE';
  const ready = title.trim() && fileName && (!needsAmount || amount);
  const submit = () => {
    onAdd({
      kind,
      title: title.trim(),
      amountKobo: needsAmount
        ? Math.round(parseFloat(amount || '0') * 100)
        : undefined,
      note: note.trim(),
      fileName,
    });
    setTitle('');
    setAmount('');
    setNote('');
    setFileName('');
  };
  return (
    <Card style={{ background: C.panel2, marginTop: 12 }}>
      <Label>Upload a document</Label>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          margin: '10px 0 12px',
        }}
      >
        {DOC_KINDS.map((k) => (
          <button
            key={k.v}
            onClick={() => setKind(k.v)}
            style={{
              ...btn(kind === k.v ? 'accent' : 'ghost'),
              padding: '7px 12px',
            }}
          >
            <span style={{ marginRight: 6 }}>{kind === k.v ? '☑' : '☐'}</span>
            {k.label}
          </button>
        ))}
      </div>
      <Field label="Title">
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Supplier invoice — cold room 1"
        />
      </Field>
      {needsAmount && (
        <Field label="Amount (₦)">
          <input
            style={inputStyle}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>
      )}
      <Field label="Short description (optional)">
        <input
          style={inputStyle}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What this document shows"
        />
      </Field>
      <Field label="Document file">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ ...btn('ghost'), cursor: 'pointer' }}>
            Choose file
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) =>
                setFileName(
                  (e.target.files &&
                    e.target.files[0] &&
                    e.target.files[0].name) ||
                    'document.pdf'
                )
              }
            />
          </label>
          <span style={{ color: C.sub, fontSize: 13 }}>
            {fileName || 'No file chosen'}
          </span>
        </div>
      </Field>
      <button
        disabled={!ready}
        onClick={submit}
        style={{ ...btn('accent'), opacity: ready ? 1 : 0.5, marginTop: 6 }}
      >
        Upload document
      </button>
    </Card>
  );
};
const Engagement = ({ messages, canPost, onPost }) => {
  const [body, setBody] = useState('');
  return (
    <div>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ color: C.sub }}>No messages yet.</div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              border: '1px solid ' + C.line,
              borderRadius: 10,
              padding: 10,
              background: C.panel2,
            }}
          >
            <div style={{ fontSize: 12, color: C.sub }}>
              {(USERS[m.authorId] || {}).name} · {m.date}
            </div>
            <div style={{ marginTop: 4 }}>{m.body}</div>
          </div>
        ))}
      </div>
      {canPost && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message"
          />
          <button
            onClick={() => {
              if (body.trim()) {
                onPost(body.trim());
                setBody('');
              }
            }}
            style={btn('accent')}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
};
// ---------- profit projection ----------
// An investor's projected profit = (their capital / target) * realisedProfit * investorShareBps.
const projectedProfitKobo = (project, investKobo) => {
if (!project.targetKobo) return 0;
const effectiveProfit = project.realisedProfitKobo || project.expectedProfitKobo || Math.round(project.targetKobo * 0.2);
const share = investKobo / project.targetKobo;
  return Math.round(
        effectiveProfit * share * (project.investorShareBps / 10000)
  );
};
const ProjectCard = ({ p, onOpen }) => {
  const pct = p.targetKobo
    ? Math.round((p.raisedKobo / p.targetKobo) * 100)
    : 0;
  return (
    <Card style={{ cursor: 'pointer' }}>
      <div onClick={() => onOpen(p.id)}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <StageBadge stage={p.stage} />
            <ApprovalBadge approval={p.approval} />
          </div>
        </div>
        <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
          {p.sector} · {p.location} · {p.id}
        </div>
        <div
          style={{
            marginTop: 12,
            marginBottom: 6,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
          }}
        >
          <span>{naira(p.raisedKobo)} raised</span>
          <span style={{ color: C.sub }}>of {naira(p.targetKobo)}</span>
        </div>
        <ProgressBar pct={pct} />
      </div>
    </Card>
  );
};
const ProjectList = ({ projects, onOpen }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
      gap: 14,
    }}
  >
    {projects.map((p) => (
      <ProjectCard key={p.id} p={p} onOpen={onOpen} />
    ))}
  </div>
);
// ---------- manager project detail ----------
const StatusPill = ({ status }) => {
  const map = {
    INVITED: 'warn',
    ACCEPTED: 'accent',
    COMMITTED: 'accent',
    PROOF_SUBMITTED: 'warn',
    CONFIRMED: 'good',
    DECLINED: 'bad',
  };
  return <Pill tone={map[status] || 'sub'}>{status.replace('_', ' ')}</Pill>;
};
const InvestorsTab = ({
  p,
  canManage,
  onConfirm,
  onInvite,
  onConfirmProfit,
}) => {
  const [email, setEmail] = useState('u_inv2');
  const [amt, setAmt] = useState('');
  const [profit, setProfit] = useState('');
  return (
    <div>
      {canManage && (
        <Card style={{ background: C.panel2, marginBottom: 14 }}>
          <Label>Invite an investor</Label>
          <div style={{ color: C.sub, fontSize: 13, margin: '6px 0 10px' }}>
            The invite sends a teaser only — amount needed, risks and projected
            profit. Full details unlock after they accept.
          </div>
          <Row>
            <Field label="Investor">
              <select
                style={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              >
                {Object.values(USERS)
                  .filter((u) => u.role === 'INVESTOR')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Amount we want them to invest (₦)">
              <input
                style={inputStyle}
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="0"
              />
            </Field>
          </Row>
          <button
            onClick={() => {
              if (amt) {
                onInvite(email, Math.round(parseFloat(amt) * 100));
                setAmt('');
              }
            }}
            style={btn('accent')}
          >
            Send invite + summary
          </button>
        </Card>
      )}
      {p.invited.length === 0 && (
        <div style={{ color: C.sub }}>No investors invited yet.</div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {p.invited.map((iv) => (
          <div
            key={iv.invId}
            style={{
              border: '1px solid ' + C.line,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {(USERS[iv.userId] || {}).name}
              </div>
              <StatusPill status={iv.status} />
            </div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
              Proposed: {naira(iv.proposedKobo)} · Projected profit{' '}
              {naira(projectedProfitKobo(p, iv.proposedKobo))}
            </div>
            {iv.proofName && (
              <div style={{ fontSize: 13, marginTop: 6 }}>
                📎 Proof: {iv.proofName}
              </div>
            )}
            {canManage && iv.status === 'PROOF_SUBMITTED' && (
              <button
                onClick={() => onConfirm(iv.invId)}
                style={{ ...btn('accent'), marginTop: 8 }}
              >
                Confirm payment received
              </button>
            )}
            {iv.status === 'CONFIRMED' && (
              <div style={{ color: C.good, fontSize: 13, marginTop: 6 }}>
                ✓ Payment confirmed — capital recorded
              </div>
            )}
          </div>
        ))}
      </div>
      {canManage && p.invited.some((iv) => iv.status === 'CONFIRMED') && (
        <Card
          style={{
            background: C.panel2,
            marginTop: 14,
            borderColor: C.gold + '66',
          }}
        >
          <Label>Realise & distribute profit (Mudarabah)</Label>
          <div style={{ color: C.sub, fontSize: 13, margin: '6px 0 10px' }}>
            Confirming realised profit auto-distributes{' '}
            {bps(p.investorShareBps)} to investors (pro-rata) and{' '}
            {bps(p.managerShareBps)} to the manager.
          </div>
          {!p.profitConfirmed ? (
            <Row>
              <Field label="Realised profit (₦)">
                <input
                  style={inputStyle}
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </Row>
          ) : (
            <div style={{ color: C.good, fontSize: 13, marginBottom: 10 }}>
              ✓ Profit realised: {naira(p.realisedProfitKobo)} — distributed to
              all parties.
            </div>
          )}
          {!p.profitConfirmed && (
            <button
              disabled={!profit}
              onClick={() => {
                if (profit) {
                  onConfirmProfit(Math.round(parseFloat(profit) * 100));
                  setProfit('');
                }
              }}
              style={{ ...btn('accent'), opacity: profit ? 1 : 0.5 }}
            >
              Confirm & distribute
            </button>
          )}
          {p.profitConfirmed && p.slips && (
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {p.slips.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    border: '1px solid ' + C.line,
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 13,
                  }}
                >
                  <span>
                    {s.party === 'MANAGER'
                      ? '👤 Manager (' +
                        ((USERS[s.userId] || {}).name || s.userId) +
                        ')'
                      : '💼 ' + ((USERS[s.userId] || {}).name || s.userId)}
                  </span>
                  <b style={{ color: s.party === 'MANAGER' ? C.gold : C.good }}>
                    {naira(s.profitKobo)}
                  </b>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
const ProjectDetail = ({
  p,
  me,
  onBack,
  onAddDoc,
  onPost,
  onConfirm,
  onInvite,
  onConfirmProfit,
}) => {
  const [tab, setTab] = useState('overview');
  const canManage =
    me.role === 'ADMIN' ||
    me.role === 'CEO' ||
    (me.role === 'LINE_MANAGER' && p.createdBy === me.id);
  const pct = p.targetKobo
    ? Math.round((p.raisedKobo / p.targetKobo) * 100)
    : 0;
  const tabs = [
    ['overview', 'Overview'],
    ['docs', 'Documentation'],
    ['engage', 'Engagement'],
    ['investors', 'Investors'],
  ];
  return (
    <div>
      <button onClick={onBack} style={{ ...btn('ghost'), marginBottom: 14 }}>
        ← Back
      </button>
      <PageHead
        title={p.name}
        sub={p.sector + ' · ' + p.location + ' · ' + p.id}
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            <StageBadge stage={p.stage} />
            <ApprovalBadge approval={p.approval} />
          </div>
        }
      />
      <Row style={{ marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <Stat label="Target" value={naira(p.targetKobo)} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat label="Raised" value={naira(p.raisedKobo)} sub={pct + '%'} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat
            label="Profit split"
            value={bps(p.investorShareBps) + ' / ' + bps(p.managerShareBps)}
            sub="investors / manager"
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat
            label="Exit notice"
            value={p.noticeDays + ' days'}
            sub={bps(p.penaltyBps) + ' penalty'}
          />
        </Card>
      </Row>
      <div
        style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}
      >
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={btn(tab === k ? 'accent' : 'ghost')}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <Card>
          <Label>Summary</Label>
          <div style={{ marginTop: 6 }}>{p.summary}</div>
          <Label>
            <div style={{ marginTop: 14 }}>Full details</div>
          </Label>
          <div style={{ marginTop: 6 }}>{p.fullDetails}</div>
          <Label>
            <div style={{ marginTop: 14 }}>Risks</div>
          </Label>
          <div style={{ marginTop: 6, color: C.sub }}>{p.risks}</div>
          <Label>
            <div style={{ marginTop: 14 }}>Timeline</div>
          </Label>
          <div style={{ marginTop: 6, color: C.sub }}>{p.timeline}</div>
        </Card>
      )}
      {tab === 'docs' && (
        <div>
          <DocList docs={p.docs} />
          {canManage && <AddDocForm onAdd={onAddDoc} />}
        </div>
      )}
      {tab === 'engage' && (
        <Card>
          <Engagement
            messages={p.messages}
            canPost={canManage}
            onPost={onPost}
          />
        </Card>
      )}
      {tab === 'investors' && (
        <InvestorsTab
          p={p}
          canManage={canManage}
          onConfirm={onConfirm}
          onInvite={onInvite}
          onConfirmProfit={onConfirmProfit}
        />
      )}
    </div>
  );
};
// ---------- CEO approvals ----------
const CeoApprovals = ({ projects, onDecide }) => {
  const pending = projects.filter((p) => p.approval === 'PENDING');
  return (
    <div>
      {pending.length === 0 && (
        <div style={{ color: C.sub }}>No projects awaiting approval.</div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {pending.map((p) => (
          <Card key={p.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: C.sub, fontSize: 13 }}>
                  {p.sector} · {p.location} · by{' '}
                  {(USERS[p.createdBy] || {}).name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onDecide(p.id, 'APPROVED')}
                  style={btn('accent')}
                >
                  Approve
                </button>
                <button
                  onClick={() => onDecide(p.id, 'REJECTED')}
                  style={btn('bad')}
                >
                  Reject
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10, color: C.sub }}>{p.summary}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};
// ---------- create project (Line Manager / Admin) ----------
const CreateProject = ({ me, onCreate }) => {
  const [f, setF] = useState({
    name: '',
    sector: '',
    location: '',
    target: '',
    summary: '',
    fullDetails: '',
    risks: '',
    timeline: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ready = f.name && f.target;
  return (
    <Card style={{ maxWidth: 720 }}>
      <Label>New project</Label>
      <div style={{ color: C.sub, fontSize: 13, margin: '6px 0 12px' }}>
        {me.role === 'LINE_MANAGER'
          ? 'Line Manager projects require CEO acceptance before going live.'
          : 'Admin projects open immediately.'}
      </div>
      <Row>
        <Field label="Name">
          <input style={inputStyle} value={f.name} onChange={set('name')} />
        </Field>
      </Row>
      <Row>
        <Field label="Sector">
          <input style={inputStyle} value={f.sector} onChange={set('sector')} />
        </Field>
        <Field label="Location">
          <input
            style={inputStyle}
            value={f.location}
            onChange={set('location')}
          />
        </Field>
      </Row>
      <Field label="Target capital (₦)">
        <input
          style={inputStyle}
          value={f.target}
          onChange={set('target')}
          placeholder="0"
        />
      </Field>
      <Field label="Summary (teaser)">
        <input style={inputStyle} value={f.summary} onChange={set('summary')} />
      </Field>
      <Field label="Full details (unlocked after accept)">
        <input
          style={inputStyle}
          value={f.fullDetails}
          onChange={set('fullDetails')}
        />
      </Field>
      <Field label="Risks">
        <input style={inputStyle} value={f.risks} onChange={set('risks')} />
      </Field>
      <Field label="Timeline">
        <input
          style={inputStyle}
          value={f.timeline}
          onChange={set('timeline')}
        />
      </Field>
      <button
        disabled={!ready}
        onClick={() => onCreate(f)}
        style={{ ...btn('accent'), opacity: ready ? 1 : 0.5 }}
      >
        Create project
      </button>
    </Card>
  );
};
// ---------- investor: terms modal ----------
const TermsModal = ({ p, onAccept, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: '#0008',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      zIndex: 50,
    }}
  >
    <Card style={{ maxWidth: 600, width: '100%' }}>
      <h3 style={{ marginTop: 0 }}>Terms & conditions — {p.name}</h3>
      <div
        style={{
          color: C.sub,
          fontSize: 14,
          lineHeight: 1.6,
          maxHeight: 280,
          overflow: 'auto',
        }}
      >
        <p>
          This is a Shariah (Mudarabah) profit-sharing arrangement. Returns are
          paid only from realised profit and are not guaranteed; your capital is
          at risk. There is no interest (riba).
        </p>
        <p>
          Profit is shared {bps(p.investorShareBps)} to investors and{' '}
          {bps(p.managerShareBps)} to the manager, pro-rata to capital
          contributed.
        </p>
        <p>
          To withdraw you must give {p.noticeDays} days notice and accept an
          early-exit penalty of {bps(p.penaltyBps)} on your principal.
        </p>
        <p>
          By accepting you may then view the full project details and the amount
          you may invest.
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 16,
          justifyContent: 'flex-end',
        }}
      >
        <button onClick={onClose} style={btn('ghost')}>
          Cancel
        </button>
        <button onClick={onAccept} style={btn('accent')}>
          I accept the terms
        </button>
      </div>
    </Card>
  </div>
);
// ---------- investor: a single invitation card with the full staged flow ----------
const InviteFlow = ({ p, iv, onAccept, onCommit, onProof }) => {
  const [showTerms, setShowTerms] = useState(false);
  const [amt, setAmt] = useState((iv.proposedKobo / 100).toString());
  const [committedKobo, setCommittedKobo] = useState(iv.proposedKobo);
  const projected = (kobo) => projectedProfitKobo(p, kobo);
  // Stage 1: INVITED — teaser only (need, risks, projected profit). No full details.
  if (iv.status === 'INVITED') {
    return (
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
          <Pill tone="warn">Invitation</Pill>
        </div>
        <div style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>
          {p.sector} · {p.location}
        </div>
        <div style={{ marginTop: 12 }}>{p.summary}</div>
        <Row style={{ marginTop: 14 }}>
          <Stat label="Capital needed" value={naira(p.targetKobo)} />
          <Stat label="You're invited for" value={naira(iv.proposedKobo)} />
          <Stat
            label="Projected profit"
            value={naira(projected(iv.proposedKobo))}
            sub={'at ' + bps(p.investorShareBps) + ' investor share'}
          />
        </Row>
        <Label>
          <div style={{ marginTop: 14 }}>Risks</div>
        </Label>
        <div style={{ color: C.sub, marginTop: 6 }}>{p.risks}</div>
        <div
          style={{
            background: C.chip,
            borderRadius: 9,
            padding: 10,
            marginTop: 14,
            color: C.sub,
            fontSize: 13,
          }}
        >
          🔒 Full project details unlock after you accept the terms.
        </div>
        <button
          onClick={() => setShowTerms(true)}
          style={{ ...btn('accent'), marginTop: 14 }}
        >
          Review terms & accept
        </button>
        {showTerms && (
          <TermsModal
            p={p}
            onClose={() => setShowTerms(false)}
            onAccept={() => {
              setShowTerms(false);
              onAccept(iv.invId);
            }}
          />
        )}
      </Card>
    );
  }
  // Stage 2: ACCEPTED — full overview + how much they can invest, then commit.
  if (iv.status === 'ACCEPTED') {
    const kobo = Math.round(parseFloat(amt || '0') * 100);
    return (
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
          <Pill tone="accent">Accepted</Pill>
        </div>
        <Label>
          <div style={{ marginTop: 12 }}>Full details</div>
        </Label>
        <div style={{ marginTop: 6 }}>{p.fullDetails}</div>
        <Label>
          <div style={{ marginTop: 12 }}>Risks</div>
        </Label>
        <div style={{ marginTop: 6, color: C.sub }}>{p.risks}</div>
        <Label>
          <div style={{ marginTop: 12 }}>Timeline</div>
        </Label>
        <div style={{ marginTop: 6, color: C.sub }}>{p.timeline}</div>
        <div
          style={{
            background: C.chip,
            borderRadius: 9,
            padding: 12,
            marginTop: 14,
          }}
        >
          <Label>Amount we'd like you to invest</Label>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {naira(iv.proposedKobo)}
          </div>
        </div>
        <Field label="Amount you will invest (₦)">
          <input
            style={inputStyle}
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
        </Field>
        <div style={{ color: C.sub, fontSize: 13, marginBottom: 12 }}>
          Projected profit on this amount:{' '}
          <b style={{ color: C.text }}>{naira(projected(kobo))}</b>
        </div>
        <button
          disabled={!kobo}
          onClick={() => onCommit(iv.invId, kobo)}
          style={{ ...btn('accent'), opacity: kobo ? 1 : 0.5 }}
        >
          Invest {naira(kobo)}
        </button>
      </Card>
    );
  }
  // Stage 3: COMMITTED — account number drops down to pay to, then attach proof.
  if (iv.status === 'COMMITTED') {
    return (
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
          <Pill tone="accent">Awaiting payment</Pill>
        </div>
        <div style={{ marginTop: 6, color: C.sub }}>
          Transfer {naira(iv.committedKobo || iv.proposedKobo)} to the account
          below, then attach your proof of payment.
        </div>
        <div
          style={{
            background: C.panel2,
            border: '1px solid ' + C.line,
            borderRadius: 10,
            padding: 14,
            marginTop: 12,
          }}
        >
          <Label>Pay to</Label>
          <Row style={{ marginTop: 8 }}>
            <Stat label="Bank" value={p.payAccount.bankName} />
            <Stat label="Account name" value={p.payAccount.accountName} />
            <Stat label="Account number" value={p.payAccount.accountNumber} />
          </Row>
        </div>
        <Field label="Proof of payment">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 6,
            }}
          >
            <label style={{ ...btn('ghost'), cursor: 'pointer' }}>
              Attach proof
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) =>
                  onProof(
                    iv.invId,
                    (e.target.files &&
                      e.target.files[0] &&
                      e.target.files[0].name) ||
                      'proof-of-payment.pdf'
                  )
                }
              />
            </label>
            <span style={{ color: C.sub, fontSize: 13 }}>
              PDF or image of your transfer receipt
            </span>
          </div>
        </Field>
      </Card>
    );
  }
  // Stage 4: PROOF_SUBMITTED — waiting for line manager confirmation.
  if (iv.status === 'PROOF_SUBMITTED') {
    return (
      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
          <Pill tone="warn">Verifying payment</Pill>
        </div>
        <div style={{ marginTop: 8, color: C.sub }}>
          📎 {iv.proofName} submitted. The line manager is confirming your
          payment.
        </div>
      </Card>
    );
  }
  return null;
};
// ---------- investor portfolio ----------
const Portfolio = ({ projects, meId, onWithdraw }) => {
  const holdings = [];
  projects.forEach((p) =>
    p.invited.forEach((iv) => {
      if (iv.userId === meId && iv.status === 'CONFIRMED') {
        const investedKobo = iv.committedKobo || iv.proposedKobo;
        holdings.push({ p, iv, investedKobo });
      }
    })
  );
  const totalInvested = holdings.reduce((s, h) => s + h.investedKobo, 0);
  const totalProjected = holdings.reduce(
    (s, h) => s + projectedProfitKobo(h.p, h.investedKobo),
    0
  );
  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <Card style={{ flex: 1 }}>
          <Stat label="Total invested" value={naira(totalInvested)} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat
            label="Projected return"
            value={naira(totalProjected)}
            sub="projected on your share"
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat label="Active holdings" value={holdings.length} />
        </Card>
      </Row>
      {holdings.length === 0 && (
        <div style={{ color: C.sub }}>Once a line manager confirms receipt of your payment, your confirmed investments will appear here automatically.</div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {holdings.map((h) => {
          const sharePct = h.p.targetKobo
            ? (h.investedKobo / h.p.targetKobo) *
              (h.p.investorShareBps / 10000) *
              100
            : 0;
          return (
            <Card key={h.iv.invId}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontWeight: 700 }}>{h.p.name}</div>
                <StageBadge stage={h.p.stage} />
              </div>
<div style={{ marginTop: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 6 }}><span>Funding progress</span><span>{Math.min(100, Math.round((h.p.raisedKobo / h.p.targetKobo) * 100))}% funded</span></div><div style={{ height: 8, borderRadius: 999, background: C.chip, overflow: 'hidden' }}><div style={{ height: '100%', width: Math.min(100, Math.round((h.p.raisedKobo / h.p.targetKobo) * 100)) + '%', background: C.accent }} /></div></div>
              <Row style={{ marginTop: 12 }}>
                <Stat
                  label="Total needed"
                  value={naira(h.p.targetKobo)}
                  sub="project capital target"
                />
                <Stat label="Amount invested" value={naira(h.investedKobo)} />
                <Stat
                  label="Your share"
                  value={sharePct.toFixed(2) + '%'}
                  sub="your ownership of project profit"
                />
                <Stat
                  label={
                    h.p.profitConfirmed ? 'Realised profit' : 'Projected profit'
                  }
                  value={naira(
                    h.p.profitConfirmed
                      ? (h.p.slips || [])
                          .filter(
                            (s) =>
                              s.party === 'INVESTOR' && s.invId === h.iv.invId
                          )
                          .reduce((a, s) => a + s.profitKobo, 0)
                      : projectedProfitKobo(h.p, h.investedKobo)
                  )}
                  sub={
                    h.p.profitConfirmed
                      ? 'your distributed profit'
                      : 'projected from your share — updates when profit is posted'
                  }
                />
                {h.p.profitConfirmed && (
                  <Stat
                    label="Project realised profit"
                    value={naira(h.p.realisedProfitKobo)}
                  />
                )}
              </Row>
              {(() => {
                const myProfitKobo = (h.p.slips || [])
                  .filter(
                    (s) => s.party === 'INVESTOR' && s.invId === h.iv.invId
                  )
                  .reduce((a, s) => a + s.profitKobo, 0);
                const ended = h.p.stage === 'END';
                return (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid ' + C.line,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <Label>Withdraw profit</Label>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            marginTop: 4,
                          }}
                        >
                          {naira(myProfitKobo)}
                        </div>
                        <div
                          style={{ color: C.sub, fontSize: 12, marginTop: 2 }}
                        >
                          {ended
                            ? 'Project has ended — your profit is available.'
                            : 'Available to withdraw once the project reaches End.'}
                        </div>
                      </div>
                      {h.iv.withdrawn ? (
                        <Pill tone="good">✓ Profit withdrawn</Pill>
                      ) : (
                        <button
                          disabled={!ended || myProfitKobo <= 0}
                          onClick={() => onWithdraw(h.iv.invId)}
                          style={{
                            ...btn('accent'),
                            opacity: ended && myProfitKobo > 0 ? 1 : 0.5,
                            cursor:
                              ended && myProfitKobo > 0
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                        >
                          {ended ? 'Withdraw profit' : '🔒 Locked until End'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
const InvestorHome = ({ projects, meId, onAccept, onCommit, onProof }) => {
  const myInvites = [];
  projects.forEach((p) =>
    p.invited.forEach((iv) => {
      if (
        iv.userId === meId &&
        iv.status !== 'CONFIRMED' &&
        iv.status !== 'DECLINED'
      )
        myInvites.push({ p, iv });
    })
  );
  return (
    <div>
      {myInvites.length === 0 && (
        <div style={{ color: C.sub }}>No pending invitations.</div>
      )}
      <div style={{ display: 'grid', gap: 14 }}>
        {myInvites.map(({ p, iv }) => (
          <InviteFlow
            key={iv.invId}
            p={p}
            iv={iv}
            onAccept={onAccept}
            onCommit={onCommit}
            onProof={onProof}
          />
        ))}
      </div>
    </div>
  );
};
// ---------- manager earnings (Mudarabah 30% slips) ----------
const ManagerEarnings = ({ projects, meId }) => {
  const slips = [];
  projects.forEach((p) => {
    if (p.profitConfirmed && p.slips) {
      p.slips.forEach((s) => {
        if (s.party === 'MANAGER' && s.userId === meId) slips.push({ p, s });
      });
    }
  });
  const total = slips.reduce((a, x) => a + x.s.profitKobo, 0);
  return (
    <div>
      <Row style={{ marginBottom: 16 }}>
        <Card style={{ flex: 1, borderColor: C.gold + '66' }}>
          <Stat
            label="Total manager profit"
            value={naira(total)}
            sub="your 30% Mudarabah share"
          />
        </Card>
        <Card style={{ flex: 1 }}>
          <Stat label="Profit slips" value={slips.length} />
        </Card>
      </Row>
      {slips.length === 0 && (
        <div style={{ color: C.sub }}>No realised-profit slips yet.</div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {slips.map((x, i) => (
          <Card key={i}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontWeight: 700 }}>{x.p.name}</div>
              <Pill tone="warn">Manager slip</Pill>
            </div>
            <Row style={{ marginTop: 12 }}>
              <Stat
                label="Project realised profit"
                value={naira(x.p.realisedProfitKobo)}
              />
              <Stat
                label="Your share"
                value={naira(x.s.profitKobo)}
                sub={bps(x.p.managerShareBps)}
              />
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ---------- app ----------
export default function App() {
  const [me, setMe] = useState(null);
  const [projects, setProjects] = useState(seedProjects());
  const [page, setPage] = useState('projects');
  const [openId, setOpenId] = useState(null);
  const open = projects.find((p) => p.id === openId);
  // mutate a single invite across projects
  const patchInvite = (invId, patch) =>
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        invited: p.invited.map((iv) =>
          iv.invId === invId ? { ...iv, ...patch } : iv
        ),
      }))
    );
  const acceptInvite = (invId) => patchInvite(invId, { status: 'ACCEPTED' });
  const commitInvite = (invId, kobo) =>
    patchInvite(invId, { status: 'COMMITTED', committedKobo: kobo });
  const submitProof = (invId, name) =>
    patchInvite(invId, { status: 'PROOF_SUBMITTED', proofName: name });
  // investor withdraws realised profit (only after project end)
  const withdrawProfit = (invId) => patchInvite(invId, { withdrawn: true });
  // line manager confirms -> mark CONFIRMED and add committed capital to raised
  const confirmPayment = (invId) =>
    setProjects((prev) =>
      prev.map((p) => {
        const iv = p.invited.find((x) => x.invId === invId);
        if (!iv) return p;
        const add = iv.committedKobo || iv.proposedKobo;
        return {
          ...p,
          raisedKobo: p.raisedKobo + add,
          stage: p.stage === 'ACCEPTANCE' ? 'PROGRESS' : p.stage,
          invited: p.invited.map((x) =>
            x.invId === invId
              ? { ...x, status: 'CONFIRMED', confirmedBy: me.id }
              : x
          ),
        };
      })
    );
  const inviteInvestor = (projectId, userId, proposedKobo) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              invited: [
                ...p.invited,
                {
                  invId: uid('iv_'),
                  userId,
                  proposedKobo,
                  status: 'INVITED',
                  proofName: null,
                  confirmedBy: null,
                },
              ],
            }
          : p
      )
    );
  const addDoc = (projectId, d) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              docs: [
                {
                  id: uid('d_'),
                  date: new Date().toISOString().slice(0, 10),
                  ...d,
                },
                ...p.docs,
              ],
            }
          : p
      )
    );
  const postMsg = (projectId, body) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              messages: [
                ...p.messages,
                {
                  id: uid('m_'),
                  authorId: me.id,
                  body,
                  date: new Date().toISOString().slice(0, 10),
                },
              ],
            }
          : p
      )
    );
  const createProject = (f) => {
    const np = {
      id: 'PRJ-' + Math.floor(100 + Math.random() * 900),
      name: f.name,
      sector: f.sector || '—',
      location: f.location || '—',
      createdBy: me.id,
      stage: 'INITIATION',
      approval: me.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
      targetKobo: Math.round(parseFloat(f.target || '0') * 100),
      raisedKobo: 0,
      realisedProfitKobo: 0,
      investorShareBps: 7000,
      managerShareBps: 3000,
      expectedProfitKobo: Math.round(parseFloat(f.target || '0') * 100 * 0.2),
      noticeDays: 90,
      penaltyBps: 500,
      summary: f.summary,
      fullDetails: f.fullDetails,
      risks: f.risks,
      timeline: f.timeline,
      payAccount: {
        bankName: 'Wema Bank',
        accountName: 'RibhShare / Escrow',
        accountNumber: '01234560' + Math.floor(10 + Math.random() * 89),
      },
      invited: [],
      docs: [],
      messages: [],
    };
    setProjects((prev) => [np, ...prev]);
    setPage('projects');
  };
  const decide = (projectId, approval) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              approval,
              stage: approval === 'APPROVED' ? 'ACCEPTANCE' : p.stage,
            }
          : p
      )
    );

  // Manager/Admin confirms realised profit -> auto-distribute (Mudarabah 70/30).
  // Each confirmed investor gets a slip pro-rata to capital; the manager gets the 30% slip.
  const confirmProfit = (projectId, realisedKobo) =>
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const confirmed = p.invited.filter((iv) => iv.status === 'CONFIRMED');
        const totalCapital = confirmed.reduce(
          (s, iv) => s + (iv.committedKobo || iv.proposedKobo),
          0
        );
        const investorPool = Math.round(
          realisedKobo * (p.investorShareBps / 10000)
        );
        const managerKobo = realisedKobo - investorPool;
        const slips = confirmed.map((iv) => {
          const capital = iv.committedKobo || iv.proposedKobo;
          const profitKobo =
            totalCapital > 0
              ? Math.round((capital / totalCapital) * investorPool)
              : 0;
          return {
            party: 'INVESTOR',
            userId: iv.userId,
            invId: iv.invId,
            capitalKobo: capital,
            profitKobo,
          };
        });
        slips.push({
          party: 'MANAGER',
          userId: p.createdBy,
          capitalKobo: 0,
          profitKobo: managerKobo,
        });
        return {
          ...p,
          realisedProfitKobo: realisedKobo,
          profitConfirmed: true,
          stage: 'END',
          slips,
        };
      })
    );
  if (!me)
    return (
      <RolePicker
        onPick={(u) => {
          setMe(u);
          setPage(u.role === 'INVESTOR' ? 'invites' : 'projects');
        }}
      />
    );
  const navByRole = () => {
    if (me.role === 'INVESTOR')
      return [
        { key: 'invites', label: 'Invitations' },
        { key: 'portfolio', label: 'Portfolio' },
      ];
    if (me.role === 'CEO')
      return [
        { key: 'projects', label: 'Projects' },
        { key: 'approvals', label: 'Approvals' },
      ];
    if (me.role === 'LINE_MANAGER')
      return [
        { key: 'projects', label: 'Projects' },
        { key: 'create', label: 'New project' },
        { key: 'earnings', label: 'Earnings' },
      ];
    return [
      { key: 'projects', label: 'Projects' },
      { key: 'create', label: 'New project' },
      { key: 'approvals', label: 'Approvals' },
      { key: 'earnings', label: 'Earnings' },
    ];
  };
  const visibleProjects = me.role === 'INVESTOR' ? [] : projects;
  return (
    <Shell
      me={me}
      nav={Object.assign(navByRole(), { active: page })}
      onNav={setPage}
      onSignOut={() => {
        setMe(null);
        setOpenId(null);
      }}
    >
      {open ? (
        <ProjectDetail
          p={open}
          me={me}
          onBack={() => setOpenId(null)}
          onAddDoc={(d) => addDoc(open.id, d)}
          onPost={(b) => postMsg(open.id, b)}
          onConfirm={confirmPayment}
          onConfirmProfit={(kobo) => confirmProfit(open.id, kobo)}
          onInvite={(userId, kobo) => inviteInvestor(open.id, userId, kobo)}
        />
      ) : (
        <div>
          {page === 'projects' && (
            <>
              <PageHead
                title="Projects"
                sub="Shariah project-investment marketplace"
              />
              <ProjectList projects={visibleProjects} onOpen={setOpenId} />
            </>
          )}
          {page === 'create' && (
            <>
              <PageHead title="New project" />
              <CreateProject me={me} onCreate={createProject} />
            </>
          )}
          {page === 'approvals' && (
            <>
              <PageHead
                title="Approvals"
                sub="Line Manager projects awaiting CEO acceptance"
              />
              <CeoApprovals projects={projects} onDecide={decide} />
            </>
          )}
          {page === 'invites' && (
            <>
              <PageHead
                title="Invitations"
                sub="Review summaries, accept terms, invest"
              />
              <InvestorHome
                projects={projects}
                meId={me.id}
                onAccept={acceptInvite}
                onCommit={commitInvite}
                onProof={submitProof}
              />
            </>
          )}
          {page === 'portfolio' && (
            <>
              <PageHead title="Portfolio" sub="Your confirmed investments" />
              <Portfolio
                projects={projects}
                meId={me.id}
                onWithdraw={withdrawProfit}
              />
            </>
          )}
          {page === 'earnings' && (
            <>
              <PageHead title="Earnings" sub="Your Mudarabah profit slips" />
              <ManagerEarnings projects={projects} meId={me.id} />
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

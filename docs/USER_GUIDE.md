# Prism Capital — User Guide
> Formerly RibhShare. Institutional-grade Shariah-compliant private-placement platform.

---

## 1 · Product overview

Prism Capital lets a **Line Manager** raise Shariah-compliant capital from **Investors** for real projects, with **CEO** oversight. Every rupee is tracked in **whole units** (not free-form amounts), every profit distribution passes a **maker–checker** gate, and every posting hits an **immutable double-entry ledger**.

- **Currency**: Naira (₦), stored as minor units (kobo) internally.
- **Web app**: Expo Web SPA on Netlify → `ribhshare.com`.
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Row-Level Security).

---

## 2 · Roles

| Role | What they do |
|---|---|
| **CEO / Admin** | Approves projects, approves profit declarations (four-eyes), sees platform-wide trial balance, exports ledger CSV. |
| **Line Manager (LM)** | Creates projects, invites investors, confirms bank payments, declares profits, ends projects. |
| **Investor** | Receives invite → sets password → pledges units → uploads payment proof → receives distribution notices + PDF statements. |

Test accounts (dev): see `/app/memory/test_credentials.md`.

---

## 3 · End-to-end lifecycle

```
        LM                CEO              Investor
         │                 │                  │
   1 Create project ───▶ 2 Approve            │
         │                 │                  │
   3 Invite ────────────────────────────────▶ 4 First sign-in (8-char code)
         │                 │                  │
         │                 │           5 Set password
         │                 │                  │
         │                 │           6 Pledge N units
         │                 │                  │
         │                 │           7 Upload payment proof
   8 Confirm payment                          │
   (units allotted)                           │
         │                 │                  │
   9 Declare profit ───▶ 10 Approve           │
      (waterfall)                             │
                                       11 Statement + notice
                                          (auto PDF)
   12 Declare FINAL ───▶ 13 Approve
      (project ends,                          │
       capital + profit                14 Final PDF statement
       distributed)
```

---

## 4 · Screen-by-screen — Line Manager

### 4.1 Home
- Hero: total AUM, active projects, pending approvals.
- **Manager Earnings** card (green): total manager share across all projects.
- **Profit Sources** list: every project with realised profit, sorted by LM cut.

### 4.2 Projects tab
- Grid of your projects. Each card: code, name, stage chip (INITIATION / ACCEPTANCE / PROGRESS / END), target vs raised.
- **"+ New Project"** button opens the wizard.

### 4.3 Create Project wizard (5 steps)
1. **Basics** — Name, description, target ₦, **Total Units**, **Min units/investor**, **Prism fee %** (default 7.5%), duration.
2. **Financials** — Manager profit share % (0–50%, default 30%).
3. **Documents** — 3 required uploads (Feasibility, Contract, ID) + optional banner.
4. **Review**.
5. **Submit** → CEO approval queue.

### 4.4 Project Detail (tabs)
- **Overview** — Progress bar, unit spectrum (subscribed vs available), key facts.
- **Documents** — All uploaded files.
- **Investors** — Table with `units · ₦ · payment reference (PRSM-CODE-INV###)`. "Copy invite link" pill on unredeemed invites.
- **Activity** — Announcements + fund-use posts.
- **Profits** ⭐ — Waterfall calculator + declaration form (see §5).
- **Ledger** ⭐ — Every DR/CR posted to this project. Balances at top.
- **Audit** ⭐ — Colour-coded event stream. CSV export button.
- **Reconciliation** ⭐ — Expected inflow vs claimed per invite. Variance flagged red.

### 4.5 Earnings tab
- LM-only. Cross-project view of manager share, per-project breakdown, timeline of recent profit posts.

---

## 5 · Profit declaration flow (maker–checker)

**LM (maker)** submits a declaration on the Profits tab:

- Enters `gross` and `costs` in ₦.
- Live waterfall preview updates:
  ```
  Gross          ₦1,000,000
  – Costs        ₦  200,000
  = Net          ₦  800,000
  – Prism fee    ₦   60,000   (7.5% of net)
  = Distributable ₦  740,000
  ├─ Manager    ₦  222,000   (30% of distributable)
  └─ Investor pool ₦ 518,000   (70%)
     Per unit    ₦   10,360   (÷ 50 units)
  ```
- Two buttons:
  - **Submit for approval** — regular distribution, project stays in PROGRESS.
  - **Submit as final (end project)** — final distribution + capital return; flips stage to END on approval.

**CEO (checker)** sees it in Approvals → Declarations queue:
- Cannot approve their own submissions (four-eyes principle).
- On approve: waterfall is locked into `profit_declarations` as immutable record; one `distribution_notice` per confirmed investor is minted; ledger auto-posts.
- On reject: adds a `rejection_note`; declaration is preserved for audit.

---

## 6 · Screen-by-screen — Investor

### 6.1 First-time sign-in
- Investor receives email with 8-char code (or copy-invite-link from LM if email undelivered).
- `/first-signin` → email + code → magic-link validated → `/set-password` → dashboard.

### 6.2 Portfolio
- Aggregate stats: invested, projected profit, realised share.
- Cards per holding: project, units held, ownership %, per-holding realised profit.

### 6.3 Project Detail (investor view)
- **Overview** — same as LM but read-only.
- **Payment** — "How many units?" input (integer, ≥ min per investor), live pledge total, min-units hint. After pledge: big monospaced `PRSM-CODE-INV###` reference to copy into transfer narration.
- **Financials** — Project target, your capital, projected profit, realised share, ownership %.
- **Activity** — Announcements and fund-use updates.

### 6.4 Statements tab ⭐
- Every `distribution_notice` renders as a card:
  ```
  PRSM-ABC-NOT001 · 2026-07-24
  Regular distribution

  Gross          ₦1,000,000
  Costs         –₦  200,000
  Net           ₦  800,000
  Prism fee     –₦   60,000
  Pool          ₦  518,000
  You (10 units)₦  103,600
  ```
- FINAL notices show a highlighted "Capital returned" block with the total credit.
- **Download PDF** button per notice → generates `Statement_PRSM-<ref>.pdf` (A4, Prism-branded, immutable footer).

---

## 7 · Screen-by-screen — CEO

### 7.1 Dashboard
- Platform-wide KPIs: total AUM, active projects, pending approvals.
- **Trial Balance CSV** ⭐ — top-right button. Exports current account balances across all projects (bank, investor capital, payables, realised P&L, fees, reserves).

### 7.2 Approvals tab
- Top toggle: **Declarations | Projects (n)**.
- Declarations: pending profit declarations queue — reference, label, gross, net, investor pool, per-unit summary. Tap → jumps into project's Profits tab.
- Projects: pending project submissions from LMs.

### 7.3 All project tabs
- Same as LM view, plus: **Reconciliation** and **Ledger** visible for oversight across all projects.

---

## 8 · Ledger (double-entry, append-only)

Every material action posts balanced DR/CR entries automatically. Statement-level trigger `enforce_ledger_balance` rejects any imbalanced transaction. Accounts used:

| Code | Account | Direction it grows |
|---|---|---|
| `project_bank` | Cash raised, held by Prism | DR |
| `investor_capital` | Capital committed by investor | CR |
| `investor_payable` | Profit owed to investor | CR |
| `manager_payable` | Manager cut owed | CR |
| `platform_fee_payable` | Prism fee owed | CR |
| `project_realised_pnl` | Net profit recognised | DR |
| `rounding_reserve` | Per-unit floor residue | CR |

**Auto-posting triggers**:
- Invite → CONFIRMED → `DR project_bank / CR investor_capital[party]`
- Declaration → APPROVED → full waterfall entries
- FINAL declaration approved → additionally `DR investor_capital[party] / CR project_bank` (capital return)

Historical data (pre-trigger deployment) is NOT auto-backfilled. Ask us if you want a one-off backfill script.

---

## 9 · Distribution notices & audit trail

- **`distribution_notices`** — one immutable row per (approved declaration × confirmed investor). Investor sees their own; LM/CEO see all on their projects.
- **`audit_events`** — append-only log of everything: project created / stage-changed / invite created / accepted / pledged / verified / declined; declaration declared / approved / rejected.
- **`project_reconciliation(project)`** RPC — expected inflow vs claimed amount per invite, flags variance for Finance. Visible in Reconciliation tab.

---

## 10 · Deliverability & communications

- Invitation emails sent via Resend (from `noreply@paynexhq.com`).
- Gmail cold-domain deliverability to `+tag` aliases can be flaky — LM always sees the 8-char code inline in the UI as a fallback (with "Copy invite link" pill).

---

## 11 · Test credentials

| Role | Email | Password |
|---|---|---|
| CEO | `Ceo@ribhshare.com` | `Test@123` |
| Line Manager | `linemanager@ribhshare.com` | `Test@123` |
| Investor | `investor@ribhshare.com` | `Test@123` |

---

*Last updated: 2026-07-24. Living document — updated on every release.*

# Prism Capital
## Software Development Cost Schedule

| | |
|---|---|
| **Document** | Fixed-price cost schedule |
| **Product** | Prism Capital (private-placement platform) |
| **Client** | Prism Capital |
| **Vendor** | Quantum |
| **Currency** | Nigerian Naira (NGN) |
| **Tax treatment** | Nigerian resident-to-resident professional services (see §6) |
| **Professional fees (pre-tax)** | **₦14,370,750** |
| **VAT @ 7.5%** | **₦1,077,806.25** |
| **Invoice total (fees + VAT)** | **₦15,448,556.25** |
| **Amount payable after 5% WHT** | **₦14,730,018.75** |
| **Commercial form** | Fixed package price (not time-and-materials) |

---

## 1. Purpose

This schedule is the commercial breakdown of the **Prism Capital** software platform as delivered: an institutional, Shariah-compliant private-placement system in which a Line Manager lists a unitised deal, the CEO governs it, a Project Owner operates it, and invited investors fund it.

Prices are **fixed package amounts** for named capabilities. They are not derived from an hourly rate and do not imply a delivery calendar.

## 2. Product in scope

### 2.1 What the platform does

Prism Capital lets Prism operators raise capital in **whole units** (Naira stored as kobo) for real projects. The live web application is an Expo / React SPA on Netlify, backed by Supabase (Auth, Postgres with RLS, Storage, Edge Functions) plus Resend for mail, Gemini for brief extraction, and client-side PDF statements.

### 2.2 Roles covered

| Role | Responsibility included in this price |
|---|---|
| **CEO** | Approve listings and profit declarations (four-eyes); capital and ledger oversight; provision Line Managers; message oversight on existing threads. |
| **ADMIN** | Same operational visibility as CEO; **cannot** create users. |
| **Line Manager** | Prism operator: create projects, invite investors, confirm proofs, mediate owner and investors, forward profit, decide drawdowns and withdrawals. Earnings = platform / raise fees. |
| **Project Owner** | Originator on assigned deals: drawdowns, propose profit, withdraw manager share. No investor list, ledger, or audit. |
| **Investor** | Invite-only: first sign-in, pledge, pay, statements, NAV, withdraw realised profit. Cannot message the Owner directly. |

### 2.3 Lifecycle covered

```
Project created (INITIATION) → CEO approval (ACCEPTANCE)
  → Capital raise (invites, pledges, proofs, confirm)
  → Target / Progress (raise fee reserved, owner drawdowns, activity)
  → Profit (propose / declare → CEO four-eyes → notices + ledger)
  → Withdrawals (investor and owner)
  → FINAL declaration (END + capital returned on notices)
```

### 2.4 Architecture included

| Layer | Included |
|---|---|
| Application | Expo SDK 54, React 19, expo-router, TypeScript SPA |
| State | Zustand (auth / UI), TanStack Query (server state) |
| Backend | Supabase Auth, Postgres, Storage, Edge Functions, RLS |
| Email | Resend (invites / notify); Auth SMTP for password recovery |
| Documents / PDF | Project document storage; jsPDF investor statements |
| Intelligence | Gemini-backed project-brief extraction |
| Hosting (app build) | Production web SPA (ribhshare.com) |

Cloud **usage** (Supabase, Netlify, Resend, Gemini) remains a client pass-through and is listed under exclusions.

## 3. Cost summary

| Ref | Workstream | Amount (NGN) |
|---|---|---:|
| **A** | **Platform foundation** | **₦1,956,200** |
| **B** | **Deal origination** | **₦1,852,850** |
| **C** | **Governance** | **₦927,500** |
| **D** | **Capital raise** | **₦2,054,950** |
| **E** | **Project Owner operations and capital accounting** | **₦1,846,250** |
| **F** | **Profit engine and investor NAV** | **₦1,630,050** |
| **G** | **Institutional books** | **₦1,329,950** |
| **H** | **Collaboration and notifications** | **₦1,127,250** |
| **I** | **Product surfaces and design system** | **₦1,232,950** |
| **J** | **Quality, documentation and production cutover** | **₦412,800** |
| | **Professional fees (pre-tax)** | **₦14,370,750** |

| | Amount (NGN) |
|---|---:|
| Professional fees | ₦14,370,750 |
| VAT @ 7.5% | ₦1,077,806.25 |
| **Invoice total (fees + VAT)** | **₦15,448,556.25** |
| Less: WHT @ 5% (resident professional / technical fees, on fees only) | (₦718,537.50) |
| **Amount payable by the client** | **₦14,730,018.75** |

Full statutory notes and the non-resident alternative are in **section 6**.

## 4. Detailed cost schedule

Each line is a fixed package. The bullets under a line are the capability included in that package — not a timesheet.

### A. Platform foundation

Identity, authorisation, and the data-security model that every later module depends on. All money is stored as kobo; all access is role-scoped in Postgres row-level security.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| A.1 | Security architecture, roles and row-level security | ₦712,450 |
| A.2 | Dual-portal authentication and session security | ₦418,750 |
| A.3 | Investor invite onboarding | ₦563,200 |
| A.4 | Password recovery | ₦261,800 |
| | **A subtotal** | **₦1,956,200** |

#### A.1 Security architecture, roles and row-level security — ₦712,450

Included:

- Five production roles: CEO, ADMIN, LINE_MANAGER, PROJECT_OWNER, and INVESTOR (separate portal).
- Role matrix for every surface (dashboard, project tabs, messages, earnings, users, approvals).
- Postgres RLS so a Line Manager sees only their deals, an Owner sees only assigned projects, and an Investor sees only confirmed or invited positions.
- Kobo (minor-unit) money model, unit register fields, dual-fee columns, and the INITIATION → ACCEPTANCE → PROGRESS → END stage machine.
- Service layer, typed RPC contracts, and generated frontend types aligned to the live database.

#### A.2 Dual-portal authentication and session security — ₦418,750

Included:

- Investor sign-in portal and staff sign-in portal, with wrong-role logins rejected.
- Session hydration, profile load, and route guards that send each role to the correct home.
- Idle timeout, secure token storage, and Auth state that does not fabricate a role before the profile resolves.
- Staff vs investor navigation shells so tabs and rails never leak another role’s tools.

#### A.3 Investor invite onboarding — ₦563,200

Included:

- Single-use 8-character first-sign-in codes generated at invite time.
- Public redeem endpoint (rate-limited) that returns a magic-link token.
- Set-password screen, password_set flag, and post-onboarding redirect into the invited project.
- Copy-invite-link fallback so the Line Manager can share email + code + URL if mail delivery fails.

#### A.4 Password recovery — ₦261,800

Included:

- Forgot-password entry on both portals.
- Email recovery via Supabase Auth and a reset-password screen on the SPA.
- Auth redirect configuration for the production origin.

### B. Deal origination

How a listing is born: brief, commercial terms, documents, and submission into the CEO queue.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| B.1 | Create-project wizard and unit model | ₦724,600 |
| B.2 | AI brief extraction and document pack | ₦668,350 |
| B.3 | Submit for review and stage transitions | ₦459,900 |
| | **B subtotal** | **₦1,852,850** |

#### B.1 Create-project wizard and unit model — ₦724,600

Included:

- Four-step wizard: Upload → Basics → Details → Review, with validation only after a field is touched or Continue is pressed.
- Unitised subscription: total units, minimum units per investor, live “1 unit = ₦X” preview, target must divide cleanly by units.
- Manager profit share input (investor majority preserved; cap 50%), bank details, and profit-declaration frequency.
- Create-project edge function that validates the payload server-side before insert.

#### B.2 AI brief extraction and document pack — ₦668,350

Included:

- Upload of a project brief and Gemini-backed extraction into wizard fields, with draft cache so a refresh does not lose work.
- Required and optional document slots (including banner), storage upload, MIME allow-lists, and inbox-upload RLS.
- Document tab on the live project for later packs and CapEx-style exports where provided.

#### B.3 Submit for review and stage transitions — ₦459,900

Included:

- Submit-project edge function and RPC aligned to the wizard’s required documents.
- CEO approve / reject path that moves INITIATION → ACCEPTANCE on approval.
- Edit-project flow for permitted fields while the listing is still in origination.
- Optional early start into PROGRESS when fundraising rules allow.

### C. Governance

CEO and Admin control of marketplace quality: approvals, users, and oversight dashboards.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| C.1 | CEO dashboard, approvals inbox and staff provisioning | ₦927,500 |
| | **C subtotal** | **₦927,500** |

#### C.1 CEO dashboard, approvals inbox and staff provisioning — ₦927,500

Included:

- CEO home: capital raised across projects, active deals, pending-approval counts, recently active listings.
- Approvals inbox with Declarations | Projects toggle; declaration rows deep-link to the project Profits tab.
- Four-eyes rule: the CEO cannot approve a profit declaration they themselves submitted.
- Users directory with filters (Investors / Line Managers / Owners / CEO) and Create Line Manager (CEO only).
- ADMIN role: same books and queues as CEO, without user-creation rights.
- Ledger integrity card and historical ledger backfill control on the dashboard.

### D. Capital raise

Invite-only fundraising: units, pledges, bank proof, and Line Manager confirmation until the target is met.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| D.1 | Invitations, email delivery and payment references | ₦718,900 |
| D.2 | Unit and naira pledge, remnant waiver and expiry | ₦661,250 |
| D.3 | Payment proof and Line Manager confirmation | ₦674,800 |
| | **D subtotal** | **₦2,054,950** |

#### D.1 Invitations, email delivery and payment references — ₦718,900

Included:

- Send-invitation edge function (Line Manager / Admin): create invite, generate code, send via Resend or return the code inline.
- Invitation statuses: INVITED → ACCEPTED → pledged / proof submitted → CONFIRMED (or DECLINED).
- Unique payment reference per invite (PRSM-<code>-INV###) for bank narration and reconciliation.
- Invite teaser on project overview until the investor is confirmed; declined invites are blocked.

#### D.2 Unit and naira pledge, remnant waiver and expiry — ₦661,250

Included:

- Pledge by whole units or by naira (fractional units where the schema allows).
- Server-enforced investable max: remaining target and any per-invite cap.
- Below-minimum remnant pledges with Line Manager waiver workflow.
- Lazy sweep of stale pledges (default 72 hours) so reserved units are released.

#### D.3 Payment proof and Line Manager confirmation — ₦674,800

Included:

- Multipart proof upload (web File/Blob) via submit-payment-proof; invite moves to PROOF_SUBMITTED.
- CONFIRM_PAYMENT_PROOF task created for the Line Manager, completable from the Investors tab.
- Confirm-invite-payment edge function: allot pledged units, stamp verifier, increment raised capital, complete the task.
- Investors tab showing units, naira, reference, bank claim fields, and copy-link for unredeemed invites.

### E. Project Owner operations and capital accounting

The originator’s workspace after assignment, and the dual-fee capital picture the operator and Owner both rely on.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| E.1 | Project Owner role, assignment and restricted workspace | ₦615,400 |
| E.2 | Dual fees, current capital and Progress start | ₦608,750 |
| E.3 | Fund drawdowns | ₦622,100 |
| | **E subtotal** | **₦1,846,250** |

#### E.1 Project Owner role, assignment and restricted workspace — ₦615,400

Included:

- Create / assign / resend Project Owner from the Line Manager’s project (dedicated edge function).
- Owner home and project list limited to assigned deals.
- Owner project tabs: Overview, Documents, Activity, Profits, Drawdowns — no investor register, ledger, or audit.
- Owner RLS and staff-portal sign-in.

#### E.2 Dual fees, current capital and Progress start — ₦608,750

Included:

- Raise fee (default 2.5% of capital raised) reserved when the target is hit or Progress is started early.
- Platform fee (default 7.5% of net profit) applied on each approved declaration.
- Manager share of distributable profit paid to the Project Owner (not the Line Manager).
- Current capital = raised − raise fee − paid drawdowns; raised never shrinks.
- Start-Progress control and capital summary on the project workspace.

#### E.3 Fund drawdowns — ₦622,100

Included:

- Owner drawdown requests with purpose, bank details, and support documents.
- Line Manager / CEO decision and mark-paid, which increases drawn capital.
- Drawdown audit trail and Owner-only create rights.
- Tasking to inform the Owner when fundraising target is reached.

### F. Profit engine and investor NAV

Maker-checker profit declarations, the commercial waterfall, immutable investor notices, and mark-to-market NAV.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| F.1 | Profit waterfall, four-eyes approval and owner proposals | ₦918,650 |
| F.2 | Distribution notices, NAV and capital return | ₦711,400 |
| | **F subtotal** | **₦1,630,050** |

#### F.1 Profit waterfall, four-eyes approval and owner proposals — ₦918,650

Included:

- Owner proposes realised profit to Prism; Line Manager forwards into the CEO path (or declares directly where permitted).
- Live waterfall preview: Gross → Costs → Net → Platform fee → Distributable → Investor pool → Manager share → Per unit.
- Pending / Approved / Rejected / Final statuses; immutable after approval; rejection notes.
- CEO four-eyes approve/reject; self-approval blocked in RPC and UI.
- Profit-declaration frequency stored on the project for operator discipline.

#### F.2 Distribution notices, NAV and capital return — ₦711,400

Included:

- One immutable distribution notice per confirmed investor per approved declaration, with PRSM notice references.
- Investor Statements screen: waterfall detail, capital-returned block on FINAL notices, PDF download.
- Portfolio NAV: units held, NAV per unit, position value, realised P&L — mark-to-market, not a forward ROI estimate.
- FINAL declaration ends the project (END) and posts capital return onto notices.
- Realtime / query invalidation so NAV updates when a declaration is approved.

### G. Institutional books

Append-only double-entry accounting, finance operations views, and investor-facing statements.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| G.1 | Double-entry ledger, integrity and trial balance | ₦768,200 |
| G.2 | Reconciliation, audit trail and PDF statements | ₦561,750 |
| | **G subtotal** | **₦1,329,950** |

#### G.1 Double-entry ledger, integrity and trial balance — ₦768,200

Included:

- ledger_entries table with balance-enforcing trigger (every transaction DR = CR).
- Auto-post on invite confirm (capital in) and on declaration approve (full waterfall, plus capital-return leg on FINAL).
- Idempotent posting; list_project_ledger and project balance views.
- CEO/Admin ledger integrity RPC and backfill of historical events.
- Trial-balance CSV export from the CEO dashboard.
- Project Ledger tab: balances plus expandable transactions (account, party, memo, DR/CR).

#### G.2 Reconciliation, audit trail and PDF statements — ₦561,750

Included:

- Reconciliation tab: expected inflow vs claimed per invite, variance flags, bank/narration/verifier.
- Append-only audit_events with triggers on projects, invites, and declarations; colour-coded Audit tab and CSV export.
- Prism-branded A4 PDF per distribution notice (reference, waterfall, investor share, immutable footer).

### H. Collaboration and notifications

Line Manager mediation is the communications model: investors and owners do not message each other directly.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| H.1 | Mediated messaging and CEO oversight | ₦614,850 |
| H.2 | Tasks, in-app notifications and transactional email | ₦512,400 |
| | **H subtotal** | **₦1,127,250** |

#### H.1 Mediated messaging and CEO oversight — ₦614,850

Included:

- Project message threads: investor ↔ Line Manager and owner ↔ Line Manager only.
- Realtime delivery on staff and investor message screens.
- CEO oversight inbox: join and reply on existing project threads; no public DM directory.
- Unread handling and thread list scoped by role.

#### H.2 Tasks, in-app notifications and transactional email — ₦512,400

Included:

- Task types including confirm payment proof, remnant waiver, and inform owner at target.
- Notifications centre plus investor live activity drawer (invites and distributions).
- Database-triggered emails (invites, priority events) via notify-investors webhook and Resend.
- Proof-submitted and related operator alerts.

### I. Product surfaces and design system

The operator and investor product: Prism visual system, desktop shell, role homes, and money dashboards.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| I.1 | Design system, desktop shell and role workspaces | ₦823,600 |
| I.2 | Earnings, withdrawals and investor portfolio | ₦409,350 |
| | **I subtotal** | **₦1,232,950** |

#### I.1 Design system, desktop shell and role workspaces — ₦823,600

Included:

- Prism Capital rebrand: navy institutional palette, Instrument Serif, tetrahedron mark, light/dark theme.
- Shared primitives: Button, Card, HeroBalance, ChipRow, ActionPillGroup, SparklineTile, StageBadge, loaders.
- Desktop left rail (≥960px web) with role-appropriate items; bottom tabs on smaller viewports.
- Project detail split layout with right-hand context panel (raised, unit register, meta).
- Role homes: Investor, Line Manager, Project Owner, CEO.
- Unified project workspace tabs (role-gated): Overview, Documents, Investors, Activity, Profits, Drawdowns, Withdrawals, Reconciliation, Audit, Ledger, Payment.
- Web accessibility floor: native tablists, alerts, 44px targets, screen-reader summaries on unit register.

#### I.2 Earnings, withdrawals and investor portfolio — ₦409,350

Included:

- Line Manager earnings: platform and raise fees (not the Mudarabah manager cut).
- Owner earnings: manager share across approved declarations; owner profit withdrawals.
- Investor profit withdrawals from notices, decided by Prism (Line Manager / CEO).
- Investor portfolio: positions, NAV, pending invite actions, statements entry.

### J. Quality, documentation and production cutover

Making the platform operable: docs, types, and the production web deployment.

| Ref | Item | Amount (NGN) |
|---|---|---:|
| J.1 | QA, documentation and production deployment | ₦412,800 |
| | **J subtotal** | **₦412,800** |

#### J.1 QA, documentation and production deployment — ₦412,800

Included:

- Role guides (CEO, Line Manager, Project Owner, Investor), user guide, technical reference, lifecycle and invite/payment notes.
- Migration discipline, edge-function deploy, and TypeScript types regenerated from the linked database.
- Production SPA on Netlify (ribhshare.com) wired to the live Supabase project.
- Test accounts and sandbox credentials for operator acceptance.

## 5. Full line-item register

| Ref | Item | Amount (NGN) |
|---|---|---:|
| A.1 | Security architecture, roles and row-level security | ₦712,450 |
| A.2 | Dual-portal authentication and session security | ₦418,750 |
| A.3 | Investor invite onboarding | ₦563,200 |
| A.4 | Password recovery | ₦261,800 |
| B.1 | Create-project wizard and unit model | ₦724,600 |
| B.2 | AI brief extraction and document pack | ₦668,350 |
| B.3 | Submit for review and stage transitions | ₦459,900 |
| C.1 | CEO dashboard, approvals inbox and staff provisioning | ₦927,500 |
| D.1 | Invitations, email delivery and payment references | ₦718,900 |
| D.2 | Unit and naira pledge, remnant waiver and expiry | ₦661,250 |
| D.3 | Payment proof and Line Manager confirmation | ₦674,800 |
| E.1 | Project Owner role, assignment and restricted workspace | ₦615,400 |
| E.2 | Dual fees, current capital and Progress start | ₦608,750 |
| E.3 | Fund drawdowns | ₦622,100 |
| F.1 | Profit waterfall, four-eyes approval and owner proposals | ₦918,650 |
| F.2 | Distribution notices, NAV and capital return | ₦711,400 |
| G.1 | Double-entry ledger, integrity and trial balance | ₦768,200 |
| G.2 | Reconciliation, audit trail and PDF statements | ₦561,750 |
| H.1 | Mediated messaging and CEO oversight | ₦614,850 |
| H.2 | Tasks, in-app notifications and transactional email | ₦512,400 |
| I.1 | Design system, desktop shell and role workspaces | ₦823,600 |
| I.2 | Earnings, withdrawals and investor portfolio | ₦409,350 |
| J.1 | QA, documentation and production deployment | ₦412,800 |
| | **Professional fees (pre-tax)** | **₦14,370,750** |

## 6. Nigerian tax computation

This section applies **Nigeria Tax Act, 2025** (in force from 1 January 2026) and the **Deduction of Tax at Source (Withholding) Regulations, 2024**, on the assumption that both vendor and client are **Nigerian residents** and the work is custom software / professional, consultancy, management or technical services supplied and consumed in Nigeria.

It is a billing schedule, not a tax opinion. Confirm classification and filing with the client’s tax adviser or the Nigeria Revenue Service.

### 6.1 Value Added Tax

| | |
|---|---|
| **Rate** | 7.5% (standard rate under the Nigeria Tax Act, 2025) |
| **Base** | Professional fees exclusive of VAT |
| **When charged** | On invoice issuance, receipt, or payment — whichever occurs first |
| **Who remits** | Vendor charges VAT on the invoice and remits output VAT (net of any allowable input VAT) to the Nigeria Revenue Service |
| **Zero-rating** | Exported services can be zero-rated. This schedule treats the supply as consumed in Nigeria, so the standard rate applies. |

| Step | Computation | Amount (NGN) |
|---|---|---:|
| Professional fees | Sum of sections A–J | ₦14,370,750 |
| VAT | ₦14,370,750 × 7.5% | ₦1,077,806.25 |
| **Invoice total** | Fees + VAT | **₦15,448,556.25** |

### 6.2 Withholding tax

Commission, consultancy, technical, management and professional fees paid to a **resident** company or individual are withheld at **5%**. The same categories paid to a **non-resident** are withheld at **10%** (usually a final tax for the non-resident). WHT is computed on the **fee exclusive of VAT**, deducted by the client at payment (or when the liability is recognised, for related parties), remitted to the Nigeria Revenue Service, and evidenced by a WHT credit note. For a resident vendor the 5% is a **credit against companies income tax / PIT**, not an extra cost on top of the invoice.

If the contract were instead characterised as “other services” not listed in that schedule, the resident WHT rate would be 2%. This schedule uses the professional / technical rate of 5%.

| | Resident vendor (this schedule) | Non-resident vendor (if applicable) |
|---|---:|---:|
| WHT rate | 5% | 10% |
| WHT on fees | ₦718,537.50 | ₦1,437,075 |
| Invoice total (fees + VAT) | ₦15,448,556.25 | ₦15,448,556.25 |
| **Amount the client pays** | **₦14,730,018.75** | ₦14,011,481.25 |

Worked resident example:

```
Professional fees                                 ₦14,370,750
VAT @ 7.5%                                      ₦1,077,806.25
Invoice total                                  ₦15,448,556.25
Less WHT @ 5% of fees                     (      ₦718,537.50)
Amount payable by client                       ₦14,730,018.75
```

### 6.3 What the vendor receives vs what the tax authorities receive

| Party | Cash | Tax account |
|---|---|---|
| Client pays vendor | ₦14,730,018.75 | Holds ₦718,537.50 as WHT to remit |
| Vendor books revenue | ₦14,370,750 | Output VAT ₦1,077,806.25; WHT credit ₦718,537.50 against income tax |
| Client remits WHT | — | ₦718,537.50 to the Nigeria Revenue Service, with a credit note to the vendor |
| Vendor remits VAT | — | ₦1,077,806.25 output VAT (less any allowable input VAT) |

### 6.4 Other Nigerian charges **not** added to this invoice

| Charge | Why it is not a line on this schedule |
|---|---|
| Stamp duty on electronic receipts (₦50 where a bank transfer is ₦10,000 or more) | Collected by the deposit bank on the transfer, not by the software vendor. |
| Companies income tax / development levy | Annual tax on the vendor’s profits; not billed to the client. |
| NITDA / NASENI-style sector levies | Turnover-based annual obligations of a qualifying company, not a project invoice line. |
| Double WHT (no TIN) | If the vendor has no TIN, regulations can double the WHT rate. This schedule assumes a valid TIN. |

## 7. Exclusions

The following are **outside** the ₦14,370,750 professional-fee figure (tax is computed in section 6, not buried here):

| Item | Note |
|---|---|
| Live public Explore / discovery marketplace | Still demo/mock-backed; not billed as a shipped live market. |
| Native iOS / Android store apps | The product is a web SPA. Expo can target native later under a separate schedule. |
| Payment service provider (Paystack, Flutterwave, etc.) | Collections are manual transfer + proof + Line Manager confirm. |
| Infrastructure usage | Supabase, Netlify, Resend, Gemini / LLM keys and metered usage. |
| Third-party licences beyond those already in the application | New vendors, extra seats, or premium APIs. |
| Post-launch support, SLA, or change requests | Separate retainer or variation order. |
| Hardware, bank accounts, legal opinions, CBN / SEC filings | Business operations, not software. |

## 8. Assumptions

1. One production Supabase project and one production web origin.
2. The client supplies (or already supplied) brand assets, fee defaults, and operator test accounts.
3. Invite email deliverability depends on a verified Resend sender domain and secrets in the Supabase project.
4. Password-reset mail depends on Auth SMTP and the correct redirect URL for `/reset-password`.
5. Shariah compliance is implemented as the **product model** (Mudarabah-style split, unitisation, four-eyes). Formal fatwa or legal opinion is not a software deliverable.
6. This schedule prices the **delivered software capability**. It is not a statement of remaining defects, backlog, or Explore-marketplace work.

## 9. Commercial terms

| Term | Position |
|---|---|
| Professional fees | ₦14,370,750 pre-tax |
| VAT | 7.5% = ₦1,077,806.25 |
| Invoice total | ₦15,448,556.25 (fees + VAT) |
| WHT (resident) | 5% of fees = ₦718,537.50, deducted at source |
| Amount payable | ₦14,730,018.75 |
| Form | Fixed package for the scope in sections 2–4 |
| Variations | Work in section 7, or material new modules, require a written variation with a new amount. |
| Intellectual property | Application code delivered to the client’s repositories and production project, unless a master services agreement says otherwise. |
| Acceptance | Production use of the web application for the roles and lifecycle in section 2 constitutes acceptance of this scope. |

Suggested invoice wording:

> Software development — Prism Capital private-placement platform, per Cost Schedule. Professional fees ₦14,370,750; VAT @ 7.5% ₦1,077,806.25; invoice total ₦15,448,556.25. Resident WHT @ 5% (₦718,537.50) to be deducted at source. Amount payable ₦14,730,018.75.

---

*End of schedule. Professional fees ₦14,370,750. Invoice total ₦15,448,556.25. Amount payable ₦14,730,018.75.*

# Prism Capital — User Guide

> Formerly RibhShare. Institutional-grade Shariah-compliant private-placement platform.  
> Last updated: 2026-09-01.

---

## 1 · Overview

Prism Capital lets a **Line Manager** (Prism operator) raise capital in **whole units** for real projects. A **Project Owner** (originator) operates the deal. A **CEO** governs listings and profit declarations. **Investors** fund confirmed invites and receive distribution notices.

- Currency: Naira (₦), stored as kobo.
- Web SPA: Expo Web on Netlify (`ribhshare.com`).
- Backend: Supabase (Auth, Postgres, Storage, Edge Functions, RLS).

---

## 2 · Roles

| Role | Does |
|---|---|
| **CEO / Admin** | Approve projects & profit declarations; users (CEO creates LMs); trial balance; message oversight |
| **Line Manager** | Create projects, invite investors, confirm payments, mediate owner, forward profit proposals, decide drawdowns/withdrawals |
| **Project Owner** | Request drawdowns, propose profit to LM, withdraw manager share |
| **Investor** | First sign-in → pledge units → pay → statements → withdraw realised profit |

Test accounts (sandbox): see `memory/test_credentials.md`.

---

## 3 · Lifecycle

```
LM uploads brief → creates project → CEO approves (ACCEPTANCE)
        ↓
LM assigns Project Owner + invites investors (8-char codes)
        ↓
Investor: first-signin → set password → accept → pledge → proof
LM confirms → units allotted; target hit → PROGRESS (+ raise fee reserved)
        ↓
Owner drawdowns (LM/CEO decide → mark paid)
Owner proposes profit → LM forwards → CEO four-eyes approve
        → notices + ledger; investor/owner withdrawals
FINAL declaration → END + capital returned on notices
```

---

## 4 · Fees (dual)

- **Raise fee** — default 2.5% of capital raised, reserved when fundraising hits target (or early Progress start).
- **Platform fee** — default 7.5% of net profit on each declaration.
- **Manager share** — default 30% of distributable after Prism fee (cap 50%). Paid to the **project owner**, not the LM.

Current capital on a project = raised − raise fee − paid drawdowns.

---

## 5 · Sign-in

- **Investor portal** — `/sign-in` or invitation code at `/first-signin`.
- **Staff portal** — `/staff-sign-in` (CEO, LM, Owner).
- **Forgot password** — link on both portals → email → `/reset-password`.

---

## 6 · Line Manager highlights

- Wizard: Upload brief (AI extract) → Basics (units, fees) → Details (manager share, bank, frequency) → Review.
- Project tabs: Overview, Documents, Investors, Activity, Profits, Drawdowns, Withdrawals, Reconciliation, Audit, Ledger.
- Tasks: confirm payment, remnant waiver, inform owner when target reached.
- Earnings: Prism platform / raise fees.

---

## 7 · Project Owner highlights

- Dashboard of assigned projects only.
- Drawdowns with bank details + support docs.
- Propose profit to Prism (LM forwards to CEO).
- Earnings / withdrawals of manager share.

---

## 8 · Investor highlights

- Home: portfolio NAV, pending invite actions, live activity.
- Payment tab: units or ₦ pledge, `PRSM-…-INV###` reference, proof upload.
- Statements + PDF download.
- Withdraw realised profit (from notices), approved by Prism.

---

## 9 · CEO highlights

- Dashboard KPIs, trial-balance CSV, ledger integrity / backfill.
- Approvals: Declarations | Projects.
- Users: filter Investors / LMs / Owners / CEO; Create = Line Manager only.
- Messages: oversight inbox across project threads.

---

## 10 · Ops notes

- Invite emails via Resend; LM always gets the 8-char code inline if email fails.
- Password-reset emails use Supabase Auth (configure redirect URL for `/reset-password`).

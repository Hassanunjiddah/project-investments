# Prism Capital — Technical Reference

> Living doc. Last updated: 2026-09-01.

---

## 1 · Stack

| Layer | Tech |
|---|---|
| Frontend | Expo SDK 54, React 19, expo-router (file-based), TypeScript |
| State | Zustand (auth/ui), TanStack Query (server state; ~15s polling on money queries) |
| Styling | Design tokens (`src/constants/colors.ts`, typography, spacing) — navy Prism palette |
| Backend | Supabase (Postgres 15 + Auth + Storage + Edge Functions + RLS) |
| Email | Resend (invites / notify); Supabase Auth SMTP for password recovery |
| PDF | jsPDF (client-side statements) |
| Deploy | Netlify (SPA) + Supabase managed |

---

## 2 · Roles

| Role | Portal | Home | Notes |
|---|---|---|---|
| **CEO** | Staff | `/dashboard` | Approves projects + profit declarations (four-eyes). Creates Line Managers. Sees all Messages (oversight). |
| **ADMIN** | Staff | `/dashboard` | Same visibility as CEO on dashboard / approvals / ledger. **Cannot** create users. |
| **LINE_MANAGER** | Staff | `/home` | Prism operator: create projects, invite investors, confirm proofs, mediate owner↔investors, forward profit proposals, decide drawdowns/withdrawals. Earnings = platform / raise fees. |
| **PROJECT_OWNER** | Staff | `/home` | Originator assigned to a project. Drawdowns, propose profit to LM, withdraw manager share. No investor list / ledger / audit. |
| **INVESTOR** | Investor | `/home` | Invite-only. Pledge units → pay → proof → statements + profit withdrawals. |

Auth portals: `/(auth)/sign-in` (investors) and `/(auth)/staff-sign-in` (everyone else). Wrong-role logins are rejected.

Messaging is mediated: investor↔LM and owner↔LM only. CEO joins existing project threads; does not start a public DM directory.

---

## 3 · Environment

`.env` (frontend):

```
EXPO_PUBLIC_SUPABASE_URL=…
EXPO_PUBLIC_SUPABASE_ANON_KEY=…
EXPO_PUBLIC_SITE_URL=https://ribhshare.com   # optional; default in site.ts
```

Edge-function secrets (Supabase Dashboard):

- `RESEND_API_KEY`, `SENDER_EMAIL`, `APP_URL`
- `NOTIFY_WEBHOOK_SECRET` (+ DB `app.notify_url` / `app.notify_secret` for `notify-investors`)
- `EMERGENT_LLM_KEY` or `GEMINI_API_KEY` (brief extraction)

Auth redirect URLs must include `https://<deploy-origin>/reset-password` for forgot-password.

---

## 4 · Capital & fees

```
raised_minor     = cumulative confirmed investments (never shrinks)
raise_fee_minor  = reserved at target hit (default raise_fee_bps = 250 = 2.5%)
drawn_minor      = paid owner remittances
current capital  = raised − raise_fee − drawn

platform_fee_bps = Prism cut of net profit on declarations (default 750 = 7.5%)
profit_split_investor_bps = investor pool of distributable (default 7000 = 70%;
                            manager share = remainder → project owner)
```

Stages: `INITIATION` → `ACCEPTANCE` → `PROGRESS` → `END`.

---

## 5 · Core tables (high level)

- `projects` — unit model, fees, `project_owner_id`, `drawn_minor`, `raise_fee_*`, `profit_declaration_frequency`
- `invites` — status pipeline + units / payment reference / proof
- `profit_declarations` — PROPOSED → PENDING → APPROVED/REJECTED; waterfall columns
- `distribution_notices` — immutable per (declaration × confirmed investor)
- `fund_drawdowns` — owner remittance requests
- `withdrawal_requests` — `kind` INVESTOR | OWNER
- `ledger_entries` — append-only DR/CR with balance trigger
- `audit_events`, `notifications`, `tasks`, `message_threads` / `messages`

---

## 6 · Edge functions

| Function | JWT | Purpose |
|---|---|---|
| `create-project` | ON | Create project + validate units |
| `submit-project` | ON | Submit for CEO review |
| `approve-project` | ON | CEO approve/reject |
| `send-invitation` | ON | Invite investor + code + Resend |
| `redeem-invite-code` | OFF | Public code → magiclink token |
| `get-invitation-detail` | ON | Invite teaser payload |
| `submit-payment-proof` | ON | Multipart proof upload |
| `confirm-invite-payment` | ON | LM confirms → CONFIRMED |
| `create-user` | ON | CEO creates Line Manager |
| `create-project-owner` | ON | Assign / resend owner |
| `extract-project-brief` | ON | Gemini brief → form fields |
| `notify-investors` | secret | Webhook emails from DB triggers |

---

## 7 · Key SPA routes

| Route | Who |
|---|---|
| `/(auth)/sign-in`, `/staff-sign-in` | Portals |
| `/(auth)/first-signin`, `/set-password` | Invite onboarding |
| `/(auth)/forgot-password`, `/reset-password` | Password recovery |
| `/(tabs)/home` | Investor / LM / Owner |
| `/(tabs)/dashboard` | CEO |
| `/(tabs)/projects`, `/projects/[id]`, `/create` | Staff + owner detail |
| `/(tabs)/portfolio`, `/portfolio/projects/[id]` | Investor |
| `/(tabs)/approvals`, `/users` | CEO |
| `/(tabs)/messages` | LM / Investor / Owner / CEO |
| `/(tabs)/statements`, `/earnings`, `/tasks`, `/notifications`, `/profile` | Role-gated |

Legacy `/projects/[id]/invest` redirects to `?tab=payment`. Explore remains mock-backed for now.

---

## 8 · Ops leftovers checklist

1. Verify Resend sender domain
2. Add Auth redirect URL for `/reset-password`
3. Confirm `NOTIFY_WEBHOOK_SECRET` + `app.notify_*` DB settings
4. Apply pending migrations: `supabase db push` (includes `20260901130000_ceo_message_oversight.sql`)
5. Redeploy `send-invitation` after email copy changes

---

## 9 · Repository layout

```
app/                 # expo-router routes
src/screens/         # role screens
src/components/      # UI + project tabs
src/services/        # Supabase clients / RPCs
src/hooks/           # TanStack Query
src/store/           # Zustand
supabase/migrations/ # schema source of truth
supabase/functions/  # Deno edge functions
docs/                # this folder
memory/PRD.md        # historical changelog + current product pointer
```

*See also: [USER_GUIDE.md](./USER_GUIDE.md), role docs, [email-notifications-deploy.md](./email-notifications-deploy.md).*

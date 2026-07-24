# Prism Capital — Technical Reference

---

## 1 · Stack

| Layer | Tech |
|---|---|
| Frontend | Expo SDK 54, React 19, expo-router (file-based), TypeScript |
| State | Zustand (auth/ui), TanStack Query (server state, 15s polling on profit queries) |
| Styling | Design tokens (`src/theme/`), Tailwind-grade primary `#166534`, dark mode |
| Backend | Supabase (Postgres 15 + Auth + Storage + Edge Functions) |
| Email | Resend |
| PDF | jsPDF (client-side statement generation) |
| Deploy | Netlify (frontend) + Supabase managed (backend) |

---

## 2 · Environment

`/app/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://jbwerfqgqavaxdyjxfra.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=…
```

Supabase edge-function secrets (set in Dashboard):
- `RESEND_API_KEY` — Resend API key
- `SENDER_EMAIL` — verified sender (e.g. `noreply@paynexhq.com`)
- `APP_URL` — production URL for magic-link redirect

---

## 3 · Data model

### 3.1 `projects`
| Column | Type | Note |
|---|---|---|
| id | uuid PK | |
| code | text | `PRJ-###` sequential |
| name, description | text | |
| target_minor | bigint | in kobo |
| raised_minor | bigint | trigger-maintained |
| realised_profit_minor | bigint | trigger-maintained |
| stage | text | `INITIATION` / `ACCEPTANCE` / `PROGRESS` / `END` |
| owner_id | uuid → profiles | LM |
| **total_units** ⭐ | int | P1 |
| **min_units_per_investor** ⭐ | int | P1 |
| **platform_fee_bps** ⭐ | int | P1, default 750 (7.5%) |
| **profit_split_investor_bps** | int | default 7000 (70%) |
| **pledge_expiry_hours** ⭐ | int | P1, default 72 |

### 3.2 `invites` (with P1 extensions)
| Column | Type | Note |
|---|---|---|
| id | uuid PK | |
| project_id | uuid → projects | |
| investor_id | uuid → profiles | |
| status | text | `INVITED` → `ACCEPTED` → `COMMITTED` → `PROOF_SUBMITTED` → `CONFIRMED` / `DECLINED` |
| amount_minor | bigint | derived: units × unit_price |
| **units_pledged** ⭐ | int | |
| **units_allotted** ⭐ | int | set on confirm |
| **payment_reference** ⭐ | text unique | `PRSM-<code>-INV###` |
| **pledged_at**, **pledge_expires_at** ⭐ | timestamptz | 72h expiry |
| **verified_at**, **verified_by** ⭐ | | trigger-set on confirm |
| **payment_claim_amount_minor / _bank / _date / _narration** ⭐ | | investor-declared |
| first_signin_code | text | 8-char alnum |
| first_signin_code_redeemed_at | timestamptz | |

### 3.3 `profit_declarations` ⭐ P2
```
id, project_id, reference (PRSM-CODE-DECL###), label, is_final,
gross_minor, costs_minor, net_minor,
prism_fee_minor, distributable_minor, investor_pool_minor,
manager_share_minor, per_unit_minor,
status (PENDING/APPROVED/REJECTED),
declared_by, declared_at,
approved_by, approved_at,
rejected_by, rejected_at, rejection_note
```
- RLS: LM/CEO on project + confirmed investors can read.
- Immutable post-approval.

### 3.4 `distribution_notices` ⭐ P3
```
id, declaration_id, invite_id, investor_id, project_id,
reference (PRSM-CODE-NOT###),
units_held, per_unit_minor, profit_minor,
capital_returned_minor,  -- > 0 only for FINAL
is_final,
created_at
```
- One row per (approved declaration × confirmed investor). Immutable.

### 3.5 `audit_events` ⭐ P3
```
id, project_id, actor_id, entity_type, entity_id,
event_type, payload jsonb, created_at
```
Trigger sources: `projects`, `invites`, `profit_declarations`.

### 3.6 `ledger_entries` ⭐ P4
```
id, transaction_ref, sequence,
project_id, account_code, party_id,
direction (DR/CR), amount_minor,
actor_id, ref_type, ref_id, memo, created_at
```
- Append-only. Statement-level trigger `enforce_ledger_balance` rejects any transaction where `sum(DR) ≠ sum(CR)` grouped by `transaction_ref`.
- Party-scoped RLS: investor sees own party rows; LM sees own projects; CEO sees all.

---

## 4 · Key RPCs

### P1 — units
- `pledge_units(invite_id uuid, units int)` — investor commits N units, sets `payment_reference` and 72h expiry.
- `expire_stale_pledges(project_id uuid)` — releases pledges past `pledge_expires_at`. Called on project-detail load.
- `project_units_committed(project_id uuid) → int` — helper for spectrum bar.

### P2 — profit declarations (maker–checker)
- `declare_profit(project, gross_minor, costs_minor, label, is_final) → declaration`
- `approve_profit_declaration(id) → declaration` — CEO only. Rejects self-approval. Mints notices + posts ledger. Bumps `realised_profit_minor`. If final: creates `investor_payouts` + sets stage=END.
- `reject_profit_declaration(id, note) → declaration`
- `list_pending_declarations() → declarations[]`

### P3 — transparency
- `list_investor_notices() → notices[]` — auth user's own notices with full declaration context.
- `list_project_audit(project, limit) → events[]`
- `project_reconciliation(project) → { summary, invites[] }` — expected vs claimed variance.

### P4 — ledger
- `post_ledger(ref, project, ref_type, ref_id, actor, lines jsonb) → void` — helper called by triggers.
- `list_project_ledger(project, limit) → { balances[], entries[] }`
- View `ledger_project_balances` — trial-balance rollup per (project × account_code).

### Legacy (still active, no longer surfaced in UI)
- `post_profit_update`, `end_project_now`, `get_manager_profit_summary`, `get_investor_profit_summary`.

---

## 5 · Edge functions (`supabase/functions/`)

| Function | JWT | Purpose |
|---|---|---|
| `create-project` | ON | Validates + creates project row + first `PROJECT_UPDATE` event. Enforces `target divisible by total_units`. |
| `send-invitation` | ON | LM/ADMIN only. Creates invite row, generates 8-char code, sends email via Resend or returns code inline. |
| `redeem-invite-code` | OFF | Public. Rate-limited (8/email + 30/IP per 10min). Returns magiclink tokenHash. |

---

## 6 · Auto-posting ledger triggers (P4)

### `ledger_on_invite_confirm`
Fires on `UPDATE invites SET status='CONFIRMED'`:
```
DR project_bank                       amount_minor
CR investor_capital [party=investor]  amount_minor
```

### `ledger_on_declaration_approve`
Fires on `UPDATE profit_declarations SET status='APPROVED'`:
```
DR project_realised_pnl               net_minor
CR platform_fee_payable               prism_fee_minor
CR manager_payable [party=LM]         manager_share_minor
CR investor_payable [party=inv_N]     units_N × per_unit_minor  (per investor)
CR rounding_reserve                   residue
```
If `is_final=true`, additionally:
```
DR investor_capital [party=inv_N]     invite.amount_minor       (per investor)
CR project_bank                       Σ amounts
```

Both triggers are idempotent — re-firing on the same event is a no-op.

---

## 7 · SPA routing (expo-router)

| Route | Screen |
|---|---|
| `/(auth)/sign-in` | Email + password login |
| `/(auth)/first-signin` | Invite code redemption |
| `/(auth)/set-password` | Password setup + role-aware redirect |
| `/(tabs)/home` | LM home |
| `/(tabs)/dashboard` | CEO dashboard |
| `/(tabs)/portfolio` | Investor portfolio |
| `/(tabs)/projects` | LM projects grid |
| `/(tabs)/projects/create` | 5-step wizard |
| `/(tabs)/projects/[id]` | Project detail (LM/CEO view) |
| `/(tabs)/portfolio/projects/[id]` | Project detail (investor view) |
| `/(tabs)/approvals` | CEO approvals (declarations + projects) |
| `/(tabs)/statements` | Investor statements + PDF download |
| `/(tabs)/earnings` | LM earnings across projects |
| `/(tabs)/invitations/[id]` | Investor invite review |
| `/(tabs)/profile` | Theme + account |

---

## 8 · SPA deploy — Netlify

Build:
```
yarn build:web    →    /app/dist/
```

`_redirects` in `dist/`:
```
/*    /index.html   200
```

Env vars needed in Netlify → Environment:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Build cmd: `yarn build:web`  
Publish dir: `dist`

---

## 9 · Repository layout

```
/app
├── app/                       # expo-router routes
├── src/
│   ├── screens/               # Screen components by role
│   ├── components/projects/   # Project-detail tabs (Ledger, Audit, Profits, Reconciliation, Spectrum)
│   ├── services/              # Supabase clients (RPC wrappers)
│   ├── hooks/                 # TanStack Query hooks by domain
│   ├── stores/                # Zustand (useAuthStore, useUiStore)
│   ├── theme/                 # Design tokens
│   └── utils/                 # pdfStatement.ts, currency, etc.
├── supabase/
│   ├── functions/             # Deno edge functions
│   └── migrations/            # Applied in order 202506… → 20260128000000_p4_ledger.sql
├── docs/                      # User + technical docs (this folder)
└── memory/PRD.md              # Living product-requirements doc
```

---

*Last updated: 2026-07-24.*

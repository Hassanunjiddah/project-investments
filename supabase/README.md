# RibhShare Supabase Schema

Core database schema for the RibhShare mobile app: **profiles**, **projects**, **invites**, **project_docs**, edge functions, and investor access gating.

## Migrations

Run in order via Supabase SQL Editor or CLI:

| File | Contents |
|---|---|
| `migrations/20250612100000_enums_and_tables.sql` | Postgres enums, tables, indexes |
| `migrations/20250612100001_functions_and_triggers.sql` | Helper functions, triggers |
| `migrations/20250612100002_rls_policies.sql` | Row Level Security policies |
| `migrations/20250612120000_projects_extended.sql` | Extended project fields, `project_docs`, storage |
| `migrations/20250613120000_edge_functions_and_investor_gating.sql` | Payment proofs, investor gating, RPCs |

### Supabase CLI

```bash
cd RibhShare
supabase link --project-ref <your-project-ref>
supabase db push
```

## Edge Functions

Deploy all functions after linking:

```bash
supabase functions deploy create-project
supabase functions deploy approve-project
supabase functions deploy send-invitation
supabase functions deploy get-invitation-detail
supabase functions deploy submit-payment-proof
supabase functions deploy create-user
```

| Function | Auth | Purpose |
|---|---|---|
| `create-project` | LINE_MANAGER, ADMIN | Create project with required escrow bank details |
| `approve-project` | CEO, ADMIN | Approve or reject pending projects |
| `send-invitation` | LINE_MANAGER (owner), ADMIN | Invite investor to approved project |
| `get-invitation-detail` | Investor (owner), manager, CEO/Admin | Gated invitation + project payload |
| `submit-payment-proof` | Investor (COMMITTED) | Upload PDF/image proof to `payment-proofs` bucket |
| `create-user` | ADMIN | Create line manager or investor with generated password |

## Users tab (mobile app)

- **CEO + ADMIN** see the Users tab and can browse investors, line managers, and CEOs.
- **ADMIN only** can create new line managers and investors via the `create-user` edge function.
- The generated password (e.g. `river4821`) is shown once in the app with a copy button; it is not stored in the database.

## Auth users

New users can be created from the app (Admin → Users → Create) or manually in Supabase Dashboard.

For manual creation, set **User Metadata**:

```json
{
  "full_name": "Aisha (CEO)",
  "role": "CEO"
}
```

Valid `role` values: `CEO`, `ADMIN`, `LINE_MANAGER`, `INVESTOR`.

## Investor access model

| Invite status | Investor sees |
|---|---|
| `INVITED` | Teaser: name, sector, summary, risks, target, projected profit |
| `ACCEPTED` | + full details, timeline, document summary (no file download) |
| `COMMITTED` | + escrow bank details; can upload payment proof |
| `PROOF_SUBMITTED`+ | Proof status; manager can view proof file |

Bank details (`pay_account`) are collected at **project creation** and shown to investors only after they **commit** payment.

## Regenerate TypeScript types

```bash
supabase gen types typescript --linked > src/types/supabase.types.ts
```

## Environment

Set in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Edge functions receive `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically when deployed.

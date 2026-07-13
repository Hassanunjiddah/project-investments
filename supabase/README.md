# RibhShare Supabase Schema

Fresh baseline schema for **project creation**: profiles, projects, project_docs, tasks, storage buckets, RLS, and RPCs.

## Migration

Single baseline file:

| File | Contents |
|---|---|
| `migrations/20250706000000_baseline_project_creation.sql` | Enums, tables, triggers, RLS, storage, `submit_project_for_review` + `decide_project_approval` RPCs |

### Supabase CLI

```bash
cd RibhShare
supabase link --project-ref <your-project-ref>
supabase db reset   # fresh DB + seed.sql
# or
supabase db push
```

## Edge Functions (project creation phase)

```bash
supabase functions deploy create-project
supabase functions deploy submit-project
supabase functions deploy approve-project
```

| Function | Auth | Purpose |
|---|---|---|
| `create-project` | LINE_MANAGER, CEO, ADMIN | Insert project row (CEO/Admin auto-approved) |
| `submit-project` | LINE_MANAGER, CEO, ADMIN | Validate banner + 4 docs, queue CEO review task |
| `approve-project` | CEO, ADMIN | Approve/reject via `decide_project_approval` RPC |

Legacy invite functions (`send-invitation`, etc.) remain in repo but require the invites table from a future migration.

## Create flow

1. **create-project** — inserts draft project (`submitted_at` null for line managers)
2. Client uploads **banner** → `project-banners` bucket
3. Client uploads **4 required docs** → `project-documents` bucket
4. **submit-project** — sets `submitted_at`, creates `REVIEW_PROJECT` task
5. **approve-project** — CEO approves/rejects, completes task, sets `approved_by` / `rejected_by`

## Regenerate TypeScript types

```bash
supabase gen types typescript --linked > src/types/supabase.types.ts
```

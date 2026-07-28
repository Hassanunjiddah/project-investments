# Email Notifications — Deployment Checklist

Two components must be deployed manually via the Supabase Dashboard:

## 1. Edge Function: `notify-investors`

File: `supabase/functions/notify-investors/index.ts`

**Env vars** (Project Settings → Edge Functions → Secrets):
| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | (already set) |
| `SENDER_EMAIL` | (already set — e.g. `updates@ribhshare.com`) |
| `APP_URL` | Public app origin, e.g. `https://156f16db-1140-4b8c-a0ef-83ceaa005c45.preview.emergentagent.com` |
| `NOTIFY_WEBHOOK_SECRET` | **NEW** — generate a random 32+ char string (e.g. `openssl rand -hex 32`). Save the value; you'll need it in step 2. |

Deploy: paste `index.ts` in the dashboard → Deploy.

## 2. SQL Migration

File: `supabase/migrations/20260728300000_email_notifications.sql`

Run it in the SQL Editor. Then run these two `ALTER DATABASE` statements (replace the placeholders with real values):

```sql
alter database postgres
  set "app.notify_url" = 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/notify-investors';

alter database postgres
  set "app.notify_secret" = '<same value as NOTIFY_WEBHOOK_SECRET secret>';
```

Then reload the settings for existing sessions:
```sql
select pg_reload_conf();
```

(Or wait a minute — the settings apply to new sessions automatically.)

## Verifying

1. Post a project update as a Line Manager → the confirmed investors should receive
   an email titled *"Milestone: <title> · <project>"* within a few seconds.
2. As CEO/Admin, approve a `PENDING` profit declaration → investors receive a
   *"Interim/Final distribution: <label> · <project>"* email with per-unit payout
   and their personalised share.

Failures are silent from the app's side (the trigger is fire-and-forget) but
you can inspect them:
```sql
select * from net._http_response order by created desc limit 10;
```

## Rolling Back

```sql
drop trigger if exists project_updates_notify           on public.project_updates;
drop trigger if exists profit_declarations_notify_approved on public.profit_declarations;
drop function if exists public.trg_notify_project_update();
drop function if exists public.trg_notify_declaration_approved();
drop function if exists public.notify_investors_via_edge(text, uuid);
```

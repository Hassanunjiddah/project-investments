# Test credentials — Prism Capital (sandbox)

> Sandbox / linked Supabase project only. Do not reuse these passwords in production.

## Supabase project
- URL: `https://jbwerfqgqavaxdyjxfra.supabase.co`
- Anon key: stored in `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Login accounts (all password `Test@123`)
| Role         | Email                              | Notes                                    |
|--------------|------------------------------------|------------------------------------------|
| Line Manager | linemanager@ribhshare.com          | Creates projects, invites investors      |
| CEO          | ceo@ribhshare.com                  | Approves projects, creates line managers |
| Investor     | investor@ribhshare.com             | Receives invites, funds projects         |
| Project Owner| *(none seeded)*                    | Assign via LM “Assign owner” on a project; add email here once created |

## Ops leftovers (checklist)
1. Auth redirect URL: `https://<deploy-origin>/reset-password`
2. Resend domain / `SENDER_EMAIL` for invite mail
3. `NOTIFY_WEBHOOK_SECRET` (+ DB `app.notify_*`) for `notify-investors`
4. Pending migrations: `supabase db push` (CEO message oversight)
5. Redeploy `send-invitation` after email copy changes

## Clean slate (2026-07-29)
All projects and non-core accounts were wiped. Start fresh by signing in as
the Line Manager → create a project → CEO approves → invite the investor.

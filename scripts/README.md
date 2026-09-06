Manual / dangerous SQL — never place wipe or backfill scripts in
`supabase/migrations/`. Files here are run by hand in the SQL editor,
one section at a time.

- `backfill_units.sql` — convert legacy projects to the unit model
- `cleanup_pre_p1.sql` — destructive pre-P1 cleanup (do not run in prod)

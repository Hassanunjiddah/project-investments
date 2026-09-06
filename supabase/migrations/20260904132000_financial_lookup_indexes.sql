-- Hot-path indexes for withdrawal checks and unindexed FKs (2026-09-04 audit).

create index if not exists distribution_notices_invite_id_idx
  on public.distribution_notices (invite_id);

create index if not exists distribution_notices_invite_id_idx
  on public.distribution_notices (invite_id);

create index if not exists withdrawal_requests_invite_id_idx
  on public.withdrawal_requests (invite_id);

create index if not exists ledger_entries_party_account_idx
  on public.ledger_entries (party_id, account_code);

create index if not exists invites_verified_by_idx
  on public.invites (verified_by);

create index if not exists tasks_completed_by_idx
  on public.tasks (completed_by);

create index if not exists messages_sender_id_idx
  on public.messages (sender_id);

create index if not exists document_requests_fulfilled_doc_id_idx
  on public.document_requests (fulfilled_doc_id);

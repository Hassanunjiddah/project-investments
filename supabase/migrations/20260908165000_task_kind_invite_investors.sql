-- New task kind + notification type for "what to do next" prompts.
-- Kept separate from the functions that use them: a new enum value cannot be
-- referenced inside the same transaction that adds it.

alter type public.task_kind add value if not exists 'INVITE_INVESTORS';

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'ACTIVITY_POST',
    'DECLARATION_SUBMITTED',
    'DECLARATION_APPROVED',
    'DECLARATION_REJECTED',
    'PROJECT_SUBMITTED',
    'PROJECT_APPROVED',
    'PROJECT_REJECTED',
    'NEW_MESSAGE',
    'PROOF_SUBMITTED',
    'TARGET_REACHED',
    'DRAWDOWN_REQUESTED',
    'DRAWDOWN_DECIDED',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_DECIDED',
    'PROFIT_PROPOSED',
    'DOC_REQUESTED',
    'DOC_FULFILLED',
    'INVITE_RECEIVED',
    'PAYMENT_CONFIRMED'
  ));

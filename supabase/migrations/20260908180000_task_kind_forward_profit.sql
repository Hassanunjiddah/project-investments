-- ---------------------------------------------------------------------------
-- New task kind for the owner→LM profit mediation step. Added in its own
-- migration because an enum value cannot be used in the same transaction
-- that creates it (the follow-up migration wires the triggers).
-- ---------------------------------------------------------------------------

alter type public.task_kind add value if not exists 'FORWARD_PROFIT_PROPOSAL';

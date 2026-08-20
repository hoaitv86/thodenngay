alter table public.payments
  add column if not exists idempotency_key text;

create unique index if not exists payments_receivable_idempotency_key_idx
  on public.payments (receivable_id, idempotency_key)
  where idempotency_key is not null;

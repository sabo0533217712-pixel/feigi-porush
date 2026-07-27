-- IVR call session state — tracks a phone call's progress through the voice menu
-- between webhook requests (ימות המשיח calls our webhook once per step, statelessly).
-- Only touched by the ivr-api edge function (service role) — no client-side access needed.
create table public.ivr_calls (
  call_id text primary key,
  phone text,
  step text not null default 'menu',
  context jsonb not null default '{}'::jsonb,
  expected_input_param text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ivr_calls enable row level security;

create index if not exists idx_ivr_calls_updated_at on public.ivr_calls (updated_at);

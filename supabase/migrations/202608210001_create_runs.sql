create table public.runs (
  id uuid primary key default gen_random_uuid(),
  call_type text not null check (call_type in ('kickoff', 'coaching')),
  transcript text not null check (char_length(transcript) between 1 and 65000),
  client_hash text not null check (client_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  result_json jsonb,
  public_error text check (
    public_error is null or char_length(public_error) between 1 and 300
  ),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint runs_status_data_check check (
    (status = 'queued'
      and result_json is null
      and public_error is null
      and started_at is null
      and finished_at is null)
    or
    (status = 'processing'
      and result_json is null
      and public_error is null
      and started_at is not null
      and finished_at is null)
    or
    (status = 'completed'
      and result_json is not null
      and public_error is null
      and started_at is not null
      and finished_at is not null)
    or
    (status = 'failed'
      and result_json is null
      and public_error is not null
      and finished_at is not null)
  )
);

create index runs_client_hash_created_at_idx
  on public.runs (client_hash, created_at desc);

create function public.maintain_run_status_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'queued' and new.status in ('processing', 'failed'))
    or (old.status = 'processing' and new.status in ('completed', 'failed'))
  ) then
    raise exception 'invalid run status transition';
  end if;

  if new.status = 'processing' then
    new.started_at = now();
  elsif new.status in ('completed', 'failed') then
    new.finished_at = now();
  end if;

  return new;
end;
$$;

create trigger maintain_run_status_timestamps
before update of status on public.runs
for each row execute function public.maintain_run_status_timestamps();

alter table public.runs enable row level security;

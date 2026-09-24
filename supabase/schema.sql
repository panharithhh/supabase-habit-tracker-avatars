-- Habit tracker schema.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- The browser talks to Postgres directly with a public key, so Row Level
-- Security is the only thing that keeps one user's rows away from another.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.habits (
  id         uuid primary key default gen_random_uuid(),
  -- Defaults to the signed-in user, so the client never sends user_id.
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  -- on delete cascade: deleting a habit deletes its logs.
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The client sends its local date; the default is only a fallback (UTC).
  done_on    date not null default current_date,
  created_at timestamptz not null default now(),
  -- One check-in per habit per day. Also serves as the habit_id index.
  unique (habit_id, done_on)
);

create index habits_user_id_idx     on public.habits (user_id);
create index habit_logs_user_id_idx on public.habit_logs (user_id);

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only. Anonymous requests get "permission denied".
-- ---------------------------------------------------------------------------

revoke all on public.habits, public.habit_logs from anon;
grant select, insert, update, delete on public.habits, public.habit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: the two policies
-- ---------------------------------------------------------------------------

alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

-- using      → which existing rows you can see, update, delete
-- with check → which rows you are allowed to write
-- (select auth.uid()) is evaluated once per query instead of once per row.

create policy "Users manage their own habits"
  on public.habits
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own habit logs"
  on public.habit_logs
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    -- and you can only log against a habit you own
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = (select auth.uid())
    )
  );

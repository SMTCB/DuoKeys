-- DuoKeys sync schema — TA-SYN-001..005, TA-DAT-002/004/007.
--
-- IndexedDB is the truth (ADR-003); this is the additive copy. One Supabase
-- user (the adult) owns every profile in the household (TA-SYN-002), so every
-- table carries owner_id and is locked to it by RLS (TA-SYN-005).
--
-- Conflict policy (TA-SYN-003):
--   attempts                      append-only: insert, never update or delete
--   profiles / library / settings last-write-wins on updated_at_ms
--   progression                   derived from attempts, never synced
--
-- Privacy (NFR-010): first names only, no child email, no analytics, no audio.
-- Nothing in here stores an email or audio; auth.users holds only the adult's.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Server-side cursor for pull(): bumped on every accepted write so a fresh
-- device can ask "everything since X" without trusting client clocks.
create or replace function public.touch_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at := now();
  return new;
end $$;

-- Last-write-wins (TA-SYN-003): an older client write is silently skipped, not
-- an error — a stale outbox flush must never fail or roll back a newer edit.
create or replace function public.skip_stale_write() returns trigger
language plpgsql as $$
begin
  if new.updated_at_ms < old.updated_at_ms then
    return null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (TA-DAT-004)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key,                      -- client-generated
  owner_id          uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(display_name) between 1 and 24),
  role              text not null check (role in ('explorer', 'student')),
  keyboard_low      smallint not null default 21  check (keyboard_low  between 0 and 127),
  keyboard_high     smallint not null default 108 check (keyboard_high between 0 and 127),
  latency_offset_ms real not null default 0,
  tolerance_scale   real not null default 1 check (tolerance_scale > 0),
  midi_input_id     text,
  avatar            text not null,
  updated_at_ms     bigint not null,
  synced_at         timestamptz not null default now(),
  check (keyboard_low <= keyboard_high)
);

create index profiles_owner_synced_idx on public.profiles (owner_id, synced_at);

-- ---------------------------------------------------------------------------
-- attempts (TA-DAT-002) — append-only, the bulk of the data
-- ---------------------------------------------------------------------------

create table public.attempts (
  id             uuid primary key,                         -- client-generated
  owner_id       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  arrangement_id text not null,
  section_id     text,
  started_at     timestamptz not null,
  duration_ms    integer not null check (duration_ms >= 0),
  mode           text not null check (mode in ('wait', 'timed')),
  tempo_scale    real not null check (tempo_scale > 0),
  grade          jsonb not null,
  events         jsonb not null,                           -- embedded NoteResult[]
  app_version    text not null,
  synced_at      timestamptz not null default now()
);

create index attempts_owner_synced_idx on public.attempts (owner_id, synced_at);
create index attempts_profile_started_idx on public.attempts (profile_id, started_at);
create index attempts_arrangement_idx on public.attempts (arrangement_id);

-- ---------------------------------------------------------------------------
-- library (TA-DAT-007)
-- ---------------------------------------------------------------------------

create table public.library (
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  arrangement_id text not null,
  owner_id       uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  status         text not null check (status in ('wantToLearn', 'learning', 'learned')),
  added_at_ms    bigint not null,
  updated_at_ms  bigint not null,
  synced_at      timestamptz not null default now(),
  primary key (profile_id, arrangement_id)
);

create index library_owner_synced_idx on public.library (owner_id, synced_at);

-- ---------------------------------------------------------------------------
-- settings (TA-DAT-003) — one row per profile, opaque to the server
-- ---------------------------------------------------------------------------

create table public.settings (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  owner_id      uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  data          jsonb not null,
  updated_at_ms bigint not null,
  synced_at     timestamptz not null default now()
);

create index settings_owner_synced_idx on public.settings (owner_id, synced_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- BEFORE triggers fire alphabetically: skip_stale runs first (a skipped write
-- never reaches touch_synced_at), so a rejected stale write leaves the cursor
-- untouched.
create trigger a_profiles_skip_stale before update on public.profiles
  for each row execute function public.skip_stale_write();
create trigger b_profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_synced_at();

create trigger a_library_skip_stale before update on public.library
  for each row execute function public.skip_stale_write();
create trigger b_library_touch before insert or update on public.library
  for each row execute function public.touch_synced_at();

create trigger a_settings_skip_stale before update on public.settings
  for each row execute function public.skip_stale_write();
create trigger b_settings_touch before insert or update on public.settings
  for each row execute function public.touch_synced_at();

create trigger a_attempts_touch before insert on public.attempts
  for each row execute function public.touch_synced_at();

-- ---------------------------------------------------------------------------
-- Row-level security (TA-SYN-005) — every table, no exceptions (TS-I-SYN-004)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.library  enable row level security;
alter table public.settings enable row level security;

-- Nothing is reachable without a signed-in adult.
revoke all on public.profiles, public.attempts, public.library, public.settings from anon;
revoke all on public.profiles, public.attempts, public.library, public.settings from authenticated;

-- profiles: owner reads, inserts, updates, deletes their own household.
grant select, insert, update, delete on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (owner_id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated
  using (owner_id = (select auth.uid()));

-- attempts: select + insert ONLY. No UPDATE or DELETE grant and no policy —
-- attempts are immutable (CLAUDE.md § 2.8, TA-DAT-002). Removing a profile
-- still cascades, because FK actions run as the table owner.
grant select, insert on public.attempts to authenticated;
create policy attempts_select on public.attempts for select to authenticated
  using (owner_id = (select auth.uid()));
create policy attempts_insert on public.attempts for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.owner_id = (select auth.uid())
    )
  );

-- library: last-write-wins; delete is how a status is cleared (TA-DAT-007).
grant select, insert, update, delete on public.library to authenticated;
create policy library_select on public.library for select to authenticated
  using (owner_id = (select auth.uid()));
create policy library_insert on public.library for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.owner_id = (select auth.uid())
    )
  );
create policy library_update on public.library for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy library_delete on public.library for delete to authenticated
  using (owner_id = (select auth.uid()));

-- settings
grant select, insert, update, delete on public.settings to authenticated;
create policy settings_select on public.settings for select to authenticated
  using (owner_id = (select auth.uid()));
create policy settings_insert on public.settings for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.owner_id = (select auth.uid())
    )
  );
create policy settings_update on public.settings for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy settings_delete on public.settings for delete to authenticated
  using (owner_id = (select auth.uid()));

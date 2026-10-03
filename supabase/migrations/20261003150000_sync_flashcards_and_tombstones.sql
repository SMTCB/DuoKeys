-- DuoKeys sync, part 2 (TA-SYN-003, TA-SYN-007).
--
-- 1. library gets a tombstone. A pull returns rows changed since a cursor, and
--    a hard-deleted row is simply absent, so a cleared library entry could never
--    reach another device. Clearing is now an UPDATE that sets deleted = true
--    (last-write-wins like any other edit); a later re-add upserts deleted = false.
-- 2. flashcards (Note Ninja's spaced-repetition pool, TA-DAT-006) get a table.
--    Policy: last-write-wins on updated_at_ms, stamped from the outbox write time
--    because a Flashcard carries no timestamp of its own.

alter table public.library add column deleted boolean not null default false;

create table public.flashcards (
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  card_id       text not null,
  owner_id      uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  pitch         smallint not null check (pitch between 0 and 127),
  box           smallint not null check (box between 1 and 5),
  due_at_ms     bigint not null,
  updated_at_ms bigint not null,
  synced_at     timestamptz not null default now(),
  primary key (profile_id, card_id)
);

create index flashcards_owner_synced_idx on public.flashcards (owner_id, synced_at);

create trigger a_flashcards_skip_stale before update on public.flashcards
  for each row execute function public.skip_stale_write();
create trigger b_flashcards_touch before insert or update on public.flashcards
  for each row execute function public.touch_synced_at();

alter table public.flashcards enable row level security;
revoke all on public.flashcards from anon;
revoke all on public.flashcards from authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;

create policy flashcards_select on public.flashcards for select to authenticated
  using (owner_id = (select auth.uid()));
create policy flashcards_insert on public.flashcards for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.owner_id = (select auth.uid())
    )
  );
create policy flashcards_update on public.flashcards for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy flashcards_delete on public.flashcards for delete to authenticated
  using (owner_id = (select auth.uid()));

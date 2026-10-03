-- TS-I-SYN-004 — row-level security, exercised as two different authenticated
-- users against the real schema. Everything runs in one transaction that is
-- rolled back at the end, so no user, profile or attempt is ever persisted.
--
-- Run:  npx supabase db query --linked -f supabase/tests/rls.sql
-- Any failed expectation raises an exception, which aborts the run non-zero.

begin;

-- Two throwaway users (rolled back). Inserting straight into auth.users skips
-- the sign-in flow; only the ids matter to RLS.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.invalid'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.invalid');

create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.expect_eq(label text, actual bigint, expected bigint) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL %: expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok   %', label;
end $$;

-- Run a statement and require that it is refused (permission or RLS), not silently ignored.
create or replace function pg_temp.expect_refused(label text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when insufficient_privilege or check_violation then
    raise notice 'ok   % (refused)', label;
    return;
  end;
  raise exception 'FAIL %: statement was allowed', label;
end $$;

-- ---------------------------------------------------------------------------
-- User A writes a household.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

insert into public.profiles (id, display_name, role, avatar, updated_at_ms)
values ('10000000-0000-0000-0000-000000000001', 'Mia', 'explorer', 'piano', 1000);

insert into public.attempts (id, profile_id, arrangement_id, started_at, duration_ms, mode, tempo_scale, grade, events, app_version)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'mary-d1', now(), 4200, 'wait', 1, '{}'::jsonb, '[]'::jsonb, '0.1.0');

insert into public.library (profile_id, arrangement_id, status, added_at_ms, updated_at_ms)
values ('10000000-0000-0000-0000-000000000001', 'mary-d1', 'learning', 1000, 1000);

insert into public.settings (profile_id, data, updated_at_ms)
values ('10000000-0000-0000-0000-000000000001', '{"theme":"dark"}'::jsonb, 1000);

select pg_temp.expect_eq('A sees own profile', (select count(*) from public.profiles), 1);
select pg_temp.expect_eq('A sees own attempt', (select count(*) from public.attempts), 1);

-- ---------------------------------------------------------------------------
-- User B cannot see or touch A's rows.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');

select pg_temp.expect_eq('B sees no profiles', (select count(*) from public.profiles), 0);
select pg_temp.expect_eq('B sees no attempts', (select count(*) from public.attempts), 0);
select pg_temp.expect_eq('B sees no library', (select count(*) from public.library), 0);
select pg_temp.expect_eq('B sees no settings', (select count(*) from public.settings), 0);

-- B cannot attach an attempt to A's profile (child-row owner check).
select pg_temp.expect_refused('B cannot insert an attempt under A''s profile', $$
  insert into public.attempts (id, profile_id, arrangement_id, started_at, duration_ms, mode, tempo_scale, grade, events, app_version)
  values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'x', now(), 1, 'wait', 1, '{}'::jsonb, '[]'::jsonb, '0')
$$);

-- B cannot claim A's rows by writing them with B as owner or A as owner.
select pg_temp.expect_refused('B cannot insert a profile owned by A', $$
  insert into public.profiles (id, owner_id, display_name, role, avatar, updated_at_ms)
  values ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000a1', 'X', 'explorer', 'a', 1)
$$);

-- B's update/delete of A's rows match zero rows rather than erroring; A's data must survive.
update public.profiles set display_name = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
delete from public.profiles where id = '10000000-0000-0000-0000-000000000001';
delete from public.library where profile_id = '10000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Back as A: nothing changed, and attempts are immutable even for the owner.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');

select pg_temp.expect_eq('A profile survived B''s update/delete',
  (select count(*) from public.profiles where display_name = 'Mia'), 1);
select pg_temp.expect_eq('A library survived B''s delete', (select count(*) from public.library), 1);

select pg_temp.expect_refused('A cannot update an attempt (append-only)',
  $$update public.attempts set duration_ms = 1 where id = '20000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_refused('A cannot delete an attempt (append-only)',
  $$delete from public.attempts where id = '20000000-0000-0000-0000-000000000001'$$);

-- Last-write-wins: an older write is skipped, a newer one lands.
update public.profiles set display_name = 'Stale', updated_at_ms = 500 where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.expect_eq('stale write skipped', (select count(*) from public.profiles where display_name = 'Mia'), 1);
update public.profiles set display_name = 'Fresh', updated_at_ms = 2000 where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.expect_eq('newer write applied', (select count(*) from public.profiles where display_name = 'Fresh'), 1);

-- ---------------------------------------------------------------------------
-- Signed-out (anon) sees nothing and writes nothing.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select set_config('role', 'anon', true);
select pg_temp.expect_refused('anon cannot read profiles', 'select count(*) from public.profiles');
select pg_temp.expect_refused('anon cannot read attempts', 'select count(*) from public.attempts');

rollback;

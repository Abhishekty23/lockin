-- LockIn Day 11: admin panel.
-- Admins see counts and summaries. Journal text stays private (journal_entries has no admin access).
-- Every admin action goes through a checked function and is written to admin_audit.

/* ---------- Suspension, enforced by the database ---------- */
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspended_reason text check (char_length(suspended_reason) <= 300);
-- Not added to the user's update grants: people can't unsuspend themselves.

create or replace function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = (select auth.uid()) and suspended_at is not null);
$$;
revoke all on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

-- A restrictive policy is ANDed with the others: a suspended account can't read or write its data.
do $$
declare t text;
begin
  foreach t in array array['day_logs', 'focus_sessions', 'habits', 'habit_checks', 'goals', 'milestones', 'tasks',
                           'timetable_blocks', 'weekly_plans', 'journal_entries', 'friendships', 'cheers', 'alert_events']
  loop
    execute format('drop policy if exists "active accounts only" on public.%I', t);
    execute format('create policy "active accounts only" on public.%I as restrictive for all to authenticated
                    using (not (select public.is_suspended())) with check (not (select public.is_suspended()))', t);
  end loop;
end $$;
drop policy if exists "profiles: active accounts edit" on public.profiles;
create policy "profiles: active accounts edit" on public.profiles as restrictive for update to authenticated
  using (not (select public.is_suspended()));

/* ---------- Audit log ---------- */
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_id uuid references public.profiles (id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
drop policy if exists "audit: admins read" on public.admin_audit;
create policy "audit: admins read" on public.admin_audit for select to authenticated using ((select public.is_admin()));
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

/* ---------- Announcements (shown to everyone signed in) ---------- */
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 300),
  tone text not null default 'info' check (tone in ('info', 'success', 'warning')),
  active boolean not null default true,
  ends_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements: read live" on public.announcements;
create policy "announcements: read live" on public.announcements for select to authenticated
  using ((active and (ends_at is null or ends_at > now())) or (select public.is_admin()));
drop policy if exists "announcements: admins write" on public.announcements;
create policy "announcements: admins write" on public.announcements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.announcements from anon, authenticated;
grant select, insert, update, delete on public.announcements to authenticated;

/* ---------- Feedback from people using the app ---------- */
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'idea' check (kind in ('idea', 'bug', 'love', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  page text check (char_length(page) <= 120),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists feedback_status on public.feedback (status, created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "feedback: send own" on public.feedback;
create policy "feedback: send own" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid())
              and (select count(*) from public.feedback f where f.user_id = (select auth.uid()) and f.created_at > now() - interval '1 day') < 10);
drop policy if exists "feedback: read own or admin" on public.feedback;
create policy "feedback: read own or admin" on public.feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "feedback: admins resolve" on public.feedback;
create policy "feedback: admins resolve" on public.feedback for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (kind, message, page) on public.feedback to authenticated;
grant update (status, resolved_at) on public.feedback to authenticated;

/* ---------- Admin read functions ---------- */
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'new_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'onboarded', (select count(*) from profiles where onboarded),
    'admins', (select count(*) from profiles where role = 'admin'),
    'suspended', (select count(*) from profiles where suspended_at is not null),
    'active_today', (select count(distinct user_id) from day_logs where day = (now() at time zone 'Asia/Kolkata')::date and score > 0),
    'active_7d', (select count(distinct user_id) from day_logs where day > (now() at time zone 'Asia/Kolkata')::date - 7 and score > 0),
    'focus_minutes', (select coalesce(sum(focus_minutes), 0) from day_logs),
    'sessions', (select count(*) from focus_sessions),
    'habits', (select count(*) from habits where archived_at is null),
    'habit_checks', (select count(*) from habit_checks),
    'tasks_done', (select count(*) from tasks where done_at is not null),
    'journal_entries', (select count(*) from journal_entries),
    'friendships', (select count(*) from friendships where status = 'accepted'),
    'cheers', (select count(*) from cheers),
    'avg_score_7d', (select coalesce(round(avg(score)), 0) from day_logs where day > (now() at time zone 'Asia/Kolkata')::date - 7 and score > 0),
    'feedback_open', (select count(*) from feedback where status = 'open'),
    'alerts', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) as n from alert_events group by kind) a)
  );
end;
$$;

create or replace function public.admin_daily(days int default 30)
returns table (day date, signups int, active int, focus_minutes int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select d::date,
    (select count(*)::int from profiles p where (p.created_at at time zone 'Asia/Kolkata')::date = d::date),
    (select count(distinct l.user_id)::int from day_logs l where l.day = d::date and l.score > 0),
    (select coalesce(sum(l.focus_minutes), 0)::int from day_logs l where l.day = d::date)
  from generate_series((now() at time zone 'Asia/Kolkata')::date - (least(greatest(days, 7), 90) - 1), (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d;
end;
$$;

create or replace function public.admin_users(q text default '', filter text default 'all', lim int default 25, off int default 0)
returns table (id uuid, email text, full_name text, username text, avatar text, role text, onboarded boolean, created_at timestamptz,
               last_sign_in_at timestamptz, last_active date, days_logged int, focus_minutes int, current_streak int,
               suspended_at timestamptz, suspended_reason text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with base as (
    select p.*, u.email::text as email, u.last_sign_in_at
    from profiles p join auth.users u on u.id = p.id
    where (coalesce(q, '') = '' or p.full_name ilike '%' || q || '%' or p.username ilike '%' || q || '%' or u.email ilike '%' || q || '%')
      and (filter = 'all' or (filter = 'admins' and p.role = 'admin') or (filter = 'suspended' and p.suspended_at is not null)
           or (filter = 'new' and p.created_at > now() - interval '7 days'))
  )
  select b.id, b.email, b.full_name, b.username, b.avatar, b.role, b.onboarded, b.created_at, b.last_sign_in_at,
    (select max(l.day) from day_logs l where l.user_id = b.id and l.score > 0),
    (select count(*)::int from day_logs l where l.user_id = b.id and l.score > 0),
    (select coalesce(sum(l.focus_minutes), 0)::int from day_logs l where l.user_id = b.id),
    (select s.current_streak from streak_of(b.id, (now() at time zone coalesce(b.timezone, 'UTC'))::date) s),
    b.suspended_at, b.suspended_reason,
    count(*) over ()
  from base b
  order by b.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
end;
$$;

-- One person's summary: numbers and recent scores only. No journal text, no task titles.
create or replace function public.admin_user_detail(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare tz text; today date;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(timezone, 'UTC') into tz from profiles where id = uid;
  if tz is null then return null; end if;
  today := (now() at time zone tz)::date;
  return jsonb_build_object(
    'timezone', tz,
    'tracks', (select tracks from profiles where id = uid),
    'scores', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'score', coalesce(l.score, 0)) order by d), '[]')
               from generate_series(today - 29, today, interval '1 day') d left join day_logs l on l.user_id = uid and l.day = d::date),
    'streak', (select to_jsonb(s) from streak_of(uid, today) s),
    'total_xp', (select coalesce(sum(xp), 0) from xp_by_day(uid, '2000-01-01')),
    'sessions', (select count(*) from focus_sessions where user_id = uid),
    'focus_minutes', (select coalesce(sum(focus_minutes), 0) from day_logs where user_id = uid),
    'habits', (select count(*) from habits where user_id = uid and archived_at is null),
    'tasks_done', (select count(*) from tasks where user_id = uid and done_at is not null),
    'journal_entries', (select count(*) from journal_entries where user_id = uid),
    'friends', (select count(*) from friendships where status = 'accepted' and uid in (requester, addressee)),
    'feedback', (select count(*) from feedback where user_id = uid)
  );
end;
$$;

/* ---------- Admin write functions (checked and logged) ---------- */
create or replace function public.admin_set_role(uid uuid, new_role text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if new_role not in ('user', 'admin') then return 'bad_role'; end if;
  if uid = me and new_role <> 'admin' then return 'self'; end if; -- never lock yourself out
  update profiles set role = new_role where id = uid and role <> new_role;
  if not found then return 'unchanged'; end if;
  insert into admin_audit (admin_id, action, target_id, detail) values (me, 'set_role', uid, jsonb_build_object('role', new_role));
  return 'ok';
end;
$$;

create or replace function public.admin_set_suspended(uid uuid, suspend boolean, reason text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid());
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if uid = me then return 'self'; end if;
  if suspend and exists (select 1 from profiles where id = uid and role = 'admin') then return 'admin'; end if;
  update profiles
     set suspended_at = case when suspend then now() else null end,
         suspended_reason = case when suspend then left(nullif(trim(reason), ''), 300) else null end
   where id = uid;
  if not found then return 'not_found'; end if;
  insert into admin_audit (admin_id, action, target_id, detail)
    values (me, case when suspend then 'suspend' else 'unsuspend' end, uid, jsonb_build_object('reason', nullif(trim(coalesce(reason, '')), '')));
  return 'ok';
end;
$$;

-- Announcement and feedback changes are logged too
create or replace function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if public.is_admin() then
    insert into admin_audit (admin_id, action, detail)
    values ((select auth.uid()), tg_table_name || '_' || lower(tg_op),
            jsonb_strip_nulls(jsonb_build_object('id', r->>'id', 'title', r->>'title', 'status', r->>'status')));
  end if;
  return null; -- after-trigger: the return value is ignored
end;
$$;
drop trigger if exists announcements_audit on public.announcements;
create trigger announcements_audit after insert or update or delete on public.announcements for each row execute function public.log_admin_change();
drop trigger if exists feedback_audit on public.feedback;
create trigger feedback_audit after update on public.feedback for each row execute function public.log_admin_change();

/* ---------- Who can call what ---------- */
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_daily(int) from public, anon;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.log_admin_change() from public, anon, authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_daily(int) to authenticated;
grant execute on function public.admin_users(text, text, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

/* ---------- The project owner is the first admin ---------- */
update public.profiles set role = 'admin' where id = 'df147b4c-53ce-422d-b7c7-5795f0192297';

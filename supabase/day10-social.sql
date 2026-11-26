-- LockIn Day 10: XP, streaks, friends and cheers.
-- Friends never read each other's tables. They only see a summary (streak, XP, today's score)
-- through board(), which runs with owner rights and returns nothing else.

/* ---------- XP per day (internal) ---------- */
-- 1 XP per focus minute, 5 per glass of water (max 15), 1 per 2 minutes moved (max 120 min),
-- 10 for logging sleep, 20 for journaling, half the day score, +50 for a locked day (100),
-- 10 per habit done, 10 per task finished, 5 per focus session finished.
create or replace function public.xp_by_day(uid uuid, since date)
returns table (day date, xp int)
language sql stable security definer set search_path = public as $$
  with tz as (select coalesce(timezone, 'UTC') as tz from profiles where id = uid),
  d as (select l.day, l.focus_minutes, l.water, l.move_minutes, l.sleep_minutes, l.note, l.journaled, l.score
        from day_logs l where l.user_id = uid and l.day >= since),
  h as (select c.day, count(*) as n from habit_checks c where c.user_id = uid and c.day >= since group by c.day),
  t as (select (t.done_at at time zone (select tz from tz))::date as day, count(*) as n
        from tasks t where t.user_id = uid and t.done_at is not null and t.done_at >= since::timestamptz - interval '1 day' group by 1),
  f as (select s.day, count(*) as n from focus_sessions s where s.user_id = uid and s.completed and s.day >= since group by s.day),
  days as (select day from d union select day from h union select day from t where day >= since union select day from f)
  select days.day,
    ( coalesce(d.focus_minutes, 0)
    + least(coalesce(d.water, 0), 15) * 5
    + least(coalesce(d.move_minutes, 0), 120) / 2
    + case when d.sleep_minutes is not null then 10 else 0 end
    + case when coalesce(trim(d.note), '') <> '' or coalesce(d.journaled, false) then 20 else 0 end
    + least(coalesce(d.score, 0), 100) / 2
    + case when coalesce(d.score, 0) >= 100 then 50 else 0 end
    + coalesce(h.n, 0) * 10 + coalesce(t.n, 0) * 10 + coalesce(f.n, 0) * 5 )::int
  from days left join d using (day) left join h using (day) left join t using (day) left join f using (day);
$$;

/* ---------- Streak: days in a row with a score of 50 or more (internal) ---------- */
-- Today only counts once it reaches 50, and an unfinished today doesn't break the streak.
create or replace function public.streak_of(uid uuid, today date)
returns table (current_streak int, best_streak int)
language sql stable security definer set search_path = public as $$
  with kept as (select day from day_logs where user_id = uid and score >= 50 and day <= today),
  isl as (select day, day - (row_number() over (order by day))::int as grp from kept),
  runs as (select max(day) as last_day, count(*)::int as n from isl group by grp)
  select coalesce((select n from runs where last_day >= today - 1 order by last_day desc limit 1), 0),
         coalesce((select max(n) from runs), 0);
$$;

revoke all on function public.xp_by_day(uuid, date) from public, anon, authenticated;
revoke all on function public.streak_of(uuid, date) from public, anon, authenticated;

/* ---------- My own progress (Today and Streaks pages) ---------- */
create or replace function public.my_progress()
returns table (current_streak int, best_streak int, week_xp int, total_xp int, today_xp int)
language sql stable security definer set search_path = public as $$
  with me as (select id, (now() at time zone coalesce(timezone, 'UTC'))::date as today from profiles where id = (select auth.uid())),
  x as (select x.day, x.xp from me, lateral xp_by_day(me.id, '2000-01-01') x)
  select s.current_streak, s.best_streak,
    coalesce((select sum(xp) from x where x.day >= date_trunc('week', me.today)::date), 0)::int,
    coalesce((select sum(xp) from x), 0)::int,
    coalesce((select sum(xp) from x where x.day = me.today), 0)::int
  from me, lateral streak_of(me.id, me.today) s;
$$;
grant execute on function public.my_progress() to authenticated;

/* ---------- Friendships ---------- */
create table if not exists public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;
drop policy if exists "friends: see own" on public.friendships;
create policy "friends: see own" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));
drop policy if exists "friends: accept incoming" on public.friendships;
create policy "friends: accept incoming" on public.friendships
  for update to authenticated using (addressee = (select auth.uid())) with check (addressee = (select auth.uid()) and status = 'accepted');
drop policy if exists "friends: remove own" on public.friendships;
create policy "friends: remove own" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (requester, addressee));

revoke all on public.friendships from anon, authenticated;
grant select, delete on public.friendships to authenticated;
grant update (status, accepted_at) on public.friendships to authenticated;
-- No insert grant: requests go through send_friend_request(), which checks everything.

create or replace function public.send_friend_request(name text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  them uuid;
begin
  if me is null then return 'logged_out'; end if;
  select id into them from profiles where username = lower(trim(both from ltrim(name, '@')));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  if exists (select 1 from friendships where least(requester, addressee) = least(me, them) and greatest(requester, addressee) = greatest(me, them) and status = 'accepted') then
    return 'already';
  end if;
  -- They already asked me: accept instead of sending a second request
  if exists (select 1 from friendships where requester = them and addressee = me) then
    update friendships set status = 'accepted', accepted_at = now() where requester = them and addressee = me;
    return 'accepted';
  end if;
  if exists (select 1 from friendships where requester = me and addressee = them) then return 'pending'; end if;
  if (select count(*) from friendships where requester = me and status = 'pending') >= 20 then return 'limit'; end if;
  insert into friendships (requester, addressee) values (me, them);
  return 'sent';
end;
$$;
grant execute on function public.send_friend_request(text) to authenticated;

/* ---------- Cheers between friends ---------- */
create table if not exists public.cheers (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👏', '🔥', '💪', '🎉', '❤️')),
  day date not null default current_date,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (from_user, to_user, day) -- one cheer per friend per day
);
create index if not exists cheers_to on public.cheers (to_user, created_at desc);

alter table public.cheers enable row level security;
drop policy if exists "cheers: see own" on public.cheers;
create policy "cheers: see own" on public.cheers
  for select to authenticated using ((select auth.uid()) in (from_user, to_user));
drop policy if exists "cheers: send to friends" on public.cheers;
create policy "cheers: send to friends" on public.cheers
  for insert to authenticated with check (
    from_user = (select auth.uid())
    and exists (select 1 from public.friendships f where f.status = 'accepted'
                and least(f.requester, f.addressee) = least(from_user, to_user)
                and greatest(f.requester, f.addressee) = greatest(from_user, to_user)));
drop policy if exists "cheers: mark seen" on public.cheers;
create policy "cheers: mark seen" on public.cheers
  for update to authenticated using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));

revoke all on public.cheers from anon, authenticated;
grant select on public.cheers to authenticated;
grant insert (to_user, emoji) on public.cheers to authenticated;
grant update (seen_at) on public.cheers to authenticated;

/* ---------- People I'm connected to (names and avatars only) ---------- */
create or replace function public.my_connections()
returns table (other uuid, username text, full_name text, avatar text, direction text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  -- Until a request is accepted, the person who sent it only sees the username they typed
  select p.id, p.username,
         case when f.status = 'pending' and f.requester = (select auth.uid()) then null else p.full_name end,
         case when f.status = 'pending' and f.requester = (select auth.uid()) then '🙂' else p.avatar end,
         case when f.requester = (select auth.uid()) then 'out' else 'in' end, f.status, f.created_at
  from friendships f
  join profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end
  where (select auth.uid()) in (f.requester, f.addressee)
  order by f.created_at desc;
$$;
grant execute on function public.my_connections() to authenticated;

/* ---------- Leaderboard: me and my friends, summary only ---------- */
create or replace function public.board()
returns table (id uuid, username text, full_name text, avatar text, current_streak int, best_streak int, week_xp int, total_xp int, today_score int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with people as (
    select (select auth.uid()) as uid
    union
    select case when f.requester = (select auth.uid()) then f.addressee else f.requester end
    from friendships f where f.status = 'accepted' and (select auth.uid()) in (f.requester, f.addressee)
  )
  select p.id, p.username, p.full_name, p.avatar, s.current_streak, s.best_streak,
    coalesce((select sum(x.xp) from xp_by_day(p.id, date_trunc('week', t.today)::date) x), 0)::int,
    coalesce((select sum(x.xp) from xp_by_day(p.id, '2000-01-01') x), 0)::int,
    coalesce((select l.score from day_logs l where l.user_id = p.id and l.day = t.today), 0),
    p.id = (select auth.uid())
  from people
  join profiles p on p.id = people.uid
  cross join lateral (select (now() at time zone coalesce(p.timezone, 'UTC'))::date as today) t
  cross join lateral streak_of(p.id, t.today) s
  where (select auth.uid()) is not null;
$$;
grant execute on function public.board() to authenticated;

/* ---------- Only signed-in people may call these ---------- */
revoke all on function public.my_progress() from public, anon;
revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.my_connections() from public, anon;
revoke all on function public.board() from public, anon;
grant execute on function public.my_progress() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.my_connections() to authenticated;
grant execute on function public.board() to authenticated;

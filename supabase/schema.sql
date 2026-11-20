-- The Reading Archive: cloud schema for Supabase.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Model: one archive, one owner. Everyone (including anonymous visitors) can READ.
-- Only the account recorded in public.archive_owner can WRITE. The owner row is
-- added from the dashboard (never from the website), so no one can claim the archive.

-- ---------- owner ----------
create table if not exists public.archive_owner (
  id boolean primary key default true check (id),          -- at most one row
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.archive_owner enable row level security;
drop policy if exists "owner row is public" on public.archive_owner;
create policy "owner row is public" on public.archive_owner for select using (true);
-- no insert/update/delete policies: only the dashboard (service role) can change the owner

create or replace function public.is_archive_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.archive_owner where user_id = auth.uid());
$$;
grant execute on function public.is_archive_owner() to anon, authenticated;

-- ---------- books ----------
create table if not exists public.books (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.books enable row level security;
drop policy if exists "books are public" on public.books;
drop policy if exists "owner writes books" on public.books;
create policy "books are public" on public.books for select using (true);
create policy "owner writes books" on public.books for all to authenticated
  using (public.is_archive_owner()) with check (public.is_archive_owner());

-- ---------- reading sessions ----------
create table if not exists public.sessions (
  id text primary key,
  book_id text not null,
  data jsonb not null
);
create index if not exists sessions_book_id_idx on public.sessions (book_id);
alter table public.sessions enable row level security;
drop policy if exists "sessions are public" on public.sessions;
drop policy if exists "owner writes sessions" on public.sessions;
create policy "sessions are public" on public.sessions for select using (true);
create policy "owner writes sessions" on public.sessions for all to authenticated
  using (public.is_archive_owner()) with check (public.is_archive_owner());

-- ---------- privileges ----------
grant usage on schema public to anon, authenticated;
grant select on public.books, public.sessions, public.archive_owner to anon, authenticated;
grant insert, update, delete on public.books, public.sessions to authenticated;

-- ---------- cover images (public bucket, owner-only writes) ----------
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "covers are public" on storage.objects;
drop policy if exists "owner uploads covers" on storage.objects;
drop policy if exists "owner updates covers" on storage.objects;
drop policy if exists "owner deletes covers" on storage.objects;
create policy "covers are public" on storage.objects for select using (bucket_id = 'covers');
create policy "owner uploads covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.is_archive_owner());
create policy "owner updates covers" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and public.is_archive_owner());
create policy "owner deletes covers" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and public.is_archive_owner());

-- ---------- make yourself the owner (run after your first sign-in) ----------
-- insert into public.archive_owner (user_id)
-- select id from auth.users where email = 'YOUR-SIGN-IN-EMAIL'
-- on conflict (id) do update set user_id = excluded.user_id;

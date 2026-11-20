-- Table privileges for the website's roles. Row-level security (schema.sql) still decides
-- which rows: anyone may read; only the archive owner may write.
grant usage on schema public to anon, authenticated;
grant select on public.books, public.sessions, public.archive_owner to anon, authenticated;
grant insert, update, delete on public.books, public.sessions to authenticated;

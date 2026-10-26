export const setupSql = `-- Shared PUBLIC DEMO only: anyone can read, add, and delete these books.
-- Run once in your Supabase project's SQL Editor.
-- This creates a separate table and does not modify existing tables.
begin;
create table if not exists public.library_demo_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  author text not null check (length(trim(author)) between 1 and 200),
  genre text not null check (length(trim(genre)) between 1 and 80),
  notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.library_demo_books enable row level security;
grant select, insert, delete on public.library_demo_books to anon;
drop policy if exists "demo_read" on public.library_demo_books;
create policy "demo_read" on public.library_demo_books for select to anon using (true);
drop policy if exists "demo_add" on public.library_demo_books;
create policy "demo_add" on public.library_demo_books for insert to anon with check (true);
drop policy if exists "demo_delete" on public.library_demo_books;
create policy "demo_delete" on public.library_demo_books for delete to anon using (true);
commit;`;

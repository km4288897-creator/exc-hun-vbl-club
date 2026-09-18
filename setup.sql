-- EXC HUN VBL CLUB – Supabase
-- Ezt a Supabase SQL Editorban futtasd.
-- A Storage bucketet Dashboardból hozd létre:
-- Storage -> New bucket -> vbl-videos -> Public ON
-- Maximum fájlméretet állíts 50 MB-ra.

create extension if not exists pgcrypto;

create table if not exists public.videos(
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 1 and 80),
 file_path text not null unique,
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 created_at timestamptz not null default now()
);

create table if not exists public.admins(
 user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.videos enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path=public
as $$
 select exists(select 1 from public.admins where user_id=auth.uid());
$$;

grant execute on function public.is_admin() to anon,authenticated;

drop policy if exists "read approved videos" on public.videos;
create policy "read approved videos" on public.videos
for select to anon,authenticated
using(status='approved' or public.is_admin());

drop policy if exists "submit videos" on public.videos;
create policy "submit videos" on public.videos
for insert to anon,authenticated
with check(status='pending');

drop policy if exists "admin update videos" on public.videos;
create policy "admin update videos" on public.videos
for update to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "storage public read" on storage.objects;
create policy "storage public read" on storage.objects
for select to public
using(bucket_id='vbl-videos');

drop policy if exists "storage upload" on storage.objects;
create policy "storage upload" on storage.objects
for insert to anon,authenticated
with check(bucket_id='vbl-videos' and (storage.foldername(name))[1]='pending');

drop policy if exists "storage admin update" on storage.objects;
create policy "storage admin update" on storage.objects
for update to authenticated
using(bucket_id='vbl-videos' and public.is_admin())
with check(bucket_id='vbl-videos' and public.is_admin());

drop policy if exists "storage admin delete" on storage.objects;
create policy "storage admin delete" on storage.objects
for delete to authenticated
using(bucket_id='vbl-videos' and public.is_admin());

-- Miután létrehoztad az admin felhasználót:
-- INSERT INTO public.admins(user_id) VALUES ('AZ-ADMIN-USER-UUID');

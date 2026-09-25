-- Avatars: a profiles table and a public "avatars" storage bucket.
-- Run once, after schema.sql: Dashboard → SQL Editor → New query → paste → Run.
--
-- The app checks type and size before uploading, but that is only for a nicer
-- experience: anyone can skip it by calling the Storage API directly. The
-- bucket limits and the policy below are what actually protect the data.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, holding the avatar's public URL
-- ---------------------------------------------------------------------------

create table public.profiles (
  id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  avatar_url text check (char_length(avatar_url) <= 2048)
);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Users manage their own profile"
  on public.profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- avatars bucket
-- ---------------------------------------------------------------------------

-- public: anyone with the URL can view a file, which <img src> needs.
-- It does not let anyone write: uploads still have to pass the policy below.
-- Storage itself rejects files over 1 MB (1048576 bytes) and anything that
-- isn't one of these image types, whatever the client does.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
);

-- Every object path is '<user id>/<file name>'. storage.foldername() splits
-- the path into folders, so [1] is the top-level folder.
--
-- upload needs INSERT; upload with upsert: true also needs SELECT and UPDATE,
-- so one "for all" policy covers it. SELECT here only governs API reads and
-- listing: public URLs don't go through it, and nobody can list another
-- user's folder.
create policy "Users manage avatars in their own folder"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

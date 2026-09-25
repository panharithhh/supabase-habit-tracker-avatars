// Runs supabase/avatars.sql in an in-memory Postgres (PGlite) with stand-ins
// for Supabase's auth and storage schemas, then checks the profiles policy and
// the avatars storage policy as two users and an anonymous visitor.
//
//   npm run test:rls
//
// The bucket's 1 MB and image-type limits are enforced by the Storage API
// server, not Postgres, so they aren't tested here.

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'

const db = new PGlite()

// Enough of Supabase to run avatars.sql unchanged. storage.objects has RLS on
// and is granted to both API roles, like on a real project, so the policy is
// the only thing deciding who can write where.
before(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null,
      owner uuid default auth.uid(),
      unique (bucket_id, name)
    );
    -- Same as Supabase's: every path segment except the file name.
    create function storage.foldername(name text) returns text[] language sql immutable as $$
      select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
    $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant all on storage.objects to anon, authenticated;
    grant select on storage.buckets to anon, authenticated;
    insert into storage.buckets (id, name) values ('other', 'other');
  `)
  await db.exec(readFileSync(new URL('../supabase/avatars.sql', import.meta.url), 'utf8'))
})

// Run a query the way the Supabase API would for a request carrying this
// user's JWT (or no JWT at all when userId is null).
async function as(userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${userId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return tx.query(sql, params)
  })
}

// What the Storage API runs for upload(path, file, { upsert: true }).
const upsert = (userId, name, bucket = 'avatars') =>
  as(
    userId,
    `insert into storage.objects (bucket_id, name) values ($1, $2)
     on conflict (bucket_id, name) do update set owner = excluded.owner`,
    [bucket, name],
  )

test('the avatars bucket is public, capped at 1 MB and images only', async () => {
  const { rows } = await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`)
  assert.deepEqual(rows[0], {
    public: true,
    file_size_limit: 1048576,
    allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  })
})

test('Alice can upload into her own folder, and upsert over it', async () => {
  await upsert(ALICE, `${ALICE}/avatar`)
  await upsert(ALICE, `${ALICE}/avatar`)
  const { rows } = await db.query(`select count(*)::int as n from storage.objects where name = $1`, [`${ALICE}/avatar`])
  assert.equal(rows[0].n, 1)
})

test("Alice can't upload into Bob's folder", async () => {
  await assert.rejects(upsert(ALICE, `${BOB}/avatar`), /row-level security/)
})

test("Alice can't upload outside any folder, or into someone else's nested path", async () => {
  await assert.rejects(upsert(ALICE, 'avatar.png'), /row-level security/)
  await assert.rejects(upsert(ALICE, `${BOB}/${ALICE}/avatar`), /row-level security/)
})

test("Bob can't overwrite, rename or delete Alice's avatar", async () => {
  await assert.rejects(upsert(BOB, `${ALICE}/avatar`), /row-level security/)
  const upd = await as(BOB, `update storage.objects set name = $1 where name = $2`, [`${BOB}/stolen`, `${ALICE}/avatar`])
  const del = await as(BOB, `delete from storage.objects where name = $1`, [`${ALICE}/avatar`])
  assert.equal(upd.affectedRows, 0)
  assert.equal(del.affectedRows, 0)
})

test("Bob can't list Alice's folder", async () => {
  await upsert(BOB, `${BOB}/avatar`)
  const { rows } = await as(BOB, `select name from storage.objects where bucket_id = 'avatars'`)
  assert.deepEqual(rows, [{ name: `${BOB}/avatar` }])
})

test("Alice can't move her avatar into Bob's folder", async () => {
  await assert.rejects(
    as(ALICE, `update storage.objects set name = $1 where name = $2`, [`${BOB}/avatar2`, `${ALICE}/avatar`]),
    /row-level security/,
  )
})

test('the policy only covers the avatars bucket', async () => {
  await assert.rejects(upsert(ALICE, `${ALICE}/avatar`, 'other'), /row-level security/)
})

test('anonymous visitors can upload nothing', async () => {
  await assert.rejects(upsert(null, `${ALICE}/avatar`), /row-level security/)
})

test('Alice can save her avatar_url, and only Alice can see it', async () => {
  const url = `https://example.supabase.co/storage/v1/object/public/avatars/${ALICE}/avatar?v=1`
  await as(ALICE, `insert into profiles (id, avatar_url) values ($1, $2) on conflict (id) do update set avatar_url = excluded.avatar_url`, [ALICE, url])
  await as(ALICE, `insert into profiles (id, avatar_url) values ($1, $2) on conflict (id) do update set avatar_url = excluded.avatar_url`, [ALICE, url + '2'])

  const mine = await as(ALICE, `select avatar_url from profiles`)
  const bobs = await as(BOB, `select avatar_url from profiles`)
  assert.deepEqual(mine.rows, [{ avatar_url: url + '2' }])
  assert.equal(bobs.rows.length, 0)
})

test("Bob can't set Alice's avatar_url", async () => {
  await assert.rejects(
    as(BOB, `insert into profiles (id, avatar_url) values ($1, 'https://evil.example/x.png')`, [ALICE]),
    /row-level security/,
  )
  const upd = await as(BOB, `update profiles set avatar_url = 'https://evil.example/x.png' where id = $1`, [ALICE])
  assert.equal(upd.affectedRows, 0)
})

test('anonymous visitors are refused profiles outright', async () => {
  await assert.rejects(as(null, `select * from profiles`), /permission denied/)
})

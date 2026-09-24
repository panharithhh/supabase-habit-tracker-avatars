// Runs supabase/schema.sql in an in-memory Postgres (PGlite) with a stand-in
// for Supabase's auth schema and roles, then checks the RLS policies from the
// point of view of two users and an anonymous visitor.
//
//   npm run test:rls
//
// No Supabase project, Docker or network needed.

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'

const db = new PGlite()

// Enough of Supabase to run the schema unchanged: an auth.users table, an
// auth.uid() that reads the JWT "sub" claim, and the anon/authenticated roles
// that PostgREST switches into for every request.
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
  `)
  await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
})

// Run a query the way PostgREST would for a request carrying this user's JWT
// (or no JWT at all when userId is null).
async function as(userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${userId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return tx.query(sql, params)
  })
}

// Superuser view, bypassing RLS: what is really in the table.
async function count(table, where = 'true', params = []) {
  const { rows } = await db.query(`select count(*)::int as n from public.${table} where ${where}`, params)
  return rows[0].n
}

let aliceHabitId

test('Alice can create a habit without sending user_id, and log it', async () => {
  const { rows } = await as(ALICE, `insert into habits (name) values ('Read 10 pages') returning id, user_id`)
  aliceHabitId = rows[0].id
  assert.equal(rows[0].user_id, ALICE)

  await as(ALICE, `insert into habit_logs (habit_id, done_on) values ($1, '2026-09-23'), ($1, '2026-09-24')`, [aliceHabitId])
  const logs = await as(ALICE, `select * from habit_logs`)
  assert.equal(logs.rows.length, 2)
})

test('Alice sees her own habit', async () => {
  const { rows } = await as(ALICE, `select name from habits`)
  assert.deepEqual(rows, [{ name: 'Read 10 pages' }])
})

test("Bob's habit list is EMPTY, not an error", async () => {
  const habits = await as(BOB, `select * from habits`)
  const logs = await as(BOB, `select * from habit_logs`)
  assert.equal(habits.rows.length, 0)
  assert.equal(logs.rows.length, 0)
})

test("Bob can't read Alice's habit even by its exact id", async () => {
  const { rows } = await as(BOB, `select * from habits where id = $1`, [aliceHabitId])
  assert.equal(rows.length, 0)
})

test("Bob can't create a habit owned by Alice", async () => {
  await assert.rejects(
    as(BOB, `insert into habits (user_id, name) values ($1, 'planted')`, [ALICE]),
    /row-level security/,
  )
})

test("Bob can't log a check-in against Alice's habit", async () => {
  await assert.rejects(
    as(BOB, `insert into habit_logs (habit_id, done_on) values ($1, '2026-09-25')`, [aliceHabitId]),
    /row-level security/,
  )
})

test("Bob can't rename or delete Alice's habit (0 rows affected)", async () => {
  const upd = await as(BOB, `update habits set name = 'hacked' where id = $1`, [aliceHabitId])
  const del = await as(BOB, `delete from habits where id = $1`, [aliceHabitId])
  assert.equal(upd.affectedRows, 0)
  assert.equal(del.affectedRows, 0)
  assert.equal(await count('habits', `id = $1 and name = 'Read 10 pages'`, [aliceHabitId]), 1)
})

test("Bob can't move a row he owns over to Alice", async () => {
  const { rows } = await as(BOB, `insert into habits (name) values ('Bob habit') returning id`)
  await assert.rejects(
    as(BOB, `update habits set user_id = $1 where id = $2`, [ALICE, rows[0].id]),
    /row-level security/,
  )
})

test('anonymous requests are refused outright', async () => {
  await assert.rejects(as(null, `select * from habits`), /permission denied/)
  await assert.rejects(as(null, `select * from habit_logs`), /permission denied/)
})

test('one check-in per habit per day', async () => {
  await assert.rejects(
    as(ALICE, `insert into habit_logs (habit_id, done_on) values ($1, '2026-09-24')`, [aliceHabitId]),
    /duplicate key/,
  )
})

test('deleting a habit removes its logs (checked past RLS, as superuser)', async () => {
  assert.equal(await count('habit_logs', 'habit_id = $1', [aliceHabitId]), 2)
  await as(ALICE, `delete from habits where id = $1`, [aliceHabitId])
  assert.equal(await count('habits', 'id = $1', [aliceHabitId]), 0)
  assert.equal(await count('habit_logs', 'habit_id = $1', [aliceHabitId]), 0)
})

# Habit Tracker: Supabase Auth + Row Level Security

A React 19 + TypeScript (Vite) habit tracker. You sign in with email and
password, add habits, and tick off days. There is no backend server: the
browser talks to Supabase Postgres directly with a public key, so **the two
RLS policies are the only thing keeping each user's data private**.

## Run it

```bash
npm install
cp .env.example .env    # then fill in the two values (see setup below)
npm run dev             # http://localhost:5173
npm run test:rls        # proves the policies, no Supabase project needed
npm run build           # tsc -b && vite build
```

## One-time Supabase setup

1. **Create a project** at <https://supabase.com/dashboard> → New project.
2. **Run the schema.** SQL Editor → New query → paste all of
   [`supabase/schema.sql`](supabase/schema.sql) → Run. This creates both
   tables, the cascade, the grants and the two policies.
3. **Make test accounts easy.** Authentication → Sign In / Providers → Email →
   turn **Confirm email** off. With it on, sign-up works, but each account has
   to click a link in a real inbox before it can sign in.
4. **Copy the keys.** Project Settings → API Keys. Put the Project URL and the
   **publishable** key (`sb_publishable_…`, or the legacy `anon` key on older
   projects) into `.env`. Never use the secret / `service_role` key: it
   bypasses RLS, and Vite ships every `VITE_` variable to the browser.

## How the data is protected

| Table | Columns | Policy |
|---|---|---|
| `habits` | `id`, `user_id`, `name`, `created_at` | **Users manage their own habits**: `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)` |
| `habit_logs` | `id`, `habit_id → habits on delete cascade`, `user_id`, `done_on`, `created_at` | **Users manage their own habit logs**: same rule, and `with check` also requires that the `habit_id` belongs to you |

- `using` decides which rows you can **see, update, delete**. `with check`
  decides which rows you can **write**. With both in place you can't read other
  people's rows, plant rows under someone else's `user_id`, or move your own
  rows over to another user.
- `user_id` defaults to `auth.uid()`, so the client never sends it. The React
  code has no `.eq('user_id', …)` filters: RLS already does the filtering.
- Anonymous (signed-out) requests are revoked outright and get
  `permission denied`.
- `on delete cascade` on `habit_logs.habit_id` means deleting a habit deletes
  its logs in the database, not just on screen.

### Proving it: `npm run test:rls`

[`scripts/rls.test.mjs`](scripts/rls.test.mjs) loads the real
`supabase/schema.sql` into an in-memory Postgres
([PGlite](https://pglite.dev)) with a stand-in for Supabase's `auth.uid()` and
roles. It then acts as two users and a signed-out visitor:

```
✔ Alice can create a habit without sending user_id, and log it
✔ Alice sees her own habit
✔ Bob's habit list is EMPTY, not an error
✔ Bob can't read Alice's habit even by its exact id
✔ Bob can't create a habit owned by Alice
✔ Bob can't log a check-in against Alice's habit
✔ Bob can't rename or delete Alice's habit (0 rows affected)
✔ Bob can't move a row he owns over to Alice
✔ anonymous requests are refused outright
✔ one check-in per habit per day
✔ deleting a habit removes its logs (checked past RLS, as superuser)
ℹ tests 11 · pass 11 · fail 0
```

If you add `disable row level security` for both tables to the end of the
schema, 8 of the 11 tests fail. So the tests really are testing RLS.

## Audit checklist

| Check | How to verify | Why it holds |
|---|---|---|
| `git status` shows no `.env` | `git status` and `git ls-files \| grep .env` show only `.env.example` | `.gitignore` covers `.env` and `.env.*`. `scripts/push-to-github.sh` also refuses to push if a `.env` is ever tracked |
| A second account sees an EMPTY list, not an error | Sign out, create a second account. It shows "No habits yet." | RLS filters rows instead of rejecting the query, so Supabase returns `[]`. The UI treats `[]` as the empty state and shows errors separately |
| Deleting a habit removes its logs | Delete a habit, then in SQL Editor run `select count(*) from habit_logs where habit_id = '<id>'`. The result is `0` | `habit_id … references habits on delete cascade` |
| Refresh loses nothing | Add habits, tick days, press ⌘R. You stay signed in and everything is still there | Every read comes from Supabase, never from component state. supabase-js keeps the session in localStorage |

## Deliverables

**Screenshots** (in [`docs/screenshots/`](docs/screenshots/)):

1. `01-habit-list.png`: the signed-in habit list
2. `02-second-account-empty.png`: the second account's empty list
3. `03-sql-editor-policies.png`: the SQL editor showing both policies. Run
   [`supabase/show-policies.sql`](supabase/show-policies.sql) to list them.

**If RLS were disabled once the app is deployed:**

> Anyone could copy the project URL and public key out of the deployed site's
> JavaScript, sign up for a free account, and call the Supabase REST API
> directly to read, rewrite, or delete every user's habits and logs.

## Project layout

```
supabase/schema.sql          tables, cascade, grants, the two RLS policies
supabase/show-policies.sql   query for the policies screenshot
scripts/rls.test.mjs         RLS tests against the real schema (PGlite)
scripts/push-to-github.sh    creates the GitHub repo and pushes
src/lib/supabase.ts          client created from .env
src/lib/useSession.ts        session state via onAuthStateChange
src/lib/dates.ts             local-time dates and streaks
src/components/AuthForm.tsx  sign in / create account
src/components/HabitList.tsx add, check in, delete; empty and error states
```

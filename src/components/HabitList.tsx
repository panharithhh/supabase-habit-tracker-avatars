import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { lastDays, localDate, streak } from '../lib/dates'
import type { Habit } from '../types'

const WEEK = 7

export default function HabitList() {
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  // Day cells with a write in flight, as `${habitId}:${day}`, so a double
  // click can't send an insert and a delete that race each other.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const latestLoad = useRef(0)

  // Every read goes to Supabase, never to local state or localStorage, so a
  // refresh shows exactly what the database holds. No .eq('user_id', …) here:
  // RLS already limits the rows to the signed-in user.
  const load = useCallback(async () => {
    const id = ++latestLoad.current
    const { data, error } = await supabase
      .from('habits')
      .select('id, name, created_at, habit_logs(done_on)')
      .order('created_at')
    if (id !== latestLoad.current) return // a newer read is on its way
    if (error) setError(error.message)
    else setHabits(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Run a write, then re-read so the screen always matches the database
  // (and any optimistic change is corrected if the write failed).
  async function write(query: PromiseLike<{ error: PostgrestError | null }>) {
    setError(null)
    const { error } = await query
    await load()
    if (error) setError(error.message)
  }

  async function addHabit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    // user_id is filled in by the column default, auth.uid().
    await write(supabase.from('habits').insert({ name: trimmed }))
  }

  async function toggleDay(habit: Habit, day: string, done: boolean) {
    const cell = `${habit.id}:${day}`
    if (pending.has(cell)) return
    setPending((prev) => new Set(prev).add(cell))
    setHabits((prev) =>
      prev!.map((h) =>
        h.id !== habit.id
          ? h
          : {
              ...h,
              habit_logs: done
                ? h.habit_logs.filter((l) => l.done_on !== day)
                : [...h.habit_logs, { done_on: day }],
            },
      ),
    )
    await write(
      done
        ? supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('done_on', day)
        : supabase.from('habit_logs').insert({ habit_id: habit.id, done_on: day }),
    )
    setPending((prev) => {
      const next = new Set(prev)
      next.delete(cell)
      return next
    })
  }

  function deleteHabit(habit: Habit) {
    const n = habit.habit_logs.length
    if (!confirm(`Delete "${habit.name}" and its ${n} check-in${n === 1 ? '' : 's'}?`)) return
    // The foreign key's ON DELETE CASCADE removes the habit's logs.
    write(supabase.from('habits').delete().eq('id', habit.id))
  }

  const days = lastDays(WEEK)
  const today = localDate()

  return (
    <section className="stack">
      <form className="add" onSubmit={addHabit}>
        <input
          aria-label="New habit"
          placeholder="New habit, e.g. Read 10 pages"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {error && <p className="error">Couldn't reach your habits: {error}</p>}

      {habits === null && !error && <p className="muted center">Loading habits…</p>}

      {habits?.length === 0 && (
        <div className="empty">
          <p>No habits yet.</p>
          <p className="muted">Add one above. Only you can see your list.</p>
        </div>
      )}

      {habits?.map((habit) => {
        const done = new Set(habit.habit_logs.map((l) => l.done_on))
        const s = streak(done)
        const total = habit.habit_logs.length
        return (
          <article key={habit.id} className="card habit">
            <div className="habit-head">
              <h2>{habit.name}</h2>
              <button className="ghost danger" onClick={() => deleteHabit(habit)} aria-label={`Delete ${habit.name}`}>
                Delete
              </button>
            </div>

            <div className="week">
              {days.map((d) => {
                const key = localDate(d)
                const isDone = done.has(key)
                return (
                  <button
                    key={key}
                    className={`day${isDone ? ' done' : ''}${key === today ? ' today' : ''}`}
                    aria-pressed={isDone}
                    title={d.toDateString()}
                    onClick={() => toggleDay(habit, key, isDone)}
                  >
                    <span className="dow">{key === today ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <span className="num">{d.getDate()}</span>
                  </button>
                )
              })}
            </div>

            <p className="muted stats">
              {s > 0 ? `${s}-day streak` : 'No streak yet'} · {total} check-in{total === 1 ? '' : 's'}
            </p>
          </article>
        )
      })}
    </section>
  )
}

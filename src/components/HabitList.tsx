import { useState, type FormEvent } from 'react'
import { lastDays, localDate, streak } from '../lib/dates'
import { crashTest } from '../lib/crashTest'
import type { HabitStore } from '../lib/useHabits'
import type { Habit } from '../types'

const WEEK = 7

export default function HabitList({ habits, error, addHabit, toggleDay, deleteHabit }: HabitStore) {
  crashTest('habits')

  const [name, setName] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    await addHabit(trimmed)
  }

  function remove(habit: Habit) {
    const n = habit.habit_logs.length
    if (!confirm(`Delete "${habit.name}" and its ${n} check-in${n === 1 ? '' : 's'}?`)) return
    deleteHabit(habit)
  }

  const days = lastDays(WEEK)
  const today = localDate()

  return (
    <section className="stack">
      <form className="add" onSubmit={add}>
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
              <button className="ghost danger" onClick={() => remove(habit)} aria-label={`Delete ${habit.name}`}>
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

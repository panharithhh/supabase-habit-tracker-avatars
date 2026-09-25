import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Habit } from '../types'

/** The signed-in user's habits and the writes that change them. Shared by the list and the stats. */
export function useHabits() {
  const [habits, setHabits] = useState<Habit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  async function addHabit(name: string) {
    // user_id is filled in by the column default, auth.uid().
    await write(supabase.from('habits').insert({ name }))
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

  async function deleteHabit(habit: Habit) {
    // The foreign key's ON DELETE CASCADE removes the habit's logs.
    await write(supabase.from('habits').delete().eq('id', habit.id))
  }

  return { habits, error, addHabit, toggleDay, deleteHabit }
}

export type HabitStore = ReturnType<typeof useHabits>

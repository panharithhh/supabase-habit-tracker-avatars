// Dates are 'YYYY-MM-DD' strings in the user's local time zone, matching the
// habit_logs.done_on column. Using UTC here would log "today" as yesterday for
// anyone east of Greenwich in the early morning.

export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgo(n: number, from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() - n)
}

/** The last n days, oldest first, ending today. */
export function lastDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => daysAgo(n - 1 - i))
}

/** Consecutive days done, ending today (or yesterday, if today isn't done yet). */
export function streak(done: Set<string>): number {
  const start = done.has(localDate()) ? 0 : 1
  let count = 0
  while (done.has(localDate(daysAgo(start + count)))) count++
  return count
}

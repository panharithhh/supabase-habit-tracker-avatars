import { lastDays, localDate, streak } from '../lib/dates'
import { crashTest } from '../lib/crashTest'
import type { Habit } from '../types'

type Props = { habits: Habit[] | null }

/** A row of headline numbers, worked out from the same habits the list shows. */
export default function Stats({ habits }: Props) {
  crashTest('stats')

  const today = localDate()
  const week = new Set(lastDays(7).map((d) => localDate(d)))
  const list = habits ?? []

  const doneToday = list.filter((h) => h.habit_logs.some((l) => l.done_on === today)).length
  const weekCheckIns = list.reduce((n, h) => n + h.habit_logs.filter((l) => week.has(l.done_on)).length, 0)
  const best = list
    .map((h) => ({ name: h.name, days: streak(new Set(h.habit_logs.map((l) => l.done_on))) }))
    .reduce<{ name: string; days: number } | null>((top, s) => (!top || s.days > top.days ? s : top), null)

  const loading = habits === null
  const value = (v: string) => (loading ? '–' : v)
  const todayShare = list.length ? doneToday / list.length : 0

  return (
    <section className="kpis" aria-label="Stats">
      <div className="kpi">
        <p className="kpi-label">Done today</p>
        <p className="kpi-value">{value(`${doneToday} of ${list.length}`)}</p>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${todayShare * 100}%` }} />
        </div>
      </div>
      <div className="kpi">
        <p className="kpi-label">Check-ins, last 7 days</p>
        <p className="kpi-value">{value(String(weekCheckIns))}</p>
        <p className="kpi-sub">{loading ? '' : `of ${list.length * 7} possible`}</p>
      </div>
      <div className="kpi">
        <p className="kpi-label">Best streak</p>
        <p className="kpi-value">{value(best && best.days > 0 ? `${best.days} day${best.days === 1 ? '' : 's'}` : '0 days')}</p>
        <p className="kpi-sub">{best && best.days > 0 ? best.name : ''}</p>
      </div>
    </section>
  )
}

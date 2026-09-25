// Dev-only switch for seeing error boundaries at work: open the app with
// ?crash=stats (or nav, profile, habits; comma-separate several) and that
// section throws while rendering. "Try again" clears it, so the retry
// succeeds. Production builds drop all of this: import.meta.env.DEV is false.

function crashing(): string[] {
  return new URLSearchParams(location.search).get('crash')?.split(',') ?? []
}

/** Call at the top of a component's render. */
export function crashTest(section: string) {
  if (import.meta.env.DEV && crashing().includes(section)) {
    throw new Error(`Crash test: the ${section} section threw on purpose (?crash=${section}).`)
  }
}

export function clearCrashTest(section: string) {
  if (!import.meta.env.DEV) return
  const url = new URL(location.href)
  const rest = crashing().filter((s) => s !== section)
  if (rest.length) url.searchParams.set('crash', rest.join(','))
  else url.searchParams.delete('crash')
  history.replaceState(null, '', url)
}

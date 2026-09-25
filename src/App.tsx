import type { User } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { useSession } from './lib/useSession'
import { useHabits } from './lib/useHabits'
import { useProfile } from './lib/useProfile'
import { clearCrashTest } from './lib/crashTest'
import AuthForm from './components/AuthForm'
import AvatarUpload from './components/AvatarUpload'
import ErrorBoundary from './components/ErrorBoundary'
import HabitList from './components/HabitList'
import Nav from './components/Nav'
import SectionFallback from './components/SectionFallback'
import Stats from './components/Stats'

export default function App() {
  return isConfigured ? <Main /> : <MissingConfig />
}

function Main() {
  const session = useSession()

  if (session === undefined) return <p className="muted center">Loading…</p>
  if (!session) return <AuthForm />

  // Keyed by user so switching accounts never flashes the previous user's data.
  return <Dashboard key={session.user.id} user={session.user} />
}

// Each section sits in its own ErrorBoundary. If one throws while rendering,
// only that section swaps to its fallback; the others keep working. The data
// hooks live up here, outside the boundaries, so a crash and a retry never
// lose or refetch what the other sections are showing.
function Dashboard({ user }: { user: User }) {
  const habits = useHabits()
  const profile = useProfile(user.id)
  const email = user.email ?? ''

  return (
    <main>
      <ErrorBoundary
        name="nav"
        onReset={() => clearCrashTest('nav')}
        fallback={(p) => (
          <SectionFallback
            {...p}
            className="topbar"
            title="The top bar didn’t load"
            actions={
              <button className="ghost" onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            }
          >
            You’re still signed in, and everything below works.
          </SectionFallback>
        )}
      >
        <Nav email={email} avatarUrl={profile.avatarUrl} />
      </ErrorBoundary>

      <div className="stack">
        <ErrorBoundary
          name="profile"
          onReset={() => clearCrashTest('profile')}
          fallback={(p) => (
            <SectionFallback {...p} title="Profile photo is unavailable">
              Your current photo is unchanged. Nothing was uploaded.
            </SectionFallback>
          )}
        >
          <AvatarUpload
            email={email}
            avatarUrl={profile.avatarUrl}
            loadError={profile.error}
            uploadAvatar={profile.uploadAvatar}
          />
        </ErrorBoundary>

        <ErrorBoundary
          name="stats"
          onReset={() => clearCrashTest('stats')}
          fallback={(p) => (
            <SectionFallback {...p} title="Stats couldn’t be shown">
              Your habits and check-ins below are safe. Only this summary failed.
            </SectionFallback>
          )}
        >
          <Stats habits={habits.habits} />
        </ErrorBoundary>

        <ErrorBoundary
          name="habits"
          onReset={() => clearCrashTest('habits')}
          fallback={(p) => (
            <SectionFallback {...p} title="Your habit list hit a problem">
              Nothing was lost: every check-in is saved in the database.
            </SectionFallback>
          )}
        >
          <HabitList {...habits} />
        </ErrorBoundary>
      </div>
    </main>
  )
}

function MissingConfig() {
  return (
    <main className="narrow">
      <h1>Habits</h1>
      <div className="card">
        <h2>Supabase isn't configured</h2>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>
          </li>
          <li>
            Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          </li>
          <li>
            Restart <code>npm run dev</code>
          </li>
        </ol>
      </div>
    </main>
  )
}

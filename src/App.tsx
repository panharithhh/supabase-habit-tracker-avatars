import { isConfigured, supabase } from './lib/supabase'
import { useSession } from './lib/useSession'
import AuthForm from './components/AuthForm'
import HabitList from './components/HabitList'

export default function App() {
  return isConfigured ? <Main /> : <MissingConfig />
}

function Main() {
  const session = useSession()

  if (session === undefined) return <p className="muted center">Loading…</p>
  if (!session) return <AuthForm />

  return (
    <main>
      <header className="topbar">
        <h1>Habits</h1>
        <div className="who">
          <span className="muted">{session.user.email}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      {/* Keyed by user so switching accounts never flashes the previous list. */}
      <HabitList key={session.user.id} />
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

import { supabase } from '../lib/supabase'
import { crashTest } from '../lib/crashTest'
import Avatar from './Avatar'

type Props = { email: string; avatarUrl: string | null | undefined }

export default function Nav({ email, avatarUrl }: Props) {
  crashTest('nav')

  return (
    <header className="topbar">
      <h1>Habits</h1>
      <div className="who">
        <Avatar src={avatarUrl} email={email} size={32} />
        <span className="muted">{email}</span>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </header>
  )
}

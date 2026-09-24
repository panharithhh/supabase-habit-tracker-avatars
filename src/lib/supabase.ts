import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(url && key)

// The session is persisted to localStorage, so a refresh keeps you signed in.
// The placeholders are never called: App shows setup instructions instead.
export const supabase = createClient(url || 'http://localhost', key || 'missing')

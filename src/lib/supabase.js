import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Copy .env.example to .env and add your project URL and anon key.'
  )
}

// Workaround: supabase-js v2 uses navigator.locks internally which can hang
// in development (Vite HMR, React StrictMode). Disabling it forces the client
// to use a simple fallback that doesn't require lock acquisition.
if (typeof navigator !== 'undefined' && navigator.locks) {
  Object.defineProperty(navigator, 'locks', {
    value: undefined,
    configurable: true,
    writable: true,
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(undefined) // undefined = not yet fetched, null = no profile row
  const [loading, setLoading] = useState(true)
  const initialised = useRef(false)

  // Fetch the user's profile from the profiles table
  // Returns { data, error } so callers can distinguish "no row" from "fetch failed"
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      return { data: null, error }
    }
    return { data, error: null }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s)

        if (s?.user) {
          const result = await fetchProfile(s.user.id)
          if (!result.error) {
            // Fetch succeeded — update profile (data is null if no row exists)
            setProfile(result.data)
          }
          // If fetch failed, keep the existing profile rather than
          // overwriting with null (which would trigger Complete Profile redirect)
        } else {
          setProfile(undefined)
        }

        // Mark loading done on the first event (INITIAL_SESSION)
        if (!initialised.current) {
          initialised.current = true
          setLoading(false)
        }
      }
    )

    // Safety net: if no auth event fires within 5 seconds, stop loading anyway
    const safetyTimeout = setTimeout(() => {
      if (!initialised.current) {
        console.warn('Auth: no session event received, proceeding as unauthenticated')
        initialised.current = true
        setLoading(false)
      }
    }, 5000)

    // Recover session when the tab becomes visible again.
    // Browsers throttle timers in background tabs, so the auto-refresh
    // can silently miss its window. This forces a fresh check.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.startAutoRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Sign in with email and password
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // Sign in with Google OAuth
  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/timesheet',
      },
    })
    if (error) throw error
    return data
  }

  // Sign out — always clear local state, even if the session is already dead
  async function signOut() {
    setSession(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Sign out error (session may have expired):', err.message)
    }
  }

  // Update password (for first-time invite users)
  async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }

  // Update profile
  async function updateProfile(updates) {
    const userId = session?.user?.id
    if (!userId) throw new Error('No authenticated user')

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) throw error

    // Re-fetch the full profile to update local state
    const result = await fetchProfile(userId)
    if (!result.error) setProfile(result.data)
    return result.data
  }

  // Refresh profile from DB
  async function refreshProfile() {
    if (session?.user) {
      const result = await fetchProfile(session.user.id)
      if (!result.error) setProfile(result.data)
    }
  }

  const isManager = profile?.role === 'resource_manager' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'
  const profileComplete = profile?.profile_complete ?? false

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isManager,
    isAdmin,
    profileComplete,
    signIn,
    signInWithGoogle,
    signOut,
    updatePassword,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

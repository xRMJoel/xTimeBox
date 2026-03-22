import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialised = useRef(false)

  // Fetch the user's profile from the profiles table
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }
    return data
  }

  useEffect(() => {
    // Use onAuthStateChange with INITIAL_SESSION event instead of getSession()
    // This avoids the navigator.locks hang in supabase-js v2
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s)

        if (s?.user) {
          const p = await fetchProfile(s.user.id)
          setProfile(p)
        } else {
          setProfile(null)
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

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
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
    const updated = await fetchProfile(userId)
    setProfile(updated)
    return updated
  }

  // Refresh profile from DB
  async function refreshProfile() {
    if (session?.user) {
      const p = await fetchProfile(session.user.id)
      setProfile(p)
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

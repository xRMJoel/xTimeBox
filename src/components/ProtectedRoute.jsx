import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children, requireManager = false }) {
  const { session, profile, loading, isManager, profileComplete } = useAuth()
  const location = useLocation()
  const [profileTimedOut, setProfileTimedOut] = useState(false)

  // Safety net: if profile stays undefined for 6 seconds after auth loads,
  // stop waiting — treat it as "no profile" so the app doesn't hang
  useEffect(() => {
    if (loading || profile !== undefined) {
      setProfileTimedOut(false)
      return
    }
    const timer = setTimeout(() => setProfileTimedOut(true), 6000)
    return () => clearTimeout(timer)
  }, [loading, profile])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Signing you in..." />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Profile is still being fetched (undefined) — wait, but not forever
  if (profile === undefined && !profileTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading your profile..." />
      </div>
    )
  }

  // Redirect to complete-profile if profile is explicitly incomplete
  // profile_complete must be exactly false (not null/undefined from a missing profile)
  if (profile && profile.profile_complete === false && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  // If no profile row exists at all (null), redirect to complete-profile to create one
  if (profile === null && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  if (requireManager && !isManager) {
    return <Navigate to="/timesheet" replace />
  }

  return children
}

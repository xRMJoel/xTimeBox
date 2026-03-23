import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingSpinner from './LoadingSpinner'

export default function ProtectedRoute({ children, requireManager = false }) {
  const { session, profile, loading, isManager, profileComplete } = useAuth()
  const location = useLocation()

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

  // Profile is still being fetched (undefined) — wait, don't redirect yet
  if (profile === undefined) {
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

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requireManager = false }) {
  const { session, profile, loading, isManager, profileComplete } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Redirect to complete-profile if profile is explicitly incomplete
  // profile_complete must be exactly false (not null/undefined from a missing profile)
  if (profile && profile.profile_complete === false && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  // If no profile row exists at all, redirect to complete-profile to create one
  if (!profile && session && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  if (requireManager && !isManager) {
    return <Navigate to="/timesheet" replace />
  }

  return children
}

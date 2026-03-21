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

  // Redirect to complete-profile if profile is incomplete
  // (but don't redirect if already on the complete-profile page)
  if (!profileComplete && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />
  }

  if (requireManager && !isManager) {
    return <Navigate to="/timesheet" replace />
  }

  return children
}

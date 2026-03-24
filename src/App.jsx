import { Routes, Route, Navigate } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CompleteProfilePage from './pages/CompleteProfilePage'
import HomePage from './pages/HomePage'
import TimesheetPage from './pages/TimesheetPage'
import MyEntriesPage from './pages/MyEntriesPage'
import AdminPage from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import ReportsPage from './pages/ReportsPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <>
    <Analytics />
    <SpeedInsights />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/complete-profile"
        element={
          <ProtectedRoute>
            <CompleteProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Layout><HomePage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/timesheet"
        element={
          <ProtectedRoute>
            <Layout><TimesheetPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-entries"
        element={
          <ProtectedRoute>
            <Layout><MyEntriesPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout><ProfilePage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout><ReportsPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireManager>
            <Layout><AdminPage /></Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function ForgotPasswordPage() {
  const { theme } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (resetErr) throw resetErr
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass-card-accent rounded-2xl w-full max-w-md p-8 text-center space-y-5">
          <div className="icon-badge-gradient w-14 h-14 mx-auto" style={{ borderRadius: '14px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>mark_email_read</span>
          </div>
          <h2 className="font-headline font-black text-2xl text-on-surface">Check your email</h2>
          <p className="text-base text-on-surface-variant">
            We've sent a password reset link to <strong className="text-on-surface">{email}</strong>.
            Click the link in the email to set a new password.
          </p>
          <p className="text-sm text-outline">
            Didn't receive it? Check your spam folder or try again.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-sm text-primary hover:text-primary-dim transition-colors font-medium"
            >
              Try again
            </button>
            <Link to="/login" className="text-sm text-on-surface-variant hover:text-white transition-colors font-medium">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link to="/login"><img src={theme === 'light' ? '/logo-light.png' : '/logo.png'} alt="xTimeBox" className="h-14 mx-auto mb-4" /></Link>
        <p className="text-on-surface-variant text-base">Reset your password</p>
      </div>

      {/* Form card */}
      <div className="glass-card-accent rounded-2xl w-full max-w-md p-8 space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,113,108,0.06)', border: 'var(--color-outline-variant)', color: '#ff716c' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            {error}
          </div>
        )}

        <p className="text-sm text-on-surface-variant text-center">
          Enter the email address you signed up with and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark"
              placeholder="name@company.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="signature-gradient-bg w-full py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-outline mt-6">
        Remembered your password?{' '}
        <Link to="/login" className="text-primary hover:text-primary-dim transition-colors font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}

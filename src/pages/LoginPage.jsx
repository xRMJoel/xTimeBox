import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/home')
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Invalid credentials. Please verify your email and password.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link to="/login"><img src={theme === 'light' ? '/logo-light.png' : '/logo.png'} alt="xTimeBox" className="h-14 mx-auto mb-4" /></Link>
        <p className="text-on-surface-variant text-base">Sign in to log your time</p>
      </div>

      {/* Login card */}
      <div className="glass-card-accent rounded-2xl w-full max-w-md p-8 space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,113,108,0.06)', border: 'var(--color-outline-variant)', color: '#ff716c' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            {error}
          </div>
        )}

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-dim transition-colors font-medium">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="signature-gradient-bg w-full py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border-subtle)' }}></div>
          <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Or continue with</span>
          <div className="flex-1 h-px" style={{ background: 'var(--glass-border-subtle)' }}></div>
        </div>

        {/* Social login */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="glass-card-inset flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant transition-all hover:text-on-surface hover:bg-[var(--white-alpha-5)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.41v2h2.58c1.51-1.39 2.38-3.44 2.38-5.87z" fill="#4285F4"/>
              <path d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.59-2a4.77 4.77 0 01-7.12-2.51H.96v2.06A8 8 0 008 16z" fill="#34A853"/>
              <path d="M3.58 9.54a4.8 4.8 0 010-3.07V4.41H.96a8 8 0 000 7.19l2.62-2.06z" fill="#FBBC05"/>
              <path d="M8 3.18a4.33 4.33 0 013.07 1.2l2.3-2.3A7.72 7.72 0 008 0 8 8 0 00.96 4.41l2.62 2.06A4.77 4.77 0 018 3.18z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            disabled
            className="glass-card-inset flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-outline cursor-not-allowed opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>badge</span>
            SSO
          </button>
        </div>
      </div>

      <p className="text-center text-sm text-outline mt-6">
        Need an account?{' '}
        <Link to="/register" className="text-primary hover:text-primary-dim transition-colors font-medium">
          Create one here
        </Link>
      </p>
    </div>
  )
}

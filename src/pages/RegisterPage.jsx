import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, company },
        },
      })

      if (signUpErr) throw signUpErr

      if (data.user && !data.session) {
        setSuccess(true)
      } else {
        navigate('/home')
      }
    } catch (err) {
      setError(
        err.message === 'User already registered'
          ? 'An account with this email already exists. Try signing in instead.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass-card-accent rounded-2xl w-full max-w-md p-8 text-center space-y-5">
          <div className="icon-badge-gradient w-14 h-14 mx-auto" style={{ borderRadius: '14px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>mark_email_read</span>
          </div>
          <h2 className="font-headline font-black text-2xl text-white">Check your email</h2>
          <p className="text-base text-on-surface-variant">
            We've sent a confirmation link to <strong className="text-white">{email}</strong>.
            Click the link to activate your account.
          </p>
          <Link to="/login" className="inline-block text-sm text-primary hover:text-primary-dim transition-colors font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="xTimeBox" className="h-14 mx-auto mb-4" />
        <p className="text-on-surface-variant text-base">Create your account</p>
      </div>

      {/* Register card */}
      <div className="glass-card-accent rounded-2xl w-full max-w-md p-8 space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(255,113,108,0.06)', border: '1px solid rgba(255,113,108,0.2)', color: '#ff716c' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Full Name *</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark" placeholder="Joel Abbott" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Email Address *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" placeholder="name@company.com" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark pr-10"
                placeholder="Min. 6 characters"
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

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Phone Number *</label>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="input-dark" placeholder="+44 7700 900000" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Company / Organisation *</label>
            <input type="text" required value={company} onChange={(e) => setCompany(e.target.value)} className="input-dark" placeholder="xRM365" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="signature-gradient-bg w-full py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:transform-none"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-outline mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:text-primary-dim transition-colors font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}

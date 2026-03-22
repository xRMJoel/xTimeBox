import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function CompleteProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const meta = user?.user_metadata || {}
  const [fullName, setFullName] = useState(profile?.full_name || meta.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || meta.phone || '')
  const [company, setCompany] = useState(profile?.company || meta.company || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userId = user?.id
      if (!userId) throw new Error('No authenticated user. Try signing in again.')

      const updates = {
        id: userId,
        email: user.email,
        full_name: fullName,
        phone,
        company,
        profile_complete: true,
      }

      // Use upsert directly — handles both new and existing profile rows
      const { error: upsertErr } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' })

      if (upsertErr) throw upsertErr

      await refreshProfile()
      navigate('/home')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link to="/home"><img src="/logo.png" alt="xTimeBox" className="h-14 mx-auto mb-4" /></Link>
        <h1 className="font-headline font-black text-2xl text-white mt-4">Complete your profile</h1>
        <p className="text-on-surface-variant text-base mt-2">
          Just a few details before you get started.
        </p>
      </div>

      {/* Form card */}
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
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark" placeholder="Your full name" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Email</label>
            <input type="email" value={user?.email || ''} disabled className="input-dark opacity-50 cursor-not-allowed" />
            <p className="text-xs text-outline mt-1">Email is set from your login and cannot be changed here.</p>
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
            {loading ? 'Saving...' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  )
}

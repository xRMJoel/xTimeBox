import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import DatePicker from '../components/DatePicker'

const NWD_REASONS = ['Holiday', 'Training', 'Sick Leave', 'Personal', 'Bank Holiday', 'Other']

export default function ProfilePage() {
  const { profile, user, updateProfile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [company, setCompany] = useState(profile?.company || '')
  const [newEmail, setNewEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const fileInputRef = useRef(null)

  // Non-working days state
  const [nwdList, setNwdList] = useState([])
  const [nwdDate, setNwdDate] = useState('')
  const [nwdReason, setNwdReason] = useState('Holiday')
  const [nwdCustomReason, setNwdCustomReason] = useState('')
  const [nwdAdding, setNwdAdding] = useState(false)
  const [nwdLoading, setNwdLoading] = useState(true)

  const loadNonWorkingDays = useCallback(async () => {
    if (!user?.id) return
    setNwdLoading(true)
    try {
      const { data, error } = await supabase
        .from('non_working_days')
        .select('id, entry_date, reason')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false })
      if (error) throw error
      setNwdList(data || [])
    } catch (err) {
      console.error('Failed to load non-working days:', err)
    } finally {
      setNwdLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadNonWorkingDays() }, [loadNonWorkingDays])

  async function handleAddNwd(e) {
    e.preventDefault()
    if (!nwdDate || !user?.id) return
    const reason = nwdReason === 'Other' ? nwdCustomReason.trim() : nwdReason
    if (!reason) { setMessage({ type: 'error', text: 'Please enter a reason.' }); return }

    // Check for weekend
    const dayOfWeek = new Date(nwdDate + 'T12:00:00').getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setMessage({ type: 'error', text: 'Weekends cannot be marked as non-working days.' })
      return
    }

    // Check for duplicate
    if (nwdList.some((d) => d.entry_date === nwdDate)) {
      setMessage({ type: 'error', text: 'That date is already marked as a non-working day.' })
      return
    }

    setNwdAdding(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('non_working_days').insert({ user_id: user.id, entry_date: nwdDate, reason })
      if (error) throw error
      setNwdDate('')
      setNwdCustomReason('')
      await loadNonWorkingDays()
      setMessage({ type: 'success', text: 'Non-working day added.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setNwdAdding(false)
    }
  }

  const nwdHighlightDates = useMemo(() => new Set(nwdList.map((d) => d.entry_date)), [nwdList])

  async function handleDeleteNwd(id) {
    try {
      const { error } = await supabase.from('non_working_days').delete().eq('id', id)
      if (error) throw error
      setNwdList((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  function resetForm() {
    setFullName(profile?.full_name || '')
    setPhone(profile?.phone || '')
    setCompany(profile?.company || '')
    setNewEmail('')
    setEditing(false)
    setMessage(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({ full_name: fullName, phone, company })

      // If user entered a new email, request the change via Supabase Auth
      const emailChanged = newEmail && newEmail.toLowerCase() !== user?.email?.toLowerCase()
      if (emailChanged) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail })
        if (emailErr) throw emailErr
        setNewEmail('')
        setEditing(false)
        setMessage({ type: 'success', text: 'Profile updated. A confirmation link has been sent to your new email address -- click it to complete the change.' })
      } else {
        setEditing(false)
        setMessage({ type: 'success', text: 'Profile updated.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage({ type: 'error', text: 'Please select an image file.' }); return }
    if (file.size > 2 * 1024 * 1024) { setMessage({ type: 'error', text: 'Image must be under 2MB.' }); return }

    setUploading(true)
    setMessage(null)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()
      await updateProfile({ avatar_url: publicUrl })
      setAvatarUrl(publicUrl)
      setMessage({ type: 'success', text: 'Profile image updated.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true)
    setMessage(null)
    try {
      const { data: files } = await supabase.storage.from('avatars').list(user.id)
      if (files?.length) {
        const paths = files.map((f) => `${user.id}/${f.name}`)
        await supabase.storage.from('avatars').remove(paths)
      }
      await updateProfile({ avatar_url: null })
      setAvatarUrl('')
      setMessage({ type: 'success', text: 'Profile image removed.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  const initials = fullName ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase() : 'U'
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Account Settings</p>
        <h1 className="text-5xl font-black font-headline text-on-surface tracking-tight">My Profile</h1>
        <p className="text-on-surface-variant mt-3">Manage your personal details, preferences and account information.</p>
      </div>

      {message && (
        <div className={`glass-card rounded-xl p-4 flex items-center gap-3 ${
          message.type === 'success' ? 'border-green-400/20' : 'border-error/20'
        }`} style={{ background: message.type === 'success' ? 'rgba(74,222,128,0.05)' : 'rgba(255,113,108,0.05)' }}>
          <span className={`material-symbols-outlined ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>{message.text}</p>
        </div>
      )}

      {/* Avatar section */}
      <div className="glass-card-accent rounded-2xl p-8">
        <div className="flex items-center gap-6">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="w-20 h-20 rounded-full object-cover border-2 border-white/10" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white signature-gradient-bg">{initials}</div>
            )}
            <button
              type="button"
              onClick={() => setShowAvatarDialog(true)}
              disabled={uploading}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: '24px' }}>photo_camera</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>

          <div className="flex-1">
            <h2 className="font-headline font-bold text-2xl text-on-surface">{fullName || 'Your Name'}</h2>
            <p className="text-base text-on-surface-variant">{user?.email}</p>
            {memberSince && <p className="text-sm text-outline mt-1">Member since {memberSince}</p>}
            <div className="flex items-center gap-3 mt-3">
              <button type="button" onClick={() => setShowAvatarDialog(true)} disabled={uploading}
                className="text-xs text-primary hover:text-primary-dim transition-colors font-medium disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Change photo'}
              </button>
              {avatarUrl && (
                <button type="button" onClick={handleRemoveAvatar} disabled={uploading}
                  className="text-xs text-error hover:text-error-dim transition-colors font-medium disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile details */}
      <div className="glass-card rounded-2xl p-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>person</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface">Details</h3>
          </div>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-primary hover:text-primary-dim transition-colors font-medium">
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Full Name</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Email</label>
              <input type="email" value={newEmail || user?.email || ''} onChange={(e) => setNewEmail(e.target.value)} className="input-dark w-full" placeholder={user?.email} />
              {newEmail && newEmail.toLowerCase() !== user?.email?.toLowerCase() && (
                <p className="text-xs text-primary mt-1">A confirmation link will be sent to the new address when you save.</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-dark w-full" placeholder="+44 7700 900000" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Company / Organisation</label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="input-dark w-full" placeholder="xRM365" />
            </div>
            <div className="flex items-center gap-4 pt-2">
              <button type="submit" disabled={saving} className="btn-gradient text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" onClick={resetForm} className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Full Name</p>
              <p className="text-base text-on-surface">{profile?.full_name || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Email</p>
              <p className="text-base text-on-surface">{user?.email || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Phone</p>
              <p className="text-base text-on-surface">{profile?.phone || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Company</p>
              <p className="text-base text-on-surface">{profile?.company || '-'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="glass-card rounded-2xl p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>shield</span>
          </div>
          <h3 className="font-headline font-bold text-xl text-on-surface">Account</h3>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Role</p>
            <p className="text-base text-on-surface capitalize">{profile?.role?.replace('_', ' ') || 'User'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Default Client</p>
            <p className="text-base text-on-surface">{profile?.default_client || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Non-working days */}
      <div className="glass-card rounded-2xl p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>event_busy</span>
          </div>
          <h3 className="font-headline font-bold text-xl text-on-surface">Non-Working Days</h3>
        </div>

        <form onSubmit={handleAddNwd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Date</label>
            <DatePicker
              value={nwdDate}
              onChange={setNwdDate}
              highlightDates={nwdHighlightDates}
              disableWeekends
              placeholder="Pick a date"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Reason</label>
            <select
              value={nwdReason}
              onChange={(e) => setNwdReason(e.target.value)}
              className="input-dark w-full"
            >
              {NWD_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {nwdReason === 'Other' && (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Specify</label>
              <input
                type="text"
                value={nwdCustomReason}
                onChange={(e) => setNwdCustomReason(e.target.value)}
                placeholder="e.g. Doctor appointment"
                className="input-dark w-full"
                required
              />
            </div>
          )}
          <button type="submit" disabled={nwdAdding} className="btn-gradient text-sm disabled:opacity-50 whitespace-nowrap">
            {nwdAdding ? 'Adding...' : 'Add day'}
          </button>
        </form>

        {/* NWD list */}
        {nwdLoading ? (
          <p className="text-sm text-on-surface-variant">Loading...</p>
        ) : nwdList.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No non-working days recorded.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
            {nwdList.map((nwd) => {
              const d = new Date(nwd.entry_date + 'T12:00:00')
              const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
              const isPast = nwd.entry_date < new Date().toISOString().slice(0, 10)
              return (
                <div key={nwd.id} className={`flex items-center justify-between py-2 px-3 rounded-lg ${isPast ? 'opacity-50' : ''}`} style={{ background: 'var(--glass-bg)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-on-surface font-medium">{label}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-purple-400 bg-purple-400/10 border border-purple-400/20">
                      {nwd.reason || 'Non-working day'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNwd(nwd.id)}
                    className="text-on-surface-variant hover:text-error transition-colors p-1"
                    title="Remove"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Avatar upload dialogue */}
      {showAvatarDialog && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowAvatarDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(102,211,255,0.1)' }}>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '22px' }}>image</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface">Upload profile photo</h3>
              </div>
              <p className="text-sm text-on-surface-variant">Choose an image to use as your profile photo. This will be visible to other users.</p>
              <div className="glass-card-inset rounded-xl px-4 py-3 text-sm">
                <p className="text-primary font-medium text-xs mb-1">Requirements:</p>
                <ul className="text-on-surface-variant space-y-0.5 text-xs">
                  <li>Maximum file size: <span className="text-on-surface font-medium">2 MB</span></li>
                  <li>Accepted formats: JPG, PNG, GIF, WebP</li>
                  <li>Square images work best</li>
                </ul>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <button type="button" onClick={() => { setShowAvatarDialog(false); fileInputRef.current?.click() }} className="btn-gradient text-sm">
                  Choose image
                </button>
                <button type="button" onClick={() => setShowAvatarDialog(false)} className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

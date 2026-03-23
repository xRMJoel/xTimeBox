import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { profile, user, updateProfile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [company, setCompany] = useState(profile?.company || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const fileInputRef = useRef(null)

  function resetForm() {
    setFullName(profile?.full_name || '')
    setPhone(profile?.phone || '')
    setCompany(profile?.company || '')
    setEditing(false)
    setMessage(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateProfile({ full_name: fullName, phone, company })
      setEditing(false)
      setMessage({ type: 'success', text: 'Profile updated.' })
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
              <input type="email" value={user?.email || ''} disabled className="input-dark w-full opacity-50 cursor-not-allowed" />
              <p className="text-xs text-outline mt-1">Email cannot be changed here.</p>
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

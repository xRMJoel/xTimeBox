import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { localDateStr } from '../lib/constants'
import DatePicker from '../components/DatePicker'

const NWD_REASONS = ['Holiday', 'Training', 'Sick Leave', 'Personal', 'Bank Holiday', 'Other']

// Reason badge colour mapping
const REASON_COLOURS = {
  Holiday:      { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  Training:     { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  'Sick Leave': { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  Personal:     { text: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20' },
  'Bank Holiday': { text: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
}
const DEFAULT_REASON_COLOUR = { text: 'text-on-surface-variant', bg: 'bg-white/5', border: 'border-white/10' }

function NwdRow({ nwd, onDelete, isPast }) {
  const d = new Date(nwd.entry_date + 'T12:00:00')
  const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const rc = REASON_COLOURS[nwd.reason] || DEFAULT_REASON_COLOUR

  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${isPast ? 'opacity-50' : ''}`} style={{ background: 'var(--glass-bg)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0" style={{ fontSize: '16px' }}>
          {isPast ? 'event_available' : 'event_upcoming'}
        </span>
        <span className="text-sm text-on-surface font-medium">{label}</span>
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${rc.text} ${rc.bg} border ${rc.border}`}>
          {nwd.reason || 'Non-working day'}
        </span>
      </div>
      {!isPast && (
        <button
          type="button"
          onClick={() => onDelete(nwd.id)}
          className="text-on-surface-variant hover:text-error transition-colors p-1 flex-shrink-0"
          title="Remove"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
        </button>
      )}
    </div>
  )
}

function NwdListSections({ nwdList, onDelete }) {
  const [showPast, setShowPast] = useState(false)
  const todayStr = localDateStr(new Date())

  const upcoming = nwdList.filter((n) => n.entry_date >= todayStr).sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  const past = nwdList.filter((n) => n.entry_date < todayStr).sort((a, b) => b.entry_date.localeCompare(a.entry_date))

  return (
    <div className="space-y-4">
      {/* Upcoming */}
      {upcoming.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-1">Upcoming</p>
          {upcoming.map((nwd) => (
            <NwdRow key={nwd.id} nwd={nwd} onDelete={onDelete} isPast={false} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">No upcoming non-working days.</p>
      )}

      {/* Past — collapsed by default */}
      {past.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors w-full"
          >
            <span
              className="material-symbols-outlined transition-transform duration-200"
              style={{ fontSize: '18px', transform: showPast ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              chevron_right
            </span>
            <span className="font-medium">Past non-working days</span>
            <span className="text-xs text-outline">({past.length})</span>
          </button>
          {showPast && (
            <div className="space-y-1.5 mt-2 max-h-60 overflow-y-auto pr-1">
              {past.map((nwd) => (
                <NwdRow key={nwd.id} nwd={nwd} onDelete={onDelete} isPast={true} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [nwdDateRange, setNwdDateRange] = useState({ start: '', end: '' })
  const [nwdReason, setNwdReason] = useState('Holiday')
  const [nwdCustomReason, setNwdCustomReason] = useState('')
  const [nwdAdding, setNwdAdding] = useState(false)
  const [nwdLoading, setNwdLoading] = useState(true)
  const [nwdConflict, setNwdConflict] = useState(null) // { draftDates, blockedDates, pendingDates, reason }

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

  // Expand a date range to an array of weekday YYYY-MM-DD strings
  function expandRange(start, end) {
    const dates = []
    const endStr = end || start
    const d = new Date(start + 'T12:00:00')
    const last = new Date(endStr + 'T12:00:00')
    while (d <= last) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) dates.push(localDateStr(d))
      d.setDate(d.getDate() + 1)
    }
    return dates
  }

  async function handleAddNwd(e) {
    e.preventDefault()
    if (!nwdDateRange.start || !user?.id) return
    const reason = nwdReason === 'Other' ? nwdCustomReason.trim() : nwdReason
    if (!reason) { setMessage({ type: 'error', text: 'Please enter a reason.' }); return }

    const allDates = expandRange(nwdDateRange.start, nwdDateRange.end)
    if (allDates.length === 0) { setMessage({ type: 'error', text: 'No weekdays in the selected range.' }); return }

    // Filter out dates already marked as NWD
    const existingNwdSet = new Set(nwdList.map((d) => d.entry_date))
    const newDates = allDates.filter((d) => !existingNwdSet.has(d))
    if (newDates.length === 0) {
      setMessage({ type: 'error', text: allDates.length === 1 ? 'That date is already a non-working day.' : 'All dates in this range are already non-working days.' })
      return
    }

    // Check for existing entries on these dates
    setNwdAdding(true)
    setMessage(null)
    try {
      const { data: entries } = await supabase
        .from('timesheet_entries')
        .select('entry_date, status')
        .eq('user_id', user.id)
        .in('entry_date', newDates)

      const draftDates = [] // draft or returned — can be removed
      const blockedDates = [] // submitted or signed_off — cannot be overridden
      const entryDateSet = new Set()

      for (const entry of (entries || [])) {
        if (entryDateSet.has(entry.entry_date)) continue // already categorised
        entryDateSet.add(entry.entry_date)
        if (entry.status === 'submitted' || entry.status === 'signed_off') {
          blockedDates.push(entry.entry_date)
        } else {
          draftDates.push(entry.entry_date)
        }
      }

      // Re-check: some dates might have both draft and submitted entries
      // Fetch full picture per date
      if (entries && entries.length > 0) {
        const dateStatuses = {}
        for (const entry of entries) {
          if (!dateStatuses[entry.entry_date]) dateStatuses[entry.entry_date] = new Set()
          dateStatuses[entry.entry_date].add(entry.status)
        }
        draftDates.length = 0
        blockedDates.length = 0
        for (const [date, statuses] of Object.entries(dateStatuses)) {
          if (statuses.has('submitted') || statuses.has('signed_off')) {
            blockedDates.push(date)
          } else {
            draftDates.push(date)
          }
        }
      }

      const pendingDates = newDates.filter((d) => !entryDateSet.has(d))

      if (draftDates.length > 0 || blockedDates.length > 0) {
        // Show conflict dialog
        setNwdConflict({ draftDates: draftDates.sort(), blockedDates: blockedDates.sort(), pendingDates: pendingDates.sort(), reason })
        setNwdAdding(false)
        return
      }

      // No conflicts — insert all
      await insertNwdDates(pendingDates, reason)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      setNwdAdding(false)
    }
  }

  async function insertNwdDates(dates, reason) {
    if (dates.length === 0) return
    try {
      const rows = dates.map((d) => ({ user_id: user.id, entry_date: d, reason }))
      const { error } = await supabase.from('non_working_days').insert(rows)
      if (error) throw error
      setNwdDateRange({ start: '', end: '' })
      setNwdCustomReason('')
      await loadNonWorkingDays()
      const count = dates.length
      setMessage({ type: 'success', text: count === 1 ? 'Non-working day added.' : `${count} non-working days added.` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setNwdAdding(false)
    }
  }

  async function handleConflictConfirm() {
    // User confirmed: delete draft entries on draftDates, then insert NWD for draftDates + pendingDates
    const { draftDates, pendingDates, reason } = nwdConflict
    setNwdConflict(null)
    setNwdAdding(true)
    try {
      // Delete draft/returned entries on the affected dates
      if (draftDates.length > 0) {
        const { error } = await supabase
          .from('timesheet_entries')
          .delete()
          .eq('user_id', user.id)
          .in('entry_date', draftDates)
          .in('status', ['draft', 'returned'])
        if (error) throw error
      }
      await insertNwdDates([...draftDates, ...pendingDates], reason)
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      setNwdAdding(false)
    }
  }

  function handleConflictSkipBlocked() {
    // Insert NWD only for non-blocked dates (pending + draft after removal)
    const { draftDates, pendingDates, reason } = nwdConflict
    if (draftDates.length > 0) {
      // Still need to confirm draft removal
      handleConflictConfirm()
    } else {
      // Only blocked dates — just insert the pending ones
      setNwdConflict(null)
      setNwdAdding(true)
      insertNwdDates(pendingDates, reason)
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
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Date or Range</label>
            <DatePicker
              value={nwdDateRange}
              onChange={setNwdDateRange}
              userId={user?.id}
              highlightDates={nwdHighlightDates}
              disableWeekends
              placeholder="Pick a date or range"
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
            {nwdAdding ? 'Adding...' : 'Add days'}
          </button>
        </form>

        {/* NWD list — split into upcoming and past */}
        {nwdLoading ? (
          <p className="text-sm text-on-surface-variant">Loading...</p>
        ) : nwdList.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No non-working days recorded.</p>
        ) : <NwdListSections nwdList={nwdList} onDelete={handleDeleteNwd} />}
      </div>

      {/* Conflict dialog */}
      {nwdConflict && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => { setNwdConflict(null); setNwdAdding(false) }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '22px' }}>warning</span>
                </div>
                <h3 className="font-headline font-bold text-lg text-on-surface">Entry conflicts found</h3>
              </div>

              {nwdConflict.blockedDates.length > 0 && (
                <div className="glass-card-inset rounded-xl px-4 py-3">
                  <p className="text-sm text-error font-medium mb-2">Cannot add non-working days on these dates:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nwdConflict.blockedDates.map((d) => (
                      <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20">
                        {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">
                    These dates have submitted or signed-off entries. Ask your Resource Admin to return them first.
                  </p>
                </div>
              )}

              {nwdConflict.draftDates.length > 0 && (
                <div className="glass-card-inset rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-400 font-medium mb-2">Draft entries will be removed on these dates:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nwdConflict.draftDates.map((d) => (
                      <span key={d} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                        {new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nwdConflict.pendingDates.length > 0 && (
                <p className="text-sm text-on-surface-variant">
                  {nwdConflict.pendingDates.length} {nwdConflict.pendingDates.length === 1 ? 'date' : 'dates'} will be added without conflicts.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                {(nwdConflict.draftDates.length > 0 || nwdConflict.pendingDates.length > 0) && (
                  <button
                    type="button"
                    onClick={nwdConflict.draftDates.length > 0 ? handleConflictConfirm : handleConflictSkipBlocked}
                    className="btn-gradient text-sm"
                  >
                    {nwdConflict.draftDates.length > 0 ? 'Remove entries and add NWD' : 'Add remaining days'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setNwdConflict(null); setNwdAdding(false) }}
                  className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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

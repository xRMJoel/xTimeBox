import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEntries, useSignoffs } from '../hooks/useEntries'
import StatusBadge from '../components/StatusBadge'
import EntryCard from '../components/EntryCard'
import { formatDate, getMonthLabel, getMonthStart } from '../lib/constants'
import { supabase } from '../lib/supabase'

// Get current month start
function currentMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

// Navigate months
function shiftMonth(monthStart, delta) {
  const d = new Date(monthStart + 'T12:00:00')
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 10)
}

// ── User detail view ──
function UserDetail({ userId, userName, monthStart, onBack }) {
  const { fetchAllEntries, loading, returnWeekEntries } = useEntries()
  const { signOffMonth, revokeSignoff, fetchSignoffs } = useSignoffs()
  const [entries, setEntries] = useState([])
  const [signoff, setSignoff] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [returningWeek, setReturningWeek] = useState(null)
  const [returnReason, setReturnReason] = useState('')

  const loadData = useCallback(async () => {
    const [entriesData, signoffsData] = await Promise.all([
      fetchAllEntries({ userId, monthStart }),
      fetchSignoffs(monthStart),
    ])
    setEntries(entriesData)
    const userSignoff = signoffsData.find((s) => s.user_id === userId)
    setSignoff(userSignoff || null)
  }, [userId, monthStart, fetchAllEntries, fetchSignoffs])

  useEffect(() => { loadData() }, [loadData])

  const weekGroups = entries.reduce((groups, entry) => {
    const key = entry.week_ending
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
    return groups
  }, {})

  const sortedWeeks = Object.keys(weekGroups).sort()
  const totalDays = entries.reduce((sum, e) => sum + Number(e.time_value), 0)

  async function handleSignOff() {
    setActionLoading(true)
    try {
      await signOffMonth(userId, monthStart)
      setMessage({ type: 'success', text: 'Month signed off.' })
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setActionLoading(false) }
  }

  async function handleRevoke() {
    if (!confirm('Revoke this sign-off? Entries will be unlocked for editing.')) return
    setActionLoading(true)
    try {
      await revokeSignoff(userId, monthStart)
      setMessage({ type: 'success', text: 'Sign-off revoked. Entries unlocked.' })
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setActionLoading(false) }
  }

  async function handleReturnWeek() {
    setActionLoading(true)
    try {
      await returnWeekEntries(userId, returningWeek, returnReason || null)
      setMessage({ type: 'success', text: 'Entries returned to user.' })
      setReturningWeek(null)
      setReturnReason('')
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setActionLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-base text-on-surface-variant hover:text-white transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span> Back
        </button>
        <div>
          <h2 className="font-headline font-black text-3xl text-white">{userName}</h2>
          <p className="text-base text-on-surface-variant">{getMonthLabel(monthStart)} · {totalDays} days total</p>
        </div>
      </div>

      {message && (
        <div className={`glass-card rounded-xl p-4 flex items-center gap-3 ${message.type === 'success' ? 'border-green-400/20' : 'border-error/20'}`}
          style={{ background: message.type === 'success' ? 'rgba(74,222,128,0.05)' : 'rgba(255,113,108,0.05)' }}>
          <span className={`material-symbols-outlined ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>{message.text}</p>
        </div>
      )}

      {/* Sign-off status */}
      <div className={`glass-card rounded-2xl p-5 flex items-center justify-between ${signoff ? 'border-green-400/20' : ''}`}>
        {signoff ? (
          <>
            <div>
              <p className="text-sm text-green-400 font-medium">Signed off</p>
              <p className="text-xs text-on-surface-variant">By {signoff.signer?.full_name} on {new Date(signoff.signed_off_at).toLocaleDateString('en-GB')}</p>
            </div>
            <button onClick={handleRevoke} disabled={actionLoading} className="text-sm text-error hover:text-error-dim font-medium transition-colors disabled:opacity-50">
              Revoke sign-off
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-white">Not yet signed off</p>
              <p className="text-xs text-on-surface-variant">{entries.length} entries for this month</p>
            </div>
            <button onClick={handleSignOff} disabled={actionLoading || entries.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {actionLoading ? 'Processing...' : 'Sign off month'}
            </button>
          </>
        )}
      </div>

      {loading && entries.length === 0 && <p className="text-on-surface-variant">Loading entries...</p>}

      {sortedWeeks.map((weekEnding) => {
        const weekEntries = weekGroups[weekEnding]
        const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.time_value), 0)
        const dayGroups = weekEntries.reduce((groups, entry) => {
          if (!groups[entry.entry_date]) groups[entry.entry_date] = []
          groups[entry.entry_date].push(entry)
          return groups
        }, {})
        const sortedDays = Object.keys(dayGroups).sort()

        return (
          <div key={weekEnding} className="glass-card rounded-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,201,255,0.12)', background: 'linear-gradient(135deg, rgba(0,201,255,0.04) 0%, rgba(123,47,219,0.04) 100%)' }}>
              <div className="flex items-center justify-between flex-1">
                <span className="text-base font-medium text-white">Week ending {formatDate(weekEnding)}</span>
                {weekEntries.some(e => e.status === 'submitted') && (
                  <button
                    onClick={() => setReturningWeek(weekEnding)}
                    className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
                    Return week
                  </button>
                )}
              </div>
              <span className="text-base font-bold text-primary">{weekTotal} days</span>
            </div>
            <div className="divide-y divide-white/5">
              {sortedDays.map((date) => (
                <div key={date} className="px-6 py-4">
                  <div className="text-base font-medium text-white mb-2">{dayGroups[date][0].day_name}, {formatDate(date)}</div>
                  <div className="space-y-2">
                    {dayGroups[date].map((entry) => <EntryCard key={entry.id} entry={entry} readonly />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {returningWeek && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>undo</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-white">Return entries</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              Return week ending {formatDate(returningWeek)} to {userName} for editing. Optionally add a reason.
            </p>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="input-dark w-full"
                placeholder="e.g. Missing project references for Tuesday"
              />
            </div>
            <div className="flex items-center justify-end gap-4 pt-2">
              <button onClick={() => { setReturningWeek(null); setReturnReason('') }} className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleReturnWeek} disabled={actionLoading}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                {actionLoading ? 'Returning...' : 'Return entries'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Invite modal ──
function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleInvite(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const tempPassword = crypto.randomUUID().slice(0, 16)
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email, password: tempPassword,
        options: { data: { full_name: fullName } },
      })
      if (signUpErr) throw signUpErr
      if (data.user && role !== 'user') {
        await supabase.from('profiles').update({ role, full_name: fullName }).eq('id', data.user.id)
      }
      onInvited({ email, tempPassword })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleInvite} className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>person_add</span>
          </div>
          <h3 className="font-headline font-bold text-xl text-white">Invite user</h3>
        </div>
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2" style={{ background: 'rgba(255,113,108,0.06)', border: '1px solid rgba(255,113,108,0.2)', color: '#ff716c' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>{error}
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Full name</label>
          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-dark w-full" placeholder="Jane Smith" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark w-full" placeholder="jane@xrm365.co.uk" />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input-dark w-full">
            <option value="user">User</option>
            <option value="resource_manager">Resource Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-4 pt-2">
          <button type="button" onClick={onClose} className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="btn-gradient text-sm disabled:opacity-50">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main admin page ──
export default function AdminPage() {
  const { user } = useAuth()
  const { fetchAdminSummary, loading } = useSignoffs()
  const [monthStart, setMonthStart] = useState(currentMonthStart())
  const [summary, setSummary] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)

  const loadSummary = useCallback(async () => {
    const data = await fetchAdminSummary(monthStart)
    setSummary(data)
  }, [monthStart, fetchAdminSummary])

  useEffect(() => {
    if (!selectedUser) loadSummary()
  }, [loadSummary, selectedUser])

  const signedOffCount = summary.filter((r) => r.is_signed_off).length
  const awaitingReviewCount = summary.filter((r) => !r.is_signed_off && r.submitted_count > 0).length
  const missingSubmissionsCount = summary.filter((r) => r.entry_count === 0).length

  if (selectedUser) {
    return (
      <UserDetail
        userId={selectedUser.user_id}
        userName={selectedUser.full_name}
        monthStart={monthStart}
        onBack={() => setSelectedUser(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Resource Management</p>
        <div className="flex items-center justify-between">
          <h1 className="text-5xl font-black font-headline text-white tracking-tight">Review Timesheets</h1>
          <button onClick={() => setShowInvite(true)} className="btn-gradient text-sm flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Invite user
          </button>
        </div>
        <p className="text-on-surface-variant mt-3">Review, approve and sign off team timesheets for the current period.</p>
      </div>

      {/* Invite result */}
      {inviteResult && (
        <div className="glass-card rounded-xl p-4 border-green-400/20" style={{ background: 'rgba(74,222,128,0.05)' }}>
          <p className="text-green-400 font-medium mb-1 text-sm">Account created for {inviteResult.email}</p>
          <p className="text-green-400/80 text-sm">
            Temporary password: <code className="bg-green-500/10 px-1.5 py-0.5 rounded font-mono text-xs">{inviteResult.tempPassword}</code>
          </p>
          <p className="text-green-400/60 text-xs mt-1">Share these credentials securely. The user should change their password on first login.</p>
        </div>
      )}

      {/* Month navigator */}
      <div className="glass-card-accent rounded-2xl p-6 flex items-center justify-center gap-6">
        <button onClick={() => setMonthStart(shiftMonth(monthStart, -1))} className="text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center min-w-[200px]">
          <p className="font-headline font-black text-white text-2xl">{getMonthLabel(monthStart)}</p>
          <p className="text-[10px] text-outline mt-1 uppercase tracking-widest font-bold">Reviewing {summary.length} active members</p>
        </div>
        <button onClick={() => setMonthStart(shiftMonth(monthStart, 1))} className="text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Stat cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Signed Off</p>
                <p className="text-3xl font-black text-green-400 font-headline">{signedOffCount} / {summary.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="material-symbols-outlined text-green-400" style={{ fontSize: '22px' }}>check_circle</span>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Awaiting Review</p>
                <p className="text-3xl font-black text-primary font-headline">{awaitingReviewCount}</p>
                <p className="text-sm text-on-surface-variant mt-1">Pending</p>
              </div>
              <div className="icon-badge-gradient w-10 h-10" style={{ borderRadius: '12px' }}>
                <span className="material-symbols-outlined text-white" style={{ fontSize: '22px' }}>schedule</span>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">Missing Submissions</p>
                <p className="text-3xl font-black text-amber-400 font-headline">{missingSubmissionsCount}</p>
                <p className="text-sm text-on-surface-variant mt-1">Overdue</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '22px' }}>warning</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary table */}
      {loading && summary.length === 0 && <p className="text-on-surface-variant text-center py-8">Loading...</p>}
      {!loading && summary.length === 0 && (
        <div className="glass-card-accent rounded-2xl p-12 text-center">
          <div className="icon-badge-gradient w-14 h-14 mx-auto mb-4" style={{ borderRadius: '14px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>event_busy</span>
          </div>
          <p className="text-on-surface-variant text-base">No entries for {getMonthLabel(monthStart)}.</p>
        </div>
      )}

      {summary.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-base">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,201,255,0.12)', background: 'linear-gradient(135deg, rgba(0,201,255,0.04) 0%, rgba(123,47,219,0.04) 100%)' }}>
                <th className="text-left px-6 py-3 text-[10px] font-bold text-outline uppercase tracking-widest">Name & Identity</th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-outline uppercase tracking-widest">Total Days</th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-outline uppercase tracking-widest">Entries</th>
                <th className="text-center px-6 py-3 text-[10px] font-bold text-outline uppercase tracking-widest">Status</th>
                <th className="text-right px-6 py-3 text-[10px] font-bold text-outline uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {summary.map((row) => (
                <tr key={row.user_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full signature-gradient-bg flex items-center justify-center text-white text-sm font-bold">
                        {row.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white text-base">{row.full_name}</div>
                        <div className="text-sm text-on-surface-variant">{row.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-primary">{row.total_days}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-on-surface-variant">{row.entry_count}</td>
                  <td className="px-6 py-4 text-center">
                    {row.is_signed_off ? (
                      <StatusBadge status="signed_off" />
                    ) : row.returned_count > 0 ? (
                      <StatusBadge status="returned" />
                    ) : row.submitted_count > 0 ? (
                      <StatusBadge status="submitted" />
                    ) : (
                      <StatusBadge status="draft" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setSelectedUser(row)} className="text-primary hover:text-primary-dim font-medium transition-colors flex items-center gap-1 ml-auto text-sm">
                      View Details
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-6 py-4 flex justify-end" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-white font-bold text-sm">
              Total across all users: <span className="text-primary">{summary.reduce((sum, r) => sum + Number(r.total_days), 0)} days</span>
            </p>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={(result) => { setShowInvite(false); setInviteResult(result) }}
        />
      )}
    </div>
  )
}

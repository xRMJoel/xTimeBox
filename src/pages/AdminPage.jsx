import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEntries, useSignoffs } from '../hooks/useEntries'
import StatusBadge from '../components/StatusBadge'
import EntryCard from '../components/EntryCard'
import { formatDate, getMonthLabel, getCurrentWeekFriday, getWorkingDaysInMonth, localDateStr } from '../lib/constants'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Helpers ──
function currentMonthStart() {
  const now = new Date()
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
}

function shiftMonth(monthStart, delta) {
  const d = new Date(monthStart + 'T12:00:00')
  d.setMonth(d.getMonth() + delta)
  return localDateStr(d)
}

// ── Collapsible week section for approval detail view with per-week sign-off ──
function CollapsibleWeekAdmin({ weekEnding, weekEntries, weekTotal, isSignedOff, hasSubmitted, hasDrafts, onSignOff, onUnsignOff, onReturnWeek, onDeleteWeek, onDeleteEntry, actionLoading, nonWorkingDays = new Map() }) {
  const [open, setOpen] = useState(false)
  const dayGroups = weekEntries.reduce((g, e) => { (g[e.entry_date] ||= []).push(e); return g }, {})

  // Find non-working days that fall within this week (Mon–Fri of weekEnding)
  const weDate = new Date(weekEnding + 'T12:00:00')
  const weekStart = new Date(weDate)
  weekStart.setDate(weDate.getDate() - 4) // Monday
  const nwdInWeek = [...nonWorkingDays.keys()].filter((d) => {
    return d >= localDateStr(weekStart) && d <= weekEnding
  })

  // Merge NWD dates into the day list so they appear in order
  const allDates = new Set([...Object.keys(dayGroups), ...nwdInWeek])
  const sortedDays = [...allDates].sort()

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${isSignedOff ? 'ring-1 ring-green-400/20' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer group"
        style={{ borderBottom: open ? '1px solid var(--week-header-border)' : 'none', background: 'var(--week-header-bg)' }}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" style={{ fontSize: '20px' }}>
            {open ? 'expand_more' : 'chevron_right'}
          </span>
          <span className="text-base font-medium text-on-surface">Week ending {formatDate(weekEnding)}</span>
          {isSignedOff && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-green-400 bg-green-400/10 border border-green-400/20">
              Signed off
            </span>
          )}
          {!isSignedOff && hasSubmitted && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-primary bg-primary/10 border border-primary/20">
              Submitted
            </span>
          )}
          {!isSignedOff && !hasSubmitted && hasDrafts && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-on-surface-variant bg-white/5 border border-white/10">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {isSignedOff ? (
            <button onClick={onUnsignOff} disabled={actionLoading}
              className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors flex items-center gap-1 disabled:opacity-50">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>lock_open</span>
              Revoke
            </button>
          ) : hasSubmitted ? (
            <button onClick={onSignOff} disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50">
              {actionLoading ? '...' : 'Sign off'}
            </button>
          ) : null}
          {!isSignedOff && hasSubmitted && (
            <button onClick={onReturnWeek}
              className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
              Return
            </button>
          )}
          <button onClick={onDeleteWeek}
            className="text-sm text-error hover:text-error-dim font-medium transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
            Delete
          </button>
          <span className="text-base font-bold text-primary ml-1">{weekTotal} days</span>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-[var(--glass-border-subtle)]">
          {sortedDays.map((date) => {
            const isNwd = nwdInWeek.includes(date)
            const hasEntries = dayGroups[date] && dayGroups[date].length > 0
            const dayName = hasEntries
              ? dayGroups[date][0].day_name
              : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })

            return (
              <div key={date} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-medium text-on-surface">{dayName}, {formatDate(date)}</span>
                  {isNwd && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10 border border-amber-400/20">
                      {nonWorkingDays.get(date) || 'Non-working day'}
                    </span>
                  )}
                </div>
                {hasEntries ? (
                  <div className="space-y-2">
                    {dayGroups[date].map((entry) => <EntryCard key={entry.id} entry={entry} onDelete={onDeleteEntry} />)}
                  </div>
                ) : isNwd ? (
                  <p className="text-sm text-on-surface-variant italic">No entries expected</p>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mini stat card for admin user cards ──
const MINI_COLOURS = {
  cyan:   { bg: 'rgba(0,201,255,0.06)',   border: 'rgba(0,201,255,0.15)',   text: 'text-primary' },
  purple: { bg: 'rgba(182,133,255,0.06)', border: 'rgba(182,133,255,0.15)', text: 'text-secondary' },
  yellow: { bg: 'rgba(250,204,21,0.06)',  border: 'rgba(250,204,21,0.15)',  text: 'text-yellow-400' },
  green:  { bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.15)',   text: 'text-green-400' },
  red:    { bg: 'rgba(255,113,108,0.06)', border: 'rgba(255,113,108,0.15)', text: 'text-error' },
}

function AdminMiniCard({ label, value, unit, colour }) {
  const c = MINI_COLOURS[colour] || MINI_COLOURS.cyan
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-outline mb-1">{label}</p>
      <span className={`text-lg font-heading font-black ${c.text}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span className="text-[10px] text-on-surface-variant ml-1">{unit}</span>
    </div>
  )
}

// ══════════════════════════════════════════════
// TAB 1: APPROVALS — grouped by project then user
// ══════════════════════════════════════════════

function ApprovalsTab() {
  const { user } = useAuth()
  const { fetchAllEntries, returnWeekEntries, deleteEntry, loading } = useEntries()
  const { signOffMonth, revokeSignoff, signOffWeek, unsignOffWeek, fetchSignoffs, fetchAdminSummary } = useSignoffs()
  const [monthStart, setMonthStart] = useState(currentMonthStart())
  const [entries, setEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [signoffs, setSignoffs] = useState([])
  const [selectedUser, setSelectedUser] = useState(null) // { userId, userName, projectName }
  const [message, setMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [returningWeek, setReturningWeek] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [deletingWeek, setDeletingWeek] = useState(null)
  const [nonWorkingDays, setNonWorkingDays] = useState([])
  const [allProfiles, setAllProfiles] = useState([])

  const loadData = useCallback(async () => {
    const monthEnd = localDateStr(new Date(new Date(monthStart + 'T12:00:00').getFullYear(), new Date(monthStart + 'T12:00:00').getMonth() + 1, 0))
    const results = await Promise.allSettled([
      fetchAllEntries({ monthStart }),
      supabase.from('projects').select('*').eq('status', 'active').then((r) => r.data || []),
      fetchSignoffs(monthStart),
      supabase.from('non_working_days').select('user_id, entry_date, reason').gte('entry_date', monthStart).lte('entry_date', monthEnd).then((r) => r.data || []),
      supabase.from('profiles').select('id, full_name, email').is('deactivated_at', null).then((r) => r.data || []),
    ])

    const [entriesResult, projectsResult, signoffsResult, nwdResult, profilesResult] = results
    setEntries(entriesResult.status === 'fulfilled' ? entriesResult.value : [])
    setProjects(projectsResult.status === 'fulfilled' ? projectsResult.value : [])
    setSignoffs(signoffsResult.status === 'fulfilled' ? signoffsResult.value : [])
    setNonWorkingDays(nwdResult.status === 'fulfilled' ? nwdResult.value : [])
    setAllProfiles(profilesResult.status === 'fulfilled' ? profilesResult.value : [])

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      setMessage({ type: 'error', text: `Some data failed to load. ${failures.length} request(s) failed.` })
    }
  }, [monthStart, fetchAllEntries, fetchSignoffs])

  useEffect(() => { loadData() }, [loadData])

  // Group entries by user -> weeks
  const userMap = {}
  for (const entry of entries) {
    const userId = entry.user_id
    const userName = entry.profiles?.full_name || entry.profiles?.email || 'Unknown'
    if (!userMap[userId]) userMap[userId] = { name: userName, email: entry.profiles?.email, entries: [] }
    userMap[userId].entries.push(entry)
  }
  const userList = Object.entries(userMap).sort(([, a], [, b]) => a.name.localeCompare(b.name))

  // Count submitted entries needing review
  const pendingCount = userList.filter(([, u]) => u.entries.some((e) => e.status === 'submitted')).length

  // Detail view for a user
  if (selectedUser) {
    const userEntries = entries.filter((e) => e.user_id === selectedUser.userId)
    const userSignoff = signoffs.find((s) => s.user_id === selectedUser.userId)
    const weekGroups = userEntries.reduce((g, e) => { (g[e.week_ending] ||= []).push(e); return g }, {})
    const sortedWeeks = Object.keys(weekGroups).sort()
    const totalDays = Math.round(userEntries.reduce((sum, e) => sum + Number(e.time_value), 0) * 100) / 100
    const totalHours = userEntries.reduce((sum, e) => sum + Number(e.time_hours || 0), 0)
    const userNwdMap = new Map(nonWorkingDays.filter((n) => n.user_id === selectedUser.userId).map((n) => [n.entry_date, n.reason || 'Non-working day']))
    const userNwdDates = [...userNwdMap.keys()]

    async function handleSignOffWeek(weekEnding) {
      setActionLoading(true)
      try {
        await signOffWeek(selectedUser.userId, weekEnding)
        setMessage({ type: 'success', text: `Week ending ${formatDate(weekEnding)} signed off.` })
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleUnsignOffWeek(weekEnding) {
      setActionLoading(true)
      try {
        await unsignOffWeek(selectedUser.userId, weekEnding)
        setMessage({ type: 'success', text: `Sign-off revoked for week ending ${formatDate(weekEnding)}.` })
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleSignOffMonth() {
      setActionLoading(true)
      try {
        await signOffMonth(selectedUser.userId, monthStart)
        setMessage({ type: 'success', text: 'All weeks signed off for the month.' })
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleReturnWeek() {
      setActionLoading(true)
      try {
        await returnWeekEntries(selectedUser.userId, returningWeek, returnReason || null)
        setMessage({ type: 'success', text: 'Entries returned to user.' })
        setReturningWeek(null)
        setReturnReason('')
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleDeleteEntry(entryId) {
      if (!confirm('Delete this entry? This cannot be undone.')) return
      setActionLoading(true)
      try {
        await deleteEntry(entryId)
        setMessage({ type: 'success', text: 'Entry deleted.' })
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleDeleteWeek() {
      setActionLoading(true)
      try {
        const weekEntriesToDelete = weekGroups[deletingWeek] || []
        await Promise.all(weekEntriesToDelete.map((e) => deleteEntry(e.id)))
        setMessage({ type: 'success', text: `${weekEntriesToDelete.length} entries deleted.` })
        setDeletingWeek(null)
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => { setSelectedUser(null); setMessage(null) }} className="text-base text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span> Back
          </button>
          <div>
            <h2 className="font-headline font-black text-3xl text-on-surface">{selectedUser.userName}</h2>
            <p className="text-base text-on-surface-variant">{getMonthLabel(monthStart)} · {totalHours > 0 ? `${totalHours}hrs` : ''} {totalDays.toFixed(2)} days total{userNwdDates.length > 0 ? ` · ${userNwdDates.length} non-working ${userNwdDates.length === 1 ? 'day' : 'days'}` : ''}</p>
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

        {/* Month-level sign-off action */}
        {(() => {
          const hasUnsignedSubmitted = userEntries.some((e) => e.status === 'submitted')
          const allSignedOff = userEntries.length > 0 && userEntries.every((e) => e.status === 'signed_off')
          return (
            <div className={`glass-card rounded-2xl p-5 flex items-center justify-between ${allSignedOff ? 'border-green-400/20' : ''}`}>
              <div>
                <p className={`text-sm font-medium ${allSignedOff ? 'text-green-400' : 'text-on-surface'}`}>
                  {allSignedOff ? 'All weeks signed off' : `${userEntries.length} entries for this month`}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {sortedWeeks.length} {sortedWeeks.length === 1 ? 'week' : 'weeks'} · {totalHours > 0 ? `${totalHours}hrs` : ''} {totalDays.toFixed(2)} days total
                </p>
              </div>
              {hasUnsignedSubmitted && (
                <button onClick={handleSignOffMonth} disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {actionLoading ? 'Processing...' : 'Sign off all weeks'}
                </button>
              )}
            </div>
          )
        })()}

        {/* Weeks with per-week actions */}
        {sortedWeeks.map((weekEnding) => {
          const we = weekGroups[weekEnding]
          const weekTotal = Math.round(we.reduce((sum, e) => sum + Number(e.time_value), 0) * 100) / 100
          const weekSignedOff = we.every((e) => e.status === 'signed_off')
          const weekSubmitted = we.some((e) => e.status === 'submitted')
          const weekHasDrafts = we.some((e) => e.status === 'draft')

          return (
            <CollapsibleWeekAdmin
              key={weekEnding}
              weekEnding={weekEnding}
              weekEntries={we}
              weekTotal={weekTotal}
              isSignedOff={weekSignedOff}
              hasSubmitted={weekSubmitted}
              hasDrafts={weekHasDrafts}
              onSignOff={() => handleSignOffWeek(weekEnding)}
              onUnsignOff={() => handleUnsignOffWeek(weekEnding)}
              onReturnWeek={() => setReturningWeek(weekEnding)}
              onDeleteWeek={() => setDeletingWeek(weekEnding)}
              onDeleteEntry={handleDeleteEntry}
              actionLoading={actionLoading}
              nonWorkingDays={userNwdMap}
            />
          )
        })}

        {/* Return modal */}
        {returningWeek && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>undo</span>
                </div>
                <h3 className="font-headline font-bold text-xl text-on-surface">Return entries</h3>
              </div>
              <p className="text-sm text-on-surface-variant">
                Return week ending {formatDate(returningWeek)} to {selectedUser.userName} for editing.
              </p>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Reason (optional)</label>
                <input type="text" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="input-dark w-full"
                  placeholder="e.g. Missing project references for Tuesday" />
              </div>
              <div className="flex items-center justify-end gap-4 pt-2">
                <button onClick={() => { setReturningWeek(null); setReturnReason('') }} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
                <button onClick={handleReturnWeek} disabled={actionLoading}
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                  {actionLoading ? 'Returning...' : 'Return entries'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete week modal */}
        {deletingWeek && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
            <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,113,108,0.1)', border: '1px solid rgba(255,113,108,0.2)' }}>
                  <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>delete_forever</span>
                </div>
                <h3 className="font-headline font-bold text-xl text-on-surface">Delete week</h3>
              </div>
              <p className="text-sm text-on-surface-variant">
                This will permanently delete all {(weekGroups[deletingWeek] || []).length} entries for week ending {formatDate(deletingWeek)} for {selectedUser.userName}. This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-4 pt-2">
                <button onClick={() => setDeletingWeek(null)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
                <button onClick={handleDeleteWeek} disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                  {actionLoading ? 'Deleting...' : 'Delete all entries'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Compute per-user metrics ──
  const monthDate = new Date(monthStart + 'T12:00:00')
  const allWorkingDayDates = getWorkingDaysInMonth(monthDate.getFullYear(), monthDate.getMonth())
  const today = localDateStr(new Date())
  const currentWeekFriday = getCurrentWeekFriday()

  // Group non-working days by user
  const nwdByUser = {}
  for (const nwd of nonWorkingDays) {
    if (!nwdByUser[nwd.user_id]) nwdByUser[nwd.user_id] = new Set()
    nwdByUser[nwd.user_id].add(nwd.entry_date)
  }

  // Build full user list: include all profiles (even those with no entries)
  const fullUserMap = {}
  for (const p of allProfiles) {
    fullUserMap[p.id] = { name: p.full_name || p.email || 'Unknown', email: p.email, entries: [] }
  }
  // Overlay entries
  for (const entry of entries) {
    const userId = entry.user_id
    if (!fullUserMap[userId]) {
      const userName = entry.profiles?.full_name || entry.profiles?.email || 'Unknown'
      fullUserMap[userId] = { name: userName, email: entry.profiles?.email, entries: [] }
    }
    fullUserMap[userId].entries.push(entry)
  }
  const fullUserList = Object.entries(fullUserMap).sort(([, a], [, b]) => a.name.localeCompare(b.name))

  // ── Main approval list with per-user cards ──
  return (
    <div className="space-y-6">
      {/* Month navigator */}
      <div className="glass-card-accent rounded-2xl p-6 flex items-center justify-center gap-6">
        <button onClick={() => setMonthStart(shiftMonth(monthStart, -1))} className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-[var(--white-alpha-5)]">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <div className="text-center min-w-[200px]">
          <p className="font-headline font-black text-on-surface text-2xl">{getMonthLabel(monthStart)}</p>
          <p className="text-[10px] text-outline mt-1 uppercase tracking-widest font-bold">
            {pendingCount > 0 ? `${pendingCount} pending review` : 'No pending approvals'}
          </p>
        </div>
        <button onClick={() => setMonthStart(shiftMonth(monthStart, 1))} className="text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-[var(--white-alpha-5)]">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {loading && entries.length === 0 && <LoadingSpinner message="Loading entries..." />}

      {!loading && fullUserList.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="icon-badge-gradient w-14 h-14 mx-auto mb-4" style={{ borderRadius: '14px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>event_busy</span>
          </div>
          <p className="text-on-surface-variant text-base">No users found.</p>
        </div>
      )}

      {message && !selectedUser && (
        <div className={`glass-card rounded-xl p-4 flex items-center gap-3 ${message.type === 'success' ? 'border-green-400/20' : 'border-error/20'}`}
          style={{ background: message.type === 'success' ? 'rgba(74,222,128,0.05)' : 'rgba(255,113,108,0.05)' }}>
          <span className={`material-symbols-outlined ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>{message.text}</p>
        </div>
      )}

      {/* Per-user cards */}
      <div className="space-y-4">
        {fullUserList.map(([userId, userData]) => {
          const userNwd = nwdByUser[userId] || new Set()
          const workingDays = allWorkingDayDates.filter((d) => !userNwd.has(d)).length
          const datesWithEntries = new Set(userData.entries.map((e) => e.entry_date))

          // Days this week
          const weekEntries = userData.entries.filter((e) => e.week_ending === currentWeekFriday)
          const weekDays = Math.round(weekEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100

          // Days this month
          const monthDays = Math.round(userData.entries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100

          // Missing = working days before today with no entries
          const missingCount = allWorkingDayDates.filter((d) => d < today && !userNwd.has(d) && !datesWithEntries.has(d)).length

          // Status counts
          const draftCount = userData.entries.filter((e) => e.status === 'draft').length
          const submittedCount = userData.entries.filter((e) => e.status === 'submitted').length
          const signedOffCount = userData.entries.filter((e) => e.status === 'signed_off').length

          // Overall status for badge
          const allSignedOff = userData.entries.length > 0 && userData.entries.every((e) => e.status === 'signed_off')
          const hasSubmitted = userData.entries.some((e) => e.status === 'submitted')
          const hasReturned = userData.entries.some((e) => e.status === 'returned')

          return (
            <div key={userId} className="glass-card rounded-2xl p-5 hover:bg-[var(--white-alpha-2)] transition-colors">
              {/* Header: name + status + review button */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full signature-gradient-bg flex items-center justify-center text-white text-sm font-bold">
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-on-surface text-base">{userData.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {allSignedOff ? <StatusBadge status="signed_off" />
                    : hasReturned ? <StatusBadge status="returned" />
                    : hasSubmitted ? <StatusBadge status="submitted" />
                    : userData.entries.length > 0 ? <StatusBadge status="draft" />
                    : null
                  }
                  <button onClick={() => setSelectedUser({ userId, userName: userData.name })}
                    className="text-primary hover:text-primary-dim font-medium transition-colors flex items-center gap-1 text-sm">
                    Review <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* 6 metric cards in 3x2 grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <AdminMiniCard label="This week" value={`${Math.round(weekDays * 100) / 100}`} unit="days" colour="cyan" />
                <AdminMiniCard label="This month" value={`${Math.round(monthDays * 100) / 100}`} unit="days" colour="purple" />
                <AdminMiniCard label="Missing" value={`${missingCount}`} unit="days" colour={missingCount > 0 ? 'red' : 'green'} />
                <AdminMiniCard label="Draft" value={`${draftCount}`} unit="entries" colour="yellow" />
                <AdminMiniCard label="Submitted" value={`${submittedCount}`} unit="entries" colour="cyan" />
                <AdminMiniCard label="Signed off" value={`${signedOffCount}`} unit="entries" colour="green" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════
// TAB 2: PROJECTS — CRUD
// ══════════════════════════════════════════════

function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [formName, setFormName] = useState('')
  const [formClient, setFormClient] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [deleteEntriesToo, setDeleteEntriesToo] = useState(false)

  async function loadProjects() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('name')
    setProjects(data || [])
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [])

  function openCreate() {
    setEditingProject(null)
    setFormName('')
    setFormClient('')
    setFormStatus('active')
    setShowForm(true)
  }

  function openEdit(project) {
    setEditingProject(project)
    setFormName(project.name)
    setFormClient(project.client)
    setFormStatus(project.status)
    setShowForm(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formClient.trim()) return
    setSaving(true)
    try {
      if (editingProject) {
        const { error } = await supabase.from('projects').update({ name: formName.trim(), client: formClient.trim(), status: formStatus }).eq('id', editingProject.id)
        if (error) throw error
        setMessage({ type: 'success', text: 'Project updated.' })
      } else {
        const { error } = await supabase.from('projects').insert({ name: formName.trim(), client: formClient.trim(), status: formStatus })
        if (error) throw error
        setMessage({ type: 'success', text: 'Project created.' })
      }
      setShowForm(false)
      await loadProjects()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setSaving(false) }
  }

  async function handleDeleteProject() {
    if (!deletingProject) return
    setSaving(true)
    try {
      if (deleteEntriesToo) {
        // Delete all timesheet entries for this project
        const { error: entriesErr } = await supabase.from('timesheet_entries').delete().eq('project_id', deletingProject.id)
        if (entriesErr) throw entriesErr
      } else {
        // Nullify project_id on entries so historical data remains
        const { error: nullErr } = await supabase.from('timesheet_entries').update({ project_id: null }).eq('project_id', deletingProject.id)
        if (nullErr) throw nullErr
      }
      // Remove user_projects assignments
      const { error: upErr } = await supabase.from('user_projects').delete().eq('project_id', deletingProject.id)
      if (upErr) throw upErr
      // Delete the project
      const { error } = await supabase.from('projects').delete().eq('id', deletingProject.id)
      if (error) throw error
      setMessage({ type: 'success', text: `Project "${deletingProject.name}" deleted.` })
      setDeletingProject(null)
      setDeleteEntriesToo(false)
      await loadProjects()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-on-surface-variant">Manage projects that users can log time against.</p>
        <button onClick={openCreate} className="btn-gradient text-sm flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Add project
        </button>
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

      {loading && <LoadingSpinner message="Loading projects..." />}

      {!loading && projects.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <p className="text-on-surface-variant">No projects yet. Create one to get started.</p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-[var(--glass-border-subtle)]">
            {projects.map((project) => (
              <div key={project.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--white-alpha-2)] transition-colors">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-on-surface">{project.name}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      project.status === 'active'
                        ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                        : 'text-on-surface-variant bg-white/5 border border-white/10'
                    }`}>{project.status}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-0.5">{project.client}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEdit(project)} className="text-sm text-primary hover:text-primary-dim font-medium transition-colors">
                    Edit
                  </button>
                  <button onClick={() => { setDeletingProject(project); setDeleteEntriesToo(false) }} className="text-sm text-error hover:text-error-dim font-medium transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
            <h3 className="font-headline font-bold text-xl text-on-surface">{editingProject ? 'Edit project' : 'New project'}</h3>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Project name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="input-dark w-full" placeholder="e.g. IPCI Phase 2" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Client</label>
              <input type="text" value={formClient} onChange={(e) => setFormClient(e.target.value)} className="input-dark w-full" placeholder="e.g. IPCI" />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="input-dark w-full">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-4 pt-2">
              <button onClick={() => setShowForm(false)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !formName.trim() || !formClient.trim()} className="btn-gradient text-sm disabled:opacity-50">
                {saving ? 'Saving...' : editingProject ? 'Update project' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete project confirmation modal */}
      {deletingProject && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,113,108,0.1)', border: '1px solid rgba(255,113,108,0.2)' }}>
                <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>delete_forever</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-on-surface">Delete project</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              You are about to delete <strong className="text-on-surface">{deletingProject.name}</strong>. This will remove it from the project list and unassign all users.
            </p>
            <div className="rounded-xl p-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-sm text-on-surface font-medium mb-3">What should happen to existing timesheet entries?</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="deleteProjectEntries" checked={!deleteEntriesToo} onChange={() => setDeleteEntriesToo(false)}
                    className="mt-0.5 accent-[#00C9FF]" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">Keep entries</p>
                    <p className="text-xs text-on-surface-variant">Entries remain for historical records but won't be linked to this project.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="deleteProjectEntries" checked={deleteEntriesToo} onChange={() => setDeleteEntriesToo(true)}
                    className="mt-0.5 accent-[#00C9FF]" />
                  <div>
                    <p className="text-sm font-medium text-error">Delete all entries</p>
                    <p className="text-xs text-on-surface-variant">Permanently remove all timesheet entries logged against this project.</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 pt-2">
              <button onClick={() => { setDeletingProject(null); setDeleteEntriesToo(false) }} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
              <button onClick={handleDeleteProject} disabled={saving}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                {saving ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// TAB 3: USERS — list, filter by project, assign
// ══════════════════════════════════════════════

function UsersTab() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [userProjects, setUserProjects] = useState([]) // all user_projects rows
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  const [assigningUser, setAssigningUser] = useState(null)
  const [message, setMessage] = useState(null)
  const [showDeactivated, setShowDeactivated] = useState(false)

  // Deactivate flow
  const [deactivatingUser, setDeactivatingUser] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  // Hard delete flow (deactivated users only)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deleteUserEntries, setDeleteUserEntries] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadData() {
    setLoading(true)
    const [usersRes, projectsRes, upRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, deactivated_at').order('full_name'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('user_projects').select('*'),
    ])
    setUsers(usersRes.data || [])
    setProjects(projectsRes.data || [])
    setUserProjects(upRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function getUserProjects(userId) {
    const projectIds = userProjects.filter((up) => up.user_id === userId).map((up) => up.project_id)
    return projects.filter((p) => projectIds.includes(p.id))
  }

  // Split users into active and deactivated
  const activeUsers = users.filter((u) => !u.deactivated_at)
  const deactivatedUsers = users.filter((u) => u.deactivated_at)

  const filteredActiveUsers = filterProject
    ? activeUsers.filter((u) => userProjects.some((up) => up.user_id === u.id && up.project_id === filterProject))
    : activeUsers

  async function toggleProjectAssignment(userId, projectId, currentlyAssigned) {
    try {
      if (currentlyAssigned) {
        const { error } = await supabase.from('user_projects').delete().eq('user_id', userId).eq('project_id', projectId)
        if (error) throw error
      } else {
        // Default hours_per_day to 5 — admin can adjust via the modal afterwards
        const { error } = await supabase.from('user_projects').insert({ user_id: userId, project_id: projectId, hours_per_day: 5 })
        if (error) throw error
      }
      await loadData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  async function updateHoursPerDay(userId, projectId, hoursPerDay) {
    try {
      const value = parseFloat(hoursPerDay)
      if (isNaN(value) || value <= 0) return
      const { error } = await supabase
        .from('user_projects')
        .update({ hours_per_day: value })
        .eq('user_id', userId)
        .eq('project_id', projectId)
      if (error) throw error
      await loadData()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  async function handleDeactivateUser() {
    if (!deactivatingUser) return
    setDeactivating(true)
    try {
      const { error } = await supabase.rpc('admin_deactivate_user', {
        p_user_id: deactivatingUser.id,
      })
      if (error) throw error
      setMessage({ type: 'success', text: `"${deactivatingUser.full_name || deactivatingUser.email}" has been deactivated.` })
      setDeactivatingUser(null)
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setDeactivating(false) }
  }

  async function handleReactivateUser(u) {
    try {
      const { error } = await supabase.rpc('admin_reactivate_user', { p_user_id: u.id })
      if (error) throw error
      setMessage({ type: 'success', text: `"${u.full_name || u.email}" has been reactivated.` })
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: deletingUser.id,
        p_delete_entries: deleteUserEntries,
      })
      if (error) throw error
      setMessage({ type: 'success', text: `"${deletingUser.full_name || deletingUser.email}" has been permanently deleted.` })
      setDeletingUser(null)
      setDeleteUserEntries(false)
      await loadData()
    } catch (err) { setMessage({ type: 'error', text: err.message }) }
    finally { setDeleting(false) }
  }

  // Shared user row renderer
  function UserRow({ u, actions }) {
    const uProjects = getUserProjects(u.id)
    const isDeactivated = !!u.deactivated_at
    return (
      <div className={`px-6 py-4 flex items-center justify-between hover:bg-[var(--white-alpha-2)] transition-colors ${isDeactivated ? 'opacity-60' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${isDeactivated ? 'bg-white/10' : 'signature-gradient-bg'}`}>
            {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-on-surface">{u.full_name || 'No name'}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                u.role === 'admin' ? 'text-secondary bg-secondary/10 border border-secondary/20'
                : u.role === 'resource_manager' ? 'text-primary bg-primary/10 border border-primary/20'
                : 'text-on-surface-variant bg-white/5 border border-white/10'
              }`}>{u.role?.replace('_', ' ')}</span>
            </div>
            <div className="text-sm text-on-surface-variant">{u.email}</div>
            {uProjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {uProjects.map((p) => (
                  <span key={p.id} className="text-[10px] font-medium text-primary bg-primary/5 border border-primary/15 rounded px-1.5 py-0.5">{p.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <p className="text-on-surface-variant">Manage users and their project assignments.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-gradient text-sm flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
          Invite user
        </button>
      </div>

      {/* Filter by project */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-outline">Filter by project</label>
        <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="input-dark" style={{ width: 'auto', minWidth: '200px' }}>
          <option value="">All users</option>
          {projects.filter((p) => p.status === 'active').map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
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

      {inviteResult && (
        <div className="glass-card rounded-xl p-4 border-green-400/20" style={{ background: 'rgba(74,222,128,0.05)' }}>
          <p className="text-green-400 font-medium mb-1 text-sm">Account created for {inviteResult.email}</p>
          <p className="text-green-400/80 text-sm">
            Temporary password: <code className="bg-green-500/10 px-1.5 py-0.5 rounded font-mono text-xs">{inviteResult.tempPassword}</code>
          </p>
          <p className="text-green-400/60 text-xs mt-1">Share these credentials securely. The user should change their password on first login.</p>
        </div>
      )}

      {loading && <LoadingSpinner message="Loading users..." />}

      {/* Active users */}
      {!loading && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-[var(--glass-border-subtle)]">
            {filteredActiveUsers.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8">No active users found.</p>
            )}
            {filteredActiveUsers.map((u) => (
              <UserRow key={u.id} u={u} actions={
                <>
                  <button onClick={() => setAssigningUser(u)} className="text-sm text-primary hover:text-primary-dim font-medium transition-colors">
                    Manage projects
                  </button>
                  {u.id !== currentUser?.id && (
                    <button onClick={() => setDeactivatingUser(u)} className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
                      Deactivate
                    </button>
                  )}
                </>
              } />
            ))}
          </div>
        </div>
      )}

      {/* Deactivated users section */}
      {!loading && deactivatedUsers.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowDeactivated(!showDeactivated)}
            className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {showDeactivated ? 'expand_less' : 'expand_more'}
            </span>
            Deactivated users ({deactivatedUsers.length})
          </button>

          {showDeactivated && (
            <div className="glass-card rounded-2xl overflow-hidden border-amber-400/10">
              <div className="divide-y divide-[var(--glass-border-subtle)]">
                {deactivatedUsers.map((u) => (
                  <UserRow key={u.id} u={u} actions={
                    <>
                      <span className="text-xs text-on-surface-variant">
                        Deactivated {new Date(u.deactivated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button onClick={() => handleReactivateUser(u)} className="text-sm text-green-400 hover:text-green-300 font-medium transition-colors">
                        Reactivate
                      </button>
                      <button onClick={() => { setDeletingUser(u); setDeleteUserEntries(false) }} className="text-sm text-error hover:text-error-dim font-medium transition-colors">
                        Delete
                      </button>
                    </>
                  } />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign projects modal */}
      {assigningUser && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
            <h3 className="font-headline font-bold text-xl text-on-surface">Projects for {assigningUser.full_name}</h3>
            <p className="text-sm text-on-surface-variant">Toggle projects and set hours per day for each assignment.</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {projects.filter((p) => p.status === 'active').map((project) => {
                const assignment = userProjects.find((up) => up.user_id === assigningUser.id && up.project_id === project.id)
                const isAssigned = !!assignment
                return (
                  <div key={project.id} className={`rounded-xl transition-colors ${
                    isAssigned ? 'bg-primary/10 border border-primary/20' : 'bg-[var(--white-alpha-2)] border border-[var(--glass-border-subtle)]'
                  }`}>
                    <button
                      onClick={() => toggleProjectAssignment(assigningUser.id, project.id, isAssigned)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-on-surface">{project.name}</p>
                        <p className="text-xs text-on-surface-variant">{project.client}</p>
                      </div>
                      <span className={`material-symbols-outlined ${isAssigned ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: '20px' }}>
                        {isAssigned ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </button>
                    {isAssigned && (
                      <div className="px-4 pb-3 flex items-center gap-2">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-outline whitespace-nowrap">Hrs/day</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="24"
                          value={assignment.hours_per_day || ''}
                          onChange={(e) => updateHoursPerDay(assigningUser.id, project.id, e.target.value)}
                          placeholder="e.g. 7.5"
                          className="w-24 bg-surface-container-highest/50 rounded-lg px-2 py-1.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                          style={{ background: 'var(--color-surface-variant)', border: !assignment.hours_per_day ? '1.5px solid rgba(255,113,108,0.5)' : '1px solid var(--glass-border)' }}
                        />
                        {!assignment.hours_per_day && (
                          <span className="text-[10px] text-amber-400 font-medium">Required</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-end pt-2">
              <button onClick={() => setAssigningUser(null)} className="btn-gradient text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={(result) => { setShowInvite(false); setInviteResult(result); loadData() }}
        />
      )}

      {/* Deactivate user confirmation modal */}
      {deactivatingUser && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>person_off</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-on-surface">Deactivate user</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              <strong className="text-on-surface">{deactivatingUser.full_name || deactivatingUser.email}</strong> will no longer be able to log in. Their timesheet entries and data will be preserved.
            </p>
            <p className="text-sm text-on-surface-variant">
              You can reactivate them at any time, or permanently delete them from the deactivated users list.
            </p>
            <div className="flex items-center justify-end gap-4 pt-2">
              <button onClick={() => setDeactivatingUser(null)} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
              <button onClick={handleDeactivateUser} disabled={deactivating}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard delete user confirmation modal (deactivated users only) */}
      {deletingUser && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,113,108,0.1)', border: '1px solid rgba(255,113,108,0.2)' }}>
                <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>person_remove</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-on-surface">Permanently delete user</h3>
            </div>
            <p className="text-sm text-on-surface-variant">
              You are about to permanently remove <strong className="text-on-surface">{deletingUser.full_name || deletingUser.email}</strong> from the system. This will delete their account, profile, and all project assignments. <strong className="text-error">This cannot be undone.</strong>
            </p>
            <div className="rounded-xl p-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <p className="text-sm text-on-surface font-medium mb-3">What should happen to their timesheet entries?</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="deleteUserEntries" checked={!deleteUserEntries} onChange={() => setDeleteUserEntries(false)}
                    className="mt-0.5 accent-[#00C9FF]" />
                  <div>
                    <p className="text-sm font-medium text-on-surface">Keep entries</p>
                    <p className="text-xs text-on-surface-variant">Timesheet data is preserved, but entries will no longer show a user name against them.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="deleteUserEntries" checked={deleteUserEntries} onChange={() => setDeleteUserEntries(true)}
                    className="mt-0.5 accent-[#00C9FF]" />
                  <div>
                    <p className="text-sm font-medium text-error">Delete all entries</p>
                    <p className="text-xs text-on-surface-variant">Permanently remove all their timesheet entries from the system.</p>
                  </div>
                </label>
              </div>
            </div>
            {!deleteUserEntries && (
              <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="material-symbols-outlined text-amber-400 flex-shrink-0" style={{ fontSize: '18px' }}>warning</span>
                <p className="text-xs text-amber-400/90">Kept entries will appear as "Unknown user" in reports and admin views since the user's profile will no longer exist.</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-4 pt-2">
              <button onClick={() => { setDeletingUser(null); setDeleteUserEntries(false) }} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
              <button onClick={handleDeleteUser} disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Permanently delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Invite modal (shared) ──
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
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
      <form onSubmit={handleInvite} className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <div className="flex items-center gap-3">
          <div className="icon-badge-gradient w-8 h-8" style={{ borderRadius: '8px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>person_add</span>
          </div>
          <h3 className="font-headline font-bold text-xl text-on-surface">Invite user</h3>
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
          <button type="button" onClick={onClose} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="btn-gradient text-sm disabled:opacity-50">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ══════════════════════════════════════════════
// MAIN ADMIN PAGE — Tab container
// ══════════════════════════════════════════════

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('approvals')

  const tabs = [
    { id: 'approvals', label: 'Approvals', icon: 'fact_check' },
    { id: 'projects', label: 'Projects', icon: 'folder_open' },
    { id: 'users', label: 'Users', icon: 'group' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Administration</p>
        <h1 className="text-5xl font-black font-headline text-on-surface tracking-tight">Admin</h1>
        <p className="text-on-surface-variant mt-3">Manage approvals, projects, and team members.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            style={activeTab === tab.id ? {
              background: 'var(--white-alpha-5)',
              border: '1px solid var(--glass-border)',
            } : {}}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'approvals' && <ApprovalsTab />}
      {activeTab === 'projects' && <ProjectsTab />}
      {activeTab === 'users' && <UsersTab />}
    </div>
  )
}

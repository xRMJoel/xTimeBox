import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEntries, useSignoffs } from '../hooks/useEntries'
import StatusBadge from '../components/StatusBadge'
import EntryCard from '../components/EntryCard'
import { formatDate, getMonthLabel } from '../lib/constants'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Helpers ──
function currentMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function shiftMonth(monthStart, delta) {
  const d = new Date(monthStart + 'T12:00:00')
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 10)
}

// ══════════════════════════════════════════════
// TAB 1: APPROVALS — grouped by project then user
// ══════════════════════════════════════════════

function ApprovalsTab() {
  const { user } = useAuth()
  const { fetchAllEntries, returnWeekEntries, deleteEntry, loading } = useEntries()
  const { signOffMonth, revokeSignoff, fetchSignoffs, fetchAdminSummary } = useSignoffs()
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

  const loadData = useCallback(async () => {
    const [entriesData, projectsData, signoffsData] = await Promise.all([
      fetchAllEntries({ monthStart }),
      supabase.from('projects').select('*').eq('status', 'active').then((r) => r.data || []),
      fetchSignoffs(monthStart),
    ])
    setEntries(entriesData)
    setProjects(projectsData)
    setSignoffs(signoffsData)
  }, [monthStart, fetchAllEntries, fetchSignoffs])

  useEffect(() => { loadData() }, [loadData])

  // Group entries: project -> user -> weeks
  const grouped = {}
  const unassigned = { users: {} }

  for (const entry of entries) {
    const projectId = entry.project_id || '__unassigned__'
    const project = projects.find((p) => p.id === projectId)
    const projectName = project?.name || 'Unassigned'
    const userId = entry.user_id
    const userName = entry.profiles?.full_name || entry.profiles?.email || 'Unknown'

    const bucket = projectId === '__unassigned__' ? unassigned : (grouped[projectId] ||= { name: projectName, client: project?.client, users: {} })
    const userBucket = bucket.users[userId] ||= { name: userName, email: entry.profiles?.email, entries: [] }
    userBucket.entries.push(entry)
  }

  // Count submitted entries needing review
  const allUserBuckets = [...Object.values(grouped).flatMap((p) => Object.entries(p.users).map(([uid, u]) => ({ ...u, uid }))), ...Object.entries(unassigned.users).map(([uid, u]) => ({ ...u, uid }))]
  const pendingCount = allUserBuckets.filter((u) => u.entries.some((e) => e.status === 'submitted')).length

  // Detail view for a user
  if (selectedUser) {
    const userEntries = entries.filter((e) => e.user_id === selectedUser.userId)
    const userSignoff = signoffs.find((s) => s.user_id === selectedUser.userId)
    const weekGroups = userEntries.reduce((g, e) => { (g[e.week_ending] ||= []).push(e); return g }, {})
    const sortedWeeks = Object.keys(weekGroups).sort()
    const totalDays = userEntries.reduce((sum, e) => sum + Number(e.time_value), 0)

    async function handleSignOff() {
      setActionLoading(true)
      try {
        await signOffMonth(selectedUser.userId, monthStart)
        setMessage({ type: 'success', text: 'Month signed off.' })
        await loadData()
      } catch (err) { setMessage({ type: 'error', text: err.message }) }
      finally { setActionLoading(false) }
    }

    async function handleRevoke() {
      if (!confirm('Revoke this sign-off? Entries will be unlocked for editing.')) return
      setActionLoading(true)
      try {
        await revokeSignoff(selectedUser.userId, monthStart)
        setMessage({ type: 'success', text: 'Sign-off revoked.' })
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
        <div className={`glass-card rounded-2xl p-5 flex items-center justify-between ${userSignoff ? 'border-green-400/20' : ''}`}>
          {userSignoff ? (
            <>
              <div>
                <p className="text-sm text-green-400 font-medium">Signed off</p>
                <p className="text-xs text-on-surface-variant">By {userSignoff.signer?.full_name} on {new Date(userSignoff.signed_off_at).toLocaleDateString('en-GB')}</p>
              </div>
              <button onClick={handleRevoke} disabled={actionLoading} className="text-sm text-error hover:text-error-dim font-medium transition-colors disabled:opacity-50">
                Revoke sign-off
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-on-surface">Not yet signed off</p>
                <p className="text-xs text-on-surface-variant">{userEntries.length} entries for this month</p>
              </div>
              <button onClick={handleSignOff} disabled={actionLoading || userEntries.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {actionLoading ? 'Processing...' : 'Sign off month'}
              </button>
            </>
          )}
        </div>

        {sortedWeeks.map((weekEnding) => {
          const weekEntries = weekGroups[weekEnding]
          const weekTotal = weekEntries.reduce((sum, e) => sum + Number(e.time_value), 0)
          const dayGroups = weekEntries.reduce((g, e) => { (g[e.entry_date] ||= []).push(e); return g }, {})
          const sortedDays = Object.keys(dayGroups).sort()

          return (
            <div key={weekEnding} className="glass-card rounded-2xl overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--week-header-border)', background: 'var(--week-header-bg)' }}>
                <div className="flex items-center justify-between flex-1">
                  <span className="text-base font-medium text-on-surface">Week ending {formatDate(weekEnding)}</span>
                  <div className="flex items-center gap-4">
                    {weekEntries.some((e) => e.status === 'submitted') && (
                      <button onClick={() => setReturningWeek(weekEnding)}
                        className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
                        Return week
                      </button>
                    )}
                    <button onClick={() => setDeletingWeek(weekEnding)}
                      className="text-sm text-error hover:text-error-dim font-medium transition-colors flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                      Delete week
                    </button>
                  </div>
                </div>
                <span className="text-base font-bold text-primary ml-4">{weekTotal} days</span>
              </div>
              <div className="divide-y divide-[var(--glass-border-subtle)]">
                {sortedDays.map((date) => (
                  <div key={date} className="px-6 py-4">
                    <div className="text-base font-medium text-on-surface mb-2">{dayGroups[date][0].day_name}, {formatDate(date)}</div>
                    <div className="space-y-2">
                      {dayGroups[date].map((entry) => <EntryCard key={entry.id} entry={entry} onDelete={handleDeleteEntry} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

  // ── Main approval list grouped by project ──
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

      {!loading && entries.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="icon-badge-gradient w-14 h-14 mx-auto mb-4" style={{ borderRadius: '14px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>event_busy</span>
          </div>
          <p className="text-on-surface-variant text-base">No entries for {getMonthLabel(monthStart)}.</p>
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

      {/* Project groups */}
      {Object.entries(grouped).map(([projectId, project]) => (
        <ProjectGroup
          key={projectId}
          project={project}
          signoffs={signoffs}
          onSelectUser={(userId, userName) => setSelectedUser({ userId, userName })}
        />
      ))}

      {/* Unassigned entries */}
      {Object.keys(unassigned.users).length > 0 && (
        <ProjectGroup
          project={{ name: 'Unassigned', client: 'No project', users: unassigned.users }}
          signoffs={signoffs}
          onSelectUser={(userId, userName) => setSelectedUser({ userId, userName })}
        />
      )}
    </div>
  )
}

function ProjectGroup({ project, signoffs, onSelectUser }) {
  const [expanded, setExpanded] = useState(true)
  const userList = Object.entries(project.users)
  const totalDays = userList.reduce((sum, [, u]) => sum + u.entries.reduce((s, e) => s + Number(e.time_value), 0), 0)
  const pendingUsers = userList.filter(([, u]) => u.entries.some((e) => e.status === 'submitted'))

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--white-alpha-2)]"
        style={{ background: expanded ? 'var(--week-header-bg)' : 'transparent' }}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ fontSize: '20px', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>chevron_right</span>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-headline font-bold text-base text-on-surface">{project.name}</h3>
              {project.client && <span className="text-xs text-on-surface-variant">{project.client}</span>}
              {pendingUsers.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-primary bg-primary/10 border border-primary/20">
                  {pendingUsers.length} pending
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">{userList.length} {userList.length === 1 ? 'user' : 'users'} · {totalDays} days</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-[var(--glass-border-subtle)]">
          {userList.map(([userId, userData]) => {
            const userTotal = userData.entries.reduce((sum, e) => sum + Number(e.time_value), 0)
            const userSignoff = signoffs.find((s) => s.user_id === userId)
            const hasSubmitted = userData.entries.some((e) => e.status === 'submitted')
            const hasReturned = userData.entries.some((e) => e.status === 'returned')
            const allSignedOff = userSignoff != null

            return (
              <div key={userId} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--white-alpha-2)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full signature-gradient-bg flex items-center justify-center text-white text-sm font-bold">
                    {userData.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-on-surface text-base">{userData.name}</div>
                    <div className="text-sm text-on-surface-variant">{userData.email} · {userTotal} days · {userData.entries.length} entries</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {allSignedOff ? <StatusBadge status="signed_off" />
                    : hasReturned ? <StatusBadge status="returned" />
                    : hasSubmitted ? <StatusBadge status="submitted" />
                    : <StatusBadge status="draft" />
                  }
                  <button onClick={() => onSelectUser(userId, userData.name)}
                    className="text-primary hover:text-primary-dim font-medium transition-colors flex items-center gap-1 text-sm">
                    Review <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
        const { error } = await supabase.from('user_projects').insert({ user_id: userId, project_id: projectId })
        if (error) throw error
      }
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
            <p className="text-sm text-on-surface-variant">Toggle projects this user can log time against.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects.filter((p) => p.status === 'active').map((project) => {
                const isAssigned = userProjects.some((up) => up.user_id === assigningUser.id && up.project_id === project.id)
                return (
                  <button
                    key={project.id}
                    onClick={() => toggleProjectAssignment(assigningUser.id, project.id, isAssigned)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                      isAssigned ? 'bg-primary/10 border border-primary/20' : 'bg-[var(--white-alpha-2)] border border-[var(--glass-border-subtle)]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-on-surface">{project.name}</p>
                      <p className="text-xs text-on-surface-variant">{project.client}</p>
                    </div>
                    <span className={`material-symbols-outlined ${isAssigned ? 'text-primary' : 'text-on-surface-variant'}`} style={{ fontSize: '20px' }}>
                      {isAssigned ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </button>
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

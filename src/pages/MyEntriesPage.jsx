import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import { supabase } from '../lib/supabase'
import EntryCard from '../components/EntryCard'
import StatusBadge from '../components/StatusBadge'
import { CATEGORIES, isValidHourIncrement, roundDays, formatDate } from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

// Inline edit modal
function EditModal({ entry, onSave, onCancel, saving }) {
  const [category, setCategory] = useState(entry.category)
  const [timeHours, setTimeHours] = useState(entry.time_hours || '')
  const [featureTag, setFeatureTag] = useState(entry.feature_tag || '')
  const [notes, setNotes] = useState(entry.notes || '')

  const cat = CATEGORIES.find((c) => c.value === category)
  const [hourError, setHourError] = useState('')

  function handleSave() {
    const hrs = Number(timeHours) || 0
    if (!isValidHourIncrement(hrs)) {
      setHourError('Must be in 0.25 increments')
      return
    }
    setHourError('')
    onSave({
      category,
      time_hours: hrs || null,
      feature_tag: featureTag || null,
      notes: notes || null,
    })
  }

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }}>
      <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--color-surface-container)' }}>
        <h3 className="font-headline font-bold text-lg text-on-surface">Edit entry</h3>
        <p className="text-sm text-on-surface-variant">{entry.day_name}, {formatDate(entry.entry_date)}</p>

        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-dark">
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${hourError ? 'text-error' : 'text-outline'}`}>Hours {hourError && `— ${hourError}`}</label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            value={timeHours}
            onChange={(e) => { setTimeHours(e.target.value ? Number(e.target.value) : ''); setHourError('') }}
            placeholder="e.g. 3.5"
            className="input-dark"
          />
        </div>

        {cat?.showReference && (
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Reference</label>
            <input type="text" value={featureTag} onChange={(e) => setFeatureTag(e.target.value)} className="input-dark" placeholder={cat.referencePlaceholder} />
          </div>
        )}

        {cat?.requiresNotes && (
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input-dark" />
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pt-2">
          <button onClick={onCancel} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-gradient text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Determine the overall status of a week based on its entries
function getWeekStatus(entries) {
  if (entries.some((e) => e.status === 'returned')) return 'returned'
  if (entries.every((e) => e.status === 'signed_off')) return 'signed_off'
  if (entries.every((e) => e.status === 'submitted')) return 'submitted'
  if (entries.some((e) => e.status === 'submitted')) return 'submitted'
  return 'draft'
}

// Collapsible week card
function WeekCard({ weekEnding, entries, expanded, onToggle, onEdit, onDelete, onSubmit, nonWorkingDays = new Map() }) {
  const totalDaysRaw = entries.reduce((sum, e) => sum + Number(e.time_value), 0)
  const totalDays = roundDays(totalDaysRaw)
  const totalHours = Math.round(entries.reduce((sum, e) => sum + Number(e.time_hours || 0), 0) * 100) / 100
  const weekStatus = getWeekStatus(entries)
  const hasDrafts = entries.some((e) => e.status === 'draft' || e.status === 'returned')
  const hasReturned = entries.some((e) => e.status === 'returned')
  const projectNames = [...new Set(entries.map((e) => e.projects?.name || e.client).filter(Boolean))].join(', ')

  // Group entries by day, then by project within each day
  const dayGroups = entries.reduce((groups, entry) => {
    if (!groups[entry.entry_date]) groups[entry.entry_date] = []
    groups[entry.entry_date].push(entry)
    return groups
  }, {})

  // Find non-working days in this week (Mon–Fri)
  const weDate = new Date(weekEnding + 'T12:00:00')
  const weekStart = new Date(weDate)
  weekStart.setDate(weDate.getDate() - 4)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const nwdInWeek = [...nonWorkingDays.keys()].filter((d) => d >= weekStartStr && d <= weekEnding)

  // Merge NWD dates into the day list so they appear in order
  const allDates = new Set([...Object.keys(dayGroups), ...nwdInWeek])
  const sortedDays = [...allDates].sort()

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Clickable week header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors hover:bg-[var(--white-alpha-2)]"
        style={{ borderBottom: expanded ? '1px solid var(--week-header-border)' : 'none', background: expanded ? 'var(--week-header-bg)' : 'transparent' }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <span
            className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
            style={{ fontSize: '20px', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            chevron_right
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-headline font-bold text-base text-on-surface">
                Week ending {formatDate(weekEnding)}
              </h2>
              <StatusBadge status={weekStatus} />
            </div>
            <p className="text-on-surface-variant text-sm mt-0.5">
              {projectNames} · {totalHours > 0 ? `${totalHours}hrs` : `${totalDays}d`}{totalHours > 0 ? ` (${totalDays.toFixed(2)}d)` : ''} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {hasDrafts && (
            <>
              <Link
                to={`/timesheet?week=${weekEnding}`}
                className="text-sm font-medium text-primary hover:text-primary-dim transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                Edit week
              </Link>
              <button onClick={() => onSubmit(weekEnding)} className="btn-gradient text-sm">
                {hasReturned ? 'Resubmit week' : 'Submit week'}
              </button>
            </>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <>
          {hasReturned && (
            <div className="px-6 py-3 flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
              <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>undo</span>
              <p className="text-sm text-amber-400 font-medium">
                Some entries were returned for editing. Make changes and resubmit the week.
              </p>
            </div>
          )}

          {hasDrafts && !hasReturned && (
            <div className="px-6 py-3 flex items-center gap-2" style={{ background: 'var(--white-alpha-2)', borderBottom: '1px solid var(--glass-border-subtle)' }}>
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>edit_note</span>
              <p className="text-sm text-on-surface-variant">
                These entries are saved as drafts. Submit the week when you're ready for review.
              </p>
            </div>
          )}

          {/* Day groups, entries sorted by project within each day */}
          <div className="divide-y divide-[var(--glass-border-subtle)]">
            {sortedDays.map((date) => {
              const dayEntries = dayGroups[date] || []
              const isNwd = nonWorkingDays.has(date)
              const dayName = dayEntries.length > 0
                ? dayEntries[0].day_name
                : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })

              // Group this day's entries by project
              const projectMap = dayEntries.reduce((g, e) => {
                const key = e.project_id || '_none'
                if (!g[key]) g[key] = { name: e.projects?.name || 'No project', client: e.client, entries: [] }
                g[key].entries.push(e)
                return g
              }, {})
              const sortedProjectKeys = Object.keys(projectMap).sort((a, b) =>
                projectMap[a].name.localeCompare(projectMap[b].name)
              )

              return (
                <div key={date} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-headline font-bold text-on-surface">
                      {dayName}, <span className="text-outline">{formatDate(date)}</span>
                    </span>
                    {isNwd && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10 border border-amber-400/20">
                        {nonWorkingDays.get(date) || 'Non-working day'}
                      </span>
                    )}
                  </div>
                  {dayEntries.length > 0 ? (
                    <div className="space-y-3">
                      {sortedProjectKeys.map((projectKey) => {
                        const project = projectMap[projectKey]
                        const projectTotal = Math.round(project.entries.reduce((sum, e) => sum + Number(e.time_value), 0) * 100) / 100
                        const projectHours = project.entries.reduce((sum, e) => sum + Number(e.time_hours || 0), 0)

                        return (
                          <div key={projectKey}>
                            <div className="flex items-center justify-between mb-2 ml-1">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>folder</span>
                                <span className="text-sm font-bold text-on-surface">{project.name}</span>
                                {project.client && <span className="text-outline text-xs">({project.client})</span>}
                              </div>
                              <span className="text-primary font-bold text-xs">{projectHours > 0 ? `${projectHours}hrs (${projectTotal.toFixed(2)}d)` : `${projectTotal}d`}</span>
                            </div>
                            <div className="space-y-2">
                              {project.entries.map((entry) => (
                                <EntryCard
                                  key={entry.id}
                                  entry={entry}
                                  onEdit={onEdit}
                                  onDelete={onDelete}
                                  readonly={entry.status === 'signed_off'}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : isNwd ? (
                    <p className="text-sm text-on-surface-variant italic">No entries expected</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function MyEntriesPage() {
  const { user } = useAuth()
  const { fetchUserEntries, updateEntry, deleteEntry, submitWeek, loading } = useEntries()

  const [entries, setEntries] = useState([])
  const [editingEntry, setEditingEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState(new Set())
  const [nonWorkingDays, setNonWorkingDays] = useState(new Map())

  const loadEntries = useCallback(async () => {
    if (user?.id) {
      const data = await fetchUserEntries(user.id)
      setEntries(data)

      // Fetch non-working days for this user
      const { data: nwdData } = await supabase
        .from('non_working_days')
        .select('entry_date, reason')
        .eq('user_id', user.id)
      setNonWorkingDays(new Map((nwdData || []).map((r) => [r.entry_date, r.reason || 'Non-working day'])))
    }
  }, [user?.id, fetchUserEntries])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const weekGroups = entries.reduce((groups, entry) => {
    const key = entry.week_ending
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
    return groups
  }, {})

  const sortedWeeks = Object.keys(weekGroups).sort((a, b) => b.localeCompare(a))

  // Separate returned weeks from the rest
  const returnedWeeks = sortedWeeks.filter((w) => weekGroups[w].some((e) => e.status === 'returned'))
  const otherWeeks = sortedWeeks.filter((w) => !weekGroups[w].some((e) => e.status === 'returned'))

  function toggleWeek(weekEnding) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(weekEnding)) {
        next.delete(weekEnding)
      } else {
        next.add(weekEnding)
      }
      return next
    })
  }

  async function handleEdit(updates) {
    setSaving(true)
    try {
      await updateEntry(editingEntry.id, updates)
      setEditingEntry(null)
      setMessage({ type: 'success', text: 'Entry updated.' })
      await loadEntries()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId) {
    if (!confirm('Delete this entry? This cannot be undone.')) return
    try {
      await deleteEntry(entryId)
      setMessage({ type: 'success', text: 'Entry deleted.' })
      await loadEntries()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  async function handleSubmitWeek(weekEnding) {
    try {
      await submitWeek(user.id, weekEnding)
      setMessage({ type: 'success', text: `Week ending ${formatDate(weekEnding)} submitted.` })
      await loadEntries()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Time Management</p>
          <h1 className="text-5xl font-black font-headline text-on-surface tracking-tight">My Entries</h1>
          <p className="text-on-surface-variant mt-3">Review and manage your time distribution across projects and tasks.</p>
        </div>
        <Link
          to="/timesheet"
          className="flex-shrink-0 mt-6 signature-gradient-bg text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          New Entry
        </Link>
      </div>

      {message && (
        <div className={`glass-card rounded-xl p-4 flex items-center gap-3 ${
          message.type === 'success'
            ? 'border-green-400/20'
            : 'border-error/20'
        }`} style={{ background: message.type === 'success' ? 'rgba(74,222,128,0.05)' : 'rgba(255,113,108,0.05)' }}>
          <span className={`material-symbols-outlined ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-400' : 'text-error'}`}>
            {message.text}
          </p>
        </div>
      )}

      {loading && entries.length === 0 && (
        <LoadingSpinner message="Loading your entries..." />
      )}

      {!loading && entries.length === 0 && (
        <div className="glass-card-accent rounded-2xl p-12 text-center">
          <div className="icon-badge-gradient w-16 h-16 mx-auto mb-4" style={{ borderRadius: '16px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '32px' }}>schedule</span>
          </div>
          <p className="text-on-surface-variant mb-4">No entries yet. Start by logging some time.</p>
          <Link to="/timesheet" className="btn-gradient inline-block text-sm">
            Log time
          </Link>
        </div>
      )}

      {/* ── Returned submissions banner ── */}
      {returnedWeeks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '22px' }}>undo</span>
            <div>
              <h2 className="font-headline font-bold text-base text-on-surface">Returned submissions</h2>
              <p className="text-sm text-on-surface-variant">
                {returnedWeeks.length === 1
                  ? 'One week has been returned for editing. Please review and resubmit.'
                  : `${returnedWeeks.length} weeks have been returned for editing. Please review and resubmit.`
                }
              </p>
            </div>
          </div>

          {returnedWeeks.map((weekEnding) => (
            <WeekCard
              key={weekEnding}
              weekEnding={weekEnding}
              entries={weekGroups[weekEnding]}
              expanded={expandedWeeks.has(weekEnding)}
              onToggle={() => toggleWeek(weekEnding)}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
              onSubmit={handleSubmitWeek}
              nonWorkingDays={nonWorkingDays}
            />
          ))}
        </div>
      )}

      {/* ── All other weeks ── */}
      {otherWeeks.length > 0 && (
        <div className="space-y-4">
          {returnedWeeks.length > 0 && (
            <div className="px-1">
              <h2 className="font-headline font-bold text-base text-on-surface">All weeks</h2>
            </div>
          )}

          {otherWeeks.map((weekEnding) => (
            <WeekCard
              key={weekEnding}
              weekEnding={weekEnding}
              entries={weekGroups[weekEnding]}
              expanded={expandedWeeks.has(weekEnding)}
              onToggle={() => toggleWeek(weekEnding)}
              onEdit={setEditingEntry}
              onDelete={handleDelete}
              onSubmit={handleSubmitWeek}
              nonWorkingDays={nonWorkingDays}
            />
          ))}
        </div>
      )}

      {editingEntry && (
        <EditModal
          entry={editingEntry}
          onSave={handleEdit}
          onCancel={() => setEditingEntry(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

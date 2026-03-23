import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import { supabase } from '../lib/supabase'
import {
  CATEGORIES,
  TIME_BLOCKS,
  getCurrentWeekFriday,
  getWeekDates,
  generateReference,
  formatDate,
} from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Entry form row (inside a day) ──
function EntryForm({ entry, onChange, onRemove, index, isExisting }) {
  const category = CATEGORIES.find((c) => c.value === entry.category)
  const readonly = entry.status === 'signed_off' || entry.status === 'submitted'

  return (
    <div className={`glass-card-inset rounded-xl p-5 relative group/entry ${readonly ? 'opacity-70' : ''}`}>
      {onRemove && !readonly && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-error opacity-0 group-hover/entry:opacity-100 transition-opacity"
          title="Remove entry"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
        </button>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="icon-badge-gradient w-7 h-7" style={{ borderRadius: '8px' }}>
          <span className="text-white font-black text-xs">{index + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <h4 className="signature-gradient-text font-bold text-sm">Entry {index + 1}</h4>
          {isExisting && (
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              entry.status === 'returned' ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20'
              : entry.status === 'submitted' ? 'text-primary bg-primary/10 border border-primary/20'
              : entry.status === 'signed_off' ? 'text-green-400 bg-green-400/10 border border-green-400/20'
              : 'text-on-surface-variant bg-white/5 border border-white/10'
            }`}>
              {entry.status === 'signed_off' ? 'Signed off' : entry.status}
            </span>
          )}
        </div>
      </div>

      {readonly && (
        <div className="px-1 mb-3">
          <p className="text-xs text-on-surface-variant italic">
            This entry is {entry.status === 'signed_off' ? 'signed off' : 'submitted'} and cannot be edited.
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${category?.showReference ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-4`}>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Category</label>
          <select
            value={entry.category}
            onChange={(e) => onChange(index, 'category', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
            style={{ background: 'var(--color-surface-variant)', border: 'none' }}
          >
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Time Block</label>
          <select
            value={entry.time_block}
            onChange={(e) => onChange(index, 'time_block', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
            style={{ background: 'var(--color-surface-variant)', border: 'none' }}
          >
            <option value="">Select time</option>
            {TIME_BLOCKS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {category?.showReference && (
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Reference</label>
            <input
              type="text"
              value={entry.feature_tag}
              onChange={(e) => onChange(index, 'feature_tag', e.target.value)}
              disabled={readonly}
              className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
              style={{ background: 'var(--color-surface-variant)', border: 'none' }}
              placeholder={category.referencePlaceholder}
            />
          </div>
        )}
      </div>

      {entry.category && (
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Notes</label>
          <textarea
            value={entry.notes}
            onChange={(e) => onChange(index, 'notes', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none disabled:opacity-60"
            style={{ background: 'var(--color-surface-variant)', border: 'none' }}
            placeholder="Describe your work..."
            rows={2}
          />
        </div>
      )}

      {isExisting && entry.return_reason && (
        <div className="mt-3 flex items-start gap-2 px-1">
          <span className="material-symbols-outlined text-amber-400 flex-shrink-0" style={{ fontSize: '16px' }}>undo</span>
          <p className="text-xs text-amber-400">{entry.return_reason}</p>
        </div>
      )}
    </div>
  )
}

// ── Collapsible day section ──
function DaySection({ day, entries, onAddEntry, onChangeEntry, onRemoveEntry }) {
  const [open, setOpen] = useState(true)
  const totalDays = entries.reduce((sum, e) => {
    if (e._id) {
      // Existing entry — use stored time_value
      return sum + (Number(e.time_value) || 0)
    }
    const tb = TIME_BLOCKS.find((t) => t.value === e.time_block)
    return sum + (tb?.numericValue || 0)
  }, 0)

  const hasEditableEntries = entries.some((e) => e.status !== 'signed_off' && e.status !== 'submitted')

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${!open && entries.length === 0 ? 'opacity-80 hover:opacity-100' : ''} transition-opacity`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-baseline gap-4">
          <h3 className="text-xl font-bold font-headline text-on-surface">{day.dayName}</h3>
          <span className="text-sm text-outline">{formatDate(day.date)}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-primary font-bold">{totalDays.toFixed(2)}d logged</span>
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
            {open ? 'expand_more' : 'chevron_right'}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 space-y-4">
          {entries.length === 0 && (
            <p className="text-sm text-on-surface-variant italic">No entries for this day</p>
          )}
          {entries.map((entry, idx) => (
            <EntryForm
              key={entry._id || `new-${idx}`}
              entry={entry}
              index={idx}
              isExisting={!!entry._id}
              onChange={(i, field, value) => onChangeEntry(day.date, i, field, value)}
              onRemove={(i) => onRemoveEntry(day.date, i)}
            />
          ))}
          <button
            type="button"
            onClick={() => onAddEntry(day.date)}
            className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, rgba(0,201,255,0.08) 0%, rgba(123,47,219,0.08) 100%)',
              border: '2px dashed rgba(0,201,255,0.3)',
              color: '#66d3ff',
            }}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add entry
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──
export default function TimesheetPage() {
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const { submitEntries, updateEntry, deleteEntry, fetchWeekEntries, loading, error } = useEntries()

  const [weekEnding, setWeekEnding] = useState(searchParams.get('week') || getCurrentWeekFriday())
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [userProjects, setUserProjects] = useState([])
  const [includeWeekend, setIncludeWeekend] = useState(false)
  const [entriesByDate, setEntriesByDate] = useState({})
  const [submitStatus, setSubmitStatus] = useState(null)
  const [loadingWeek, setLoadingWeek] = useState(false)

  // Load user's assigned projects
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_projects')
      .select('project_id, projects(id, name, client, status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const active = (data || [])
          .map((up) => up.projects)
          .filter((p) => p && p.status === 'active')
        setUserProjects(active)
        // Auto-select first project if none selected
        if (!selectedProjectId && active.length === 1) {
          setSelectedProjectId(active[0].id)
        }
      })
  }, [user?.id])

  const selectedProject = userProjects.find((p) => p.id === selectedProjectId)
  const client = selectedProject?.client || ''

  const weekDates = getWeekDates(weekEnding)
  const visibleDays = includeWeekend ? weekDates : weekDates.filter((d) => !d.isWeekend)

  // Load existing entries into the day sections when week changes
  useEffect(() => {
    if (!user?.id || !weekEnding) return

    setLoadingWeek(true)
    setSubmitStatus(null)

    fetchWeekEntries(user.id, weekEnding).then((data) => {
      if (data.length > 0) {
        // Group existing entries by date and convert to form format
        const grouped = {}
        for (const entry of data) {
          if (!grouped[entry.entry_date]) grouped[entry.entry_date] = []
          grouped[entry.entry_date].push({
            _id: entry.id,               // marker: this is an existing DB entry
            _original: { ...entry },      // snapshot for dirty checking
            category: entry.category || '',
            time_block: entry.time_block || '',
            time_value: entry.time_value,
            feature_tag: entry.feature_tag || '',
            notes: entry.notes || '',
            status: entry.status,
            return_reason: entry.return_reason || null,
          })
          // Auto-select project from first entry if not set
          if (!selectedProjectId && entry.project_id) {
            setSelectedProjectId(entry.project_id)
          }
        }
        setEntriesByDate(grouped)
      } else {
        setEntriesByDate({})
      }
      setLoadingWeek(false)
    })
  }, [user?.id, weekEnding, fetchWeekEntries])

  function emptyEntry() {
    return { category: '', time_block: '', feature_tag: '', notes: '' }
  }

  function addEntry(date) {
    setEntriesByDate((prev) => ({
      ...prev,
      [date]: [...(prev[date] || []), emptyEntry()],
    }))
  }

  function changeEntry(date, index, field, value) {
    setEntriesByDate((prev) => {
      const dayEntries = [...(prev[date] || [])]
      const entry = dayEntries[index]
      // Don't allow editing submitted/signed_off entries
      if (entry?.status === 'signed_off' || entry?.status === 'submitted') return prev
      dayEntries[index] = { ...entry, [field]: value }
      // If time_block changed on an existing entry, update the time_value too
      if (field === 'time_block' && entry?._id) {
        const tb = TIME_BLOCKS.find((t) => t.value === value)
        if (tb) dayEntries[index].time_value = tb.numericValue
      }
      return { ...prev, [date]: dayEntries }
    })
  }

  function removeEntry(date, index) {
    setEntriesByDate((prev) => {
      const dayEntries = [...(prev[date] || [])]
      const entry = dayEntries[index]
      // Don't allow removing submitted/signed_off
      if (entry?.status === 'signed_off' || entry?.status === 'submitted') return prev
      // If it's an existing entry, mark for deletion instead of splicing
      if (entry?._id) {
        dayEntries[index] = { ...entry, _deleted: true }
      } else {
        dayEntries.splice(index, 1)
      }
      return { ...prev, [date]: dayEntries }
    })
  }

  function validate() {
    const allEntries = visibleDays.flatMap((day) => {
      return (entriesByDate[day.date] || [])
        .filter((e) => !e._deleted && !e._id) // only validate NEW entries
        .map((e, i) => ({ ...e, day, index: i }))
    })

    const newEntries = allEntries.filter((e) => !e._id)
    // Also validate dirty existing entries
    const dirtyExisting = visibleDays.flatMap((day) => {
      return (entriesByDate[day.date] || [])
        .filter((e) => e._id && !e._deleted && isDirty(e))
        .map((e, i) => ({ ...e, day, index: i }))
    })

    const toValidate = [...newEntries, ...dirtyExisting]

    for (const entry of toValidate) {
      if (!entry.category) return `${entry.day.dayName}: Select a category for an entry.`
      if (!entry.time_block) return `${entry.day.dayName}: Select a time block for an entry.`

      const cat = CATEGORIES.find((c) => c.value === entry.category)
      if (cat?.showReference && !entry.feature_tag.trim()) {
        return `${entry.day.dayName}: Reference is required for ${entry.category}.`
      }
      if (cat?.requiresNotes && !entry.notes.trim()) {
        return `${entry.day.dayName}: Notes are required for ${entry.category}.`
      }
    }

    return null
  }

  function isDirty(entry) {
    if (!entry._original) return false
    return (
      entry.category !== (entry._original.category || '') ||
      entry.time_block !== (entry._original.time_block || '') ||
      entry.feature_tag !== (entry._original.feature_tag || '') ||
      entry.notes !== (entry._original.notes || '')
    )
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setSubmitStatus({ type: 'error', message: validationError })
      return
    }

    try {
      const updates = []
      const deletes = []
      const newRows = []

      // Count existing entries for reference numbering
      let existingCount = 0

      for (const day of visibleDays) {
        const dayEntries = entriesByDate[day.date] || []
        for (const entry of dayEntries) {
          if (entry._id && entry._deleted) {
            // Delete this existing entry (only if draft/returned)
            if (entry.status === 'draft' || entry.status === 'returned') {
              deletes.push(entry._id)
            }
          } else if (entry._id && isDirty(entry)) {
            // Update this existing entry
            const tb = TIME_BLOCKS.find((t) => t.value === entry.time_block)
            updates.push({
              id: entry._id,
              changes: {
                category: entry.category,
                time_block: entry.time_block,
                time_value: tb?.numericValue || entry.time_value,
                feature_tag: entry.feature_tag || null,
                notes: entry.notes || null,
              },
            })
          }
          if (entry._id) existingCount++
        }
      }

      // Collect new entries
      let counter = existingCount + 1
      for (const day of visibleDays) {
        const dayEntries = entriesByDate[day.date] || []
        for (const entry of dayEntries) {
          if (!entry._id && entry.category && entry.time_block) {
            const tb = TIME_BLOCKS.find((t) => t.value === entry.time_block)
            newRows.push({
              user_id: user.id,
              reference: generateReference(day.date, counter++),
              client: client,
              project_id: selectedProjectId || null,
              week_ending: weekEnding,
              day_name: day.dayName,
              entry_date: day.date,
              category: entry.category,
              time_block: entry.time_block,
              time_value: tb.numericValue,
              feature_tag: entry.feature_tag || null,
              notes: entry.notes || null,
              status: 'draft',
            })
          }
        }
      }

      // Execute all operations
      const ops = []
      for (const del of deletes) {
        ops.push(deleteEntry(del))
      }
      for (const upd of updates) {
        ops.push(updateEntry(upd.id, upd.changes))
      }
      if (newRows.length > 0) {
        ops.push(submitEntries(newRows))
      }

      if (ops.length === 0) {
        setSubmitStatus({ type: 'error', message: 'No changes to save.' })
        return
      }

      await Promise.all(ops)

      const parts = []
      if (newRows.length > 0) parts.push(`${newRows.length} new ${newRows.length === 1 ? 'entry' : 'entries'} created`)
      if (updates.length > 0) parts.push(`${updates.length} ${updates.length === 1 ? 'entry' : 'entries'} updated`)
      if (deletes.length > 0) parts.push(`${deletes.length} ${deletes.length === 1 ? 'entry' : 'entries'} deleted`)

      setSubmitStatus({ type: 'success', message: parts.join(', ') + '.' })

      // Reload entries to get fresh state
      const data = await fetchWeekEntries(user.id, weekEnding)
      const grouped = {}
      for (const entry of data) {
        if (!grouped[entry.entry_date]) grouped[entry.entry_date] = []
        grouped[entry.entry_date].push({
          _id: entry.id,
          _original: { ...entry },
          category: entry.category || '',
          time_block: entry.time_block || '',
          time_value: entry.time_value,
          feature_tag: entry.feature_tag || '',
          notes: entry.notes || '',
          status: entry.status,
          return_reason: entry.return_reason || null,
        })
      }
      setEntriesByDate(grouped)
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message })
    }
  }

  // Calculate totals
  const allVisible = visibleDays.flatMap((day) => (entriesByDate[day.date] || []).filter((e) => !e._deleted))
  const totalDays = allVisible.reduce((sum, e) => {
    if (e._id) return sum + (Number(e.time_value) || 0)
    const tb = TIME_BLOCKS.find((t) => t.value === e.time_block)
    return sum + (tb?.numericValue || 0)
  }, 0)
  const newEntryCount = allVisible.filter((e) => !e._id && e.category && e.time_block).length
  const dirtyCount = allVisible.filter((e) => e._id && isDirty(e)).length
  const deletedCount = visibleDays.reduce((sum, day) => {
    return sum + (entriesByDate[day.date] || []).filter((e) => e._deleted).length
  }, 0)
  const hasChanges = newEntryCount > 0 || dirtyCount > 0 || deletedCount > 0

  // Filter out deleted entries for display
  const visibleEntries = (date) => (entriesByDate[date] || []).filter((e) => !e._deleted)

  return (
    <>
      <div className="space-y-8 pb-28">
        {/* Page heading */}
        <div>
          <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Time Management</p>
          <h1 className="text-5xl font-black font-headline text-on-surface tracking-tight">Log Time</h1>
          <p className="text-on-surface-variant mt-3">Record your time entries for the current week across projects and categories.</p>
        </div>

        {/* Status messages */}
        {submitStatus && (
          <div className={`glass-card rounded-xl p-4 flex items-center gap-3 ${
            submitStatus.type === 'success' ? 'border-green-400/20' : 'border-error/20'
          }`} style={{ background: submitStatus.type === 'success' ? 'rgba(74,222,128,0.05)' : 'rgba(255,113,108,0.05)' }}>
            <span className={`material-symbols-outlined ${submitStatus.type === 'success' ? 'text-green-400' : 'text-error'}`}>
              {submitStatus.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className={`text-sm font-medium ${submitStatus.type === 'success' ? 'text-green-400' : 'text-error'}`}>
              {submitStatus.message}
            </p>
          </div>
        )}

        {/* Section 1: Week details */}
        <section className="glass-card-accent rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Week ending (Friday)</label>
              <input
                type="date"
                value={weekEnding}
                onChange={(e) => setWeekEnding(e.target.value)}
                className="w-full bg-white/5 border-outline-variant rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-on-surface"
                style={{ background: 'var(--glass-bg)', borderColor: 'var(--color-outline-variant)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Project</label>
              {userProjects.length > 0 ? (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-white/5 border-outline-variant rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-on-surface"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--color-outline-variant)' }}
                >
                  <option value="">Select project</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-on-surface-variant py-3">No projects assigned. Ask an admin to assign you to a project.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeekend}
                onChange={(e) => setIncludeWeekend(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"
                style={{
                  backgroundColor: includeWeekend ? '#66d3ff' : 'rgba(111, 117, 139, 0.3)',
                  border: includeWeekend ? '1px solid #66d3ff' : '1px solid rgba(111, 117, 139, 0.6)',
                }}
              ></div>
            </label>
            <span className="text-sm font-medium text-on-surface-variant">Include Saturday and Sunday</span>
          </div>
        </section>

        {/* Section 2: Day sections */}
        {loadingWeek ? (
          <LoadingSpinner message="Loading week entries..." />
        ) : (
          <div className="space-y-4">
            {visibleDays.map((day) => (
              <DaySection
                key={day.date}
                day={day}
                entries={visibleEntries(day.date)}
                onAddEntry={addEntry}
                onChangeEntry={changeEntry}
                onRemoveEntry={removeEntry}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 w-full z-40">
        <div style={{ background: 'var(--color-surface-container-low)', backdropFilter: 'blur(24px)', borderTop: 'var(--glass-border)', boxShadow: '0 -4px 30px var(--glass-border-subtle)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Week total</span>
              <span className="text-on-surface-variant font-medium text-sm">
                <span className="text-primary font-bold">{totalDays} days</span>
                {hasChanges && (
                  <span className="text-on-surface-variant ml-2">
                    ({[
                      newEntryCount > 0 && `${newEntryCount} new`,
                      dirtyCount > 0 && `${dirtyCount} edited`,
                      deletedCount > 0 && `${deletedCount} removed`,
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/my-entries"
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Back to entries
              </Link>
              <button
                onClick={handleSubmit}
                disabled={loading || !hasChanges || !selectedProjectId}
                className="signature-gradient-bg px-8 py-3 rounded-xl font-bold text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

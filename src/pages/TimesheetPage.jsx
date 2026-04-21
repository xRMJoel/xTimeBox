import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import { supabase } from '../lib/supabase'
import WeekCalendar from '../components/WeekCalendar'
import {
  CATEGORIES,
  isValidHourIncrement,
  hoursToDaysRaw,
  roundDays,
  daysToTimeBlock,
  getCurrentWeekFriday,
  getWeekDates,
  generateReference,
  formatDate,
} from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Entry form row (inside a day) ──
function EntryForm({ entry, onChange, onRemove, index, isExisting, userProjects, errors }) {
  const category = CATEGORIES.find((c) => c.value === entry.category)
  const readonly = entry.status === 'signed_off' || entry.status === 'submitted'
  const errorStyle = { background: 'var(--color-surface-variant)', border: '1.5px solid rgba(255,113,108,0.6)' }
  const normalStyle = { background: 'var(--color-surface-variant)', border: 'none' }

  // Get hours_per_day for the selected project
  const selectedProject = userProjects.find((p) => p.id === entry.project_id)
  const hoursPerDay = selectedProject?.hours_per_day
  const rawDayEquivalent = entry.time_hours && hoursPerDay ? hoursToDaysRaw(entry.time_hours, hoursPerDay) : null

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

      {/* Project selector per entry */}
      <div className="mb-4">
        <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${errors?.project_id ? 'text-error' : 'text-outline'}`}>Project {errors?.project_id && '— required'}</label>
        {userProjects.length > 0 ? (
          <select
            value={entry.project_id || ''}
            onChange={(e) => onChange(index, 'project_id', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
            style={errors?.project_id ? errorStyle : normalStyle}
          >
            <option value="">Select project</option>
            {userProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-on-surface-variant italic py-1">No projects assigned. Ask an admin to assign you to a project.</p>
        )}
      </div>

      <div className={`grid grid-cols-1 ${category?.showReference ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-4`}>
        <div>
          <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${errors?.category ? 'text-error' : 'text-outline'}`}>Category {errors?.category && '— required'}</label>
          <select
            value={entry.category}
            onChange={(e) => onChange(index, 'category', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
            style={errors?.category ? errorStyle : normalStyle}
          >
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${errors?.time_hours ? 'text-error' : 'text-outline'}`}>Hours {errors?.time_hours && '— required (0.25 increments)'}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={entry.time_hours || ''}
              onChange={(e) => onChange(index, 'time_hours', e.target.value ? Number(e.target.value) : '')}
              disabled={readonly || !entry.project_id}
              placeholder={!entry.project_id ? 'Select project first' : 'e.g. 3.5'}
              className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
              style={errors?.time_hours ? errorStyle : normalStyle}
            />
            {rawDayEquivalent !== null && (
              <span className="text-xs text-on-surface-variant whitespace-nowrap font-medium" title={`${entry.time_hours}hrs / ${hoursPerDay}hrs per day`}>
                = {rawDayEquivalent.toFixed(4)}d
              </span>
            )}
          </div>
          {!hoursPerDay && entry.project_id && (
            <p className="text-[10px] text-amber-400 mt-1">Hours per day not set for this project. Ask an admin to configure it.</p>
          )}
        </div>

        {category?.showReference && (
          <div>
            <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${errors?.feature_tag ? 'text-error' : 'text-outline'}`}>Reference {errors?.feature_tag && '— required'}</label>
            <input
              type="text"
              value={entry.feature_tag}
              onChange={(e) => onChange(index, 'feature_tag', e.target.value)}
              disabled={readonly}
              className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none disabled:opacity-60"
              style={errors?.feature_tag ? errorStyle : normalStyle}
              placeholder={category.referencePlaceholder}
            />
          </div>
        )}
      </div>

      {entry.category && (
        <div>
          <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${errors?.notes ? 'text-error' : 'text-outline'}`}>Notes {errors?.notes && '— required'}</label>
          <textarea
            value={entry.notes}
            onChange={(e) => onChange(index, 'notes', e.target.value)}
            disabled={readonly}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none disabled:opacity-60"
            style={errors?.notes ? errorStyle : normalStyle}
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
function DaySection({ day, entries, onAddEntry, onChangeEntry, onRemoveEntry, userProjects, isNonWorking, onToggleNonWorking, validationErrors }) {
  const [open, setOpen] = useState(true)
  const totalHours = entries.reduce((sum, e) => sum + (Number(e.time_hours) || 0), 0)
  const totalDaysRaw = entries.reduce((sum, e) => {
    if (e._id) {
      // Existing entry — use stored time_value (unrounded)
      return sum + (Number(e.time_value) || 0)
    }
    // New entry — calculate raw days from hours
    const proj = userProjects.find((p) => p.id === e.project_id)
    if (e.time_hours && proj?.hours_per_day) {
      return sum + hoursToDaysRaw(e.time_hours, proj.hours_per_day)
    }
    return sum
  }, 0)

  const hasEditableEntries = entries.some((e) => e.status !== 'signed_off' && e.status !== 'submitted')

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${!open && entries.length === 0 ? 'opacity-80 hover:opacity-100' : ''} transition-opacity ${isNonWorking ? 'ring-1 ring-purple-400/30' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-4">
            <h3 className="text-xl font-bold font-headline text-on-surface">{day.dayName}</h3>
            <span className="text-sm text-outline">{formatDate(day.date)}</span>
          </div>
          {isNonWorking && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-purple-400 bg-purple-400/10 border-purple-400/20">
              Non-working
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isNonWorking ? (
            <span className="text-purple-400 font-bold text-sm">Non-working day</span>
          ) : (
            <span className="text-primary font-bold">
              {totalHours > 0 ? `${totalHours}hrs` : '0hrs'}
            </span>
          )}
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
            {open ? 'expand_more' : 'chevron_right'}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-2 space-y-4">
          {isNonWorking ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'rgba(182,133,255,0.06)', border: '1px solid rgba(182,133,255,0.15)' }}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-purple-400" style={{ fontSize: '20px' }}>event_busy</span>
                <span className="text-sm text-on-surface-variant">This day is marked as a non-working day.</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleNonWorking() }}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
              >Remove</button>
            </div>
          ) : (
            <>
              {entries.length === 0 && (
                <p className="text-sm text-on-surface-variant italic">No entries for this day</p>
              )}
              {entries.map((entry, idx) => {
                // Collect field-level errors for this entry
                const entryErrors = {}
                const prefix = `${day.date}:${idx}:`
                if (validationErrors) {
                  for (const k of Object.keys(validationErrors)) {
                    if (k.startsWith(prefix)) entryErrors[k.slice(prefix.length)] = true
                  }
                }
                return (
                  <EntryForm
                    key={entry._id || `new-${idx}`}
                    entry={entry}
                    index={idx}
                    isExisting={!!entry._id}
                    userProjects={userProjects}
                    onChange={(i, field, value) => onChangeEntry(day.date, i, field, value)}
                    onRemove={(i) => onRemoveEntry(day.date, i)}
                    errors={Object.keys(entryErrors).length > 0 ? entryErrors : null}
                  />
                )
              })}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onAddEntry(day.date)}
                  className="flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,201,255,0.08) 0%, rgba(123,47,219,0.08) 100%)',
                    border: '2px dashed rgba(0,201,255,0.3)',
                    color: '#66d3ff',
                  }}
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  Add entry
                </button>
                {entries.length === 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleNonWorking() }}
                    className="py-4 px-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] text-purple-400"
                    style={{
                      background: 'rgba(182,133,255,0.06)',
                      border: '2px dashed rgba(182,133,255,0.25)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>event_busy</span>
                    Non-working
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──
export default function TimesheetPage() {
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { submitEntries, updateEntry, deleteEntry, fetchWeekEntries, submitWeek, loading, error } = useEntries()

  const [weekEnding, setWeekEnding] = useState(searchParams.get('week') || getCurrentWeekFriday())
  const [userProjects, setUserProjects] = useState([])
  const [includeWeekend, setIncludeWeekend] = useState(false)
  const [entriesByDate, setEntriesByDate] = useState({})
  const [submitStatus, setSubmitStatus] = useState(null)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [nonWorkingDays, setNonWorkingDays] = useState(new Set()) // Set of date strings
  const [nwdChanged, setNwdChanged] = useState(false) // tracks if user toggled a non-working day
  const [validationErrors, setValidationErrors] = useState({}) // keyed by "date:index:field"
  const submittingRef = useRef(false)

  // Load user's assigned projects (including hours_per_day from the assignment)
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_projects')
      .select('project_id, hours_per_day, projects(id, name, client, status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const active = (data || [])
          .filter((up) => up.projects && up.projects.status === 'active')
          .map((up) => ({
            ...up.projects,
            hours_per_day: up.hours_per_day ? Number(up.hours_per_day) : null,
          }))
        setUserProjects(active)
      })
  }, [user?.id])

  const weekDates = getWeekDates(weekEnding)
  const visibleDays = includeWeekend ? weekDates : weekDates.filter((d) => !d.isWeekend)

  // Load existing entries and non-working days when week changes
  useEffect(() => {
    if (!user?.id || !weekEnding) return

    setLoadingWeek(true)
    setSubmitStatus(null)
    setNwdChanged(false)
    setValidationErrors({})

    const dates = getWeekDates(weekEnding)
    const from = dates[0].date
    const to = dates[dates.length - 1].date

    Promise.all([
      fetchWeekEntries(user.id, weekEnding),
      supabase
        .from('non_working_days')
        .select('entry_date')
        .eq('user_id', user.id)
        .gte('entry_date', from)
        .lte('entry_date', to),
    ]).then(([data, nwdRes]) => {
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
            time_hours: entry.time_hours || '',
            feature_tag: entry.feature_tag || '',
            notes: entry.notes || '',
            project_id: entry.project_id || '',
            status: entry.status,
            return_reason: entry.return_reason || null,
          })
        }
        setEntriesByDate(grouped)
      } else {
        setEntriesByDate({})
      }

      // Set non-working days
      const nwdSet = new Set((nwdRes.data || []).map((r) => r.entry_date))
      setNonWorkingDays(nwdSet)

      setLoadingWeek(false)
    })
  }, [user?.id, weekEnding, fetchWeekEntries])

  async function toggleNonWorkingDay(date) {
    if (!user?.id) return
    const isNwd = nonWorkingDays.has(date)
    if (isNwd) {
      // Remove
      await supabase.from('non_working_days').delete().eq('user_id', user.id).eq('entry_date', date)
      setNonWorkingDays((prev) => { const next = new Set(prev); next.delete(date); return next })
    } else {
      // Add
      await supabase.from('non_working_days').insert({ user_id: user.id, entry_date: date })
      setNonWorkingDays((prev) => new Set(prev).add(date))
    }
    setNwdChanged(true)
  }

  function emptyEntry() {
    // Default to user's only project if they have exactly one
    const defaultProjectId = userProjects.length === 1 ? userProjects[0].id : ''
    return { category: '', time_block: '', time_hours: '', feature_tag: '', notes: '', project_id: defaultProjectId }
  }

  function addEntry(date) {
    setEntriesByDate((prev) => ({
      ...prev,
      [date]: [...(prev[date] || []), emptyEntry()],
    }))
  }

  function changeEntry(date, index, field, value) {
    // Clear validation error for this field when user edits it
    const errorKey = `${date}:${index}:${field}`
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => { const next = { ...prev }; delete next[errorKey]; return next })
    }
    setEntriesByDate((prev) => {
      const dayEntries = [...(prev[date] || [])]
      const entry = dayEntries[index]
      // Don't allow editing submitted/signed_off entries
      if (entry?.status === 'signed_off' || entry?.status === 'submitted') return prev
      dayEntries[index] = { ...entry, [field]: value }
      // If time_hours changed, recalculate raw (unrounded) time_value
      if (field === 'time_hours' && value) {
        const proj = userProjects.find((p) => p.id === (dayEntries[index].project_id))
        if (proj?.hours_per_day) {
          dayEntries[index].time_value = hoursToDaysRaw(Number(value), proj.hours_per_day)
          dayEntries[index].time_block = daysToTimeBlock(dayEntries[index].time_value)
        }
      }
      // If project changed, recalculate raw time_value from hours with new rate
      if (field === 'project_id' && dayEntries[index].time_hours) {
        const proj = userProjects.find((p) => p.id === value)
        if (proj?.hours_per_day) {
          dayEntries[index].time_value = hoursToDaysRaw(Number(dayEntries[index].time_hours), proj.hours_per_day)
          dayEntries[index].time_block = daysToTimeBlock(dayEntries[index].time_value)
        }
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
    const errors = {}

    for (const day of visibleDays) {
      const dayEntries = (entriesByDate[day.date] || []).filter((e) => !e._deleted)
      dayEntries.forEach((entry, idx) => {
        // Validate new entries and dirty existing entries
        const isNew = !entry._id
        const dirty = entry._id && isDirty(entry)
        if (!isNew && !dirty) return

        const key = (field) => `${day.date}:${idx}:${field}`
        if (!entry.project_id) errors[key('project_id')] = true
        if (!entry.category) errors[key('category')] = true
        if (!entry.time_hours || !isValidHourIncrement(entry.time_hours)) errors[key('time_hours')] = true

        const cat = CATEGORIES.find((c) => c.value === entry.category)
        if (cat?.showReference && !entry.feature_tag.trim()) errors[key('feature_tag')] = true
        if (cat?.requiresNotes && !entry.notes.trim()) errors[key('notes')] = true
      })
    }

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      const count = new Set(Object.keys(errors).map((k) => k.split(':').slice(0, 2).join(':'))).size
      return `${count} ${count === 1 ? 'entry has' : 'entries have'} missing fields. Please complete the highlighted fields.`
    }
    return null
  }

  function isDirty(entry) {
    if (!entry._original) return false
    return (
      entry.category !== (entry._original.category || '') ||
      entry.time_hours !== (entry._original.time_hours || '') ||
      entry.feature_tag !== (entry._original.feature_tag || '') ||
      entry.notes !== (entry._original.notes || '') ||
      entry.project_id !== (entry._original.project_id || '')
    )
  }

  async function handleSubmit({ skipNavigate = false } = {}) {
    if (submittingRef.current) return false
    submittingRef.current = true

    const validationError = validate()
    if (validationError) {
      setSubmitStatus({ type: 'error', message: validationError })
      submittingRef.current = false
      return false
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
            const proj = userProjects.find((p) => p.id === entry.project_id)
            const hrs = Number(entry.time_hours) || 0
            const hpd = proj?.hours_per_day
            const rawDays = hpd ? hoursToDaysRaw(hrs, hpd) : entry.time_value
            const blockLabel = daysToTimeBlock(rawDays)
            updates.push({
              id: entry._id,
              changes: {
                category: entry.category,
                time_hours: hrs || null,
                time_block: blockLabel,
                time_value: rawDays,
                feature_tag: entry.feature_tag || null,
                notes: entry.notes || null,
                project_id: entry.project_id || null,
                client: proj?.client || entry._original?.client || '',
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
          if (!entry._id && entry.category && entry.time_hours) {
            const entryProject = userProjects.find((p) => p.id === entry.project_id)
            const hrs = Number(entry.time_hours)
            const hpd = entryProject?.hours_per_day
            const rawDays = hpd ? hoursToDaysRaw(hrs, hpd) : hrs
            const blockLabel = daysToTimeBlock(rawDays)
            newRows.push({
              user_id: user.id,
              reference: generateReference(day.date, counter++),
              client: entryProject?.client || '',
              project_id: entry.project_id || null,
              week_ending: weekEnding,
              day_name: day.dayName,
              entry_date: day.date,
              category: entry.category,
              time_hours: hrs,
              time_block: blockLabel,
              time_value: rawDays,
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

      if (ops.length === 0 && !nwdChanged) {
        setSubmitStatus({ type: 'error', message: 'No changes to save.' })
        submittingRef.current = false
        return false
      }

      if (ops.length > 0) {
        await Promise.all(ops)
      }

      const parts = []
      if (newRows.length > 0) parts.push(`${newRows.length} new ${newRows.length === 1 ? 'entry' : 'entries'} created`)
      if (updates.length > 0) parts.push(`${updates.length} ${updates.length === 1 ? 'entry' : 'entries'} updated`)
      if (deletes.length > 0) parts.push(`${deletes.length} ${deletes.length === 1 ? 'entry' : 'entries'} deleted`)
      if (nwdChanged && parts.length === 0) parts.push('Non-working days updated')

      setSubmitStatus({ type: 'success', message: parts.join(', ') + '.' })
      setNwdChanged(false)
      if (!skipNavigate) navigate('/my-entries')
      return true
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message })
      return false
    } finally {
      submittingRef.current = false
    }
  }

  async function handleSubmitWeek() {
    // Save any pending changes first — skip navigate so we can submit the week after
    if (hasChanges) {
      const saved = await handleSubmit({ skipNavigate: true })
      if (!saved) return // validation or save failed
    }

    try {
      await submitWeek(user.id, weekEnding)
      setSubmitStatus({ type: 'success', message: 'Week submitted for approval.' })
      navigate('/my-entries')
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message })
    }
  }

  // Calculate totals — rounding happens at week level
  const allVisible = visibleDays.flatMap((day) => (entriesByDate[day.date] || []).filter((e) => !e._deleted))
  const totalHoursAll = allVisible.reduce((sum, e) => sum + (Number(e.time_hours) || 0), 0)
  const totalDaysRaw = allVisible.reduce((sum, e) => {
    if (e._id) return sum + (Number(e.time_value) || 0)
    const proj = userProjects.find((p) => p.id === e.project_id)
    if (e.time_hours && proj?.hours_per_day) return sum + hoursToDaysRaw(Number(e.time_hours), proj.hours_per_day)
    return sum
  }, 0)
  const totalDays = roundDays(totalDaysRaw)
  const newEntryCount = allVisible.filter((e) => !e._id && e.category && e.time_hours).length
  const dirtyCount = allVisible.filter((e) => e._id && isDirty(e)).length
  const deletedCount = visibleDays.reduce((sum, day) => {
    return sum + (entriesByDate[day.date] || []).filter((e) => e._deleted).length
  }, 0)
  const hasChanges = newEntryCount > 0 || dirtyCount > 0 || deletedCount > 0 || nwdChanged
  const submittableCount = allVisible.filter((e) => e._id && (e.status === 'draft' || e.status === 'returned')).length
  const hasSubmittable = submittableCount > 0 || newEntryCount > 0
  const hasSignedOff = allVisible.some((e) => e.status === 'signed_off')

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

        {/* Partial sign-off notice — appears when this week contains any signed-off entries */}
        {hasSignedOff && (
          <div className="glass-card rounded-xl p-4 flex items-center gap-3 border-green-400/20" style={{ background: 'rgba(74,222,128,0.05)' }}>
            <span className="material-symbols-outlined text-green-400">lock</span>
            <p className="text-sm font-medium text-on-surface">
              Some entries in this week are signed off and cannot be edited. You can still add time or edit entries on the other days.
            </p>
          </div>
        )}

        {/* Section 1: Week details — overflow visible so calendar dropdown isn't clipped */}
        <section className="glass-card-accent rounded-2xl p-8" style={{ overflow: 'visible', position: 'relative', zIndex: 30 }}>
          <div className="mb-6">
            <div className="max-w-xs">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Week ending (Friday)</label>
              <WeekCalendar value={weekEnding} onChange={setWeekEnding} userId={user?.id} highlightDates={nonWorkingDays} />
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
                userProjects={userProjects}
                onAddEntry={addEntry}
                onChangeEntry={changeEntry}
                onRemoveEntry={removeEntry}
                isNonWorking={nonWorkingDays.has(day.date)}
                onToggleNonWorking={() => toggleNonWorkingDay(day.date)}
                validationErrors={validationErrors}
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
                <span className="text-primary font-bold">{totalHoursAll}hrs</span>
                <span className="text-on-surface-variant ml-1">({totalDays.toFixed(2)}d)</span>
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
            <div className="flex items-center gap-3">
              <Link
                to="/my-entries"
                className="px-5 py-3 rounded-xl font-bold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Back to entries
              </Link>
              {(hasChanges || submittableCount > 0) && (
                <button
                  onClick={hasChanges ? handleSubmit : () => navigate('/my-entries')}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl font-bold text-on-surface border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:transform-none disabled:cursor-not-allowed"
                  style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--glass-bg)' }}
                >
                  {loading ? 'Saving...' : 'Save draft'}
                </button>
              )}
              <button
                onClick={handleSubmitWeek}
                disabled={loading || (!hasSubmittable && !hasChanges)}
                className="signature-gradient-bg px-6 py-3 rounded-xl font-bold text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : (hasSignedOff ? 'Submit drafts' : 'Submit week')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

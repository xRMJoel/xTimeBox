import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import {
  CATEGORIES,
  TIME_BLOCKS,
  getCurrentWeekFriday,
  getWeekDates,
  generateReference,
  formatDate,
} from '../lib/constants'

// ── Entry form row (inside a day) ──
function EntryForm({ entry, onChange, onRemove, index }) {
  const category = CATEGORIES.find((c) => c.value === entry.category)

  return (
    <div className="glass-card-inset rounded-xl p-5 relative group/entry">
      {onRemove && (
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
        <h4 className="signature-gradient-text font-bold text-sm">Entry {index + 1}</h4>
      </div>

      <div className={`grid grid-cols-1 ${category?.showReference ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-4`}>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Category</label>
          <select
            value={entry.category}
            onChange={(e) => onChange(index, 'category', e.target.value)}
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
            style={{ background: 'rgba(28, 37, 62, 0.5)', border: 'none' }}
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
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
            style={{ background: 'rgba(28, 37, 62, 0.5)', border: 'none' }}
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
              className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
              style={{ background: 'rgba(28, 37, 62, 0.5)', border: 'none' }}
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
            className="w-full bg-surface-container-highest/50 border-transparent rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none"
            style={{ background: 'rgba(28, 37, 62, 0.5)', border: 'none' }}
            placeholder="Describe your work..."
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

// ── Collapsible day section ──
function DaySection({ day, entries, onAddEntry, onChangeEntry, onRemoveEntry, disabled }) {
  const [open, setOpen] = useState(true)
  const totalDays = entries.reduce((sum, e) => {
    const tb = TIME_BLOCKS.find((t) => t.value === e.time_block)
    return sum + (tb?.numericValue || 0)
  }, 0)

  return (
    <div className={`glass-card rounded-2xl overflow-hidden ${!open && entries.length === 0 ? 'opacity-80 hover:opacity-100' : ''} transition-opacity`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-6 flex items-center justify-between cursor-pointer group"
      >
        <div className="flex items-baseline gap-4">
          <h3 className="text-xl font-bold font-headline text-white">{day.dayName}</h3>
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
              key={idx}
              entry={entry}
              index={idx}
              onChange={(i, field, value) => onChangeEntry(day.date, i, field, value)}
              onRemove={disabled ? null : (i) => onRemoveEntry(day.date, i)}
            />
          ))}
          {!disabled && (
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
  const { submitEntries, fetchWeekEntries, loading, error } = useEntries()

  const [weekEnding, setWeekEnding] = useState(searchParams.get('week') || getCurrentWeekFriday())
  const [client, setClient] = useState(profile?.default_client || '')
  const [includeWeekend, setIncludeWeekend] = useState(false)
  const [entriesByDate, setEntriesByDate] = useState({})
  const [submitStatus, setSubmitStatus] = useState(null)
  const [existingEntries, setExistingEntries] = useState([])

  const weekDates = getWeekDates(weekEnding)
  const visibleDays = includeWeekend ? weekDates : weekDates.filter((d) => !d.isWeekend)

  useEffect(() => {
    if (user?.id && weekEnding) {
      fetchWeekEntries(user.id, weekEnding).then((data) => {
        setExistingEntries(data)
      })
    }
  }, [user?.id, weekEnding, fetchWeekEntries])

  useEffect(() => {
    setEntriesByDate({})
    setSubmitStatus(null)
  }, [weekEnding])

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
      dayEntries[index] = { ...dayEntries[index], [field]: value }
      return { ...prev, [date]: dayEntries }
    })
  }

  function removeEntry(date, index) {
    setEntriesByDate((prev) => {
      const dayEntries = [...(prev[date] || [])]
      dayEntries.splice(index, 1)
      return { ...prev, [date]: dayEntries }
    })
  }

  function validate() {
    const allEntries = visibleDays.flatMap((day) => {
      return (entriesByDate[day.date] || []).map((e, i) => ({ ...e, day, index: i }))
    })

    if (allEntries.length === 0) return 'Add at least one entry before submitting.'

    for (const entry of allEntries) {
      if (!entry.category) return `${entry.day.dayName}: Select a category for entry ${entry.index + 1}.`
      if (!entry.time_block) return `${entry.day.dayName}: Select a time block for entry ${entry.index + 1}.`

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

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setSubmitStatus({ type: 'error', message: validationError })
      return
    }

    let counter = existingEntries.length + 1
    const rows = []

    for (const day of visibleDays) {
      const dayEntries = entriesByDate[day.date] || []
      for (const entry of dayEntries) {
        const tb = TIME_BLOCKS.find((t) => t.value === entry.time_block)
        rows.push({
          user_id: user.id,
          reference: generateReference(day.date, counter++),
          client: client,
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

    try {
      await submitEntries(rows)
      setSubmitStatus({ type: 'success', message: `${rows.length} entries saved as drafts.` })
      setEntriesByDate({})
      const updated = await fetchWeekEntries(user.id, weekEnding)
      setExistingEntries(updated)
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message })
    }
  }

  const newTotal = visibleDays.reduce((total, day) => {
    return total + (entriesByDate[day.date] || []).reduce((sum, e) => {
      const tb = TIME_BLOCKS.find((t) => t.value === e.time_block)
      return sum + (tb?.numericValue || 0)
    }, 0)
  }, 0)

  const existingTotal = existingEntries.reduce((sum, e) => sum + Number(e.time_value), 0)

  // ── Success state ──
  if (submitStatus?.type === 'success') {
    return (
      <div className="max-w-xl mx-auto text-center pt-16 pb-12">
        <div className="glass-card-accent rounded-2xl p-10 space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="material-symbols-outlined text-green-400" style={{ fontSize: '32px' }}>check_circle</span>
          </div>
          <h2 className="font-headline font-bold text-2xl text-white">Entries saved</h2>
          <p className="text-on-surface-variant">{submitStatus.message}</p>
          <p className="text-sm text-on-surface-variant">
            Your entries are saved as drafts. Review them in{' '}
            <a href="/my-entries" className="text-primary hover:underline">My Entries</a>,
            then submit when ready.
          </p>
          <button
            onClick={() => {
              setSubmitStatus(null)
              setEntriesByDate({})
            }}
            className="btn-gradient"
          >
            Add more entries
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-8 pb-28">
        {/* Page heading */}
        <div>
          <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Time Management</p>
          <h1 className="text-5xl font-black font-headline text-white tracking-tight">Log Time</h1>
          <p className="text-on-surface-variant mt-3">Record your time entries for the current week across projects and categories.</p>
        </div>

        {/* Existing entries info banner */}
        {existingEntries.length > 0 && (
          <div className="glass-card border-primary/20 rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(102,211,255,0.05)' }}>
            <span className="material-symbols-outlined text-primary">info</span>
            <p className="text-primary-fixed font-medium text-sm">
              You already have <strong>{existingEntries.length}</strong> entries for this week
              totalling <strong>{existingTotal} days</strong>.{' '}
              <a href="/my-entries" className="underline hover:no-underline">View them</a>.
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
                className="w-full bg-white/5 border-outline-variant rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-white"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(65,71,91,0.5)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-2">Client</label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full bg-white/5 border-outline-variant rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-white placeholder:text-slate-600"
                style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(65,71,91,0.5)' }}
                placeholder="Select or enter client name"
              />
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
        <div className="space-y-4">
          {visibleDays.map((day) => (
            <DaySection
              key={day.date}
              day={day}
              entries={entriesByDate[day.date] || []}
              onAddEntry={addEntry}
              onChangeEntry={changeEntry}
              onRemoveEntry={removeEntry}
            />
          ))}
        </div>

        {/* Error message */}
        {submitStatus?.type === 'error' && (
          <div className="glass-card border-error/20 rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,113,108,0.05)' }}>
            <span className="material-symbols-outlined text-error">error</span>
            <p className="text-error text-sm font-medium">{submitStatus.message}</p>
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 w-full z-40">
        <div style={{ background: 'rgba(12, 19, 38, 0.85)', backdropFilter: 'blur(24px)', borderTop: '1px solid rgba(0,201,255,0.15)', boxShadow: '0 -4px 30px rgba(0,201,255,0.06)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Current Draft</span>
              <span className="text-on-surface-variant font-medium text-sm">
                New entries: <span className="text-primary font-bold">{newTotal} days</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={loading}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || newTotal === 0 || !client.trim()}
                className="signature-gradient-bg px-8 py-3 rounded-xl font-bold text-white shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save entries'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

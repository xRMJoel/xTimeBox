import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useEntries } from '../hooks/useEntries'
import EntryCard from '../components/EntryCard'
import StatusBadge from '../components/StatusBadge'
import { CATEGORIES, TIME_BLOCKS, formatDate, getMonthLabel, getMonthStart } from '../lib/constants'

// Inline edit modal
function EditModal({ entry, onSave, onCancel, saving }) {
  const [category, setCategory] = useState(entry.category)
  const [timeBlock, setTimeBlock] = useState(entry.time_block)
  const [featureTag, setFeatureTag] = useState(entry.feature_tag || '')
  const [notes, setNotes] = useState(entry.notes || '')

  const cat = CATEGORIES.find((c) => c.value === category)

  function handleSave() {
    const tb = TIME_BLOCKS.find((t) => t.value === timeBlock)
    onSave({
      category,
      time_block: timeBlock,
      time_value: tb?.numericValue || entry.time_value,
      feature_tag: featureTag || null,
      notes: notes || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-headline font-bold text-lg text-white">Edit entry</h3>
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
          <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Time</label>
          <select value={timeBlock} onChange={(e) => setTimeBlock(e.target.value)} className="input-dark">
            {TIME_BLOCKS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
          <button onClick={onCancel} className="text-sm font-medium text-on-surface-variant hover:text-white transition-colors">
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

export default function MyEntriesPage() {
  const { user } = useAuth()
  const { fetchUserEntries, updateEntry, deleteEntry, submitWeek, loading } = useEntries()

  const [entries, setEntries] = useState([])
  const [editingEntry, setEditingEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const loadEntries = useCallback(async () => {
    if (user?.id) {
      const data = await fetchUserEntries(user.id)
      setEntries(data)
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
      <div>
        <p className="text-[10px] font-bold text-outline mb-2 uppercase tracking-[0.2em]">Time Management</p>
        <h1 className="text-5xl font-black font-headline text-white tracking-tight">My Entries</h1>
        <p className="text-on-surface-variant mt-3">Review and manage your time distribution across projects and tasks.</p>
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
        <p className="text-on-surface-variant">Loading entries...</p>
      )}

      {!loading && entries.length === 0 && (
        <div className="glass-card-accent rounded-2xl p-12 text-center">
          <div className="icon-badge-gradient w-16 h-16 mx-auto mb-4" style={{ borderRadius: '16px' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: '32px' }}>schedule</span>
          </div>
          <p className="text-on-surface-variant mb-4">No entries yet. Start by logging some time.</p>
          <a href="/timesheet" className="btn-gradient inline-block text-sm">
            Log time
          </a>
        </div>
      )}

      {sortedWeeks.map((weekEnding) => {
        const weekEntries = weekGroups[weekEnding]
        const totalDays = weekEntries.reduce((sum, e) => sum + Number(e.time_value), 0)
        const hasDrafts = weekEntries.some((e) => e.status === 'draft' || e.status === 'returned')
        const hasReturned = weekEntries.some((e) => e.status === 'returned')
        const allSignedOff = weekEntries.every((e) => e.status === 'signed_off')
        const client = weekEntries[0]?.client

        const dayGroups = weekEntries.reduce((groups, entry) => {
          if (!groups[entry.entry_date]) groups[entry.entry_date] = []
          groups[entry.entry_date].push(entry)
          return groups
        }, {})

        const sortedDays = Object.keys(dayGroups).sort()

        return (
          <div key={weekEnding} className="glass-card rounded-2xl overflow-hidden">
            {/* Week header */}
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,201,255,0.12)', background: 'linear-gradient(135deg, rgba(0,201,255,0.04) 0%, rgba(123,47,219,0.04) 100%)' }}>
              <div>
                <h2 className="font-headline font-bold text-xl text-white">
                  Week ending {formatDate(weekEnding)}
                </h2>
                <p className="text-on-surface-variant text-sm mt-0.5">
                  {client} · {totalDays} days · {weekEntries.length} entries
                </p>
              </div>
              <div className="flex items-center gap-3">
                {allSignedOff && <StatusBadge status="signed_off" />}
                {hasDrafts && !allSignedOff && (
                  <button onClick={() => handleSubmitWeek(weekEnding)} className="btn-gradient text-sm">
                    {hasReturned ? 'Resubmit week' : 'Submit week'}
                  </button>
                )}
              </div>
            </div>

            {hasReturned && (
              <div className="px-6 py-3 flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.05)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>undo</span>
                <p className="text-sm text-amber-400 font-medium">
                  Some entries were returned for editing. Make changes and resubmit the week.
                </p>
              </div>
            )}

            {hasDrafts && !hasReturned && !allSignedOff && (
              <div className="px-6 py-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>edit_note</span>
                <p className="text-sm text-on-surface-variant">
                  These entries are saved as drafts. Submit the week when you're ready for review.
                </p>
              </div>
            )}

            {/* Day groups */}
            <div className="divide-y divide-white/5">
              {sortedDays.map((date) => (
                <div key={date} className="px-6 py-4">
                  <div className="font-headline font-bold text-white mb-2">
                    {dayGroups[date][0].day_name}, <span className="text-outline">{formatDate(date)}</span>
                  </div>
                  <div className="space-y-2">
                    {dayGroups[date].map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        onEdit={setEditingEntry}
                        onDelete={handleDelete}
                        readonly={entry.status === 'signed_off'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

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

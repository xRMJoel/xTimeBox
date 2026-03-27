import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentWeekFriday, getWeekDates, getWorkingDaysInMonth, CATEGORIES, generateReference, formatDate, isValidHourIncrement, hoursToDaysRaw, daysToTimeBlock } from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

export default function HomePage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ weekDays: 0, monthDays: 0, missingCount: 0, draftCount: 0, submittedCount: 0, signedOffCount: 0, workingDays: 0 })
  const [weekEntries, setWeekEntries] = useState([])
  const [nonWorkingDays, setNonWorkingDays] = useState(new Map())
  const [initialLoad, setInitialLoad] = useState(true)
  const fetchIdRef = useRef(0)
  const [modalDay, setModalDay] = useState(null) // lifted from WeekAtAGlance for correct fixed positioning

  // Fetch on mount and when user changes
  useEffect(() => {
    if (!user) return
    fetchDashboardData()
  }, [user])

  // Re-fetch when tab becomes visible again or window regains focus
  useEffect(() => {
    if (!user) return

    function handleVisible() {
      if (document.visibilityState === 'visible') {
        fetchDashboardData()
      }
    }
    function handleFocus() {
      fetchDashboardData()
    }

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])

  async function fetchDashboardData() {
    // Each fetch gets an ID — if a newer fetch starts, older ones won't overwrite state
    const id = ++fetchIdRef.current

    // Only show loading spinner on the very first load, not on background refreshes
    // This prevents the "stuck loading" appearance
    try {
      const [statsResult, weekResult, nwdResult] = await Promise.allSettled([
        fetchStats(),
        fetchWeekEntries(),
        fetchNonWorkingDays(),
      ])

      // Only apply results if this is still the latest fetch
      if (id !== fetchIdRef.current) return

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (weekResult.status === 'fulfilled') setWeekEntries(weekResult.value)
      if (nwdResult.status === 'fulfilled') setNonWorkingDays(nwdResult.value)
    } catch (err) {
      console.error('Dashboard data error:', err)
    } finally {
      if (id === fetchIdRef.current) setInitialLoad(false)
    }
  }

  async function fetchStats() {
    const now = new Date()
    const weekEnding = getCurrentWeekFriday()

    const year = now.getFullYear()
    const month = now.getMonth()
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const nextMonthStart = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`
    const today = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Fetch all month entries + non-working days in parallel
    const [weekResult, monthResult, nwdResult] = await Promise.all([
      supabase.from('timesheet_entries').select('time_value').eq('user_id', user.id).eq('week_ending', weekEnding),
      supabase.from('timesheet_entries').select('time_value, entry_date, status').eq('user_id', user.id).gte('entry_date', monthStart).lt('entry_date', nextMonthStart),
      supabase.from('non_working_days').select('entry_date').eq('user_id', user.id).gte('entry_date', monthStart).lt('entry_date', nextMonthStart),
    ])

    const weekEntries = weekResult.data || []
    const monthEntries = monthResult.data || []
    const nwdDates = new Set((nwdResult.data || []).map((r) => r.entry_date))

    const weekDays = Math.round(weekEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100
    const monthDays = Math.round(monthEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100

    // Working days = weekdays in month minus non-working days
    const allWorkingDays = getWorkingDaysInMonth(now.getFullYear(), now.getMonth())
    const workingDays = allWorkingDays.filter((d) => !nwdDates.has(d)).length

    // Dates with at least one entry
    const datesWithEntries = new Set(monthEntries.map((e) => e.entry_date))

    // Missing = working days before today with no entries (exclude non-working days)
    const missingCount = allWorkingDays.filter((d) => d < today && !nwdDates.has(d) && !datesWithEntries.has(d)).length

    // Status counts for entries this month
    const draftCount = monthEntries.filter((e) => e.status === 'draft').length
    const submittedCount = monthEntries.filter((e) => e.status === 'submitted').length
    const signedOffCount = monthEntries.filter((e) => e.status === 'signed_off').length

    return {
      weekDays: Math.round(weekDays * 100) / 100,
      monthDays: Math.round(monthDays * 100) / 100,
      missingCount,
      draftCount,
      submittedCount,
      signedOffCount,
      workingDays,
    }
  }

  async function fetchWeekEntries() {
    const weekEnding = getCurrentWeekFriday()
    const { data } = await supabase
      .from('timesheet_entries')
      .select('id, entry_date, day_name, time_value, time_hours, status, category, time_block, project_id, feature_tag, notes, projects(name)')
      .eq('user_id', user.id)
      .eq('week_ending', weekEnding)
      .order('entry_date', { ascending: true })

    return data || []
  }

  async function fetchNonWorkingDays() {
    const weekEnding = getCurrentWeekFriday()
    const dates = getWeekDates(weekEnding)
    const { data } = await supabase
      .from('non_working_days')
      .select('entry_date, reason')
      .eq('user_id', user.id)
      .gte('entry_date', dates[0].date)
      .lte('entry_date', dates[dates.length - 1].date)

    return new Map((data || []).map((r) => [r.entry_date, r.reason || 'Non-working day']))
  }

  async function toggleNonWorkingDay(date) {
    if (!user?.id) return
    const isNwd = nonWorkingDays.has(date)
    if (isNwd) {
      await supabase.from('non_working_days').delete().eq('user_id', user.id).eq('entry_date', date)
      setNonWorkingDays((prev) => { const next = new Map(prev); next.delete(date); return next })
    } else {
      await supabase.from('non_working_days').insert({ user_id: user.id, entry_date: date })
      setNonWorkingDays((prev) => new Map(prev).set(date, 'Non-working day'))
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const now = new Date()
  const day = now.getDay()
  const diffToFri = day <= 5 ? 5 - day : 5 - day + 7
  const friday = new Date(now)
  friday.setDate(now.getDate() + diffToFri)
  const weekEndingLabel = friday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Computed values for the modal (needs access to weekEntries)
  const currentWeekEnding = getCurrentWeekFriday()
  const entriesByDate = {}
  for (const entry of weekEntries) {
    if (!entriesByDate[entry.entry_date]) entriesByDate[entry.entry_date] = []
    entriesByDate[entry.entry_date].push(entry)
  }

  return (
    <div className="relative space-y-10">
      {/* Decorative floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-12 left-[28%] w-1.5 h-1.5 rounded-full bg-cyan-500/20" />
        <div className="absolute top-36 right-[18%] w-1 h-1 rounded-full bg-purple-500/30" />
        <div className="absolute bottom-40 left-[12%] w-1 h-1 rounded-full bg-cyan-400/15" />
        <div className="absolute top-64 left-[55%] w-1.5 h-1.5 rounded-full bg-purple-400/20" />
        <div className="absolute bottom-24 right-[30%] w-1 h-1 rounded-full bg-cyan-300/20" />
      </div>

      {/* ── Hero: greeting left, stats right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center pt-4">
        {/* Left - greeting */}
        <div className="space-y-4">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold tracking-wide"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
              color: '#4ade80',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ONLINE
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl font-black leading-tight">
            <span className="text-on-surface">{greeting}, </span>
            <span
              style={{
                background: 'linear-gradient(135deg, #00C9FF 0%, #7B2FDB 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {firstName}.
            </span>
          </h1>
          <p className="text-on-surface-variant text-base sm:text-lg max-w-md">
            Here's your timesheet overview for this week.
          </p>
        </div>

        {/* Right - stats 3x2 grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatsCard
            label="This week"
            value={initialLoad ? '...' : stats.weekDays}
            unit="days"
            subtitle={`w/e ${weekEndingLabel}`}
            colour="cyan"
          />
          <StatsCard
            label="This month"
            value={initialLoad ? '...' : stats.monthDays}
            unit="days"
            subtitle={monthName}
            colour="purple"
          />
          <StatsCard
            label="Missing"
            value={initialLoad ? '...' : stats.missingCount}
            unit="days"
            subtitle="No entries logged"
            colour={stats.missingCount > 0 ? 'red' : 'green'}
          />
          <StatsCard
            label="Draft"
            value={initialLoad ? '...' : stats.draftCount}
            unit="entries"
            subtitle="Not yet submitted"
            colour="yellow"
          />
          <StatsCard
            label="Submitted"
            value={initialLoad ? '...' : stats.submittedCount}
            unit="entries"
            subtitle="Awaiting sign-off"
            colour="cyan"
          />
          <StatsCard
            label="Signed off"
            value={initialLoad ? '...' : stats.signedOffCount}
            unit="entries"
            subtitle="Approved"
            colour="green"
          />
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          to="/timesheet"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
          title="New Entry"
          description="Log time against a client"
          variant="primary"
        />
        <QuickAction
          to="/my-entries"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
          title="My Entries"
          description="View and manage submissions"
          variant="ghost"
        />
        <QuickAction
          to="/profile"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
          title="My Profile"
          description="Update your details and photo"
          variant="ghost"
        />
      </div>

      {/* ── Week at a glance ── */}
      <WeekAtAGlance
        weekEntries={weekEntries}
        initialLoad={initialLoad}
        weekEndingLabel={weekEndingLabel}
        onOpenDay={setModalDay}
        nonWorkingDays={nonWorkingDays}
      />

      {/* Quick entry modal — rendered at root level so fixed positioning works */}
      {modalDay && (
        <QuickEntryModal
          day={modalDay}
          weekEnding={currentWeekEnding}
          existingEntries={entriesByDate[modalDay.date] || []}
          user={user}
          onClose={() => setModalDay(null)}
          onSaved={() => { setModalDay(null); fetchDashboardData() }}
          isNonWorking={nonWorkingDays.has(modalDay.date)}
          onToggleNonWorking={() => toggleNonWorkingDay(modalDay.date)}
        />
      )}
    </div>
  )
}

/* ── Sub-components ── */

function StatsCard({ label, value, unit, subtitle, colour }) {
  const colours = {
    cyan:   { bg: 'rgba(0,201,255,0.06)',   border: 'rgba(0,201,255,0.15)',   text: 'text-primary' },
    purple: { bg: 'rgba(182,133,255,0.06)', border: 'rgba(182,133,255,0.15)', text: 'text-secondary' },
    yellow: { bg: 'rgba(250,204,21,0.06)',  border: 'rgba(250,204,21,0.15)',  text: 'text-yellow-400' },
    green:  { bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.15)',   text: 'text-green-400' },
    red:    { bg: 'rgba(255,113,108,0.06)', border: 'rgba(255,113,108,0.15)', text: 'text-error' },
  }
  const c = colours[colour] || colours.cyan

  return (
    <div
      className="glass-card rounded-xl p-5"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-outline mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-heading font-black ${c.text}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </span>
        <span className="text-sm text-on-surface-variant">{unit}</span>
      </div>
      <p className="text-xs text-on-surface-variant/60 mt-1.5">{subtitle}</p>
    </div>
  )
}

function WeekAtAGlance({ weekEntries, initialLoad, weekEndingLabel, onOpenDay, nonWorkingDays }) {
  const weekEnding = getCurrentWeekFriday()
  const weekDays = getWeekDates(weekEnding).filter((d) => !d.isWeekend) // Mon-Fri only

  // Group entries by date
  const byDate = {}
  for (const entry of weekEntries) {
    if (!byDate[entry.entry_date]) byDate[entry.entry_date] = []
    byDate[entry.entry_date].push(entry)
  }

  const today = new Date().toISOString().slice(0, 10)

  // Overall week status
  const totalLogged = Math.round(weekEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100
  const daysWithEntries = weekDays.filter((d) => (byDate[d.date] || []).length > 0).length
  const allSubmitted = weekEntries.length > 0 && weekEntries.every((e) => e.status === 'submitted' || e.status === 'signed_off')
  const hasReturned = weekEntries.some((e) => e.status === 'returned')

  const statusLabel = weekEntries.length === 0
    ? 'No entries'
    : hasReturned
    ? 'Returned'
    : allSubmitted
    ? 'Submitted'
    : 'In progress'

  const statusColour = weekEntries.length === 0
    ? 'text-on-surface-variant'
    : hasReturned
    ? 'text-amber-400'
    : allSubmitted
    ? 'text-green-400'
    : 'text-primary'

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-heading font-bold text-base text-on-surface">This week at a glance</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">w/e {weekEndingLabel}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${statusColour}`}>{statusLabel}</p>
          <p className="text-xs text-on-surface-variant">{totalLogged}d across {daysWithEntries} days</p>
        </div>
      </div>

      {initialLoad ? (
        <LoadingSpinner message="Loading week..." />
      ) : (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const dayEntries = byDate[day.date] || []
            const dayTotal = Math.round(dayEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0) * 100) / 100
            const isToday = day.date === today
            const isPast = day.date < today
            const hasEntries = dayEntries.length > 0
            const isNwd = nonWorkingDays.has(day.date)
            const dayHasReturned = dayEntries.some((e) => e.status === 'returned')
            const dayAllSubmitted = hasEntries && dayEntries.every((e) => e.status === 'submitted' || e.status === 'signed_off')

            // Status dot colour
            const dotColour = isNwd
              ? 'bg-purple-400'
              : !hasEntries
              ? (isPast ? 'bg-red-400/60' : 'bg-white/10')
              : dayHasReturned
              ? 'bg-amber-400'
              : dayAllSubmitted
              ? 'bg-green-400'
              : 'bg-primary'

            // Group entries by project for display
            const projectTotals = {}
            for (const e of dayEntries) {
              const name = e.projects?.name || 'Unassigned'
              projectTotals[name] = Math.round(((projectTotals[name] || 0) + Number(e.time_value || 0)) * 100) / 100
            }
            const projectList = Object.entries(projectTotals) // [[name, total], ...]

            return (
              <div
                key={day.date}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isToday ? 'ring-1 ring-primary/30' : ''
                }`}
                style={{
                  background: isNwd
                    ? 'rgba(182,133,255,0.05)'
                    : isToday
                    ? 'rgba(0,201,255,0.05)'
                    : hasEntries
                    ? 'var(--glass-bg)'
                    : 'transparent',
                }}
              >
                {/* Day label */}
                <div className="w-10 flex-shrink-0">
                  <p className={`text-sm font-bold ${isNwd ? 'text-purple-400' : isToday ? 'text-primary' : 'text-on-surface'}`}>
                    {day.dayName.slice(0, 3)}
                  </p>
                </div>

                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColour}`} />

                {/* Project breakdown or gap message */}
                <div className="flex-1 min-w-0">
                  {isNwd ? (
                    <p className="text-sm text-purple-400/70 italic">{nonWorkingDays.get(day.date) || 'Non-working day'}</p>
                  ) : hasEntries ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {projectList.map(([name, total]) => (
                        <span key={name} className="text-sm text-on-surface-variant">
                          <span className="text-on-surface font-medium">{name}</span>
                          <span className="text-on-surface-variant/60 ml-1 tabular-nums">{total}d</span>
                        </span>
                      ))}
                    </div>
                  ) : isPast ? (
                    <p className="text-sm text-red-400/60 italic">No time logged</p>
                  ) : (
                    <p className="text-sm text-on-surface-variant/40">--</p>
                  )}
                </div>

                {/* Day total */}
                <div className="flex-shrink-0 text-right w-12">
                  {hasEntries && !isNwd && (
                    <span className="text-sm font-bold text-on-surface tabular-nums">{dayTotal}d</span>
                  )}
                </div>

                {/* Open day modal */}
                <button
                  onClick={() => onOpenDay(day)}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
                  title={hasEntries ? `Edit ${day.dayName}` : `Add entry for ${day.dayName}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {hasEntries ? 'edit' : 'add_circle'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer action */}
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
        <Link
          to={`/timesheet?week=${weekEnding}`}
          className="flex items-center justify-center gap-2 text-sm font-bold text-primary hover:text-primary-dim transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_calendar</span>
          Edit this week
        </Link>
      </div>

    </div>
  )
}

// ── Quick entry modal ──
function QuickEntryModal({ day, weekEnding, existingEntries, user, onClose, onSaved, isNonWorking, onToggleNonWorking }) {
  const [userProjects, setUserProjects] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Track which entry is being edited (null = adding new)
  const [editingId, setEditingId] = useState(null)

  // Form state — used for both new entries and editing existing ones
  const emptyForm = { project_id: '', category: '', time_hours: '', feature_tag: '', notes: '' }
  const [form, setForm] = useState(emptyForm)

  // Load user's assigned projects
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_projects')
      .select('project_id, hours_per_day, projects(id, name, client, status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const active = (data || []).map((up) => ({
          ...up.projects,
          hours_per_day: up.hours_per_day ? Number(up.hours_per_day) : null,
        })).filter((p) => p && p.status === 'active')
        setUserProjects(active)
        // Default to only project if there's exactly one and we're not editing
        if (active.length === 1 && !editingId) {
          setForm((prev) => prev.project_id ? prev : { ...prev, project_id: active[0].id })
        }
      })
  }, [user?.id])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setSuccess(false)
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setForm({
      project_id: entry.project_id || '',
      category: entry.category || '',
      time_hours: entry.time_hours || '',
      feature_tag: entry.feature_tag || '',
      notes: entry.notes || '',
    })
    setError(null)
    setSuccess(false)
  }

  function cancelEdit() {
    setEditingId(null)
    const defaultProject = userProjects.length === 1 ? userProjects[0].id : ''
    setForm({ ...emptyForm, project_id: defaultProject })
    setError(null)
    setSuccess(false)
  }

  async function handleDelete() {
    if (!editingId) return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('timesheet_entries').delete().eq('id', editingId)
      if (err) throw err
      cancelEdit()
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const category = CATEGORIES.find((c) => c.value === form.category)
  const entryProject = userProjects.find((p) => p.id === form.project_id)
  const hoursPerDay = entryProject?.hours_per_day
  const hrs = Number(form.time_hours) || 0
  const canSave = form.project_id && form.category && form.time_hours && isValidHourIncrement(hrs)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    // Validation
    if (!isValidHourIncrement(hrs)) {
      setError('Hours must be in 0.25 increments (e.g. 0.5, 1, 1.5, 7.5).')
      setSaving(false)
      return
    }

    if (category?.showReference && !form.feature_tag.trim()) {
      setError(`Reference is required for ${form.category}.`)
      setSaving(false)
      return
    }

    const rawDays = hoursPerDay ? hoursToDaysRaw(hrs, hoursPerDay) : hrs
    const blockLabel = daysToTimeBlock(rawDays)

    try {
      if (editingId) {
        // Update existing entry
        const updates = {
          project_id: form.project_id,
          client: entryProject?.client || '',
          category: form.category,
          time_hours: hrs,
          time_block: blockLabel,
          time_value: rawDays,
          feature_tag: form.feature_tag || null,
          notes: form.notes || null,
        }

        const { error: updateErr } = await supabase
          .from('timesheet_entries')
          .update(updates)
          .eq('id', editingId)

        if (updateErr) throw updateErr
      } else {
        // Insert new entry
        const existingCount = existingEntries.length
        const row = {
          user_id: user.id,
          reference: generateReference(day.date, existingCount + 1),
          client: entryProject?.client || '',
          project_id: form.project_id,
          week_ending: weekEnding,
          day_name: day.dayName,
          entry_date: day.date,
          category: form.category,
          time_hours: hrs,
          time_block: blockLabel,
          time_value: rawDays,
          feature_tag: form.feature_tag || null,
          notes: form.notes || null,
          status: 'draft',
        }

        const { error: insertErr } = await supabase.from('timesheet_entries').insert(row)
        if (insertErr) throw insertErr
      }

      setSuccess(true)
      // Brief delay so user sees the success state, then close and refresh
      setTimeout(() => onSaved(), 600)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const statusBadgeClass = (status) => {
    if (status === 'submitted') return 'text-primary bg-primary/10 border-primary/20'
    if (status === 'signed_off') return 'text-green-400 bg-green-400/10 border-green-400/20'
    if (status === 'returned') return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    return 'text-on-surface-variant bg-white/5 border-white/10'
  }

  // Only draft and returned entries can be edited
  const isEditable = (status) => status === 'draft' || status === 'returned'

  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'var(--modal-overlay)' }} onClick={onClose}>
      <div className="glass-card rounded-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--color-surface-container)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline font-bold text-xl text-on-surface">{day.dayName}</h3>
            <p className="text-sm text-on-surface-variant">{formatDate(day.date)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Non-working day toggle */}
        <button
          onClick={() => { onToggleNonWorking(); if (!isNonWorking) onClose() }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isNonWorking ? 'ring-1 ring-purple-400/30' : 'hover:bg-purple-400/5'
          }`}
          style={{
            background: isNonWorking ? 'rgba(182,133,255,0.08)' : 'var(--glass-bg)',
            border: `1px solid ${isNonWorking ? 'rgba(182,133,255,0.25)' : 'var(--glass-border-subtle)'}`,
          }}
        >
          <span className={`material-symbols-outlined ${isNonWorking ? 'text-purple-400' : 'text-on-surface-variant'}`} style={{ fontSize: '20px' }}>event_busy</span>
          <span className={`text-sm font-medium ${isNonWorking ? 'text-purple-400' : 'text-on-surface-variant'}`}>
            {isNonWorking ? 'Marked as non-working day (click to remove)' : 'Mark as non-working day'}
          </span>
        </button>

        {/* Existing entries */}
        {!isNonWorking && existingEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-2">
              Existing entries ({existingEntries.length})
            </p>
            <div className="space-y-2">
              {existingEntries.map((entry) => (
                <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${editingId === entry.id ? 'ring-1 ring-primary/40' : ''}`} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface">{entry.projects?.name || 'No project'}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${statusBadgeClass(entry.status)}`}>
                        {entry.status === 'signed_off' ? 'Signed off' : entry.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">{entry.category} - {entry.time_hours ? `${entry.time_hours}hrs` : entry.time_block}</p>
                  </div>
                  <span className="text-sm font-bold text-on-surface tabular-nums">{Number(entry.time_value)}d</span>
                  {isEditable(entry.status) && (
                    <button
                      onClick={() => editingId === entry.id ? cancelEdit() : startEdit(entry)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        editingId === entry.id
                          ? 'text-primary bg-primary/10'
                          : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'
                      }`}
                      title={editingId === entry.id ? 'Cancel editing' : 'Edit entry'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {editingId === entry.id ? 'close' : 'edit'}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entry form — hidden when non-working */}
        {!isNonWorking && <>
        <div style={{ borderTop: '1px solid var(--glass-border-subtle)' }} />

        {/* Entry form — for new or editing existing */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-3">
            {editingId ? 'Edit entry' : 'Add new entry'}
          </p>

          <div className="space-y-3">
            {/* Project */}
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Project</label>
              {userProjects.length > 0 ? (
                <select
                  value={form.project_id}
                  onChange={(e) => updateField('project_id', e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                  style={{ background: 'var(--color-surface-variant)', border: 'none' }}
                >
                  <option value="">Select project</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.client})</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-on-surface-variant italic py-1">No projects assigned.</p>
              )}
            </div>

            {/* Category + Time Block */}
            <div className={`grid grid-cols-1 ${category?.showReference ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                  style={{ background: 'var(--color-surface-variant)', border: 'none' }}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Hours</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.25"
                    step="0.25"
                    value={form.time_hours}
                    onChange={(e) => updateField('time_hours', e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 7.5"
                    className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                    style={{ background: 'var(--color-surface-variant)', border: 'none' }}
                  />
                  {form.time_hours && hoursPerDay ? (
                    <span className="text-xs text-on-surface-variant whitespace-nowrap font-medium" title={`${form.time_hours}hrs / ${hoursPerDay}hrs per day`}>
                      {hoursToDaysRaw(Number(form.time_hours), hoursPerDay).toFixed(2)}d
                    </span>
                  ) : null}
                </div>
                {form.time_hours && !isValidHourIncrement(Number(form.time_hours)) && (
                  <p className="text-[10px] text-error mt-1">Must be in 0.25 increments</p>
                )}
              </div>
              {category?.showReference && (
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Reference</label>
                  <input
                    type="text"
                    value={form.feature_tag}
                    onChange={(e) => updateField('feature_tag', e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                    style={{ background: 'var(--color-surface-variant)', border: 'none' }}
                    placeholder={category.referencePlaceholder}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            {form.category && (
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-outline mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none"
                  style={{ background: 'var(--color-surface-variant)', border: 'none' }}
                  placeholder="Describe your work..."
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        {/* Error / success */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(255,113,108,0.06)', color: '#ff716c' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(74,222,128,0.06)', color: '#4ade80' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            {editingId ? 'Entry updated!' : 'Entry saved!'}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-1">
          {editingId && (
            <button onClick={handleDelete} disabled={saving}
              className="text-sm font-medium text-error hover:text-error-dim transition-colors flex items-center gap-1 mr-auto disabled:opacity-50">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
              Delete
            </button>
          )}
          {editingId ? (
            <button onClick={cancelEdit} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Back to new</button>
          ) : (
            <button onClick={onClose} className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Cancel</button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving || success}
            className="signature-gradient-bg text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none flex items-center gap-2"
          >
            {saving ? 'Saving...' : success ? 'Saved!' : editingId ? 'Update entry' : 'Save entry'}
          </button>
        </div>
        </>}
      </div>
    </div>
  )
}

function QuickAction({ to, icon, title, description, variant = 'ghost' }) {
  const isPrimary = variant === 'primary'

  return (
    <Link
      to={to}
      className="group relative flex items-center gap-4 p-6 rounded-xl transition-all duration-200 hover:scale-[1.02]"
      style={
        isPrimary
          ? {
              background: 'linear-gradient(135deg, rgba(0,201,255,0.12) 0%, rgba(123,47,219,0.12) 100%)',
              border: '1px solid rgba(0,201,255,0.25)',
              boxShadow: '0 4px 24px rgba(0,201,255,0.1)',
            }
          : {
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(20px)',
            }
      }
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors text-white"
        style={{
          background: isPrimary
            ? 'linear-gradient(135deg, #00C9FF 0%, #7B2FDB 100%)'
            : 'linear-gradient(135deg, rgba(0,201,255,0.5) 0%, rgba(123,47,219,0.5) 100%)',
        }}
      >
        {icon}
      </div>
      <div>
        <p className="text-base font-heading font-black transition-colors text-on-surface">
          {title}
        </p>
        <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
      </div>
    </Link>
  )
}

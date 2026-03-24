import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentWeekFriday, getWeekDates } from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

export default function HomePage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ weekHours: 0, monthHours: 0, draftCount: 0, submittedCount: 0 })
  const [weekEntries, setWeekEntries] = useState([])
  const [initialLoad, setInitialLoad] = useState(true)
  const fetchIdRef = useRef(0)

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
      const [statsResult, weekResult] = await Promise.allSettled([
        fetchStats(),
        fetchWeekEntries(),
      ])

      // Only apply results if this is still the latest fetch
      if (id !== fetchIdRef.current) return

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (weekResult.status === 'fulfilled') setWeekEntries(weekResult.value)
    } catch (err) {
      console.error('Dashboard data error:', err)
    } finally {
      if (id === fetchIdRef.current) setInitialLoad(false)
    }
  }

  async function fetchStats() {
    const now = new Date()
    const day = now.getDay()
    const diffToFri = day <= 5 ? 5 - day : 5 - day + 7
    const friday = new Date(now)
    friday.setDate(now.getDate() + diffToFri)
    const weekEnding = friday.toISOString().split('T')[0]

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: weekData } = await supabase
      .from('timesheet_entries')
      .select('time_value')
      .eq('user_id', user.id)
      .eq('week_ending', weekEnding)

    const weekHours = (weekData || []).reduce((sum, e) => sum + Number(e.time_value || 0), 0)

    const { data: monthData } = await supabase
      .from('timesheet_entries')
      .select('time_value')
      .eq('user_id', user.id)
      .gte('entry_date', monthStart)
      .lte('entry_date', monthEnd)

    const monthHours = (monthData || []).reduce((sum, e) => sum + Number(e.time_value || 0), 0)

    const { count: draftCount } = await supabase
      .from('timesheet_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'draft')

    const { count: submittedCount } = await supabase
      .from('timesheet_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'submitted')

    return {
      weekHours: Math.round(weekHours * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
      draftCount: draftCount || 0,
      submittedCount: submittedCount || 0,
    }
  }

  async function fetchWeekEntries() {
    const weekEnding = getCurrentWeekFriday()
    const { data } = await supabase
      .from('timesheet_entries')
      .select('id, entry_date, day_name, time_value, status, project_id, projects(name)')
      .eq('user_id', user.id)
      .eq('week_ending', weekEnding)
      .order('entry_date', { ascending: true })

    return data || []
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

        {/* Right - stats 2x2 grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatsCard
            label="This week"
            value={initialLoad ? '...' : stats.weekHours}
            unit="days"
            subtitle={`w/e ${weekEndingLabel}`}
            colour="cyan"
          />
          <StatsCard
            label="This month"
            value={initialLoad ? '...' : stats.monthHours}
            unit="days"
            subtitle={monthName}
            colour="purple"
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
      />
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

function WeekAtAGlance({ weekEntries, initialLoad, weekEndingLabel }) {
  const navigate = useNavigate()
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
  const totalLogged = weekEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0)
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
            const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.time_value || 0), 0)
            const isToday = day.date === today
            const isPast = day.date < today
            const hasEntries = dayEntries.length > 0
            const dayHasReturned = dayEntries.some((e) => e.status === 'returned')
            const dayAllSubmitted = hasEntries && dayEntries.every((e) => e.status === 'submitted' || e.status === 'signed_off')

            // Status dot colour
            const dotColour = !hasEntries
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
              projectTotals[name] = (projectTotals[name] || 0) + Number(e.time_value || 0)
            }
            const projectList = Object.entries(projectTotals) // [[name, total], ...]

            return (
              <div
                key={day.date}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isToday ? 'ring-1 ring-primary/30' : ''
                }`}
                style={{
                  background: isToday
                    ? 'rgba(0,201,255,0.05)'
                    : hasEntries
                    ? 'var(--glass-bg)'
                    : 'transparent',
                }}
              >
                {/* Day label */}
                <div className="w-10 flex-shrink-0">
                  <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-on-surface'}`}>
                    {day.dayName.slice(0, 3)}
                  </p>
                </div>

                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColour}`} />

                {/* Project breakdown or gap message */}
                <div className="flex-1 min-w-0">
                  {hasEntries ? (
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
                  {hasEntries && (
                    <span className="text-sm font-bold text-on-surface tabular-nums">{dayTotal}d</span>
                  )}
                </div>

                {/* Add / edit day action */}
                <button
                  onClick={() => navigate(`/timesheet?week=${weekEnding}&day=${day.date}`)}
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

import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ weekHours: 0, monthHours: 0, draftCount: 0, submittedCount: 0 })
  const [recentEntries, setRecentEntries] = useState([])
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
      const [statsResult, entriesResult] = await Promise.allSettled([
        fetchStats(),
        fetchRecentEntries(),
      ])

      // Only apply results if this is still the latest fetch
      if (id !== fetchIdRef.current) return

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (entriesResult.status === 'fulfilled') setRecentEntries(entriesResult.value)
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

  async function fetchRecentEntries() {
    const { data } = await supabase
      .from('timesheet_entries')
      .select('id, entry_date, day_name, client, category, time_value, status, notes')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(8)

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

  const statusBadge = (status) => {
    const styles = {
      draft: { bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.25)', text: 'text-yellow-400' },
      submitted: { bg: 'rgba(0,201,255,0.1)', border: 'rgba(0,201,255,0.25)', text: 'text-cyan-400' },
      signed_off: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)', text: 'text-green-400' },
    }
    const s = styles[status] || styles.draft
    return (
      <span
        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${s.text}`}
        style={{ background: s.bg, border: `1px solid ${s.border}` }}
      >
        {status?.replace('_', ' ')}
      </span>
    )
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
            <span className="text-white">{greeting}, </span>
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

      {/* ── Recent entries ── */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-black text-xl text-white">Recent entries</h2>
          <Link
            to="/my-entries"
            className="text-sm text-primary hover:text-primary-dim transition-colors font-medium"
          >
            View all
          </Link>
        </div>

        {initialLoad ? (
          <p className="text-sm text-on-surface-variant py-6 text-center">Loading...</p>
        ) : recentEntries.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,201,255,0.08)', border: '1px solid rgba(0,201,255,0.15)' }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#66d3ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="font-heading font-black text-white text-lg mb-1">No entries detected</p>
              <p className="text-base text-on-surface-variant max-w-xs mx-auto">
                Start your first session to begin tracking your time.
              </p>
            </div>
            <Link
              to="/timesheet"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white transition-all duration-200 hover:scale-[1.03] mt-1"
              style={{
                background: 'linear-gradient(135deg, #00C9FF 0%, #7B2FDB 100%)',
                boxShadow: '0 4px 16px rgba(0,201,255,0.25)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Log your first entry
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="w-16 flex-shrink-0">
                  <p className="text-sm text-on-surface-variant font-medium">
                    {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-outline">{entry.day_name}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base text-on-surface truncate">
                    {entry.client}
                    {entry.category ? <span className="text-on-surface-variant"> · {entry.category}</span> : null}
                  </p>
                  {entry.notes && (
                    <p className="text-sm text-on-surface-variant/70 truncate mt-0.5">{entry.notes}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-4">
                  <span className="text-base font-semibold text-white">{entry.time_value}d</span>
                  {statusBadge(entry.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
              background: 'rgba(17, 25, 46, 0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }
      }
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          isPrimary
            ? 'text-white'
            : 'text-on-surface-variant group-hover:text-white'
        }`}
        style={
          isPrimary
            ? { background: 'linear-gradient(135deg, #00C9FF 0%, #7B2FDB 100%)' }
            : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }
        }
      >
        {icon}
      </div>
      <div>
        <p className={`text-base font-heading font-black transition-colors ${
          isPrimary
            ? 'text-white'
            : 'text-on-surface group-hover:text-white'
        }`}>
          {title}
        </p>
        <p className="text-sm text-on-surface-variant mt-0.5">{description}</p>
      </div>
    </Link>
  )
}

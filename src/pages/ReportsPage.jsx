import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getCurrentWeekFriday, getWeekDates, CATEGORIES, formatDate } from '../lib/constants'
import LoadingSpinner from '../components/LoadingSpinner'

// ────────────────────────────────────────────────────────
// Main page — card grid landing or active report view
// ────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user, profile, isManager } = useAuth()
  const [activeReport, setActiveReport] = useState(null) // null = grid view

  // Report definitions
  const reportCards = useMemo(() => {
    const personal = [
      { id: 'my-time-summary', title: 'My Time Summary', description: 'Totals by week or month, broken down by project, client, or category.', icon: 'bar_chart', colour: 'cyan' },
      { id: 'my-submission-tracker', title: 'My Submission Tracker', description: 'Which weeks are complete, have gaps, or are still in draft.', icon: 'checklist', colour: 'purple' },
    ]
    const team = isManager ? [
      { id: 'team-submission-status', title: 'Team Submission Status', description: 'Who has submitted, who is in draft, who hasn\'t started.', icon: 'group', colour: 'cyan' },
      { id: 'returned-entries', title: 'Returned Entries', description: 'Entries sent back, with reasons and patterns.', icon: 'assignment_return', colour: 'amber' },
    ] : []
    const projects = isManager ? [
      { id: 'project-time-report', title: 'Project Time Report', description: 'Time per project by user and category over a date range.', icon: 'work', colour: 'cyan' },
      { id: 'client-summary', title: 'Client Summary', description: 'Time rolled up to client level across all projects.', icon: 'business', colour: 'purple' },
      { id: 'cumulative-time', title: 'Cumulative Time Chart', description: 'Running total of time logged per project over time.', icon: 'show_chart', colour: 'green' },
      { id: 'category-breakdown', title: 'Category Breakdown', description: 'How time splits across categories per project.', icon: 'donut_large', colour: 'amber' },
    ] : []
    return { personal, team, projects }
  }, [isManager])

  // Render the active report or the card grid
  if (activeReport) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setActiveReport(null)}
          className="flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Reports
        </button>
        <ReportView reportId={activeReport} user={user} isManager={isManager} />
      </div>
    )
  }

  return (
    <div className="relative space-y-10">
      {/* Decorative particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-12 left-[20%] w-1.5 h-1.5 rounded-full bg-cyan-500/20" />
        <div className="absolute top-36 right-[15%] w-1 h-1 rounded-full bg-purple-500/30" />
        <div className="absolute bottom-24 left-[60%] w-1 h-1 rounded-full bg-cyan-400/15" />
      </div>

      {/* Page header */}
      <div className="space-y-2 pt-4">
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-on-surface">Reports & Analytics</h1>
        <p className="text-on-surface-variant text-base max-w-lg">Insights into time tracking, submissions, and project performance.</p>
      </div>

      {/* My Reports section */}
      <ReportSection title="My Reports" cards={reportCards.personal} onSelect={setActiveReport} />

      {/* Team section (manager only) */}
      {reportCards.team.length > 0 && (
        <ReportSection title="Team" cards={reportCards.team} onSelect={setActiveReport} />
      )}

      {/* Projects section (manager only) */}
      {reportCards.projects.length > 0 && (
        <ReportSection title="Projects & Clients" cards={reportCards.projects} onSelect={setActiveReport} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Card grid section
// ────────────────────────────────────────────────────────
function ReportSection({ title, cards, onSelect }) {
  const colourMap = {
    cyan:   { bg: 'rgba(0,201,255,0.06)',   border: 'rgba(0,201,255,0.15)',   icon: '#00C9FF' },
    purple: { bg: 'rgba(182,133,255,0.06)', border: 'rgba(182,133,255,0.15)', icon: '#B685FF' },
    green:  { bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.15)',   icon: '#22c55e' },
    amber:  { bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.15)',  icon: '#fbbf24' },
  }

  return (
    <div>
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const c = colourMap[card.colour] || colourMap.cyan
          return (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className="group text-left glass-card rounded-xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.icon}15` }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: c.icon }}>{card.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{card.title}</p>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{card.description}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant/30 group-hover:text-primary/60 transition-colors mt-0.5" style={{ fontSize: '18px' }}>chevron_right</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Report dispatcher
// ────────────────────────────────────────────────────────
function ReportView({ reportId, user, isManager }) {
  switch (reportId) {
    case 'my-time-summary':       return <MyTimeSummary user={user} />
    case 'my-submission-tracker': return <MySubmissionTracker user={user} />
    case 'team-submission-status': return isManager ? <TeamSubmissionStatus /> : null
    case 'returned-entries':       return isManager ? <ReturnedEntries /> : null
    case 'project-time-report':    return isManager ? <ProjectTimeReport /> : null
    case 'client-summary':         return isManager ? <ClientSummary /> : null
    case 'cumulative-time':        return isManager ? <CumulativeTimeChart /> : null
    case 'category-breakdown':     return isManager ? <CategoryBreakdown /> : null
    default: return <p className="text-on-surface-variant">Report not found.</p>
  }
}

// ────────────────────────────────────────────────────────
// Shared components
// ────────────────────────────────────────────────────────

function DateRangeSelector({ range, onChange }) {
  // range = { mode: 'month' | 'custom', monthStart, from, to }
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  function shiftMonth(dir) {
    const d = new Date(range.monthStart + '-01T12:00:00')
    d.setMonth(d.getMonth() + dir)
    const ms = d.toISOString().slice(0, 7)
    onChange({ ...range, monthStart: ms })
  }

  const monthLabel = new Date(range.monthStart + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Mode toggle */}
      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
        <button
          onClick={() => onChange({ ...range, mode: 'month' })}
          className={`px-3 py-1.5 text-xs font-bold transition-all ${range.mode === 'month' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface'}`}
        >Month</button>
        <button
          onClick={() => onChange({ ...range, mode: 'custom' })}
          className={`px-3 py-1.5 text-xs font-bold transition-all ${range.mode === 'custom' ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface'}`}
        >Custom</button>
      </div>

      {range.mode === 'month' ? (
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
          </button>
          <span className="text-sm font-bold text-on-surface min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all" disabled={range.monthStart >= currentMonth}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
            style={{ background: 'var(--color-surface-variant)', border: 'none' }}
          />
          <span className="text-xs text-on-surface-variant">to</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            className="rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
            style={{ background: 'var(--color-surface-variant)', border: 'none' }}
          />
        </div>
      )}
    </div>
  )
}

function getDateRange(range) {
  if (range.mode === 'month') {
    const d = new Date(range.monthStart + '-01T12:00:00')
    const from = d.toISOString().slice(0, 10)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const to = last.toISOString().slice(0, 10)
    return { from, to }
  }
  return { from: range.from, to: range.to }
}

function defaultRange() {
  const now = new Date()
  const ms = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const to = last.toISOString().slice(0, 10)
  return { mode: 'month', monthStart: ms, from, to }
}

// ── Simple SVG bar chart ──
function BarChart({ data, labelKey, valueKey, colour = '#00C9FF', height = 200 }) {
  if (!data.length) return null
  const max = Math.max(...data.map((d) => d[valueKey]), 0.1)
  const barWidth = Math.min(48, Math.floor((100 / data.length) * 0.7))
  const gap = (100 - barWidth * data.length) / (data.length + 1)

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 600 ${height + 40}`} className="w-full" style={{ minWidth: Math.max(400, data.length * 60) }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <g key={frac}>
            <line x1="50" y1={height - frac * height + 10} x2="590" y2={height - frac * height + 10} stroke="var(--glass-border-subtle)" strokeWidth="0.5" />
            <text x="45" y={height - frac * height + 14} textAnchor="end" fontSize="10" fill="var(--color-outline)">{(max * frac).toFixed(1)}</text>
          </g>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d[valueKey] / max) * height
          const x = 55 + i * ((590 - 55) / data.length)
          const w = ((590 - 55) / data.length) * 0.65
          return (
            <g key={i}>
              <rect x={x} y={height - barH + 10} width={w} height={barH} rx="4" fill={colour} opacity="0.8" />
              <text x={x + w / 2} y={height + 28} textAnchor="middle" fontSize="9" fill="var(--color-outline)" className="select-none">
                {d[labelKey]?.length > 10 ? d[labelKey].slice(0, 10) + '...' : d[labelKey]}
              </text>
              <text x={x + w / 2} y={height - barH + 4} textAnchor="middle" fontSize="9" fill="var(--color-on-surface)" fontWeight="600">
                {d[valueKey].toFixed(1)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Simple SVG horizontal bar chart ──
function HorizontalBarChart({ data, labelKey, valueKey, colour = '#00C9FF' }) {
  if (!data.length) return null
  const max = Math.max(...data.map((d) => d[valueKey]), 0.1)
  const barHeight = 28
  const gap = 8
  const svgH = data.length * (barHeight + gap) + 10

  return (
    <svg viewBox={`0 0 500 ${svgH}`} className="w-full">
      {data.map((d, i) => {
        const y = i * (barHeight + gap) + 5
        const barW = (d[valueKey] / max) * 320
        return (
          <g key={i}>
            <text x="0" y={y + barHeight / 2 + 4} fontSize="11" fill="var(--color-on-surface)" fontWeight="500">
              {d[labelKey]?.length > 18 ? d[labelKey].slice(0, 18) + '...' : d[labelKey]}
            </text>
            <rect x="140" y={y} width={barW} height={barHeight} rx="6" fill={colour} opacity="0.75" />
            <text x={145 + barW} y={y + barHeight / 2 + 4} fontSize="11" fill="var(--color-on-surface)" fontWeight="700">{d[valueKey].toFixed(1)}d</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Simple SVG line chart ──
function LineChart({ series, height = 220 }) {
  // series = [{ label, colour, data: [{ x, y }] }]
  if (!series.length || !series[0].data.length) return null
  const allY = series.flatMap((s) => s.data.map((d) => d.y))
  const maxY = Math.max(...allY, 0.1)
  const allX = series[0].data.map((d) => d.x)
  const w = 580
  const pad = { l: 50, r: 10, t: 10, b: 40 }
  const plotW = w - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  function toSvg(d, i, total) {
    const x = pad.l + (i / Math.max(total - 1, 1)) * plotW
    const y = pad.t + plotH - (d.y / maxY) * plotH
    return { x, y }
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ minWidth: 400 }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <g key={frac}>
            <line x1={pad.l} y1={pad.t + plotH - frac * plotH} x2={w - pad.r} y2={pad.t + plotH - frac * plotH} stroke="var(--glass-border-subtle)" strokeWidth="0.5" />
            <text x={pad.l - 5} y={pad.t + plotH - frac * plotH + 4} textAnchor="end" fontSize="9" fill="var(--color-outline)">{(maxY * frac).toFixed(1)}</text>
          </g>
        ))}
        {/* X labels */}
        {allX.map((label, i) => {
          const x = pad.l + (i / Math.max(allX.length - 1, 1)) * plotW
          // Only show every Nth label if too many
          if (allX.length > 12 && i % Math.ceil(allX.length / 12) !== 0 && i !== allX.length - 1) return null
          return (
            <text key={i} x={x} y={height - 5} textAnchor="middle" fontSize="8" fill="var(--color-outline)">{label}</text>
          )
        })}
        {/* Lines */}
        {series.map((s) => {
          const pts = s.data.map((d, i) => toSvg(d, i, s.data.length))
          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          return (
            <g key={s.label}>
              <path d={pathD} fill="none" stroke={s.colour} strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={s.colour} />
              ))}
            </g>
          )
        })}
        {/* Legend */}
        {series.length > 1 && series.map((s, i) => (
          <g key={s.label} transform={`translate(${pad.l + i * 120}, ${height - 18})`}>
            <rect width="10" height="10" rx="2" fill={s.colour} />
            <text x="14" y="9" fontSize="9" fill="var(--color-outline)">{s.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ── Donut chart ──
function DonutChart({ data, size = 180 }) {
  if (!data.length) return null
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const cx = size / 2, cy = size / 2, r = size * 0.38, stroke = size * 0.12
  let cumAngle = -Math.PI / 2

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const angle = (d.value / total) * Math.PI * 2
          const x1 = cx + r * Math.cos(cumAngle)
          const y1 = cy + r * Math.sin(cumAngle)
          cumAngle += angle
          const x2 = cx + r * Math.cos(cumAngle)
          const y2 = cy + r * Math.sin(cumAngle)
          const large = angle > Math.PI ? 1 : 0
          const pathD = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
          return <path key={i} d={pathD} fill="none" stroke={d.colour} strokeWidth={stroke} strokeLinecap="round" />
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--color-on-surface)">{total.toFixed(1)}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="var(--color-outline)">days</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.colour }} />
            <span className="text-xs text-on-surface-variant">{d.label}</span>
            <span className="text-xs font-bold text-on-surface ml-auto tabular-nums">{d.value.toFixed(1)}d</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Colour palette for charts
const CHART_COLOURS = ['#00C9FF', '#B685FF', '#22c55e', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#e879f9']

// ────────────────────────────────────────────────────────
// 1. MY TIME SUMMARY
// ────────────────────────────────────────────────────────
function MyTimeSummary({ user }) {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewBy, setViewBy] = useState('project') // project | category | client

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, time_value, category, client, project_id, projects(name)')
      .eq('user_id', user.id)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date')
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [user?.id, range])

  // Aggregate
  const totals = useMemo(() => {
    const map = {}
    for (const e of entries) {
      let key
      if (viewBy === 'project') key = e.projects?.name || 'Unassigned'
      else if (viewBy === 'category') key = e.category || 'Unknown'
      else key = e.client || 'No client'
      map[key] = (map[key] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [entries, viewBy])

  const grandTotal = totals.reduce((s, t) => s + t.value, 0)

  // Weekly trend
  const weeklyTrend = useMemo(() => {
    const map = {}
    for (const e of entries) {
      // Group by ISO week (use Monday of the week)
      const d = new Date(e.entry_date + 'T12:00:00')
      const day = d.getDay() || 7
      const mon = new Date(d)
      mon.setDate(d.getDate() - day + 1)
      const key = mon.toISOString().slice(0, 10)
      map[key] = (map[key] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([x, y]) => ({
        x: new Date(x + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        y,
      }))
  }, [entries])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">My Time Summary</h2>
        <p className="text-sm text-on-surface-variant mt-1">How your time has been spent over the selected period.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <DateRangeSelector range={range} onChange={setRange} />
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
          {['project', 'category', 'client'].map((v) => (
            <button
              key={v}
              onClick={() => setViewBy(v)}
              className={`px-3 py-1.5 text-xs font-bold capitalize transition-all ${viewBy === v ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface'}`}
            >{v}</button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner message="Loading time data..." /> : entries.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>search_off</span>
          <p className="text-on-surface-variant mt-3">No entries found for this period.</p>
        </div>
      ) : (
        <>
          {/* Summary stat */}
          <div className="glass-card rounded-xl p-5" style={{ background: 'rgba(0,201,255,0.06)', border: '1px solid rgba(0,201,255,0.15)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-heading font-black text-primary tabular-nums">{grandTotal.toFixed(1)}</span>
              <span className="text-sm text-on-surface-variant">total days across {totals.length} {viewBy === 'project' ? 'projects' : viewBy === 'category' ? 'categories' : 'clients'}</span>
            </div>
          </div>

          {/* Breakdown chart */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">By {viewBy}</p>
            <HorizontalBarChart
              data={totals}
              labelKey="label"
              valueKey="value"
              colour={viewBy === 'project' ? '#00C9FF' : viewBy === 'category' ? '#B685FF' : '#22c55e'}
            />
          </div>

          {/* Donut */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">Distribution</p>
            <DonutChart data={totals.map((t, i) => ({ label: t.label, value: t.value, colour: CHART_COLOURS[i % CHART_COLOURS.length] }))} />
          </div>

          {/* Weekly trend */}
          {weeklyTrend.length > 1 && (
            <div className="glass-card rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">Weekly trend</p>
              <LineChart series={[{ label: 'Days', colour: '#00C9FF', data: weeklyTrend }]} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 2. MY SUBMISSION TRACKER
// ────────────────────────────────────────────────────────
function MySubmissionTracker({ user }) {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, day_name, week_ending, time_value, status')
      .eq('user_id', user.id)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('week_ending', { ascending: true })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [user?.id, range])

  // Group by week_ending
  const weeks = useMemo(() => {
    const map = {}
    for (const e of entries) {
      if (!map[e.week_ending]) map[e.week_ending] = []
      map[e.week_ending].push(e)
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([we, ents]) => {
        const weekDays = getWeekDates(we).filter((d) => !d.isWeekend)
        const datesLogged = new Set(ents.map((e) => e.entry_date))
        const gaps = weekDays.filter((d) => !datesLogged.has(d.date) && d.date <= new Date().toISOString().slice(0, 10))
        const totalDays = ents.reduce((s, e) => s + Number(e.time_value || 0), 0)
        const statuses = new Set(ents.map((e) => e.status))
        const allSubmitted = ents.length > 0 && ents.every((e) => e.status === 'submitted' || e.status === 'signed_off')
        const hasReturned = ents.some((e) => e.status === 'returned')
        const allDraft = ents.every((e) => e.status === 'draft')

        let status = 'complete'
        let statusLabel = 'Submitted'
        let statusColour = 'text-green-400'
        let bgColour = 'rgba(34,197,94,0.06)'
        let borderColour = 'rgba(34,197,94,0.15)'

        if (hasReturned) {
          status = 'returned'; statusLabel = 'Returned'; statusColour = 'text-amber-400'; bgColour = 'rgba(251,191,36,0.06)'; borderColour = 'rgba(251,191,36,0.15)'
        } else if (ents.length === 0) {
          status = 'empty'; statusLabel = 'No entries'; statusColour = 'text-red-400'; bgColour = 'rgba(248,113,113,0.04)'; borderColour = 'rgba(248,113,113,0.12)'
        } else if (gaps.length > 0 && !allSubmitted) {
          status = 'gaps'; statusLabel = `${gaps.length} day${gaps.length > 1 ? 's' : ''} missing`; statusColour = 'text-amber-400'; bgColour = 'rgba(251,191,36,0.04)'; borderColour = 'rgba(251,191,36,0.12)'
        } else if (allDraft) {
          status = 'draft'; statusLabel = 'Draft'; statusColour = 'text-on-surface-variant'; bgColour = 'var(--glass-bg)'; borderColour = 'var(--glass-border-subtle)'
        } else if (!allSubmitted) {
          status = 'partial'; statusLabel = 'Partially submitted'; statusColour = 'text-primary'; bgColour = 'rgba(0,201,255,0.04)'; borderColour = 'rgba(0,201,255,0.12)'
        } else {
          // allSubmitted is true
          if (ents.some((e) => e.status === 'signed_off')) {
            statusLabel = 'Signed off'; statusColour = 'text-green-400'
          }
        }

        return { weekEnding: we, entries: ents, weekDays, gaps, totalDays, status, statusLabel, statusColour, bgColour, borderColour }
      })
  }, [entries])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">My Submission Tracker</h2>
        <p className="text-sm text-on-surface-variant mt-1">Track which weeks are complete, which have gaps, and which are still in draft.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {loading ? <LoadingSpinner message="Loading submissions..." /> : weeks.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>event_busy</span>
          <p className="text-on-surface-variant mt-3">No weeks found in this period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => (
            <div
              key={w.weekEnding}
              className="glass-card rounded-xl p-4"
              style={{ background: w.bgColour, border: `1px solid ${w.borderColour}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-on-surface">
                    w/e {new Date(w.weekEnding + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{w.totalDays.toFixed(1)} days logged</p>
                </div>
                <span className={`text-xs font-bold ${w.statusColour}`}>{w.statusLabel}</span>
              </div>

              {/* Day dots */}
              <div className="flex items-center gap-2">
                {w.weekDays.map((day) => {
                  const dayEntries = w.entries.filter((e) => e.entry_date === day.date)
                  const dayTotal = dayEntries.reduce((s, e) => s + Number(e.time_value || 0), 0)
                  const has = dayEntries.length > 0
                  const isPast = day.date <= today
                  const isToday = day.date === today

                  let dotBg = 'var(--glass-bg)'
                  let dotBorder = 'var(--glass-border-subtle)'
                  let dotText = 'text-on-surface-variant/40'
                  if (has) {
                    const allSub = dayEntries.every((e) => e.status === 'submitted' || e.status === 'signed_off')
                    const hasRet = dayEntries.some((e) => e.status === 'returned')
                    if (hasRet) { dotBg = 'rgba(251,191,36,0.15)'; dotBorder = 'rgba(251,191,36,0.3)'; dotText = 'text-amber-400' }
                    else if (allSub) { dotBg = 'rgba(34,197,94,0.15)'; dotBorder = 'rgba(34,197,94,0.3)'; dotText = 'text-green-400' }
                    else { dotBg = 'rgba(0,201,255,0.15)'; dotBorder = 'rgba(0,201,255,0.3)'; dotText = 'text-primary' }
                  } else if (isPast) {
                    dotBg = 'rgba(248,113,113,0.08)'; dotBorder = 'rgba(248,113,113,0.2)'; dotText = 'text-red-400/60'
                  }

                  return (
                    <div
                      key={day.date}
                      className={`flex-1 rounded-lg py-2 text-center transition-all ${isToday ? 'ring-1 ring-primary/30' : ''}`}
                      style={{ background: dotBg, border: `1px solid ${dotBorder}` }}
                    >
                      <p className="text-[9px] font-bold uppercase text-on-surface-variant/60">{day.dayName.slice(0, 3)}</p>
                      <p className={`text-sm font-bold tabular-nums ${dotText}`}>
                        {has ? dayTotal.toFixed(1) : isPast ? '—' : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 3. TEAM SUBMISSION STATUS (manager only)
// ────────────────────────────────────────────────────────
function TeamSubmissionStatus() {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)

    // Fetch all entries in range with profile info
    Promise.all([
      supabase.from('timesheet_entries')
        .select('id, user_id, week_ending, entry_date, time_value, status')
        .gte('entry_date', from)
        .lte('entry_date', to),
      supabase.from('profiles')
        .select('id, full_name, email, deactivated_at')
        .is('deactivated_at', null),
    ]).then(([entriesRes, profilesRes]) => {
      const entries = entriesRes.data || []
      const profiles = profilesRes.data || []

      // Get all unique week_endings in range
      const weekEndingsSet = new Set(entries.map((e) => e.week_ending))
      // Also compute expected week endings for the range
      const d = new Date(from + 'T12:00:00')
      const endDate = new Date(to + 'T12:00:00')
      while (d <= endDate) {
        const day = d.getDay()
        if (day === 5) { // Friday
          weekEndingsSet.add(d.toISOString().slice(0, 10))
        }
        d.setDate(d.getDate() + 1)
      }
      const weekEndings = Array.from(weekEndingsSet).sort()

      // Build grid: user × week
      const grid = profiles.map((p) => {
        const userEntries = entries.filter((e) => e.user_id === p.id)
        const weeks = weekEndings.map((we) => {
          const weekEntries = userEntries.filter((e) => e.week_ending === we)
          const total = weekEntries.reduce((s, e) => s + Number(e.time_value || 0), 0)
          const allSubmitted = weekEntries.length > 0 && weekEntries.every((e) => e.status === 'submitted' || e.status === 'signed_off')
          const hasReturned = weekEntries.some((e) => e.status === 'returned')
          const allDraft = weekEntries.length > 0 && weekEntries.every((e) => e.status === 'draft')

          let status = 'not_started'
          if (weekEntries.length === 0) status = 'not_started'
          else if (hasReturned) status = 'returned'
          else if (allSubmitted) status = 'submitted'
          else if (allDraft) status = 'draft'
          else status = 'partial'

          return { weekEnding: we, total, status, count: weekEntries.length }
        })
        return { user: p, weeks }
      }).sort((a, b) => (a.user.full_name || '').localeCompare(b.user.full_name || ''))

      setData({ grid, weekEndings })
      setLoading(false)
    })
  }, [range])

  const statusStyles = {
    submitted: { bg: 'rgba(34,197,94,0.2)', text: 'text-green-400', label: 'Submitted' },
    draft: { bg: 'rgba(0,201,255,0.15)', text: 'text-primary', label: 'Draft' },
    partial: { bg: 'rgba(182,133,255,0.15)', text: 'text-purple-400', label: 'Partial' },
    returned: { bg: 'rgba(251,191,36,0.2)', text: 'text-amber-400', label: 'Returned' },
    not_started: { bg: 'rgba(248,113,113,0.08)', text: 'text-red-400/50', label: 'Not started' },
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Team Submission Status</h2>
        <p className="text-sm text-on-surface-variant mt-1">Who has submitted, who's still in draft, and who hasn't started.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(statusStyles).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: s.bg }} />
            <span className="text-xs text-on-surface-variant">{s.label}</span>
          </div>
        ))}
      </div>

      {loading ? <LoadingSpinner message="Loading team data..." /> : !data.grid?.length ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>group_off</span>
          <p className="text-on-surface-variant mt-3">No team data found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-outline pb-3 pr-4 sticky left-0" style={{ background: 'var(--color-bg)', zIndex: 1 }}>User</th>
                {data.weekEndings.map((we) => (
                  <th key={we} className="text-center text-[9px] font-bold uppercase tracking-wider text-outline pb-3 px-2 min-w-[72px]">
                    w/e {new Date(we + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.grid.map((row) => (
                <tr key={row.user.id}>
                  <td className="py-2 pr-4 text-sm font-medium text-on-surface sticky left-0" style={{ background: 'var(--color-bg)', zIndex: 1 }}>
                    {row.user.full_name || row.user.email}
                  </td>
                  {row.weeks.map((w) => {
                    const s = statusStyles[w.status]
                    return (
                      <td key={w.weekEnding} className="py-2 px-1 text-center">
                        <div
                          className={`rounded-lg py-1.5 px-2 ${s.text}`}
                          style={{ background: s.bg }}
                          title={`${s.label} - ${w.total.toFixed(1)} days`}
                        >
                          <span className="text-xs font-bold tabular-nums">{w.total > 0 ? w.total.toFixed(1) : '—'}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 4. RETURNED ENTRIES (manager only)
// ────────────────────────────────────────────────────────
function ReturnedEntries() {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, day_name, week_ending, time_value, category, status, return_reason, returned_by, user_id, profiles(full_name), projects(name)')
      .eq('status', 'returned')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date', { ascending: false })
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [range])

  // Group by user for summary
  const byUser = useMemo(() => {
    const map = {}
    for (const e of entries) {
      const name = e.profiles?.full_name || 'Unknown'
      if (!map[name]) map[name] = 0
      map[name]++
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [entries])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Returned Entries</h2>
        <p className="text-sm text-on-surface-variant mt-1">Entries sent back for correction, with reasons and patterns.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {loading ? <LoadingSpinner message="Loading returned entries..." /> : entries.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>check_circle</span>
          <p className="text-on-surface-variant mt-3">No returned entries in this period. Nice!</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="glass-card rounded-xl p-5" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-heading font-black text-amber-400 tabular-nums">{entries.length}</span>
              <span className="text-sm text-on-surface-variant">returned entries across {byUser.length} user{byUser.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* By user breakdown */}
          {byUser.length > 1 && (
            <div className="glass-card rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-3">By user</p>
              <div className="space-y-2">
                {byUser.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-sm text-on-surface">{name}</span>
                    <span className="text-sm font-bold text-amber-400 tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entries table */}
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="glass-card rounded-xl px-4 py-3" style={{ border: '1px solid var(--glass-border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-surface">{e.profiles?.full_name || 'Unknown user'}</span>
                      <span className="text-xs text-on-surface-variant">-</span>
                      <span className="text-xs text-on-surface-variant">{e.projects?.name || 'No project'}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {formatDate(e.entry_date)} - {e.category} - {Number(e.time_value)}d
                    </p>
                  </div>
                </div>
                {e.return_reason && (
                  <div className="mt-2 px-3 py-2 rounded-lg text-xs text-amber-300/80 leading-relaxed" style={{ background: 'rgba(251,191,36,0.06)' }}>
                    <span className="font-bold text-amber-400">Reason:</span> {e.return_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 5. PROJECT TIME REPORT (manager only)
// ────────────────────────────────────────────────────────
function ProjectTimeReport() {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [drillProject, setDrillProject] = useState(null)

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, time_value, category, user_id, project_id, profiles(full_name), projects(name, client)')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date')
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [range])

  // Aggregate by project
  const projectTotals = useMemo(() => {
    const map = {}
    for (const e of entries) {
      const name = e.projects?.name || 'Unassigned'
      map[name] = (map[name] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [entries])

  // Drill-down data
  const drillData = useMemo(() => {
    if (!drillProject) return { byUser: [], byCat: [] }
    const projectEntries = entries.filter((e) => (e.projects?.name || 'Unassigned') === drillProject)

    const userMap = {}
    const catMap = {}
    for (const e of projectEntries) {
      const userName = e.profiles?.full_name || 'Unknown'
      userMap[userName] = (userMap[userName] || 0) + Number(e.time_value || 0)
      const cat = e.category || 'Unknown'
      catMap[cat] = (catMap[cat] || 0) + Number(e.time_value || 0)
    }

    return {
      byUser: Object.entries(userMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      byCat: Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    }
  }, [entries, drillProject])

  const grandTotal = projectTotals.reduce((s, t) => s + t.value, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Project Time Report</h2>
        <p className="text-sm text-on-surface-variant mt-1">Total time logged per project. Click a project to drill down by user and category.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {loading ? <LoadingSpinner message="Loading project data..." /> : entries.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>search_off</span>
          <p className="text-on-surface-variant mt-3">No entries found for this period.</p>
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl p-5" style={{ background: 'rgba(0,201,255,0.06)', border: '1px solid rgba(0,201,255,0.15)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-heading font-black text-primary tabular-nums">{grandTotal.toFixed(1)}</span>
              <span className="text-sm text-on-surface-variant">total days across {projectTotals.length} projects</span>
            </div>
          </div>

          {/* Project list — clickable */}
          <div className="space-y-2">
            {projectTotals.map((p) => (
              <button
                key={p.label}
                onClick={() => setDrillProject(drillProject === p.label ? null : p.label)}
                className={`w-full text-left glass-card rounded-xl px-4 py-3 transition-all hover:scale-[1.01] ${drillProject === p.label ? 'ring-1 ring-primary/40' : ''}`}
                style={{ border: '1px solid var(--glass-border-subtle)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-on-surface">{p.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primary tabular-nums">{p.value.toFixed(1)}d</span>
                    <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: '16px' }}>
                      {drillProject === p.label ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(p.value / grandTotal) * 100}%`, background: 'linear-gradient(90deg, #00C9FF, #7B2FDB)' }} />
                </div>
              </button>
            ))}
          </div>

          {/* Drill-down panel */}
          {drillProject && (
            <div className="glass-card rounded-xl p-5 space-y-5" style={{ background: 'rgba(0,201,255,0.03)', border: '1px solid rgba(0,201,255,0.1)' }}>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{drillProject} - Breakdown</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-3">By user</p>
                  <div className="space-y-2">
                    {drillData.byUser.map((d) => (
                      <div key={d.label} className="flex items-center justify-between">
                        <span className="text-sm text-on-surface">{d.label}</span>
                        <span className="text-sm font-bold text-primary tabular-nums">{d.value.toFixed(1)}d</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-3">By category</p>
                  <DonutChart data={drillData.byCat.map((d, i) => ({ label: d.label, value: d.value, colour: CHART_COLOURS[i % CHART_COLOURS.length] }))} size={150} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 6. CLIENT SUMMARY (manager only)
// ────────────────────────────────────────────────────────
function ClientSummary() {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, time_value, client, project_id, projects(name)')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [range])

  const clientData = useMemo(() => {
    const map = {}
    for (const e of entries) {
      const client = e.client || 'No client'
      if (!map[client]) map[client] = { total: 0, projects: {} }
      map[client].total += Number(e.time_value || 0)
      const proj = e.projects?.name || 'Unassigned'
      map[client].projects[proj] = (map[client].projects[proj] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(map)
      .map(([client, d]) => ({
        client,
        total: d.total,
        projects: Object.entries(d.projects).map(([name, val]) => ({ name, value: val })).sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.total - a.total)
  }, [entries])

  const grandTotal = clientData.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Client Summary</h2>
        <p className="text-sm text-on-surface-variant mt-1">Time rolled up to client level across all their projects.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {loading ? <LoadingSpinner message="Loading client data..." /> : clientData.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>search_off</span>
          <p className="text-on-surface-variant mt-3">No entries found for this period.</p>
        </div>
      ) : (
        <>
          <div className="glass-card rounded-xl p-5" style={{ background: 'rgba(182,133,255,0.06)', border: '1px solid rgba(182,133,255,0.15)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-heading font-black text-secondary tabular-nums">{grandTotal.toFixed(1)}</span>
              <span className="text-sm text-on-surface-variant">total days across {clientData.length} client{clientData.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="space-y-3">
            {clientData.map((c, idx) => (
              <div key={c.client} className="glass-card rounded-xl p-4" style={{ border: '1px solid var(--glass-border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-on-surface">{c.client}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: CHART_COLOURS[idx % CHART_COLOURS.length] }}>{c.total.toFixed(1)}d</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--glass-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(c.total / grandTotal) * 100}%`, background: CHART_COLOURS[idx % CHART_COLOURS.length] }} />
                </div>
                {/* Project breakdown */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {c.projects.map((p) => (
                    <span key={p.name} className="text-xs text-on-surface-variant">
                      <span className="text-on-surface font-medium">{p.name}</span>
                      <span className="ml-1 tabular-nums">{p.value.toFixed(1)}d</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 7. CUMULATIVE TIME CHART (manager only)
// ────────────────────────────────────────────────────────
function CumulativeTimeChart() {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, time_value, project_id, projects(name)')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .order('entry_date')
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [range])

  const series = useMemo(() => {
    // Get unique projects
    const projectMap = {}
    for (const e of entries) {
      const name = e.projects?.name || 'Unassigned'
      if (!projectMap[name]) projectMap[name] = {}
      const date = e.entry_date
      projectMap[name][date] = (projectMap[name][date] || 0) + Number(e.time_value || 0)
    }

    // Get all unique dates sorted
    const allDates = [...new Set(entries.map((e) => e.entry_date))].sort()
    if (allDates.length === 0) return []

    // Build cumulative series per project
    const projectNames = Object.keys(projectMap).sort()
    return projectNames.map((name, idx) => {
      let cum = 0
      const data = allDates.map((date) => {
        cum += projectMap[name][date] || 0
        return {
          x: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          y: cum,
        }
      })
      return { label: name, colour: CHART_COLOURS[idx % CHART_COLOURS.length], data }
    })
  }, [entries])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Cumulative Time Chart</h2>
        <p className="text-sm text-on-surface-variant mt-1">Running total of time logged per project over the selected period.</p>
      </div>

      <DateRangeSelector range={range} onChange={setRange} />

      {loading ? <LoadingSpinner message="Loading chart data..." /> : series.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>show_chart</span>
          <p className="text-on-surface-variant mt-3">No data for this period.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-5">
          <LineChart series={series} height={280} />
          {/* Legend below chart */}
          <div className="flex flex-wrap gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
            {series.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: s.colour }} />
                <span className="text-xs text-on-surface-variant">{s.label}</span>
                <span className="text-xs font-bold text-on-surface tabular-nums">{s.data[s.data.length - 1]?.y.toFixed(1)}d</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// 8. CATEGORY BREAKDOWN (manager only)
// ────────────────────────────────────────────────────────
function CategoryBreakdown() {
  const [range, setRange] = useState(defaultRange)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState('all')

  useEffect(() => {
    setLoading(true)
    const { from, to } = getDateRange(range)
    supabase
      .from('timesheet_entries')
      .select('id, entry_date, time_value, category, project_id, projects(name)')
      .gte('entry_date', from)
      .lte('entry_date', to)
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [range])

  const projects = useMemo(() => {
    const names = new Set(entries.map((e) => e.projects?.name).filter(Boolean))
    return ['all', ...Array.from(names).sort()]
  }, [entries])

  const filtered = useMemo(() => {
    if (selectedProject === 'all') return entries
    return entries.filter((e) => e.projects?.name === selectedProject)
  }, [entries, selectedProject])

  const categoryData = useMemo(() => {
    const map = {}
    for (const e of filtered) {
      const cat = e.category || 'Unknown'
      map[cat] = (map[cat] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // Per-project stacked data for the bar chart
  const stackedData = useMemo(() => {
    if (selectedProject !== 'all') return null
    const projectCats = {}
    for (const e of entries) {
      const proj = e.projects?.name || 'Unassigned'
      const cat = e.category || 'Unknown'
      if (!projectCats[proj]) projectCats[proj] = {}
      projectCats[proj][cat] = (projectCats[proj][cat] || 0) + Number(e.time_value || 0)
    }
    return Object.entries(projectCats)
      .map(([project, cats]) => ({
        project,
        total: Object.values(cats).reduce((s, v) => s + v, 0),
        categories: cats,
      }))
      .sort((a, b) => b.total - a.total)
  }, [entries, selectedProject])

  const grandTotal = categoryData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-2xl text-on-surface">Category Breakdown</h2>
        <p className="text-sm text-on-surface-variant mt-1">How time splits across categories, overall or per project.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <DateRangeSelector range={range} onChange={setRange} />
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg px-3 py-1.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
          style={{ background: 'var(--color-surface-variant)', border: 'none' }}
        >
          {projects.map((p) => (
            <option key={p} value={p}>{p === 'all' ? 'All projects' : p}</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingSpinner message="Loading category data..." /> : categoryData.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: '48px' }}>donut_large</span>
          <p className="text-on-surface-variant mt-3">No data for this period.</p>
        </div>
      ) : (
        <>
          {/* Donut overview */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">
              {selectedProject === 'all' ? 'Overall' : selectedProject} - {grandTotal.toFixed(1)} days
            </p>
            <DonutChart data={categoryData.map((d, i) => ({ label: d.label, value: d.value, colour: CHART_COLOURS[i % CHART_COLOURS.length] }))} />
          </div>

          {/* Stacked per-project view */}
          {stackedData && stackedData.length > 1 && (
            <div className="glass-card rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-4">By project</p>
              <div className="space-y-3">
                {stackedData.map((p) => {
                  const allCats = CATEGORIES.map((c) => c.value)
                  return (
                    <div key={p.project}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-on-surface">{p.project}</span>
                        <span className="text-xs font-bold text-on-surface tabular-nums">{p.total.toFixed(1)}d</span>
                      </div>
                      {/* Stacked bar */}
                      <div className="flex h-5 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                        {allCats.map((cat, ci) => {
                          const val = p.categories[cat] || 0
                          if (val === 0) return null
                          const pct = (val / p.total) * 100
                          return (
                            <div
                              key={cat}
                              className="h-full transition-all"
                              style={{ width: `${pct}%`, background: CHART_COLOURS[ci % CHART_COLOURS.length] }}
                              title={`${cat}: ${val.toFixed(1)}d (${pct.toFixed(0)}%)`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Category legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
                {CATEGORIES.map((c, i) => (
                  <div key={c.value} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLOURS[i % CHART_COLOURS.length] }} />
                    <span className="text-[10px] text-on-surface-variant">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

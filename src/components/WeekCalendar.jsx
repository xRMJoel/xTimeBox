import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Custom calendar picker that highlights days with entries and marks
 * weeks with submission status. Selects a Friday (week-ending) date.
 *
 * Props:
 *   value        – current week-ending date string (YYYY-MM-DD)
 *   onChange      – called with new YYYY-MM-DD when a Friday is selected
 *   userId        – user ID for fetching entry indicators
 */
export default function WeekCalendar({ value, onChange, userId }) {
  const [open, setOpen] = useState(false)

  // Display month — defaults to the month of the selected value
  const selected = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  // Entry metadata for the visible month
  const [entryDays, setEntryDays] = useState({})   // { 'YYYY-MM-DD': { total, statuses: Set } }
  const [weekStatuses, setWeekStatuses] = useState({}) // { 'YYYY-MM-DD' (friday): status }

  // When viewMonth changes, fetch entry data for that month range
  useEffect(() => {
    if (!userId) return

    // Fetch a window that covers the full calendar grid (prev month tail + next month head)
    const from = new Date(viewYear, viewMonth - 1, 1).toISOString().slice(0, 10)
    const to = new Date(viewYear, viewMonth + 2, 0).toISOString().slice(0, 10)

    supabase
      .from('timesheet_entries')
      .select('entry_date, time_value, status, week_ending')
      .eq('user_id', userId)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .then(({ data }) => {
        const days = {}
        const weeks = {}

        for (const e of (data || [])) {
          // Per-day aggregation
          if (!days[e.entry_date]) days[e.entry_date] = { total: 0, statuses: new Set() }
          days[e.entry_date].total += Number(e.time_value || 0)
          days[e.entry_date].statuses.add(e.status)

          // Per-week aggregation (keyed by week_ending Friday)
          if (!weeks[e.week_ending]) weeks[e.week_ending] = new Set()
          weeks[e.week_ending].add(e.status)
        }

        // Compute week-level status
        const weekStatus = {}
        for (const [we, statuses] of Object.entries(weeks)) {
          if (statuses.has('signed_off') || (statuses.size === 1 && statuses.has('submitted'))) {
            weekStatus[we] = 'submitted'
          } else if (statuses.has('submitted')) {
            weekStatus[we] = 'partial'
          } else if (statuses.has('returned')) {
            weekStatus[we] = 'returned'
          } else {
            weekStatus[we] = 'draft'
          }
        }

        setEntryDays(days)
        setWeekStatuses(weekStatus)
      })
  }, [userId, viewYear, viewMonth])

  // Build calendar grid for the view month
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    let startDow = firstOfMonth.getDay() // 0=Sun
    // Convert to Mon=0 format
    startDow = startDow === 0 ? 6 : startDow - 1

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const days = []

    // Leading days from previous month
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i)
      days.push({ date: d.toISOString().slice(0, 10), day: prevMonthDays - i, outside: true, d })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i)
      days.push({ date: d.toISOString().slice(0, 10), day: i, outside: false, d })
    }

    // Trailing days to fill 6 rows (42 cells)
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i)
      days.push({ date: d.toISOString().slice(0, 10), day: i, outside: true, d })
    }

    return days
  }, [viewYear, viewMonth])

  // Group into weeks (rows of 7)
  const weeks = useMemo(() => {
    const rows = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7))
    }
    return rows
  }, [calendarDays])

  function shiftMonth(dir) {
    let m = viewMonth + dir
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  function selectDate(dateStr) {
    // Snap to the Friday of that week
    const d = new Date(dateStr + 'T12:00:00')
    const dow = d.getDay() // 0=Sun
    const diffToFri = dow <= 5 ? 5 - dow : 5 - dow + 7
    const friday = new Date(d)
    friday.setDate(d.getDate() + diffToFri)
    const fridayStr = friday.toISOString().slice(0, 10)
    onChange(fridayStr)
    setOpen(false)
  }

  const today = new Date().toISOString().slice(0, 10)
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Format the selected date for display
  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Select week'

  // Compute the Friday for each week row to show week status
  function getWeekFriday(weekRow) {
    // Friday is index 4 (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4)
    return weekRow[4]?.date
  }

  // Week status indicator colours
  const weekStatusColours = {
    submitted: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', dot: '#22c55e' },
    partial:   { bg: 'rgba(182,133,255,0.1)', border: 'rgba(182,133,255,0.3)', dot: '#B685FF' },
    returned:  { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', dot: '#fbbf24' },
    draft:     { bg: 'rgba(0,201,255,0.08)', border: 'rgba(0,201,255,0.2)', dot: '#00C9FF' },
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-on-surface text-sm font-medium transition-all focus:ring-2 focus:ring-primary outline-none"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--color-outline-variant)' }}
      >
        <span>{displayValue}</span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>calendar_month</span>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl p-4 w-[340px] shadow-xl"
            style={{ background: 'var(--color-surface-container)', border: '1px solid var(--glass-border)' }}
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              <span className="text-sm font-bold text-on-surface">{monthLabel}</span>
              <button onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-[24px_repeat(7,1fr)] gap-0 mb-1">
              <div /> {/* spacer for week status column */}
              {DAY_HEADERS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider text-outline py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-0.5">
              {weeks.map((week, wi) => {
                const friday = getWeekFriday(week)
                const ws = weekStatuses[friday]
                const wsColours = ws ? weekStatusColours[ws] : null
                const isSelectedWeek = value === friday

                return (
                  <div
                    key={wi}
                    className={`grid grid-cols-[24px_repeat(7,1fr)] gap-0 rounded-lg transition-all ${isSelectedWeek ? 'ring-1 ring-primary/40' : ''}`}
                    style={isSelectedWeek ? { background: 'rgba(0,201,255,0.05)' } : {}}
                  >
                    {/* Week status indicator */}
                    <div className="flex items-center justify-center">
                      {wsColours && (
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: wsColours.dot }}
                          title={ws === 'submitted' ? 'Submitted' : ws === 'partial' ? 'Partially submitted' : ws === 'returned' ? 'Returned' : 'Draft'}
                        />
                      )}
                    </div>

                    {/* Days */}
                    {week.map((day) => {
                      const entry = entryDays[day.date]
                      const isToday = day.date === today
                      const isSelectedDay = day.date === value
                      const isFriday = day.d.getDay() === 5

                      // Entry status colouring
                      let dotColour = null
                      if (entry) {
                        const statuses = entry.statuses
                        if (statuses.has('signed_off') || (statuses.size === 1 && statuses.has('submitted'))) {
                          dotColour = '#22c55e' // green for submitted/signed off
                        } else if (statuses.has('returned')) {
                          dotColour = '#fbbf24' // amber for returned
                        } else {
                          dotColour = '#00C9FF' // cyan for draft
                        }
                      }

                      return (
                        <button
                          key={day.date}
                          onClick={() => selectDate(day.date)}
                          className={`relative flex flex-col items-center justify-center py-1.5 rounded-md transition-all text-center
                            ${day.outside ? 'opacity-30' : ''}
                            ${isToday ? 'ring-1 ring-primary/50' : ''}
                            ${isSelectedDay ? 'bg-primary/20 text-primary font-bold' : 'hover:bg-white/5'}
                          `}
                        >
                          <span className={`text-xs tabular-nums ${day.outside ? 'text-on-surface-variant' : isSelectedDay ? 'text-primary font-bold' : 'text-on-surface'}`}>
                            {day.day}
                          </span>
                          {/* Entry indicator dot */}
                          {dotColour && !day.outside && (
                            <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: dotColour }} />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#00C9FF' }} />
                <span className="text-[10px] text-on-surface-variant">Draft</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-[10px] text-on-surface-variant">Submitted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
                <span className="text-[10px] text-on-surface-variant">Returned</span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
              <button
                onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors"
              >Clear</button>
              <button
                onClick={() => {
                  const now = new Date()
                  setViewYear(now.getFullYear())
                  setViewMonth(now.getMonth())
                  selectDate(now.toISOString().slice(0, 10))
                }}
                className="text-xs font-medium text-primary hover:text-primary-dim transition-colors"
              >Today</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

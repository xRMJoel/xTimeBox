import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Calendar picker with optional range selection and entry status indicators.
 *
 * Props:
 *   value          – { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } or { start: '', end: '' }
 *   onChange        – called with { start, end } when selection changes
 *   userId          – if provided, fetches entry status data for the visible month
 *   highlightDates – Set of YYYY-MM-DD strings to mark with a purple dot (e.g. existing NWD)
 *   disableWeekends – if true, Saturday/Sunday are not selectable
 *   placeholder    – text shown when no date selected
 */
export default function DatePicker({ value, onChange, userId, highlightDates = new Set(), disableWeekends = false, placeholder = 'Select dates' }) {
  const [open, setOpen] = useState(false)

  // Range selection: null = not started, 'start' = picked start waiting for end
  const [pickingEnd, setPickingEnd] = useState(false)
  const [hoverDate, setHoverDate] = useState(null)

  const startDate = value?.start || ''
  const endDate = value?.end || ''

  const initDate = startDate ? new Date(startDate + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())

  // Entry metadata for the visible month (like WeekCalendar)
  const [entryDays, setEntryDays] = useState({})

  useEffect(() => {
    if (!userId || !open) return

    const from = new Date(viewYear, viewMonth - 1, 1).toISOString().slice(0, 10)
    const to = new Date(viewYear, viewMonth + 2, 0).toISOString().slice(0, 10)

    supabase
      .from('timesheet_entries')
      .select('entry_date, time_value, status')
      .eq('user_id', userId)
      .gte('entry_date', from)
      .lte('entry_date', to)
      .then(({ data }) => {
        const days = {}
        for (const e of (data || [])) {
          if (!days[e.entry_date]) days[e.entry_date] = { total: 0, statuses: new Set() }
          days[e.entry_date].total += Number(e.time_value || 0)
          days[e.entry_date].statuses.add(e.status)
        }
        setEntryDays(days)
      })
  }, [userId, viewYear, viewMonth, open])

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    let startDow = firstOfMonth.getDay()
    startDow = startDow === 0 ? 6 : startDow - 1

    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days = []

    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i)
      days.push({ date: d.toISOString().slice(0, 10), day: prevMonthDays - i, outside: true, d })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i)
      days.push({ date: d.toISOString().slice(0, 10), day: i, outside: false, d })
    }

    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i)
      days.push({ date: d.toISOString().slice(0, 10), day: i, outside: true, d })
    }

    return days
  }, [viewYear, viewMonth])

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

  function handleDayClick(dateStr) {
    if (!pickingEnd) {
      // First click: set start, clear end, wait for second click
      onChange({ start: dateStr, end: '' })
      setPickingEnd(true)
    } else {
      // Second click: set end (ensure start <= end)
      const s = startDate
      if (dateStr < s) {
        onChange({ start: dateStr, end: s })
      } else if (dateStr === s) {
        // Same date: single-day selection
        onChange({ start: dateStr, end: dateStr })
      } else {
        onChange({ start: s, end: dateStr })
      }
      setPickingEnd(false)
      setOpen(false)
    }
  }

  function isInRange(dateStr) {
    if (!startDate) return false
    const effectiveEnd = pickingEnd ? (hoverDate || startDate) : endDate
    if (!effectiveEnd) return dateStr === startDate
    const lo = startDate < effectiveEnd ? startDate : effectiveEnd
    const hi = startDate < effectiveEnd ? effectiveEnd : startDate
    return dateStr >= lo && dateStr <= hi
  }

  function isRangeStart(dateStr) {
    if (!startDate) return false
    const effectiveEnd = pickingEnd ? (hoverDate || startDate) : endDate
    if (!effectiveEnd) return dateStr === startDate
    return dateStr === (startDate < effectiveEnd ? startDate : effectiveEnd)
  }

  function isRangeEnd(dateStr) {
    if (!startDate) return false
    const effectiveEnd = pickingEnd ? (hoverDate || startDate) : endDate
    if (!effectiveEnd) return false
    return dateStr === (startDate < effectiveEnd ? effectiveEnd : startDate)
  }

  const today = new Date().toISOString().slice(0, 10)
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Format display value
  const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  let displayValue = placeholder
  if (startDate && endDate && startDate !== endDate) {
    const fmtShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    displayValue = `${fmtShort(startDate)} — ${fmt(endDate)}`
  } else if (startDate) {
    displayValue = pickingEnd ? `${fmt(startDate)} — ...` : fmt(startDate)
  }

  // Entry status dot colour (same logic as WeekCalendar)
  function getEntryDotColour(dateStr) {
    const entry = entryDays[dateStr]
    if (!entry) return null
    const s = entry.statuses
    if (s.has('signed_off') || (s.size === 1 && s.has('submitted'))) return '#22c55e'
    if (s.has('returned')) return '#fbbf24'
    return '#00C9FF'
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) { setPickingEnd(false); setHoverDate(null) } }}
        className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-on-surface text-sm font-medium transition-all focus:ring-2 focus:ring-primary outline-none"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--color-outline-variant)' }}
      >
        <span className={startDate ? '' : 'text-on-surface-variant'}>{displayValue}</span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>calendar_month</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setPickingEnd(false) }} />
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl p-4 w-[340px] shadow-xl"
            style={{ background: 'var(--color-surface-container)', border: '1px solid var(--glass-border)' }}
          >
            {/* Picking hint */}
            <p className="text-[10px] text-on-surface-variant text-center mb-2 uppercase tracking-wider font-bold">
              {pickingEnd ? 'Pick end date (or same day for single)' : 'Pick start date'}
            </p>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => shiftMonth(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              <span className="text-sm font-bold text-on-surface">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAY_HEADERS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider text-outline py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-0.5">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0">
                  {week.map((day) => {
                    const isToday = day.date === today
                    const isHighlighted = highlightDates.has(day.date)
                    const dow = day.d.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const disabled = disableWeekends && isWeekend
                    const inRange = isInRange(day.date) && !day.outside
                    const rangeStart = isRangeStart(day.date) && !day.outside
                    const rangeEnd = isRangeEnd(day.date) && !day.outside
                    const entryDot = getEntryDotColour(day.date)

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => !disabled && !day.outside && handleDayClick(day.date)}
                        onMouseEnter={() => pickingEnd && !day.outside && !disabled && setHoverDate(day.date)}
                        disabled={disabled || day.outside}
                        className={`relative flex flex-col items-center justify-center py-1.5 transition-all text-center
                          ${day.outside ? 'opacity-30' : ''}
                          ${disabled && !day.outside ? 'opacity-30 cursor-not-allowed' : ''}
                          ${isToday && !inRange ? 'ring-1 ring-primary/50' : ''}
                          ${rangeStart ? 'rounded-l-md' : ''}
                          ${rangeEnd ? 'rounded-r-md' : ''}
                          ${!rangeStart && !rangeEnd && inRange ? '' : !inRange ? 'rounded-md' : ''}
                          ${inRange ? 'bg-primary/15' : !disabled && !day.outside ? 'hover:bg-white/5 cursor-pointer' : ''}
                          ${rangeStart || rangeEnd ? 'bg-primary/25' : ''}
                        `}
                      >
                        <span className={`text-xs tabular-nums ${day.outside ? 'text-on-surface-variant' : (rangeStart || rangeEnd) ? 'text-primary font-bold' : inRange ? 'text-primary' : 'text-on-surface'}`}>
                          {day.day}
                        </span>
                        {/* Status dots */}
                        <div className="flex gap-0.5 mt-0.5 h-1.5">
                          {entryDot && !day.outside && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: entryDot }} />
                          )}
                          {isHighlighted && !day.outside && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#B685FF' }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            {userId && (
              <div className="flex flex-wrap gap-3 mt-3 pt-2" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
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
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#B685FF' }} />
                  <span className="text-[10px] text-on-surface-variant">NWD</span>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
              <button
                type="button"
                onClick={() => { onChange({ start: '', end: '' }); setPickingEnd(false); setOpen(false) }}
                className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors"
              >Clear</button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  setViewYear(now.getFullYear())
                  setViewMonth(now.getMonth())
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

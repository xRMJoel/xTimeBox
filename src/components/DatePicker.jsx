import { useState, useMemo } from 'react'

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Single-date calendar picker matching the WeekCalendar visual style.
 *
 * Props:
 *   value          – selected date string (YYYY-MM-DD) or ''
 *   onChange        – called with YYYY-MM-DD when a date is picked
 *   highlightDates – Set of YYYY-MM-DD strings to mark with a dot (e.g. existing NWD)
 *   disableWeekends – if true, Saturday/Sunday are not selectable
 *   placeholder    – text shown when no date selected
 */
export default function DatePicker({ value, onChange, highlightDates = new Set(), disableWeekends = false, placeholder = 'Select date' }) {
  const [open, setOpen] = useState(false)

  const selected = value ? new Date(value + 'T12:00:00') : new Date()
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

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

  function selectDate(dateStr) {
    onChange(dateStr)
    setOpen(false)
  }

  const today = new Date().toISOString().slice(0, 10)
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg px-4 py-3 text-on-surface text-sm font-medium transition-all focus:ring-2 focus:ring-primary outline-none"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--color-outline-variant)' }}
      >
        <span className={value ? '' : 'text-on-surface-variant'}>{displayValue}</span>
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '18px' }}>calendar_month</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-2 z-50 rounded-xl p-4 w-[320px] shadow-xl"
            style={{ background: 'var(--color-surface-container)', border: '1px solid var(--glass-border)' }}
          >
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
                    const isSelected = day.date === value
                    const isHighlighted = highlightDates.has(day.date)
                    const dow = day.d.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    const disabled = disableWeekends && isWeekend

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => !disabled && !day.outside && selectDate(day.date)}
                        disabled={disabled || day.outside}
                        className={`relative flex flex-col items-center justify-center py-1.5 rounded-md transition-all text-center
                          ${day.outside ? 'opacity-30' : ''}
                          ${disabled && !day.outside ? 'opacity-30 cursor-not-allowed' : ''}
                          ${isToday ? 'ring-1 ring-primary/50' : ''}
                          ${isSelected ? 'bg-primary/20 text-primary font-bold' : !disabled && !day.outside ? 'hover:bg-white/5 cursor-pointer' : ''}
                        `}
                      >
                        <span className={`text-xs tabular-nums ${day.outside ? 'text-on-surface-variant' : isSelected ? 'text-primary font-bold' : 'text-on-surface'}`}>
                          {day.day}
                        </span>
                        {isHighlighted && !day.outside && (
                          <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: '#B685FF' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--glass-border-subtle)' }}>
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
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

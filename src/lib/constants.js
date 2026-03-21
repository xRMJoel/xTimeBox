// Categories available for time entries
// Each has flags for whether feature tag or notes are required
export const CATEGORIES = [
  { value: 'Onboarding', label: 'Onboarding', showReference: false, referencePlaceholder: '', requiresNotes: true },
  { value: 'Support Ticket Investigation', label: 'Support Ticket Investigation', showReference: true, referencePlaceholder: 'Support Ticket ID', requiresNotes: true },
  { value: 'Development', label: 'Development', showReference: true, referencePlaceholder: 'Feature/Requirement ID', requiresNotes: true },
  { value: 'Testing', label: 'Testing', showReference: true, referencePlaceholder: 'Feature/Requirement ID', requiresNotes: true },
  { value: 'UAT Support', label: 'UAT Support', showReference: true, referencePlaceholder: 'Feature/Requirement ID', requiresNotes: true },
  { value: 'Release', label: 'Release', showReference: true, referencePlaceholder: 'Release ID', requiresNotes: true },
  { value: 'Other', label: 'Other', showReference: false, referencePlaceholder: '', requiresNotes: true },
]

// Time block options
export const TIME_BLOCKS = [
  { value: 'Quarter Day', label: 'Quarter Day (0.25)', numericValue: 0.25 },
  { value: 'Half Day', label: 'Half Day (0.5)', numericValue: 0.5 },
  { value: 'Three Quarter Day', label: 'Three Quarter Day (0.75)', numericValue: 0.75 },
  { value: 'Day', label: 'Full Day (1)', numericValue: 1 },
]

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Generate a unique reference: XRM-YYYYMMDD-ABC-01
export function generateReference(date, counter = 1) {
  const d = new Date(date)
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const rand = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const num = String(counter).padStart(2, '0')
  return `XRM-${dateStr}-${rand}-${num}`
}

// Get the Friday of the current week
export function getCurrentWeekFriday() {
  const now = new Date()
  const day = now.getDay()
  const diff = 5 - day // 5 = Friday
  const friday = new Date(now)
  friday.setDate(now.getDate() + diff)
  return friday.toISOString().slice(0, 10)
}

// Get all dates for a week given the Friday (week ending)
export function getWeekDates(weekEndingStr) {
  const friday = new Date(weekEndingStr + 'T12:00:00')
  const monday = new Date(friday)
  monday.setDate(friday.getDate() - 4)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push({
      date: d.toISOString().slice(0, 10),
      dayName: DAY_NAMES[i],
      isWeekend: i >= 5,
    })
  }
  return dates
}

// Format a date string nicely
export function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Get month label from a date
export function getMonthLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

// Get the first day of a month from any date in that month
export function getMonthStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

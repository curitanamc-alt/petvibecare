import { useState } from 'react'
import { cx } from './ui.jsx'

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function startOfMonth(year, month) { return new Date(year, month, 1) }

export default function Calendar({ value, onChange, disabled = () => false, minDate = new Date() }) {
  const now = new Date()
  const [view, setView] = useState({ year: value ? new Date(value + 'T00:00:00').getFullYear() : now.getFullYear(), month: value ? new Date(value + 'T00:00:00').getMonth() : now.getMonth() })

  const first = startOfMonth(view.year, view.month)
  const startDow = first.getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.year, view.month, d))

  const prev = () => setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))
  const next = () => setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const minIso = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, '0')}-${String(minDate.getDate()).padStart(2, '0')}`

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const atMin = view.year === minDate.getFullYear() && view.month === minDate.getMonth()

  return (
    <div className="w-full max-w-sm">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prev} disabled={atMin} className="rounded-lg border border-sage-200 p-2 text-charcoal-600 hover:bg-sage-100 disabled:opacity-30" aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="font-bold text-charcoal-900">{monthLabel}</span>
        <button type="button" onClick={next} className="rounded-lg border border-sage-200 p-2 text-charcoal-600 hover:bg-sage-100" aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DOW.map((d) => <div key={d} className="py-1 text-xs font-semibold text-charcoal-400">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const ds = iso(d)
          const past = ds < minIso
          const closed = d.getDay() === 0 // clinic closed Sundays
          const isDisabled = past || closed || disabled(ds)
          const selected = ds === value
          return (
            <button
              key={ds}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(ds)}
              className={cx(
                'rounded-lg py-2 text-sm transition-colors',
                selected ? 'bg-teal-600 font-bold text-white' : isDisabled ? 'text-charcoal-400 line-through opacity-50' : 'hover:bg-sage-100',
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-center text-xs text-charcoal-400">Clinic closed on Sundays · past dates unavailable</p>
    </div>
  )
}

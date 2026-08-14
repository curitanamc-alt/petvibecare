import { useEffect } from 'react'

// oxlint-disable-next-line react/only-export-components
export const cx = (...parts) => parts.filter(Boolean).join(' ')

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700',
    accent: 'bg-amber-500 text-white hover:bg-amber-600',
    outline: 'border border-teal-600 text-teal-600 hover:bg-teal-50',
    ghost: 'text-teal-600 hover:bg-teal-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    subtle: 'bg-sage-100 text-teal-700 hover:bg-sage-200',
  }
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }
  return <button type={type} className={cx(base, variants[variant], sizes[size], className)} {...props} />
}

export function Badge({ color = 'sage', children }) {
  const colors = {
    sage: 'bg-sage-100 text-teal-700',
    amber: 'bg-amber-500/15 text-amber-600',
    teal: 'bg-teal-100 text-teal-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', colors[color])}>{children}</span>
}

const STATUS_STYLE = {
  pending: ['bg-amber-500/15 text-amber-600', 'Pending'],
  confirmed: ['bg-teal-100 text-teal-700', 'Confirmed'],
  completed: ['bg-sage-100 text-teal-700', 'Completed'],
  cancelled: ['bg-red-100 text-red-700', 'Cancelled'],
  no_show: ['bg-gray-200 text-gray-700', 'No-show'],
  rebooked: ['bg-blue-100 text-blue-700', 'Rebooked'],
}
export function StatusBadge({ status }) {
  const [cls, label] = STATUS_STYLE[status] || STATUS_STYLE.pending
  return <Badge color={cls.includes('amber') ? 'amber' : cls.includes('red') ? 'red' : cls.includes('blue') ? 'teal' : 'sage'}><span className={cx('h-1.5 w-1.5 rounded-full mr-1.5', cls.split(' ')[0])} />{label}</Badge>
}

export function Card({ className = '', children }) {
  return <div className={cx('rounded-2xl border border-sage-200 bg-white shadow-sm', className)}>{children}</div>
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-charcoal-400">{hint}</span>}
    </label>
  )
}

const inputCls = 'w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100'
export function Input(props) { return <input {...props} className={cx(inputCls, props.className)} /> }
export function Select(props) { return <select {...props} className={cx(inputCls, props.className)} /> }
export function Textarea(props) { return <textarea {...props} className={cx(inputCls, 'min-h-20', props.className)} /> }

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal-900/50" onClick={onClose} />
      <div className={cx('relative w-full rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-charcoal-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-charcoal-400 hover:bg-sage-100 hover:text-charcoal-900" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-charcoal-400">
      <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon = '🐾', title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-sage-200 py-14 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="mt-2 font-semibold text-charcoal-900">{title}</p>
      <div className="mx-auto mt-1 max-w-sm text-sm text-charcoal-400">{children}</div>
    </div>
  )
}

export function Logo({ light = false, small = false }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-extrabold tracking-tight', small ? 'text-lg' : 'text-xl', light ? 'text-white' : 'text-teal-600')}>
      <span className={cx('grid place-items-center rounded-full', light ? 'bg-white/15' : 'bg-sage-100')}>
        <span className={small ? 'text-base' : 'text-lg'}>🐾</span>
      </span>
      PetVibe<span className="text-amber-500">Care</span>
    </span>
  )
}

export function SectionHeading({ eyebrow, title, subtitle, light = false }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-bold uppercase tracking-widest text-amber-500">{eyebrow}</p>}
      <h2 className={cx('mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl', light ? 'text-white' : 'text-charcoal-900')}>{title}</h2>
      {subtitle && <p className={cx('mt-3 text-base', light ? 'text-teal-100' : 'text-charcoal-400')}>{subtitle}</p>}
    </div>
  )
}

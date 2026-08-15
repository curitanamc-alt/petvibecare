import { useEffect } from 'react'
import { Link } from 'react-router-dom'

// oxlint-disable-next-line react/only-export-components
export const cx = (...parts) => parts.filter(Boolean).join(' ')

/* ─── Button ─── */
export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-[0.97]'
  const variants = {
    primary: 'bg-teal-600 text-white shadow-sm hover:bg-teal-700 hover:shadow-md',
    accent: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow-md',
    outline: 'border border-teal-600/30 text-teal-600 bg-white hover:bg-teal-50 hover:border-teal-600/50',
    ghost: 'text-teal-600 hover:bg-teal-50',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md',
    subtle: 'bg-sage-100 text-teal-700 hover:bg-sage-200',
  }
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3.5 text-base',
  }
  return <button type={type} className={cx(base, variants[variant], sizes[size], className)} {...props} />
}

/* ─── Badge ─── */
export function Badge({ color = 'sage', children }) {
  const colors = {
    sage: 'bg-sage-100 text-teal-700',
    amber: 'bg-amber-100 text-amber-600',
    teal: 'bg-teal-100 text-teal-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-charcoal-100 text-charcoal-500',
  }
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', colors[color])}>
      {children}
    </span>
  )
}

const STATUS_STYLE = {
  pending: ['bg-amber-100 text-amber-600', 'Pending'],
  confirmed: ['bg-teal-100 text-teal-700', 'Confirmed'],
  completed: ['bg-sage-100 text-teal-700', 'Completed'],
  cancelled: ['bg-red-50 text-red-600', 'Cancelled'],
  no_show: ['bg-charcoal-100 text-charcoal-500', 'No-show'],
  rebooked: ['bg-blue-50 text-blue-600', 'Rebooked'],
}
export function StatusBadge({ status }) {
  const [cls, label] = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <Badge color={cls.includes('amber') ? 'amber' : cls.includes('red') ? 'red' : cls.includes('blue') ? 'teal' : 'sage'}>
      <span className={cx('h-1.5 w-1.5 rounded-full mr-1.5', cls.split(' ')[0])} />
      {label}
    </Badge>
  )
}

/* ─── Card ─── */
export function Card({ className = '', hover = false, children }) {
  return (
    <div className={cx(
      'rounded-2xl border border-sage-200/80 bg-white',
      hover ? 'shadow-card hover:shadow-card-hover transition-shadow duration-300' : 'shadow-card',
      className
    )}>
      {children}
    </div>
  )
}

/* ─── Field ─── */
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-charcoal-800">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-charcoal-400">{hint}</span>}
    </label>
  )
}

/* ─── Input / Select / Textarea ─── */
const inputCls = 'w-full rounded-[var(--radius-button)] border border-sage-200 bg-white px-4 py-3 text-sm text-charcoal-900 placeholder:text-charcoal-400 transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/15 hover:border-sage-300'
export function Input(props) { return <input {...props} className={cx(inputCls, props.className)} /> }
export function Select(props) { return <select {...props} className={cx(inputCls, props.className)} /> }
export function Textarea(props) { return <textarea {...props} className={cx(inputCls, 'min-h-24 resize-y', props.className)} /> }

/* ─── Modal ─── */
export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 animate-fade-in">
      <div className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cx(
        'relative w-full rounded-2xl bg-white p-8 shadow-elevated max-h-[90vh] overflow-y-auto animate-scale-in',
        wide ? 'max-w-3xl' : 'max-w-lg'
      )}>
        <div className="mb-6 flex items-start justify-between">
          <h3 className="text-lg font-bold text-charcoal-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-charcoal-400 transition-colors hover:bg-sage-100 hover:text-charcoal-700"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─── Spinner ─── */
export function Spinner({ label = 'Loading…', fullPage = false }) {
  const inner = (
    <div className="flex flex-col items-center gap-4 py-24">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-[3px] border-sage-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-teal-600" style={{ animationDuration: '0.8s' }} />
      </div>
      <p className="text-sm font-medium text-charcoal-400 animate-pulse" style={{ animationDuration: '1.5s' }}>{label}</p>
    </div>
  )
  if (fullPage) return <div className="flex min-h-[60vh] items-center justify-center">{inner}</div>
  return inner
}

/* ─── Skeleton ─── */
export function Skeleton({ className = '' }) {
  return <div className={cx('skeleton', className)} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-sage-200/80 bg-white p-8 shadow-card">
      <div className="flex items-center gap-5">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

/* ─── EmptyState ─── */
export function EmptyState({ icon = '🐾', title, children }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-sage-200 bg-sage-50/50 py-20 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="mt-4 text-base font-semibold text-charcoal-800">{title}</p>
      <div className="mx-auto mt-2.5 max-w-sm text-sm text-charcoal-400 leading-relaxed">{children}</div>
    </div>
  )
}

/* ─── Logo ─── */
export function Logo({ light = false, small = false }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-extrabold tracking-tight', small ? 'text-lg' : 'text-xl', light ? 'text-white' : 'text-teal-600')}>
      <img src="/pvlogo.png" alt="PetVibe Care logo" className={cx('object-contain', small ? 'h-8 w-8' : 'h-9 w-9')} />
      PetVibe<span className="text-amber-500">Care</span>
    </span>
  )
}

/* ─── SectionHeading ─── */
export function SectionHeading({ eyebrow, title, subtitle, light = false }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">{eyebrow}</p>}
      <h2 className={cx('mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl leading-tight', light ? 'text-white' : 'text-charcoal-900')}>
        {title}
      </h2>
      {subtitle && <p className={cx('mt-5 text-base leading-relaxed', light ? 'text-teal-100' : 'text-charcoal-500')}>{subtitle}</p>}
    </div>
  )
}

/* ─── StatusPill ─── */
// oxlint-disable-next-line react/only-export-components
export const STATUS_TONE = {
  pending: 'amber',
  confirmed: 'teal',
  completed: 'green',
  cancelled: 'red',
  no_show: 'gray',
  rebooked: 'blue',
}
const PILL_TONES = {
  green: 'bg-sage-100 text-teal-700',
  teal: 'bg-teal-100 text-teal-700',
  amber: 'bg-amber-100 text-amber-600',
  gray: 'bg-charcoal-100 text-charcoal-500',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
}
const PILL_DOTS = {
  green: 'bg-teal-600',
  teal: 'bg-teal-600',
  amber: 'bg-amber-500',
  gray: 'bg-charcoal-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
}
export function StatusPill({ tone = 'green', dot = true, children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', PILL_TONES[tone])}>
      {dot && <span className={cx('mr-1.5 h-1.5 w-1.5 rounded-full', PILL_DOTS[tone])} />}
      {children}
    </span>
  )
}

/* ─── StatCard ─── */
export function StatCard({ icon, label, value, trend, trendDir = 'up', tone = 'teal', className = '', onClick, to }) {
  const inner = (
    <div className={cx(
      'rounded-2xl border border-sage-200/80 bg-white p-6 shadow-card transition-all duration-300',
      (onClick || to) ? 'hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer' : '',
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">{label}</p>
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-100 text-lg">{icon}</span>}
      </div>
      <p className={cx('mt-3 text-3xl font-extrabold', tone === 'amber' ? 'text-amber-500' : 'text-teal-600')}>{value}</p>
      {trend && (
        <p className={cx('mt-2 inline-flex items-center gap-1 text-xs font-semibold', trendDir === 'up' ? 'text-teal-600' : 'text-red-500')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {trendDir === 'up' ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7l10 10M17 9v8H9" />}
          </svg>
          {trend}
        </p>
      )}
    </div>
  )
  if (to) return <Link to={to} className="block">{inner}</Link>
  if (onClick) return <button type="button" onClick={onClick} className="w-full text-left">{inner}</button>
  return inner
}

/* ─── SectionCard ─── */
export function SectionCard({ title, subtitle, action, className = '', bodyClassName = '', children }) {
  return (
    <Card className={cx('p-7', className)}>
      {(title || action) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="font-bold text-charcoal-900">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-charcoal-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}

/* ─── Avatar ─── */
export function Avatar({ name = 'S', size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-lg', xl: 'h-16 w-16 text-2xl' }
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white', sizes[size], className)}>
      {String(name || 'S').charAt(0).toUpperCase()}
    </span>
  )
}

/* ─── PetPhoto (placeholder image) ─── */
const PET_PHOTO_SIZES = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-12 w-12 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
  xl: 'h-24 w-24 rounded-2xl',
  xxl: 'h-32 w-32 rounded-3xl',
}

function PawPrint({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <ellipse cx="6.5" cy="8" rx="2.2" ry="2.7" />
      <ellipse cx="12" cy="5.6" rx="2.2" ry="2.7" />
      <ellipse cx="17.5" cy="8" rx="2.2" ry="2.7" />
      <ellipse cx="4.6" cy="12.6" rx="1.9" ry="2.4" />
      <ellipse cx="19.4" cy="12.6" rx="1.9" ry="2.4" />
      <path d="M12 11.4c-3.2 0-5.8 2.4-5.8 5.2 0 1.6 1.3 2.9 3.1 2.9.9 0 1.6-.4 2.7-.4s1.8.4 2.7.4c1.8 0 3.1-1.3 3.1-2.9 0-2.8-2.6-5.2-5.8-5.2Z" />
    </svg>
  )
}

// Renders the pet's photo if one is on file, otherwise a paw-print placeholder
// image. The `photo_url` column exists in the DB but nothing populates it yet.
export function PetPhoto({ photoUrl, size = 'md', className = '' }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="Pet" className={cx('shrink-0 object-cover', PET_PHOTO_SIZES[size], className)} />
  }
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center bg-gradient-to-br from-sage-100 via-teal-50 to-teal-100 ring-1 ring-inset ring-teal-200/60',
        PET_PHOTO_SIZES[size],
        className,
      )}
    >
      <PawPrint className={cx('text-teal-300', size === 'sm' ? 'h-1/2 w-1/2' : 'h-3/5 w-3/5')} />
    </span>
  )
}

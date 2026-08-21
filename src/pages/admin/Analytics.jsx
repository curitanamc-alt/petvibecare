import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { Avatar, Card, Spinner, StatCard, StatusPill } from '../../components/ui.jsx'

const WEEKDAY_COLOR = [
  'bg-charcoal-300', // Sun
  'bg-teal-600',     // Mon
  'bg-amber-400',    // Tue
  'bg-teal-400',     // Wed
  'bg-amber-300',    // Thu
  'bg-teal-500',     // Fri
  'bg-teal-300',     // Sat
]
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DONUT_COLORS = ['bg-teal-600', 'bg-amber-400', 'bg-teal-400', 'bg-amber-300', 'bg-teal-300', 'bg-charcoal-300']
const DONUT_STROKE = ['#0a4d52', '#ff8c42', '#2a7a80', '#ffa45e', '#82b8bc', '#9ca3af']

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)

export default function Analytics() {
  const [data, setData] = useState(null)

  useEffect(() => { api.adminAnalytics().then(setData).catch(() => {}) }, [])

  const kpis = useMemo(() => {
    if (!data) return null
    const days = data.bookingsByDay || []
    // Postgres COUNT(*) arrives as a string in some backends — coerce to numbers
    const num = (v) => Number(v || 0)
    // bookingsByDay is the last 14 days — this week is the most recent 7
    const prevWeek = days.slice(0, 7).reduce((a, b) => a + num(b.count), 0)
    const total = days.slice(7).reduce((a, b) => a + num(b.count), 0)
    const weekTrend = prevWeek ? Math.round(((total - prevWeek) / prevWeek) * 100) : 0
    const revenue = (data.revenueByService || []).reduce((a, b) => a + num(b.revenue), 0)
    const sb = Object.fromEntries((data.statusBreakdown || []).map((s) => [s.status, num(s.n)]))
    const statusTotal = (data.statusBreakdown || []).reduce((a, b) => a + num(b.n), 0)
    return { total, weekTrend, revenue, noShow: pct(sb.no_show || 0, statusTotal), rebook: pct(sb.rebooked || 0, statusTotal) }
  }, [data])

  // weekly chart: this week's appointments (most recent 7 days), colored by
  // weekday — the API still returns 14 days so the KPI trend stays comparable,
  // but the chart itself is a clean one-week view.
  const weekly = useMemo(() => {
    if (!data) return []
    return (data.bookingsByDay || []).slice(-7).map((d) => {
      const wd = new Date(d.date + 'T00:00:00').getDay()
      return { ...d, wd }
    })
  }, [data])

  // category breakdown from revenue data
  const byCategory = useMemo(() => {
    if (!data) return []
    const map = {}
    for (const r of data.revenueByService || []) {
      map[r.category] ??= { category: r.category, revenue: 0, bookings: 0 }
      map[r.category].revenue += Number(r.revenue || 0)
      map[r.category].bookings += Number(r.bookings || 0)
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [data])

  if (!data || !kpis) return <Spinner label="Crunching the numbers…" />

  const maxDay = Math.max(...weekly.map((d) => d.count), 1)
  const maxService = Math.max(...(data.topServices || []).map((s) => s.n), 1)
  const donutTotal = byCategory.reduce((a, b) => a + b.revenue, 0)

  // donut segments (SVG stroke-dasharray)
  let acc = 0
  const segments = byCategory.map((c) => {
    const frac = donutTotal ? c.revenue / donutTotal : 0
    const seg = { ...c, start: acc, frac }
    acc += frac
    return seg
  })
  const R = 42
  const CIRC = 2 * Math.PI * R

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Analytics</h1>
        <p className="mt-1 text-sm text-charcoal-500">Clinic performance over the last 14 days.</p>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="📅"
          label="Appointments this week"
          value={kpis.total}
          trend={`${kpis.weekTrend >= 0 ? '+' : ''}${kpis.weekTrend}% vs last week`}
          trendDir={kpis.weekTrend >= 0 ? 'up' : 'down'}
        />
        <StatCard icon="💰" label="Est. revenue (14d)" value={`₱${kpis.revenue.toLocaleString()}`} tone="amber" />
        <StatCard icon="🚫" label="No-show rate" value={`${kpis.noShow}%`} trend="of all bookings" trendDir="down" />
        <StatCard icon="🔁" label="Rebooking rate" value={`${kpis.rebook}%`} trend="no-shows rebooked" trendDir="up" />
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        {/* ── Appointments chart (horizontal bars) ── */}
        <Card className="p-7">
          <h2 className="font-bold text-charcoal-900">Appointments — last 7 days</h2>
          <div className="mt-6 space-y-2">
            {weekly.map((d) => {
              const label = new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
              return (
                <div key={d.date} className="group flex items-center gap-3">
                  <span className="w-14 shrink-0 text-right text-xs font-semibold text-charcoal-400">{label}</span>
                  <div className="relative h-5 flex-1 rounded-full bg-sage-100">
                    <div
                      className={`h-full rounded-full ${WEEKDAY_COLOR[d.wd]} transition-all duration-300 group-hover:opacity-80`}
                      style={{ width: `${Math.max((d.count / maxDay) * 100, d.count ? 8 : 2)}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-xs font-bold text-charcoal-900">{d.count}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-sage-100 pt-4">
            {WEEKDAY_LABEL.map((l, i) => (
              <span key={l} className="inline-flex items-center gap-1.5 text-xs text-charcoal-500">
                <span className={`h-2.5 w-2.5 rounded ${WEEKDAY_COLOR[i]}`} />
                {l}
              </span>
            ))}
          </div>
        </Card>

        {/* ── Category donut ── */}
        <Card className="p-7">
          <h2 className="font-bold text-charcoal-900">Revenue by category</h2>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="#e8f3ee" strokeWidth="14" />
                {segments.map((s, i) => (
                  <circle
                    key={s.category}
                    cx="50" cy="50" r={R} fill="none"
                    stroke={s.frac ? DONUT_STROKE[i % DONUT_STROKE.length] : 'none'}
                    style={{
                      strokeWidth: 14,
                      strokeDasharray: `${s.frac * CIRC} ${CIRC - s.frac * CIRC}`,
                      strokeDashoffset: -s.start * CIRC,
                    }}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-lg font-extrabold text-charcoal-900">₱{donutTotal.toLocaleString()}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-400">total</p>
                </div>
              </div>
            </div>
            <div className="w-full space-y-2.5">
              {byCategory.map((c, i) => (
                <div key={c.category} className="flex items-center gap-2.5 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DONUT_COLORS[i % DONUT_COLORS.length]}`} />
                  <span className="truncate text-charcoal-700">{c.category}</span>
                  <span className="ml-auto font-semibold text-charcoal-900">₱{c.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Top services ── */}
        <Card className="p-7">
          <h2 className="font-bold text-charcoal-900">Top services</h2>
          <div className="mt-5 space-y-4">
            {(data.topServices || []).map((s, i) => (
              <div key={s.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-charcoal-900">#{i + 1} {s.name}</span>
                  <span className="text-charcoal-400">{s.n} bookings</span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-sage-100">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${(s.n / maxService) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Staff performance ── */}
        <Card className="p-7">
          <h2 className="font-bold text-charcoal-900">Staff performance</h2>
          <div className="mt-5 space-y-4">
            {(data.staffPerformance || []).map((s) => (
              <div key={s.full_name} className="flex items-center gap-3.5">
                <Avatar name={s.full_name} size="md" className="bg-teal-700" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-charcoal-900">{s.full_name}</p>
                    <span className="text-sm font-bold text-teal-600">{s.completed}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <StatusPill tone={s.role === 'admin' ? 'amber' : 'teal'} dot={false}>{s.role}</StatusPill>
                    <span className="text-xs text-charcoal-400">completed visits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api, fmtDateShort } from '../../lib/api.js'
import { Badge, Card, Spinner } from '../../components/ui.jsx'

const STATUS_COLOR = { pending: 'bg-amber-500', confirmed: 'bg-teal-600', completed: 'bg-sage-200', cancelled: 'bg-red-500', no_show: 'bg-gray-400', rebooked: 'bg-blue-500' }

export default function Analytics() {
  const [data, setData] = useState(null)

  useEffect(() => { api.adminAnalytics().then(setData).catch(() => {}) }, [])

  if (!data) return <Spinner label="Crunching the numbers…" />

  const totalBookings = data.bookingsByDay.reduce((a, b) => a + b.count, 0)
  const maxDay = Math.max(...data.bookingsByDay.map((d) => d.count), 1)
  const maxRev = Math.max(...data.revenueByService.map((r) => r.revenue), 1)
  const maxStaff = Math.max(...data.staffPerformance.map((s) => s.completed), 1)
  const totalRevenue = data.revenueByService.reduce((a, b) => a + b.revenue, 0)
  const statusTotal = data.statusBreakdown.reduce((a, b) => a + b.n, 0)

  const cards = [
    { label: 'Bookings (14d)', value: totalBookings },
    { label: 'Est. revenue', value: `₱${totalRevenue.toLocaleString()}` },
    { label: 'Top service', value: data.topServices[0]?.name || '—' },
    { label: 'Most active staff', value: data.staffPerformance[0]?.full_name || '—' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Analytics</h1>
        <p className="text-sm text-charcoal-400">Clinic performance over the last 14 days.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">{c.label}</p>
            <p className="mt-2 truncate text-xl font-extrabold text-teal-600">{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* bookings over time */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Bookings over time</h2>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {data.bookingsByDay.map((d) => (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-teal-600 opacity-0 transition group-hover:opacity-100">{d.count}</span>
                <div className="w-full rounded-t bg-teal-600/80 transition group-hover:bg-teal-600" style={{ height: `${Math.max((d.count / maxDay) * 100, d.count ? 8 : 2)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-charcoal-400">
            <span>{fmtDateShort(data.bookingsByDay[0].date)}</span>
            <span>Today</span>
          </div>
        </Card>

        {/* revenue by service */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Revenue by service</h2>
          <div className="mt-4 space-y-3">
            {data.revenueByService.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-charcoal-900">{r.name}</span>
                  <span className="text-charcoal-400">₱{r.revenue.toLocaleString()} · {r.bookings} bookings</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-sage-100">
                  <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* staff performance */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Staff performance</h2>
          <div className="mt-4 space-y-3">
            {data.staffPerformance.map((s) => (
              <div key={s.full_name}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-charcoal-900">{s.full_name}</span>
                  <span className="capitalize text-charcoal-400">{s.role} · {s.completed} completed</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-sage-100">
                  <div className="h-2.5 rounded-full bg-teal-600" style={{ width: `${(s.completed / maxStaff) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* status breakdown */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Booking status breakdown</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.statusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center gap-2 rounded-full border border-sage-200 px-3 py-1.5 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[s.status] || 'bg-gray-400'}`} />
                <span className="capitalize text-charcoal-600">{s.status.replace('_', ' ')}</span>
                <span className="font-bold text-charcoal-900">{s.n}</span>
                <span className="text-xs text-charcoal-400">({statusTotal ? Math.round((s.n / statusTotal) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-bold text-charcoal-900">Top services</h3>
          <ul className="mt-2 space-y-1.5">
            {data.topServices.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <Badge color="teal">#{i + 1}</Badge>
                <span className="text-charcoal-900">{s.name}</span>
                <span className="ml-auto text-charcoal-400">{s.n} bookings</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDateShort } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Card, Spinner, StatusBadge } from '../../components/ui.jsx'

const p = (n) => `₱${Number(n).toLocaleString()}`

export default function AdminHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [today, setToday] = useState([])
  const [pending, setPending] = useState([])

  useEffect(() => {
    const date = new Date().toISOString().slice(0, 10)
    Promise.all([
      api.adminStats(),
      api.adminBookings(`?date=${date}`),
      api.adminBookings('?status=pending'),
    ]).then(([s, t, pn]) => { setStats(s); setToday(t); setPending(pn) }).catch(() => {})
  }, [])

  if (!stats) return <Spinner label="Loading dashboard…" />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const cards = [
    { label: 'Total pets', value: stats.totalPets, icon: '🐾', to: '/admin/pets' },
    { label: "Today's appointments", value: stats.todayBookings, icon: '📅', to: '/admin/appointments' },
    { label: 'Pending approvals', value: stats.pending, icon: '⏳', to: '/admin/appointments?status=pending' },
    { label: 'Est. revenue', value: p(stats.revenue), icon: '💰', to: '/admin/analytics' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">{greeting}, {user?.full_name?.replace('Dr. ', '')} 👋</h1>
          <p className="text-sm text-charcoal-400">Here's the clinic at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/appointments" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Manage appointments</Link>
          <Link to="/admin/walkin" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">+ Add walk-in</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="rounded-2xl border border-sage-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">{c.label}</p>
              <span className="text-xl">{c.icon}</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold text-teal-600">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-charcoal-900">Today's timeline</h2>
            <Link to="/admin/appointments" className="text-sm font-semibold text-teal-600 hover:underline">All appointments</Link>
          </div>
          {today.length === 0 ? (
            <p className="mt-4 rounded-xl bg-sage-50 p-6 text-center text-sm text-charcoal-400">No appointments scheduled for today.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {today.sort((a, b) => a.booking_time.localeCompare(b.booking_time)).map((b) => (
                <div key={b.booking_id} className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3">
                  <span className="w-14 text-sm font-bold text-teal-600">{b.booking_time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal-900">{b.service_name} — {b.pet_name}</p>
                    <p className="truncate text-xs text-charcoal-400">{b.owner_name}{b.staff_name ? ` · ${b.staff_name}` : ' · unassigned'}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-charcoal-900">Needs approval</h2>
            <Link to="/admin/appointments?status=pending" className="text-sm font-semibold text-teal-600 hover:underline">View all</Link>
          </div>
          {pending.length === 0 ? (
            <p className="mt-4 rounded-xl bg-sage-50 p-6 text-center text-sm text-charcoal-400">All caught up — nothing waiting on approval. 🎉</p>
          ) : (
            <div className="mt-4 space-y-2">
              {pending.slice(0, 5).map((b) => (
                <div key={b.booking_id} className="flex items-center justify-between gap-3 rounded-xl border border-sage-200 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-charcoal-900">{b.reference_code} · {b.service_name}</p>
                    <p className="truncate text-xs text-charcoal-400">{fmtDateShort(b.booking_date)} {b.booking_time} · {b.pet_name} / {b.owner_name}</p>
                  </div>
                  <Link to={`/admin/appointments?q=${b.reference_code}`} className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">Review</Link>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/admin/pets" className="rounded-2xl border border-sage-200 bg-white p-5 shadow-sm hover:shadow-md">
          <p className="text-sm font-semibold text-charcoal-900">Customer pets</p>
          <p className="text-xs text-charcoal-400">Search pets, view medical logs</p>
        </Link>
        <Link to="/admin/schedule" className="rounded-2xl border border-sage-200 bg-white p-5 shadow-sm hover:shadow-md">
          <p className="text-sm font-semibold text-charcoal-900">Staff schedules</p>
          <p className="text-xs text-charcoal-400">Set working hours per staff member</p>
        </Link>
        <Link to="/admin/analytics" className="rounded-2xl border border-sage-200 bg-white p-5 shadow-sm hover:shadow-md">
          <p className="text-sm font-semibold text-charcoal-900">Analytics</p>
          <p className="text-xs text-charcoal-400">Bookings, revenue &amp; staff performance</p>
        </Link>
      </div>
    </div>
  )
}

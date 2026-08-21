import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Button, Spinner, EmptyState, Card, StatusBadge } from '../../components/ui.jsx'

export default function StaffDashboard() {
  const { user, logout } = useAuth()
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    api.staffBookings()
      .then(setBookings)
      .catch((e) => {
        if (e?.status === 401) { logout(); return }
        setError(e?.message || 'Could not load dashboard.')
      })
  }, [logout])

  const today = new Date().toISOString().slice(0, 10)

  const myBookings = useMemo(() => bookings, [bookings])

  const todayBookings = useMemo(
    () => myBookings.filter((b) => b.booking_date === today && !['cancelled', 'no_show'].includes(b.status)),
    [myBookings, today],
  )

  const upcoming = useMemo(
    () => myBookings
      .filter((b) => b.booking_date >= today && !['cancelled', 'no_show', 'completed'].includes(b.status))
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
      .slice(0, 8),
    [myBookings, today],
  )

  const pendingCount = useMemo(
    () => myBookings.filter((b) => b.status === 'pending').length,
    [myBookings],
  )

  const confirmedCount = useMemo(
    () => myBookings.filter((b) => b.status === 'confirmed' && b.booking_date >= today).length,
    [myBookings, today],
  )

  if (error) {
    return (
      <EmptyState icon="⚠️" title="Couldn't load the dashboard">
        {error}
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </EmptyState>
    )
  }

  if (!bookings.length && !error) return <Spinner label="Loading your schedule…" />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 p-8 shadow-card sm:p-10">
        <div className="pointer-events-none absolute -right-6 -top-8 select-none text-[9rem] leading-none opacity-20">🐾</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{greeting}, {user?.full_name?.replace('Dr. ', '').split(' ')[0]}! 👋</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-teal-50/90">
          {todayBookings.length} appointment{todayBookings.length === 1 ? '' : 's'} today · {confirmedCount} confirmed upcoming · {pendingCount} pending approval{pendingCount === 1 ? '' : 's'}.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-2xl">📅</span>
          <div>
            <p className="text-2xl font-extrabold text-charcoal-900">{todayBookings.length}</p>
            <p className="text-sm text-charcoal-500">Today's appointments</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-2xl">⏳</span>
          <div>
            <p className="text-2xl font-extrabold text-charcoal-900">{pendingCount}</p>
            <p className="text-sm text-charcoal-500">Awaiting confirmation</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-green-100 text-2xl">✅</span>
          <div>
            <p className="text-2xl font-extrabold text-charcoal-900">{confirmedCount}</p>
            <p className="text-sm text-charcoal-500">Confirmed upcoming</p>
          </div>
        </Card>
      </div>

      {/* Upcoming appointments */}
      <Card className="p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-charcoal-900">Upcoming appointments</h2>
            <p className="mt-1 text-xs text-charcoal-400">Your next {upcoming.length} scheduled visits</p>
          </div>
          <Link to="/admin/appointments" className="text-sm font-semibold text-teal-600 hover:underline">View all →</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-5 rounded-xl bg-sage-50 p-10 text-center text-sm text-charcoal-400">No upcoming appointments.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {upcoming.map((b) => (
              <Link
                key={b.booking_id}
                to={`/admin/appointments?q=${b.reference_code}`}
                className="flex items-center gap-4 rounded-xl border border-sage-200/80 px-4 py-3.5 transition-colors hover:bg-sage-50/50"
              >
                <span className="w-14 shrink-0 text-sm font-bold text-teal-600">{b.booking_time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-charcoal-900">{b.pet_name} — {b.service_name}</p>
                  <p className="truncate text-xs text-charcoal-400">{fmtDate(b.booking_date)} · {b.owner_name}</p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

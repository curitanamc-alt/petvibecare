import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDateShort } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Card, StatusBadge, Spinner, Button, EmptyState } from '../../components/ui.jsx'

export default function PortalHome() {
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([api.myPets(), api.myBookings()])
      .then(([d, b]) => { if (!cancelled) { setData(d); setBookings(b) } })
      .catch((e) => {
        if (cancelled) return
        if (e?.status === 401) { logout(); return }
        setError(e?.message || 'Could not load your portal.')
      })
    return () => { cancelled = true }
  }, [loadKey, logout])

  if (error) {
    return (
      <EmptyState icon="⚠️" title="Couldn't load your portal">
        {error}
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={() => setLoadKey((k) => k + 1)}>Try again</Button>
        </div>
      </EmptyState>
    )
  }

  if (!data) return <Spinner label="Loading your portal…" />

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings
    .filter((b) => b.booking_date >= today && !['cancelled', 'no_show', 'completed'].includes(b.status))
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date))
    .slice(0, 4)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">
          Welcome back, {user?.full_name?.split(' ')[0]}! 🐾
        </h1>
        <p className="mt-1.5 text-sm text-charcoal-500">Here's what's happening with your furbabies.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Pets on file', value: data.pets.length, color: 'teal' },
          { label: 'Upcoming bookings', value: upcoming.length, color: 'amber' },
          { label: 'Total visits', value: bookings.length, color: 'sage' },
        ].map((s) => (
          <Card key={s.label} className="p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">{s.label}</p>
            <p className={`mt-3 text-3xl font-extrabold ${s.color === 'amber' ? 'text-amber-500' : 'text-teal-600'}`}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-charcoal-900">Upcoming appointments</h2>
          <Link to="/portal/bookings" className="text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-6 rounded-xl bg-sage-50 p-10 text-center">
            <p className="text-sm text-charcoal-400">No upcoming appointments.</p>
            <Button variant="accent" size="sm" className="mt-5" onClick={() => (location.href = '/book')}>
              Book one now
            </Button>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-sage-100">
            {upcoming.map((b) => (
              <div key={b.booking_id} className="flex items-center justify-between gap-4 py-5 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-charcoal-900">{b.service_name}</p>
                  <p className="mt-1 text-xs text-charcoal-400">
                    {b.pet_name} · {fmtDateShort(b.booking_date)} at {b.booking_time}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="flex items-center justify-between p-7 transition-all duration-300 hover:shadow-card-hover" hover>
          <div>
            <p className="font-bold text-charcoal-900">Book a visit</p>
            <p className="mt-1 text-sm text-charcoal-500">Check-ups, x-rays, spay/neuter &amp; more.</p>
          </div>
          <Link
            to="/book"
            className="rounded-[var(--radius-button)] bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-amber-600 hover:shadow-md active:scale-[0.97]"
          >
            Book now
          </Link>
        </Card>
        <Card className="flex items-center justify-between p-7 transition-all duration-300 hover:shadow-card-hover" hover>
          <div>
            <p className="font-bold text-charcoal-900">Add a new pet</p>
            <p className="mt-1 text-sm text-charcoal-500">Keep every furbaby on file.</p>
          </div>
          <Link
            to="/portal/pets"
            className="rounded-[var(--radius-button)] bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-teal-700 hover:shadow-md active:scale-[0.97]"
          >
            Manage pets
          </Link>
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDateShort } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Card, StatusBadge, Spinner, Button } from '../../components/ui.jsx'

export default function PortalHome() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [bookings, setBookings] = useState([])

  useEffect(() => {
    Promise.all([api.myPets(), api.myBookings()])
      .then(([d, b]) => { setData(d); setBookings(b) })
      .catch(() => {})
  }, [])

  if (!data) return <Spinner label="Loading your portal…" />

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter((b) => b.booking_date >= today && !['cancelled', 'no_show', 'completed'].includes(b.status)).sort((a, b) => a.booking_date.localeCompare(b.booking_date)).slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Welcome back, {user?.full_name?.split(' ')[0]}! 🐾</h1>
        <p className="text-sm text-charcoal-400">Here's what's happening with your furbabies.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">Pets on file</p>
          <p className="mt-1 text-3xl font-extrabold text-teal-600">{data.pets.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">Upcoming bookings</p>
          <p className="mt-1 text-3xl font-extrabold text-teal-600">{upcoming.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">Total visits</p>
          <p className="mt-1 text-3xl font-extrabold text-teal-600">{bookings.length}</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-charcoal-900">Upcoming appointments</h2>
          <Link to="/portal/bookings" className="text-sm font-semibold text-teal-600 hover:underline">View all</Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-4 rounded-xl bg-sage-50 p-6 text-center">
            <p className="text-sm text-charcoal-400">No upcoming appointments.</p>
            <Button variant="accent" size="sm" className="mt-3" onClick={() => (location.href = '/book')}>Book one now</Button>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-sage-200">
            {upcoming.map((b) => (
              <div key={b.booking_id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-charcoal-900">{b.service_name}</p>
                  <p className="text-xs text-charcoal-400">{b.pet_name} · {fmtDateShort(b.booking_date)} at {b.booking_time}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="font-bold text-charcoal-900">Book a visit</p>
            <p className="text-sm text-charcoal-400">Check-ups, x-rays, spay/neuter &amp; more.</p>
          </div>
          <Link to="/book" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Book now</Link>
        </Card>
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="font-bold text-charcoal-900">Add a new pet</p>
            <p className="text-sm text-charcoal-400">Keep every furbaby on file.</p>
          </div>
          <Link to="/portal/pets" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Manage pets</Link>
        </Card>
      </div>
    </div>
  )
}

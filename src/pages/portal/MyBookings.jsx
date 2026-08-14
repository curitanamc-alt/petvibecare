import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Card, EmptyState, Spinner, StatusBadge } from '../../components/ui.jsx'

export default function MyBookings() {
  const [bookings, setBookings] = useState(null)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => { api.myBookings().then(setBookings).catch(() => setBookings([])) }, [])

  const today = new Date().toISOString().slice(0, 10)
  const { upcoming, past } = useMemo(() => {
    if (!bookings) return { upcoming: [], past: [] }
    const future = bookings.filter((b) => b.booking_date >= today)
    return { upcoming: future, past: bookings.filter((b) => !future.includes(b)) }
  }, [bookings, today])

  const list = tab === 'upcoming' ? upcoming : past

  if (!bookings) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">My Bookings</h1>
        <p className="text-sm text-charcoal-400">Track status and reference numbers for every appointment.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
        {['upcoming', 'past'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-teal-600 text-white' : 'text-charcoal-400 hover:text-teal-600'}`}>
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'} icon="📅">
          {tab === 'upcoming' ? <><Link to="/book" className="font-semibold text-teal-600 hover:underline">Book an appointment</Link> to see it here.</> : 'Past visits will appear here.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <Card key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-charcoal-900">{b.service_name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-0.5 text-sm text-charcoal-400">
                  {b.pet_name} · {fmtDate(b.booking_date)} at {b.booking_time}
                </p>
                <p className="mt-1 text-xs text-charcoal-400">
                  Ref: <span className="font-mono font-semibold text-teal-600">{b.reference_code}</span>
                  {b.staff_name && <> · Assigned: {b.staff_name}</>}
                </p>
              </div>
              <div className="text-right">
                {b.status === 'confirmed' && (
                  <p className="text-xs font-semibold text-amber-600">Arrive on time — slot held 20–30 min</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

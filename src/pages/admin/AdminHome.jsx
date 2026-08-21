import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Button, Spinner, EmptyState, StatCard, SectionCard, StatusBadge } from '../../components/ui.jsx'

const CAT_COLOR = {
  'Consultation & Check-Up': 'bg-teal-500',
  'Vaccination & Deworming': 'bg-amber-400',
  'Pet Grooming': 'bg-teal-300',
}
const OTHER_COLOR = 'bg-charcoal-300'

const monthKey = (dateStr) => dateStr?.slice(0, 7) || ''
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'short' })
}

export default function AdminHome() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState(null)
  const [allBookings, setAllBookings] = useState([])
  const [error, setError] = useState(null)
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([api.adminStats(), api.adminBookings()])
      .then(([s, b]) => { if (!cancelled) { setStats(s); setAllBookings(b) } })
      .catch((e) => {
        if (cancelled) return
        if (e?.status === 401) { logout(); return }
        setError(e?.message || 'Could not load the dashboard.')
      })
    return () => { cancelled = true }
  }, [loadKey, logout])

  // ── bookings by category, grouped per month (last 3 months with data) ──
  const chart = useMemo(() => {
    const byMonth = {}
    for (const b of allBookings) {
      const mk = monthKey(b.booking_date)
      if (!mk) continue
      byMonth[mk] ??= {}
      byMonth[mk][b.service_category] = (byMonth[mk][b.service_category] || 0) + 1
    }
    const months = Object.keys(byMonth).sort().slice(-3)
    const cats = {}
    for (const m of months) for (const c of Object.keys(byMonth[m])) cats[c] = (cats[c] || 0) + 1
    const ordered = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c)
    const totals = months.map((m) => Object.values(byMonth[m]).reduce((a, b) => a + b, 0))
    const max = Math.max(...totals, 1)
    return { months, ordered, totals, max, byMonth }
  }, [allBookings])

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return allBookings
      .filter((b) => b.booking_date >= today && !['cancelled', 'no_show', 'completed'].includes(b.status))
      .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
      .slice(0, 6)
  }, [allBookings])

  if (error) {
    return (
      <EmptyState icon="⚠️" title="Couldn't load the dashboard">
        {error}
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={() => setLoadKey((k) => k + 1)}>Try again</Button>
        </div>
      </EmptyState>
    )
  }

  if (!stats) return <Spinner label="Loading dashboard…" />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-8">
      {/* ── Greeting card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 p-8 shadow-card sm:p-10">
        <div className="pointer-events-none absolute -right-6 -top-8 select-none text-[9rem] leading-none opacity-20">🐾</div>
        <div className="pointer-events-none absolute -bottom-10 right-24 select-none text-[7rem] leading-none opacity-10">🐶</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{greeting}, {user?.full_name?.replace('Dr. ', '').split(' ')[0]}! 👋</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-amber-50/90">
          {stats.pending} pending approval{stats.pending === 1 ? '' : 's'} · {stats.upcoming} confirmed upcoming · {stats.todayBookings} appointment{stats.todayBookings === 1 ? '' : 's'} today.
        </p>
      </div>

      {/* ── Stat tiles ── */}
      <div className="grid gap-6 sm:grid-cols-2">
        <StatCard icon="🐾" label="Total pets" value={stats.totalPets} to="/admin/pets" />
        <StatCard icon="📅" label="Upcoming appointments" value={stats.upcoming} to="/admin/appointments" />
      </div>

      {/* ── Chart + scheduled list ── */}
      <div className="grid gap-7 lg:grid-cols-5">
        <SectionCard title="Bookings by category" subtitle="Last months, color-coded per service category" className="lg:col-span-3">
          {chart.months.length === 0 ? (
            <div className="rounded-xl bg-sage-50 p-10 text-center text-sm text-charcoal-400">No bookings yet.</div>
          ) : (
            <>
              {/* h-52 = 208px; each month column is h-full so the bars (pixel heights)
                  resolve against a real height instead of collapsing to 0 */}
              <div className="mt-2 flex h-52 items-end gap-6">
                {chart.months.map((m) => {
                  const total = chart.totals[chart.months.indexOf(m)]
                  // tallest bar ≈ 140px; reserve the rest for the count + month labels
                  const barPx = Math.max(Math.round((total / chart.max) * 140), 6)
                  return (
                    <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-sm font-bold text-charcoal-700">{total}</span>
                      <div className="flex w-full max-w-[9rem] flex-col justify-end gap-1" style={{ height: `${barPx}px` }}>
                        {chart.ordered.map((c) => {
                          const n = chart.byMonth[m][c] || 0
                          if (!n) return null
                          return (
                            <div
                              key={c}
                              className={`rounded ${CAT_COLOR[c] || OTHER_COLOR}`}
                              style={{ height: `${(n / total) * 100}%` }}
                              title={`${c}: ${n}`}
                            />
                          )
                        })}
                      </div>
                      <span className="text-xs font-semibold text-charcoal-500">{monthLabel(m)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-sage-100 pt-4">
                {chart.ordered.map((c) => (
                  <span key={c} className="inline-flex items-center gap-2 text-xs text-charcoal-500">
                    <span className={`h-2.5 w-2.5 rounded ${CAT_COLOR[c] || OTHER_COLOR}`} />
                    {c}
                  </span>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Scheduled appointments"
          subtitle="Next confirmed & pending visits"
          className="lg:col-span-2"
          action={<Link to="/admin/appointments" className="text-sm font-semibold text-teal-600 hover:underline">View all</Link>}
        >
          {upcoming.length === 0 ? (
            <div className="rounded-xl bg-sage-50 p-10 text-center text-sm text-charcoal-400">No upcoming appointments.</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <Link
                  key={b.booking_id}
                  to={`/admin/appointments?q=${b.reference_code}`}
                  className="flex items-center gap-4 rounded-xl border border-sage-200/80 px-4 py-3.5 transition-colors hover:bg-sage-50/50"
                >
                  <span className="w-14 shrink-0 text-sm font-bold text-teal-600">{b.booking_time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal-900">{b.pet_name} — {b.service_name}</p>
                    <p className="truncate text-xs text-charcoal-400">{b.booking_date} · {b.owner_name}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          to="/admin/walkin"
          className="flex items-center justify-between rounded-2xl bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div>
            <p className="font-bold text-charcoal-900">Create Appointment</p>
            <p className="mt-1 text-sm text-charcoal-500">Walk-in or counter booking for any client & pet.</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-lg text-white">✚</span>
        </Link>
        <Link
          to="/admin/schedule"
          className="flex items-center justify-between rounded-2xl bg-white p-7 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div>
            <p className="font-bold text-charcoal-900">View Staff Schedule</p>
            <p className="mt-1 text-sm text-charcoal-500">Set weekly working hours per vet & groomer.</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600 text-lg text-white">🕐</span>
        </Link>
      </div>
    </div>
  )
}

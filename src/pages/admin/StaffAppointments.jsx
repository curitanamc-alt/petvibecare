import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Card, Input, Spinner, StatusBadge, cx } from '../../components/ui.jsx'
import { speciesLabel } from '../../lib/species.js'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-show' },
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const fmtDay = (d) => {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return `${DOW[dt.getDay()]}, ${dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
}

const fmtStamp = (s) => {
  if (!s) return '—'
  const x = new Date(s)
  if (Number.isNaN(x.getTime())) return String(s)
  return x.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function StaffAppointments() {
  const [params, setParams] = useSearchParams()
  const [bookings, setBookings] = useState(null)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)

  const status = params.get('status') || ''
  const q = params.get('q') || ''

  const load = () => api.staffBookings().then(setBookings).catch(() => setBookings([]))
  useEffect(() => { load() }, [])

  const setFilter = (k, v) => {
    const sp = new URLSearchParams(params)
    if (v) sp.set(k, v); else sp.delete(k)
    setParams(sp, { replace: true })
  }

  const filtered = useMemo(() => {
    if (!bookings) return []
    const term = q.toLowerCase()
    return bookings.filter((b) => {
      if (status && b.status !== status) return false
      if (term && ![b.owner_name, b.pet_name, b.reference_code, b.service_name].some((v) => v?.toLowerCase().includes(term))) return false
      return true
    })
  }, [bookings, status, q])

  const dateGroups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const groups = {}
    for (const b of filtered) (groups[b.booking_date] ??= []).push(b)
    return Object.keys(groups)
      .sort((a, b) => (a >= today ? (a < b ? -1 : 1) : (b >= today ? 1 : (a > b ? -1 : 1))))
      .map((d) => ({ date: d, isToday: d === today, isPast: d < today, list: groups[d].sort((a, b) => a.booking_time.localeCompare(b.booking_time)) }))
  }, [filtered])

  useEffect(() => {
    if (!filtered.length) { setDetail(null); return }
    if (detail && filtered.some((b) => b.booking_id === detail.booking?.booking_id)) return
    const today = new Date().toISOString().slice(0, 10)
    const next = filtered.find((b) => b.booking_date >= today) || filtered[0]
    openDetail(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  const openDetail = async (b) => {
    const d = await api.staffBooking(b.booking_id)
    setDetail(d)
    api.adminBookingHistory(b.booking_id).then(setHistory).catch(() => {})
  }

  if (!bookings) return <Spinner label="Loading appointments…" />

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">My Appointments</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">View bookings assigned to you. Contact an admin to make changes.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="scrollbar-none -mx-1 flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-sage-200/80 bg-white p-1.5 shadow-card">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key || 'all'}
              type="button"
              onClick={() => setFilter('status', t.key)}
              className={cx(
                'whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                status === t.key ? 'bg-amber-500 text-white shadow-sm' : 'text-charcoal-500 hover:bg-sage-50 hover:text-charcoal-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder="Search ref #, pet, owner…"
            value={q}
            onChange={(e) => setFilter('q', e.target.value)}
            className="w-full pl-10 sm:w-64"
          />
        </div>
        {(status || q) && (
          <button type="button" onClick={() => setParams({}, { replace: true })} className="text-sm font-semibold text-charcoal-400 hover:text-charcoal-600">Clear</button>
        )}
      </div>

      {/* Split view */}
      <div className="grid gap-7 lg:grid-cols-[340px_1fr]">
        {/* Left: date list */}
        <Card className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4">
          {dateGroups.length === 0 ? (
            <div className="p-10 text-center text-sm text-charcoal-400">No appointments match these filters.</div>
          ) : (
            <div className="space-y-5">
              {dateGroups.map((g) => (
                <div key={g.date}>
                  <p className={cx('mb-2 px-3 py-2 text-sm font-bold', g.isToday ? 'text-amber-600' : 'text-charcoal-800')}>
                    {g.isToday ? 'Today' : fmtDay(g.date)}
                    {g.isPast && <span className="ml-1.5 text-[11px] font-medium text-charcoal-300">past</span>}
                  </p>
                  <div className="space-y-1.5">
                    {g.list.map((b) => (
                      <div
                        key={b.booking_id}
                        className={cx(
                          'flex items-center gap-2 rounded-xl border px-2.5 py-3 transition-all duration-200',
                          detail?.booking?.booking_id === b.booking_id
                            ? 'border-teal-600 bg-teal-50 shadow-sm'
                            : 'border-sage-200/80 hover:border-teal-400 hover:bg-sage-50/60',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openDetail(b)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="w-12 shrink-0 text-sm font-bold text-teal-600">{b.booking_time}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-charcoal-900">{b.pet_name}</span>
                            <span className="block truncate text-xs text-charcoal-400">{b.service_name}</span>
                          </span>
                          <StatusBadge status={b.status} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right: detail (view only) */}
        <div className="min-w-0">
          {!detail ? (
            <Card className="grid min-h-[24rem] place-items-center p-10 text-center">
              <div>
                <p className="text-4xl">📅</p>
                <p className="mt-3 text-sm text-charcoal-400">Select an appointment to see its details.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Detail header — no action buttons */}
              <Card className="p-7">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-extrabold text-charcoal-900">{detail.booking.service_name}</h2>
                    <StatusBadge status={detail.booking.status} />
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-teal-600">{detail.booking.reference_code}</p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Pet', lines: [detail.booking.pet_name, `${detail.booking.pet_species ? speciesLabel(detail.booking.pet_species) : ''}${detail.booking.pet_breed ? ` · ${detail.booking.pet_breed}` : ''}`] },
                    { label: 'Owner', lines: [detail.booking.owner_name, `${detail.booking.owner_phone}${detail.booking.owner_email ? ` · ${detail.booking.owner_email}` : ''}`] },
                    { label: 'When', lines: [`${fmtDate(detail.booking.booking_date)} · ${detail.booking.booking_time}`, detail.booking.staff_name || 'You'] },
                  ].map((g) => (
                    <div key={g.label} className="rounded-xl bg-sage-50 px-5 py-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">{g.label}</p>
                      <p className="mt-1.5 font-semibold text-charcoal-900">{g.lines[0]}</p>
                      <p className="truncate text-sm text-charcoal-500">{g.lines[1]}</p>
                    </div>
                  ))}
                </div>

                {detail.booking.notes && (
                  <div className="mt-5 rounded-xl border border-sage-200 px-5 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">Client notes</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-charcoal-600">{detail.booking.notes}</p>
                  </div>
                )}
              </Card>

              {/* Status history */}
              <Card className="p-7">
                <h3 className="font-bold text-charcoal-900">Status history</h3>
                <p className="mt-1 text-xs text-charcoal-400">Audit trail of every status change and notable update.</p>
                <div className="mt-4 space-y-2.5">
                  {(history?.reschedule_requests || []).filter((r) => r.status === 'pending').length > 0 && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4">
                      <p className="text-sm font-bold text-amber-700">Client reschedule requests</p>
                      {(history?.reschedule_requests || []).filter((r) => r.status === 'pending').map((r) => (
                        <div key={r.request_id} className="mt-3 rounded-lg bg-white p-3.5">
                          <p className="text-sm text-charcoal-800">
                            Wants <b>{fmtDate(r.requested_date)} at {r.requested_time}</b>
                          </p>
                          {r.reason && <p className="mt-1 text-xs text-charcoal-400">Reason: {r.reason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {(history?.history || []).length === 0 ? (
                    <p className="text-sm text-charcoal-400">No status changes logged yet.</p>
                  ) : (
                    <div className="space-y-0 divide-y divide-sage-100">
                      {(history?.history || []).map((l) => (
                        <div key={l.log_id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-sm text-charcoal-800">
                              {l.from_status && l.to_status && l.from_status !== l.to_status ? (
                                <><span className="capitalize">{l.from_status}</span> → <span className="font-semibold capitalize">{l.to_status}</span></>
                              ) : (
                                <span className="font-semibold capitalize">{l.to_status || 'Updated'}</span>
                              )}
                            </p>
                            {l.note && <p className="mt-0.5 truncate text-xs text-charcoal-400">{l.note}</p>}
                          </div>
                          <span className="shrink-0 text-xs text-charcoal-400">
                            {l.changed_by_name || l.changed_by_role || '—'} · {fmtStamp(l.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Visit records */}
              <Card className="p-7">
                <h3 className="font-bold text-charcoal-900">Visit records</h3>
                {detail.records.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {detail.records.map((r) => (
                      <div key={r.record_id} className="rounded-xl border border-sage-200 px-5 py-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-charcoal-900">{r.title || r.diagnosis || 'Visit logged'}</p>
                          <span className="text-xs text-charcoal-400">{r.staff_name || 'Staff'} · {fmtDate(r.visit_date)}</span>
                        </div>
                        {r.treatment_notes && <p className="mt-1.5 text-charcoal-600">{r.treatment_notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-charcoal-400">No records logged for this visit yet.</p>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

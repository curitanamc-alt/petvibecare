import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Button, Card, Field, Input, Modal, Select, Spinner, StatusBadge, Textarea, StatusPill, cx } from '../../components/ui.jsx'
import { speciesLabel } from '../../lib/species.js'

const ACTIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  no_show: ['rebooked'],
  rebooked: ['confirmed'],
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-show' },
  { key: 'rebooked', label: 'Rebooked' },
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

export default function Appointments() {
  const [params, setParams] = useSearchParams()
  const [bookings, setBookings] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [services, setServices] = useState([])
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null) // { history: [], reschedule_requests: [] }
  const [assign, setAssign] = useState(null)
  const [resched, setResched] = useState(null)
  const [reschedError, setReschedError] = useState('')
  const [slots, setSlots] = useState({ slots: [], taken: [] })
  const [selected, setSelected] = useState(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [recordForm, setRecordForm] = useState({ visit_date: new Date().toISOString().slice(0, 10), diagnosis: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })

  const status = params.get('status') || ''
  const q = params.get('q') || ''
  const service = params.get('service') || ''
  const date = params.get('date') || ''

  useEffect(() => { api.adminBookings().then(setBookings).catch(() => setBookings([])) }, [])
  useEffect(() => { api.adminStaff().then(setStaffList).catch(() => {}) }, [])
  useEffect(() => { api.services().then(setServices).catch(() => {}) }, [])
  useEffect(() => {
    if (resched?.booking_date) api.slots(resched.booking_date).then(setSlots).catch(() => {})
  }, [resched])

  const setFilter = (k, v) => {
    const sp = new URLSearchParams(params)
    if (v) sp.set(k, v); else sp.delete(k)
    setParams(sp, { replace: true })
  }

  // client-side filtering over the full list
  const filtered = useMemo(() => {
    if (!bookings) return []
    const term = q.toLowerCase()
    return bookings.filter((b) => {
      if (status && b.status !== status) return false
      if (service && String(b.service_id) !== service) return false
      if (date && b.booking_date !== date) return false
      if (term && ![b.owner_name, b.pet_name, b.reference_code, b.service_name].some((v) => v?.toLowerCase().includes(term))) return false
      return true
    })
  }, [bookings, status, q, service, date])

  // group by date — upcoming first, then past
  const dateGroups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const groups = {}
    for (const b of filtered) (groups[b.booking_date] ??= []).push(b)
    return Object.keys(groups)
      .sort((a, b) => (a >= today ? (a < b ? -1 : 1) : (b >= today ? 1 : (a > b ? -1 : 1))))
      .map((d) => ({ date: d, isToday: d === today, isPast: d < today, list: groups[d].sort((a, b) => a.booking_time.localeCompare(b.booking_time)) }))
  }, [filtered])

  // keep a sensible selection when the list changes
  useEffect(() => {
    if (!filtered.length) { setDetail(null); return }
    if (detail && filtered.some((b) => b.booking_id === detail.booking?.booking_id)) return
    const today = new Date().toISOString().slice(0, 10)
    const next = filtered.find((b) => b.booking_date >= today) || filtered[0]
    openDetail(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  const act = async (b, newStatus) => {
    await api.updateBooking(b.booking_id, { status: newStatus })
    if (detail?.booking?.booking_id === b.booking_id) setDetail({ ...detail, booking: { ...detail.booking, status: newStatus } })
    api.adminBookings().then(setBookings).catch(() => {})
    refreshHistory(b.booking_id)
  }

  const openDetail = async (b) => {
    const d = await api.adminBooking(b.booking_id)
    setDetail(d)
    refreshHistory(b.booking_id)
  }

  const refreshHistory = async (bookingId) => {
    api.adminBookingHistory(bookingId).then(setHistory).catch(() => {})
  }

  const addRecord = async () => {
    if (!recordForm.diagnosis && !recordForm.treatment_notes) return
    await api.adminAddRecord(detail.booking.pet_id, {
      ...recordForm,
      booking_id: detail.booking.booking_id,
      weight_at_visit: recordForm.weight_at_visit ? Number(recordForm.weight_at_visit) : null,
      next_due_date: recordForm.next_due_date || null,
    })
    setRecordForm({ visit_date: new Date().toISOString().slice(0, 10), diagnosis: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })
    openDetail(detail.booking)
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const bulkConfirm = async () => {
    setBulkBusy(true)
    try {
      for (const id of selected) {
        const b = bookings.find((x) => x.booking_id === id)
        if (b?.status === 'pending') await api.updateBooking(id, { status: 'confirmed' })
      }
      setSelected(new Set())
      api.adminBookings().then(setBookings).catch(() => {})
      if (selected.has(detail?.booking?.booking_id)) refreshHistory(detail.booking.booking_id)
    } finally { setBulkBusy(false) }
  }

  const handleRescheduleRequest = async (reqId, action) => {
    await api.adminRescheduleRequest(detail.booking.booking_id, reqId, action)
    api.adminBookings().then(setBookings).catch(() => {})
    refreshHistory(detail.booking.booking_id)
  }

  if (!bookings) return <Spinner label="Loading appointments…" />

  const selectedPending = [...selected].filter((id) => bookings.find((b) => b.booking_id === id)?.status === 'pending')

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Appointments</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">Approve, reschedule, or complete bookings. Late arrivals can be marked no-show to free the slot.</p>
      </div>

      {/* ── Filters ── */}
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
        <Select value={service} onChange={(e) => setFilter('service', e.target.value)} className="w-full sm:w-52">
          <option value="">All services</option>
          {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.name}</option>)}
        </Select>
        {(status || q || service || date) && (
          <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Clear</Button>
        )}
      </div>

      {/* ── Bulk action bar ── */}
      {selectedPending.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 px-5 py-3.5 animate-fade-in">
          <p className="text-sm font-semibold text-amber-700">{selectedPending.length} pending selected</p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={bulkConfirm} disabled={bulkBusy}>{bulkBusy ? 'Confirming…' : `✓ Confirm ${selectedPending.length}`}</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {/* ── Split view ── */}
      <div className="grid gap-7 lg:grid-cols-[340px_1fr]">
        {/* Left: date list */}
        <Card className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4">
          {dateGroups.length === 0 ? (
            <div className="p-10 text-center text-sm text-charcoal-400">No appointments match these filters.</div>
          ) : (
            <div className="space-y-5">
              {dateGroups.map((g) => (
                <div key={g.date}>
                  <button
                    type="button"
                    onClick={() => setFilter('date', date === g.date ? '' : g.date)}
                    className={cx(
                      'mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors',
                      date === g.date ? 'bg-amber-50' : 'hover:bg-sage-50',
                    )}
                  >
                    <span className={cx('text-sm font-bold', g.isToday ? 'text-amber-600' : 'text-charcoal-800')}>
                      {g.isToday ? 'Today' : fmtDay(g.date)}
                      {g.isPast && <span className="ml-1.5 text-[11px] font-medium text-charcoal-300">past</span>}
                    </span>
                    <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">{g.list.length}</span>
                  </button>
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
                        <input
                          type="checkbox"
                          checked={selected.has(b.booking_id)}
                          onChange={() => toggleSelect(b.booking_id)}
                          disabled={b.status !== 'pending'}
                          title={b.status === 'pending' ? 'Select for bulk confirm' : 'Only pending bookings can be bulk-confirmed'}
                          className="h-4 w-4 shrink-0 accent-amber-500"
                        />
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

        {/* Right: detail */}
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
              {/* Detail header */}
              <Card className="p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-extrabold text-charcoal-900">{detail.booking.service_name}</h2>
                      <StatusBadge status={detail.booking.status} />
                    </div>
                    <p className="mt-1 font-mono text-sm font-semibold text-teal-600">{detail.booking.reference_code}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {detail.booking.status === 'pending' && (
                      <Button size="sm" onClick={() => act(detail.booking, 'confirmed')}>✓ Confirm</Button>
                    )}
                    {detail.booking.status === 'confirmed' && (
                      <Button size="sm" onClick={() => act(detail.booking, 'completed')}>Complete</Button>
                    )}
                    {ACTIONS[detail.booking.status]?.includes('rebooked') && (
                      <Button size="sm" onClick={() => act(detail.booking, 'rebooked')}>Rebook</Button>
                    )}
                    {['pending', 'confirmed'].includes(detail.booking.status) && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setAssign(detail.booking)}>Staff</Button>
                        <Button variant="outline" size="sm" onClick={() => { setReschedError(''); setResched(detail.booking) }}>Move</Button>
                        <Button variant="danger" size="sm" onClick={() => act(detail.booking, 'no_show')}>No-show</Button>
                      </>
                    )}
                    {ACTIONS[detail.booking.status]?.includes('cancelled') && (
                      <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => act(detail.booking, 'cancelled')}>Cancel</Button>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Pet', lines: [detail.booking.pet_name, `${detail.booking.pet_species ? speciesLabel(detail.booking.pet_species) : ''}${detail.booking.pet_breed ? ` · ${detail.booking.pet_breed}` : ''}${detail.booking.pet_weight ? ` · ${detail.booking.pet_weight} kg` : ''}`] },
                    { label: 'Owner', lines: [detail.booking.owner_name, `${detail.booking.owner_phone}${detail.booking.owner_email ? ` · ${detail.booking.owner_email}` : ''}`] },
                    { label: 'When / staff', lines: [`${fmtDate(detail.booking.booking_date)} · ${detail.booking.booking_time}`, detail.booking.staff_name || 'Unassigned'] },
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

              {/* Status history + reschedule requests */}
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
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" onClick={() => handleRescheduleRequest(r.request_id, 'approve')}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleRescheduleRequest(r.request_id, 'decline')}>Decline</Button>
                          </div>
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

              {/* Records */}
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
                        {r.vaccinations_given && <StatusPill tone="teal" className="mt-2">💉 {r.vaccinations_given}</StatusPill>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-charcoal-400">No records logged for this visit yet.</p>
                )}

                <div className="mt-6 rounded-xl border-2 border-dashed border-sage-200 p-5">
                  <p className="text-sm font-bold text-charcoal-900">Log a record</p>
                  <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                    <Field label="Visit date"><Input type="date" value={recordForm.visit_date} onChange={(e) => setRecordForm({ ...recordForm, visit_date: e.target.value })} /></Field>
                    <Field label="Weight (kg)"><Input type="number" step="0.1" value={recordForm.weight_at_visit} onChange={(e) => setRecordForm({ ...recordForm, weight_at_visit: e.target.value })} /></Field>
                    <div className="sm:col-span-2"><Field label="Diagnosis"><Input value={recordForm.diagnosis} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} /></Field></div>
                    <div className="sm:col-span-2"><Field label="Treatment notes"><Textarea value={recordForm.treatment_notes} onChange={(e) => setRecordForm({ ...recordForm, treatment_notes: e.target.value })} /></Field></div>
                    <Field label="Vaccinations given"><Input value={recordForm.vaccinations_given} onChange={(e) => setRecordForm({ ...recordForm, vaccinations_given: e.target.value })} /></Field>
                    <Field label="Next due date"><Input type="date" value={recordForm.next_due_date} onChange={(e) => setRecordForm({ ...recordForm, next_due_date: e.target.value })} /></Field>
                  </div>
                  <Button size="sm" className="mt-4" onClick={addRecord} disabled={!recordForm.diagnosis && !recordForm.treatment_notes}>Save record</Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Assign staff modal */}
      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Assign staff — ${assign?.reference_code}`}>
        <div className="space-y-3">
          {staffList.map((s) => (
            <button
              key={s.staff_id}
              type="button"
              onClick={async () => {
                await api.adminAssignBooking(assign.booking_id, s.staff_id)
                setAssign(null)
                api.adminBookings().then(setBookings).catch(() => {})
                refreshHistory(assign.booking_id)
              }}
              disabled={!s.active}
              className="flex w-full items-center justify-between rounded-xl border border-sage-200 p-5 text-left transition-all duration-200 hover:border-teal-600 hover:bg-teal-50/50 disabled:opacity-50"
            >
              <span>
                <span className="block font-semibold text-charcoal-900">{s.full_name}</span>
                <span className="text-xs capitalize text-charcoal-400">{s.role}{s.specialization ? ` · ${s.specialization}` : ''} · {s.appointment_count} active bookings</span>
              </span>
              {!s.active && <StatusPill tone="gray">Inactive</StatusPill>}
            </button>
          ))}
        </div>
      </Modal>

      {/* Reschedule modal */}
      <Modal open={!!resched} onClose={() => setResched(null)} title={`Move booking — ${resched?.reference_code}`}>
        {resched && (
          <div className="space-y-6">
            {reschedError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{reschedError}</p>
            )}
            <Field label="New date">
              <Input type="date" min={new Date().toISOString().slice(0, 10)} value={resched.booking_date} onChange={(e) => setResched({ ...resched, booking_date: e.target.value, booking_time: '' })} />
            </Field>
            <Field label="New time">
              <div className="grid grid-cols-4 gap-2.5">
                {slots.slots.map((t) => {
                  const taken = slots.taken.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={taken}
                      onClick={() => setResched({ ...resched, booking_time: t })}
                      className={`rounded-xl border px-2 py-3 text-sm font-semibold transition-all duration-200 ${
                        resched.booking_time === t
                          ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                          : taken
                            ? 'border-sage-200 text-charcoal-300 line-through'
                            : 'border-sage-200 hover:border-teal-600 hover:bg-teal-50'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </Field>
            {resched.staff_name && (
              <p className="text-xs text-charcoal-400">
                Assigned: <b>{resched.staff_name}</b> — staff schedule availability is checked before moving.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setResched(null)}>Cancel</Button>
              <Button
                disabled={!resched.booking_date || !resched.booking_time}
                onClick={async () => {
                  setReschedError('')
                  try {
                    await api.adminRescheduleBooking(resched.booking_id, { booking_date: resched.booking_date, booking_time: resched.booking_time })
                    setResched(null)
                    api.adminBookings().then(setBookings).catch(() => {})
                    refreshHistory(resched.booking_id)
                  } catch (e) {
                    setReschedError(e.message)
                  }
                }}
              >
                Move booking
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

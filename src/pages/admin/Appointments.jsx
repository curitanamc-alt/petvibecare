import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, fmtDate, fmtDateShort } from '../../lib/api.js'
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner, StatusBadge, Textarea } from '../../components/ui.jsx'

const ACTIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  no_show: ['rebooked'],
  rebooked: ['confirmed'],
}

export default function Appointments() {
  const [params, setParams] = useSearchParams()
  const [bookings, setBookings] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [services, setServices] = useState([])
  const [detail, setDetail] = useState(null)
  const [assign, setAssign] = useState(null)
  const [resched, setResched] = useState(null)
  const [slots, setSlots] = useState({ slots: [], taken: [] })
  const [recordForm, setRecordForm] = useState({ visit_date: new Date().toISOString().slice(0, 10), diagnosis: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })

  const status = params.get('status') || ''
  const date = params.get('date') || ''
  const q = params.get('q') || ''

  const load = () => {
    const sp = new URLSearchParams()
    if (status) sp.set('status', status)
    if (date) sp.set('date', date)
    if (q) sp.set('q', q)
    api.adminBookings('?' + sp.toString()).then(setBookings).catch(() => setBookings([]))
  }

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [status, date, q])
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

  const act = async (b, newStatus) => {
    await api.updateBooking(b.booking_id, { status: newStatus })
    if (detail?.booking?.booking_id === b.booking_id) setDetail({ ...detail, booking: { ...detail.booking, status: newStatus } })
    load()
  }

  const openDetail = async (b) => {
    const d = await api.adminBooking(b.booking_id)
    setDetail(d)
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

  if (!bookings) return <Spinner label="Loading appointments…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Appointments</h1>
        <p className="text-sm text-charcoal-400">Approve, reschedule, or complete bookings. Late arrivals can be marked no-show to free the slot.</p>
      </div>

      {/* filters */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Search"><Input placeholder="Name, pet, ref #…" value={q} onChange={(e) => setFilter('q', e.target.value)} className="w-56" /></Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setFilter('status', e.target.value)} className="w-40">
            <option value="">All statuses</option>
            {['pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rebooked'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setFilter('date', e.target.value)} className="w-44" /></Field>
        <Field label="Service">
          <Select value={params.get('service') || ''} onChange={(e) => setFilter('service', e.target.value)} className="w-56">
            <option value="">All services</option>
            {services.map((s) => <option key={s.service_id} value={s.service_id}>{s.name}</option>)}
          </Select>
        </Field>
        {(status || date || q || params.get('service')) && (
          <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
        )}
      </Card>

      {/* table */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-sage-200 bg-sage-50 text-xs font-bold uppercase tracking-wide text-charcoal-400">
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Client / Pet</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-charcoal-400">No appointments match these filters.</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.booking_id} className="border-b border-sage-100 hover:bg-sage-50/50">
                <td className="px-4 py-3 font-mono font-semibold text-teal-600">{b.reference_code}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-charcoal-900">{b.pet_name}</p>
                  <p className="text-xs text-charcoal-400">{b.owner_name} · {b.owner_phone}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-charcoal-900">{b.service_name}</p>
                  <p className="text-xs text-charcoal-400">{b.service_category}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-charcoal-900">{fmtDateShort(b.booking_date)}</p>
                  <p className="text-xs text-charcoal-400">{b.booking_time}</p>
                </td>
                <td className="px-4 py-3">{b.staff_name ? <Badge color="teal">{b.staff_name}</Badge> : <Badge color="amber">Unassigned</Badge>}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => openDetail(b)}>View</Button>
                    {b.status === 'pending' && <Button size="sm" onClick={() => act(b, 'confirmed')}>Confirm</Button>}
                    {b.status === 'confirmed' && <Button size="sm" onClick={() => act(b, 'completed')}>Complete</Button>}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setAssign(b)}>Staff</Button>
                        <Button variant="outline" size="sm" onClick={() => setResched(b)}>Move</Button>
                        <Button variant="danger" size="sm" onClick={() => act(b, 'no_show')}>No-show</Button>
                      </>
                    )}
                    {ACTIONS[b.status]?.includes('cancelled') && <Button variant="ghost" size="sm" className="text-red-500" onClick={() => act(b, 'cancelled')}>Cancel</Button>}
                    {ACTIONS[b.status]?.includes('rebooked') && <Button size="sm" onClick={() => act(b, 'rebooked')}>Rebook</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail?.booking?.reference_code} — ${detail?.booking?.service_name}`} wide>
        {detail && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-sage-50 p-4">
                <p className="text-xs font-bold uppercase text-charcoal-400">Client</p>
                <p className="mt-1 font-semibold text-charcoal-900">{detail.booking.owner_name}</p>
                <p className="text-sm text-charcoal-400">{detail.booking.owner_phone}</p>
                <p className="text-xs text-charcoal-400">{detail.booking.owner_email}</p>
              </div>
              <div className="rounded-xl bg-sage-50 p-4">
                <p className="text-xs font-bold uppercase text-charcoal-400">Pet</p>
                <p className="mt-1 font-semibold text-charcoal-900">{detail.booking.pet_name}</p>
                <p className="text-sm text-charcoal-400">{detail.booking.pet_species} · {detail.booking.pet_breed} · {detail.booking.pet_weight ? `${detail.booking.pet_weight} kg` : ''}</p>
              </div>
              <div className="rounded-xl bg-sage-50 p-4">
                <p className="text-xs font-bold uppercase text-charcoal-400">When / staff</p>
                <p className="mt-1 font-semibold text-charcoal-900">{fmtDate(detail.booking.booking_date)} · {detail.booking.booking_time}</p>
                <p className="text-sm text-charcoal-400">{detail.booking.staff_name || 'Unassigned'} · <StatusBadge status={detail.booking.status} /></p>
              </div>
            </div>
            {detail.booking.notes && (
              <div className="rounded-xl border border-sage-200 p-4">
                <p className="text-xs font-bold uppercase text-charcoal-400">Client notes</p>
                <p className="mt-1 text-sm text-charcoal-600">{detail.booking.notes}</p>
              </div>
            )}

            {detail.records.length > 0 && (
              <div>
                <p className="text-sm font-bold text-charcoal-900">Medical records on this visit</p>
                <div className="mt-2 space-y-2">
                  {detail.records.map((r) => (
                    <div key={r.record_id} className="rounded-xl border border-sage-200 p-3 text-sm">
                      <p className="font-semibold text-charcoal-900">{r.diagnosis || 'Visit logged'}</p>
                      {r.treatment_notes && <p className="text-charcoal-600">{r.treatment_notes}</p>}
                      <p className="mt-1 text-xs text-charcoal-400">{r.staff_name || 'Staff'} · {fmtDate(r.visit_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-sage-200 p-4">
              <p className="text-sm font-bold text-charcoal-900">Log medical record</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Visit date"><Input type="date" value={recordForm.visit_date} onChange={(e) => setRecordForm({ ...recordForm, visit_date: e.target.value })} /></Field>
                <Field label="Weight at visit (kg)"><Input type="number" step="0.1" value={recordForm.weight_at_visit} onChange={(e) => setRecordForm({ ...recordForm, weight_at_visit: e.target.value })} /></Field>
                <Field label="Diagnosis"><Input value={recordForm.diagnosis} onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })} /></Field>
                <Field label="Vaccinations given"><Input value={recordForm.vaccinations_given} onChange={(e) => setRecordForm({ ...recordForm, vaccinations_given: e.target.value })} /></Field>
                <div className="sm:col-span-2"><Field label="Treatment notes"><Textarea value={recordForm.treatment_notes} onChange={(e) => setRecordForm({ ...recordForm, treatment_notes: e.target.value })} /></Field></div>
                <Field label="Next due date"><Input type="date" value={recordForm.next_due_date} onChange={(e) => setRecordForm({ ...recordForm, next_due_date: e.target.value })} /></Field>
              </div>
              <Button size="sm" className="mt-3" onClick={addRecord} disabled={!recordForm.diagnosis && !recordForm.treatment_notes}>Save record</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* assign staff modal */}
      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Assign staff — ${assign?.reference_code}`}>
        <div className="space-y-3">
          {staffList.map((s) => (
            <button
              key={s.staff_id}
              type="button"
              onClick={async () => {
                await api.updateBooking(assign.booking_id, { staff_id: s.staff_id })
                setAssign(null)
                load()
              }}
              disabled={!s.active}
              className="flex w-full items-center justify-between rounded-xl border border-sage-200 p-4 text-left hover:border-teal-600 disabled:opacity-50"
            >
              <span>
                <span className="block font-semibold text-charcoal-900">{s.full_name}</span>
                <span className="text-xs capitalize text-charcoal-400">{s.role}{s.specialization ? ` · ${s.specialization}` : ''} · {s.appointment_count} active bookings</span>
              </span>
              {!s.active && <Badge color="gray">Inactive</Badge>}
            </button>
          ))}
        </div>
      </Modal>

      {/* reschedule modal */}
      <Modal open={!!resched} onClose={() => setResched(null)} title={`Move booking — ${resched?.reference_code}`}>
        {resched && (
          <div className="space-y-4">
            <Field label="New date">
              <Input type="date" min={new Date().toISOString().slice(0, 10)} value={resched.booking_date} onChange={(e) => setResched({ ...resched, booking_date: e.target.value, booking_time: '' })} />
            </Field>
            <Field label="New time">
              <div className="grid grid-cols-4 gap-2">
                {slots.slots.map((t) => {
                  const taken = slots.taken.includes(t)
                  return (
                    <button key={t} type="button" disabled={taken} onClick={() => setResched({ ...resched, booking_time: t })}
                      className={`rounded-lg border px-2 py-2 text-sm font-semibold ${resched.booking_time === t ? 'border-teal-600 bg-teal-600 text-white' : taken ? 'border-sage-200 text-charcoal-400 line-through' : 'border-sage-200 hover:border-teal-600'}`}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResched(null)}>Cancel</Button>
              <Button disabled={!resched.booking_date || !resched.booking_time} onClick={async () => {
                await api.updateBooking(resched.booking_id, { booking_date: resched.booking_date, booking_time: resched.booking_time })
                setResched(null)
                load()
              }}>Move booking</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

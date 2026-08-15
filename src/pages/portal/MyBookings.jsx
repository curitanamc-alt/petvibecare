import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, StatusBadge } from '../../components/ui.jsx'

const SLOT_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const fmtStamp = (s) => {
  if (!s) return '—'
  const x = new Date(s)
  if (Number.isNaN(x.getTime())) return String(s)
  return x.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MyBookings() {
  const [bookings, setBookings] = useState(null)
  const [tab, setTab] = useState('upcoming')
  const [resched, setResched] = useState(null)
  const [reschedForm, setReschedForm] = useState({ requested_date: '', requested_time: '', reason: '' })
  const [reschedError, setReschedError] = useState('')
  const [reschedBusy, setReschedBusy] = useState(false)
  const [historyFor, setHistoryFor] = useState(null)
  const [historyData, setHistoryData] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = () => api.myBookings().then(setBookings).catch(() => setBookings([]))
  useEffect(() => { load() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const { upcoming, past } = useMemo(() => {
    if (!bookings) return { upcoming: [], past: [] }
    const future = bookings.filter((b) => b.booking_date >= today)
    return { upcoming: future, past: bookings.filter((b) => !future.includes(b)) }
  }, [bookings, today])

  const list = tab === 'upcoming' ? upcoming : past

  const openResched = (b) => {
    setResched(b)
    setReschedForm({ requested_date: '', requested_time: '', reason: '' })
    setReschedError('')
  }

  const submitResched = async () => {
    setReschedBusy(true)
    setReschedError('')
    try {
      await api.requestReschedule(resched.booking_id, reschedForm)
      setResched(null)
      load()
    } catch (e) {
      setReschedError(e.message)
    } finally { setReschedBusy(false) }
  }

  const cancel = async (b) => {
    if (!window.confirm(`Cancel ${b.service_name} for ${fmtDate(b.booking_date)} at ${b.booking_time}?\nThis frees the slot for other clients.`)) return
    setBusyId(b.booking_id)
    try {
      await api.cancelBooking(b.booking_id)
      load()
    } finally { setBusyId(null) }
  }

  const openHistory = async (b) => {
    setHistoryFor(b)
    setHistoryData(null)
    api.bookingHistory(b.booking_id).then(setHistoryData).catch(() => setHistoryData({ history: [], reschedule_requests: [] }))
  }

  if (!bookings) return <Spinner />

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">My Bookings</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">Track status and reference numbers for every appointment.</p>
      </div>

      <div className="flex gap-1.5 rounded-xl bg-white p-1.5 shadow-card">
        {['upcoming', 'past'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-6 py-3 text-sm font-semibold capitalize transition-all duration-200 ${
              tab === t ? 'bg-teal-600 text-white shadow-sm' : 'text-charcoal-400 hover:text-teal-600 hover:bg-sage-50'
            }`}
          >
            {t} ({t === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'} icon="📅">
          {tab === 'upcoming' ? (
            <>
              <Link to="/book" className="font-semibold text-teal-600 hover:underline">Book an appointment</Link> to see it here.
            </>
          ) : (
            'Past visits will appear here.'
          )}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {list.map((b) => (
            <Card key={b.booking_id} className="p-7 transition-all duration-300 hover:shadow-card-hover">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-bold text-charcoal-900">{b.service_name}</p>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-charcoal-500">
                    {b.pet_name} · {fmtDate(b.booking_date)} at {b.booking_time}
                  </p>
                  <p className="mt-2 text-xs text-charcoal-400">
                    Ref: <span className="font-mono font-semibold text-teal-600">{b.reference_code}</span>
                    {b.staff_name && <> · Assigned: {b.staff_name}</>}
                  </p>
                  {b.status === 'confirmed' && (
                    <p className="mt-2 text-xs font-semibold text-amber-500">Arrive on time — slot held 20–30 min</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tab === 'upcoming' && ['pending', 'confirmed'].includes(b.status) && (
                    <Button variant="outline" size="sm" onClick={() => openResched(b)}>Request reschedule</Button>
                  )}
                  {tab === 'upcoming' && ['pending', 'confirmed'].includes(b.status) && (
                    <Button variant="danger" size="sm" onClick={() => cancel(b)} disabled={busyId === b.booking_id}>
                      {busyId === b.booking_id ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openHistory(b)}>History</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reschedule request modal */}
      <Modal open={!!resched} onClose={() => setResched(null)} title={`Request reschedule — ${resched?.reference_code}`}>
        {resched && (
          <div className="space-y-6">
            <p className="text-sm text-charcoal-500 leading-relaxed">
              Submit a request for <b>{fmtDate(resched.booking_date)} at {resched.booking_time}</b>. Staff will review and approve it — your slot only changes once approved.
            </p>
            {reschedError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{reschedError}</p>
            )}
            <Field label="Preferred date">
              <Input type="date" min={today} value={reschedForm.requested_date} onChange={(e) => setReschedForm({ ...reschedForm, requested_date: e.target.value })} />
            </Field>
            <Field label="Preferred time">
              <Select value={reschedForm.requested_time} onChange={(e) => setReschedForm({ ...reschedForm, requested_time: e.target.value })}>
                <option value="">Select a time…</option>
                {SLOT_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Reason (optional)">
              <Input value={reschedForm.reason} onChange={(e) => setReschedForm({ ...reschedForm, reason: e.target.value })} placeholder="e.g. Work conflict" />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setResched(null)}>Cancel</Button>
              <Button onClick={submitResched} disabled={reschedBusy || !reschedForm.requested_date || !reschedForm.requested_time}>
                {reschedBusy ? 'Submitting…' : 'Submit request'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Status history modal */}
      <Modal open={!!historyFor} onClose={() => setHistoryFor(null)} title={`History — ${historyFor?.reference_code}`} wide>
        <div className="space-y-5">
          {(historyData?.reschedule_requests || []).filter((r) => r.status === 'pending').length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-700">⏳ Pending reschedule request</p>
              {(historyData?.reschedule_requests || []).filter((r) => r.status === 'pending').map((r) => (
                <p key={r.request_id} className="mt-1.5 text-sm text-charcoal-700">
                  You asked to move to <b>{fmtDate(r.requested_date)} at {r.requested_time}</b> — staff hasn't reviewed it yet.
                </p>
              ))}
            </div>
          )}
          {!historyData ? (
            <p className="py-10 text-center text-sm text-charcoal-400">Loading…</p>
          ) : (historyData.history || []).length === 0 ? (
            <p className="py-10 text-center text-sm text-charcoal-400">No status changes logged yet.</p>
          ) : (
            <div className="divide-y divide-sage-100">
              {(historyData.history || []).map((l) => (
                <div key={l.log_id} className="flex flex-wrap items-baseline justify-between gap-2 py-3.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm text-charcoal-800">
                      {l.from_status && l.to_status && l.from_status !== l.to_status ? (
                        <><span className="capitalize">{l.from_status}</span> → <span className="font-semibold capitalize">{l.to_status}</span></>
                      ) : (
                        <span className="font-semibold capitalize">{l.to_status || 'Updated'}</span>
                      )}
                    </p>
                    {l.note && <p className="mt-0.5 text-xs text-charcoal-400">{l.note}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-charcoal-400">{fmtStamp(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PetPhoto, Select, Spinner, StatusBadge, StatusPill } from '../../components/ui.jsx'
import MedicalReportPrint from '../../components/MedicalReportPrint.jsx'
import { speciesLabel } from '../../lib/species.js'

const petAge = (birthdate) => {
  if (!birthdate) return null
  const b = new Date(birthdate + 'T00:00:00')
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months -= 1
  if (months < 0) return '—'
  if (months < 12) return `${months} mo`
  const y = Math.floor(months / 12)
  return `${y} yr${y > 1 ? 's' : ''}`
}

const RECORD_TYPES = [
  { value: 'vaccination', label: '💉 Vaccination' },
  { value: 'checkup', label: '🩺 Check-up' },
  { value: 'surgery', label: '⚕️ Surgery' },
  { value: 'grooming', label: '✂️ Grooming' },
  { value: 'other', label: '📋 Other' },
]
const TYPE_TONE = { vaccination: 'teal', checkup: 'green', surgery: 'amber', grooming: 'blue', other: 'gray' }

const emptyForm = () => ({ visit_date: new Date().toISOString().slice(0, 10), type: 'checkup', title: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })

const dueTone = (due) => {
  if (!due) return null
  const today = new Date().toISOString().slice(0, 10)
  if (due < today) return { tone: 'red', label: 'Overdue' }
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  if (due <= in30.toISOString().slice(0, 10)) return { tone: 'amber', label: 'Due soon' }
  return { tone: 'teal', label: 'On track' }
}

export default function AdminPetDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [editRec, setEditRec] = useState(null) // medical record being edited
  const [editForm, setEditForm] = useState(emptyForm())
  const [busy, setBusy] = useState(false)

  const load = () => api.adminPet(id).then(setData).catch(() => setData(null))
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  // booking status per reference code, for the records table
  const statusByRef = useMemo(() => {
    const m = {}
    for (const b of data?.bookings || []) m[b.reference_code] = b.status
    return m
  }, [data])

  if (!data) return <Spinner label="Loading pet…" />

  const { pet, records, bookings } = data

  const addRecord = async () => {
    if (!form.title && !form.treatment_notes) return
    setBusy(true)
    try {
      await api.adminAddRecord(pet.pet_id, {
        ...form,
        weight_at_visit: form.weight_at_visit ? Number(form.weight_at_visit) : null,
        next_due_date: form.next_due_date || null,
      })
      setForm(emptyForm())
      load()
    } finally { setBusy(false) }
  }

  const openEdit = (r) => {
    setEditForm({
      visit_date: r.visit_date,
      type: r.type || 'checkup',
      title: r.title || '',
      treatment_notes: r.treatment_notes || '',
      vaccinations_given: r.vaccinations_given || '',
      weight_at_visit: r.weight_at_visit ?? '',
      next_due_date: r.next_due_date || '',
    })
    setEditRec(r)
  }

  const saveEdit = async () => {
    setBusy(true)
    try {
      await api.adminUpdateRecord(editRec.record_id, {
        visit_date: editForm.visit_date,
        type: editForm.type,
        title: editForm.title,
        notes: editForm.treatment_notes,
        vaccinations_given: editForm.vaccinations_given,
        weight_at_visit: editForm.weight_at_visit ? Number(editForm.weight_at_visit) : null,
        next_due_date: editForm.next_due_date || null,
      })
      setEditRec(null)
      load()
    } finally { setBusy(false) }
  }

  const deleteRecord = async (r) => {
    if (!window.confirm(`Delete “${r.title || 'this record'}” from ${pet.name}'s history?`)) return
    await api.adminDeleteRecord(r.record_id)
    load()
  }

  return (
    <div className="space-y-7">
      <Link to="/admin/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        All pets
      </Link>

      <div className="grid gap-7 lg:grid-cols-[360px_1fr]">
        {/* ── Left column: profile + owner ── */}
        <div className="space-y-7">
          <Card className="p-7">
            <div className="flex items-center gap-5">
              <PetPhoto photoUrl={pet.photo_url} size="xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-charcoal-900">{pet.name}</h1>
                  <Badge color={pet.account_type === 'walk_in' ? 'amber' : 'teal'}>
                    {pet.account_type === 'walk_in' ? 'Walk-in client' : 'Registered'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-charcoal-500">{speciesLabel(pet.species)}{pet.breed ? ` · ${pet.breed}` : ''}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                { label: 'Age', value: petAge(pet.birthdate) },
                { label: 'Date of birth', value: pet.birthdate ? fmtDate(pet.birthdate) : '—' },
                { label: 'Weight', value: pet.weight_kg ? `${pet.weight_kg} kg` : '—' },
                { label: 'Gender', value: pet.gender ? pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1) : '—' },
              ].map((f) => (
                <div key={f.label} className="rounded-xl bg-sage-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">{f.label}</p>
                  <p className="mt-1 text-sm font-semibold text-charcoal-900">{f.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-7">
            <h2 className="font-bold text-charcoal-900">Owner</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Name</p>
                <p className="mt-0.5 font-semibold text-charcoal-900">
                  <Link to={`/admin/clients/${pet.owner_id}`} className="text-teal-600 hover:underline">{pet.owner_name}</Link>
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Mobile</p>
                <p className="mt-0.5 text-charcoal-600">{pet.owner_phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Email</p>
                <p className="mt-0.5 break-all text-charcoal-600">{pet.owner_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">On file since</p>
                <p className="mt-0.5 text-charcoal-600">{pet.created_at ? fmtDate(pet.created_at.slice(0, 10)) : '—'}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right column: medical history ── */}
        <div className="min-w-0 space-y-7">
          <Card className="p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-charcoal-900">Medical records</h2>
                <p className="mt-1 text-xs text-charcoal-400">{records.length} record{records.length === 1 ? '' : 's'} on file</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="green">{bookings.length} visits</StatusPill>
                <Button variant="outline" size="sm" onClick={() => window.print()}>🖨️ Print / PDF</Button>
              </div>
            </div>

            {records.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="No records yet" icon="📋">Log the first visit below.</EmptyState>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {records.map((r) => {
                  const due = dueTone(r.next_due_date)
                  const st = statusByRef[r.reference_code]
                  return (
                    <div key={r.record_id} className="rounded-xl border border-sage-200 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-charcoal-900">{r.title || r.service_name || r.diagnosis || 'Visit'}</p>
                            {r.type && <Badge color={TYPE_TONE[r.type] || 'gray'}>{r.type}</Badge>}
                            {r.vaccinations_given && <Badge color="teal">💉 {r.vaccinations_given}</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-charcoal-400">{fmtDate(r.visit_date)} · {r.staff_name || 'Staff'}{r.reference_code ? ` · ${r.reference_code}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openEdit(r)} title="Edit record" className="rounded-lg p-2 text-charcoal-400 transition-colors hover:bg-sage-100 hover:text-teal-700">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                          </button>
                          <button type="button" onClick={() => deleteRecord(r)} title="Delete record" className="rounded-lg p-2 text-charcoal-400 transition-colors hover:bg-red-50 hover:text-red-500">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                          </button>
                        </div>
                      </div>
                      {r.diagnosis && r.title !== r.diagnosis && <p className="mt-2 text-sm font-medium text-charcoal-700">{r.diagnosis}</p>}
                      {r.treatment_notes && <p className="mt-1 text-sm text-charcoal-600 leading-relaxed">{r.treatment_notes}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-charcoal-400">
                        {r.weight_at_visit && <span>Weight: {r.weight_at_visit} kg</span>}
                        {due && <Badge color={due.tone}>{due.label} · due {fmtDate(r.next_due_date)}</Badge>}
                        {st ? <StatusBadge status={st} /> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-7">
            <h2 className="font-bold text-charcoal-900">Add medical record</h2>
            <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
              <Field label="Record date"><Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} /></Field>
              <Field label="Type">
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {RECORD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2"><Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 5-in-1 booster" /></Field></div>
              <div className="sm:col-span-2"><Field label="Notes"><Input value={form.treatment_notes} onChange={(e) => setForm({ ...form, treatment_notes: e.target.value })} placeholder="Findings, treatment given…" /></Field></div>
              <Field label="Vaccinations given"><Input value={form.vaccinations_given} onChange={(e) => setForm({ ...form, vaccinations_given: e.target.value })} /></Field>
              <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight_at_visit} onChange={(e) => setForm({ ...form, weight_at_visit: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Next due date" hint="Set for vaccines or follow-ups so due dates get flagged."><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></Field></div>
            </div>
            <Button className="mt-5" onClick={addRecord} disabled={busy || (!form.title && !form.treatment_notes)}>Save record</Button>
          </Card>

          {/* ── Visit history ── */}
          <Card className="p-7">
            <h2 className="font-bold text-charcoal-900">Visit history ({bookings.length})</h2>
            {bookings.length === 0 ? (
              <p className="mt-4 text-sm text-charcoal-400">No bookings for this pet yet.</p>
            ) : (
              <div className="mt-5 divide-y divide-sage-100">
                {bookings.map((b) => (
                  <div key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-charcoal-900">
                        {b.service_name} <span className="ml-1 font-mono text-xs text-teal-600">{b.reference_code}</span>
                      </p>
                      <p className="text-xs text-charcoal-400">{fmtDate(b.booking_date)} · {b.booking_time} · {b.staff_name || 'unassigned'} · by {b.created_by}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Print-only medical report — shown by the browser's print dialog */}
      <div className="print-area hidden print:block">
        <MedicalReportPrint
          pet={pet}
          records={records}
          generatedAt={new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
        />
      </div>

      {/* Edit record modal */}
      <Modal open={!!editRec} onClose={() => setEditRec(null)} title="Edit medical record">
        <div className="space-y-5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Record date"><Input type="date" value={editForm.visit_date} onChange={(e) => setEditForm({ ...editForm, visit_date: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                {RECORD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Title"><Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notes"><Input value={editForm.treatment_notes} onChange={(e) => setEditForm({ ...editForm, treatment_notes: e.target.value })} /></Field></div>
            <Field label="Vaccinations given"><Input value={editForm.vaccinations_given} onChange={(e) => setEditForm({ ...editForm, vaccinations_given: e.target.value })} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={editForm.weight_at_visit} onChange={(e) => setEditForm({ ...editForm, weight_at_visit: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Next due date"><Input type="date" value={editForm.next_due_date} onChange={(e) => setEditForm({ ...editForm, next_due_date: e.target.value })} /></Field></div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditRec(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

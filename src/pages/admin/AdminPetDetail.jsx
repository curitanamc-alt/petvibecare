import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Button, Card, EmptyState, Field, Input, Spinner, StatusBadge, Textarea } from '../../components/ui.jsx'

export default function AdminPetDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ visit_date: new Date().toISOString().slice(0, 10), diagnosis: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })

  const load = () => api.adminPet(id).then(setData).catch(() => setData(null))
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  if (!data) return <Spinner label="Loading pet…" />

  const { pet, records, bookings } = data

  const addRecord = async () => {
    if (!form.diagnosis && !form.treatment_notes) return
    await api.adminAddRecord(pet.pet_id, { ...form, weight_at_visit: form.weight_at_visit ? Number(form.weight_at_visit) : null, next_due_date: form.next_due_date || null })
    setForm({ visit_date: new Date().toISOString().slice(0, 10), diagnosis: '', treatment_notes: '', vaccinations_given: '', weight_at_visit: '', next_due_date: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/pets" className="text-sm font-semibold text-teal-600 hover:underline">← All pets</Link>

      <Card className="flex flex-wrap items-center gap-5 p-6">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-sage-100 text-4xl">{pet.species === 'cat' ? '🐱' : '🐶'}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-charcoal-900">{pet.name}</h1>
            <Badge color={pet.account_type === 'walk_in' ? 'amber' : 'teal'}>{pet.account_type === 'walk_in' ? 'Walk-in client' : 'Registered'}</Badge>
          </div>
          <p className="text-sm text-charcoal-400">{pet.breed || pet.species} · {pet.gender} · {pet.weight_kg ? `${pet.weight_kg} kg` : 'weight n/a'}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-charcoal-900">{pet.owner_name}</p>
          <p className="text-charcoal-400">{pet.owner_phone}</p>
          <p className="text-xs text-charcoal-400">{pet.owner_email}</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* records */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Medical history</h2>
          {records.length === 0 ? (
            <div className="mt-4"><EmptyState title="No records yet" icon="📋">Log the first visit below.</EmptyState></div>
          ) : (
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
              {records.map((r) => (
                <div key={r.record_id} className="rounded-xl border border-sage-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-charcoal-900">{r.diagnosis || 'Visit logged'}</p>
                    <span className="text-xs text-charcoal-400">{fmtDate(r.visit_date)}{r.reference_code ? ` · ${r.reference_code}` : ''}</span>
                  </div>
                  {r.treatment_notes && <p className="mt-1 text-sm text-charcoal-600">{r.treatment_notes}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-charcoal-400">
                    {r.vaccinations_given && <Badge color="teal">💉 {r.vaccinations_given}</Badge>}
                    {r.weight_at_visit && <span>Weight: {r.weight_at_visit} kg</span>}
                    {r.staff_name && <span>By: {r.staff_name}</span>}
                    {r.next_due_date && <span>Next due: <b className="text-teal-600">{fmtDate(r.next_due_date)}</b></span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* add record */}
        <Card className="p-6">
          <h2 className="font-bold text-charcoal-900">Add visit record</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Visit date"><Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight_at_visit} onChange={(e) => setForm({ ...form, weight_at_visit: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Diagnosis"><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Treatment notes"><Textarea value={form.treatment_notes} onChange={(e) => setForm({ ...form, treatment_notes: e.target.value })} /></Field></div>
            <Field label="Vaccinations given"><Input value={form.vaccinations_given} onChange={(e) => setForm({ ...form, vaccinations_given: e.target.value })} /></Field>
            <Field label="Next due date"><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></Field>
          </div>
          <Button className="mt-4" onClick={addRecord} disabled={!form.diagnosis && !form.treatment_notes}>Save record</Button>
        </Card>
      </div>

      {/* bookings */}
      <Card className="p-6">
        <h2 className="font-bold text-charcoal-900">Visit history ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal-400">No bookings for this pet yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-sage-200">
            {bookings.map((b) => (
              <div key={b.booking_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-charcoal-900">{b.service_name} <span className="ml-1 font-mono text-xs text-teal-600">{b.reference_code}</span></p>
                  <p className="text-xs text-charcoal-400">{fmtDate(b.booking_date)} · {b.booking_time} · {b.staff_name || 'unassigned'} · by {b.created_by}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

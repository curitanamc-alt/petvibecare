import { useEffect, useState } from 'react'
import { api, fmtMoney } from '../../lib/api.js'
import { Button, Card, Field, Input, Select, Textarea } from '../../components/ui.jsx'

const empty = {
  owner: { full_name: '', phone: '', address: '' },
  pet: { name: '', species: 'dog', breed: '', gender: 'female', weight_kg: '' },
  booking: { service_id: '', booking_date: new Date().toISOString().slice(0, 10), booking_time: '', staff_id: '', notes: '' },
}

export default function WalkIn() {
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [slots, setSlots] = useState({ slots: [], taken: [] })
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    Promise.all([api.services(), api.adminStaff()])
      .then(([s, st]) => { setServices(s); setStaff(st.filter((x) => x.active)) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (form.booking.booking_date) api.slots(form.booking.booking_date).then(setSlots).catch(() => {})
  }, [form.booking.booking_date])

  const set = (section, key) => (e) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: e.target.value } }))

  const submit = async () => {
    if (!form.owner.full_name || !form.owner.phone || !form.pet.name || !form.booking.service_id || !form.booking.booking_date || !form.booking.booking_time) {
      setError('Fill in the owner, pet, and booking details (service, date, time).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await api.adminWalkIn({
        owner: { ...form.owner },
        pet: { ...form.pet, weight_kg: form.pet.weight_kg ? Number(form.pet.weight_kg) : null },
        booking: { ...form.booking, service_id: Number(form.booking.service_id), staff_id: form.booking.staff_id ? Number(form.booking.staff_id) : null },
      })
      setResult(r)
      setForm(empty)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Walk-in / Emergency registration</h1>
        <p className="text-sm text-charcoal-400">Create a client profile, pet, and booking on the spot — no account or login needed. Perfect for ER cases that can't wait.</p>
      </div>

      {result && (
        <div className="rounded-2xl border border-teal-600/30 bg-teal-50 p-5">
          <p className="font-bold text-teal-700">✓ Walk-in registered — {result.reference_code}</p>
          <p className="mt-1 text-sm text-teal-700/80">Owner #{result.owner_id}, pet #{result.pet_id}, booking #{result.booking_id}. Find it under Appointments.</p>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      <Card className="p-6">
        <h2 className="font-bold text-charcoal-900">1 · Owner</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Full name *"><Input value={form.owner.full_name} onChange={set('owner', 'full_name')} placeholder="Walk-in client" /></Field>
          <Field label="Phone *"><Input value={form.owner.phone} onChange={set('owner', 'phone')} placeholder="0917 000 0000" /></Field>
          <Field label="Address"><Input value={form.owner.address} onChange={set('owner', 'address')} placeholder="City / barangay" /></Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-charcoal-900">2 · Pet</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Name *"><Input value={form.pet.name} onChange={set('pet', 'name')} placeholder="Rex" /></Field>
          <Field label="Species">
            <Select value={form.pet.species} onChange={set('pet', 'species')}>
              <option value="dog">Dog</option><option value="cat">Cat</option><option value="bird">Bird</option><option value="rabbit">Rabbit</option><option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Breed"><Input value={form.pet.breed} onChange={set('pet', 'breed')} placeholder="Aspin" /></Field>
          <Field label="Gender">
            <Select value={form.pet.gender} onChange={set('pet', 'gender')}>
              <option value="female">Female</option><option value="male">Male</option>
            </Select>
          </Field>
          <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.pet.weight_kg} onChange={set('pet', 'weight_kg')} /></Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-charcoal-900">3 · Booking</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Service *" hint="Includes admin-only services like surgery, confinement, and emergency care.">
              <Select value={form.booking.service_id} onChange={set('booking', 'service_id')}>
                <option value="">Select service…</option>
                {services.map((s) => (
                  <option key={s.service_id} value={s.service_id}>{s.name} — {fmtMoney(s)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Date *"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={form.booking.booking_date} onChange={set('booking', 'booking_date')} /></Field>
          <Field label="Time *">
            <div className="grid grid-cols-4 gap-1.5">
              {slots.slots.map((t) => {
                const taken = slots.taken.includes(t)
                return (
                  <button key={t} type="button" disabled={taken} onClick={() => setForm((f) => ({ ...f, booking: { ...f.booking, booking_time: t } }))}
                    className={`rounded-md border px-1 py-1.5 text-xs font-semibold ${form.booking.booking_time === t ? 'border-teal-600 bg-teal-600 text-white' : taken ? 'border-sage-200 text-charcoal-400 line-through' : 'border-sage-200 hover:border-teal-600'}`}>
                    {t}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Assign staff (optional)">
              <Select value={form.booking.staff_id} onChange={set('booking', 'staff_id')}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.role})</option>)}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes"><Textarea value={form.booking.notes} onChange={set('booking', 'notes')} placeholder="Symptom notes, ER context…" /></Field>
          </div>
        </div>
        <Button variant="accent" className="mt-4" onClick={submit} disabled={busy}>{busy ? 'Registering…' : 'Register walk-in & book'}</Button>
      </Card>
    </div>
  )
}

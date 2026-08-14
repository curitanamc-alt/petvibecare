import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { api, fmtMoney, fmtDate } from '../lib/api.js'
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'

const STEPS = ['Date & time', 'Service', 'Pet', 'Confirm']

const emptyPet = { name: '', species: 'dog', breed: '', gender: 'female', birthdate: '', weight_kg: '' }

export default function Book() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preselect = Number(params.get('service')) || null

  const [step, setStep] = useState(0)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState({ slots: [], taken: [] })
  const [services, setServices] = useState([])
  const [serviceId, setServiceId] = useState(preselect)
  const [pets, setPets] = useState([])
  const [petId, setPetId] = useState(null)
  const [addingPet, setAddingPet] = useState(false)
  const [newPet, setNewPet] = useState(emptyPet)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.services('?bookable=1').then(setServices).catch(() => {})
  }, [])

  useEffect(() => {
    if (user && role === 'client') api.myPets().then((d) => { setPets(d.pets); if (!petId && d.pets.length) setPetId(d.pets[0].pet_id) }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (date) api.slots(date).then(setSlots).catch(() => setSlots({ slots: [], taken: [] }))
  }, [date])

  const selectedService = useMemo(() => services.find((s) => s.service_id === serviceId) || null, [services, serviceId])

  // ---------- login gate ----------
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-3 text-2xl font-extrabold text-charcoal-900">Log in to book an appointment</h1>
          <p className="mt-2 text-sm text-charcoal-400">
            Online booking is available to registered clients. Walk-in and emergency clients are assisted directly at the clinic counter.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/login?next=/book')}>Log in</Button>
            <Button variant="outline" onClick={() => navigate('/register')}>Create account</Button>
          </div>
        </Card>
      </div>
    )
  }
  if (role !== 'client') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="p-8 text-center">
          <p className="text-4xl">🩺</p>
          <h1 className="mt-3 text-xl font-extrabold text-charcoal-900">You're signed in as staff</h1>
          <p className="mt-2 text-sm text-charcoal-400">Staff create bookings from the admin dashboard instead.</p>
          <Button className="mt-6" onClick={() => navigate('/admin')}>Go to dashboard</Button>
        </Card>
      </div>
    )
  }

  // ---------- success screen ----------
  if (result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0a4d52" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-charcoal-900">Booking confirmed!</h1>
          <p className="mt-1 text-sm text-charcoal-400">A confirmation email is on its way to {user.email}.</p>
          <div className="mt-5 rounded-xl bg-sage-50 py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">Reference number</p>
            <p className="mt-1 text-3xl font-extrabold tracking-wide text-teal-600">{result.reference_code}</p>
          </div>
          <p className="mt-4 font-semibold text-charcoal-900">
            {result.service_name} · {fmtDate(result.booking_date)} — {result.booking_time}
          </p>
          <p className="mt-1 text-sm text-charcoal-400">Pet: {result.pet_name}</p>
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm text-charcoal-600">
            <p className="font-bold text-amber-600">⏰ Please arrive on time</p>
            <p className="mt-1">Slots are held for 20–30 minutes past your scheduled time. After that, your slot may be forfeited to a walk-in client — we'll email you rebooking options.</p>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => { setResult(null); setStep(0); setDate(''); setTime(''); }}>Book another</Button>
            <Button onClick={() => navigate('/portal/bookings')}>View my bookings</Button>
          </div>
        </Card>
      </div>
    )
  }

  const canNext = step === 0 ? date && time : step === 1 ? !!serviceId : step === 2 ? !!petId : true

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await api.createBooking({ pet_id: petId, service_id: serviceId, booking_date: date, booking_time: time, notes })
      setResult(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const createPet = async () => {
    if (!newPet.name) return
    const p = await api.createPet({ ...newPet, weight_kg: newPet.weight_kg ? Number(newPet.weight_kg) : null })
    setPets((list) => [p, ...list])
    setPetId(p.pet_id)
    setAddingPet(false)
    setNewPet(emptyPet)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-charcoal-900">Book an appointment</h1>
        <p className="mt-2 text-sm text-charcoal-400">Takes about a minute. Walk-ins are always welcome at the counter too.</p>
      </div>

      {/* progress */}
      <ol className="mx-auto mt-8 flex max-w-xl items-center">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <span className="flex items-center gap-2">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${i <= step ? 'bg-teal-600 text-white' : 'bg-sage-100 text-charcoal-400'}`}>{i < step ? '✓' : i + 1}</span>
              <span className={`hidden text-sm font-semibold sm:block ${i <= step ? 'text-teal-700' : 'text-charcoal-400'}`}>{s}</span>
            </span>
            {i < STEPS.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded ${i < step ? 'bg-teal-600' : 'bg-sage-200'}`} />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ---- main panel ---- */}
        <div>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

          {step === 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-charcoal-900">1 · When should we see your pet?</h2>
              <div className="mt-4 flex flex-col gap-8 sm:flex-row sm:items-start">
                <Calendar value={date} onChange={(d) => { setDate(d); setTime('') }} />
                <div className="flex-1">
                  {date ? (
                    <>
                      <p className="text-sm font-semibold text-charcoal-900">{fmtDate(date)} — available times</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {slots.slots.map((t) => {
                          const taken = slots.taken.includes(t)
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={taken}
                              onClick={() => setTime(t)}
                              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${time === t ? 'border-teal-600 bg-teal-600 text-white' : taken ? 'border-sage-200 bg-sage-50 text-charcoal-400 line-through' : 'border-sage-200 text-charcoal-900 hover:border-teal-600'}`}
                            >
                              {t}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="rounded-xl bg-sage-50 p-4 text-sm text-charcoal-400">Pick a date on the calendar to see open slots. Sundays and past dates are disabled.</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-charcoal-900">2 · What service do you need?</h2>
              <p className="mt-1 text-sm text-charcoal-400">Surgery and confinement are arranged directly with the clinic and don't appear here.</p>
              <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {services.map((s) => (
                  <button
                    key={s.service_id}
                    type="button"
                    onClick={() => setServiceId(s.service_id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${serviceId === s.service_id ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-100' : 'border-sage-200 hover:border-teal-600'}`}
                  >
                    <div>
                      <p className="font-semibold text-charcoal-900">{s.name}</p>
                      <p className="text-xs text-charcoal-400">{s.category}{s.duration_minutes ? ` · ~${s.duration_minutes} min` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                      <span className={`grid h-5 w-5 place-items-center rounded-full border ${serviceId === s.service_id ? 'border-teal-600 bg-teal-600' : 'border-sage-200'}`}>
                        {serviceId === s.service_id && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-charcoal-900">3 · Which pet is visiting?</h2>
              <div className="mt-4 space-y-2">
                {pets.map((p) => (
                  <button
                    key={p.pet_id}
                    type="button"
                    onClick={() => setPetId(p.pet_id)}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${petId === p.pet_id ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-100' : 'border-sage-200 hover:border-teal-600'}`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-sage-100 text-xl">{p.species === 'cat' ? '🐱' : '🐶'}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-charcoal-900">{p.name}</span>
                      <span className="block text-xs text-charcoal-400">{p.breed || p.species}{p.weight_kg ? ` · ${p.weight_kg} kg` : ''}</span>
                    </span>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border ${petId === p.pet_id ? 'border-teal-600 bg-teal-600' : 'border-sage-200'}`}>
                      {petId === p.pet_id && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                  </button>
                ))}
                {pets.length === 0 && <p className="rounded-xl bg-sage-50 p-4 text-sm text-charcoal-400">You don't have any pets saved yet — add your first one below.</p>}
              </div>

              {addingPet ? (
                <div className="mt-4 rounded-xl border border-sage-200 p-4">
                  <p className="font-semibold text-charcoal-900">Add a new pet</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Name"><Input required value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} /></Field>
                    <Field label="Species">
                      <Select value={newPet.species} onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}>
                        <option value="dog">Dog</option><option value="cat">Cat</option><option value="bird">Bird</option><option value="rabbit">Rabbit</option><option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Breed"><Input value={newPet.breed} onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })} placeholder="Shih Tzu" /></Field>
                    <Field label="Gender">
                      <Select value={newPet.gender} onChange={(e) => setNewPet({ ...newPet, gender: e.target.value })}>
                        <option value="female">Female</option><option value="male">Male</option>
                      </Select>
                    </Field>
                    <Field label="Birthdate"><Input type="date" value={newPet.birthdate} onChange={(e) => setNewPet({ ...newPet, birthdate: e.target.value })} /></Field>
                    <Field label="Weight (kg)"><Input type="number" step="0.1" value={newPet.weight_kg} onChange={(e) => setNewPet({ ...newPet, weight_kg: e.target.value })} placeholder="5.2" /></Field>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAddingPet(false)}>Cancel</Button>
                    <Button size="sm" onClick={createPet} disabled={!newPet.name}>Save pet</Button>
                  </div>
                </div>
              ) : (
                <Button variant="subtle" size="sm" className="mt-4" onClick={() => setAddingPet(true)}>+ Add a new pet</Button>
              )}
            </Card>
          )}

          {step === 3 && selectedService && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-charcoal-900">4 · Review &amp; confirm</h2>
              <dl className="mt-4 divide-y divide-sage-200 rounded-xl border border-sage-200">
                {[
                  ['Service', `${selectedService.name} (${selectedService.category})`],
                  ['Pet', pets.find((p) => p.pet_id === petId)?.name || '—'],
                  ['Date', date ? fmtDate(date) : '—'],
                  ['Time', time],
                  ['Est. price', fmtMoney(selectedService)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-charcoal-400">{k}</dt>
                    <dd className="text-right font-semibold text-charcoal-900">{v}</dd>
                  </div>
                ))}
              </dl>

              {(selectedService.requires_fasting || selectedService.requires_anesthesia || selectedService.weight_requirement || selectedService.recovery_time_hours) && (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-sm font-bold text-amber-600">📋 Instructions before your visit</p>
                  <ul className="mt-2 space-y-1 text-sm text-charcoal-600">
                    {selectedService.requires_fasting && <li>• Fasting: no food for 8–12 hours before the appointment</li>}
                    {selectedService.requires_anesthesia && <li>• Anesthesia is involved — we'll review consent at the clinic</li>}
                    {selectedService.weight_requirement && <li>• Weight requirement: {selectedService.weight_requirement}</li>}
                    {selectedService.recovery_time_hours && <li>• Plan for ~{selectedService.recovery_time_hours} hours of recovery time afterwards</li>}
                  </ul>
                </div>
              )}

              <Field label="Notes for the clinic (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms, questions, or anything we should know…" />
              </Field>
            </Card>
          )}
        </div>

        {/* ---- summary sidebar ---- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="text-sm font-bold uppercase tracking-wide text-charcoal-400">Your booking</p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex justify-between"><span className="text-charcoal-400">Service</span><span className="font-semibold text-right">{selectedService?.name || '—'}</span></p>
              <p className="flex justify-between"><span className="text-charcoal-400">Pet</span><span className="font-semibold">{pets.find((p) => p.pet_id === petId)?.name || '—'}</span></p>
              <p className="flex justify-between"><span className="text-charcoal-400">Date</span><span className="font-semibold">{date ? fmtDate(date) : '—'}</span></p>
              <p className="flex justify-between"><span className="text-charcoal-400">Time</span><span className="font-semibold">{time || '—'}</span></p>
            </div>
            <div className="mt-4 flex gap-2">
              {step > 0 && <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>Back</Button>}
              {step < 3 ? (
                <Button className="flex-1" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
              ) : (
                <Button variant="accent" className="flex-1" disabled={busy} onClick={submit}>{busy ? 'Booking…' : 'Confirm booking'}</Button>
              )}
            </div>
            <p className="mt-3 text-center text-xs text-charcoal-400">Free cancellation · late arrivals forfeit the slot after 20–30 min</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { api, fmtMoney, fmtDate } from '../lib/api.js'
import { Button, Card, Field, Input, PetPhoto, Select, Textarea } from '../components/ui.jsx'
import Calendar from '../components/Calendar.jsx'
import { SPECIES, speciesEmoji, speciesLabel, tierLabel, tierSpecies } from '../lib/species.js'

const STEPS = [
  { label: 'Date & time', desc: 'Pick your preferred slot' },
  { label: 'Service', desc: 'What does your pet need?' },
  { label: 'Pet', desc: 'Who\'s visiting?' },
  { label: 'Confirm', desc: 'Review & book' },
]

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

  useEffect(() => { api.services('?bookable=1').then(setServices).catch(() => {}) }, [])

  useEffect(() => {
    if (user && role === 'client') {
      api.myPets().then((d) => { setPets(d.pets); if (!petId && d.pets.length) setPetId(d.pets[0].pet_id) }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (date) api.slots(date).then(setSlots).catch(() => setSlots({ slots: [], taken: [] }))
  }, [date])

  const selectedService = useMemo(() => services.find((s) => s.service_id === serviceId) || null, [services, serviceId])

  // ── Not logged in ──
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-sage-100 text-5xl">🔐</div>
          <h1 className="text-3xl font-extrabold text-charcoal-900">Book an appointment</h1>
          <p className="mt-3 text-charcoal-500 leading-relaxed">
            Sign in to book online. Walk-ins are always welcome at the clinic counter.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/login?next=/book')}>Sign in</Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/register')}>Create account</Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Staff account ──
  if (role !== 'client') {
    return (
      <div className="mx-auto max-w-md px-6 py-32 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-sage-100 text-5xl">🩺</div>
          <h1 className="text-3xl font-extrabold text-charcoal-900">Staff account</h1>
          <p className="mt-3 text-charcoal-500">Use the admin dashboard to create bookings.</p>
          <Button size="lg" className="mt-8" onClick={() => navigate('/admin')}>Go to dashboard</Button>
        </div>
      </div>
    )
  }

  // ── Success ──
  if (result) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-8 grid h-24 w-24 place-items-center rounded-full bg-sage-100">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0a4d52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-charcoal-900">You're all set!</h1>
          <p className="mt-3 text-charcoal-500">Confirmation sent to {user.email}</p>

          <div className="mx-auto mt-10 max-w-sm rounded-2xl bg-sage-50 p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Reference number</p>
            <p className="mt-2 text-4xl font-extrabold tracking-wide text-teal-600">{result.reference_code}</p>
          </div>

          <div className="mx-auto mt-8 max-w-sm space-y-2 text-sm">
            <p className="font-semibold text-charcoal-900">{result.service_name}</p>
            <p className="text-charcoal-500">{fmtDate(result.booking_date)} at {result.booking_time}</p>
            <p className="text-charcoal-500">Pet: {result.pet_name}</p>
          </div>

          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-amber-500/30 bg-amber-50 p-5 text-left text-sm text-charcoal-600">
            <p className="font-bold text-amber-600">⏰ Arrive on time</p>
            <p className="mt-2 leading-relaxed">Slots held 20–30 min. Late arrivals may forfeit to walk-ins.</p>
          </div>

          <div className="mt-10 flex justify-center gap-4">
            <Button variant="outline" onClick={() => { setResult(null); setStep(0); setDate(''); setTime(''); }}>Book another</Button>
            <Button onClick={() => navigate('/portal/bookings')}>View my bookings</Button>
          </div>
        </div>
      </div>
    )
  }

  const canNext = step === 0 ? date && time : step === 1 ? !!serviceId : step === 2 ? !!petId : true

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const r = await api.createBooking({ pet_id: petId, service_id: serviceId, booking_date: date, booking_time: time, notes })
      setResult(r)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
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
    <div className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-charcoal-900">Book an appointment</h1>
        <p className="mt-2 text-charcoal-500">4 quick steps — takes about a minute</p>
      </div>

      {/* Step progress */}
      <div className="mx-auto mt-10 max-w-3xl">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  i < step ? 'bg-teal-600 text-white' : i === step ? 'bg-teal-600 text-white ring-4 ring-teal-100' : 'bg-sage-100 text-charcoal-400'
                }`}>
                  {i < step ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  ) : i + 1}
                </div>
                <span className={`mt-2 text-xs font-semibold ${i <= step ? 'text-teal-700' : 'text-charcoal-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 mb-6 h-0.5 w-12 sm:w-20 rounded-full transition-colors duration-300 ${i < step ? 'bg-teal-600' : 'bg-sage-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="mx-auto mt-10 max-w-4xl">
        {/* Step 0: Date & Time */}
        {step === 0 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-charcoal-900">When should we see your pet?</h2>
            <p className="mt-1.5 text-sm text-charcoal-500">Pick a date, then choose an open time slot.</p>
            <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
              <Calendar value={date} onChange={(d) => { setDate(d); setTime('') }} />
              <div className="flex-1">
                {date ? (
                  <>
                    <p className="text-sm font-semibold text-charcoal-900">Available times</p>
                    <div className="mt-4 grid grid-cols-3 gap-2.5">
                      {slots.slots.map((t) => {
                        const taken = slots.taken.includes(t)
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={taken}
                            onClick={() => setTime(t)}
                            className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                              time === t
                                ? 'border-teal-600 bg-teal-600 text-white shadow-md'
                                : taken
                                  ? 'border-sage-100 bg-sage-50 text-charcoal-300 line-through'
                                  : 'border-sage-200 text-charcoal-700 hover:border-teal-400 hover:bg-teal-50'
                            }`}
                          >
                            {t}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-xs text-charcoal-400">
                      {slots.taken.length > 0 ? `${slots.taken.length} slot${slots.taken.length > 1 ? 's' : ''} already booked` : 'All slots available'}
                    </p>
                  </>
                ) : (
                  <div className="rounded-xl bg-sage-50 p-8 text-center">
                    <p className="text-3xl">📅</p>
                    <p className="mt-3 text-sm text-charcoal-400">Select a date to see available times</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 1: Service */}
        {step === 1 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-charcoal-900">What service do you need?</h2>
            <p className="mt-1.5 text-sm text-charcoal-500">Surgery and confinement are arranged at the clinic only.</p>
            <div className="mt-6 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {services.map((s) => (
                <button
                  key={s.service_id}
                  type="button"
                  onClick={() => setServiceId(s.service_id)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                    serviceId === s.service_id
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-sage-200 hover:border-teal-400 hover:bg-sage-50/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-charcoal-900">{s.name}</p>
                    <p className="mt-0.5 text-xs text-charcoal-400">{s.category}{s.duration_minutes ? ` · ~${s.duration_minutes} min` : ''}</p>
                    <p className="mt-1 text-xs font-medium text-charcoal-500">
                      {tierSpecies(s.weight_tier) === 'any' ? '🐾 For any pet' : `${speciesEmoji(tierSpecies(s.weight_tier))} For ${tierLabel(s.weight_tier).toLowerCase()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-all duration-200 ${
                      serviceId === s.service_id ? 'border-teal-600 bg-teal-600' : 'border-sage-300'
                    }`}>
                      {serviceId === s.service_id && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Step 2: Pet */}
        {step === 2 && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-charcoal-900">Which pet is visiting?</h2>
            <div className="mt-6 space-y-3">
              {pets.map((p) => (
                <button
                  key={p.pet_id}
                  type="button"
                  onClick={() => setPetId(p.pet_id)}
                  className={`flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all duration-200 ${
                    petId === p.pet_id
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-sage-200 hover:border-teal-400 hover:bg-sage-50/50'
                  }`}
                >
                  <PetPhoto photoUrl={p.photo_url} size="md" />
                  <span className="flex-1">
                    <span className="block font-semibold text-charcoal-900">{p.name}</span>
                    <span className="block text-xs text-charcoal-400">{speciesEmoji(p.species)} {p.breed || speciesLabel(p.species)}{p.weight_kg ? ` · ${p.weight_kg} kg` : ''}</span>
                  </span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-all duration-200 ${
                    petId === p.pet_id ? 'border-teal-600 bg-teal-600' : 'border-sage-300'
                  }`}>
                    {petId === p.pet_id && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                  </span>
                </button>
              ))}
              {pets.length === 0 && (
                <div className="rounded-xl bg-sage-50 p-8 text-center">
                  <p className="text-3xl">🐾</p>
                  <p className="mt-3 text-sm text-charcoal-400">No pets saved yet</p>
                </div>
              )}
            </div>

            {addingPet ? (
              <div className="mt-6 rounded-xl border-2 border-sage-200 p-6">
                <p className="font-semibold text-charcoal-900">Add a new pet</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Name"><Input required value={newPet.name} onChange={(e) => setNewPet({ ...newPet, name: e.target.value })} placeholder="Bella" /></Field>
                  <Field label="Species">
                    <Select value={newPet.species} onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}>
                      {SPECIES.map((sp) => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
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
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setAddingPet(false)}>Cancel</Button>
                  <Button size="sm" onClick={createPet} disabled={!newPet.name}>Save pet</Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPet(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sage-300 py-4 text-sm font-semibold text-charcoal-500 transition-colors hover:border-teal-400 hover:bg-teal-50/50 hover:text-teal-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add a new pet
              </button>
            )}
          </Card>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedService && (
          <Card className="p-8">
            <h2 className="text-xl font-bold text-charcoal-900">Review your booking</h2>
            <p className="mt-1.5 text-sm text-charcoal-500">Double-check everything, then confirm.</p>

            <div className="mt-6 rounded-xl border-2 border-sage-200 divide-y divide-sage-100">
              {[
                ['Service', selectedService.name],
                ['Category', selectedService.category],
                ['Pet', pets.find((p) => p.pet_id === petId)?.name || '—'],
                ['Date', date ? fmtDate(date) : '—'],
                ['Time', time || '—'],
                ['Est. price', fmtMoney(selectedService)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-5 py-4 text-sm">
                  <span className="text-charcoal-400">{k}</span>
                  <span className="text-right font-semibold text-charcoal-900">{v}</span>
                </div>
              ))}
            </div>

            {(selectedService.requires_fasting || selectedService.requires_anesthesia || selectedService.weight_requirement || selectedService.recovery_time_hours) && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-50 p-5">
                <p className="text-sm font-bold text-amber-600">📋 Before your visit</p>
                <ul className="mt-3 space-y-1.5 text-sm text-charcoal-600">
                  {selectedService.requires_fasting && <li>• No food 8–12 hours before</li>}
                  {selectedService.requires_anesthesia && <li>• Anesthesia involved — consent at clinic</li>}
                  {selectedService.weight_requirement && <li>• Weight: {selectedService.weight_requirement}</li>}
                  {selectedService.recovery_time_hours && <li>• Plan ~{selectedService.recovery_time_hours}h recovery</li>}
                </ul>
              </div>
            )}

            <div className="mt-6">
              <Field label="Notes for the clinic (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms, questions, or anything we should know…" />
              </Field>
            </div>
          </Card>
        )}
      </div>

      {/* Navigation */}
      <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between gap-4">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <Button size="lg" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </Button>
          ) : (
            <Button variant="accent" size="lg" disabled={busy} onClick={submit}>
              {busy ? 'Booking…' : '✓ Confirm booking'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

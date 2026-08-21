import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Button, Card, EmptyState, Spinner, Badge } from '../../components/ui.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'
import MedicalReportPrint from '../../components/MedicalReportPrint.jsx'
import { speciesEmoji, speciesLabel } from '../../lib/species.js'

const TYPE_TONE = { vaccination: 'teal', checkup: 'green', surgery: 'amber', grooming: 'blue', other: 'gray' }

const dueTone = (due) => {
  if (!due) return null
  const today = new Date().toISOString().slice(0, 10)
  if (due < today) return { tone: 'red', label: 'Overdue' }
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  if (due <= in30.toISOString().slice(0, 10)) return { tone: 'amber', label: 'Due soon' }
  return null
}

export default function PetDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')

  useEffect(() => {
    api.myPets()
      .then((d) => {
        const pet = d.pets.find((p) => String(p.pet_id) === id)
        if (pet) return api.petRecords(pet.pet_id).then((records) => ({ pet, records }))
        return null
      })
      .then(setData)
      .catch(() => setData(null))
  }, [id])

  const savePhoto = async (photo_url) => {
    setPhotoBusy(true)
    setPhotoError('')
    try {
      await api.updatePet(pet.pet_id, { photo_url })
      const d = await api.myPets()
      const p = d.pets.find((x) => String(x.pet_id) === id)
      if (p) setData((old) => (old ? { ...old, pet: p } : old))
    } catch (e) {
      setPhotoError(e.message)
    } finally { setPhotoBusy(false) }
  }

  const dueItems = useMemo(() => {
    if (!data) return []
    return data.records
      .filter((r) => r.next_due_date)
      .map((r) => ({ ...r, due: dueTone(r.next_due_date) }))
      .filter((r) => r.due)
      .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  }, [data])

  if (!data) return <Spinner label="Loading pet…" />

  const { pet, records } = data

  return (
    <div className="space-y-10">
      <Link
        to="/portal/pets"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Back to my pets
      </Link>

      <Card className="flex flex-wrap items-center gap-6 p-8">
        <ImageUpload photoUrl={pet.photo_url} onSave={savePhoto} busy={photoBusy} round={false} size="xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-charcoal-900">{pet.name}</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">{speciesEmoji(pet.species)} {pet.breed || speciesLabel(pet.species)} · {pet.gender} · {pet.weight_kg ? `${pet.weight_kg} kg` : 'weight n/a'}</p>
          {photoError && <p className="mt-2 text-xs font-medium text-red-500">{photoError}</p>}
        </div>
      </Card>

      {dueItems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-7">
          <h2 className="font-bold text-amber-700">⏰ Upcoming &amp; due</h2>
          <p className="mt-1 text-sm text-amber-700/80">Things your vet wants to follow up on.</p>
          <div className="mt-4 space-y-2.5">
            {dueItems.map((r) => (
              <div key={r.record_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal-900">{r.title || 'Follow-up'}</p>
                  <p className="text-xs text-charcoal-400">due {fmtDate(r.next_due_date)}{r.vaccinations_given ? ` · ${r.vaccinations_given}` : ''}</p>
                </div>
                <Badge color={r.due.tone}>{r.due.label}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-charcoal-900">Medical history</h2>
            <p className="mt-1.5 text-sm text-charcoal-500">Updated by our vets after every visit — this is read-only for you.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>🖨️ Print / PDF</Button>
        </div>

        {records.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No visits recorded yet" icon="📋">
              Once your pet has their first visit, the medical log will appear here.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-7 space-y-5">
            {records.map((r) => (
              <Card key={r.record_id} className="p-7 transition-all duration-300 hover:shadow-card-hover">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-charcoal-900">
                    {r.title || r.service_name || 'Visit'}
                    <span className="ml-2 text-sm font-normal text-charcoal-400">{fmtDate(r.visit_date)}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.type && <Badge color={TYPE_TONE[r.type] || 'gray'}>{r.type}</Badge>}
                    {r.vaccinations_given && <Badge color="teal">💉 {r.vaccinations_given}</Badge>}
                    {r.reference_code && <Badge color="gray">{r.reference_code}</Badge>}
                  </div>
                </div>
                {r.diagnosis && <p className="mt-3 text-sm font-semibold text-charcoal-900">{r.diagnosis}</p>}
                {r.treatment_notes && <p className="mt-1.5 text-sm text-charcoal-600 leading-relaxed">{r.treatment_notes}</p>}
                <div className="mt-4 flex flex-wrap gap-6 text-xs text-charcoal-400">
                  {r.weight_at_visit && <span>Weight: {r.weight_at_visit} kg</span>}
                  {r.staff_name && <span>Attending: {r.staff_name}</span>}
                  {r.next_due_date && (
                    <span>
                      Next due: <b className="text-teal-600">{fmtDate(r.next_due_date)}</b>
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Print-only medical report — shown by the browser's print dialog */}
      <div className="print-area hidden print:block">
        <MedicalReportPrint
          pet={{ ...pet, owner_name: user?.full_name, owner_phone: user?.phone, owner_email: user?.email }}
          records={records}
          generatedAt={new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}
        />
      </div>
    </div>
  )
}

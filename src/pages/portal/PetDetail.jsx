import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Card, EmptyState, Spinner, Badge } from '../../components/ui.jsx'

export default function PetDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)

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

  if (!data) return <Spinner label="Loading pet…" />

  const { pet, records } = data

  return (
    <div className="space-y-6">
      <Link to="/portal/pets" className="text-sm font-semibold text-teal-600 hover:underline">← Back to my pets</Link>
      <Card className="flex items-center gap-5 p-6">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-sage-100 text-4xl">{pet.species === 'cat' ? '🐱' : '🐶'}</span>
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">{pet.name}</h1>
          <p className="text-sm text-charcoal-400">{pet.breed || pet.species} · {pet.gender} · {pet.weight_kg ? `${pet.weight_kg} kg` : 'weight n/a'}</p>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-charcoal-900">Medical history</h2>
        <p className="text-sm text-charcoal-400">Updated by our vets after every visit — this is read-only for you.</p>
        {records.length === 0 ? (
          <div className="mt-4"><EmptyState title="No visits recorded yet" icon="📋">Once your pet has their first visit, the medical log will appear here.</EmptyState></div>
        ) : (
          <div className="mt-4 space-y-3">
            {records.map((r) => (
              <Card key={r.record_id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-charcoal-900">{r.service_name || 'Visit'} <span className="ml-1 text-sm font-normal text-charcoal-400">{fmtDate(r.visit_date)}</span></p>
                  <div className="flex gap-2">
                    {r.vaccinations_given && <Badge color="teal">💉 {r.vaccinations_given}</Badge>}
                    {r.reference_code && <Badge color="gray">{r.reference_code}</Badge>}
                  </div>
                </div>
                {r.diagnosis && <p className="mt-2 text-sm font-semibold text-charcoal-900">{r.diagnosis}</p>}
                {r.treatment_notes && <p className="mt-1 text-sm text-charcoal-600">{r.treatment_notes}</p>}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-charcoal-400">
                  {r.weight_at_visit && <span>Weight: {r.weight_at_visit} kg</span>}
                  {r.staff_name && <span>Attending: {r.staff_name}</span>}
                  {r.next_due_date && <span>Next due: <b className="text-teal-600">{fmtDate(r.next_due_date)}</b></span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

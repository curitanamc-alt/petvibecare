import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api, fmtMoney } from '../lib/api.js'
import { Badge, Button, Card, EmptyState, Modal, SectionHeading, Spinner } from '../components/ui.jsx'
import { speciesEmoji, tierLabel, tierSpecies } from '../lib/species.js'

const CAT_ICONS = {
  'Consultation & Check-Up': '🩺', 'Vaccination & Deworming': '💉', 'Digital X-Ray': '🩻',
  'Pet Grooming': '✂️', 'Veterinary Surgery': '🏥', 'Diagnostic Laboratories': '🧪',
  'Ultrasound': '🔊', 'Dentistry': '🦷', 'Confinement': '🛏️', 'Emergency Care': '🚨',
  'Injections': '💊', 'Pet Insurance': '🛡️',
}

const CAT_DESCRIPTIONS = {
  'Consultation & Check-Up': 'General check-ups and wellness consultations for your pets.',
  'Vaccination & Deworming': 'Core vaccines and deworming to keep your pet protected.',
  'Digital X-Ray': 'High-resolution digital radiographs for accurate diagnosis.',
  'Pet Grooming': 'Professional grooming services for dogs and cats of all sizes.',
  'Veterinary Surgery': 'Spay, neuter, and other surgical procedures performed by skilled vets.',
  'Diagnostic Laboratories': 'In-house lab tests including CBC, blood chemistry, and fecalysis.',
  'Ultrasound': 'Diagnostic imaging for abdominal and cardiac evaluations.',
  'Dentistry': 'Dental cleaning and oral health services for your pets.',
  'Confinement': 'Boarding and ICU confinement for pets needing extended care.',
  'Emergency Care': 'Walk-in emergency consultations for urgent pet health concerns.',
  'Injections': 'Vitamin, antibiotic, and fluid therapy injections.',
  'Pet Insurance': 'Pet insurance options to help cover unexpected vet costs.',
}

export default function Services() {
  const [params, setParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const navigate = useNavigate()

  const activeCat = params.get('cat') || ''

  useEffect(() => {
    Promise.all([api.services(), api.categories()])
      .then(([sv, cats]) => { setServices(sv); setCategories(cats) })
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const filtered = activeCat ? services.filter((s) => s.category === activeCat) : services
    const map = {}
    for (const s of filtered) (map[s.category] ??= []).push(s)
    return map
  }, [services, activeCat])

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <SectionHeading
        eyebrow="Services"
        title="Everything your pet needs, in one place"
        subtitle="Click any service for details and pre-visit instructions."
      />

      {/* Category chips */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => setParams({})}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
            !activeCat ? 'bg-teal-600 text-white shadow-sm' : 'bg-sage-100 text-teal-700 hover:bg-sage-200'
          }`}
        >
          All services
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            onClick={() => setParams({ cat: c.category })}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeCat === c.category
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-sage-100 text-teal-700 hover:bg-sage-200'
            }`}
          >
            {CAT_ICONS[c.category] || '🐾'} {c.category}{' '}
            <span className="opacity-50">({c.count})</span>
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="mt-14">
          <EmptyState title="No services here yet" />
        </div>
      )}

      {/* Service groups */}
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="mt-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CAT_ICONS[cat] || '🐾'}</span>
            <div>
              <h2 className="text-xl font-extrabold text-charcoal-900">{cat}</h2>
              {CAT_DESCRIPTIONS[cat] && (
                <p className="mt-0.5 text-sm text-charcoal-400">{CAT_DESCRIPTIONS[cat]}</p>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <Card key={s.service_id} className="flex flex-col p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-charcoal-900">{s.name}</h3>
                  {s.client_bookable ? (
                    <Badge color="teal">Book online</Badge>
                  ) : (
                    <Badge color="gray">Clinic only</Badge>
                  )}
                </div>
                <p className="mt-2.5 flex-1 text-sm text-charcoal-500 leading-relaxed">
                  {s.description || `${s.category} service.`}
                </p>
                <p className="mt-2 text-xs font-semibold text-charcoal-400">
                  {tierSpecies(s.weight_tier) === 'any' ? '🐾 For any pet' : `${speciesEmoji(tierSpecies(s.weight_tier))} For ${tierLabel(s.weight_tier)}`}
                </p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                  <span className="text-charcoal-400">{s.duration_minutes ? `~${s.duration_minutes} min` : '—'}</span>
                </div>
                <div className="mt-5 flex gap-3">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetail(s)}>
                    Details
                  </Button>
                  {s.client_bookable && (
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/book?service=${s.service_id}`)}>
                      Book
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge color="gray">{detail.category}</Badge>
              <Badge color="sage">{tierSpecies(detail.weight_tier) === 'any' ? '🐾 Any pet' : `${speciesEmoji(tierSpecies(detail.weight_tier))} ${tierLabel(detail.weight_tier)}`}</Badge>
              {detail.client_bookable ? (
                <Badge color="teal">Bookable online</Badge>
              ) : (
                <Badge color="amber">Book at clinic</Badge>
              )}
            </div>
            <p className="mt-5 text-sm text-charcoal-600 leading-relaxed">
              {detail.description || 'No additional description available.'}
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-sage-50 p-5">
                <dt className="text-xs font-medium text-charcoal-400">Price</dt>
                <dd className="mt-1.5 font-bold text-teal-600">{fmtMoney(detail)}</dd>
              </div>
              <div className="rounded-xl bg-sage-50 p-5">
                <dt className="text-xs font-medium text-charcoal-400">Duration</dt>
                <dd className="mt-1.5 font-semibold text-charcoal-900">{detail.duration_minutes ? `~${detail.duration_minutes} min` : 'Varies'}</dd>
              </div>
            </dl>
            {(detail.requires_fasting || detail.requires_anesthesia || detail.weight_requirement || detail.recovery_time_hours) && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-50 p-5">
                <p className="text-sm font-bold text-amber-600">Pre-visit instructions</p>
                <ul className="mt-3 space-y-2 text-sm text-charcoal-600">
                  {detail.requires_fasting && <li>• Fasting required before the visit</li>}
                  {detail.requires_anesthesia && <li>• Anesthesia involved — informed consent needed</li>}
                  {detail.weight_requirement && <li>• Weight requirement: {detail.weight_requirement}</li>}
                  {detail.recovery_time_hours && <li>• Recovery window: ~{detail.recovery_time_hours} hours after procedure</li>}
                </ul>
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
              {detail.client_bookable && (
                <Button onClick={() => { setDetail(null); navigate(`/book?service=${detail.service_id}`) }}>
                  Book this service
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

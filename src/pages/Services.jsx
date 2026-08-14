import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api, fmtMoney } from '../lib/api.js'
import { Badge, Button, Card, EmptyState, Modal, SectionHeading, Spinner } from '../components/ui.jsx'

const CAT_ICONS = {
  'Consultation & Check-Up': '🩺', 'Vaccination & Deworming': '💉', 'Digital X-Ray': '🩻',
  'Pet Grooming': '✂️', 'Veterinary Surgery': '🏥', 'Diagnostic Laboratories': '🧪',
  'Ultrasound': '🔊', 'Dentistry': '🦷', 'Confinement': '🛏️', 'Emergency Care': '🚨',
  'Injections': '💊', 'Pet Insurance': '🛡️',
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
    <div className="mx-auto max-w-6xl px-4 py-14">
      <SectionHeading eyebrow="Services We Provide" title="Everything your pet needs, in one place" subtitle="Click any service for details and pre-visit instructions." />

      {/* Category chips */}
      <div className="mt-8 flex flex-wrap gap-2">
        <button onClick={() => setParams({})} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${!activeCat ? 'bg-teal-600 text-white' : 'bg-sage-100 text-teal-700 hover:bg-sage-200'}`}>All services</button>
        {categories.map((c) => (
          <button key={c.category} onClick={() => setParams({ cat: c.category })} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${activeCat === c.category ? 'bg-teal-600 text-white' : 'bg-sage-100 text-teal-700 hover:bg-sage-200'}`}>
            {CAT_ICONS[c.category] || '🐾'} {c.category} <span className="opacity-60">({c.count})</span>
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && <div className="mt-10"><EmptyState title="No services here yet" /></div>}

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="mt-12">
          <h2 className="text-xl font-extrabold text-charcoal-900">{CAT_ICONS[cat] || '🐾'} {cat}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <Card key={s.service_id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-charcoal-900">{s.name}</h3>
                  {s.client_bookable ? <Badge color="teal">Book online</Badge> : <Badge color="gray">Clinic only</Badge>}
                </div>
                <p className="mt-1 text-sm text-charcoal-400">{s.description || `${s.category} service.`}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                  <span className="text-charcoal-400">{s.duration_minutes ? `~${s.duration_minutes} min` : '—'}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetail(s)}>Details</Button>
                  {s.client_bookable && (
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/book?service=${s.service_id}`)}>Book</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge color="gray">{detail.category}</Badge>
              {detail.client_bookable ? <Badge color="teal">Bookable online</Badge> : <Badge color="amber">Book at clinic</Badge>}
            </div>
            <p className="mt-3 text-sm text-charcoal-600">{detail.description || 'No additional description available.'}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-sage-50 p-3"><dt className="text-xs text-charcoal-400">Price</dt><dd className="font-bold text-teal-600">{fmtMoney(detail)}</dd></div>
              <div className="rounded-lg bg-sage-50 p-3"><dt className="text-xs text-charcoal-400">Duration</dt><dd className="font-semibold">{detail.duration_minutes ? `~${detail.duration_minutes} min` : 'Varies'}</dd></div>
            </dl>
            {(detail.requires_fasting || detail.requires_anesthesia || detail.weight_requirement || detail.recovery_time_hours) && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-bold text-amber-600">Pre-visit instructions</p>
                <ul className="mt-2 space-y-1 text-sm text-charcoal-600">
                  {detail.requires_fasting && <li>• Fasting required before the visit</li>}
                  {detail.requires_anesthesia && <li>• Anesthesia involved — informed consent needed</li>}
                  {detail.weight_requirement && <li>• Weight requirement: {detail.weight_requirement}</li>}
                  {detail.recovery_time_hours && <li>• Recovery window: ~{detail.recovery_time_hours} hours after procedure</li>}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
              {detail.client_bookable && <Button onClick={() => { setDetail(null); navigate(`/book?service=${detail.service_id}`) }}>Book this service</Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

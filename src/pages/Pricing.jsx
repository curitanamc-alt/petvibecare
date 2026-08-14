import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtMoney } from '../lib/api.js'
import { Badge, SectionHeading, Spinner } from '../components/ui.jsx'

export default function Pricing() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.services().then(setServices).finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const map = {}
    for (const s of services) (map[s.category] ??= []).push(s)
    return map
  }, [services])

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <SectionHeading eyebrow="Check Our Prices Here" title="Transparent pricing, published up front" subtitle="Ranges reflect size/weight and case complexity. Final quote confirmed before any procedure." />

      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-charcoal-600">
        <p className="font-bold text-amber-600">Good to know</p>
        <p className="mt-1">Grooming prices scale by pet size (small → XXXL; cats single tier). Some services — surgery, confinement, diagnostics — are arranged at the clinic, not booked online.</p>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-charcoal-900">{cat}</h2>
          <div className="overflow-hidden rounded-2xl border border-sage-200 bg-white">
            {list.map((s, i) => (
              <div key={s.service_id} className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${i % 2 ? 'bg-sage-50/60' : 'bg-white'}`}>
                <div>
                  <p className="font-semibold text-charcoal-900">{s.name}</p>
                  {s.weight_tier && <p className="text-xs text-charcoal-400">Size tier: {s.weight_tier}</p>}
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap">
                  {s.client_bookable ? <Badge color="teal">Bookable</Badge> : <Badge color="gray">Clinic</Badge>}
                  <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-12 text-center">
        <p className="text-charcoal-400">Need help choosing? Book a consultation and we'll guide you.</p>
        <Link to="/book" className="mt-3 inline-block rounded-lg bg-amber-500 px-6 py-3 font-semibold text-white hover:bg-amber-600">Book an Appointment</Link>
      </div>
    </div>
  )
}

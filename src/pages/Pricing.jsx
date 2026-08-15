import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtMoney } from '../lib/api.js'
import { Badge, SectionHeading, Spinner } from '../components/ui.jsx'
import { speciesEmoji, tierLabel, tierSpecies } from '../lib/species.js'

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

  const totalServices = services.length
  const bookableCount = services.filter((s) => s.client_bookable).length

  return (
    <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
      <SectionHeading
        eyebrow="Pricing"
        title="Transparent pricing, published up front"
        subtitle="Ranges reflect size/weight and case complexity. Final quote confirmed before any procedure."
      />

      {/* Quick stats */}
      <div className="mt-12 grid grid-cols-3 gap-5">
        <div className="rounded-2xl bg-sage-50 p-6 text-center">
          <p className="text-3xl font-extrabold text-teal-600">{totalServices}</p>
          <p className="mt-1 text-sm text-charcoal-500">Total services</p>
        </div>
        <div className="rounded-2xl bg-sage-50 p-6 text-center">
          <p className="text-3xl font-extrabold text-teal-600">{bookableCount}</p>
          <p className="mt-1 text-sm text-charcoal-500">Bookable online</p>
        </div>
        <div className="rounded-2xl bg-sage-50 p-6 text-center">
          <p className="text-3xl font-extrabold text-amber-500">0</p>
          <p className="mt-1 text-sm text-charcoal-500">Hidden fees</p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-50 p-6 text-sm text-charcoal-600">
        <p className="font-bold text-amber-600">Good to know</p>
        <p className="mt-2 leading-relaxed">
          Grooming prices scale by pet size (small → XXXL; cats single tier). Some services — surgery, confinement, diagnostics — are arranged at the clinic, not booked online.
        </p>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-charcoal-900">{cat}</h2>
            <span className="text-xs text-charcoal-400">{list.length} {list.length === 1 ? 'service' : 'services'}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-sage-200/80 bg-white shadow-card">
            {list.map((s, i) => (
              <div
                key={s.service_id}
                className={`flex items-center justify-between gap-4 px-6 py-4.5 text-sm transition-colors hover:bg-sage-50/50 ${
                  i % 2 ? 'bg-sage-50/30' : 'bg-white'
                } ${i < list.length - 1 ? 'border-b border-sage-100' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal-900">{s.name}</p>
                  {s.weight_tier && <p className="mt-0.5 text-xs text-charcoal-400">{speciesEmoji(tierSpecies(s.weight_tier))} For {tierLabel(s.weight_tier)}</p>}
                </div>
                <div className="flex items-center gap-4 whitespace-nowrap">
                  {s.client_bookable ? <Badge color="teal">Bookable</Badge> : <Badge color="gray">Clinic</Badge>}
                  <span className="font-bold text-teal-600">{fmtMoney(s)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-16 text-center">
        <p className="text-charcoal-500">Need help choosing? Book a consultation and we'll guide you.</p>
        <Link
          to="/book"
          className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-amber-500 px-8 py-3.5 font-semibold text-white transition-all duration-200 hover:bg-amber-600 hover:shadow-md active:scale-[0.97]"
        >
          Book an Appointment
        </Link>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Card, SectionHeading, Spinner } from '../components/ui.jsx'

export default function Bundles() {
  const [bundles, setBundles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.bundles().then(setBundles).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <SectionHeading
        eyebrow="Bundled Wellness, Bundled Approach"
        title="Save with wellness packages"
        subtitle="Bundle the care your pet actually needs and pay less than booking services separately."
      />

      <div className="mt-14 grid gap-8 md:grid-cols-2">
        {bundles.map((b) => {
          const orig = Math.round(b.price / (1 - b.discount_percent / 100))
          return (
            <Card key={b.bundle_id} className="relative flex flex-col p-9 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
              <span className="absolute right-7 top-7 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm">
                Save {b.discount_percent}%
              </span>
              <h3 className="text-xl font-extrabold text-charcoal-900">{b.name}</h3>
              <p className="mt-2.5 text-sm text-charcoal-500 leading-relaxed">{b.description}</p>
              <ul className="mt-6 space-y-3">
                {b.services.map((s) => (
                  <li key={s.service_id} className="flex items-center gap-3 text-sm text-charcoal-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage-100 text-xs text-teal-700">✓</span>
                    {s.name}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-end justify-between border-t border-sage-200/80 pt-6">
                <div>
                  <p className="text-xs text-charcoal-400 line-through">₱{orig.toLocaleString()}</p>
                  <p className="mt-1 text-2xl font-extrabold text-teal-600">₱{b.price.toLocaleString()}</p>
                </div>
                <Link
                  to="/book"
                  className="rounded-[var(--radius-button)] bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-teal-700 hover:shadow-md active:scale-[0.97]"
                >
                  Book a visit
                </Link>
              </div>
            </Card>
          )
        })}
      </div>

      <p className="mt-14 text-center text-sm text-charcoal-400">
        Bundles are applied at checkout in the clinic — book any service online and mention your bundle.
      </p>
    </div>
  )
}

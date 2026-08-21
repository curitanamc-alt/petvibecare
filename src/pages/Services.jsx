import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api, fmtMoney } from '../lib/api.js'
import { Badge, Button, Card, EmptyState, Modal, Spinner, cx } from '../components/ui.jsx'
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

// Soft gradient tile tint per category, used on the service cards and section headers.
const CAT_TILES = {
  'Consultation & Check-Up': 'from-teal-50 to-teal-100 text-teal-600',
  'Vaccination & Deworming': 'from-sky-50 to-sky-100 text-sky-600',
  'Digital X-Ray': 'from-slate-100 to-slate-200 text-slate-500',
  'Pet Grooming': 'from-amber-50 to-amber-100 text-amber-500',
  'Veterinary Surgery': 'from-rose-50 to-rose-100 text-rose-500',
  'Diagnostic Laboratories': 'from-violet-50 to-violet-100 text-violet-500',
  'Ultrasound': 'from-cyan-50 to-cyan-100 text-cyan-600',
  'Dentistry': 'from-emerald-50 to-emerald-100 text-emerald-600',
  'Confinement': 'from-indigo-50 to-indigo-100 text-indigo-500',
  'Emergency Care': 'from-red-50 to-red-100 text-red-500',
  'Injections': 'from-yellow-50 to-yellow-100 text-yellow-600',
  'Pet Insurance': 'from-blue-50 to-blue-100 text-blue-600',
}
const CAT_TILE_FALLBACK = 'from-sage-50 to-sage-100 text-teal-600'

const HERO_CHIPS = [
  '🩺 Vet & grooming under one roof',
  '📅 Book online in minutes',
  '🚶 Walk-ins welcome',
]

export default function Services() {
  const [params, setParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [detail, setDetail] = useState(null)
  const navigate = useNavigate()

  const activeCat = params.get('cat') || ''

  const load = () => {
    setLoading(true)
    setLoadError('')
    Promise.all([api.services(), api.categories()])
      .then(([sv, cats]) => { setServices(sv); setCategories(cats) })
      .catch((e) => setLoadError(e?.message || 'Could not load services.'))
      .finally(() => setLoading(false))
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const grouped = useMemo(() => {
    const filtered = activeCat ? services.filter((s) => s.category === activeCat) : services
    const map = {}
    for (const s of filtered) (map[s.category] ??= []).push(s)
    return map
  }, [services, activeCat])

  const speciesLine = (s) =>
    tierSpecies(s.weight_tier) === 'any'
      ? '🐾 For any pet'
      : `${speciesEmoji(tierSpecies(s.weight_tier))} For ${tierLabel(s.weight_tier)}`

  const tileCls = (cat) => `grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${CAT_TILES[cat] || CAT_TILE_FALLBACK}`

  return (
    <>
      {/* ── Hero banner ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-white/[0.03]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-amber-500/[0.06]" />
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <nav className="flex items-center gap-2 text-xs font-semibold text-teal-200/70">
            <Link to="/" className="transition-colors hover:text-white">Home</Link>
            <span className="text-teal-300/40">/</span>
            <span className="text-white">Services</span>
          </nav>
          <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Everything your pet needs,{' '}
            <span className="text-amber-400">in one place</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-teal-100/80">
            From routine check-ups to surgery and grooming — tap any service for details, pricing, and pre-visit instructions.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {HERO_CHIPS.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-teal-50 backdrop-blur-sm"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-8 pt-14 lg:px-8">
        {loading ? (
          <Spinner label="Loading services…" />
        ) : (
          <>
            {loadError && (
              <div className="mt-4">
                <EmptyState icon="⚠️" title="Couldn't load services">
                  {loadError} — the clinic server may be offline.
                  <div className="mt-5">
                    <Button variant="outline" size="sm" onClick={load}>Try again</Button>
                  </div>
                </EmptyState>
              </div>
            )}

            {!loadError && (
              <>
                {/* Category chips */}
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => setParams({})}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-200',
                      !activeCat
                        ? 'border-transparent bg-teal-600 text-white shadow-md shadow-teal-600/25'
                        : 'border-sage-200 bg-white text-teal-700 hover:border-teal-600/40 hover:bg-sage-50'
                    )}
                  >
                    <span>🐾</span>
                    All services
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.category}
                      onClick={() => setParams({ cat: c.category })}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-200',
                        activeCat === c.category
                          ? 'border-transparent bg-teal-600 text-white shadow-md shadow-teal-600/25'
                          : 'border-sage-200 bg-white text-teal-700 hover:border-teal-600/40 hover:bg-sage-50'
                      )}
                    >
                      <span>{CAT_ICONS[c.category] || '🐾'}</span>
                      {c.category}
                      <span
                        className={cx(
                          'rounded-full px-2 py-0.5 text-xs',
                          activeCat === c.category ? 'bg-white/20 text-white' : 'bg-sage-100 text-charcoal-400'
                        )}
                      >
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>

                {Object.keys(grouped).length === 0 ? (
                  <div className="mt-14">
                    <EmptyState title="No services here yet" />
                  </div>
                ) : (
                  <>
                    {/* Service groups */}
                    {Object.entries(grouped).map(([cat, list]) => (
                      <section key={cat} className="mt-16">
                        <div className="flex items-center gap-4">
                          <span className={cx(tileCls(cat), 'h-14 w-14 text-2xl')}>{CAT_ICONS[cat] || '🐾'}</span>
                          <div>
                            <h2 className="text-xl font-extrabold text-charcoal-900">{cat}</h2>
                            {CAT_DESCRIPTIONS[cat] && (
                              <p className="mt-0.5 text-sm text-charcoal-400">{CAT_DESCRIPTIONS[cat]}</p>
                            )}
                          </div>
                          <span className="ml-auto hidden text-xs font-semibold uppercase tracking-wider text-charcoal-300 sm:block">
                            {list.length} service{list.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="mt-6 h-px bg-sage-200/60" />
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map((s) => (
                            <Card
                              key={s.service_id}
                              className="group relative flex flex-col overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                            >
                              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 to-amber-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                              <div className="flex flex-1 flex-col p-7">
                                <div className="flex items-start justify-between gap-3">
                                  <span className={cx(tileCls(s.category), 'h-12 w-12 text-xl')}>
                                    {CAT_ICONS[s.category] || '🐾'}
                                  </span>
                                  {s.client_bookable ? (
                                    <Badge color="teal">Book online</Badge>
                                  ) : (
                                    <Badge color="gray">Clinic only</Badge>
                                  )}
                                </div>
                                <h3 className="mt-4 font-bold text-charcoal-900">{s.name}</h3>
                                <p className="mt-2 flex-1 text-sm text-charcoal-500 leading-relaxed">
                                  {s.description || `${s.category} service.`}
                                </p>
                                <p className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-sage-50 px-3 py-1 text-xs font-semibold text-teal-700">
                                  {speciesLine(s)}
                                </p>
                                <div className="mt-5 flex items-end justify-between border-t border-sage-100 pt-5">
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-300">Price</p>
                                    <p className="mt-0.5 text-lg font-extrabold text-teal-600">{fmtMoney(s)}</p>
                                  </div>
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-400">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="9" />
                                      <path d="M12 7v5l3 2" />
                                    </svg>
                                    {s.duration_minutes ? `~${s.duration_minutes} min` : 'Varies'}
                                  </span>
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
                              </div>
                            </Card>
                          ))}
                        </div>
                      </section>
                    ))}

                    {/* ── Bottom CTA ── */}
                    <section className="relative mt-20 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 px-8 py-14 text-center shadow-card sm:px-14">
                      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/[0.05]" />
                      <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-500/[0.08]" />
                      <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Not sure what your pet needs?</h2>
                      <p className="mx-auto mt-3 max-w-xl leading-relaxed text-teal-100/80">
                        Book a consultation and our vets will guide you — or browse transparent pricing for every service we offer.
                      </p>
                      <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <Button variant="accent" size="lg" onClick={() => navigate('/book')}>
                          Book an appointment
                        </Button>
                        <Link
                          to="/pricing"
                          className="inline-flex items-center rounded-[var(--radius-button)] border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:border-white/40"
                        >
                          View pricing
                        </Link>
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge color="gray">{detail.category}</Badge>
              <Badge color="sage">{speciesLine(detail)}</Badge>
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
            <p className="mt-4 text-xs leading-relaxed text-charcoal-400">
              {detail.weight_tier && detail.weight_tier !== 'any'
                ? 'Prices vary by your pet\u2019s size and weight. '
                : ''}
              The final price is confirmed after the consultation — payment is made at the clinic.
            </p>
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
    </>
  )
}

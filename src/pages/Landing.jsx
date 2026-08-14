import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { Button, Card, SectionHeading, Spinner } from '../components/ui.jsx'

const FEATURES = [
  { icon: '🩺', title: 'Complete Medical Care', text: 'Check-ups, vaccines, diagnostics, and surgery under one roof.' },
  { icon: '⏱️', title: 'On-Time Appointments', text: 'Book online and skip the wait. Slots are held for 20–30 minutes after your scheduled time.' },
  { icon: '💰', title: 'Transparent Pricing', text: 'Clear, published price ranges per service — no surprise charges.' },
  { icon: '🆘', title: 'Emergency-Friendly', text: 'Walk-ins and ER cases are handled immediately at the counter, no account needed.' },
]

const ROLE_LABEL = { vet: 'Veterinarian', groomer: 'Groomer', admin: 'Clinic Team' }

export default function Landing() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.team().then(setTeam).catch(() => setTeam([])).finally(() => setLoading(false))
  }, [])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-teal-600">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-50">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Open Mon–Sat · 9AM–6PM
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              We Welcome Your <span className="text-amber-400">Furbabies</span> Here
            </h1>
            <p className="mt-4 max-w-md text-lg text-teal-100">
              Warm, modern veterinary care for dogs, cats, and every pet in between — from routine check-ups to grooming and surgery.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="accent" size="lg" onClick={() => (location.href = '/book')}>Book an Appointment</Button>
              <Link to="/services" className="inline-flex items-center rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white hover:bg-white/10">
                Browse Services
              </Link>
            </div>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {[['8+', 'Years of care'], ['10k+', 'Pets treated'], ['4.9★', 'Client rating']].map(([n, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold text-white">{n}</p>
                  <p className="text-xs text-teal-100/80">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="text-3xl">🐶</div>
                <p className="mt-2 font-bold text-charcoal-900">Bella</p>
                <p className="text-xs text-charcoal-400">Shih Tzu · Check-up done</p>
              </Card>
              <Card className="mt-10 p-5">
                <div className="text-3xl">🐱</div>
                <p className="mt-2 font-bold text-charcoal-900">Mochi</p>
                <p className="text-xs text-charcoal-400">Persian · Groomed today</p>
              </Card>
              <Card className="p-5">
                <div className="text-3xl">🐕</div>
                <p className="mt-2 font-bold text-charcoal-900">Bantay</p>
                <p className="text-xs text-charcoal-400">Aspin · Neutered</p>
              </Card>
              <Card className="mt-10 bg-amber-500 p-5">
                <p className="text-sm font-bold text-white">Vaccination Day</p>
                <p className="text-xs text-white/90">5-in-1 &amp; Rabies available daily</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Services teaser */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading eyebrow="What we do" title="Care for every stage of their life" subtitle="Two specialities, one team that knows your pet by name." />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link to="/services?cat=Consultation+%26+Check-Up" className="group relative overflow-hidden rounded-3xl bg-sage-100 p-8 transition hover:shadow-lg">
            <div className="text-4xl">🩺</div>
            <h3 className="mt-4 text-2xl font-extrabold text-teal-700">Veterinary Care</h3>
            <p className="mt-2 text-charcoal-600">Consultations, vaccinations, digital x-ray, diagnostics, surgery, and confinement for when they need extra care.</p>
            <span className="mt-4 inline-block font-semibold text-teal-600 group-hover:underline">Explore vet services →</span>
          </Link>
          <Link to="/services?cat=Pet+Grooming" className="group relative overflow-hidden rounded-3xl bg-sage-100 p-8 transition hover:shadow-lg">
            <div className="text-4xl">✂️</div>
            <h3 className="mt-4 text-2xl font-extrabold text-teal-700">Grooming &amp; Spa</h3>
            <p className="mt-2 text-charcoal-600">Baths, full grooms, nail trims, and de-matting — priced by size, from teacup to XXXL.</p>
            <span className="mt-4 inline-block font-semibold text-teal-600 group-hover:underline">Explore grooming services →</span>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-sage-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading eyebrow="Why PetVibe" title="Care you can count on" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 font-bold text-charcoal-900">{f.title}</h3>
                <p className="mt-1 text-sm text-charcoal-400">{f.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the team */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading eyebrow="Meet the team" title="The people behind the paws" subtitle="Veterinarians and groomers who treat your pet like family." />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? <Spinner /> : team.map((t) => (
            <Card key={t.staff_id} className="p-6 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage-100 text-2xl">
                {t.role === 'groomer' ? '✂️' : '🩺'}
              </div>
              <h3 className="mt-3 font-bold text-charcoal-900">{t.full_name}</h3>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">{ROLE_LABEL[t.role]}</p>
              {t.specialization && <p className="mt-2 text-sm text-charcoal-400">{t.specialization}</p>}
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-3xl bg-amber-500 px-8 py-14 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Ready when your pet is?</h2>
          <p className="mx-auto mt-3 max-w-xl text-amber-50">Book online in under a minute. Check-ups, x-rays, and spay/neuter can be scheduled right now.</p>
          <Button variant="primary" size="lg" className="mt-6" onClick={() => (location.href = '/book')}>Book an Appointment</Button>
        </div>
      </section>
    </>
  )
}

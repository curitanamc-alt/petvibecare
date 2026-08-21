import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { SPECIES } from '../lib/species.js'
import { Button, Card, SectionHeading, Spinner } from '../components/ui.jsx'

const FEATURES = [
  { icon: '🩺', title: 'Complete Medical Care', text: 'Check-ups, vaccines, diagnostics, and surgery under one roof.' },
  { icon: '⏱️', title: 'On-Time Appointments', text: 'Book online and skip the wait. Slots are held for 20–30 minutes.' },
  { icon: '💰', title: 'Transparent Pricing', text: 'Clear, published price ranges — no surprise charges at checkout.' },
  { icon: '🆘', title: 'Emergency-Friendly', text: 'Walk-ins and ER cases handled immediately at the counter.' },
]

// Species cards for the "We Welcome Your Furkids Here!" grid — derived from the
// shared SPECIES enum (lib/species.js) so the landing page stays in sync with the
// species pickers used in the pet forms. Each card links to the Services page's
// species filter. Every species has a photo in /public; the emoji stays as a
// fallback in case a photo is ever missing.
const SPECIES_PHOTOS = {
  dog: '/dog.jpg',
  cat: '/cat.jpg',
  bird: '/bird.jpg',
  guinea_pig: '/guineapig.jpg',
  pig: '/pig.jpg',
  rabbit: '/rabbit.jpg',
  rat: '/fancyrat.jpg',
  other: '/other.jpg',
}
const SPECIES_CARDS = ['dog', 'cat', 'bird', 'guinea_pig', 'rabbit', 'pig', 'rat', 'other']
  .map((value) => SPECIES.find((s) => s.value === value))
  .map((s) => ({ ...s, photo: SPECIES_PHOTOS[s.value] || null, tagline: s.value === 'other' ? '& more' : null }))

const TESTIMONIALS = [
  { name: 'Maria S.', pet: 'Bella (Shih Tzu)', text: 'Dr. Reyes is amazing with Bella. She always explains everything clearly and makes sure we understand the treatment plan. The online booking is so convenient!', rating: 5 },
  { name: 'Juan D.', pet: 'Bantay (Aspin)', text: 'Quick, professional, and affordable. They neutered my rescue dog and the recovery was smooth. Highly recommend PetVibe for any pet owner.', rating: 5 },
  { name: 'Ana L.', pet: 'Mochi (Persian)', text: 'The grooming service is top-notch. Mochi comes out looking and smelling great every time. The online booking saves me so much time.', rating: 5 },
]

const ROLE_LABEL = { vet: 'Veterinarian', groomer: 'Groomer', admin: 'Clinic Team' }

// Display order for the "Meet the team" grid — Elinor (director) in the middle of
// the top row, Sophia top-left, and the rest following in their DB order. Any
// staff member not listed here is appended at the end, so new hires still show.
const TEAM_ORDER = [
  'Dr. Sophia Sayaman',
  'Dr. Elinor Romero',
  'Dr. Antoinette Curitana',
  'Dr. Marty Palmenco',
  'Dr. Rainiel Pallaya',
]
const orderTeam = (list) =>
  [...list].sort((a, b) => TEAM_ORDER.indexOf(a.full_name) - TEAM_ORDER.indexOf(b.full_name))

export default function Landing() {
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.team().then((list) => setTeam(orderTeam(list))).catch(() => setTeam([])).finally(() => setLoading(false))
  }, [])

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-white/[0.03]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[400px] w-[400px] rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-amber-500/[0.06]" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-28 lg:grid-cols-2 lg:py-36 lg:px-8">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-teal-50 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Open Mon–Sat · 9AM–6PM
            </div>
            <h1 className="mt-8 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              We Welcome Your{' '}
              <span className="relative">
                <span className="text-amber-400">Furbabies</span>
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8 C50 2, 150 2, 198 8" stroke="#ff8c42" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
                </svg>
              </span>{' '}
              Here
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-teal-100/80">
              Warm, modern veterinary care for dogs, cats, and every pet in between — from routine check-ups to grooming and surgery.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button variant="accent" size="lg" onClick={() => (location.href = '/book')}>
                Book an Appointment
              </Button>
              <Link
                to="/services"
                className="inline-flex items-center rounded-[var(--radius-button)] border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:border-white/40"
              >
                Browse Services
              </Link>
            </div>
            <div className="mt-14 grid max-w-md grid-cols-3 gap-8">
              {[
                ['8+', 'Years of care'],
                ['10k+', 'Pets treated'],
                ['4.9★', 'Client rating'],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold text-white">{n}</p>
                  <p className="mt-1 text-xs text-teal-200/60">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Hero photo collage (desktop) ── */}
          <div className="relative hidden lg:block">
            {/* soft glows behind the collage */}
            <div className="pointer-events-none absolute -left-12 top-6 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <span className="pointer-events-none absolute -top-10 right-6 animate-bounce text-4xl opacity-50" style={{ animationDuration: '3s' }}>🐾</span>
            <span className="pointer-events-none absolute bottom-2 left-0 animate-bounce text-3xl opacity-40" style={{ animationDuration: '3.6s' }}>🦴</span>

            <div className="relative grid grid-cols-2 gap-6">
              {/* Bella */}
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <Card className="group overflow-hidden border-white/40 p-0 shadow-2xl transition-all duration-300 hover:-translate-y-1.5">
                  <div className="flex items-center bg-gradient-to-r from-sky-200 via-teal-100 to-sage-200 px-4 py-2.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-teal-700 shadow-sm">✓ Check-up done</span>
                  </div>
                  <div className="bg-white p-4">
                    <p className="font-extrabold text-charcoal-900">Bella</p>
                    <p className="mt-0.5 text-xs text-charcoal-400">Shih Tzu · 5.2 kg</p>
                  </div>
                </Card>
              </div>

              {/* Mochi */}
              <div className="mt-14 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <Card className="group overflow-hidden border-white/40 p-0 shadow-2xl transition-all duration-300 hover:-translate-y-1.5">
                  <div className="flex items-center bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 px-4 py-2.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-amber-600 shadow-sm">✓ Groomed today</span>
                  </div>
                  <div className="bg-white p-4">
                    <p className="font-extrabold text-charcoal-900">Mochi</p>
                    <p className="mt-0.5 text-xs text-charcoal-400">Persian · 4.1 kg</p>
                  </div>
                </Card>
              </div>

              {/* Bantay */}
              <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <Card className="group overflow-hidden border-white/40 p-0 shadow-2xl transition-all duration-300 hover:-translate-y-1.5">
                  <div className="flex items-center bg-gradient-to-r from-emerald-100 via-sage-100 to-lime-100 px-4 py-2.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-emerald-600 shadow-sm">✓ Neutered</span>
                  </div>
                  <div className="bg-white p-4">
                    <p className="font-extrabold text-charcoal-900">Bantay</p>
                    <p className="mt-0.5 text-xs text-charcoal-400">Aspin · 18 kg</p>
                  </div>
                </Card>
              </div>

              {/* Vaccination promo */}
              <div className="mt-14 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-amber-600 p-6 shadow-2xl transition-all duration-300 hover:-translate-y-1.5">
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15" />
                  <p className="text-3xl">💉</p>
                  <p className="mt-3 font-extrabold text-white">Vaccination Day</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/85">5-in-1 &amp; Rabies available daily · Walk-ins welcome</p>
                </Card>
              </div>
            </div>

            {/* floating glass badge */}
            <div className="absolute -bottom-5 left-8 flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-100 text-base">🩺</span>
              <div>
                <p className="text-xs font-extrabold text-charcoal-900">Open Mon–Sat</p>
                <p className="text-[10px] text-charcoal-400">9AM – 6PM · Walk-ins welcome</p>
              </div>
            </div>
          </div>

          {/* ── Hero pet strip (mobile / tablet) ── */}
          <div className="flex gap-3 overflow-x-auto pb-1 lg:col-span-2 lg:hidden">
            {[
              { name: 'Bella', sub: 'Shih Tzu' },
              { name: 'Mochi', sub: 'Persian' },
              { name: 'Bantay', sub: 'Aspin' },
            ].map((p) => (
              <div key={p.name} className="flex min-w-[8.5rem] items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <div>
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className="text-[10px] text-teal-100/70">{p.sub}</p>
                </div>
              </div>
            ))}
            <div className="flex min-w-[8.5rem] items-center gap-3 rounded-2xl bg-amber-500/25 p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 text-2xl">💉</span>
              <div>
                <p className="text-sm font-bold text-white">Vaccination Day</p>
                <p className="text-[10px] text-amber-100/80">Walk-ins welcome</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── We Welcome Your Furkids Here ── */}
      <section className="bg-sage-50/80 py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            title="We Welcome Your Furkids Here!"
            subtitle="Your pets deserve the best care, comfort, and love. At PetVibe Care, we're here to keep your furkids happy, healthy, and well cared for every step of the way. 💙🐾🐰"
          />
          <div className="mt-14 grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-4">
            {SPECIES_CARDS.map((sp) => (
              <Link
                key={sp.value}
                to={`/services?species=${sp.value}`}
                className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 to-teal-800 shadow-card ring-1 ring-inset ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="relative aspect-[4/5]">
                  {sp.photo ? (
                    <img src={sp.photo} alt={sp.label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  ) : (
                    <span className="absolute inset-x-0 -bottom-7 z-0 grid place-items-center text-8xl leading-none drop-shadow-lg transition-transform duration-300 group-hover:scale-110">
                      {sp.emoji}
                    </span>
                  )}
                  {/* soft top overlay keeps the label legible above the photo */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-900/60 via-transparent to-transparent" />
                  <span className="absolute left-5 top-5 z-10">
                    <span className="block text-sm font-extrabold uppercase tracking-wider text-white drop-shadow-sm">{sp.label}</span>
                    {sp.tagline && <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-teal-100/80">{sp.tagline}</span>}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services teaser ── */}
      <section className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
        <SectionHeading
          eyebrow="What we do"
          title="Care for every stage of their life"
          subtitle="Two specialities, one team that knows your pet by name."
        />
        <div className="mt-14 grid gap-8 md:grid-cols-2">
          <Link
            to="/services?cat=Consultation+%26+Check-Up"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-sage-50 to-sage-100 p-10 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
          >
            <div className="text-5xl">🩺</div>
            <h3 className="mt-6 text-2xl font-extrabold text-teal-700">Veterinary Care</h3>
            <p className="mt-3 text-charcoal-600 leading-relaxed">
              Consultations, vaccinations, digital x-ray, diagnostics, surgery, and confinement for when they need extra care.
            </p>
            <span className="mt-6 inline-flex items-center gap-1 font-semibold text-teal-600 transition-all duration-200 group-hover:gap-2">
              Explore vet services
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </span>
          </Link>
          <Link
            to="/services?cat=Pet+Grooming"
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-sage-50 to-sage-100 p-10 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
          >
            <div className="text-5xl">✂️</div>
            <h3 className="mt-6 text-2xl font-extrabold text-teal-700">Grooming &amp; Spa</h3>
            <p className="mt-3 text-charcoal-600 leading-relaxed">
              Baths, full grooms, nail trims, and de-matting — priced by size, from teacup to XXXL.
            </p>
            <span className="mt-6 inline-flex items-center gap-1 font-semibold text-teal-600 transition-all duration-200 group-hover:gap-2">
              Explore grooming services
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </span>
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-sage-50/80 py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading eyebrow="Why PetVibe" title="Care you can count on" />
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sage-100 text-3xl">{f.icon}</div>
                <h3 className="mt-5 font-bold text-charcoal-900">{f.title}</h3>
                <p className="mt-2 text-sm text-charcoal-500 leading-relaxed">{f.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet the team ── */}
      <section className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
        <SectionHeading
          eyebrow="Meet the team"
          title="The people behind the paws"
          subtitle="Veterinarians and groomers who treat your pet like family."
        />
        <div className="mt-14 flex flex-wrap justify-center gap-7">
          {loading ? (
            <Spinner />
          ) : (
            team.map((t) => (
              <Card
                key={t.staff_id}
                className="flex w-full max-w-sm flex-col items-center p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:max-w-none sm:w-[calc(50%-0.875rem)] lg:w-[calc(33.333%-1.1667rem)]"
              >
                <div className="grid h-[4.5rem] w-[4.5rem] place-items-center overflow-hidden rounded-2xl bg-sage-100 text-2xl ring-1 ring-inset ring-sage-200">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-teal-300">{t.role === 'groomer' ? '✂️' : '🩺'}</span>
                  )}
                </div>
                <h3 className="mt-5 font-bold text-charcoal-900">{t.full_name}</h3>
                <p className="mt-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">{ROLE_LABEL[t.role] || t.role}</p>
                <p className="mt-2.5 min-h-[1.25rem] text-sm leading-5 text-charcoal-500">{t.specialization || ''}</p>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-sage-50/80 py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionHeading
            eyebrow="Happy pet parents"
            title="What our clients say"
            subtitle="Real feedback from pet owners who trust us with their furbabies."
          />
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} className="p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="flex gap-1 text-amber-500">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-charcoal-600">"{t.text}"</p>
                <div className="mt-6 border-t border-sage-200 pt-5">
                  <p className="font-bold text-charcoal-900">{t.name}</p>
                  <p className="text-xs text-charcoal-400">{t.pet}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-6 pb-8 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 px-10 py-20 text-center">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/[0.07]" />
          <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">Ready when your pet is?</h2>
          <p className="relative mx-auto mt-5 max-w-xl text-amber-50/80 leading-relaxed">
            Book online in under a minute. Check-ups, x-rays, and spay/neuter can be scheduled right now.
          </p>
          <Button variant="primary" size="lg" className="relative mt-8" onClick={() => (location.href = '/book')}>
            Book an Appointment
          </Button>
        </div>
      </section>
    </>
  )
}

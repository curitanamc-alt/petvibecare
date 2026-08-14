// In-browser mock of the PetVibe API — activated automatically when the
// Express server is unreachable, or forced with ?mock=1 / VITE_API_MODE=mock.
// Mirrors the endpoints in server/index.js closely enough for the UI to work.

const today = new Date()
const iso = (offset = 0) => {
  const x = new Date(today)
  x.setDate(x.getDate() + offset)
  return x.toISOString().slice(0, 10)
}
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const PASSWORD = 'password123'

const S = (name, category, price_min, price_max, duration_minutes, opts = {}) => ({
  service_id: 0, name, category, price_min, price_max, duration_minutes,
  description: opts.description ?? '', requires_fasting: opts.requires_fasting ? 1 : 0,
  requires_anesthesia: opts.requires_anesthesia ? 1 : 0,
  recovery_time_hours: opts.recovery_time_hours ?? null,
  weight_requirement: opts.weight_requirement ?? null,
  weight_tier: opts.weight_tier ?? null,
  client_bookable: opts.client_bookable ? 1 : 0,
})

function seedServices() {
  const defs = [
    S('General Consultation', 'Consultation & Check-Up', 400, 500, 30, { client_bookable: true, description: 'Full physical exam, history review, and treatment plan for any concern.' }),
    S('New Patient Consultation', 'Consultation & Check-Up', 450, 500, 45, { client_bookable: true }),
    S('Follow-up Consultation', 'Consultation & Check-Up', 300, 350, 20, { client_bookable: true }),
    S('Senior Pet Wellness Check-up', 'Consultation & Check-Up', 500, 600, 45, { client_bookable: true }),
    S('5-in-1 Vaccine', 'Vaccination & Deworming', 600, 700, 30, { client_bookable: true }),
    S('Rabies Vaccine', 'Vaccination & Deworming', 400, 500, 30, { client_bookable: true }),
    S('8-in-1 Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true }),
    S('Deworming (Tablet)', 'Vaccination & Deworming', 150, 250, 20, { client_bookable: true }),
    S('Puppy Vaccination Series', 'Vaccination & Deworming', 1500, 2500, 45, { client_bookable: true }),
    S('Feline 4-in-1 Vaccine (FVRCP)', 'Vaccination & Deworming', 700, 800, 30, { client_bookable: true }),
    S('Digital X-Ray', 'Digital X-Ray', 800, 1500, 20, { client_bookable: true, description: 'High-resolution digital radiographs, reviewed with you on-screen.' }),
    S('Bath & Blow Dry — Small Dog', 'Pet Grooming', 250, 350, 60, { client_bookable: true, weight_tier: 'small' }),
    S('Bath & Blow Dry — Medium Dog', 'Pet Grooming', 350, 450, 75, { client_bookable: true, weight_tier: 'medium' }),
    S('Bath & Blow Dry — Large Dog', 'Pet Grooming', 450, 600, 90, { client_bookable: true, weight_tier: 'large' }),
    S('Bath & Blow Dry — Cat', 'Pet Grooming', 300, 400, 60, { client_bookable: true, weight_tier: 'cat' }),
    S('Full Groom Package — Small Dog', 'Pet Grooming', 500, 650, 120, { client_bookable: true, weight_tier: 'small' }),
    S('Full Groom Package — Cat', 'Pet Grooming', 600, 800, 120, { client_bookable: true, weight_tier: 'cat' }),
    S('Nail Trim & Ear Cleaning', 'Pet Grooming', 100, 150, 20, { client_bookable: true }),
    S('De-matting Service', 'Pet Grooming', 500, 1000, 90, { client_bookable: true }),
    S('Nutrition Counseling', 'Nutrition Counseling', 350, 400, 30, { client_bookable: true }),
    S('Behavioral Consultation', 'Behavioral Consultation', 600, 800, 45, { client_bookable: true }),
    S('Travel / Health Certificate', 'Travel / Health Certificates', 450, 550, 30, { client_bookable: true }),
    S('Spay (Female) — Ovariohysterectomy', 'Veterinary Surgery', 2500, 4500, 120, { client_bookable: true, requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 48, weight_requirement: 'Minimum 1.5 kg' }),
    S('Neuter (Male) — Castration', 'Veterinary Surgery', 2000, 3500, 90, { client_bookable: true, requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 24, weight_requirement: 'Minimum 1.5 kg' }),
    S('C-Section (Caesarean)', 'Veterinary Surgery', 8000, 15000, 180, { requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 72 }),
    S('Mass / Tumor Removal', 'Veterinary Surgery', 5000, 10000, 120, { requires_anesthesia: true }),
    S('Complete Blood Count (CBC)', 'Diagnostic Laboratories', 500, 800, 15, {}),
    S('Blood Chemistry Panel', 'Diagnostic Laboratories', 1500, 2500, 15, {}),
    S('Fecalysis', 'Diagnostic Laboratories', 200, 300, 15, {}),
    S('Heartworm Test', 'Diagnostic Laboratories', 600, 800, 15, {}),
    S('Parvo Test (CPV)', 'Diagnostic Laboratories', 500, 600, 15, {}),
    S('Blood Extraction / Venipuncture', 'Blood Extraction', 150, 250, 15, {}),
    S('Fecal Antigen Test (Giardia/Parvo)', 'Fecal Antigen Testing', 400, 600, 15, {}),
    S('Abdominal Ultrasound', 'Ultrasound', 1200, 2000, 30, { requires_fasting: true }),
    S('Cardiac Ultrasound (Echo)', 'Ultrasound', 2500, 4000, 45, {}),
    S('Dental Cleaning (Scaling & Polishing)', 'Dentistry', 2500, 4000, 90, { requires_fasting: true, requires_anesthesia: true }),
    S('Laser Therapy Session', 'Laser Therapy', 500, 900, 30, {}),
    S('Physical Therapy / Rehab Session', 'Physical Rehabilitation', 800, 1200, 45, {}),
    S('Confinement / Boarding (per day)', 'Confinement', 800, 1500, 1440, {}),
    S('ICU Confinement (per day)', 'Confinement', 2500, 4000, 1440, {}),
    S('Emergency Consultation (Walk-in/ER)', 'Emergency Care', 1500, 2500, 45, {}),
    S('Allergy Testing (Intradermal)', 'Pet Allergy Testing', 3500, 5000, 60, {}),
    S('Medication Dispensing', 'Pharmacy / Medication Dispensing', 100, 1000, 15, {}),
    S('Hospice & Euthanasia Care', 'Hospice & Euthanasia Care', 2500, 3500, 60, {}),
    S('Vitamin Injection', 'Injections', 150, 250, 15, {}),
    S('Antibiotic Injection', 'Injections', 250, 400, 15, {}),
    S('Fluid Therapy (IV)', 'Injections', 400, 800, 30, {}),
  ]
  return defs.map((s, i) => ({ ...s, service_id: i + 1 }))
}

function seedBundles(services) {
  const byName = Object.fromEntries(services.map((s) => [s.name, s]))
  const pick = (names) => names.map((n) => byName[n]).filter(Boolean)
  return [
    { bundle_id: 1, name: 'Puppy Starter Bundle', description: 'Everything a new puppy needs: check-up, core vaccines, deworming, and a grooming intro.', price: 2500, discount_percent: 15, services: pick(['New Patient Consultation', '5-in-1 Vaccine', 'Deworming (Tablet)', 'Nail Trim & Ear Cleaning']) },
    { bundle_id: 2, name: 'Adult Wellness Bundle', description: 'Annual wellness visit with blood work and deworming.', price: 1800, discount_percent: 10, services: pick(['General Consultation', 'Complete Blood Count (CBC)', 'Deworming (Tablet)']) },
    { bundle_id: 3, name: 'Senior Care Bundle', description: 'Geriatric exam plus full blood panel for pets 7 years and up.', price: 3200, discount_percent: 15, services: pick(['Senior Pet Wellness Check-up', 'Complete Blood Count (CBC)', 'Blood Chemistry Panel']) },
    { bundle_id: 4, name: 'Spa Day Bundle', description: 'Full groom plus nail trim for a fresh, healthy coat.', price: 1200, discount_percent: 10, services: pick(['Full Groom Package — Small Dog', 'Nail Trim & Ear Cleaning']) },
  ]
}

let state = null
function reset() {
  const services = seedServices()
  state = {
    services,
    bundles: seedBundles(services),
    staff: [
      { staff_id: 1, full_name: 'Dr. Ana Reyes', role: 'admin', email: 'admin@petvibe.ph', specialization: 'Clinic Director', active: 1 },
      { staff_id: 2, full_name: 'Dr. Marco Lim', role: 'vet', email: 'vet@petvibe.ph', specialization: 'Surgery & Orthopedics', active: 1 },
      { staff_id: 3, full_name: 'Dr. Grace Tan', role: 'vet', email: 'grace@petvibe.ph', specialization: 'Internal Medicine & Diagnostics', active: 1 },
      { staff_id: 4, full_name: 'Liza Cruz', role: 'groomer', email: 'liza@petvibe.ph', specialization: 'Grooming & Spa', active: 1 },
    ],
    owners: [
      { owner_id: 1, full_name: 'Maria Santos', email: 'client@petvibe.ph', phone: '0917 555 1234', password: PASSWORD, address: 'Brgy. San Lorenzo, Makati City', account_type: 'registered' },
      { owner_id: 2, full_name: 'Juan Dela Cruz', email: 'juan.dc@example.com', phone: '0918 555 9876', password: null, address: 'Tondo, Manila', account_type: 'walk_in' },
    ],
    pets: [
      { pet_id: 1, owner_id: 1, name: 'Bella', species: 'dog', breed: 'Shih Tzu', gender: 'female', birthdate: '2021-03-14', weight_kg: 5.2, created_at: iso(-60) },
      { pet_id: 2, owner_id: 1, name: 'Mochi', species: 'cat', breed: 'Persian', gender: 'male', birthdate: '2022-06-01', weight_kg: 4.1, created_at: iso(-45) },
      { pet_id: 3, owner_id: 2, name: 'Bantay', species: 'dog', breed: 'Aspin', gender: 'male', birthdate: '2019-01-10', weight_kg: 18.0, created_at: iso(-30) },
    ],
    bookings: [
      { booking_id: 1, reference_code: 'PV-1001', owner_id: 1, pet_id: 1, service_id: 1, staff_id: 3, booking_date: iso(0), booking_time: '10:00', status: 'confirmed', created_by: 'client', notes: 'Low appetite since Monday.', created_at: iso(-2) },
      { booking_id: 2, reference_code: 'PV-1002', owner_id: 1, pet_id: 2, service_id: 12, staff_id: 4, booking_date: iso(0), booking_time: '14:00', status: 'pending', created_by: 'client', notes: 'Matting behind the ears.', created_at: iso(-1) },
      { booking_id: 3, reference_code: 'PV-1003', owner_id: 1, pet_id: 1, service_id: 11, staff_id: null, booking_date: iso(3), booking_time: '11:00', status: 'pending', created_by: 'client', notes: 'Suspected hip issue, limping.', created_at: iso(0) },
      { booking_id: 4, reference_code: 'PV-1004', owner_id: 2, pet_id: 3, service_id: 24, staff_id: 2, booking_date: iso(1), booking_time: '09:00', status: 'pending', created_by: 'admin', notes: 'Walk-in booking made at counter.', created_at: iso(0) },
      { booking_id: 5, reference_code: 'PV-1005', owner_id: 1, pet_id: 1, service_id: 1, staff_id: 3, booking_date: iso(-6), booking_time: '15:00', status: 'completed', created_by: 'client', notes: 'Annual wellness visit.', created_at: iso(-10) },
      { booking_id: 6, reference_code: 'PV-1006', owner_id: 1, pet_id: 1, service_id: 8, staff_id: 3, booking_date: iso(-5), booking_time: '09:00', status: 'no_show', created_by: 'client', notes: 'Client arrived 45 minutes late; slot forfeited to walk-in.', created_at: iso(-8) },
      { booking_id: 7, reference_code: 'PV-1007', owner_id: 1, pet_id: 1, service_id: 5, staff_id: 2, booking_date: iso(-20), booking_time: '10:00', status: 'completed', created_by: 'client', notes: null, created_at: iso(-22) },
    ],
    records: [
      { record_id: 1, pet_id: 1, booking_id: 7, visit_date: iso(-20), staff_id: 2, diagnosis: 'Healthy — routine vaccination', treatment_notes: '5-in-1 booster administered. No adverse reaction.', vaccinations_given: '5-in-1 Vaccine', weight_at_visit: 5.0, next_due_date: iso(125), created_at: iso(-20) },
      { record_id: 2, pet_id: 1, booking_id: 5, visit_date: iso(-6), staff_id: 3, diagnosis: 'Mild gastritis suspected', treatment_notes: 'Prescribed bland diet for 3 days and GI protectant.', vaccinations_given: null, weight_at_visit: 5.1, next_due_date: null, created_at: iso(-6) },
      { record_id: 3, pet_id: 2, booking_id: null, visit_date: iso(-30), staff_id: 4, diagnosis: 'Healthy — grooming visit', treatment_notes: 'Full groom completed. Skin clear.', vaccinations_given: null, weight_at_visit: 4.0, next_due_date: null, created_at: iso(-30) },
    ],
    schedules: [
      { schedule_id: 1, staff_id: 1, day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 2, staff_id: 1, day_of_week: 2, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 3, staff_id: 1, day_of_week: 3, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 4, staff_id: 1, day_of_week: 4, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 5, staff_id: 1, day_of_week: 5, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 6, staff_id: 2, day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 7, staff_id: 2, day_of_week: 3, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 8, staff_id: 2, day_of_week: 5, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 9, staff_id: 2, day_of_week: 6, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 10, staff_id: 3, day_of_week: 1, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 11, staff_id: 3, day_of_week: 2, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 12, staff_id: 3, day_of_week: 4, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 13, staff_id: 3, day_of_week: 5, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 14, staff_id: 3, day_of_week: 6, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 15, staff_id: 4, day_of_week: 1, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 16, staff_id: 4, day_of_week: 2, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 17, staff_id: 4, day_of_week: 3, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 18, staff_id: 4, day_of_week: 4, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 19, staff_id: 4, day_of_week: 5, start_time: '10:00', end_time: '18:00', is_available: 1 },
      { schedule_id: 20, staff_id: 4, day_of_week: 6, start_time: '10:00', end_time: '18:00', is_available: 1 },
    ],
    notifications: [
      { notification_id: 1, owner_id: 1, booking_id: 1, type: 'confirmation', channel: 'email', sent_at: iso(-2), message_body: 'Your booking PV-1001 is confirmed for ' + iso(0) + ' at 10:00.' },
      { notification_id: 2, owner_id: 1, booking_id: 6, type: 'rebooking', channel: 'email', sent_at: iso(-5), message_body: 'Your slot PV-1006 was forfeited due to late arrival. Please rebook: ' + iso(1) + ' 10:00, ' + iso(1) + ' 14:00, ' + iso(2) + ' 09:00.' },
    ],
    sessions: new Map(),
    seq: { booking: 8, pet: 4, owner: 3, record: 4, staff: 5, schedule: 21 },
  }
}

// ---------- helpers ----------
const svc = (id) => state.services.find((s) => s.service_id === Number(id))
const pet = (id) => state.pets.find((p) => p.pet_id === Number(id))
const owner = (id) => state.owners.find((o) => o.owner_id === Number(id))
const staff = (id) => state.staff.find((s) => s.staff_id === Number(id))
const staffName = (id) => (id ? staff(id)?.full_name : null)
const money = (s) => (s.price_max ? `₱${s.price_min.toLocaleString()}–${s.price_max.toLocaleString()}` : `₱${s.price_min.toLocaleString()}`)

function decorateBooking(b) {
  const p = pet(b.pet_id)
  const s = svc(b.service_id)
  const o = owner(b.owner_id)
  return { ...b, pet_name: p?.name, pet_species: p?.species, pet_breed: p?.breed, pet_weight: p?.weight_kg, owner_name: o?.full_name, owner_phone: o?.phone, owner_email: o?.email, service_name: s?.name, service_category: s?.category, service_price: s?.price_min, staff_name: staffName(b.staff_id), staff_role: staff(b.staff_id)?.role }
}

function decorateRecord(r) {
  const b = state.bookings.find((x) => x.booking_id === r.booking_id)
  return { ...r, staff_name: staffName(r.staff_id), reference_code: b?.reference_code, service_name: b ? svc(b.service_id)?.name : null }
}

function err(status, message) {
  const e = new Error(message)
  e.status = status
  throw e
}

const requireClient = (token) => {
  const sid = state.sessions.get(token)
  const o = sid ? owner(sid.owner_id) : null
  if (!o) err(401, 'Not logged in')
  return o
}
const requireStaff = (token) => {
  const sid = state.sessions.get(token)
  const s = sid ? staff(sid.staff_id) : null
  if (!s) err(401, 'Not logged in')
  return s
}

const TRANSITIONS = { pending: ['confirmed', 'completed', 'cancelled', 'no_show'], confirmed: ['completed', 'cancelled', 'no_show'], completed: [], cancelled: [], no_show: ['rebooked'], rebooked: ['confirmed'] }

// ---------- router ----------
export function mockRequest(method, path, body = {}, token = null) {
  if (!state) reset()
  const qs = path.split('?')
  const p = qs[0]
  const query = Object.fromEntries(new URLSearchParams(qs[1] || ''))
  const m = method.toUpperCase()

  // auth
  if (p === '/auth/login' && m === 'POST') {
    const o = state.owners.find((x) => x.email === body.email)
    if (o && o.password && o.password === body.password) {
      const t = 'mock-client-' + o.owner_id
      state.sessions.set(t, { owner_id: o.owner_id })
      return { token: t, role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type } }
    }
    const s = state.staff.find((x) => x.email === body.email)
    if (s && s.active && body.password === PASSWORD) {
      const t = 'mock-staff-' + s.staff_id
      state.sessions.set(t, { staff_id: s.staff_id })
      return { token: t, role: 'staff', user: { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization } }
    }
    err(401, 'Invalid email or password')
  }
  if (p === '/auth/register' && m === 'POST') {
    if (state.owners.some((o) => o.email === body.email)) err(409, 'An account with this email already exists')
    const o = { owner_id: state.seq.owner++, full_name: body.full_name, email: body.email, phone: body.phone, password: body.password, address: body.address || null, account_type: 'registered' }
    state.owners.push(o)
    const t = 'mock-client-' + o.owner_id
    state.sessions.set(t, { owner_id: o.owner_id })
    return { token: t, role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: 'registered' } }
  }
  if (p === '/auth/me' && m === 'GET') {
    const t = token && (state.sessions.has(token) ? token : null)
    if (!t) err(401, 'Not logged in')
    const sid = state.sessions.get(t)
    if (sid.staff_id) return { role: 'staff', user: { staff_id: sid.staff_id, full_name: staff(sid.staff_id).full_name, role: staff(sid.staff_id).role, email: staff(sid.staff_id).email, specialization: staff(sid.staff_id).specialization } }
    const o = owner(sid.owner_id)
    return { role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type } }
  }
  if (p === '/auth/logout' && m === 'POST') { state.sessions.delete(token); return { ok: true } }
  if (p === '/demo-accounts' && m === 'GET') return [{ label: 'Client', email: 'client@petvibe.ph', password: PASSWORD }, { label: 'Admin/Staff', email: 'admin@petvibe.ph', password: PASSWORD }]

  // public
  if (p === '/services' && m === 'GET') {
    let list = [...state.services]
    if (query.category) list = list.filter((s) => s.category === query.category)
    if (query.bookable === '1') list = list.filter((s) => s.client_bookable)
    return list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }
  if (p === '/services/categories' && m === 'GET') {
    const counts = {}
    for (const s of state.services) counts[s.category] = (counts[s.category] || 0) + 1
    return Object.entries(counts).map(([category, count]) => ({ category, count }))
  }
  if (p === '/bundles' && m === 'GET') return state.bundles
  if (p === '/team' && m === 'GET') return state.staff.filter((s) => s.active).map(({ staff_id, full_name, role, specialization }) => ({ staff_id, full_name, role, specialization }))
  if (p === '/slots' && m === 'GET') {
    const date = query.date || iso()
    const taken = state.bookings.filter((b) => b.booking_date === date && !['cancelled', 'no_show'].includes(b.status)).map((b) => b.booking_time)
    return { date, slots: SLOTS, taken }
  }

  // client
  if (p === '/me' && m === 'GET') {
    const o = requireClient(token)
    return { owner: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type }, pets: state.pets.filter((x) => x.owner_id === o.owner_id) }
  }
  if (p === '/me' && m === 'PUT') {
    const o = requireClient(token)
    Object.assign(o, { full_name: body.full_name ?? o.full_name, phone: body.phone ?? o.phone, address: body.address ?? o.address })
    return { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type }
  }
  if (p === '/pets' && m === 'POST') {
    const o = requireClient(token)
    const pk = { pet_id: state.seq.pet++, owner_id: o.owner_id, name: body.name, species: body.species || 'dog', breed: body.breed || null, gender: body.gender || null, birthdate: body.birthdate || null, weight_kg: body.weight_kg || null, created_at: iso() }
    state.pets.push(pk)
    return pk
  }
  let pm = p.match(/^\/pets\/(\d+)$/)
  if (pm && m === 'PUT') {
    const o = requireClient(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!pk) err(404, 'Pet not found')
    Object.assign(pk, { name: body.name ?? pk.name, species: body.species ?? pk.species, breed: body.breed ?? pk.breed, gender: body.gender ?? pk.gender, birthdate: body.birthdate ?? pk.birthdate, weight_kg: body.weight_kg ?? pk.weight_kg })
    return pk
  }
  if (pm && m === 'DELETE') {
    const o = requireClient(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!pk) err(404, 'Pet not found')
    state.pets = state.pets.filter((x) => x.pet_id !== pk.pet_id)
    return { ok: true }
  }
  pm = p.match(/^\/pets\/(\d+)\/records$/)
  if (pm && m === 'GET') {
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]))
    if (!pk) err(404, 'Pet not found')
    return state.records.filter((r) => r.pet_id === pk.pet_id).map(decorateRecord)
  }
  if (p === '/bookings' && m === 'GET') {
    const o = requireClient(token)
    return state.bookings.filter((b) => b.owner_id === o.owner_id).map(decorateBooking)
  }
  if (p === '/bookings' && m === 'POST') {
    const o = requireClient(token)
    const pk = state.pets.find((x) => x.pet_id === Number(body.pet_id) && x.owner_id === o.owner_id)
    if (!pk) err(404, 'Pet not found')
    const s = svc(body.service_id)
    if (!s) err(404, 'Service not found')
    if (!s.client_bookable) err(403, 'This service can only be booked through the clinic (admin)')
    if (body.booking_date < iso()) err(400, 'Cannot book a past date')
    if (state.bookings.some((b) => b.booking_date === body.booking_date && b.booking_time === body.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken — please pick another')
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: o.owner_id, pet_id: Number(body.pet_id), service_id: Number(body.service_id), staff_id: null, booking_date: body.booking_date, booking_time: body.booking_time, status: 'pending', created_by: 'client', notes: body.notes || null, created_at: iso() }
    state.bookings.push(b)
    state.notifications.unshift({ notification_id: state.notifications.length + 1, owner_id: o.owner_id, booking_id: b.booking_id, type: 'confirmation', channel: 'email', sent_at: iso(), message_body: `Your booking ${b.reference_code} is confirmed for ${b.booking_date} at ${b.booking_time}.` })
    return decorateBooking(b)
  }

  // admin
  if (p === '/admin/stats' && m === 'GET') {
    requireStaff(token)
    const active = (b) => !['cancelled', 'no_show'].includes(b.status)
    return {
      totalPets: state.pets.length,
      totalOwners: state.owners.length,
      todayBookings: state.bookings.filter((b) => b.booking_date === iso() && active(b)).length,
      upcoming: state.bookings.filter((b) => b.booking_date >= iso() && b.status === 'confirmed').length,
      pending: state.bookings.filter((b) => b.status === 'pending').length,
      revenue: state.bookings.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((sum, b) => sum + svc(b.service_id).price_min, 0),
      walkIns: state.owners.filter((o) => o.account_type === 'walk_in').length,
    }
  }
  if (p === '/admin/bookings' && m === 'GET') {
    requireStaff(token)
    let list = state.bookings.map(decorateBooking)
    if (query.status) list = list.filter((b) => b.status === query.status)
    if (query.date) list = list.filter((b) => b.booking_date === query.date)
    if (query.q) list = list.filter((b) => [b.owner_name, b.pet_name, b.reference_code].some((v) => v?.toLowerCase().includes(query.q.toLowerCase())))
    return list.sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)$/)
  if (pm && m === 'GET') {
    requireStaff(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    return { booking: decorateBooking(b), records: state.records.filter((r) => r.booking_id === b.booking_id).map(decorateRecord) }
  }
  if (pm && m === 'PATCH') {
    requireStaff(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    if (body.status) {
      if (!TRANSITIONS[b.status]?.includes(body.status)) err(400, `Cannot move booking from ${b.status} to ${body.status}`)
      b.status = body.status
      if (body.status === 'no_show') {
        const o = owner(b.owner_id)
        state.notifications.unshift({ notification_id: state.notifications.length + 1, owner_id: o.owner_id, booking_id: b.booking_id, type: 'rebooking', channel: 'email', sent_at: iso(), message_body: `Your slot ${b.reference_code} was forfeited due to late arrival. Please rebook: ${iso(1)} 10:00, ${iso(1)} 14:00, ${iso(2)} 09:00.` })
      }
    }
    if (body.staff_id) b.staff_id = Number(body.staff_id)
    if (body.booking_date || body.booking_time) { b.booking_date = body.booking_date || b.booking_date; b.booking_time = body.booking_time || b.booking_time }
    return decorateBooking(b)
  }
  if (p === '/admin/bookings' && m === 'POST') {
    requireStaff(token)
    if (state.bookings.some((b) => b.booking_date === body.booking_date && b.booking_time === body.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken')
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: Number(body.owner_id), pet_id: Number(body.pet_id), service_id: Number(body.service_id), staff_id: body.staff_id || null, booking_date: body.booking_date, booking_time: body.booking_time, status: 'pending', created_by: 'admin', notes: body.notes || null, created_at: iso() }
    state.bookings.push(b)
    return decorateBooking(b)
  }
  if (p === '/admin/pets' && m === 'GET') {
    requireStaff(token)
    let list = state.pets.map((pk) => ({ ...pk, owner_name: owner(pk.owner_id)?.full_name, owner_phone: owner(pk.owner_id)?.phone, booking_count: state.bookings.filter((b) => b.pet_id === pk.pet_id).length }))
    if (query.q) list = list.filter((x) => [x.name, x.owner_name, x.breed].some((v) => v?.toLowerCase().includes(query.q.toLowerCase())))
    return list
  }
  pm = p.match(/^\/admin\/pets\/(\d+)$/)
  if (pm && m === 'GET') {
    requireStaff(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]))
    if (!pk) err(404, 'Pet not found')
    const o = owner(pk.owner_id)
    return { pet: { ...pk, owner_name: o?.full_name, owner_phone: o?.phone, owner_email: o?.email, account_type: o?.account_type }, records: state.records.filter((r) => r.pet_id === pk.pet_id).map(decorateRecord), bookings: state.bookings.filter((b) => b.pet_id === pk.pet_id).map(decorateBooking) }
  }
  pm = p.match(/^\/admin\/pets\/(\d+)\/records$/)
  if (pm && m === 'POST') {
    requireStaff(token)
    const r = { record_id: state.seq.record++, pet_id: Number(pm[1]), booking_id: body.booking_id || null, visit_date: body.visit_date, staff_id: body.staff_id || null, diagnosis: body.diagnosis || null, treatment_notes: body.treatment_notes || null, vaccinations_given: body.vaccinations_given || null, weight_at_visit: body.weight_at_visit || null, next_due_date: body.next_due_date || null, created_at: iso() }
    state.records.push(r)
    return r
  }
  if (p === '/admin/staff' && m === 'GET') {
    requireStaff(token)
    return state.staff.map((s) => ({ ...s, appointment_count: state.bookings.filter((b) => b.staff_id === s.staff_id && ['confirmed', 'completed'].includes(b.status)).length }))
  }
  if (p === '/admin/staff' && m === 'POST') {
    requireStaff(token)
    const s = { staff_id: state.seq.staff++, full_name: body.full_name, role: body.role, email: body.email || null, specialization: body.specialization || null, active: 1 }
    state.staff.push(s)
    return s
  }
  pm = p.match(/^\/admin\/staff\/(\d+)\/toggle$/)
  if (pm && m === 'PATCH') {
    requireStaff(token)
    const s = staff(pm[1])
    if (!s) err(404, 'Staff not found')
    s.active = s.active ? 0 : 1
    return s
  }
  if (p === '/admin/schedule' && m === 'GET') {
    requireStaff(token)
    return state.schedules.map((sc) => ({ ...sc, staff_name: staff(sc.staff_id)?.full_name, staff_role: staff(sc.staff_id)?.role }))
  }
  if (p === '/admin/schedule' && m === 'POST') {
    requireStaff(token)
    const sc = { schedule_id: state.seq.schedule++, staff_id: Number(body.staff_id), day_of_week: Number(body.day_of_week), start_time: body.start_time, end_time: body.end_time, is_available: body.is_available === false ? 0 : 1 }
    state.schedules.push(sc)
    return { ...sc, staff_name: staff(sc.staff_id)?.full_name, staff_role: staff(sc.staff_id)?.role }
  }
  pm = p.match(/^\/admin\/schedule\/(\d+)$/)
  if (pm && m === 'DELETE') {
    requireStaff(token)
    state.schedules = state.schedules.filter((s) => s.schedule_id !== Number(pm[1]))
    return { ok: true }
  }
  if (p === '/admin/walkin' && m === 'POST') {
    requireStaff(token)
    if (state.bookings.some((b) => b.booking_date === body.booking.booking_date && b.booking_time === body.booking.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken')
    const o = { owner_id: state.seq.owner++, full_name: body.owner.full_name, email: body.owner.email || `walkin-${Date.now()}@petvibe.ph`, phone: body.owner.phone, password: null, address: body.owner.address || null, account_type: 'walk_in' }
    state.owners.push(o)
    const pk = { pet_id: state.seq.pet++, owner_id: o.owner_id, name: body.pet.name, species: body.pet.species || 'dog', breed: body.pet.breed || null, gender: body.pet.gender || null, birthdate: body.pet.birthdate || null, weight_kg: body.pet.weight_kg || null, created_at: iso() }
    state.pets.push(pk)
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: o.owner_id, pet_id: pk.pet_id, service_id: Number(body.booking.service_id), staff_id: body.booking.staff_id || null, booking_date: body.booking.booking_date, booking_time: body.booking.booking_time, status: 'pending', created_by: 'admin', notes: body.booking.notes || null, created_at: iso() }
    state.bookings.push(b)
    return { owner_id: o.owner_id, pet_id: pk.pet_id, booking_id: b.booking_id, reference_code: b.reference_code }
  }
  if (p === '/admin/analytics' && m === 'GET') {
    requireStaff(token)
    const days = []
    for (let i = 13; i >= 0; i--) days.push(iso(-i))
    const dayMap = {}
    for (const b of state.bookings) dayMap[b.booking_date] = (dayMap[b.booking_date] || 0) + 1
    const revenueByService = Object.values(state.bookings.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((acc, b) => {
      const s = svc(b.service_id)
      acc[s.service_id] = { name: s.name, category: s.category, bookings: (acc[s.service_id]?.bookings || 0) + 1, revenue: (acc[s.service_id]?.revenue || 0) + s.price_min }
      return acc
    }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
    const statusBreakdown = Object.entries(state.bookings.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc }, {})).map(([status, n]) => ({ status, n }))
    return { bookingsByDay: days.map((date) => ({ date, count: dayMap[date] || 0 })), revenueByService, staffPerformance: state.staff.map((s) => ({ full_name: s.full_name, role: s.role, completed: state.bookings.filter((b) => b.staff_id === s.staff_id && b.status === 'completed').length })).sort((a, b) => b.completed - a.completed), statusBreakdown, topServices: state.bookings.reduce((acc, b) => { const name = svc(b.service_id).name; acc[name] = (acc[name] || 0) + 1; return acc }, {}) }
  }
  if (p === '/admin/notifications' && m === 'GET') {
    requireStaff(token)
    return state.notifications.map((n) => ({ ...n, owner_name: owner(n.owner_id)?.full_name, owner_email: owner(n.owner_id)?.email }))
  }

  err(404, `No mock handler for ${m} ${p}`)
}

// convenience for debugging
export const mockMoney = money

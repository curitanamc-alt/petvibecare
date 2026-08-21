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
  active: opts.active === false ? 0 : 1,
})

function seedServices() {
  const defs = [
    S('General Consultation', 'Consultation & Check-Up', 400, 500, 30, { client_bookable: true, description: 'Full physical exam, history review, and treatment plan for any concern.' }),
    S('New Patient Consultation', 'Consultation & Check-Up', 450, 500, 45, { client_bookable: true }),
    S('Follow-up Consultation', 'Consultation & Check-Up', 300, 350, 20, { client_bookable: true }),
    S('Senior Pet Wellness Check-up', 'Consultation & Check-Up', 500, 600, 45, { client_bookable: true }),
    S('5-in-1 Vaccine', 'Vaccination & Deworming', 600, 700, 30, { client_bookable: true, weight_tier: 'dog' }),
    S('Rabies Vaccine', 'Vaccination & Deworming', 400, 500, 30, { client_bookable: true }),
    S('8-in-1 Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true, weight_tier: 'dog' }),
    S('Deworming (Tablet)', 'Vaccination & Deworming', 150, 250, 20, { client_bookable: true }),
    S('Puppy Vaccination Series', 'Vaccination & Deworming', 1500, 2500, 45, { client_bookable: true, weight_tier: 'dog' }),
    S('Feline 4-in-1 Vaccine (FVRCP)', 'Vaccination & Deworming', 700, 800, 30, { client_bookable: true, weight_tier: 'cat' }),
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
    S('Parvo Test (CPV)', 'Diagnostic Laboratories', 500, 600, 15, { weight_tier: 'dog' }),
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

    // Small pets / birds / pigs — appended LAST on purpose: the mock assigns
    // service_id by array position, so inserting earlier would shift the ids
    // that existing demo bookings reference.
    S('Bath & Grooming — Rabbit', 'Pet Grooming', 300, 450, 60, { client_bookable: true, weight_tier: 'rabbit' }),
    S('Bath & Grooming — Guinea Pig', 'Pet Grooming', 300, 450, 60, { client_bookable: true, weight_tier: 'guinea_pig' }),
    S('Bath & Grooming — Fancy Rat', 'Pet Grooming', 250, 400, 45, { client_bookable: true, weight_tier: 'rat' }),
    S('Wing Trim & Nail Care — Birds', 'Pet Grooming', 200, 350, 30, { client_bookable: true, weight_tier: 'bird' }),
    S('Hoof & Nail Trim — Pig', 'Pet Grooming', 350, 600, 45, { client_bookable: true, weight_tier: 'pig' }),
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
      { staff_id: 1, full_name: 'Dr. Elinor Romero', role: 'admin', email: 'admin@petvibe.ph', specialization: 'Clinic Director', active: 1 },
      { staff_id: 2, full_name: 'Dr. Sophia Sayaman', role: 'vet', email: 'vet@petvibe.ph', specialization: 'Surgery & Orthopedics', active: 1 },
      { staff_id: 3, full_name: 'Dr. Marty Palmenco', role: 'vet', email: 'grace@petvibe.ph', specialization: 'Internal Medicine & Diagnostics', active: 1 },
      { staff_id: 4, full_name: 'Dr. Rainiel Pallaya', role: 'groomer', email: 'liza@petvibe.ph', specialization: 'Grooming & Spa', active: 1 },
      { staff_id: 5, full_name: 'Dr. Antoinette Curitana', role: 'vet', email: 'curitanamc@petvibe.ph', specialization: 'Grooming', active: 1 },
    ],
    owners: [
      // The demo client (Maria Santos / client@petvibe.ph) was removed at the
      // clinic's request — mirrors the server seed. No client demo login exists.
      { owner_id: 2, full_name: 'Juan Dela Cruz', email: 'juan.dc@example.com', phone: '0918 555 9876', password: null, address: 'Tondo, Manila', account_type: 'walk_in', status: 'active' },
      { owner_id: 3, full_name: 'Ana Garcia', email: 'ana.garcia@example.com', phone: '0920 555 3344', password: PASSWORD, address: 'Project 8, Quezon City', account_type: 'registered', status: 'active' },
      // Suspended with a valid password so the suspended-at-login (403) path can be demoed/tested.
      { owner_id: 4, full_name: 'Ramon Bautista', email: 'ramon.b@example.com', phone: '0916 555 7788', password: PASSWORD, address: 'Calamba, Laguna', account_type: 'registered', status: 'suspended' },
    ],
    pets: [
      // Demo pets belonging to the removed client demo account were removed too.
      { pet_id: 3, owner_id: 2, name: 'Bantay', species: 'dog', breed: 'Aspin', gender: 'male', birthdate: '2019-01-10', weight_kg: 18.0, created_at: iso(-30) },
      { pet_id: 4, owner_id: 3, name: 'Chico', species: 'dog', breed: 'Chihuahua', gender: 'male', birthdate: '2023-09-02', weight_kg: 2.8, created_at: iso(-20) },
      { pet_id: 5, owner_id: 4, name: 'Muning', species: 'cat', breed: 'Puspin', gender: 'female', birthdate: '2020-12-25', weight_kg: 3.4, created_at: iso(-15) },
      { pet_id: 7, owner_id: 3, name: 'Pip', species: 'guinea_pig', breed: 'Abyssinian', gender: 'male', birthdate: '2024-01-20', weight_kg: 0.9, created_at: iso(-13) },
      { pet_id: 8, owner_id: 3, name: 'Nibbles', species: 'rat', breed: 'Fancy Rat', gender: 'male', birthdate: '2024-08-05', weight_kg: 0.35, created_at: iso(-12) },
      { pet_id: 9, owner_id: 2, name: 'Kiko', species: 'bird', breed: 'Cockatiel', gender: 'male', birthdate: '2022-02-14', weight_kg: 0.1, created_at: iso(-11) },
      { pet_id: 10, owner_id: 4, name: 'Babe', species: 'pig', breed: 'Miniature Pig', gender: 'female', birthdate: '2023-11-30', weight_kg: 22.0, created_at: iso(-10) },
    ],
    bookings: [
      // Bookings belonging to the removed client demo account were removed too.
      { booking_id: 4, reference_code: 'PV-1004', owner_id: 2, pet_id: 3, service_id: 24, staff_id: 2, booking_date: iso(1), booking_time: '09:00', status: 'pending', created_by: 'admin', notes: 'Walk-in booking made at counter.', created_at: iso(0) },
      { booking_id: 8, reference_code: 'PV-1008', owner_id: 3, pet_id: 4, service_id: 1, staff_id: 3, booking_date: iso(1), booking_time: '16:00', status: 'confirmed', created_by: 'client', notes: 'First visit — deworming due.', created_at: iso(-3) },
      { booking_id: 9, reference_code: 'PV-1009', owner_id: 4, pet_id: 5, service_id: 8, staff_id: null, booking_date: iso(-12), booking_time: '10:00', status: 'cancelled', created_by: 'client', notes: 'Owner cancelled — account under review.', created_at: iso(-14) },
    ],
    records: [
      // Records belonged to the removed client demo account's pets.
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
      { schedule_id: 21, staff_id: 5, day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 22, staff_id: 5, day_of_week: 2, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 23, staff_id: 5, day_of_week: 3, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 24, staff_id: 5, day_of_week: 4, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 25, staff_id: 5, day_of_week: 5, start_time: '09:00', end_time: '17:00', is_available: 1 },
      { schedule_id: 26, staff_id: 5, day_of_week: 6, start_time: '09:00', end_time: '17:00', is_available: 1 },
    ],
    status_log: [
      // Audit rows belonged to the removed client demo account's bookings.
    ],
    reschedule_requests: [
      // The demo reschedule request belonged to the removed client demo account.
    ],
    notifications: [
      // Notifications belonged to the removed client demo account.
    ],
    sessions: new Map(),
    seq: { booking: 10, pet: 6, owner: 5, record: 5, staff: 6, schedule: 27, log: 9, reschedule: 2 },
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

// Mirror of server/index.js bookingSummary — keeps in-app demo notifications
// consistent with the real emails (pet/service always match the booking).
function bookingSummary(b) {
  const db = decorateBooking(b)
  return `Service: ${db.service_name}\nPet: ${db.pet_name}\nDate: ${b.booking_date}\nTime: ${b.booking_time}\nReference: ${b.reference_code}`
}

function inferRecordType(r) {
  if (r.record_type) return r.record_type
  const hay = `${r.vaccinations_given || ''} ${r.service_name || ''} ${r.diagnosis || ''}`.toLowerCase()
  if (/vaccine|deworm|rabies/.test(hay)) return 'vaccination'
  if (/groom|bath|nail|spa/.test(hay)) return 'grooming'
  if (/spay|neuter|surgery|extract|cesarean|tumor|wound|c-section|dental/.test(hay)) return 'surgery'
  return 'checkup'
}

function decorateRecord(r) {
  const b = state.bookings.find((x) => x.booking_id === r.booking_id)
  const service = b ? svc(b.service_id)?.name : null
  return {
    ...r,
    record_date: r.visit_date,
    type: inferRecordType({ ...r, service_name: service }),
    title: r.title || service || r.diagnosis || 'Visit',
    notes: r.treatment_notes,
    vet_staff_id: r.staff_id,
    staff_name: staffName(r.staff_id),
    reference_code: b?.reference_code,
    service_name: service,
  }
}

function logBookingStatus(bookingId, fromStatus, toStatus, actor, note = null) {
  state.status_log.unshift({
    log_id: state.seq.log++,
    booking_id: bookingId,
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    note: note,
    changed_by_role: actor?.role || 'system',
    changed_by_name: actor?.name || null,
    created_at: iso(),
  })
}

// In-app notification helpers (mirror of server/index.js sendEmail/notifyStaff).
const notify = (n) => {
  state.notifications.unshift({
    notification_id: state.notifications.length + 1,
    channel: 'email',
    sent_at: new Date().toISOString(),
    read_at: null,
    ...n,
  })
}
const notifyStaffAll = (type, subject, body, bookingId = null) => {
  for (const s of state.staff) if (s.active) notify({ staff_id: s.staff_id, type, subject, message_body: body, booking_id: bookingId })
}

function err(status, message) {
  const e = new Error(message)
  e.status = status
  throw e
}

// Sessions live 7 days in-memory, mirroring the server's sessions.expires_at.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const makeSession = (ownerId = null, staffId = null) => {
  const t = ownerId ? `mock-client-${ownerId}` : `mock-staff-${staffId}`
  state.sessions.set(t, { owner_id: ownerId, staff_id: staffId, expires_at: Date.now() + SESSION_TTL_MS })
  return t
}
const getSession = (token) => {
  let sid = state.sessions.get(token)
  // Sessions live in-memory and die on page reload. The token format
  // (mock-staff-<id> / mock-client-<id>) encodes who it belongs to, so we can
  // rebuild the session instead of forcing a confusing re-login.
  if (!sid && typeof token === 'string') {
    const m = token.match(/^mock-(staff|client)-(\d+)$/)
    if (m) {
      const id = Number(m[2])
      sid = m[1] === 'staff'
        ? { owner_id: null, staff_id: id, expires_at: Date.now() + SESSION_TTL_MS }
        : { owner_id: id, staff_id: null, expires_at: Date.now() + SESSION_TTL_MS }
      state.sessions.set(token, sid)
    }
  }
  if (!sid) return null
  if (Date.now() > sid.expires_at) {
    state.sessions.delete(token)
    err(401, 'Session expired, please log in again')
  }
  return sid
}

// Mirror the server's requireOwner/requireAdmin: no session → 401; valid
// session of the WRONG account type → 403 (a client token hitting admin
// routes is an access violation, not a missing login).
const requireClient = (token) => {
  const sid = getSession(token)
  if (!sid) err(401, 'Not logged in')
  if (sid.staff_id) err(403, 'Client account required')
  const o = owner(sid.owner_id)
  if (!o) err(401, 'Not logged in')
  return o
}
const requireAdmin = (token) => {
  const sid = getSession(token)
  if (!sid) err(401, 'Not logged in')
  if (sid.owner_id) err(403, 'Admin access required')
  const s = staff(sid.staff_id)
  if (!s) err(401, 'Not logged in')
  if (s.role !== 'admin') err(403, 'Only admins can perform this action')
  return s
}
const requireStaff = (token) => {
  const sid = getSession(token)
  if (!sid) err(401, 'Not logged in')
  if (sid.owner_id) err(403, 'Staff access required')
  const s = staff(sid.staff_id)
  if (!s) err(401, 'Not logged in')
  return s
}
const currentStaff = (token) => {
  const sid = getSession(token)
  return sid ? staff(sid.staff_id) : null
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
    if (o && o.password === body.password) {
      // Blocked after a valid password so we don't leak account state (mirrors server).
      if (o.status === 'suspended') err(403, 'This account has been suspended')
      const t = makeSession(o.owner_id)
      return { token: t, role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type, photo_url: o.photo_url || null } }
    }
    const s = state.staff.find((x) => x.email === body.email)
    if (s && s.active && body.password === PASSWORD) {
      const t = makeSession(null, s.staff_id)
      const staffRole = s.role === 'admin' ? 'admin' : 'staff'
      return { token: t, role: staffRole, user: { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization, photo_url: s.photo_url || null } }
    }
    err(401, 'Invalid email or password')
  }
  if (p === '/auth/register' && m === 'POST') {
    if (state.owners.some((o) => o.email === body.email)) err(409, 'An account with this email already exists')
    const o = { owner_id: state.seq.owner++, full_name: body.full_name, email: body.email, phone: body.phone, password: body.password, address: body.address || null, account_type: 'registered', status: 'active', photo_url: null }
    state.owners.push(o)
    const t = makeSession(o.owner_id)
    return { token: t, role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: 'registered', photo_url: null } }
  }
  if (p === '/auth/me' && m === 'GET') {
    const t = token && (state.sessions.has(token) ? token : null)
    if (!t) err(401, 'Not logged in')
    const sid = getSession(t)
    if (sid.staff_id) { const s = staff(sid.staff_id); return { role: s.role === 'admin' ? 'admin' : 'staff', user: { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization, photo_url: s.photo_url || null } } }
    const o = owner(sid.owner_id)
    return { role: 'client', user: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type, photo_url: o.photo_url || null } }
  }
  if (p === '/auth/logout' && m === 'POST') { state.sessions.delete(token); return { ok: true } }
  if (p === '/demo-accounts' && m === 'GET') {
    // Mirror the server: never expose demo logins on a production build.
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD && import.meta.env?.VITE_SHOW_DEMO_ACCOUNTS !== '1') return []
    return [{ label: 'Admin', email: 'admin@petvibe.ph', password: PASSWORD }, { label: 'Staff (Vet)', email: 'vet@petvibe.ph', password: PASSWORD }, { label: 'Staff (Groomer)', email: 'liza@petvibe.ph', password: PASSWORD }]
  }

  // public
  if (p === '/services' && m === 'GET') {
    let list = [...state.services]
    list = list.filter((s) => s.active) // public catalog only shows active services
    if (query.category) list = list.filter((s) => s.category === query.category)
    if (query.bookable === '1') list = list.filter((s) => s.client_bookable)
    return list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  }
  if (p === '/services/categories' && m === 'GET') {
    const counts = {}
    for (const s of state.services) if (s.active) counts[s.category] = (counts[s.category] || 0) + 1
    return Object.entries(counts).map(([category, count]) => ({ category, count }))
  }
  if (p === '/bundles' && m === 'GET') return state.bundles
  if (p === '/team' && m === 'GET') return state.staff.filter((s) => s.active).map(({ staff_id, full_name, role, specialization, photo_url }) => ({ staff_id, full_name, role, specialization, photo_url }))
  if (p === '/slots' && m === 'GET') {
    const date = query.date || iso()
    const taken = state.bookings.filter((b) => b.booking_date === date && !['cancelled', 'no_show'].includes(b.status)).map((b) => b.booking_time)
    return { date, slots: SLOTS, taken }
  }

  // client
  if (p === '/me' && m === 'GET') {
    const o = requireClient(token)
    return { owner: { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type, photo_url: o.photo_url || null }, pets: state.pets.filter((x) => x.owner_id === o.owner_id) }
  }
  if (p === '/me' && m === 'PUT') {
    const o = requireClient(token)
    if (body.email && body.email.toLowerCase() !== o.email.toLowerCase()) {
      if (state.owners.some((x) => x.email.toLowerCase() === body.email.toLowerCase() && x.owner_id !== o.owner_id)) err(409, 'Another account already uses that email')
      o.email = body.email
    }
    Object.assign(o, { full_name: body.full_name ?? o.full_name, phone: body.phone ?? o.phone, address: body.address ?? o.address })
    if (body.photo_url !== undefined) o.photo_url = body.photo_url === '' ? null : body.photo_url
    return { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type, photo_url: o.photo_url || null }
  }
  if (p === '/me/password' && m === 'PATCH') {
    const o = requireClient(token)
    if (!body.current_password || !body.new_password) err(400, 'current_password and new_password are required')
    if (!o.password) err(400, 'This account has no password set (walk-in profile)')
    if (o.password !== body.current_password) err(400, 'Current password is incorrect')
    if (body.new_password.length < 6) err(400, 'New password must be at least 6 characters')
    o.password = body.new_password
    return { ok: true }
  }
  if (p === '/pets' && m === 'POST') {
    const o = requireClient(token)
    const pk = { pet_id: state.seq.pet++, owner_id: o.owner_id, name: body.name, species: body.species || 'dog', breed: body.breed || null, gender: body.gender || null, birthdate: body.birthdate || null, weight_kg: body.weight_kg || null, photo_url: body.photo_url || null, created_at: iso() }
    state.pets.push(pk)
    return pk
  }
  let pm = p.match(/^\/pets\/(\d+)$/)
  if (pm && m === 'PUT') {
    const o = requireClient(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!pk) err(404, 'Pet not found')
    Object.assign(pk, { name: body.name ?? pk.name, species: body.species ?? pk.species, breed: body.breed ?? pk.breed, gender: body.gender ?? pk.gender, birthdate: body.birthdate ?? pk.birthdate, weight_kg: body.weight_kg ?? pk.weight_kg })
    if (body.photo_url !== undefined) pk.photo_url = body.photo_url === '' ? null : body.photo_url
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
    if (!s.active) err(403, 'This service is no longer available')
    if (!s.client_bookable) err(403, 'This service can only be booked through the clinic (admin)')
    if (body.booking_date < iso()) err(400, 'Cannot book a past date')
    if (state.bookings.some((b) => b.booking_date === body.booking_date && b.booking_time === body.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken — please pick another')
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: o.owner_id, pet_id: Number(body.pet_id), service_id: Number(body.service_id), staff_id: null, booking_date: body.booking_date, booking_time: body.booking_time, status: 'pending', created_by: 'client', notes: body.notes || null, created_at: iso() }
    state.bookings.push(b)
    notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'booking_received', subject: `Booking received — ${b.reference_code}`, message_body: `Hi ${o.full_name}, we've received your booking request. Here's a summary:\n\n${bookingSummary(b)}\n\nWe'll confirm it shortly.` })
    notifyStaffAll('booking_received', `New booking — ${b.reference_code}`, `${o.full_name} booked ${s.name} for ${pk.name} on ${b.booking_date} at ${b.booking_time}. Review it in Appointments.`, b.booking_id)
    logBookingStatus(b.booking_id, null, 'pending', { role: 'client', name: o.full_name }, 'Booking created by client')
    return decorateBooking(b)
  }
  pm = p.match(/^\/bookings\/(\d+)\/cancel$/)
  if (pm && m === 'POST') {
    const o = requireClient(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!b) err(404, 'Booking not found')
    if (!['pending', 'confirmed'].includes(b.status)) err(400, 'Only pending or confirmed bookings can be cancelled')
    const from = b.status
    b.status = 'cancelled'
    logBookingStatus(b.booking_id, from, 'cancelled', { role: 'client', name: o.full_name }, 'Cancelled by client')
    notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'rebooking', subject: `Booking cancelled — ${b.reference_code}`, message_body: `Hi ${o.full_name}, your booking has been cancelled. Here are the details:\n\n${bookingSummary(b)}\n\nIf you'd like to book another appointment, you can do so anytime on our site.` })
    return { ok: true }
  }
  pm = p.match(/^\/bookings\/(\d+)\/reschedule-request$/)
  if (pm && m === 'POST') {
    const o = requireClient(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!b) err(404, 'Booking not found')
    if (!['pending', 'confirmed'].includes(b.status)) err(400, 'Only pending or confirmed bookings can be rescheduled')
    if (!body.requested_date || !body.requested_time) err(400, 'requested_date and requested_time are required')
    if (body.requested_date < iso()) err(400, 'Cannot request a past date')
    if (state.reschedule_requests.some((r) => r.booking_id === b.booking_id && r.status === 'pending')) err(409, 'You already have a pending reschedule request for this booking')
    const rq = { request_id: state.seq.reschedule++, booking_id: b.booking_id, requested_date: body.requested_date, requested_time: body.requested_time, reason: body.reason || null, status: 'pending', created_at: iso() }
    state.reschedule_requests.push(rq)
    logBookingStatus(b.booking_id, b.status, b.status, { role: 'client', name: o.full_name }, `Client requested reschedule to ${body.requested_date} at ${body.requested_time}${body.reason ? ` — ${body.reason}` : ''}`)
    notifyStaffAll('reschedule', `Reschedule request — ${b.reference_code}`, `${o.full_name} requested to move ${b.reference_code} to ${body.requested_date} at ${body.requested_time}${body.reason ? ` — ${body.reason}` : ''}. Review it in Appointments.`, b.booking_id)
    return rq
  }
  pm = p.match(/^\/bookings\/(\d+)\/reschedule-request\/(\d+)$/)
  if (pm && m === 'DELETE') {
    const o = requireClient(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!b) err(404, 'Booking not found')
    const i = state.reschedule_requests.findIndex((r) => r.request_id === Number(pm[2]) && r.booking_id === b.booking_id && r.status === 'pending')
    if (i === -1) err(404, 'Pending reschedule request not found')
    state.reschedule_requests.splice(i, 1)
    return { ok: true }
  }
  pm = p.match(/^\/bookings\/(\d+)\/history$/)
  if (pm && m === 'GET') {
    const o = requireClient(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]) && x.owner_id === o.owner_id)
    if (!b) err(404, 'Booking not found')
    return { history: state.status_log.filter((l) => l.booking_id === b.booking_id), reschedule_requests: state.reschedule_requests.filter((r) => r.booking_id === b.booking_id) }
  }

  // client: in-app notifications
  if (p === '/notifications' && m === 'GET') {
    const o = requireClient(token)
    const notifications = state.notifications.filter((n) => n.owner_id === o.owner_id).slice(0, 30)
    return { notifications, unread: notifications.filter((n) => !n.read_at).length }
  }
  if (p === '/notifications/read' && m === 'POST') {
    const o = requireClient(token)
    for (const n of state.notifications) if (n.owner_id === o.owner_id && !n.read_at) n.read_at = new Date().toISOString()
    return { ok: true }
  }

  // admin: services CRUD
  if (p === '/admin/services' && m === 'GET') {
    requireStaff(token)
    // Return copies so React sees a fresh reference and re-renders after CRUD
    return state.services.map((s) => ({ ...s }))
  }
  if (p === '/admin/services' && m === 'POST') {
    requireAdmin(token)
    const s = {
      service_id: state.seq.service ?? state.services.length + 1,
      name: body.name, category: body.category, description: body.description || null,
      price_min: Number(body.price_min), price_max: body.price_max === '' || body.price_max === undefined ? null : Number(body.price_max),
      duration_minutes: body.duration_minutes === '' || body.duration_minutes === undefined ? null : Number(body.duration_minutes),
      requires_fasting: 0, requires_anesthesia: 0, recovery_time_hours: null, weight_requirement: null,
      weight_tier: body.weight_tier || null, client_bookable: body.client_bookable ? 1 : 0, active: 1,
    }
    state.services.push(s)
    return s
  }
  pm = p.match(/^\/admin\/services\/(\d+)$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = state.services.find((x) => x.service_id === Number(pm[1]))
    if (!s) err(404, 'Service not found')
    const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v))
    Object.assign(s, {
      name: body.name ?? s.name, category: body.category ?? s.category,
      description: body.description ?? s.description, price_min: num(body.price_min) ?? s.price_min,
      price_max: num(body.price_max) ?? s.price_max, duration_minutes: num(body.duration_minutes) ?? s.duration_minutes,
      weight_tier: body.weight_tier ?? s.weight_tier,
      client_bookable: body.client_bookable === undefined ? s.client_bookable : body.client_bookable ? 1 : 0,
    })
    return s
  }
  pm = p.match(/^\/admin\/services\/(\d+)\/toggle$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = state.services.find((x) => x.service_id === Number(pm[1]))
    if (!s) err(404, 'Service not found')
    s.active = s.active ? 0 : 1
    return s
  }

  // staff: schedule (read-only, shared with admin)
  if (p === '/staff/schedule' && m === 'GET') {
    requireStaff(token)
    return state.schedules.map((sc) => ({ ...sc, staff_name: staff(sc.staff_id)?.full_name, staff_role: staff(sc.staff_id)?.role }))
  }
  // staff: bookings assigned to this staff member
  if (p === '/staff/bookings' && m === 'GET') {
    const s = requireStaff(token)
    let list = state.bookings.filter((b) => b.staff_id === s.staff_id).map(decorateBooking)
    if (query.status) list = list.filter((b) => b.status === query.status)
    if (query.date) list = list.filter((b) => b.booking_date === query.date)
    if (query.q) list = list.filter((b) => [b.owner_name, b.pet_name, b.reference_code].some((v) => v?.toLowerCase().includes(query.q.toLowerCase())))
    return list.sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
  }
  pm = p.match(/^\/staff\/bookings\/(\d+)$/)
  if (pm && m === 'GET') {
    const s = requireStaff(token)
    const booking = state.bookings.find((b) => b.booking_id === Number(pm[1]) && b.staff_id === s.staff_id)
    if (!booking) err(404, 'Booking not found')
    const recs = state.records.filter((r) => r.booking_id === booking.booking_id).map(decorateRecord)
    return { booking: decorateBooking(booking), records: recs }
  }
  if (pm && m === 'PATCH') {
    const s = requireStaff(token)
    const booking = state.bookings.find((b) => b.booking_id === Number(pm[1]) && b.staff_id === s.staff_id)
    if (!booking) err(404, 'Booking not found or not assigned to you')
    if (body.status) {
      booking.status = body.status
      state.log.push({ booking_id: booking.booking_id, from_status: booking.status, to_status: body.status, note: body.note || null, changed_by_role: 'staff', changed_by_name: s.full_name })
    }
    return decorateBooking(booking)
  }
  // admin
  if (p === '/admin/stats' && m === 'GET') {
    requireAdmin(token)
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
    requireAdmin(token)
    let list = state.bookings.map(decorateBooking)
    if (query.status) list = list.filter((b) => b.status === query.status)
    if (query.date) list = list.filter((b) => b.booking_date === query.date)
    if (query.q) list = list.filter((b) => [b.owner_name, b.pet_name, b.reference_code].some((v) => v?.toLowerCase().includes(query.q.toLowerCase())))
    return list.sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)$/)
  if (pm && m === 'GET') {
    requireAdmin(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    return { booking: decorateBooking(b), records: state.records.filter((r) => r.booking_id === b.booking_id).map(decorateRecord) }
  }
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = currentStaff(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    const actor = { role: 'admin', name: s?.full_name || 'Staff' }
    if (body.status) {
      if (!TRANSITIONS[b.status]?.includes(body.status)) err(400, `Cannot move booking from ${b.status} to ${body.status}`)
      const from = b.status
      b.status = body.status
      logBookingStatus(b.booking_id, from, body.status, actor, body.note || null)
      if (body.status === 'confirmed') {
        const o = owner(b.owner_id)
        notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'confirmation', subject: `Booking confirmed — ${b.reference_code}`, message_body: `Hi ${o.full_name}, great news — your booking is confirmed!\n\n${bookingSummary(b)}\n\nWe look forward to seeing you and ${decorateBooking(b).pet_name}.` })
      }
      if (body.status === 'completed' && !state.records.some((r) => r.booking_id === b.booking_id)) {
        // Auto-log the visit so registered clients see it in the pet's history
        state.records.push({
          record_id: state.seq.record++, pet_id: b.pet_id, booking_id: b.booking_id,
          visit_date: b.booking_date, staff_id: b.staff_id ?? null,
          diagnosis: 'Completed visit', treatment_notes: null, vaccinations_given: null,
          weight_at_visit: null, next_due_date: null, created_at: iso(),
        })
      }
      if (body.status === 'no_show') {
        const o = owner(b.owner_id)
        notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'rebooking', subject: `Rebooking options — ${b.reference_code}`, message_body: `Hi ${o.full_name}, unfortunately your appointment was marked as a no-show, so the slot has been released.\n\n${bookingSummary(b)}\n\nYou're welcome to rebook — ${iso(1)} at 10:00, 14:00, or 16:00.` })
      }
    }
    if (body.staff_id) {
      b.staff_id = Number(body.staff_id)
      if (!body.status) logBookingStatus(b.booking_id, b.status, b.status, actor, `Assigned to ${staffName(body.staff_id)}`)
    }
    if (body.booking_date || body.booking_time) {
      b.booking_date = body.booking_date || b.booking_date
      b.booking_time = body.booking_time || b.booking_time
      if (!body.status && !body.staff_id) logBookingStatus(b.booking_id, b.status, b.status, actor, `Moved to ${b.booking_date} at ${b.booking_time}`)
    }
    return decorateBooking(b)
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)\/reschedule$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = currentStaff(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    if (!body.booking_date || !body.booking_time) err(400, 'booking_date and booking_time are required')
    if (state.bookings.some((x) => x.booking_date === body.booking_date && x.booking_time === body.booking_time && x.booking_id !== b.booking_id && !['cancelled', 'no_show'].includes(x.status))) err(409, 'That time slot is already taken')
    if (b.staff_id) {
      const day = new Date(body.booking_date + 'T00:00:00').getDay()
      const avail = state.schedules.some((sc) => sc.staff_id === b.staff_id && sc.is_available && (sc.day_of_week === day || sc.schedule_date === body.booking_date) && sc.start_time <= body.booking_time && sc.end_time > body.booking_time)
      if (!avail) err(400, 'The assigned staff member is not on schedule at that time — pick another slot or reassign')
    }
    const from = `${b.booking_date} ${b.booking_time}`
    b.booking_date = body.booking_date
    b.booking_time = body.booking_time
    logBookingStatus(b.booking_id, b.status, b.status, { role: 'admin', name: s?.full_name || 'Staff' }, `Rescheduled from ${from} to ${b.booking_date} at ${b.booking_time}`)
    const o = owner(b.owner_id)
    notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'confirmation', subject: `Appointment moved — ${b.reference_code}`, message_body: `Hi ${o.full_name}, your appointment has been rescheduled. Here are your updated details:\n\n${bookingSummary(b)}\n\nSee you then!` })
    return decorateBooking(b)
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)\/assign$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = currentStaff(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    const target = state.staff.find((x) => x.staff_id === Number(body.staff_id) && x.active)
    if (!target) err(400, 'Staff member not found or inactive')
    b.staff_id = target.staff_id
    logBookingStatus(b.booking_id, b.status, b.status, { role: 'admin', name: s?.full_name || 'Staff' }, `Assigned to ${target.full_name}`)
    return decorateBooking(b)
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)\/history$/)
  if (pm && m === 'GET') {
    requireAdmin(token)
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    if (!b) err(404, 'Booking not found')
    return { booking: decorateBooking(b), history: state.status_log.filter((l) => l.booking_id === b.booking_id), reschedule_requests: state.reschedule_requests.filter((r) => r.booking_id === b.booking_id) }
  }
  pm = p.match(/^\/admin\/bookings\/(\d+)\/reschedule-request\/(\d+)$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = currentStaff(token)
    const rq = state.reschedule_requests.find((r) => r.request_id === Number(pm[2]) && r.booking_id === Number(pm[1]))
    if (!rq) err(404, 'Reschedule request not found')
    if (rq.status !== 'pending') err(400, 'This request has already been handled')
    const b = state.bookings.find((x) => x.booking_id === Number(pm[1]))
    const actor = { role: 'admin', name: s?.full_name || 'Staff' }
    if (body.action === 'approve') {
      if (state.bookings.some((x) => x.booking_date === rq.requested_date && x.booking_time === rq.requested_time && x.booking_id !== b.booking_id && !['cancelled', 'no_show'].includes(x.status))) err(409, 'The requested slot is no longer available — ask the client to pick another')
      const from = `${b.booking_date} ${b.booking_time}`
      b.booking_date = rq.requested_date
      b.booking_time = rq.requested_time
      rq.status = 'approved'
      logBookingStatus(b.booking_id, b.status, b.status, actor, `Client reschedule approved: ${from} → ${rq.requested_date} at ${rq.requested_time}`)
      const o = owner(b.owner_id)
      notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'reschedule', subject: `Reschedule approved — ${b.reference_code}`, message_body: `Hi ${o.full_name}, your reschedule request has been approved! Here are your updated details:\n\n${bookingSummary(b)}\n\nSee you then!` })
    } else if (body.action === 'decline') {
      rq.status = 'declined'
      logBookingStatus(b.booking_id, b.status, b.status, actor, `Client reschedule request declined: ${rq.requested_date} at ${rq.requested_time}`)
      const o = owner(b.owner_id)
      notify({ owner_id: o.owner_id, booking_id: b.booking_id, type: 'reschedule', subject: `Reschedule request declined — ${b.reference_code}`, message_body: `Hi ${o.full_name}, unfortunately your request to move your appointment was declined.\n\n${bookingSummary(b)}\n\nIf you'd like a different time, please contact the clinic or request a new slot from your portal.` })
    } else {
      err(400, 'action must be approve or decline')
    }
    return rq
  }
  if (p === '/admin/bookings' && m === 'POST') {
    requireAdmin(token)
    if (state.bookings.some((b) => b.booking_date === body.booking_date && b.booking_time === body.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken')
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: Number(body.owner_id), pet_id: Number(body.pet_id), service_id: Number(body.service_id), staff_id: body.staff_id || null, booking_date: body.booking_date, booking_time: body.booking_time, status: 'pending', created_by: 'admin', notes: body.notes || null, created_at: iso() }
    state.bookings.push(b)
    logBookingStatus(b.booking_id, null, 'pending', { role: 'admin', name: currentStaff(token)?.full_name || 'Staff' }, 'Booking created by staff')
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
  pm = p.match(/^\/admin\/pets\/(\d+)\/photo$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]))
    if (!pk) err(404, 'Pet not found')
    pk.photo_url = body.photo_url === '' ? null : body.photo_url || null
    return pk
  }
  pm = p.match(/^\/admin\/pets\/(\d+)\/records$/)
  if (pm && m === 'GET') {
    requireStaff(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]))
    if (!pk) err(404, 'Pet not found')
    return state.records.filter((r) => r.pet_id === pk.pet_id).map(decorateRecord)
  }
  if (pm && m === 'POST') {
    requireAdmin(token)
    const s = currentStaff(token)
    const r = { record_id: state.seq.record++, pet_id: Number(pm[1]), booking_id: body.booking_id || null, visit_date: body.record_date || body.visit_date, staff_id: body.staff_id ?? s?.staff_id ?? null, diagnosis: body.diagnosis || null, treatment_notes: body.notes || body.treatment_notes || null, vaccinations_given: body.vaccinations_given || null, weight_at_visit: body.weight_at_visit || null, next_due_date: body.next_due_date || null, record_type: body.type || body.record_type || null, title: body.title || null, created_at: iso() }
    state.records.push(r)
    return decorateRecord(r)
  }
  pm = p.match(/^\/admin\/records\/(\d+)$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const r = state.records.find((x) => x.record_id === Number(pm[1]))
    if (!r) err(404, 'Record not found')
    Object.assign(r, {
      visit_date: (body.record_date || body.visit_date) ?? r.visit_date,
      staff_id: body.staff_id ?? r.staff_id,
      diagnosis: body.diagnosis ?? r.diagnosis,
      treatment_notes: (body.notes || body.treatment_notes) ?? r.treatment_notes,
      vaccinations_given: body.vaccinations_given ?? r.vaccinations_given,
      weight_at_visit: body.weight_at_visit ?? r.weight_at_visit,
      next_due_date: body.next_due_date ?? r.next_due_date,
      record_type: (body.type || body.record_type) ?? r.record_type,
      title: body.title ?? r.title,
    })
    return decorateRecord(r)
  }
  if (pm && m === 'DELETE') {
    requireAdmin(token)
    const i = state.records.findIndex((x) => x.record_id === Number(pm[1]))
    if (i === -1) err(404, 'Record not found')
    state.records.splice(i, 1)
    return { ok: true }
  }
  if (p === '/admin/staff' && m === 'GET') {
    requireStaff(token)
    return state.staff.map((s) => ({ ...s, appointment_count: state.bookings.filter((b) => b.staff_id === s.staff_id && ['confirmed', 'completed'].includes(b.status)).length }))
  }
  if (p === '/admin/staff' && m === 'POST') {
    requireAdmin(token)
    const s = { staff_id: state.seq.staff++, full_name: body.full_name, role: body.role, email: body.email || null, specialization: body.specialization || null, active: 1 }
    state.staff.push(s)
    return s
  }
  pm = p.match(/^\/admin\/staff\/(\d+)\/toggle$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = staff(pm[1])
    if (!s) err(404, 'Staff not found')
    s.active = s.active ? 0 : 1
    return s
  }
  pm = p.match(/^\/admin\/staff\/(\d+)\/photo$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const s = staff(pm[1])
    if (!s) err(404, 'Staff not found')
    s.photo_url = body.photo_url === '' ? null : body.photo_url || null
    return s
  }
  if (p === '/admin/schedule' && m === 'GET') {
    requireStaff(token)
    return state.schedules.map((sc) => ({ ...sc, staff_name: staff(sc.staff_id)?.full_name, staff_role: staff(sc.staff_id)?.role }))
  }
  if (p === '/admin/schedule' && m === 'POST') {
    requireAdmin(token)
    const sc = { schedule_id: state.seq.schedule++, staff_id: Number(body.staff_id), day_of_week: Number(body.day_of_week), start_time: body.start_time, end_time: body.end_time, is_available: body.is_available === false ? 0 : 1 }
    state.schedules.push(sc)
    return { ...sc, staff_name: staff(sc.staff_id)?.full_name, staff_role: staff(sc.staff_id)?.role }
  }
  pm = p.match(/^\/admin\/schedule\/(\d+)$/)
  if (pm && m === 'DELETE') {
    requireAdmin(token)
    state.schedules = state.schedules.filter((s) => s.schedule_id !== Number(pm[1]))
    return { ok: true }
  }
  if (p === '/admin/walkin' && m === 'POST') {
    requireAdmin(token)
    if (state.bookings.some((b) => b.booking_date === body.booking.booking_date && b.booking_time === body.booking.booking_time && !['cancelled', 'no_show'].includes(b.status))) err(409, 'That time slot is already taken')
    const o = { owner_id: state.seq.owner++, full_name: body.owner.full_name, email: body.owner.email || `walkin-${Date.now()}@petvibe.ph`, phone: body.owner.phone, password: null, address: body.owner.address || null, account_type: 'walk_in', status: 'active' }
    state.owners.push(o)
    const pk = { pet_id: state.seq.pet++, owner_id: o.owner_id, name: body.pet.name, species: body.pet.species || 'dog', breed: body.pet.breed || null, gender: body.pet.gender || null, birthdate: body.pet.birthdate || null, weight_kg: body.pet.weight_kg || null, created_at: iso() }
    state.pets.push(pk)
    const b = { booking_id: state.seq.booking++, reference_code: `PV-${1000 + state.seq.booking - 1}`, owner_id: o.owner_id, pet_id: pk.pet_id, service_id: Number(body.booking.service_id), staff_id: body.booking.staff_id || null, booking_date: body.booking.booking_date, booking_time: body.booking.booking_time, status: 'pending', created_by: 'admin', notes: body.booking.notes || null, created_at: iso() }
    state.bookings.push(b)
    logBookingStatus(b.booking_id, null, 'pending', { role: 'admin', name: currentStaff(token)?.full_name || 'Staff' }, 'Walk-in booking created at counter')
    return { owner_id: o.owner_id, pet_id: pk.pet_id, booking_id: b.booking_id, reference_code: b.reference_code }
  }
  if (p === '/admin/analytics' && m === 'GET') {
    requireAdmin(token)
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
    return { bookingsByDay: days.map((date) => ({ date, count: dayMap[date] || 0 })), revenueByService, staffPerformance: state.staff.map((s) => ({ full_name: s.full_name, role: s.role, completed: state.bookings.filter((b) => b.staff_id === s.staff_id && b.status === 'completed').length })).sort((a, b) => b.completed - a.completed), statusBreakdown, topServices: Object.entries(state.bookings.reduce((acc, b) => { const name = svc(b.service_id).name; acc[name] = (acc[name] || 0) + 1; return acc }, {})).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 5) }
  }
  if (p === '/admin/notifications' && m === 'GET') {
    const s = requireAdmin(token)
    // Only rows addressed to this staff member — never client-targeted rows
    const notifications = state.notifications.filter((n) => n.staff_id === s.staff_id).slice(0, 30)
    return { notifications: notifications.map((n) => ({ ...n, owner_name: owner(n.owner_id)?.full_name, owner_email: owner(n.owner_id)?.email })), unread: notifications.filter((n) => !n.read_at).length }
  }
  if (p === '/admin/notifications/read' && m === 'POST') {
    const s = requireAdmin(token)
    for (const n of state.notifications) if (n.staff_id === s.staff_id && !n.read_at) n.read_at = new Date().toISOString()
    return { ok: true }
  }

  // admin: client (owner) accounts
  const decorateOwner = (o) => ({
    owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address,
    account_type: o.account_type, status: o.status, created_at: o.created_at ?? null,
    pet_count: state.pets.filter((p) => p.owner_id === o.owner_id).length,
    booking_count: state.bookings.filter((b) => b.owner_id === o.owner_id).length,
  })
  if (p === '/admin/owners' && m === 'GET') {
    requireAdmin(token)
    let list = state.owners.map(decorateOwner)
    if (query.q) {
      const term = query.q.toLowerCase()
      list = list.filter((o) => [o.full_name, o.email, o.phone].some((v) => v?.toLowerCase().includes(term)))
    }
    if (query.status) list = list.filter((o) => o.status === query.status)
    if (query.account_type) list = list.filter((o) => o.account_type === query.account_type)
    return list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }
  pm = p.match(/^\/admin\/owners\/(\d+)$/)
  if (pm && m === 'GET') {
    requireAdmin(token)
    const o = owner(pm[1])
    if (!o) err(404, 'Owner not found')
    return { owner: decorateOwner(o), pets: state.pets.filter((p) => p.owner_id === o.owner_id), bookings: state.bookings.filter((b) => b.owner_id === o.owner_id).map(decorateBooking) }
  }
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const o = owner(pm[1])
    if (!o) err(404, 'Owner not found')
    if (body.email && body.email.toLowerCase() !== o.email.toLowerCase() && state.owners.some((x) => x.email.toLowerCase() === body.email.toLowerCase() && x.owner_id !== o.owner_id)) err(409, 'Another account already uses that email')
    Object.assign(o, {
      full_name: body.full_name ?? o.full_name,
      phone: body.phone ?? o.phone,
      address: body.address ?? o.address,
      email: body.email ?? o.email,
    })
    return decorateOwner(o)
  }
  pm = p.match(/^\/admin\/owners\/(\d+)\/status$/)
  if (pm && m === 'PATCH') {
    requireAdmin(token)
    const o = owner(pm[1])
    if (!o) err(404, 'Owner not found')
    if (!['active', 'suspended'].includes(body.status)) err(400, 'status must be active or suspended')
    o.status = body.status
    return decorateOwner(o)
  }
  pm = p.match(/^\/admin\/owners\/(\d+)\/reset-password$/)
  if (pm && m === 'POST') {
    requireAdmin(token)
    const o = owner(pm[1])
    if (!o) err(404, 'Owner not found')
    if (o.account_type === 'walk_in' || !o.email) err(400, 'Walk-in clients have no login to reset')
    const temp = 'Pv' + Math.random().toString(36).slice(2, 8).toUpperCase()
    o.password = temp
    return { ok: true, temp_password: temp }
  }
  pm = p.match(/^\/admin\/owners\/(\d+)$/)
  if (pm && m === 'DELETE') {
    requireAdmin(token)
    const o = owner(pm[1])
    if (!o) err(404, 'Owner not found')
    // Remove everything attached (mirror of server/index.js owner delete)
    const bids = state.bookings.filter((b) => b.owner_id === o.owner_id).map((b) => b.booking_id)
    const ownerPetIds = state.pets.filter((p) => p.owner_id === o.owner_id).map((p) => p.pet_id)
    state.notifications = state.notifications.filter((n) => !bids.includes(n.booking_id) && n.owner_id !== o.owner_id)
    state.records = state.records.filter((r) => !bids.includes(r.booking_id) && !ownerPetIds.includes(r.pet_id))
    state.status_log = state.status_log.filter((l) => !bids.includes(l.booking_id))
    state.reschedule_requests = state.reschedule_requests.filter((r) => !bids.includes(r.booking_id))
    state.bookings = state.bookings.filter((b) => b.owner_id !== o.owner_id)
    state.pets = state.pets.filter((p) => p.owner_id !== o.owner_id)
    state.owners = state.owners.filter((x) => x.owner_id !== o.owner_id)
    state.sessions.delete(`mock-client-${o.owner_id}`)
    return { ok: true }
  }

  // admin: printable reports
  if (p === '/admin/reports/appointments' && m === 'GET') {
    requireAdmin(token)
    if (!query.from || !query.to) err(400, 'from and to dates are required')
    let rows = state.bookings.filter((b) => b.booking_date >= query.from && b.booking_date <= query.to).map(decorateBooking)
    if (query.staff) rows = rows.filter((b) => String(b.staff_id) === query.staff)
    rows.sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
    return { from: query.from, to: query.to, staff: query.staff || null, rows }
  }
  pm = p.match(/^\/admin\/reports\/pet\/(\d+)\/medical$/)
  if (pm && m === 'GET') {
    requireAdmin(token)
    const pk = state.pets.find((x) => x.pet_id === Number(pm[1]))
    if (!pk) err(404, 'Pet not found')
    const o = owner(pk.owner_id)
    return { pet: { ...pk, owner_name: o?.full_name, owner_phone: o?.phone, owner_email: o?.email, owner_address: o?.address }, records: state.records.filter((r) => r.pet_id === pk.pet_id).map(decorateRecord) }
  }
  if (p === '/admin/reports/analytics' && m === 'GET') {
    requireAdmin(token)
    if (!query.from || !query.to) err(400, 'from and to dates are required')
    const inRange = state.bookings.filter((b) => b.booking_date >= query.from && b.booking_date <= query.to)
    const bookingsByService = Object.values(inRange.reduce((acc, b) => {
      const s = svc(b.service_id)
      acc[s.service_id] = { name: s.name, category: s.category, bookings: (acc[s.service_id]?.bookings || 0) + 1, revenue: (acc[s.service_id]?.revenue || 0) + s.price_min }
      return acc
    }, {})).sort((a, b) => b.revenue - a.revenue)
    const revenue = inRange.filter((b) => ['confirmed', 'completed'].includes(b.status)).reduce((sum, b) => sum + svc(b.service_id).price_min, 0)
    const byClient = {}
    for (const b of inRange) {
      const o = owner(b.owner_id)
      byClient[o.owner_id] ??= { full_name: o.full_name, phone: o.phone, email: o.email, bookings: 0 }
      byClient[o.owner_id].bookings += 1
    }
    const statusBreakdown = Object.entries(inRange.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc }, {})).map(([status, n]) => ({ status, n }))
    return { from: query.from, to: query.to, totalBookings: inRange.length, revenue, bookingsByService, topClients: Object.values(byClient).sort((a, b) => b.bookings - a.bookings).slice(0, 10), statusBreakdown }
  }

  err(404, `No mock handler for ${m} ${p}`)
}

// convenience for debugging
export const mockMoney = money

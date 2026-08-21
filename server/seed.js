import { dbGet, dbAll, dbRun } from './db.js'
import { hashPassword } from './passwords.js'

// ---------- helpers ----------
const today = new Date()
function d(offsetDays) {
  const x = new Date(today)
  x.setDate(x.getDate() + offsetDays)
  return x.toISOString().slice(0, 10)
}
// ---------- services (PetVibe catalog, PH-market pricing) ----------
const S = (name, category, price_min, price_max, duration_minutes, opts = {}) => ({
  name, category, price_min, price_max, duration_minutes,
  description: opts.description ?? '',
  requires_fasting: opts.requires_fasting ? 1 : 0,
  requires_anesthesia: opts.requires_anesthesia ? 1 : 0,
  recovery_time_hours: opts.recovery_time_hours ?? null,
  weight_requirement: opts.weight_requirement ?? null,
  weight_tier: opts.weight_tier ?? null,
  client_bookable: opts.client_bookable ? 1 : 0,
})

const SERVICES = [
  // Consultation & Check-Up — client-bookable
  S('General Consultation', 'Consultation & Check-Up', 400, 500, 30, { client_bookable: true, description: 'Full physical exam, history review, and treatment plan for any concern.' }),
  S('New Patient Consultation', 'Consultation & Check-Up', 450, 500, 45, { client_bookable: true, description: 'Comprehensive first-visit exam, baseline weight, and vaccine schedule planning.' }),
  S('Follow-up Consultation', 'Consultation & Check-Up', 300, 350, 20, { client_bookable: true, description: 'Progress check for an existing treatment plan.' }),
  S('Senior Pet Wellness Check-up', 'Consultation & Check-Up', 500, 600, 45, { client_bookable: true, description: 'Geriatric exam focused on mobility, organ health, and preventive care.' }),

  // Vaccination & Deworming — client-bookable
  S('5-in-1 Vaccine', 'Vaccination & Deworming', 600, 700, 30, { client_bookable: true, weight_tier: 'dog', description: 'Core combination vaccine for distemper, hepatitis, parainfluenza, parvovirus, and leptospirosis.' }),
  S('Rabies Vaccine', 'Vaccination & Deworming', 400, 500, 30, { client_bookable: true, description: 'Annual anti-rabies vaccination with veterinary certification.' }),
  S('8-in-1 Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true, weight_tier: 'dog' }),
  S('Deworming (Tablet)', 'Vaccination & Deworming', 150, 250, 20, { client_bookable: true, description: 'Oral deworming; dose based on current weight.' }),
  S('Puppy Vaccination Series', 'Vaccination & Deworming', 1500, 2500, 45, { client_bookable: true, weight_tier: 'dog', description: 'Full puppy series: deworming, 5-in-1 boosters, and rabies.' }),
  S('Kennel Cough Vaccine', 'Vaccination & Deworming', 500, 600, 30, { client_bookable: true, weight_tier: 'dog' }),
  S('Feline 4-in-1 Vaccine (FVRCP)', 'Vaccination & Deworming', 700, 800, 30, { client_bookable: true, weight_tier: 'cat' }),
  S('Feline Leukemia Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true, weight_tier: 'cat' }),

  // Digital X-Ray — client-bookable
  S('Digital X-Ray', 'Digital X-Ray', 800, 1500, 20, { client_bookable: true, description: 'High-resolution digital radiographs, reviewed with you on-screen.' }),

  // Pet Grooming — client-bookable (price scales by pet size/weight tier)
  S('Bath & Blow Dry — Small Dog', 'Pet Grooming', 250, 350, 60, { client_bookable: true, weight_tier: 'small', description: 'Bath, blow dry, ear cleaning, and nail trim. Small dogs up to 7 kg.' }),
  S('Bath & Blow Dry — Medium Dog', 'Pet Grooming', 350, 450, 75, { client_bookable: true, weight_tier: 'medium' }),
  S('Bath & Blow Dry — Large Dog', 'Pet Grooming', 450, 600, 90, { client_bookable: true, weight_tier: 'large' }),
  S('Bath & Blow Dry — XL Dog', 'Pet Grooming', 600, 800, 105, { client_bookable: true, weight_tier: 'xl' }),
  S('Bath & Blow Dry — XXL Dog', 'Pet Grooming', 800, 1000, 120, { client_bookable: true, weight_tier: 'xxl' }),
  S('Bath & Blow Dry — XXXL Dog', 'Pet Grooming', 1000, 1300, 135, { client_bookable: true, weight_tier: 'xxxl' }),
  S('Bath & Blow Dry — Cat', 'Pet Grooming', 300, 400, 60, { client_bookable: true, weight_tier: 'cat' }),
  S('Full Groom Package — Small Dog', 'Pet Grooming', 500, 650, 120, { client_bookable: true, weight_tier: 'small', description: 'Bath, haircut, nail trim, ear cleaning, and styling.' }),
  S('Full Groom Package — Medium Dog', 'Pet Grooming', 650, 850, 150, { client_bookable: true, weight_tier: 'medium' }),
  S('Full Groom Package — Large Dog', 'Pet Grooming', 850, 1100, 180, { client_bookable: true, weight_tier: 'large' }),
  S('Full Groom Package — Cat', 'Pet Grooming', 600, 800, 120, { client_bookable: true, weight_tier: 'cat' }),
  S('Nail Trim & Ear Cleaning', 'Pet Grooming', 100, 150, 20, { client_bookable: true, description: 'Quick nail trim and ear cleaning for any size pet.' }),
  S('De-matting Service', 'Pet Grooming', 500, 1000, 90, { client_bookable: true, weight_tier: 'any', description: 'Gentle removal of mats and tangles; price depends on severity.' }),

  // Counseling / certificates — client-bookable
  S('Nutrition Counseling', 'Nutrition Counseling', 350, 400, 30, { client_bookable: true, description: 'Personalized diet and feeding plan for weight, allergies, or life stage.' }),
  S('Behavioral Consultation', 'Behavioral Consultation', 600, 800, 45, { client_bookable: true, description: 'One-on-one session for aggression, anxiety, and housetraining issues.' }),
  S('Travel / Health Certificate', 'Travel / Health Certificates', 450, 550, 30, { client_bookable: true, description: 'Veterinary health certificate for domestic travel; bring records.' }),

  // Veterinary Surgery — mixed: spay/neuter client-bookable, rest admin-only
  S('Spay (Female) — Ovariohysterectomy', 'Veterinary Surgery', 2500, 4500, 120, { client_bookable: true, requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 48, weight_requirement: 'Minimum 1.5 kg', description: 'Neuter surgery for female pets. Pre-op fasting required (no food 8–12h).' }),
  S('Neuter (Male) — Castration', 'Veterinary Surgery', 2000, 3500, 90, { client_bookable: true, requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 24, weight_requirement: 'Minimum 1.5 kg' }),
  S('C-Section (Caesarean)', 'Veterinary Surgery', 8000, 15000, 180, { requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 72, description: 'Emergency/planned delivery surgery. Admin-only booking.' }),
  S('Mass / Tumor Removal', 'Veterinary Surgery', 5000, 10000, 120, { requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 48 }),
  S('Wound Repair / Suturing', 'Veterinary Surgery', 2000, 4000, 60, { requires_anesthesia: true, recovery_time_hours: 24 }),

  // Diagnostic Laboratories — admin-only add-ons
  S('Complete Blood Count (CBC)', 'Diagnostic Laboratories', 500, 800, 15, {}),
  S('Blood Chemistry Panel', 'Diagnostic Laboratories', 1500, 2500, 15, {}),
  S('Fecalysis', 'Diagnostic Laboratories', 200, 300, 15, {}),
  S('Urinalysis', 'Diagnostic Laboratories', 300, 400, 15, {}),
  S('Skin Scraping / Cytology', 'Diagnostic Laboratories', 350, 500, 15, {}),
  S('Heartworm Test', 'Diagnostic Laboratories', 600, 800, 15, {}),
  S('Parvo Test (CPV)', 'Diagnostic Laboratories', 500, 600, 15, { weight_tier: 'dog' }),
  S('Distemper Test (CDV)', 'Diagnostic Laboratories', 500, 600, 15, { weight_tier: 'dog' }),
  S('Feline Leukemia / FIV Test', 'Diagnostic Laboratories', 800, 1000, 15, { weight_tier: 'cat' }),
  S('Thyroid Panel (T4)', 'Diagnostic Laboratories', 1200, 1500, 15, {}),
  S('Ear Cytology', 'Diagnostic Laboratories', 300, 400, 15, {}),
  S('Culture & Sensitivity', 'Diagnostic Laboratories', 1800, 2500, 20, {}),

  // Add-on procedures
  S('Blood Extraction / Venipuncture', 'Blood Extraction', 150, 250, 15, {}),
  S('Fecal Antigen Test (Giardia/Parvo)', 'Fecal Antigen Testing', 400, 600, 15, {}),
  S('Abdominal Ultrasound', 'Ultrasound', 1200, 2000, 30, { requires_fasting: true, description: 'Non-invasive imaging; fasting recommended for abdominal scans.' }),
  S('Cardiac Ultrasound (Echo)', 'Ultrasound', 2500, 4000, 45, {}),

  // Dentistry — admin-only (anesthesia involved)
  S('Dental Cleaning (Scaling & Polishing)', 'Dentistry', 2500, 4000, 90, { requires_fasting: true, requires_anesthesia: true, recovery_time_hours: 24 }),
  S('Tooth Extraction (per tooth)', 'Dentistry', 500, 1500, 60, { requires_anesthesia: true, recovery_time_hours: 24 }),
  S('Oral Surgery', 'Dentistry', 4000, 8000, 120, { requires_anesthesia: true, recovery_time_hours: 48 }),

  S('Laser Therapy Session', 'Laser Therapy', 500, 900, 30, { description: 'Pain relief and healing for wounds, arthritis, and skin conditions.' }),
  S('Physical Therapy / Rehab Session', 'Physical Rehabilitation', 800, 1200, 45, {}),

  // Confinement — admin-only
  S('Confinement / Boarding (per day)', 'Confinement', 800, 1500, 1440, { description: 'Supervised overnight stay with feeding and medication.' }),
  S('ICU Confinement (per day)', 'Confinement', 2500, 4000, 1440, {}),

  // Emergency / sensitive — admin-only
  S('Emergency Consultation (Walk-in/ER)', 'Emergency Care', 1500, 2500, 45, { description: 'Immediate care for urgent cases. Walk-ins handled at the counter.' }),
  S('Allergy Testing (Intradermal)', 'Pet Allergy Testing', 3500, 5000, 60, {}),
  S('Medication Dispensing', 'Pharmacy / Medication Dispensing', 100, 1000, 15, { description: 'Prescription medications dispensed during a visit.' }),
  S('Hospice & Euthanasia Care', 'Hospice & Euthanasia Care', 2500, 3500, 60, { description: 'Compassionate end-of-life care. Please call the clinic to arrange.' }),

  // Injections — admin-only add-ons during visit
  S('Vitamin Injection', 'Injections', 150, 250, 15, {}),
  S('Antibiotic Injection', 'Injections', 250, 400, 15, {}),
  S('Pain Medication Injection', 'Injections', 200, 350, 15, {}),
  S('Antihistamine Injection', 'Injections', 200, 300, 15, {}),
  S('Iron Supplement Injection', 'Injections', 250, 350, 15, {}),
  S('Fluid Therapy (IV)', 'Injections', 400, 800, 30, {}),
  S('Dexamethasone Injection', 'Injections', 200, 300, 15, {}),
  S('Subcutaneous Fluids', 'Injections', 300, 500, 30, {}),

  // Small pets / birds / pigs — species-specific grooming (newer species)
  S('Bath & Grooming — Rabbit', 'Pet Grooming', 300, 450, 60, { client_bookable: true, weight_tier: 'rabbit', description: 'Gentle bath, brushing, and nail trim for rabbits.' }),
  S('Bath & Grooming — Guinea Pig', 'Pet Grooming', 300, 450, 60, { client_bookable: true, weight_tier: 'guinea_pig', description: 'Bath, brush, and nail care for guinea pigs.' }),
  S('Bath & Grooming — Fancy Rat', 'Pet Grooming', 250, 400, 45, { client_bookable: true, weight_tier: 'rat', description: 'Gentle wash, brushing, and nail trim for rats.' }),
  S('Wing Trim & Nail Care — Birds', 'Pet Grooming', 200, 350, 30, { client_bookable: true, weight_tier: 'bird', description: 'Safe wing clip and nail care for parrots and small birds.' }),
  S('Hoof & Nail Trim — Pig', 'Pet Grooming', 350, 600, 45, { client_bookable: true, weight_tier: 'pig', description: 'Hoof and tusk maintenance for pet pigs.' }),
]

// ---------- bundles ----------
const BUNDLES = [
  {
    name: 'Puppy Starter Bundle', description: 'Everything a new puppy needs for its first months: initial check-up, core vaccines, deworming, and a grooming intro.',
    price: 2500, discount_percent: 15,
    services: ['New Patient Consultation', '5-in-1 Vaccine', 'Deworming (Tablet)', 'Nail Trim & Ear Cleaning'],
  },
  {
    name: 'Adult Wellness Bundle', description: 'Annual wellness visit with blood work and deworming — one visit, total peace of mind.',
    price: 1800, discount_percent: 10,
    services: ['General Consultation', 'Complete Blood Count (CBC)', 'Deworming (Tablet)'],
  },
  {
    name: 'Senior Care Bundle', description: 'Focused care for pets 7 years and up: geriatric exam plus full blood panel.',
    price: 3200, discount_percent: 15,
    services: ['Senior Pet Wellness Check-up', 'Complete Blood Count (CBC)', 'Blood Chemistry Panel'],
  },
  {
    name: 'Spa Day Bundle', description: 'Pamper day: full groom plus nail trim for a fresh, healthy coat.',
    price: 1200, discount_percent: 10,
    services: ['Full Groom Package — Small Dog', 'Nail Trim & Ear Cleaning'],
  },
]

// ---------- staff ----------
const STAFF = [
  { full_name: 'Dr. Elinor Romero', role: 'admin', email: 'admin@petvibe.ph', specialization: 'Clinic Director', active: 1 },
  { full_name: 'Dr. Sophia Sayaman', role: 'vet', email: 'vet@petvibe.ph', specialization: 'Surgery & Orthopedics', active: 1, password: 'password123' },
  { full_name: 'Dr. Marty Palmenco', role: 'vet', email: 'grace@petvibe.ph', specialization: 'Internal Medicine & Diagnostics', active: 1, password: 'password123' },
  { full_name: 'Dr. Rainiel Pallaya', role: 'vet', email: 'carlo@petvibe.ph', specialization: 'Preventive Care & Wellness', active: 1, password: 'password123' },
  { full_name: 'Dr. Antoinette Curitana', role: 'groomer', email: 'liza@petvibe.ph', specialization: 'Grooming & Spa', active: 1, password: 'password123' },
]

const WEEKLY = [
  { staff: 'Dr. Elinor Romero', days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00' },
  { staff: 'Dr. Sophia Sayaman', days: [0, 1, 3, 5, 6], start: '09:00', end: '17:00' },
  { staff: 'Dr. Marty Palmenco', days: [1, 2, 4, 5, 6], start: '10:00', end: '18:00' },
  { staff: 'Dr. Rainiel Pallaya', days: [1, 2, 3, 5, 6], start: '09:00', end: '17:00' },
  { staff: 'Dr. Antoinette Curitana', days: [1, 2, 3, 4, 5, 6], start: '10:00', end: '18:00' },
]

// ---------- demo owners / pets / bookings ----------
// The demo client dataset (Maria Santos, Juan Dela Cruz, Ana Garcia, Ramon
// Bautista and their pets/bookings/records) was removed at the clinic's
// request. It is deliberately NOT seeded anymore, so the deleted accounts
// never come back on restart. A fresh database now starts with the catalog,
// bundles and staff only — clients are created through the admin dashboard.
const OWNERS = []
const PETS = []
const BOOKINGS = []
const MEDICAL_RECORDS = []

// Reference codes are assigned in BOOKINGS array order starting at PV-1001,
// both in the fresh-install seed below and in the demo-data sync.
const refFor = (index) => `PV-${1001 + index}`

// Idempotent demo-data sync, run on EVERY startup. Fresh databases already
// have all of this from seed() above; existing databases (seeded before the
// account-status / typed-records / audit-log features) get the missing demo
// rows filled in here, so the demo experience matches regardless of when the
// database was first created.
async function syncDemoData() {
  // Self-heal: if the catalog or staff were emptied (e.g. partial DB reset),
  // restore them so the rest of the demo sync (bookings reference services
  // and staff by name) can proceed. Also normalize any service rows whose
  // `active` ended up NULL — those read as inactive everywhere.
  const { n: svcCount } = await dbGet('SELECT COUNT(*) AS n FROM services')
  if (Number(svcCount) === 0) {
    for (const s of SERVICES) {
      await dbRun(
        `INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, requires_fasting, requires_anesthesia, recovery_time_hours, weight_requirement, weight_tier, client_bookable, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1)`,
        [s.name, s.category, s.description, s.price_min, s.price_max, s.duration_minutes, s.requires_fasting, s.requires_anesthesia, s.recovery_time_hours, s.weight_requirement, s.weight_tier, s.client_bookable]
      )
    }
    console.log(`[seed] restored ${SERVICES.length} services (catalog was empty)`)
  } else {
    await dbRun('UPDATE services SET active = 1 WHERE active IS NULL')
  }

  // Species-specific grooming services added later — existing databases
  // won't have them, so insert them idempotently by name.
  const extraServices = [
    ['Bath & Grooming — Rabbit', 'Pet Grooming', 300, 450, 60, 'rabbit', 'Gentle bath, brushing, and nail trim for rabbits.'],
    ['Bath & Grooming — Guinea Pig', 'Pet Grooming', 300, 450, 60, 'guinea_pig', 'Bath, brush, and nail care for guinea pigs.'],
    ['Bath & Grooming — Fancy Rat', 'Pet Grooming', 250, 400, 45, 'rat', 'Gentle wash, brushing, and nail trim for rats.'],
    ['Wing Trim & Nail Care — Birds', 'Pet Grooming', 200, 350, 30, 'bird', 'Safe wing clip and nail care for parrots and small birds.'],
    ['Hoof & Nail Trim — Pig', 'Pet Grooming', 350, 600, 45, 'pig', 'Hoof and tusk maintenance for pet pigs.'],
  ]
  for (const [name, category, priceMin, priceMax, dur, tier, desc] of extraServices) {
    const exists = await dbGet('SELECT 1 FROM services WHERE name = $1', [name])
    if (!exists) {
      await dbRun(
        `INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1)`,
        [name, category, desc, priceMin, priceMax, dur, tier]
      )
    }
  }

  // Species-specific services whose weight_tier was added later — backfill
  // existing rows that still have no tier (e.g. Feline 4-in-1 is cats only,
  // Parvo test is dogs only).
  const tierBackfill = [
    ['5-in-1 Vaccine', 'dog'], ['8-in-1 Vaccine', 'dog'], ['Kennel Cough Vaccine', 'dog'], ['Puppy Vaccination Series', 'dog'],
    ['Feline 4-in-1 Vaccine (FVRCP)', 'cat'], ['Feline Leukemia Vaccine', 'cat'],
    ['Parvo Test (CPV)', 'dog'], ['Distemper Test (CDV)', 'dog'], ['Feline Leukemia / FIV Test', 'cat'],
  ]
  for (const [name, tier] of tierBackfill) {
    await dbRun("UPDATE services SET weight_tier = $1 WHERE name = $2 AND (weight_tier IS NULL OR weight_tier = '')", [tier, name])
  }

  const { n: staffCount } = await dbGet('SELECT COUNT(*) AS n FROM staff')
  if (Number(staffCount) === 0) {
    for (const st of STAFF) {
      const hash = st.password ? hashPassword(st.password) : (st.role === 'admin' ? hashPassword('password123') : null)
      await dbRun(
        'INSERT INTO staff (full_name, role, email, password_hash, specialization, active) VALUES ($1, $2, $3, $4, $5, $6)',
        [st.full_name, st.role, st.email, hash, st.specialization, st.active]
      )
    }
    const allStaff = await dbAll('SELECT staff_id, full_name FROM staff')
    const byName = Object.fromEntries(allStaff.map((s) => [s.full_name, s.staff_id]))
    for (const w of WEEKLY) {
      for (const day of w.days) {
        await dbRun('INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, 1)', [byName[w.staff], day, w.start, w.end])
      }
    }
    console.log(`[seed] restored ${STAFF.length} staff + schedules (staff table was empty)`)
  }

  // Backfill passwords for existing staff who have none (e.g. vets/groomers
  // created before the staff-login feature). Admin always gets password123;
  // other roles get it too so they can log in as staff.
  for (const st of STAFF) {
    if (st.password) {
      const existing = await dbGet('SELECT staff_id, password_hash FROM staff WHERE email = $1', [st.email])
      if (existing && !existing.password_hash) {
        await dbRun('UPDATE staff SET password_hash = $1 WHERE staff_id = $2', [hashPassword(st.password), existing.staff_id])
        console.log(`[seed] backfilled password for ${st.full_name}`)
      }
    }
  }

  const ownerIdByEmail = {}
  const ownerIdByName = {}
  for (const o of OWNERS) {
    const existing = await dbGet('SELECT owner_id FROM owners WHERE LOWER(email) = LOWER($1)', [o.email])
    if (existing) {
      ownerIdByEmail[o.email.toLowerCase()] = existing.owner_id
      ownerIdByName[o.full_name.toLowerCase()] = existing.owner_id
    } else {
      const { rows } = await dbRun(
        'INSERT INTO owners (full_name, email, phone, password_hash, address, account_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING owner_id',
        [o.full_name, o.email, o.phone, o.password_hash, o.address, o.account_type, o.status]
      )
      ownerIdByEmail[o.email.toLowerCase()] = rows[0].owner_id
      ownerIdByName[o.full_name.toLowerCase()] = rows[0].owner_id
    }
  }

  const staffIdByName = {}
  for (const st of STAFF) {
    const existing = await dbGet('SELECT staff_id FROM staff WHERE full_name = $1', [st.full_name])
    if (existing) staffIdByName[st.full_name] = existing.staff_id
  }

  const petIdByKey = {}
  for (const p of PETS) {
    const oid = ownerIdByName[p.owner.toLowerCase()]
    if (!oid) continue
    const existing = await dbGet('SELECT pet_id FROM pets WHERE owner_id = $1 AND LOWER(name) = LOWER($2)', [oid, p.name])
    if (existing) {
      petIdByKey[`${p.owner.toLowerCase()}:${p.name}`] = existing.pet_id
    } else {
      const { rows } = await dbRun(
        'INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING pet_id',
        [oid, p.name, p.species, p.breed, p.gender, p.birthdate, p.weight_kg]
      )
      petIdByKey[`${p.owner.toLowerCase()}:${p.name}`] = rows[0].pet_id
    }
  }

  const bookingIdByRef = {}
  for (let i = 0; i < BOOKINGS.length; i++) {
    const b = BOOKINGS[i]
    const ref = refFor(i)
    const existing = await dbGet('SELECT booking_id FROM bookings WHERE reference_code = $1', [ref])
    if (existing) { bookingIdByRef[ref] = existing.booking_id; continue }
    const oid = ownerIdByName[b.owner.toLowerCase()]
    const pid = petIdByKey[`${b.owner.toLowerCase()}:${b.pet}`]
    const svc = await dbGet('SELECT service_id FROM services WHERE name = $1', [b.service])
    if (!oid || !pid || !svc) continue
    const { rows } = await dbRun(
      `INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING booking_id`,
      [ref, oid, pid, svc.service_id, b.staff ? staffIdByName[b.staff] ?? null : null, d(b.date), b.time, b.status, b.created_by, b.notes]
    )
    bookingIdByRef[ref] = rows[0].booking_id
  }

  // Medical records: backfill record_type/title on legacy rows and add the
  // overdue-vaccine demo record if it's missing.
  for (const mr of MEDICAL_RECORDS) {
    const ownerName = PETS.find((p) => p.name === mr.pet)?.owner
    const pid = petIdByKey[`${ownerName?.toLowerCase()}:${mr.pet}`]
    if (!pid) continue
    const row = await dbGet('SELECT record_id, record_type FROM medical_records WHERE pet_id = $1 AND visit_date = $2', [pid, d(mr.visit_date)])
    if (row) {
      if (!row.record_type && mr.record_type) {
        await dbRun('UPDATE medical_records SET record_type = $1, title = COALESCE($2, title) WHERE record_id = $3', [mr.record_type, mr.title || null, row.record_id])
      }
    } else if (mr.title === 'Rabies booster (due)') {
      await dbRun(
        `INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date, record_type, title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [pid, null, d(mr.visit_date), mr.staff ? staffIdByName[mr.staff] ?? null : null, mr.diagnosis, mr.treatment_notes, mr.vaccinations_given, mr.weight_at_visit, d(mr.next_due_date), mr.record_type, mr.title]
      )
    }
  }

  // Audit trail — only when the log table is completely empty (keeps the
  // demo timeline intact without stamping over real history).
  const { n: logCount } = await dbGet('SELECT COUNT(*) AS n FROM booking_status_log')
  if (Number(logCount) === 0) {
    const logRows = [
      [0, null, 'pending', 'client', 'Maria Santos', 'Booking created by client'],
      [0, 'pending', 'confirmed', 'admin', 'Dr. Elinor Romero', null],
      [6, null, 'pending', 'client', 'Maria Santos', 'Booking created by client'],
      [6, 'pending', 'confirmed', 'admin', 'Dr. Elinor Romero', null],
      [6, 'confirmed', 'completed', 'admin', 'Dr. Sophia Sayaman', null],
      [4, null, 'pending', 'client', 'Maria Santos', 'Booking created by client'],
      [4, 'pending', 'confirmed', 'admin', 'Dr. Elinor Romero', null],
      [4, 'confirmed', 'completed', 'admin', 'Dr. Marty Palmenco', null],
      [5, null, 'pending', 'client', 'Maria Santos', 'Booking created by client'],
      [5, 'pending', 'confirmed', 'admin', 'Dr. Elinor Romero', null],
      [5, 'confirmed', 'no_show', 'admin', 'Dr. Elinor Romero', 'Client arrived 45 minutes late; slot forfeited to walk-in'],
    ]
    for (const [idx, from, to, role, name, note] of logRows) {
      const bid = bookingIdByRef[refFor(idx)]
      if (bid) {
        await dbRun(
          'INSERT INTO booking_status_log (booking_id, from_status, to_status, note, changed_by_role, changed_by_name) VALUES ($1, $2, $3, $4, $5, $6)',
          [bid, from, to, note, role, name]
        )
      }
    }
  }

  // Client reschedule request — pending, staff must approve (Bella's x-ray)
  const xray = bookingIdByRef[refFor(2)]
  if (xray) {
    const exists = await dbGet("SELECT 1 FROM reschedule_requests WHERE booking_id = $1 AND status = 'pending'", [xray])
    if (!exists) {
      await dbRun(
        `INSERT INTO reschedule_requests (booking_id, requested_date, requested_time, reason, status) VALUES ($1, $2, '15:00', 'Work schedule conflict — can only come after 2pm', 'pending')`,
        [xray, d(5)]
      )
    }
  }
}

export async function seed() {
  const { n: count } = await dbGet('SELECT COUNT(*) AS n FROM owners')
  if (Number(count) > 0) {
    // Existing database — just make sure the newer demo data is present.
    await syncDemoData()
    await logCounts()
    return false
  }

  const serviceIdByName = {}
  for (const s of SERVICES) {
    const { rows } = await dbRun(
      `INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, requires_fasting, requires_anesthesia, recovery_time_hours, weight_requirement, weight_tier, client_bookable, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1) RETURNING service_id`,
      [s.name, s.category, s.description, s.price_min, s.price_max, s.duration_minutes, s.requires_fasting, s.requires_anesthesia, s.recovery_time_hours, s.weight_requirement, s.weight_tier, s.client_bookable]
    )
    serviceIdByName[s.name] = rows[0].service_id
  }

  for (const b of BUNDLES) {
    const { rows } = await dbRun(
      'INSERT INTO bundles (name, description, price, discount_percent) VALUES ($1, $2, $3, $4) RETURNING bundle_id',
      [b.name, b.description, b.price, b.discount_percent]
    )
    const bundleId = rows[0].bundle_id
    for (const s of b.services) {
      if (serviceIdByName[s]) await dbRun('INSERT INTO bundle_services (bundle_id, service_id) VALUES ($1, $2)', [bundleId, serviceIdByName[s]])
    }
  }

  const staffIdByName = {}
  for (const st of STAFF) {
    const hash = st.password ? hashPassword(st.password) : (st.role === 'admin' ? hashPassword('password123') : null)
    const { rows } = await dbRun(
      'INSERT INTO staff (full_name, role, email, password_hash, specialization, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING staff_id',
      [st.full_name, st.role, st.email, hash, st.specialization, st.active]
    )
    staffIdByName[st.full_name] = rows[0].staff_id
  }

  for (const w of WEEKLY) {
    for (const day of w.days) {
      await dbRun(
        'INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, 1)',
        [staffIdByName[w.staff], day, w.start, w.end]
      )
    }
  }

  const ownerIdByName = {}
  for (const o of OWNERS) {
    const { rows } = await dbRun(
      'INSERT INTO owners (full_name, email, phone, password_hash, address, account_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING owner_id',
      [o.full_name, o.email, o.phone, o.password_hash, o.address, o.account_type, o.status]
    )
    ownerIdByName[o.full_name] = rows[0].owner_id
  }

  const petIdByName = {}
  for (const p of PETS) {
    const { rows } = await dbRun(
      'INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING pet_id',
      [ownerIdByName[p.owner], p.name, p.species, p.breed, p.gender, p.birthdate, p.weight_kg]
    )
    petIdByName[`${p.owner}:${p.name}`] = rows[0].pet_id
  }

  const bookingIdByKey = {}
  let code = 1001
  for (const b of BOOKINGS) {
    const ref = `PV-${code++}`
    const { rows } = await dbRun(
      `INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING booking_id`,
      [ref, ownerIdByName[b.owner], petIdByName[`${b.owner}:${b.pet}`], serviceIdByName[b.service], b.staff ? staffIdByName[b.staff] : null, d(b.date), b.time, b.status, b.created_by, b.notes]
    )
    bookingIdByKey[`${b.pet}:${b.date}:${b.time}`] = rows[0].booking_id
  }

  for (const mr of MEDICAL_RECORDS) {
    const owner = PETS.find((p) => p.name === mr.pet).owner
    const bookingKey = `${mr.pet}:${mr.booking}:`
    const exact = Object.keys(bookingIdByKey).find((k) => k.startsWith(bookingKey))
    await dbRun(
      `INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date, record_type, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        petIdByName[`${owner}:${mr.pet}`],
        exact ? bookingIdByKey[exact] : null,
        d(mr.visit_date),
        mr.staff ? staffIdByName[mr.staff] : null,
        mr.diagnosis,
        mr.treatment_notes,
        mr.vaccinations_given,
        mr.weight_at_visit,
        mr.next_due_date ? d(mr.next_due_date) : null,
        mr.record_type || null,
        mr.title || null,
      ]
    )
  }

  await syncDemoData()
  console.log('Seeded:')
  console.log(`  ${SERVICES.length} services, ${BUNDLES.length} bundles, ${STAFF.length} staff, ${OWNERS.length} owners, ${PETS.length} pets, ${BOOKINGS.length} bookings, ${MEDICAL_RECORDS.length} medical records`)
  await logCounts()
  return true
}

// Startup summary of what's actually in the database — handy when verifying
// whether the DB was reseeded, partially wiped, or pointing elsewhere.
async function logCounts() {
  const counts = await dbAll(
    "SELECT 'services' AS t, COUNT(*) AS n FROM services UNION ALL SELECT 'owners', COUNT(*) FROM owners UNION ALL SELECT 'pets', COUNT(*) FROM pets UNION ALL SELECT 'bookings', COUNT(*) FROM bookings UNION ALL SELECT 'records', COUNT(*) FROM medical_records"
  )
  console.log('[seed] data:', counts.map((c) => `${c.t}=${c.n}`).join(' '))
}

// demo logins — the demo client account was removed with the demo data,
// so only the admin one-click login remains.
export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@petvibe.ph', password: 'password123' },
  { label: 'Staff (Vet)', email: 'vet@petvibe.ph', password: 'password123' },
  { label: 'Staff (Groomer)', email: 'liza@petvibe.ph', password: 'password123' },
]
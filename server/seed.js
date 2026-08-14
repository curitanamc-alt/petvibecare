import { db } from './db.js'
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
  S('5-in-1 Vaccine', 'Vaccination & Deworming', 600, 700, 30, { client_bookable: true, description: 'Core combination vaccine for distemper, hepatitis, parainfluenza, parvovirus, and leptospirosis.' }),
  S('Rabies Vaccine', 'Vaccination & Deworming', 400, 500, 30, { client_bookable: true, description: 'Annual anti-rabies vaccination with veterinary certification.' }),
  S('8-in-1 Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true }),
  S('Deworming (Tablet)', 'Vaccination & Deworming', 150, 250, 20, { client_bookable: true, description: 'Oral deworming; dose based on current weight.' }),
  S('Puppy Vaccination Series', 'Vaccination & Deworming', 1500, 2500, 45, { client_bookable: true, description: 'Full puppy series: deworming, 5-in-1 boosters, and rabies.' }),
  S('Kennel Cough Vaccine', 'Vaccination & Deworming', 500, 600, 30, { client_bookable: true }),
  S('Feline 4-in-1 Vaccine (FVRCP)', 'Vaccination & Deworming', 700, 800, 30, { client_bookable: true }),
  S('Feline Leukemia Vaccine', 'Vaccination & Deworming', 800, 900, 30, { client_bookable: true }),

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
  S('Parvo Test (CPV)', 'Diagnostic Laboratories', 500, 600, 15, {}),
  S('Distemper Test (CDV)', 'Diagnostic Laboratories', 500, 600, 15, {}),
  S('Feline Leukemia / FIV Test', 'Diagnostic Laboratories', 800, 1000, 15, {}),
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
  { full_name: 'Dr. Ana Reyes', role: 'admin', email: 'admin@petvibe.ph', specialization: 'Clinic Director', active: 1 },
  { full_name: 'Dr. Marco Lim', role: 'vet', email: 'vet@petvibe.ph', specialization: 'Surgery & Orthopedics', active: 1 },
  { full_name: 'Dr. Grace Tan', role: 'vet', email: 'grace@petvibe.ph', specialization: 'Internal Medicine & Diagnostics', active: 1 },
  { full_name: 'Liza Cruz', role: 'groomer', email: 'liza@petvibe.ph', specialization: 'Grooming & Spa', active: 1 },
]

const WEEKLY = [
  { staff: 'Dr. Ana Reyes', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' },
  { staff: 'Dr. Marco Lim', days: [0, 1, 3, 5, 6], start: '09:00', end: '17:00' },
  { staff: 'Dr. Grace Tan', days: [1, 2, 4, 5, 6], start: '10:00', end: '18:00' },
  { staff: 'Liza Cruz', days: [1, 2, 3, 4, 5, 6], start: '10:00', end: '18:00' },
]

// ---------- demo owners / pets / bookings ----------
const OWNERS = [
  { full_name: 'Maria Santos', email: 'client@petvibe.ph', phone: '0917 555 1234', password_hash: hashPassword('password123'), address: 'Brgy. San Lorenzo, Makati City', account_type: 'registered' },
  { full_name: 'Juan Dela Cruz', email: 'juan.dc@example.com', phone: '0918 555 9876', password_hash: null, address: 'Tondo, Manila', account_type: 'walk_in' },
]

const PETS = [
  { owner: 'Maria Santos', name: 'Bella', species: 'dog', breed: 'Shih Tzu', gender: 'female', birthdate: '2021-03-14', weight_kg: 5.2 },
  { owner: 'Maria Santos', name: 'Mochi', species: 'cat', breed: 'Persian', gender: 'male', birthdate: '2022-06-01', weight_kg: 4.1 },
  { owner: 'Juan Dela Cruz', name: 'Bantay', species: 'dog', breed: 'Aspin', gender: 'male', birthdate: '2019-01-10', weight_kg: 18.0 },
]

const BOOKINGS = [
  // today — confirmed check-up for Bella
  { owner: 'Maria Santos', pet: 'Bella', service: 'General Consultation', staff: 'Dr. Grace Tan', date: 0, time: '10:00', status: 'confirmed', created_by: 'client', notes: 'Low appetite since Monday.' },
  // today — pending grooming for Mochi
  { owner: 'Maria Santos', pet: 'Mochi', service: 'Bath & Blow Dry — Cat', staff: 'Liza Cruz', date: 0, time: '14:00', status: 'pending', created_by: 'client', notes: 'Matting behind the ears.' },
  // +3 days — pending x-ray
  { owner: 'Maria Santos', pet: 'Bella', service: 'Digital X-Ray', staff: null, date: 3, time: '11:00', status: 'pending', created_by: 'client', notes: 'Suspected hip issue, limping.' },
  // +1 day — pending neuter (admin-created)
  { owner: 'Juan Dela Cruz', pet: 'Bantay', service: 'Neuter (Male) — Castration', staff: 'Dr. Marco Lim', date: 1, time: '09:00', status: 'pending', created_by: 'admin', notes: 'Walk-in booking made at counter.' },
  // -6 days — completed check-up w/ medical record
  { owner: 'Maria Santos', pet: 'Bella', service: 'General Consultation', staff: 'Dr. Grace Tan', date: -6, time: '15:00', status: 'completed', created_by: 'client', notes: 'Annual wellness visit.' },
  // -5 days — no-show deworming (triggers rebooking email)
  { owner: 'Maria Santos', pet: 'Bella', service: 'Deworming (Tablet)', staff: 'Dr. Grace Tan', date: -5, time: '09:00', status: 'no_show', created_by: 'client', notes: 'Client arrived 45 minutes late; slot forfeited to walk-in.' },
  // -20 days — completed vaccine
  { owner: 'Maria Santos', pet: 'Bella', service: '5-in-1 Vaccine', staff: 'Dr. Marco Lim', date: -20, time: '10:00', status: 'completed', created_by: 'client', notes: null },
  // -30 days — completed grooming
  { owner: 'Maria Santos', pet: 'Mochi', service: 'Full Groom Package — Cat', staff: 'Liza Cruz', date: -30, time: '13:00', status: 'completed', created_by: 'client', notes: null },
]

const MEDICAL_RECORDS = [
  { pet: 'Bella', booking: -20, staff: 'Dr. Marco Lim', visit_date: -20, diagnosis: 'Healthy — routine vaccination', treatment_notes: '5-in-1 booster administered. No adverse reaction. Advised heartworm prevention.', vaccinations_given: '5-in-1 Vaccine', weight_at_visit: 5.0, next_due_date: 145 },
  { pet: 'Bella', booking: -6, staff: 'Dr. Grace Tan', visit_date: -6, diagnosis: 'Mild gastritis suspected', treatment_notes: 'Prescribed bland diet for 3 days and GI protectant. Recheck if symptoms persist.', vaccinations_given: null, weight_at_visit: 5.1, next_due_date: null },
  { pet: 'Mochi', booking: -30, staff: 'Liza Cruz', visit_date: -30, diagnosis: 'Healthy — grooming visit', treatment_notes: 'Full groom completed. Minor matting removed behind ears. Skin clear.', vaccinations_given: null, weight_at_visit: 4.0, next_due_date: null },
]

export function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM owners').get().n
  if (count > 0) return false

  const insertService = db.prepare(`INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, requires_fasting, requires_anesthesia, recovery_time_hours, weight_requirement, weight_tier, client_bookable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const serviceIdByName = {}
  for (const s of SERVICES) {
    const r = insertService.run(s.name, s.category, s.description, s.price_min, s.price_max, s.duration_minutes, s.requires_fasting, s.requires_anesthesia, s.recovery_time_hours, s.weight_requirement, s.weight_tier, s.client_bookable)
    serviceIdByName[s.name] = Number(r.lastInsertRowid)
  }

  const insertBundle = db.prepare('INSERT INTO bundles (name, description, price, discount_percent) VALUES (?, ?, ?, ?)')
  const insertBundleService = db.prepare('INSERT INTO bundle_services (bundle_id, service_id) VALUES (?, ?)')
  for (const b of BUNDLES) {
    const r = insertBundle.run(b.name, b.description, b.price, b.discount_percent)
    for (const s of b.services) {
      if (serviceIdByName[s]) insertBundleService.run(Number(r.lastInsertRowid), serviceIdByName[s])
    }
  }

  const insertStaff = db.prepare('INSERT INTO staff (full_name, role, email, password_hash, specialization, active) VALUES (?, ?, ?, ?, ?, ?)')
  const staffIdByName = {}
  for (const st of STAFF) {
    const r = insertStaff.run(st.full_name, st.role, st.email, st.role === 'admin' ? hashPassword('password123') : null, st.specialization, st.active)
    staffIdByName[st.full_name] = Number(r.lastInsertRowid)
  }

  const insertSchedule = db.prepare('INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES (?, ?, ?, ?, 1)')
  for (const w of WEEKLY) {
    for (const day of w.days) {
      insertSchedule.run(staffIdByName[w.staff], day, w.start, w.end)
    }
  }

  const insertOwner = db.prepare('INSERT INTO owners (full_name, email, phone, password_hash, address, account_type) VALUES (?, ?, ?, ?, ?, ?)')
  const ownerIdByName = {}
  for (const o of OWNERS) {
    const r = insertOwner.run(o.full_name, o.email, o.phone, o.password_hash, o.address, o.account_type)
    ownerIdByName[o.full_name] = Number(r.lastInsertRowid)
  }

  const insertPet = db.prepare('INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const petIdByName = {}
  for (const p of PETS) {
    const r = insertPet.run(ownerIdByName[p.owner], p.name, p.species, p.breed, p.gender, p.birthdate, p.weight_kg)
    petIdByName[`${p.owner}:${p.name}`] = Number(r.lastInsertRowid)
  }

  const insertBooking = db.prepare(`INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const bookingIdByKey = {}
  let code = 1001
  for (const b of BOOKINGS) {
    const ref = `PV-${code++}`
    const r = insertBooking.run(ref, ownerIdByName[b.owner], petIdByName[`${b.owner}:${b.pet}`], serviceIdByName[b.service], b.staff ? staffIdByName[b.staff] : null, d(b.date), b.time, b.status, b.created_by, b.notes)
    bookingIdByKey[`${b.pet}:${b.date}:${b.time}`] = Number(r.lastInsertRowid)
  }

  const insertRecord = db.prepare('INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const mr of MEDICAL_RECORDS) {
    const owner = PETS.find((p) => p.name === mr.pet).owner
    const bookingKey = `${mr.pet}:${mr.booking}:`
    const exact = Object.keys(bookingIdByKey).find((k) => k.startsWith(bookingKey))
    insertRecord.run(
      petIdByName[`${owner}:${mr.pet}`],
      exact ? bookingIdByKey[exact] : null,
      d(mr.visit_date),
      mr.staff ? staffIdByName[mr.staff] : null,
      mr.diagnosis,
      mr.treatment_notes,
      mr.vaccinations_given,
      mr.weight_at_visit,
      mr.next_due_date ? d(mr.next_due_date) : null,
    )
  }

  // Notifications — confirmation email for today's confirmed booking, rebooking email for the no-show
  const insertNotif = db.prepare('INSERT INTO notifications (owner_id, booking_id, type, channel, message_body) VALUES (?, ?, ?, ?, ?)')
  insertNotif.run(ownerIdByName['Maria Santos'], bookingIdByKey['Bella:0:10:00'], 'confirmation', 'email', 'Your booking PV-' + (1001 + 0) + ' is confirmed for ' + d(0) + ' at 10:00. See you there!')
  const noShowRef = 'PV-' + (1001 + 5)
  insertNotif.run(ownerIdByName['Maria Santos'], bookingIdByKey['Bella:-5:09:00'], 'rebooking', 'email', 'Your slot ' + noShowRef + ' was forfeited due to late arrival. Here are available rebooking slots: ' + d(1) + ' 10:00, ' + d(1) + ' 14:00, ' + d(2) + ' 09:00.')

  console.log('Seeded:')
  console.log(`  ${SERVICES.length} services, ${BUNDLES.length} bundles, ${STAFF.length} staff, ${OWNERS.length} owners, ${PETS.length} pets, ${BOOKINGS.length} bookings, ${MEDICAL_RECORDS.length} medical records`)
  return true
}

// demo logins
export const DEMO_ACCOUNTS = [
  { label: 'Client', email: 'client@petvibe.ph', password: 'password123' },
  { label: 'Admin/Staff', email: 'admin@petvibe.ph', password: 'password123' },
]

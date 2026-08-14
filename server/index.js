import express from 'express'
import cors from 'cors'
import { randomBytes } from 'node:crypto'
import { db } from './db.js'
import { seed, DEMO_ACCOUNTS } from './seed.js'
import { hashPassword, verifyPassword } from './passwords.js'

seed()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const todayStr = () => new Date().toISOString().slice(0, 10)

// ---------------- auth helpers ----------------
function createSession(ownerId = null, staffId = null) {
  const token = randomBytes(24).toString('hex')
  db.prepare('INSERT INTO sessions (token, owner_id, staff_id) VALUES (?, ?, ?)').run(token, ownerId, staffId)
  return token
}

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!s) return res.status(401).json({ error: 'Invalid or expired session' })
  req.session = s
  if (s.owner_id) {
    req.owner = db.prepare('SELECT * FROM owners WHERE owner_id = ?').get(s.owner_id)
  }
  if (s.staff_id) {
    req.staff = db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(s.staff_id)
  }
  next()
}

const requireOwner = (req, res, next) => {
  if (req.session === undefined) return auth(req, res, () => requireOwner(req, res, next))
  return req.owner ? next() : res.status(403).json({ error: 'Client account required' })
}
const requireStaff = (req, res, next) => {
  if (req.session === undefined) return auth(req, res, () => requireStaff(req, res, next))
  return req.staff ? next() : res.status(403).json({ error: 'Staff access required' })
}

function nextReference() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM bookings').get()
  return `PV-${1000 + n + 1}`
}

function sendEmail(owner, type, subject, body) {
  db.prepare('INSERT INTO notifications (owner_id, booking_id, type, channel, message_body) VALUES (?, NULL, ?, ?, ?)')
    .run(owner.owner_id, type, 'email', body)
  console.log(`[email:${type}] to ${owner.email} — ${subject}`)
}

// ---------------- auth routes ----------------
app.get('/api/demo-accounts', (_req, res) => res.json(DEMO_ACCOUNTS))

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, phone, password, address } = req.body || {}
  if (!full_name || !email || !phone || !password) return res.status(400).json({ error: 'full_name, email, phone and password are required' })
  if (db.prepare('SELECT 1 FROM owners WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists' })
  const r = db.prepare('INSERT INTO owners (full_name, email, phone, password_hash, address, account_type) VALUES (?, ?, ?, ?, ?, ?)')
    .run(full_name, email, phone, hashPassword(password), address || null, 'registered')
  const owner = db.prepare('SELECT * FROM owners WHERE owner_id = ?').get(Number(r.lastInsertRowid))
  res.status(201).json({ token: createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const owner = db.prepare('SELECT * FROM owners WHERE email = ?').get(email)
  if (owner && verifyPassword(password, owner.password_hash)) {
    return res.json({ token: createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
  }
  const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get(email)
  if (staff && staff.active && verifyPassword(password, staff.password_hash)) {
    return res.json({ token: createSession(null, staff.staff_id), role: 'staff', user: publicStaff(staff) })
  }
  res.status(401).json({ error: 'Invalid email or password' })
})

app.post('/api/auth/logout', auth, (_req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(_req.session.token)
  res.json({ ok: true })
})

app.get('/api/auth/me', auth, (req, res) => {
  if (req.staff) return res.json({ role: 'staff', user: publicStaff(req.staff) })
  if (req.owner) return res.json({ role: 'client', user: publicOwner(req.owner) })
  res.status(401).json({ error: 'Not logged in' })
})

// ---------------- public routes ----------------
app.get('/api/services', (req, res) => {
  const { category, bookable } = req.query
  let sql = 'SELECT * FROM services'
  const where = []
  const params = []
  if (category) { where.push('category = ?'); params.push(category) }
  if (bookable === '1') { where.push('client_bookable = 1') }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY category, name'
  res.json(db.prepare(sql).all(...params))
})

app.get('/api/services/categories', (_req, res) => {
  res.json(db.prepare('SELECT category, COUNT(*) AS count FROM services GROUP BY category ORDER BY category').all())
})

app.get('/api/team', (_req, res) => {
  res.json(db.prepare('SELECT staff_id, full_name, role, specialization FROM staff WHERE active = 1 ORDER BY role, full_name').all())
})

app.get('/api/bundles', (_req, res) => {
  const bundles = db.prepare('SELECT * FROM bundles ORDER BY bundle_id').all()
  const links = db.prepare(`SELECT bs.bundle_id, s.* FROM bundle_services bs JOIN services s ON s.service_id = bs.service_id`).all()
  const byBundle = {}
  for (const l of links) (byBundle[l.bundle_id] ??= []).push(l)
  res.json(bundles.map((b) => ({ ...b, services: byBundle[b.bundle_id] || [] })))
})

app.get('/api/slots', (req, res) => {
  const date = req.query.date || todayStr()
  const taken = db.prepare('SELECT booking_time FROM bookings WHERE booking_date = ? AND status NOT IN (?, ?)').all(date, 'cancelled', 'no_show')
  res.json({ date, slots: SLOTS, taken: taken.map((t) => t.booking_time) })
})

// ---------------- client routes ----------------
function publicOwner(o) { return { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type } }
function publicStaff(s) { return { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization } }

app.get('/api/me', auth, requireOwner, (req, res) => {
  const pets = db.prepare('SELECT * FROM pets WHERE owner_id = ? ORDER BY created_at DESC').all(req.owner.owner_id)
  res.json({ owner: publicOwner(req.owner), pets })
})

app.put('/api/me', auth, requireOwner, (req, res) => {
  const { full_name, phone, address } = req.body || {}
  db.prepare('UPDATE owners SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE owner_id = ?')
    .run(full_name || null, phone || null, address || null, req.owner.owner_id)
  const owner = db.prepare('SELECT * FROM owners WHERE owner_id = ?').get(req.owner.owner_id)
  res.json(publicOwner(owner))
})

app.post('/api/pets', auth, requireOwner, (req, res) => {
  const { name, species, breed, gender, birthdate, weight_kg } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Pet name is required' })
  const r = db.prepare('INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.owner.owner_id, name, species || 'dog', breed || null, gender || null, birthdate || null, weight_kg || null)
  res.status(201).json(db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(Number(r.lastInsertRowid)))
})

app.put('/api/pets/:id', auth, requireOwner, (req, res) => {
  const pet = db.prepare('SELECT * FROM pets WHERE pet_id = ? AND owner_id = ?').get(req.params.id, req.owner.owner_id)
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const { name, species, breed, gender, birthdate, weight_kg } = req.body || {}
  db.prepare('UPDATE pets SET name = COALESCE(?, name), species = COALESCE(?, species), breed = COALESCE(?, breed), gender = COALESCE(?, gender), birthdate = COALESCE(?, birthdate), weight_kg = COALESCE(?, weight_kg) WHERE pet_id = ?')
    .run(name || null, species || null, breed || null, gender || null, birthdate || null, weight_kg ?? null, pet.pet_id)
  res.json(db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(pet.pet_id))
})

app.delete('/api/pets/:id', auth, requireOwner, (req, res) => {
  const r = db.prepare('DELETE FROM pets WHERE pet_id = ? AND owner_id = ?').run(req.params.id, req.owner.owner_id)
  if (r.changes === 0) return res.status(404).json({ error: 'Pet not found' })
  res.json({ ok: true })
})

app.get('/api/pets/:id/records', auth, (req, res) => {
  const pet = req.owner
    ? db.prepare('SELECT * FROM pets WHERE pet_id = ? AND owner_id = ?').get(req.params.id, req.owner.owner_id)
    : req.staff ? db.prepare('SELECT * FROM pets WHERE pet_id = ?').get(req.params.id) : null
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = db.prepare(`SELECT mr.*, s.full_name AS staff_name, b.reference_code, sv.name AS service_name
    FROM medical_records mr
    LEFT JOIN staff s ON s.staff_id = mr.staff_id
    LEFT JOIN bookings b ON b.booking_id = mr.booking_id
    LEFT JOIN services sv ON sv.service_id = b.service_id
    WHERE mr.pet_id = ? ORDER BY mr.visit_date DESC`).all(pet.pet_id)
  res.json(records)
})

app.get('/api/bookings', auth, requireOwner, (req, res) => {
  const rows = db.prepare(`SELECT b.*, p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed,
    s.name AS service_name, s.category AS service_category, st.full_name AS staff_name, st.role AS staff_role
    FROM bookings b
    JOIN pets p ON p.pet_id = b.pet_id
    JOIN services s ON s.service_id = b.service_id
    LEFT JOIN staff st ON st.staff_id = b.staff_id
    WHERE b.owner_id = ? ORDER BY b.booking_date DESC, b.booking_time DESC`).all(req.owner.owner_id)
  res.json(rows)
})

app.post('/api/bookings', auth, requireOwner, (req, res) => {
  const { pet_id, service_id, booking_date, booking_time, notes } = req.body || {}
  if (!pet_id || !service_id || !booking_date || !booking_time) return res.status(400).json({ error: 'pet, service, date and time are required' })

  const pet = db.prepare('SELECT * FROM pets WHERE pet_id = ? AND owner_id = ?').get(pet_id, req.owner.owner_id)
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const service = db.prepare('SELECT * FROM services WHERE service_id = ?').get(service_id)
  if (!service) return res.status(404).json({ error: 'Service not found' })
  if (!service.client_bookable) return res.status(403).json({ error: 'This service can only be booked through the clinic (admin)' })
  if (booking_date < todayStr()) return res.status(400).json({ error: 'Cannot book a past date' })
  const clash = db.prepare('SELECT 1 FROM bookings WHERE booking_date = ? AND booking_time = ? AND status NOT IN (?, ?)').get(booking_date, booking_time, 'cancelled', 'no_show')
  if (clash) return res.status(409).json({ error: 'That time slot is already taken — please pick another' })

  const ref = nextReference()
  const r = db.prepare(`INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 'pending', 'client', ?)`)
    .run(ref, req.owner.owner_id, pet_id, service_id, booking_date, booking_time, notes || null)

  const booking = db.prepare(`SELECT b.*, p.name AS pet_name, s.name AS service_name FROM bookings b
    JOIN pets p ON p.pet_id = b.pet_id JOIN services s ON s.service_id = b.service_id WHERE b.booking_id = ?`)
    .get(Number(r.lastInsertRowid))
  sendEmail(req.owner, 'confirmation', `Booking confirmed ${ref}`, `Hi ${req.owner.full_name}, your ${service.name} for ${pet.name} on ${booking_date} at ${booking_time} is confirmed. Reference: ${ref}.`)
  res.status(201).json(booking)
})

// ---------------- admin routes ----------------
app.get('/api/admin/stats', requireStaff, (req, res) => {
  const today = todayStr()
  const totalPets = db.prepare('SELECT COUNT(*) AS n FROM pets').get().n
  const totalOwners = db.prepare('SELECT COUNT(*) AS n FROM owners').get().n
  const todayBookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE booking_date = ? AND status NOT IN (?, ?)').get(today, 'cancelled', 'no_show').n
  const upcoming = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE booking_date >= ? AND status = ?').get(today, 'confirmed').n
  const pending = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE status = ?').get('pending').n
  const revenue = db.prepare(`SELECT COALESCE(SUM(s.price_min), 0) AS total FROM bookings b JOIN services s ON s.service_id = b.service_id WHERE b.status IN (?, ?)`).get('confirmed', 'completed').total
  const walkIns = db.prepare("SELECT COUNT(*) AS n FROM owners WHERE account_type = 'walk_in'").get().n
  res.json({ totalPets, totalOwners, todayBookings, upcoming, pending, revenue, walkIns })
})

const BOOKING_SELECT = `SELECT b.*, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
  p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed, p.weight_kg AS pet_weight,
  s.name AS service_name, s.category AS service_category, s.price_min AS service_price,
  st.full_name AS staff_name, st.role AS staff_role
  FROM bookings b
  JOIN owners o ON o.owner_id = b.owner_id
  JOIN pets p ON p.pet_id = b.pet_id
  JOIN services s ON s.service_id = b.service_id
  LEFT JOIN staff st ON st.staff_id = b.staff_id`

app.get('/api/admin/bookings', requireStaff, (req, res) => {
  const { status, date, service, q } = req.query
  const where = []
  const params = []
  if (status) { where.push('b.status = ?'); params.push(status) }
  if (date) { where.push('b.booking_date = ?'); params.push(date) }
  if (service) { where.push('b.service_id = ?'); params.push(service) }
  if (q) { where.push('(o.full_name LIKE ? OR p.name LIKE ? OR b.reference_code LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const sql = BOOKING_SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY b.booking_date, b.booking_time'
  res.json(db.prepare(sql).all(...params))
})

app.get('/api/admin/bookings/:id', requireStaff, (req, res) => {
  const booking = db.prepare(BOOKING_SELECT + ' WHERE b.booking_id = ?').get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const records = db.prepare(`SELECT mr.*, st.full_name AS staff_name FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id WHERE mr.booking_id = ?`).all(booking.booking_id)
  res.json({ booking, records })
})

const TRANSITIONS = { pending: ['confirmed', 'completed', 'cancelled', 'no_show'], confirmed: ['completed', 'cancelled', 'no_show'], completed: [], cancelled: [], no_show: ['rebooked'], rebooked: ['confirmed'] }

app.patch('/api/admin/bookings/:id', requireStaff, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { status, staff_id, booking_date, booking_time } = req.body || {}

  if (status) {
    if (!TRANSITIONS[booking.status]?.includes(status)) return res.status(400).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
    db.prepare('UPDATE bookings SET status = ? WHERE booking_id = ?').run(status, booking.booking_id)
    if (status === 'no_show') {
      const owner = db.prepare('SELECT * FROM owners WHERE owner_id = ?').get(booking.owner_id)
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      const t = tomorrow.toISOString().slice(0, 10)
      sendEmail(owner, 'rebooking', `Rebooking options for ${booking.reference_code}`, `Your slot ${booking.reference_code} was forfeited due to late arrival. Please rebook: ${t} at 10:00, ${t} at 14:00, or ${t} at 16:00.`)
    }
  }
  if (staff_id) {
    const staff = db.prepare('SELECT * FROM staff WHERE staff_id = ? AND active = 1').get(staff_id)
    if (!staff) return res.status(400).json({ error: 'Staff member not found or inactive' })
    db.prepare('UPDATE bookings SET staff_id = ? WHERE booking_id = ?').run(staff_id, booking.booking_id)
  }
  if (booking_date || booking_time) {
    db.prepare('UPDATE bookings SET booking_date = COALESCE(?, booking_date), booking_time = COALESCE(?, booking_time) WHERE booking_id = ?')
      .run(booking_date || null, booking_time || null, booking.booking_id)
  }
  res.json(db.prepare(BOOKING_SELECT + ' WHERE b.booking_id = ?').get(booking.booking_id))
})

app.post('/api/admin/bookings', requireStaff, (req, res) => {
  const { owner_id, pet_id, service_id, staff_id, booking_date, booking_time, notes } = req.body || {}
  if (!owner_id || !pet_id || !service_id || !booking_date || !booking_time) return res.status(400).json({ error: 'owner, pet, service, date and time are required' })
  const clash = db.prepare('SELECT 1 FROM bookings WHERE booking_date = ? AND booking_time = ? AND status NOT IN (?, ?)').get(booking_date, booking_time, 'cancelled', 'no_show')
  if (clash) return res.status(409).json({ error: 'That time slot is already taken' })
  const ref = nextReference()
  const r = db.prepare(`INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'admin', ?)`)
    .run(ref, owner_id, pet_id, service_id, staff_id || null, booking_date, booking_time, notes || null)
  res.status(201).json(db.prepare(BOOKING_SELECT + ' WHERE b.booking_id = ?').get(Number(r.lastInsertRowid)))
})

app.get('/api/admin/pets', requireStaff, (req, res) => {
  const { q } = req.query
  const where = []
  const params = []
  if (q) { where.push('(p.name LIKE ? OR o.full_name LIKE ? OR p.breed LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const sql = `SELECT p.*, o.full_name AS owner_name, o.phone AS owner_phone,
    (SELECT COUNT(*) FROM bookings b WHERE b.pet_id = p.pet_id) AS booking_count
    FROM pets p JOIN owners o ON o.owner_id = p.owner_id` + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY p.created_at DESC'
  res.json(db.prepare(sql).all(...params))
})

app.get('/api/admin/pets/:id', requireStaff, (req, res) => {
  const pet = db.prepare('SELECT p.*, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.account_type FROM pets p JOIN owners o ON o.owner_id = p.owner_id WHERE p.pet_id = ?').get(req.params.id)
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = db.prepare(`SELECT mr.*, st.full_name AS staff_name, b.reference_code, sv.name AS service_name
    FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id
    LEFT JOIN bookings b ON b.booking_id = mr.booking_id LEFT JOIN services sv ON sv.service_id = b.service_id
    WHERE mr.pet_id = ? ORDER BY mr.visit_date DESC`).all(pet.pet_id)
  const bookings = db.prepare(BOOKING_SELECT + ' WHERE b.pet_id = ? ORDER BY b.booking_date DESC').all(pet.pet_id)
  res.json({ pet, records, bookings })
})

app.post('/api/admin/pets/:id/records', requireStaff, (req, res) => {
  const { visit_date, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date, booking_id, staff_id } = req.body || {}
  if (!visit_date) return res.status(400).json({ error: 'visit_date is required' })
  const r = db.prepare(`INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(req.params.id, booking_id || null, visit_date, staff_id ?? req.staff.staff_id, diagnosis || null, treatment_notes || null, vaccinations_given || null, weight_at_visit || null, next_due_date || null)
  res.status(201).json(db.prepare('SELECT * FROM medical_records WHERE record_id = ?').get(Number(r.lastInsertRowid)))
})

app.get('/api/admin/staff', requireStaff, (_req, res) => {
  const staff = db.prepare('SELECT * FROM staff ORDER BY role, full_name').all()
  const counts = db.prepare('SELECT staff_id, COUNT(*) AS n FROM bookings WHERE status IN (?, ?) GROUP BY staff_id').all('confirmed', 'completed')
  const byStaff = Object.fromEntries(counts.map((c) => [c.staff_id, c.n]))
  res.json(staff.map((s) => ({ ...s, password_hash: undefined, appointment_count: byStaff[s.staff_id] || 0 })))
})

app.post('/api/admin/staff', requireStaff, (req, res) => {
  const { full_name, role, email, specialization } = req.body || {}
  if (!full_name || !role) return res.status(400).json({ error: 'full_name and role are required' })
  const r = db.prepare('INSERT INTO staff (full_name, role, email, specialization, active) VALUES (?, ?, ?, ?, 1)').run(full_name, role, email || null, specialization || null)
  res.status(201).json(db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(Number(r.lastInsertRowid)))
})

app.patch('/api/admin/staff/:id/toggle', requireStaff, (req, res) => {
  const staff = db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(req.params.id)
  if (!staff) return res.status(404).json({ error: 'Staff not found' })
  db.prepare('UPDATE staff SET active = ? WHERE staff_id = ?').run(staff.active ? 0 : 1, staff.staff_id)
  res.json(db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staff.staff_id))
})

app.get('/api/admin/schedule', requireStaff, (_req, res) => {
  const schedules = db.prepare(`SELECT sc.*, st.full_name AS staff_name, st.role AS staff_role FROM staff_schedules sc JOIN staff st ON st.staff_id = sc.staff_id ORDER BY st.full_name, sc.day_of_week`).all()
  res.json(schedules)
})

app.post('/api/admin/schedule', requireStaff, (req, res) => {
  const { staff_id, day_of_week, start_time, end_time, is_available } = req.body || {}
  if (!staff_id || day_of_week === undefined || !start_time || !end_time) return res.status(400).json({ error: 'staff, day_of_week, start_time and end_time are required' })
  const r = db.prepare('INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES (?, ?, ?, ?, ?)')
    .run(staff_id, day_of_week, start_time, end_time, is_available === false ? 0 : 1)
  res.status(201).json(db.prepare('SELECT * FROM staff_schedules WHERE schedule_id = ?').get(Number(r.lastInsertRowid)))
})

app.delete('/api/admin/schedule/:id', requireStaff, (req, res) => {
  db.prepare('DELETE FROM staff_schedules WHERE schedule_id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.post('/api/admin/walkin', requireStaff, (req, res) => {
  const { owner, pet, booking } = req.body || {}
  if (!owner?.full_name || !owner?.phone) return res.status(400).json({ error: 'Owner name and phone are required for walk-ins' })
  if (!pet?.name || !booking?.service_id || !booking?.booking_date || !booking?.booking_time) {
    return res.status(400).json({ error: 'Pet name, service, date and time are required' })
  }
  const clash = db.prepare('SELECT 1 FROM bookings WHERE booking_date = ? AND booking_time = ? AND status NOT IN (?, ?)').get(booking.booking_date, booking.booking_time, 'cancelled', 'no_show')
  if (clash) return res.status(409).json({ error: 'That time slot is already taken' })

  const email = (owner.email || `walkin-${Date.now()}@petvibe.ph`).toLowerCase()
  const o = db.prepare('INSERT INTO owners (full_name, email, phone, address, account_type) VALUES (?, ?, ?, ?, ?)')
    .run(owner.full_name, email, owner.phone, owner.address || null, 'walk_in')
  const p = db.prepare('INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(Number(o.lastInsertRowid), pet.name, pet.species || 'dog', pet.breed || null, pet.gender || null, pet.birthdate || null, pet.weight_kg || null)
  const ref = nextReference()
  const b = db.prepare(`INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'admin', ?)`)
    .run(ref, Number(o.lastInsertRowid), Number(p.lastInsertRowid), booking.service_id, booking.staff_id || null, booking.booking_date, booking.booking_time, booking.notes || null)
  res.status(201).json({ owner_id: Number(o.lastInsertRowid), pet_id: Number(p.lastInsertRowid), booking_id: Number(b.lastInsertRowid), reference_code: ref })
})

app.get('/api/admin/analytics', requireStaff, (_req, res) => {
  // bookings per day, last 14 days
  const days = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const x = new Date(today); x.setDate(x.getDate() - i)
    days.push(x.toISOString().slice(0, 10))
  }
  const byDay = db.prepare('SELECT booking_date, COUNT(*) AS n FROM bookings WHERE booking_date >= ? GROUP BY booking_date').all(days[0])
  const dayMap = Object.fromEntries(byDay.map((d) => [d.booking_date, d.n]))
  const bookingsByDay = days.map((date) => ({ date, count: dayMap[date] || 0 }))

  // revenue by service (top 6 by estimated value)
  const revenueByService = db.prepare(`SELECT s.name, s.category, COUNT(*) AS bookings, SUM(s.price_min) AS revenue
    FROM bookings b JOIN services s ON s.service_id = b.service_id
    WHERE b.status IN (?, ?) GROUP BY s.service_id ORDER BY revenue DESC LIMIT 6`).all('confirmed', 'completed')

  // staff performance
  const staffPerformance = db.prepare(`SELECT st.full_name, st.role, COUNT(b.booking_id) AS completed
    FROM staff st LEFT JOIN bookings b ON b.staff_id = st.staff_id AND b.status = 'completed'
    GROUP BY st.staff_id ORDER BY completed DESC`).all()

  // status breakdown
  const statusBreakdown = db.prepare('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').all()

  // top services by volume
  const topServices = db.prepare(`SELECT s.name, COUNT(*) AS n FROM bookings b JOIN services s ON s.service_id = b.service_id GROUP BY s.service_id ORDER BY n DESC LIMIT 5`).all()

  res.json({ bookingsByDay, revenueByService, staffPerformance, statusBreakdown, topServices })
})

app.get('/api/admin/notifications', requireStaff, (_req, res) => {
  res.json(db.prepare(`SELECT n.*, o.full_name AS owner_name, o.email AS owner_email FROM notifications n JOIN owners o ON o.owner_id = n.owner_id ORDER BY n.sent_at DESC LIMIT 20`).all())
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Server error' })
})

app.listen(PORT, () => {
  console.log(`PetVibe API listening on http://localhost:${PORT}`)
})

import express from 'express'
import cors from 'cors'
import { randomBytes } from 'node:crypto'
import { dbGet, dbAll, dbRun } from './db.js'
import { migrate } from './migrations.js'
import { seed, DEMO_ACCOUNTS } from './seed.js'
import { hashPassword, verifyPassword } from './passwords.js'

try {
  await migrate()
  await seed()
} catch (e) {
  console.error('[startup] Could not connect to the database — check DATABASE_URL in .env')
  console.error('[startup]', e.message)
  console.error('[startup] The API server will NOT start. The frontend will fall back to demo/mock mode until this is fixed.')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const todayStr = () => new Date().toISOString().slice(0, 10)

// small helper so every route can stay a plain async function and errors
// fall through to the error handler at the bottom instead of crashing the process
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next)

// ---------------- auth helpers ----------------
async function createSession(ownerId = null, staffId = null) {
  const token = randomBytes(24).toString('hex')
  await dbRun('INSERT INTO sessions (token, owner_id, staff_id) VALUES ($1, $2, $3)', [token, ownerId, staffId])
  return token
}

async function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not logged in' })
  const s = await dbGet('SELECT * FROM sessions WHERE token = $1', [token])
  if (!s) return res.status(401).json({ error: 'Invalid or expired session' })
  req.session = s
  if (s.owner_id) {
    req.owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [s.owner_id])
  }
  if (s.staff_id) {
    req.staff = await dbGet('SELECT * FROM staff WHERE staff_id = $1', [s.staff_id])
  }
  next()
}
const authMw = (req, res, next) => { auth(req, res, next).catch(next) }

const requireOwner = (req, res, next) => {
  if (req.session === undefined) return authMw(req, res, () => requireOwner(req, res, next))
  return req.owner ? next() : res.status(403).json({ error: 'Client account required' })
}
const requireStaff = (req, res, next) => {
  if (req.session === undefined) return authMw(req, res, () => requireStaff(req, res, next))
  return req.staff ? next() : res.status(403).json({ error: 'Staff access required' })
}

async function nextReference() {
  const { n } = await dbGet('SELECT COUNT(*) AS n FROM bookings')
  return `PV-${1000 + Number(n) + 1}`
}

async function sendEmail(owner, type, subject, body) {
  await dbRun('INSERT INTO notifications (owner_id, booking_id, type, channel, message_body) VALUES ($1, NULL, $2, $3, $4)', [owner.owner_id, type, 'email', body])
  console.log(`[email:${type}] to ${owner.email} — ${subject}`)
}

// Append a row to the booking audit trail. Called on every status transition
// and on notable changes (reschedule, staff assignment, client requests).
async function logBookingStatus(bookingId, fromStatus, toStatus, req, note = null) {
  const actorRole = req?.staff ? 'staff' : req?.owner ? 'client' : 'system'
  const actorName = req?.staff?.full_name || req?.owner?.full_name || null
  await dbRun(
    'INSERT INTO booking_status_log (booking_id, from_status, to_status, note, changed_by_role, changed_by_name) VALUES ($1, $2, $3, $4, $5, $6)',
    [bookingId, fromStatus ?? null, toStatus ?? null, note, actorRole, actorName]
  )
}

// Normalize a medical record into the frontend's canonical shape. Legacy
// column names (visit_date / diagnosis / treatment_notes / staff_id) are kept
// in the response for backwards compatibility, while the typed-record fields
// (record_date / type / title / notes / vet_staff_id) are filled in.
function inferRecordType(r) {
  if (r.record_type) return r.record_type
  const hay = `${r.vaccinations_given || ''} ${r.service_name || ''} ${r.diagnosis || ''}`.toLowerCase()
  if (/vaccine|deworm|rabies/.test(hay)) return 'vaccination'
  if (/groom|bath|nail|spa/.test(hay)) return 'grooming'
  if (/spay|neuter|surgery|extract|cesarean|tumor|wound|c-section|dental/.test(hay)) return 'surgery'
  return 'checkup'
}

function decorateRecord(r) {
  return {
    ...r,
    record_date: r.visit_date,
    type: inferRecordType(r),
    title: r.title || r.service_name || r.diagnosis || 'Visit',
    notes: r.treatment_notes,
    vet_staff_id: r.staff_id,
  }
}

// ---------------- auth routes ----------------
app.get('/api/demo-accounts', (_req, res) => res.json(DEMO_ACCOUNTS))

app.post('/api/auth/register', h(async (req, res) => {
  const { full_name, email, phone, password, address } = req.body || {}
  if (!full_name || !email || !phone || !password) return res.status(400).json({ error: 'full_name, email, phone and password are required' })
  if (await dbGet('SELECT 1 FROM owners WHERE email = $1', [email])) return res.status(409).json({ error: 'An account with this email already exists' })
  const { rows } = await dbRun(
    'INSERT INTO owners (full_name, email, phone, password_hash, address, account_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING owner_id',
    [full_name, email, phone, hashPassword(password), address || null, 'registered']
  )
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [rows[0].owner_id])
  res.status(201).json({ token: await createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
}))

app.post('/api/auth/login', h(async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const owner = await dbGet('SELECT * FROM owners WHERE email = $1', [email])
  if (owner && verifyPassword(password, owner.password_hash)) {
    return res.json({ token: await createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
  }
  const staff = await dbGet('SELECT * FROM staff WHERE email = $1', [email])
  if (staff && staff.active && verifyPassword(password, staff.password_hash)) {
    return res.json({ token: await createSession(null, staff.staff_id), role: 'staff', user: publicStaff(staff) })
  }
  res.status(401).json({ error: 'Invalid email or password' })
}))

app.post('/api/auth/logout', authMw, h(async (req, res) => {
  await dbRun('DELETE FROM sessions WHERE token = $1', [req.session.token])
  res.json({ ok: true })
}))

app.get('/api/auth/me', authMw, (req, res) => {
  if (req.staff) return res.json({ role: 'staff', user: publicStaff(req.staff) })
  if (req.owner) return res.json({ role: 'client', user: publicOwner(req.owner) })
  res.status(401).json({ error: 'Not logged in' })
})

// ---------------- public routes ----------------
app.get('/api/services', h(async (req, res) => {
  const { category, bookable } = req.query
  let sql = 'SELECT * FROM services'
  const where = []
  const params = []
  where.push('active = 1') // public catalog only shows active services
  if (category) { params.push(category); where.push(`category = $${params.length}`) }
  if (bookable === '1') { where.push('client_bookable = 1') }
  sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY category, name'
  res.json(await dbAll(sql, params))
}))

app.get('/api/services/categories', h(async (_req, res) => {
  res.json(await dbAll("SELECT category, COUNT(*)::int AS count FROM services WHERE active = 1 GROUP BY category ORDER BY category"))
}))

app.get('/api/team', h(async (_req, res) => {
  res.json(await dbAll("SELECT staff_id, full_name, role, specialization FROM staff WHERE active = 1 ORDER BY role, full_name"))
}))

app.get('/api/bundles', h(async (_req, res) => {
  const bundles = await dbAll('SELECT * FROM bundles ORDER BY bundle_id')
  const links = await dbAll('SELECT bs.bundle_id, s.* FROM bundle_services bs JOIN services s ON s.service_id = bs.service_id')
  const byBundle = {}
  for (const l of links) (byBundle[l.bundle_id] ??= []).push(l)
  res.json(bundles.map((b) => ({ ...b, services: byBundle[b.bundle_id] || [] })))
}))

app.get('/api/slots', h(async (req, res) => {
  const date = req.query.date || todayStr()
  const taken = await dbAll("SELECT booking_time FROM bookings WHERE booking_date = $1 AND status NOT IN ('cancelled', 'no_show')", [date])
  res.json({ date, slots: SLOTS, taken: taken.map((t) => t.booking_time) })
}))

// ---------------- client routes ----------------
function publicOwner(o) { return { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type } }
function publicStaff(s) { return { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization } }

app.get('/api/me', authMw, requireOwner, h(async (req, res) => {
  const pets = await dbAll('SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC', [req.owner.owner_id])
  res.json({ owner: publicOwner(req.owner), pets })
}))

app.put('/api/me', authMw, requireOwner, h(async (req, res) => {
  const { full_name, phone, address, email } = req.body || {}
  // Email changes require uniqueness (in production a re-verification email
  // would be sent before the address is switched; here we validate + apply).
  if (email && email.toLowerCase() !== req.owner.email.toLowerCase()) {
    const clash = await dbGet('SELECT 1 FROM owners WHERE LOWER(email) = LOWER($1) AND owner_id <> $2', [email, req.owner.owner_id])
    if (clash) return res.status(409).json({ error: 'Another account already uses that email' })
  }
  await dbRun(
    'UPDATE owners SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), address = COALESCE($3, address), email = COALESCE($4, email) WHERE owner_id = $5',
    [full_name || null, phone || null, address || null, email || null, req.owner.owner_id]
  )
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.owner.owner_id])
  res.json(publicOwner(owner))
}))

app.patch('/api/me/password', authMw, requireOwner, h(async (req, res) => {
  const { current_password, new_password } = req.body || {}
  if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password are required' })
  if (!req.owner.password_hash) return res.status(400).json({ error: 'This account has no password set (walk-in profile)' })
  if (!verifyPassword(current_password, req.owner.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' })
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' })
  await dbRun('UPDATE owners SET password_hash = $1 WHERE owner_id = $2', [hashPassword(new_password), req.owner.owner_id])
  res.json({ ok: true })
}))

app.post('/api/pets', authMw, requireOwner, h(async (req, res) => {
  const { name, species, breed, gender, birthdate, weight_kg } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Pet name is required' })
  const { rows } = await dbRun(
    'INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING pet_id',
    [req.owner.owner_id, name, species || 'dog', breed || null, gender || null, birthdate || null, weight_kg || null]
  )
  res.status(201).json(await dbGet('SELECT * FROM pets WHERE pet_id = $1', [rows[0].pet_id]))
}))

app.put('/api/pets/:id', authMw, requireOwner, h(async (req, res) => {
  const pet = await dbGet('SELECT * FROM pets WHERE pet_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const { name, species, breed, gender, birthdate, weight_kg } = req.body || {}
  await dbRun(
    `UPDATE pets SET name = COALESCE($1, name), species = COALESCE($2, species), breed = COALESCE($3, breed),
     gender = COALESCE($4, gender), birthdate = COALESCE($5, birthdate), weight_kg = COALESCE($6, weight_kg) WHERE pet_id = $7`,
    [name || null, species || null, breed || null, gender || null, birthdate || null, weight_kg ?? null, pet.pet_id]
  )
  res.json(await dbGet('SELECT * FROM pets WHERE pet_id = $1', [pet.pet_id]))
}))

app.delete('/api/pets/:id', authMw, requireOwner, h(async (req, res) => {
  const { rowCount } = await dbRun('DELETE FROM pets WHERE pet_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (rowCount === 0) return res.status(404).json({ error: 'Pet not found' })
  res.json({ ok: true })
}))

app.get('/api/pets/:id/records', authMw, h(async (req, res) => {
  const pet = req.owner
    ? await dbGet('SELECT * FROM pets WHERE pet_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
    : req.staff ? await dbGet('SELECT * FROM pets WHERE pet_id = $1', [req.params.id]) : null
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = await dbAll(
    `SELECT mr.*, s.full_name AS staff_name, b.reference_code, sv.name AS service_name
     FROM medical_records mr
     LEFT JOIN staff s ON s.staff_id = mr.staff_id
     LEFT JOIN bookings b ON b.booking_id = mr.booking_id
     LEFT JOIN services sv ON sv.service_id = b.service_id
     WHERE mr.pet_id = $1 ORDER BY mr.visit_date DESC`,
    [pet.pet_id]
  )
  res.json(records.map(decorateRecord))
}))

app.get('/api/bookings', authMw, requireOwner, h(async (req, res) => {
  const rows = await dbAll(
    `SELECT b.*, p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed,
     s.name AS service_name, s.category AS service_category, st.full_name AS staff_name, st.role AS staff_role
     FROM bookings b
     JOIN pets p ON p.pet_id = b.pet_id
     JOIN services s ON s.service_id = b.service_id
     LEFT JOIN staff st ON st.staff_id = b.staff_id
     WHERE b.owner_id = $1 ORDER BY b.booking_date DESC, b.booking_time DESC`,
    [req.owner.owner_id]
  )
  res.json(rows)
}))

app.post('/api/bookings', authMw, requireOwner, h(async (req, res) => {
  const { pet_id, service_id, booking_date, booking_time, notes } = req.body || {}
  if (!pet_id || !service_id || !booking_date || !booking_time) return res.status(400).json({ error: 'pet, service, date and time are required' })

  const pet = await dbGet('SELECT * FROM pets WHERE pet_id = $1 AND owner_id = $2', [pet_id, req.owner.owner_id])
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const service = await dbGet('SELECT * FROM services WHERE service_id = $1', [service_id])
  if (!service) return res.status(404).json({ error: 'Service not found' })
  // `active === 0` (not falsy) so bookings still work if the column hasn't been
  // added to the DB yet (missing column → undefined → not blocked)
  if (service.active === 0) return res.status(403).json({ error: 'This service is no longer available' })
  if (!service.client_bookable) return res.status(403).json({ error: 'This service can only be booked through the clinic (admin)' })
  if (booking_date < todayStr()) return res.status(400).json({ error: 'Cannot book a past date' })
  const clash = await dbGet(
    "SELECT 1 FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND status NOT IN ('cancelled', 'no_show')",
    [booking_date, booking_time]
  )
  if (clash) return res.status(409).json({ error: 'That time slot is already taken — please pick another' })

  const ref = await nextReference()
  const { rows } = await dbRun(
    `INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
     VALUES ($1, $2, $3, $4, NULL, $5, $6, 'pending', 'client', $7) RETURNING booking_id`,
    [ref, req.owner.owner_id, pet_id, service_id, booking_date, booking_time, notes || null]
  )

  const booking = await dbGet(
    `SELECT b.*, p.name AS pet_name, s.name AS service_name FROM bookings b
     JOIN pets p ON p.pet_id = b.pet_id JOIN services s ON s.service_id = b.service_id WHERE b.booking_id = $1`,
    [rows[0].booking_id]
  )
  await sendEmail(req.owner, 'confirmation', `Booking confirmed ${ref}`, `Hi ${req.owner.full_name}, your ${service.name} for ${pet.name} on ${booking_date} at ${booking_time} is confirmed. Reference: ${ref}.`)
  await logBookingStatus(rows[0].booking_id, null, 'pending', req, 'Booking created by client')
  res.status(201).json(booking)
}))

app.post('/api/bookings/:id/cancel', authMw, requireOwner, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Only pending or confirmed bookings can be cancelled' })
  await dbRun("UPDATE bookings SET status = 'cancelled' WHERE booking_id = $1", [booking.booking_id])
  await logBookingStatus(booking.booking_id, booking.status, 'cancelled', req, 'Cancelled by client')
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
  await sendEmail(owner, 'rebooking', `Booking cancelled — ${booking.reference_code}`, `Hi ${owner.full_name}, your booking ${booking.reference_code} for ${booking.booking_date} at ${booking.booking_time} has been cancelled.`)
  res.json({ ok: true })
}))

app.post('/api/bookings/:id/reschedule-request', authMw, requireOwner, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Only pending or confirmed bookings can be rescheduled' })
  const { requested_date, requested_time, reason } = req.body || {}
  if (!requested_date || !requested_time) return res.status(400).json({ error: 'requested_date and requested_time are required' })
  if (requested_date < todayStr()) return res.status(400).json({ error: 'Cannot request a past date' })
  const open = await dbGet("SELECT 1 FROM reschedule_requests WHERE booking_id = $1 AND status = 'pending'", [booking.booking_id])
  if (open) return res.status(409).json({ error: 'You already have a pending reschedule request for this booking' })
  const { rows } = await dbRun(
    'INSERT INTO reschedule_requests (booking_id, requested_date, requested_time, reason) VALUES ($1, $2, $3, $4) RETURNING request_id',
    [booking.booking_id, requested_date, requested_time, reason || null]
  )
  await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Client requested reschedule to ${requested_date} at ${requested_time}${reason ? ` — ${reason}` : ''}`)
  res.status(201).json(await dbGet('SELECT * FROM reschedule_requests WHERE request_id = $1', [rows[0].request_id]))
}))

app.delete('/api/bookings/:id/reschedule-request/:reqId', authMw, requireOwner, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { rowCount } = await dbRun(
    "DELETE FROM reschedule_requests WHERE request_id = $1 AND booking_id = $2 AND status = 'pending'",
    [req.params.reqId, booking.booking_id]
  )
  if (rowCount === 0) return res.status(404).json({ error: 'Pending reschedule request not found' })
  res.json({ ok: true })
}))

app.get('/api/bookings/:id/history', authMw, requireOwner, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const history = await dbAll('SELECT * FROM booking_status_log WHERE booking_id = $1 ORDER BY created_at DESC, log_id DESC', [booking.booking_id])
  const rescheduleRequests = await dbAll('SELECT * FROM reschedule_requests WHERE booking_id = $1 ORDER BY created_at DESC', [booking.booking_id])
  res.json({ history, reschedule_requests: rescheduleRequests })
}))

// ---------------- admin routes ----------------
// ---------------- admin: services CRUD ----------------
app.get('/api/admin/services', requireStaff, h(async (_req, res) => {
  res.json(await dbAll('SELECT * FROM services ORDER BY category, name'))
}))

app.post('/api/admin/services', requireStaff, h(async (req, res) => {
  const { name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable } = req.body || {}
  if (!name || !category || price_min === undefined) return res.status(400).json({ error: 'name, category and price_min are required' })
  const { rows } = await dbRun(
    `INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1) RETURNING service_id`,
    [name, category, description || null, Number(price_min), price_max === '' || price_max === undefined ? null : Number(price_max), duration_minutes === '' || duration_minutes === undefined ? null : Number(duration_minutes), weight_tier || null, client_bookable ? 1 : 0]
  )
  res.status(201).json(await dbGet('SELECT * FROM services WHERE service_id = $1', [rows[0].service_id]))
}))

app.patch('/api/admin/services/:id', requireStaff, h(async (req, res) => {
  const svc = await dbGet('SELECT * FROM services WHERE service_id = $1', [req.params.id])
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  const { name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable } = req.body || {}
  const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v))
  await dbRun(
    `UPDATE services SET
       name = COALESCE($1, name), category = COALESCE($2, category),
       description = COALESCE($3, description), price_min = COALESCE($4, price_min),
       price_max = COALESCE($5, price_max), duration_minutes = COALESCE($6, duration_minutes),
       weight_tier = COALESCE($7, weight_tier),
       client_bookable = CASE WHEN $8 IS NULL THEN client_bookable ELSE $8 END
     WHERE service_id = $9`,
    [name || null, category || null, description ?? null, num(price_min), num(price_max), num(duration_minutes), weight_tier || null, client_bookable === undefined ? null : client_bookable ? 1 : 0, svc.service_id]
  )
  res.json(await dbGet('SELECT * FROM services WHERE service_id = $1', [svc.service_id]))
}))

app.patch('/api/admin/services/:id/toggle', requireStaff, h(async (req, res) => {
  const svc = await dbGet('SELECT * FROM services WHERE service_id = $1', [req.params.id])
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  await dbRun('UPDATE services SET active = $1 WHERE service_id = $2', [svc.active ? 0 : 1, svc.service_id])
  res.json(await dbGet('SELECT * FROM services WHERE service_id = $1', [svc.service_id]))
}))

app.get('/api/admin/stats', requireStaff, h(async (req, res) => {
  const today = todayStr()
  const totalPets = (await dbGet('SELECT COUNT(*) AS n FROM pets')).n
  const totalOwners = (await dbGet('SELECT COUNT(*) AS n FROM owners')).n
  const todayBookings = (await dbGet(
    "SELECT COUNT(*) AS n FROM bookings WHERE booking_date = $1 AND status NOT IN ('cancelled', 'no_show')", [today]
  )).n
  const upcoming = (await dbGet("SELECT COUNT(*) AS n FROM bookings WHERE booking_date >= $1 AND status = 'confirmed'", [today])).n
  const pending = (await dbGet("SELECT COUNT(*) AS n FROM bookings WHERE status = 'pending'")).n
  const revenue = (await dbGet(
    `SELECT COALESCE(SUM(s.price_min), 0) AS total FROM bookings b JOIN services s ON s.service_id = b.service_id WHERE b.status IN ('confirmed', 'completed')`
  )).total
  const walkIns = (await dbGet("SELECT COUNT(*) AS n FROM owners WHERE account_type = 'walk_in'")).n
  // Postgres COUNT(*) is bigint, which the pg driver returns as a string —
  // normalize so the frontend can sum these safely.
  const stats = { totalPets, totalOwners, todayBookings, upcoming, pending, revenue, walkIns }
  for (const k of Object.keys(stats)) if (typeof stats[k] === 'string') stats[k] = Number(stats[k])
  res.json(stats)
}))

// ---------------- admin: client (owner) accounts ----------------
const OWNER_LIST_SELECT = `SELECT o.*,
  (SELECT COUNT(*) FROM pets p WHERE p.owner_id = o.owner_id) AS pet_count,
  (SELECT COUNT(*) FROM bookings b WHERE b.owner_id = o.owner_id) AS booking_count
  FROM owners o`

app.get('/api/admin/owners', requireStaff, h(async (req, res) => {
  const { q, status, account_type } = req.query
  const where = []
  const params = []
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`(o.full_name ILIKE $${i} OR o.email ILIKE $${i} OR o.phone ILIKE $${i})`)
  }
  if (status) { params.push(status); where.push(`o.status = $${params.length}`) }
  if (account_type) { params.push(account_type); where.push(`o.account_type = $${params.length}`) }
  const sql = OWNER_LIST_SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY o.created_at DESC, o.full_name'
  res.json(await dbAll(sql, params))
}))

app.get('/api/admin/owners/:id', requireStaff, h(async (req, res) => {
  const owner = await dbGet(OWNER_LIST_SELECT + ' WHERE o.owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const pets = await dbAll('SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC', [owner.owner_id])
  const bookings = await dbAll(BOOKING_SELECT + ' WHERE b.owner_id = $1 ORDER BY b.booking_date DESC, b.booking_time DESC', [owner.owner_id])
  res.json({ owner: { ...owner, password_hash: undefined }, pets, bookings })
}))

app.patch('/api/admin/owners/:id', requireStaff, h(async (req, res) => {
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const { full_name, phone, address, email } = req.body || {}
  if (email && email.toLowerCase() !== owner.email.toLowerCase()) {
    const clash = await dbGet('SELECT 1 FROM owners WHERE LOWER(email) = LOWER($1) AND owner_id <> $2', [email, owner.owner_id])
    if (clash) return res.status(409).json({ error: 'Another account already uses that email' })
  }
  const fields = { full_name, phone, address, email }
  const sets = []
  const params = []
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { params.push(v === '' ? null : v); sets.push(`${k} = $${params.length}`) }
  }
  if (sets.length) await dbRun(`UPDATE owners SET ${sets.join(', ')} WHERE owner_id = $${params.length + 1}`, [...params, owner.owner_id])
  res.json(publicOwner(await dbGet('SELECT * FROM owners WHERE owner_id = $1', [owner.owner_id])))
}))

app.patch('/api/admin/owners/:id/status', requireStaff, h(async (req, res) => {
  const { status } = req.body || {}
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'status must be active or suspended' })
  const { rowCount } = await dbRun('UPDATE owners SET status = $1 WHERE owner_id = $2', [status, req.params.id])
  if (rowCount === 0) return res.status(404).json({ error: 'Owner not found' })
  res.json(await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id]))
}))

app.post('/api/admin/owners/:id/reset-password', requireStaff, h(async (req, res) => {
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  if (owner.account_type === 'walk_in' || !owner.email) return res.status(400).json({ error: 'Walk-in clients have no login to reset' })
  const temp = 'Pv' + randomBytes(4).toString('hex').toUpperCase()
  await dbRun('UPDATE owners SET password_hash = $1 WHERE owner_id = $2', [hashPassword(temp), owner.owner_id])
  await sendEmail(owner, 'confirmation', `Password reset for your PetVibe account`, `Hi ${owner.full_name}, your temporary password is ${temp}. Please change it after logging in.`)
  res.json({ ok: true, temp_password: temp })
}))

const BOOKING_SELECT = `SELECT b.*, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email,
  p.name AS pet_name, p.species AS pet_species, p.breed AS pet_breed, p.weight_kg AS pet_weight,
  s.name AS service_name, s.category AS service_category, s.price_min AS service_price,
  st.full_name AS staff_name, st.role AS staff_role
  FROM bookings b
  JOIN owners o ON o.owner_id = b.owner_id
  JOIN pets p ON p.pet_id = b.pet_id
  JOIN services s ON s.service_id = b.service_id
  LEFT JOIN staff st ON st.staff_id = b.staff_id`

app.get('/api/admin/bookings', requireStaff, h(async (req, res) => {
  const { status, date, service, q } = req.query
  const where = []
  const params = []
  if (status) { params.push(status); where.push(`b.status = $${params.length}`) }
  if (date) { params.push(date); where.push(`b.booking_date = $${params.length}`) }
  if (service) { params.push(service); where.push(`b.service_id = $${params.length}`) }
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`(o.full_name LIKE $${i} OR p.name LIKE $${i} OR b.reference_code LIKE $${i})`)
  }
  const sql = BOOKING_SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY b.booking_date, b.booking_time'
  res.json(await dbAll(sql, params))
}))

app.get('/api/admin/bookings/:id', requireStaff, h(async (req, res) => {
  const booking = await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const records = await dbAll(
    'SELECT mr.*, st.full_name AS staff_name FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id WHERE mr.booking_id = $1',
    [booking.booking_id]
  )
  res.json({ booking, records: records.map(decorateRecord) })
}))

const TRANSITIONS = { pending: ['confirmed', 'completed', 'cancelled', 'no_show'], confirmed: ['completed', 'cancelled', 'no_show'], completed: [], cancelled: [], no_show: ['rebooked'], rebooked: ['confirmed'] }

app.patch('/api/admin/bookings/:id', requireStaff, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { status, staff_id, booking_date, booking_time } = req.body || {}

  if (status) {
    if (!TRANSITIONS[booking.status]?.includes(status)) return res.status(400).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
    await dbRun('UPDATE bookings SET status = $1 WHERE booking_id = $2', [status, booking.booking_id])
    await logBookingStatus(booking.booking_id, booking.status, status, req, body.note || null)
    if (status === 'completed') {
      // Auto-log the visit so the client sees it in their pet's medical history
      // (no manual record entry needed for a straightforward completed visit).
      const existing = await dbGet('SELECT 1 FROM medical_records WHERE booking_id = $1', [booking.booking_id])
      if (!existing) {
        await dbRun(
          `INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [booking.pet_id, booking.booking_id, booking.booking_date, booking.staff_id ?? req.staff?.staff_id ?? null, 'Completed visit', null]
        )
      }
    }
    if (status === 'no_show') {
      const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      const t = tomorrow.toISOString().slice(0, 10)
      await sendEmail(owner, 'rebooking', `Rebooking options for ${booking.reference_code}`, `Your slot ${booking.reference_code} was forfeited due to late arrival. Please rebook: ${t} at 10:00, ${t} at 14:00, or ${t} at 16:00.`)
    }
  }
  if (staff_id) {
    const staff = await dbGet('SELECT * FROM staff WHERE staff_id = $1 AND active = 1', [staff_id])
    if (!staff) return res.status(400).json({ error: 'Staff member not found or inactive' })
    await dbRun('UPDATE bookings SET staff_id = $1 WHERE booking_id = $2', [staff_id, booking.booking_id])
    if (!status) await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Assigned to ${staff.full_name}`)
  }
  if (booking_date || booking_time) {
    await dbRun(
      'UPDATE bookings SET booking_date = COALESCE($1, booking_date), booking_time = COALESCE($2, booking_time) WHERE booking_id = $3',
      [booking_date || null, booking_time || null, booking.booking_id]
    )
    if (!status && !staff_id) await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Moved to ${booking_date || booking.booking_date} at ${booking_time || booking.booking_time}`)
  }
  res.json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id]))
}))

// Staff-only: reschedule a booking, checking slot conflicts and the assigned
// staff member's schedule availability before moving it.
app.patch('/api/admin/bookings/:id/reschedule', requireStaff, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { booking_date, booking_time } = req.body || {}
  if (!booking_date || !booking_time) return res.status(400).json({ error: 'booking_date and booking_time are required' })
  const clash = await dbGet(
    "SELECT 1 FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND booking_id <> $3 AND status NOT IN ('cancelled', 'no_show')",
    [booking_date, booking_time, booking.booking_id]
  )
  if (clash) return res.status(409).json({ error: 'That time slot is already taken' })
  if (booking.staff_id) {
    const day = new Date(booking_date + 'T00:00:00').getDay()
    const avail = await dbGet(
      'SELECT 1 FROM staff_schedules WHERE staff_id = $1 AND is_available = 1 AND (day_of_week = $2 OR schedule_date = $3) AND start_time <= $4 AND end_time > $4',
      [booking.staff_id, day, booking_date, booking_time]
    )
    if (!avail) return res.status(400).json({ error: 'The assigned staff member is not on schedule at that time — pick another slot or reassign' })
  }
  const from = `${booking.booking_date} ${booking.booking_time}`
  await dbRun('UPDATE bookings SET booking_date = $1, booking_time = $2 WHERE booking_id = $3', [booking_date, booking_time, booking.booking_id])
  await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Rescheduled from ${from} to ${booking_date} at ${booking_time}`)
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
  await sendEmail(owner, 'confirmation', `Appointment moved — ${booking.reference_code}`, `Hi ${owner.full_name}, your appointment ${booking.reference_code} has been moved to ${booking_date} at ${booking_time}.`)
  res.json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id]))
}))

// Staff-only: assign / reassign the staff member handling this appointment.
app.patch('/api/admin/bookings/:id/assign', requireStaff, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { staff_id } = req.body || {}
  if (!staff_id) return res.status(400).json({ error: 'staff_id is required' })
  const s = await dbGet('SELECT * FROM staff WHERE staff_id = $1 AND active = 1', [staff_id])
  if (!s) return res.status(400).json({ error: 'Staff member not found or inactive' })
  await dbRun('UPDATE bookings SET staff_id = $1 WHERE booking_id = $2', [staff_id, booking.booking_id])
  await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Assigned to ${s.full_name}`)
  res.json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id]))
}))

// Staff-only: audit trail + client reschedule requests for one booking.
app.get('/api/admin/bookings/:id/history', requireStaff, h(async (req, res) => {
  const booking = await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const history = await dbAll('SELECT * FROM booking_status_log WHERE booking_id = $1 ORDER BY created_at DESC, log_id DESC', [booking.booking_id])
  const rescheduleRequests = await dbAll('SELECT * FROM reschedule_requests WHERE booking_id = $1 ORDER BY created_at DESC', [booking.booking_id])
  res.json({ booking, history, reschedule_requests: rescheduleRequests })
}))

// Staff-only: approve / decline a client's reschedule request. Approving
// applies the requested slot (with conflict re-check) and logs the change.
app.patch('/api/admin/bookings/:id/reschedule-request/:reqId', requireStaff, h(async (req, res) => {
  const { action } = req.body || {}
  if (!['approve', 'decline'].includes(action)) return res.status(400).json({ error: 'action must be approve or decline' })
  const rq = await dbGet('SELECT * FROM reschedule_requests WHERE request_id = $1 AND booking_id = $2', [req.params.reqId, req.params.id])
  if (!rq) return res.status(404).json({ error: 'Reschedule request not found' })
  if (rq.status !== 'pending') return res.status(400).json({ error: 'This request has already been handled' })
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1', [req.params.id])
  if (action === 'approve') {
    const clash = await dbGet(
      "SELECT 1 FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND booking_id <> $3 AND status NOT IN ('cancelled', 'no_show')",
      [rq.requested_date, rq.requested_time, booking.booking_id]
    )
    if (clash) return res.status(409).json({ error: 'The requested slot is no longer available — ask the client to pick another' })
    const from = `${booking.booking_date} ${booking.booking_time}`
    await dbRun('UPDATE bookings SET booking_date = $1, booking_time = $2 WHERE booking_id = $3', [rq.requested_date, rq.requested_time, booking.booking_id])
    await dbRun("UPDATE reschedule_requests SET status = 'approved' WHERE request_id = $1", [rq.request_id])
    await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Client reschedule approved: ${from} → ${rq.requested_date} at ${rq.requested_time}`)
    const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
    await sendEmail(owner, 'confirmation', `Reschedule approved — ${booking.reference_code}`, `Hi ${owner.full_name}, your request to move ${booking.reference_code} to ${rq.requested_date} at ${rq.requested_time} has been approved.`)
  } else {
    await dbRun("UPDATE reschedule_requests SET status = 'declined' WHERE request_id = $1", [rq.request_id])
    await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Client reschedule request declined: ${rq.requested_date} at ${rq.requested_time}`)
  }
  res.json(await dbGet('SELECT * FROM reschedule_requests WHERE request_id = $1', [rq.request_id]))
}))

app.post('/api/admin/bookings', requireStaff, h(async (req, res) => {
  const { owner_id, pet_id, service_id, staff_id, booking_date, booking_time, notes } = req.body || {}
  if (!owner_id || !pet_id || !service_id || !booking_date || !booking_time) return res.status(400).json({ error: 'owner, pet, service, date and time are required' })
  const clash = await dbGet(
    "SELECT 1 FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND status NOT IN ('cancelled', 'no_show')",
    [booking_date, booking_time]
  )
  if (clash) return res.status(409).json({ error: 'That time slot is already taken' })

  const ref = await nextReference()
  const { rows } = await dbRun(
    `INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'admin', $8) RETURNING booking_id`,
    [ref, owner_id, pet_id, service_id, staff_id || null, booking_date, booking_time, notes || null]
  )
  await logBookingStatus(rows[0].booking_id, null, 'pending', req, 'Booking created by staff')
  res.status(201).json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [rows[0].booking_id]))
}))

app.get('/api/admin/pets', requireStaff, h(async (req, res) => {
  const { q } = req.query
  const where = []
  const params = []
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`(p.name LIKE $${i} OR o.full_name LIKE $${i} OR p.breed LIKE $${i})`)
  }
  const sql = `SELECT p.*, o.full_name AS owner_name, o.phone AS owner_phone,
    (SELECT COUNT(*) FROM bookings b WHERE b.pet_id = p.pet_id) AS booking_count
    FROM pets p JOIN owners o ON o.owner_id = p.owner_id` + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY p.created_at DESC'
  res.json(await dbAll(sql, params))
}))

app.get('/api/admin/pets/:id', requireStaff, h(async (req, res) => {
  const pet = await dbGet(
    'SELECT p.*, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.account_type FROM pets p JOIN owners o ON o.owner_id = p.owner_id WHERE p.pet_id = $1',
    [req.params.id]
  )
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = await dbAll(
    `SELECT mr.*, st.full_name AS staff_name, b.reference_code, sv.name AS service_name
     FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id
     LEFT JOIN bookings b ON b.booking_id = mr.booking_id LEFT JOIN services sv ON sv.service_id = b.service_id
     WHERE mr.pet_id = $1 ORDER BY mr.visit_date DESC`,
    [pet.pet_id]
  )
  const bookings = await dbAll(BOOKING_SELECT + ' WHERE b.pet_id = $1 ORDER BY b.booking_date DESC', [pet.pet_id])
  res.json({ pet, records: records.map(decorateRecord), bookings })
}))

app.get('/api/admin/pets/:id/records', requireStaff, h(async (req, res) => {
  const pet = await dbGet('SELECT * FROM pets WHERE pet_id = $1', [req.params.id])
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = await dbAll(
    `SELECT mr.*, st.full_name AS staff_name, b.reference_code, sv.name AS service_name
     FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id
     LEFT JOIN bookings b ON b.booking_id = mr.booking_id LEFT JOIN services sv ON sv.service_id = b.service_id
     WHERE mr.pet_id = $1 ORDER BY mr.visit_date DESC`,
    [pet.pet_id]
  )
  res.json(records.map(decorateRecord))
}))

app.post('/api/admin/pets/:id/records', requireStaff, h(async (req, res) => {
  const { visit_date, record_date, diagnosis, treatment_notes, notes, vaccinations_given, weight_at_visit, next_due_date, booking_id, staff_id, record_type, type, title } = req.body || {}
  const date = record_date || visit_date
  if (!date) return res.status(400).json({ error: 'record_date (visit date) is required' })
  const { rows } = await dbRun(
    `INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes, vaccinations_given, weight_at_visit, next_due_date, record_type, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING record_id`,
    [req.params.id, booking_id || null, date, staff_id ?? req.staff.staff_id, diagnosis || null, notes || treatment_notes || null, vaccinations_given || null, weight_at_visit || null, next_due_date || null, type || record_type || null, title || null]
  )
  res.status(201).json(decorateRecord(await dbGet('SELECT * FROM medical_records WHERE record_id = $1', [rows[0].record_id])))
}))

app.patch('/api/admin/records/:id', requireStaff, h(async (req, res) => {
  const rec = await dbGet('SELECT * FROM medical_records WHERE record_id = $1', [req.params.id])
  if (!rec) return res.status(404).json({ error: 'Record not found' })
  const b = req.body || {}
  const fields = {
    visit_date: b.record_date || b.visit_date,
    staff_id: b.staff_id,
    booking_id: b.booking_id,
    diagnosis: b.diagnosis,
    treatment_notes: b.notes || b.treatment_notes,
    vaccinations_given: b.vaccinations_given,
    weight_at_visit: b.weight_at_visit,
    next_due_date: b.next_due_date,
    record_type: b.type || b.record_type,
    title: b.title,
  }
  const sets = []
  const params = []
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { params.push(v === '' ? null : v); sets.push(`${k} = $${params.length}`) }
  }
  if (sets.length) await dbRun(`UPDATE medical_records SET ${sets.join(', ')} WHERE record_id = $${params.length + 1}`, [...params, rec.record_id])
  res.json(decorateRecord(await dbGet('SELECT * FROM medical_records WHERE record_id = $1', [rec.record_id])))
}))

app.delete('/api/admin/records/:id', requireStaff, h(async (req, res) => {
  const { rowCount } = await dbRun('DELETE FROM medical_records WHERE record_id = $1', [req.params.id])
  if (rowCount === 0) return res.status(404).json({ error: 'Record not found' })
  res.json({ ok: true })
}))

app.get('/api/admin/staff', requireStaff, h(async (_req, res) => {
  const staff = await dbAll('SELECT * FROM staff ORDER BY role, full_name')
  const counts = await dbAll("SELECT staff_id, COUNT(*) AS n FROM bookings WHERE status IN ('confirmed', 'completed') GROUP BY staff_id")
  const byStaff = Object.fromEntries(counts.map((c) => [c.staff_id, c.n]))
  res.json(staff.map((s) => ({ ...s, password_hash: undefined, appointment_count: byStaff[s.staff_id] || 0 })))
}))

app.post('/api/admin/staff', requireStaff, h(async (req, res) => {
  const { full_name, role, email, specialization } = req.body || {}
  if (!full_name || !role) return res.status(400).json({ error: 'full_name and role are required' })
  const { rows } = await dbRun(
    'INSERT INTO staff (full_name, role, email, specialization, active) VALUES ($1, $2, $3, $4, 1) RETURNING staff_id',
    [full_name, role, email || null, specialization || null]
  )
  res.status(201).json(await dbGet('SELECT * FROM staff WHERE staff_id = $1', [rows[0].staff_id]))
}))

app.patch('/api/admin/staff/:id/toggle', requireStaff, h(async (req, res) => {
  const staff = await dbGet('SELECT * FROM staff WHERE staff_id = $1', [req.params.id])
  if (!staff) return res.status(404).json({ error: 'Staff not found' })
  await dbRun('UPDATE staff SET active = $1 WHERE staff_id = $2', [staff.active ? 0 : 1, staff.staff_id])
  res.json(await dbGet('SELECT * FROM staff WHERE staff_id = $1', [staff.staff_id]))
}))

app.get('/api/admin/schedule', requireStaff, h(async (_req, res) => {
  const schedules = await dbAll(
    'SELECT sc.*, st.full_name AS staff_name, st.role AS staff_role FROM staff_schedules sc JOIN staff st ON st.staff_id = sc.staff_id ORDER BY st.full_name, sc.day_of_week'
  )
  res.json(schedules)
}))

app.post('/api/admin/schedule', requireStaff, h(async (req, res) => {
  const { staff_id, day_of_week, start_time, end_time, is_available } = req.body || {}
  if (!staff_id || day_of_week === undefined || !start_time || !end_time) return res.status(400).json({ error: 'staff, day_of_week, start_time and end_time are required' })
  const { rows } = await dbRun(
    'INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, $5) RETURNING schedule_id',
    [staff_id, day_of_week, start_time, end_time, is_available === false ? 0 : 1]
  )
  res.status(201).json(await dbGet('SELECT * FROM staff_schedules WHERE schedule_id = $1', [rows[0].schedule_id]))
}))

app.delete('/api/admin/schedule/:id', requireStaff, h(async (req, res) => {
  await dbRun('DELETE FROM staff_schedules WHERE schedule_id = $1', [req.params.id])
  res.json({ ok: true })
}))

app.post('/api/admin/walkin', requireStaff, h(async (req, res) => {
  const { owner, pet, booking } = req.body || {}
  if (!owner?.full_name || !owner?.phone) return res.status(400).json({ error: 'Owner name and phone are required for walk-ins' })
  if (!pet?.name || !booking?.service_id || !booking?.booking_date || !booking?.booking_time) {
    return res.status(400).json({ error: 'Pet name, service, date and time are required' })
  }
  const clash = await dbGet(
    "SELECT 1 FROM bookings WHERE booking_date = $1 AND booking_time = $2 AND status NOT IN ('cancelled', 'no_show')",
    [booking.booking_date, booking.booking_time]
  )
  if (clash) return res.status(409).json({ error: 'That time slot is already taken' })

  const email = (owner.email || `walkin-${Date.now()}@petvibe.ph`).toLowerCase()
  const ownerRow = await dbRun(
    "INSERT INTO owners (full_name, email, phone, address, account_type) VALUES ($1, $2, $3, $4, $5) RETURNING owner_id",
    [owner.full_name, email, owner.phone, owner.address || null, 'walk_in']
  )
  const ownerId = ownerRow.rows[0].owner_id
  const petRow = await dbRun(
    'INSERT INTO pets (owner_id, name, species, breed, gender, birthdate, weight_kg) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING pet_id',
    [ownerId, pet.name, pet.species || 'dog', pet.breed || null, pet.gender || null, pet.birthdate || null, pet.weight_kg || null]
  )
  const petId = petRow.rows[0].pet_id
  const ref = await nextReference()
  const bookingRow = await dbRun(
    `INSERT INTO bookings (reference_code, owner_id, pet_id, service_id, staff_id, booking_date, booking_time, status, created_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'admin', $8) RETURNING booking_id`,
    [ref, ownerId, petId, booking.service_id, booking.staff_id || null, booking.booking_date, booking.booking_time, booking.notes || null]
  )
  await logBookingStatus(bookingRow.rows[0].booking_id, null, 'pending', req, 'Walk-in booking created at counter')
  res.status(201).json({ owner_id: ownerId, pet_id: petId, booking_id: bookingRow.rows[0].booking_id, reference_code: ref })
}))

app.get('/api/admin/analytics', requireStaff, h(async (_req, res) => {
  // bookings per day, last 14 days
  const days = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const x = new Date(today); x.setDate(x.getDate() - i)
    days.push(x.toISOString().slice(0, 10))
  }
  const byDay = await dbAll('SELECT booking_date, COUNT(*)::int AS n FROM bookings WHERE booking_date >= $1 GROUP BY booking_date', [days[0]])
  const dayMap = Object.fromEntries(byDay.map((d) => [d.booking_date, d.n]))
  const bookingsByDay = days.map((date) => ({ date, count: dayMap[date] || 0 }))

  // revenue by service (top 6 by estimated value)
  const revenueByService = await dbAll(
    `SELECT s.name, s.category, COUNT(*)::int AS bookings, SUM(s.price_min)::float8 AS revenue
     FROM bookings b JOIN services s ON s.service_id = b.service_id
     WHERE b.status IN ('confirmed', 'completed') GROUP BY s.service_id, s.name, s.category ORDER BY revenue DESC LIMIT 6`
  )

  // staff performance
  const staffPerformance = await dbAll(
    `SELECT st.full_name, st.role, COUNT(b.booking_id)::int AS completed
     FROM staff st LEFT JOIN bookings b ON b.staff_id = st.staff_id AND b.status = 'completed'
     GROUP BY st.staff_id, st.full_name, st.role ORDER BY completed DESC`
  )

  // status breakdown
  const statusBreakdown = await dbAll('SELECT status, COUNT(*)::int AS n FROM bookings GROUP BY status')

  // top services by volume
  const topServices = await dbAll(
    'SELECT s.name, COUNT(*)::int AS n FROM bookings b JOIN services s ON s.service_id = b.service_id GROUP BY s.service_id, s.name ORDER BY n DESC LIMIT 5'
  )

  res.json({ bookingsByDay, revenueByService, staffPerformance, statusBreakdown, topServices })
}))

app.get('/api/admin/notifications', requireStaff, h(async (_req, res) => {
  res.json(await dbAll(
    'SELECT n.*, o.full_name AS owner_name, o.email AS owner_email FROM notifications n JOIN owners o ON o.owner_id = n.owner_id ORDER BY n.sent_at DESC LIMIT 20'
  ))
}))

// ---------------- admin: printable reports ----------------
app.get('/api/admin/reports/appointments', requireStaff, h(async (req, res) => {
  const { from, to, staff } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' })
  const where = ['b.booking_date >= $1', 'b.booking_date <= $2']
  const params = [from, to]
  if (staff) { params.push(staff); where.push(`b.staff_id = $${params.length}`) }
  const rows = await dbAll(BOOKING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY b.booking_date, b.booking_time', params)
  res.json({ from, to, staff: staff || null, rows })
}))

app.get('/api/admin/reports/pet/:id/medical', requireStaff, h(async (req, res) => {
  const pet = await dbGet(
    'SELECT p.*, o.full_name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.address AS owner_address FROM pets p JOIN owners o ON o.owner_id = p.owner_id WHERE p.pet_id = $1',
    [req.params.id]
  )
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const records = await dbAll(
    `SELECT mr.*, st.full_name AS staff_name, b.reference_code, sv.name AS service_name
     FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id
     LEFT JOIN bookings b ON b.booking_id = mr.booking_id LEFT JOIN services sv ON sv.service_id = b.service_id
     WHERE mr.pet_id = $1 ORDER BY mr.visit_date DESC`,
    [pet.pet_id]
  )
  res.json({ pet, records: records.map(decorateRecord) })
}))

app.get('/api/admin/reports/analytics', requireStaff, h(async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' })
  const range = 'b.booking_date >= $1 AND b.booking_date <= $2'
  const bookingsByService = await dbAll(
    `SELECT s.name, s.category, COUNT(*)::int AS bookings, SUM(s.price_min)::float8 AS revenue
     FROM bookings b JOIN services s ON s.service_id = b.service_id
     WHERE ${range} GROUP BY s.service_id, s.name, s.category ORDER BY revenue DESC`,
    [from, to]
  )
  const revenue = (await dbGet(
    `SELECT COALESCE(SUM(s.price_min), 0) AS total FROM bookings b JOIN services s ON s.service_id = b.service_id
     WHERE b.status IN ('confirmed', 'completed') AND ${range}`,
    [from, to]
  )).total
  const totalBookings = Number((await dbGet('SELECT COUNT(*) AS n FROM bookings WHERE booking_date >= $1 AND booking_date <= $2', [from, to])).n)
  const topClients = await dbAll(
    `SELECT o.full_name, o.phone, o.email, COUNT(b.booking_id)::int AS bookings
     FROM bookings b JOIN owners o ON o.owner_id = b.owner_id
     WHERE ${range} GROUP BY o.owner_id, o.full_name, o.phone, o.email ORDER BY bookings DESC LIMIT 10`,
    [from, to]
  )
  const statusBreakdown = await dbAll('SELECT status, COUNT(*)::int AS n FROM bookings WHERE booking_date >= $1 AND booking_date <= $2 GROUP BY status', [from, to])
  res.json({ from, to, totalBookings, revenue, bookingsByService, topClients, statusBreakdown })
}))

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Server error' })
})

app.listen(PORT, () => {
  console.log(`PetVibe API listening on http://localhost:${PORT}`)
})
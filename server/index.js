import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { dbGet, dbAll, dbRun, withTransaction } from './db.js'
import { migrate } from './migrations.js'
import { seed, DEMO_ACCOUNTS } from './seed.js'
import { hashPassword, verifyPassword } from './passwords.js'
import { sendMail, emailConfigured, emailHtml } from './mailer.js'

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
// CORS: lock down to an explicit allow-list in production via the comma-
// separated ALLOWED_ORIGIN env var. In dev the Vite proxy keeps everything
// same-origin, so the permissive default is fine.
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}))
// Photo uploads are base64 data URLs (up to MAX_PHOTO_URL ≈ 6 MB), so the
// default 100 kb JSON limit would reject them with 413 before any handler
// runs. 8 mb gives headroom for the largest allowed photo + JSON overhead.
app.use(express.json({ limit: '8mb' }))

// Rate-limit auth endpoints per IP to slow brute-force attempts (10 tries /
// 15 min). Behind a reverse proxy in production, trust one hop so req.ip is
// the real client instead of the proxy.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in a few minutes' },
})

const PORT = process.env.PORT || 3001
const SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const todayStr = () => new Date().toISOString().slice(0, 10)

// Photos are stored as base64 data URLs in photo_url columns (no external file
// storage). Cap the payload so the DB doesn't balloon — 6 MB of base64 ≈ a
// ~4.5 MB image. '' / undefined / null all mean "no photo".
const MAX_PHOTO_URL = 6 * 1024 * 1024
function normalizePhoto(v) {
  if (v === undefined || v === null || v === '') return { ok: true, value: null }
  if (typeof v !== 'string' || !v.startsWith('data:image/') || v.length > MAX_PHOTO_URL) return { ok: false }
  return { ok: true, value: v }
}

// small helper so every route can stay a plain async function and errors
// fall through to the error handler at the bottom instead of crashing the process
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next)

// Validate a request body against a zod schema. On failure respond 400 with a
// readable message; on success replace req.body with the parsed (stripped)
// data so unknown fields are dropped instead of half-applied.
const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body || {})
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '),
    })
  }
  req.body = parsed.data
  next()
}

// Email format check shared by registration, profile edits and walk-ins —
// stops placeholder/garbage addresses from being saved (their booking emails
// would otherwise go nowhere).
const emailCheck = z.email()
const isValidEmail = (v) => emailCheck.safeParse(v).success

// ---- admin request schemas (replaces ad-hoc `if (!x) return 400` checks) ----
// Staff job title is display-only — any enum value is allowed, but the app
// never branches permissions on it (access is client/admin only).
const staffCreateSchema = z.object({
  full_name: z.string().trim().min(1, 'required'),
  role: z.enum(['admin', 'vet', 'groomer', 'front_desk']),
  email: z.union([z.email(), z.literal(''), z.undefined()]).optional(),
  specialization: z.union([z.string().trim().max(120), z.literal(''), z.undefined()]).optional(),
})

const serviceCreateSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  category: z.string().trim().min(1, 'required'),
  description: z.string().optional().default(''),
  price_min: z.preprocess((v) => Number(v), z.number().finite().nonnegative()),
  price_max: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().finite().nonnegative().nullable()),
  duration_minutes: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().int().nonnegative().nullable()),
  weight_tier: z.union([z.string().trim(), z.literal(''), z.undefined()]).optional(),
  client_bookable: z.boolean().optional().default(false),
})

const ownerPatchSchema = z.object({
  full_name: z.string().trim().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.union([z.email(), z.literal(''), z.undefined()]).optional(),
})

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
  // Sessions expire after 7 days (column default). Expired tokens are deleted
  // so a stale session can't be reused even if its token leaks.
  if (s.expires_at && new Date(s.expires_at) < new Date()) {
    await dbRun('DELETE FROM sessions WHERE token = $1', [token])
    return res.status(401).json({ error: 'Session expired, please log in again' })
  }
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
const requireAdmin = (req, res, next) => {
  if (req.session === undefined) return authMw(req, res, () => requireAdmin(req, res, next))
  if (!req.staff) return res.status(403).json({ error: 'Admin access required' })
  if (req.staff.role !== 'admin') return res.status(403).json({ error: 'Only admins can perform this action' })
  next()
}
const requireStaff = (req, res, next) => {
  if (req.session === undefined) return authMw(req, res, () => requireStaff(req, res, next))
  return req.staff ? next() : res.status(403).json({ error: 'Staff access required' })
}

async function nextReference() {
  const { n } = await dbGet('SELECT COUNT(*) AS n FROM bookings')
  return `PV-${1000 + Number(n) + 1}`
}

// ---------- booking email helpers ----------
// Readable date (e.g. "Wednesday, August 20, 2026") for client-facing emails.
function fmtLongDate(d) {
  if (!d) return '—'
  const x = new Date(d + 'T00:00:00')
  return x.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Standard booking details block used in every client-facing booking email and
// in-app notification. `b` must be a booking row with pet_name / service_name
// joined in (see BOOKING_EMAIL_SELECT below) so the details always match the
// booking on record — never re-type them by hand in a message body.
function bookingSummary(b) {
  return [
    `Service: ${b.service_name || '—'}`,
    `Pet: ${b.pet_name || '—'}`,
    `Date: ${fmtLongDate(b.booking_date)}`,
    `Time: ${b.booking_time || '—'}`,
    `Reference: ${b.reference_code || '—'}`,
  ].join('\n')
}

// Booking row + pet/service names. Used wherever an email or notification
// needs to describe a booking, so the confirmation, cancellation, reschedule
// and no-show messages all show the exact pet and service that was booked.
const BOOKING_EMAIL_SELECT = `SELECT b.*, p.name AS pet_name, s.name AS service_name
  FROM bookings b
  JOIN pets p ON p.pet_id = b.pet_id
  JOIN services s ON s.service_id = b.service_id`

// Record an in-app notification for a client and — when Gmail is configured —
// send the real email. The `channel` column keeps the historical "email"
// label either way. Booking-level events also link the booking_id so the
// inbox UI can jump straight to the appointment.
async function sendEmail(owner, type, subject, body, bookingId = null) {
  await dbRun(
    'INSERT INTO notifications (owner_id, booking_id, type, channel, subject, message_body) VALUES ($1, $2, $3, $4, $5, $6)',
    [owner.owner_id, bookingId, type, 'email', subject, body]
  )
  console.log(`[email:${type}] to ${owner.email} — ${subject}`)
  // Simulated when GMAIL_USER / GMAIL_APP_PASSWORD aren't set; never throws.
  await sendMail({ to: owner.email, subject, text: body, html: emailHtml(subject, body) })
}

// Record an in-app notification for every active staff member (the whole team
// sees client reschedule requests so whoever is on shift can act on them).
// No emails are sent here — only the client who booked receives Gmail; staff
// see these alerts in their in-app notification bell.
async function notifyStaff(type, subject, body, bookingId = null) {
  const rows = await dbAll('SELECT staff_id, email FROM staff WHERE active = 1')
  for (const r of rows) {
    await dbRun(
      'INSERT INTO notifications (staff_id, booking_id, type, channel, subject, message_body) VALUES ($1, $2, $3, $4, $5, $6)',
      [r.staff_id, bookingId, type, 'email', subject, body]
    )
  }
  console.log(`[notify:${type}] to ${rows.length} staff member(s) — ${subject}`)
}

// Append a row to the booking audit trail. Called on every status transition
// and on notable changes (reschedule, staff assignment, client requests).
async function logBookingStatus(bookingId, fromStatus, toStatus, req, note = null) {
  const actorRole = req?.staff ? (req.staff.role === 'admin' ? 'admin' : 'staff') : req?.owner ? 'client' : 'system'
  const actorName = req?.staff?.full_name || req?.owner?.full_name || null
  await dbRun(
    'INSERT INTO booking_status_log (booking_id, from_status, to_status, note, changed_by_role, changed_by_name) VALUES ($1, $2, $3, $4, $5, $6)',
    [bookingId, fromStatus ?? null, toStatus ?? null, note, actorRole, actorName]
  )
}

// Append a row to the admin audit trail (admin_action_log) for sensitive
// actions — suspensions, password resets, staff changes. Logging failures are
// non-fatal: never fail the request over audit bookkeeping.
async function logAdminAction(req, action, targetType = null, targetId = null) {
  try {
    await dbRun(
      'INSERT INTO admin_action_log (staff_id, action, target_type, target_id) VALUES ($1, $2, $3, $4)',
      [req.staff?.staff_id ?? null, action, targetType, targetId]
    )
  } catch (e) {
    console.error('[admin_action_log]', e.message)
  }
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
app.get('/api/demo-accounts', (_req, res) => {
  // Demo credentials are for local development only — never hand out the
  // one-click logins on a production build (see also Login.jsx gating).
  if (process.env.NODE_ENV === 'production') return res.json([])
  res.json(DEMO_ACCOUNTS)
})

app.post('/api/auth/register', authLimiter, h(async (req, res) => {
  const { full_name, email, phone, password, address } = req.body || {}
  if (!full_name || !email || !phone || !password) return res.status(400).json({ error: 'full_name, email, phone and password are required' })
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address' })
  if (await dbGet('SELECT 1 FROM owners WHERE email = $1', [email])) return res.status(409).json({ error: 'An account with this email already exists' })
  const { rows } = await dbRun(
    'INSERT INTO owners (full_name, email, phone, password_hash, address, account_type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING owner_id',
    [full_name, email, phone, hashPassword(password), address || null, 'registered']
  )
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [rows[0].owner_id])
  res.status(201).json({ token: await createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
}))

app.post('/api/auth/login', authLimiter, h(async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const owner = await dbGet('SELECT * FROM owners WHERE email = $1', [email])
  if (owner && verifyPassword(password, owner.password_hash)) {
    // Blocked after a valid password so we don't leak account state to
    // someone guessing credentials.
    if (owner.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended' })
    return res.json({ token: await createSession(owner.owner_id), role: 'client', user: publicOwner(owner) })
  }
  const staff = await dbGet('SELECT * FROM staff WHERE email = $1', [email])
  if (staff && staff.active && verifyPassword(password, staff.password_hash)) {
    const staffRole = staff.role === 'admin' ? 'admin' : 'staff'
    return res.json({ token: await createSession(null, staff.staff_id), role: staffRole, user: publicStaff(staff) })
  }
  res.status(401).json({ error: 'Invalid email or password' })
}))

app.post('/api/auth/logout', authMw, h(async (req, res) => {
  await dbRun('DELETE FROM sessions WHERE token = $1', [req.session.token])
  res.json({ ok: true })
}))

app.get('/api/auth/me', authMw, (req, res) => {
  if (req.staff) {
    const staffRole = req.staff.role === 'admin' ? 'admin' : 'staff'
    return res.json({ role: staffRole, user: publicStaff(req.staff) })
  }
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
  res.json(await dbAll("SELECT staff_id, full_name, role, specialization, photo_url FROM staff WHERE active = 1 ORDER BY role, full_name"))
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
function publicOwner(o) { return { owner_id: o.owner_id, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, account_type: o.account_type, photo_url: o.photo_url || null } }
function publicStaff(s) { return { staff_id: s.staff_id, full_name: s.full_name, role: s.role, email: s.email, specialization: s.specialization, photo_url: s.photo_url || null } }

app.get('/api/me', authMw, requireOwner, h(async (req, res) => {
  const pets = await dbAll('SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC', [req.owner.owner_id])
  res.json({ owner: publicOwner(req.owner), pets })
}))

app.put('/api/me', authMw, requireOwner, h(async (req, res) => {
  const { full_name, phone, address, email } = req.body || {}
  // Email changes require uniqueness (in production a re-verification email
  // would be sent before the address is switched; here we validate + apply).
  if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address' })
  if (email && email.toLowerCase() !== req.owner.email.toLowerCase()) {
    const clash = await dbGet('SELECT 1 FROM owners WHERE LOWER(email) = LOWER($1) AND owner_id <> $2', [email, req.owner.owner_id])
    if (clash) return res.status(409).json({ error: 'Another account already uses that email' })
  }
  // Only provided fields are written ('' → NULL so fields can be cleared);
  // photo_url is validated separately as a base64 data URL.
  const fields = { full_name, phone, address, email }
  const sets = []
  const params = []
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { params.push(v === '' ? null : v); sets.push(`${k} = $${params.length}`) }
  }
  if (req.body?.photo_url !== undefined) {
    const photo = normalizePhoto(req.body.photo_url)
    if (!photo.ok) return res.status(400).json({ error: 'Invalid photo — upload a JPG/PNG under 4 MB.' })
    params.push(photo.value)
    sets.push(`photo_url = $${params.length}`)
  }
  if (sets.length) await dbRun(`UPDATE owners SET ${sets.join(', ')} WHERE owner_id = $${params.length + 1}`, [...params, req.owner.owner_id])
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
  // Only provided fields are written ('' → NULL so fields can be cleared).
  const fields = { name, species, breed, gender, birthdate, weight_kg }
  const sets = []
  const params = []
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { params.push(v === '' ? null : v); sets.push(`${k} = $${params.length}`) }
  }
  if (req.body?.photo_url !== undefined) {
    const photo = normalizePhoto(req.body.photo_url)
    if (!photo.ok) return res.status(400).json({ error: 'Invalid photo — upload a JPG/PNG under 4 MB.' })
    params.push(photo.value)
    sets.push(`photo_url = $${params.length}`)
  }
  if (sets.length) await dbRun(`UPDATE pets SET ${sets.join(', ')} WHERE pet_id = $${params.length + 1}`, [...params, pet.pet_id])
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
  // Booking is created as 'pending' — notify that it was received and is
  // awaiting clinic confirmation (the client gets a separate "confirmed"
  // notification when staff actually confirms it).
  await sendEmail(req.owner, 'booking_received', `Booking received — ${ref}`, `Hi ${req.owner.full_name},\n\nWe've received your booking request. Here's a summary:\n\n${bookingSummary(booking)}\n\nWe'll confirm it shortly — you'll get an email as soon as it's approved.\n\n— PetVibe Care 🐾`, rows[0].booking_id)
  // Alert the team so someone can review + confirm the new booking.
  await notifyStaff('booking_received', `New booking — ${ref}`, `${req.owner.full_name} booked ${service.name} for ${pet.name} on ${booking_date} at ${booking_time}. Review it in Appointments.`, rows[0].booking_id)
  await logBookingStatus(rows[0].booking_id, null, 'pending', req, 'Booking created by client')
  res.status(201).json(booking)
}))

app.post('/api/bookings/:id/cancel', authMw, requireOwner, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND owner_id = $2', [req.params.id, req.owner.owner_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Only pending or confirmed bookings can be cancelled' })
  await dbRun("UPDATE bookings SET status = 'cancelled' WHERE booking_id = $1", [booking.booking_id])
  await logBookingStatus(booking.booking_id, booking.status, 'cancelled', req, 'Cancelled by client')
  const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
  await sendEmail(owner, 'rebooking', `Booking cancelled — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nYour booking has been cancelled. Here are the details:\n\n${bookingSummary(full)}\n\nIf you'd like to book another appointment, you can do so anytime on our site.\n\n— PetVibe Care 🐾`, booking.booking_id)
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
  // Alert the whole team so the request gets approved/declined in Appointments.
  await notifyStaff('reschedule', `Reschedule request — ${booking.reference_code}`, `${req.owner.full_name} requested to move ${booking.reference_code} to ${requested_date} at ${requested_time}${reason ? ` — ${reason}` : ''}. Review it in Appointments.`, booking.booking_id)
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

// Client in-app notifications (booking confirmations, reschedules, etc.).
app.get('/api/notifications', authMw, requireOwner, h(async (req, res) => {
  const notifications = await dbAll(
    'SELECT * FROM notifications WHERE owner_id = $1 ORDER BY sent_at DESC, notification_id DESC LIMIT 30',
    [req.owner.owner_id]
  )
  res.json({ notifications, unread: notifications.filter((n) => !n.read_at).length })
}))

app.post('/api/notifications/read', authMw, requireOwner, h(async (req, res) => {
  await dbRun('UPDATE notifications SET read_at = NOW() WHERE owner_id = $1 AND read_at IS NULL', [req.owner.owner_id])
  res.json({ ok: true })
}))

// ---------------- admin routes ----------------
// ---------------- admin: services CRUD ----------------
app.get('/api/admin/services', requireStaff, h(async (_req, res) => {
  res.json(await dbAll('SELECT * FROM services ORDER BY category, name'))
}))

app.post('/api/admin/services', requireAdmin, validate(serviceCreateSchema), h(async (req, res) => {
  // req.body is already validated + stripped by serviceCreateSchema
  const { name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable } = req.body
  const { rows } = await dbRun(
    `INSERT INTO services (name, category, description, price_min, price_max, duration_minutes, weight_tier, client_bookable, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1) RETURNING service_id`,
    [name, category, description || null, price_min, price_max, duration_minutes, weight_tier || null, client_bookable ? 1 : 0]
  )
  res.status(201).json(await dbGet('SELECT * FROM services WHERE service_id = $1', [rows[0].service_id]))
}))

app.patch('/api/admin/services/:id', requireAdmin, h(async (req, res) => {
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

app.patch('/api/admin/services/:id/toggle', requireAdmin, h(async (req, res) => {
  const svc = await dbGet('SELECT * FROM services WHERE service_id = $1', [req.params.id])
  if (!svc) return res.status(404).json({ error: 'Service not found' })
  await dbRun('UPDATE services SET active = $1 WHERE service_id = $2', [svc.active ? 0 : 1, svc.service_id])
  res.json(await dbGet('SELECT * FROM services WHERE service_id = $1', [svc.service_id]))
}))

app.get('/api/admin/stats', requireAdmin, h(async (req, res) => {
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

app.get('/api/admin/owners', requireAdmin, h(async (req, res) => {
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

app.get('/api/admin/owners/:id', requireAdmin, h(async (req, res) => {
  const owner = await dbGet(OWNER_LIST_SELECT + ' WHERE o.owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const pets = await dbAll('SELECT * FROM pets WHERE owner_id = $1 ORDER BY created_at DESC', [owner.owner_id])
  const bookings = await dbAll(BOOKING_SELECT + ' WHERE b.owner_id = $1 ORDER BY b.booking_date DESC, b.booking_time DESC', [owner.owner_id])
  res.json({ owner: { ...owner, password_hash: undefined }, pets, bookings })
}))

app.patch('/api/admin/owners/:id', requireAdmin, validate(ownerPatchSchema), h(async (req, res) => {
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

app.patch('/api/admin/owners/:id/status', requireAdmin, h(async (req, res) => {
  const { status } = req.body || {}
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'status must be active or suspended' })
  const { rowCount } = await dbRun('UPDATE owners SET status = $1 WHERE owner_id = $2', [status, req.params.id])
  if (rowCount === 0) return res.status(404).json({ error: 'Owner not found' })
  await logAdminAction(req, 'owner_status_change', 'owner', Number(req.params.id))
  res.json(await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id]))
}))

app.post('/api/admin/owners/:id/reset-password', requireAdmin, h(async (req, res) => {
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  if (owner.account_type === 'walk_in' || !owner.email) return res.status(400).json({ error: 'Walk-in clients have no login to reset' })
  const temp = 'Pv' + randomBytes(4).toString('hex').toUpperCase()
  await dbRun('UPDATE owners SET password_hash = $1 WHERE owner_id = $2', [hashPassword(temp), owner.owner_id])
  await logAdminAction(req, 'owner_password_reset', 'owner', owner.owner_id)
  await sendEmail(owner, 'confirmation', `Password reset for your PetVibe account`, `Hi ${owner.full_name}, your temporary password is ${temp}. Please change it after logging in.`)
  res.json({ ok: true, temp_password: temp })
}))

// Staff-only: permanently delete a client account and everything attached to
// it — pets, medical records, bookings, notifications, sessions. The schema's
// FKs only cascade for pets/records/sessions, so the rest is removed in
// dependency order inside one transaction (all-or-nothing).
app.delete('/api/admin/owners/:id', requireAdmin, h(async (req, res) => {
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [req.params.id])
  if (!owner) return res.status(404).json({ error: 'Client not found' })
  await withTransaction(async (tx) => {
    const q = (sql, params = []) => tx.query(sql, params)
    // Booking-dependent rows first (notifications can be staff-addressed too,
    // so they're removed by booking_id, not just owner_id).
    const { rows: bids } = await q('SELECT booking_id FROM bookings WHERE owner_id = $1', [owner.owner_id])
    for (const b of bids) {
      await q('DELETE FROM notifications WHERE booking_id = $1', [b.booking_id])
      await q('DELETE FROM medical_records WHERE booking_id = $1', [b.booking_id])
      await q('DELETE FROM reschedule_requests WHERE booking_id = $1', [b.booking_id])
      await q('DELETE FROM booking_status_log WHERE booking_id = $1', [b.booking_id])
    }
    await q('DELETE FROM notifications WHERE owner_id = $1', [owner.owner_id])
    await q('DELETE FROM bookings WHERE owner_id = $1', [owner.owner_id])
    // Pets cascade their own medical_records; sessions cascade too, but they're
    // deleted explicitly for clarity.
    await q('DELETE FROM pets WHERE owner_id = $1', [owner.owner_id])
    await q('DELETE FROM sessions WHERE owner_id = $1', [owner.owner_id])
    await q('DELETE FROM owners WHERE owner_id = $1', [owner.owner_id])
  })
  await logAdminAction(req, 'owner_delete', 'owner', owner.owner_id)
  res.json({ ok: true })
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

app.get('/api/admin/bookings', requireAdmin, h(async (req, res) => {
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

app.get('/api/admin/bookings/:id', requireAdmin, h(async (req, res) => {
  const booking = await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const records = await dbAll(
    'SELECT mr.*, st.full_name AS staff_name FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id WHERE mr.booking_id = $1',
    [booking.booking_id]
  )
  res.json({ booking, records: records.map(decorateRecord) })
}))

const TRANSITIONS = { pending: ['confirmed', 'completed', 'cancelled', 'no_show'], confirmed: ['completed', 'cancelled', 'no_show'], completed: [], cancelled: [], no_show: ['rebooked'], rebooked: ['confirmed'] }

app.patch('/api/admin/bookings/:id', requireAdmin, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const { status, staff_id, booking_date, booking_time } = req.body || {}

  if (status) {
    if (!TRANSITIONS[booking.status]?.includes(status)) return res.status(400).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
    await dbRun('UPDATE bookings SET status = $1 WHERE booking_id = $2', [status, booking.booking_id])
    await logBookingStatus(booking.booking_id, booking.status, status, req, req.body?.note || null)
    if (status === 'confirmed') {
      const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
      const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
      await sendEmail(owner, 'confirmation', `Booking confirmed — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nGreat news — your booking is confirmed!\n\n${bookingSummary(full)}\n\nWe look forward to seeing you and ${full.pet_name}.\n\n— PetVibe Care 🐾`, booking.booking_id)
    }
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
      const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
      const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
      const t = tomorrow.toISOString().slice(0, 10)
      await sendEmail(owner, 'rebooking', `Rebooking options — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nUnfortunately your appointment was marked as a no-show, so the slot has been released.\n\n${bookingSummary(full)}\n\nYou're welcome to rebook — ${fmtLongDate(t)} at 10:00, 14:00, or 16:00.\n\n— PetVibe Care 🐾`, booking.booking_id)
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
app.patch('/api/admin/bookings/:id/reschedule', requireAdmin, h(async (req, res) => {
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
  const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
  const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
  await sendEmail(owner, 'confirmation', `Appointment moved — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nYour appointment has been rescheduled. Here are your updated details:\n\n${bookingSummary(full)}\n\nSee you then!\n\n— PetVibe Care 🐾`, booking.booking_id)
  res.json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id]))
}))

// Staff-only: assign / reassign the staff member handling this appointment.
app.patch('/api/admin/bookings/:id/assign', requireAdmin, h(async (req, res) => {
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

// Audit trail + client reschedule requests for one booking.
app.get('/api/admin/bookings/:id/history', requireStaff, h(async (req, res) => {
  const booking = await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [req.params.id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const history = await dbAll('SELECT * FROM booking_status_log WHERE booking_id = $1 ORDER BY created_at DESC, log_id DESC', [booking.booking_id])
  const rescheduleRequests = await dbAll('SELECT * FROM reschedule_requests WHERE booking_id = $1 ORDER BY created_at DESC', [booking.booking_id])
  res.json({ booking, history, reschedule_requests: rescheduleRequests })
}))

// Staff-only: approve / decline a client's reschedule request. Approving
// applies the requested slot (with conflict re-check) and logs the change.
app.patch('/api/admin/bookings/:id/reschedule-request/:reqId', requireAdmin, h(async (req, res) => {
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
    const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
    const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
    await sendEmail(owner, 'reschedule', `Reschedule approved — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nYour reschedule request has been approved! Here are your updated details:\n\n${bookingSummary(full)}\n\nSee you then!\n\n— PetVibe Care 🐾`, booking.booking_id)
  } else {
    await dbRun("UPDATE reschedule_requests SET status = 'declined' WHERE request_id = $1", [rq.request_id])
    await logBookingStatus(booking.booking_id, booking.status, booking.status, req, `Client reschedule request declined: ${rq.requested_date} at ${rq.requested_time}`)
    const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
    const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
    await sendEmail(owner, 'reschedule', `Reschedule request declined — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nUnfortunately your request to move your appointment was declined.\n\n${bookingSummary(full)}\n\nIf you'd like a different time, please contact the clinic or request a new slot from your portal.\n\n— PetVibe Care 🐾`, booking.booking_id)
  }
  res.json(await dbGet('SELECT * FROM reschedule_requests WHERE request_id = $1', [rq.request_id]))
}))

app.post('/api/admin/bookings', requireAdmin, h(async (req, res) => {
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

// Set / clear a pet's photo ('' removes it).
app.patch('/api/admin/pets/:id/photo', requireAdmin, h(async (req, res) => {
  const pet = await dbGet('SELECT * FROM pets WHERE pet_id = $1', [req.params.id])
  if (!pet) return res.status(404).json({ error: 'Pet not found' })
  const photo = normalizePhoto(req.body?.photo_url)
  if (!photo.ok) return res.status(400).json({ error: 'Invalid photo — upload a JPG/PNG under 4 MB.' })
  await dbRun('UPDATE pets SET photo_url = $1 WHERE pet_id = $2', [photo.value, pet.pet_id])
  res.json(await dbGet('SELECT * FROM pets WHERE pet_id = $1', [pet.pet_id]))
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

app.post('/api/admin/pets/:id/records', requireAdmin, h(async (req, res) => {
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

app.patch('/api/admin/records/:id', requireAdmin, h(async (req, res) => {
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

app.delete('/api/admin/records/:id', requireAdmin, h(async (req, res) => {
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

app.post('/api/admin/staff', requireAdmin, validate(staffCreateSchema), h(async (req, res) => {
  // req.body is already validated + stripped by staffCreateSchema
  const { full_name, role, email, specialization } = req.body
  const { rows } = await dbRun(
    'INSERT INTO staff (full_name, role, email, specialization, active) VALUES ($1, $2, $3, $4, 1) RETURNING staff_id',
    [full_name, role, email || null, specialization || null]
  )
  await logAdminAction(req, 'staff_create', 'staff', rows[0].staff_id)
  res.status(201).json(await dbGet('SELECT * FROM staff WHERE staff_id = $1', [rows[0].staff_id]))
}))

app.patch('/api/admin/staff/:id/toggle', requireAdmin, h(async (req, res) => {
  const staff = await dbGet('SELECT * FROM staff WHERE staff_id = $1', [req.params.id])
  if (!staff) return res.status(404).json({ error: 'Staff not found' })
  await dbRun('UPDATE staff SET active = $1 WHERE staff_id = $2', [staff.active ? 0 : 1, staff.staff_id])
  await logAdminAction(req, 'staff_toggle', 'staff', staff.staff_id)
  res.json(await dbGet('SELECT * FROM staff WHERE staff_id = $1', [staff.staff_id]))
}))

// Set / clear a staff member's profile photo ('' removes it).
app.patch('/api/admin/staff/:id/photo', requireAdmin, h(async (req, res) => {
  const staff = await dbGet('SELECT * FROM staff WHERE staff_id = $1', [req.params.id])
  if (!staff) return res.status(404).json({ error: 'Staff not found' })
  const photo = normalizePhoto(req.body?.photo_url)
  if (!photo.ok) return res.status(400).json({ error: 'Invalid photo — upload a JPG/PNG under 4 MB.' })
  await dbRun('UPDATE staff SET photo_url = $1 WHERE staff_id = $2', [photo.value, staff.staff_id])
  await logAdminAction(req, 'staff_photo_update', 'staff', staff.staff_id)
  res.json(await dbGet('SELECT * FROM staff WHERE staff_id = $1', [staff.staff_id]))
}))

app.get('/api/admin/schedule', requireAdmin, h(async (_req, res) => {
  const schedules = await dbAll(
    'SELECT sc.*, st.full_name AS staff_name, st.role AS staff_role FROM staff_schedules sc JOIN staff st ON st.staff_id = sc.staff_id ORDER BY st.full_name, sc.day_of_week'
  )
  res.json(schedules)
}))

app.post('/api/admin/schedule', requireAdmin, h(async (req, res) => {
  const { staff_id, day_of_week, start_time, end_time, is_available } = req.body || {}
  if (!staff_id || day_of_week === undefined || !start_time || !end_time) return res.status(400).json({ error: 'staff, day_of_week, start_time and end_time are required' })
  const { rows } = await dbRun(
    'INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, $5) RETURNING schedule_id',
    [staff_id, day_of_week, start_time, end_time, is_available === false ? 0 : 1]
  )
  res.status(201).json(await dbGet('SELECT * FROM staff_schedules WHERE schedule_id = $1', [rows[0].schedule_id]))
}))

app.delete('/api/admin/schedule/:id', requireAdmin, h(async (req, res) => {
  await dbRun('DELETE FROM staff_schedules WHERE schedule_id = $1', [req.params.id])
  res.json({ ok: true })
}))

app.post('/api/admin/walkin', requireAdmin, h(async (req, res) => {
  const { owner, pet, booking } = req.body || {}
  if (!owner?.full_name || !owner?.phone) return res.status(400).json({ error: 'Owner name and phone are required for walk-ins' })
  if (owner.email && !isValidEmail(owner.email)) return res.status(400).json({ error: 'Please enter a valid email address' })
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

app.get('/api/admin/analytics', requireAdmin, h(async (_req, res) => {
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

// Staff schedule: read-only view for any staff member (admin or regular).
app.get('/api/staff/schedule', requireStaff, h(async (req, res) => {
  const schedules = await dbAll(
    'SELECT sc.*, st.full_name AS staff_name, st.role AS staff_role FROM staff_schedules sc JOIN staff st ON st.staff_id = sc.staff_id ORDER BY st.full_name, sc.day_of_week'
  )
  res.json(schedules)
}))

// Staff bookings: only bookings assigned to this staff member.
app.get('/api/staff/bookings', requireStaff, h(async (req, res) => {
  const { status, date, q } = req.query
  const where = ['b.staff_id = $1']
  const params = [req.staff.staff_id]
  if (status) { params.push(status); where.push(`b.status = $${params.length}`) }
  if (date) { params.push(date); where.push(`b.booking_date = $${params.length}`) }
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    where.push(`(o.full_name LIKE $${i} OR p.name LIKE $${i} OR b.reference_code LIKE $${i})`)
  }
  const sql = BOOKING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY b.booking_date, b.booking_time'
  res.json(await dbAll(sql, params))
}))

// Staff booking detail: view a single booking assigned to this staff member.
app.get('/api/staff/bookings/:id', requireStaff, h(async (req, res) => {
  const booking = await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1 AND b.staff_id = $2', [req.params.id, req.staff.staff_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  const records = await dbAll(
    'SELECT mr.*, st.full_name AS staff_name FROM medical_records mr LEFT JOIN staff st ON st.staff_id = mr.staff_id WHERE mr.booking_id = $1',
    [booking.booking_id]
  )
  res.json({ booking, records: records.map(decorateRecord) })
}))

// Staff booking actions: status transitions (confirm, complete, no-show) for
// bookings assigned to this staff member.
app.patch('/api/staff/bookings/:id', requireStaff, h(async (req, res) => {
  const booking = await dbGet('SELECT * FROM bookings WHERE booking_id = $1 AND staff_id = $2', [req.params.id, req.staff.staff_id])
  if (!booking) return res.status(404).json({ error: 'Booking not found or not assigned to you' })
  const { status } = req.body || {}
  if (!status) return res.status(400).json({ error: 'status is required' })
  if (!TRANSITIONS[booking.status]?.includes(status)) return res.status(400).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
  await dbRun('UPDATE bookings SET status = $1 WHERE booking_id = $2', [status, booking.booking_id])
  await logBookingStatus(booking.booking_id, booking.status, status, req, req.body?.note || null)
  if (status === 'confirmed') {
    const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
    const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
    await sendEmail(owner, 'confirmation', `Booking confirmed — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nGreat news — your booking is confirmed!\n\n${bookingSummary(full)}\n\nWe look forward to seeing you and ${full.pet_name}.\n\n— PetVibe Care 🐾`, booking.booking_id)
  }
  if (status === 'completed') {
    const existing = await dbGet('SELECT 1 FROM medical_records WHERE booking_id = $1', [booking.booking_id])
    if (!existing) {
      await dbRun(
        `INSERT INTO medical_records (pet_id, booking_id, visit_date, staff_id, diagnosis, treatment_notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [booking.pet_id, booking.booking_id, booking.booking_date, req.staff.staff_id, 'Completed visit', null]
      )
    }
  }
  if (status === 'no_show') {
    const full = await dbGet(BOOKING_EMAIL_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id])
    const owner = await dbGet('SELECT * FROM owners WHERE owner_id = $1', [booking.owner_id])
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const t = tomorrow.toISOString().slice(0, 10)
    await sendEmail(owner, 'rebooking', `Rebooking options — ${booking.reference_code}`, `Hi ${owner.full_name},\n\nUnfortunately your appointment was marked as a no-show, so the slot has been released.\n\n${bookingSummary(full)}\n\nYou're welcome to rebook — ${fmtLongDate(t)} at 10:00, 14:00, or 16:00.\n\n— PetVibe Care 🐾`, booking.booking_id)
  }
  res.json(await dbGet(BOOKING_SELECT + ' WHERE b.booking_id = $1', [booking.booking_id]))
}))

// Staff in-app notifications. Only rows addressed to this staff member are
// returned — client-targeted rows (owner_id set, staff_id NULL) must never
// leak into the admin feed. LEFT JOIN keeps owner info on rows where it
// exists, and drops nothing else.
app.get('/api/admin/notifications', requireStaff, h(async (req, res) => {
  const notifications = await dbAll(
    `SELECT n.*, o.full_name AS owner_name, o.email AS owner_email
     FROM notifications n LEFT JOIN owners o ON o.owner_id = n.owner_id
     WHERE n.staff_id = $1
     ORDER BY n.sent_at DESC, n.notification_id DESC LIMIT 30`,
    [req.staff.staff_id]
  )
  res.json({ notifications, unread: notifications.filter((n) => !n.read_at).length })
}))

app.post('/api/admin/notifications/read', requireStaff, h(async (req, res) => {
  await dbRun(
    'UPDATE notifications SET read_at = NOW() WHERE staff_id = $1 AND read_at IS NULL',
    [req.staff.staff_id]
  )
  res.json({ ok: true })
}))

// ---------------- admin: printable reports ----------------
app.get('/api/admin/reports/appointments', requireAdmin, h(async (req, res) => {
  const { from, to, staff } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' })
  const where = ['b.booking_date >= $1', 'b.booking_date <= $2']
  const params = [from, to]
  if (staff) { params.push(staff); where.push(`b.staff_id = $${params.length}`) }
  const rows = await dbAll(BOOKING_SELECT + ' WHERE ' + where.join(' AND ') + ' ORDER BY b.booking_date, b.booking_time', params)
  res.json({ from, to, staff: staff || null, rows })
}))

app.get('/api/admin/reports/pet/:id/medical', requireAdmin, h(async (req, res) => {
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

app.get('/api/admin/reports/analytics', requireAdmin, h(async (req, res) => {
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
  // Body-parser errors carry a status (413 payload too large, 400 bad JSON);
  // everything else is an unexpected 500. Always returning 500 here made
  // oversized photo uploads look like server crashes instead of client errors.
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error(err)
  const message = status === 413 ? 'Upload is too large — max 8 MB.' : (err.message || 'Server error')
  res.status(status).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`PetVibe API listening on http://localhost:${PORT}`)
  console.log(emailConfigured
    ? '[email] Gmail sending ENABLED'
    : '[email] Gmail not configured — emails are simulated (set GMAIL_USER/GMAIL_APP_PASSWORD in .env)')
})
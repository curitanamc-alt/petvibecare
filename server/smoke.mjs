const BASE = 'http://localhost:3001/api'
const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.method ? { method: opts.method } : {}),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
}

// public
const services = await j('/services')
check('GET /services', services.status === 200 && Array.isArray(services.body) && services.body.length > 0, `${services.body?.length} services`)
const bundles = await j('/bundles')
check('GET /bundles', bundles.status === 200 && bundles.body.length === 4)

// client auth
const cl = await j('/auth/login', { method: 'POST', body: { email: 'client@petvibe.ph', password: 'password123' } })
check('client login', cl.status === 200 && cl.body.role === 'client')
const ct = cl.body.token
const me = await j('/me', { token: ct })
check('GET /me', me.status === 200 && me.body.pets.length === 2, `${me.body.pets.length} pets`)

// booking flow: pick tomorrow, first free client-bookable service, own pet
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const bookable = services.body.find((s) => s.client_bookable)
const slot = await j('/slots?date=' + tomorrow)
const free = slot.body.slots.find((t) => !slot.body.taken.includes(t))
const bk = await j('/bookings', { method: 'POST', token: ct, body: { pet_id: me.body.pets[0].pet_id, service_id: bookable.service_id, booking_date: tomorrow, booking_time: free, notes: 'smoke test' } })
check('create booking', bk.status === 201 && /^PV-\d+$/.test(bk.body.reference_code), bk.body.reference_code)
const dup = await j('/bookings', { method: 'POST', token: ct, body: { pet_id: me.body.pets[0].pet_id, service_id: bookable.service_id, booking_date: tomorrow, booking_time: free } })
check('duplicate slot rejected', dup.status === 409)

// client cannot book admin-only service
const surgery = services.body.find((s) => s.category === 'Veterinary Surgery' && !s.client_bookable)
const denied = await j('/bookings', { method: 'POST', token: ct, body: { pet_id: me.body.pets[0].pet_id, service_id: surgery.service_id, booking_date: tomorrow, booking_time: '16:00' } })
check('admin-only service blocked for client', denied.status === 403)

// suspended client is blocked at login (403), even with a valid password
const susp = await j('/auth/login', { method: 'POST', body: { email: 'ramon.b@example.com', password: 'password123' } })
check('suspended client blocked', susp.status === 403)

// admin auth + stats + actions
const ad = await j('/auth/login', { method: 'POST', body: { email: 'admin@petvibe.ph', password: 'password123' } })
check('admin login', ad.status === 200 && ad.body.role === 'admin')
const at = ad.body.token
const stats = await j('/admin/stats', { token: at })
check('admin stats', stats.status === 200 && typeof stats.body.totalPets === 'number')
const bookings = await j('/admin/bookings', { token: at })
check('admin bookings list', bookings.status === 200 && bookings.body.length >= 8)
const pending = bookings.body.find((b) => b.status === 'pending')
const updated = await j(`/admin/bookings/${pending.booking_id}`, { method: 'PATCH', token: at, body: { status: 'confirmed' } })
check('confirm pending booking', updated.status === 200 && updated.body.status === 'confirmed')
const noShow = await j(`/admin/bookings/${updated.body.booking_id}`, { method: 'PATCH', token: at, body: { status: 'no_show' } })
check('mark no_show (rebooking email)', noShow.status === 200 && noShow.body.status === 'no_show')

// walk-in flow
const walkin = await j('/admin/walkin', { method: 'POST', token: at, body: { owner: { full_name: 'Test Walk-in', phone: '0999 000 1111' }, pet: { name: 'Rex', species: 'dog', breed: 'Aspin' }, booking: { service_id: surgery.service_id, booking_date: tomorrow, booking_time: '16:00' } } })
check('walk-in booking', walkin.status === 201 && /^PV-\d+$/.test(walkin.body.reference_code), walkin.body.reference_code)

// medical record
const pets = await j('/admin/pets', { token: at })
const rec = await j(`/admin/pets/${pets.body[0].pet_id}/records`, { method: 'POST', token: at, body: { visit_date: tomorrow, diagnosis: 'Test', treatment_notes: 'ok' } })
check('add medical record', rec.status === 201)

const analytics = await j('/admin/analytics', { token: at })
check('analytics', analytics.status === 200 && analytics.body.bookingsByDay.length === 14)

console.log(results.join('\n'))
const failed = results.filter((r) => r.startsWith('FAIL'))
process.exit(failed.length ? 1 : 0)

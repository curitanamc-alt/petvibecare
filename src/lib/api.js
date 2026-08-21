import { mockRequest } from './mockdb.js'

const TOKEN_KEY = 'pv_token'
const ROLE_KEY = 'pv_role'
const USER_KEY = 'pv_user'
const MOCK_KEY = 'pv_mock'

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) },
  get role() { return localStorage.getItem(ROLE_KEY) },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  },
  set({ token, role, user }) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(ROLE_KEY, role)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USER_KEY)
  },
  get mock() { return localStorage.getItem(MOCK_KEY) === '1' },
  setMock(v) {
    if (v) localStorage.setItem(MOCK_KEY, '1')
    else localStorage.removeItem(MOCK_KEY)
  },
}

// Mock mode is on when explicitly forced (?mock=1) or when a previous probe
// found the server unreachable (stored flag). We always re-probe (unless
// forced) so the app recovers automatically once the server comes back up
// instead of staying stuck in demo mode forever.
const forcedMock = new URLSearchParams(location.search).get('mock') === '1'
let mockMode = session.mock || forcedMock

if (!forcedMock) {
  const probe = new AbortController()
  const probeTimer = setTimeout(() => probe.abort(), 1500) // 1.5s max
  fetch('/api/demo-accounts', { signal: probe.signal })
    .then((r) => {
      clearTimeout(probeTimer)
      if (r.ok) {
        // Server is reachable — prefer live mode and drop any stale mock flag
        if (mockMode) {
          mockMode = false
          session.setMock(false)
        }
      } else if (r.status >= 500) {
        mockMode = true
        session.setMock(true)
      }
    })
    .catch(() => {
      clearTimeout(probeTimer)
      // Server unreachable — switch to mock immediately
      mockMode = true
      session.setMock(true)
    })
}

async function request(method, path, body, token) {
  // Resolve the token up front so both live and mock requests authenticate
  // the same way (mock previously dropped it, causing 401s on every authed call)
  const tk = token ?? session.token
  if (mockMode) return mockRequest(method, path, body, tk)

  const headers = { 'Content-Type': 'application/json' }
  if (tk) headers.Authorization = `Bearer ${tk}`

  const controller = new AbortController()
  // Uploads (base64 photo data URLs) need more time than a 3 s round-trip,
  // especially over a slower connection — aborting would silently fall back
  // to mock mode and the photo would never reach the DB.
  const timer = setTimeout(() => controller.abort(), body ? 20000 : 3000)

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    return fallbackToMock(method, path, body, tk)
  }
  clearTimeout(timer)

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // Only fall back to mock when the server is truly unreachable (fetch threw
    // above). A reachable server answering with an error means the operation
    // failed for real — silently switching to demo mode masks the cause (an
    // oversized upload used to become a confusing mock "Not logged in").
    const e = new Error(data?.error || `Request failed (${res.status})`)
    e.status = res.status
    throw e
  }
  return data
}

function fallbackToMock(method, path, body, token) {
  console.warn('PetVibe API unreachable — switching to built-in demo mode (mock data).')
  mockMode = true
  session.setMock(true)
  return mockRequest(method, path, body, token)
}

const get = (p) => request('GET', p)
const post = (p, b) => request('POST', p, b)
const put = (p, b) => request('PUT', p, b)
const patch = (p, b) => request('PATCH', p, b)
const del = (p) => request('DELETE', p)

export const api = {
  // auth
  register: (data) => post('/auth/register', data),
  login: (data) => post('/auth/login', data),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),
  demoAccounts: () => get('/demo-accounts'),
  setMockMode: (v) => { session.setMock(v); mockMode = v },

  // public
  services: (params = '') => get('/services' + params),
  categories: () => get('/services/categories'),
  bundles: () => get('/bundles'),
  team: () => get('/team'),
  slots: (date) => get(`/slots?date=${date}`),

  // client
  myProfile: () => get('/me'),
  updateProfile: (data) => put('/me', data),
  changePassword: (data) => patch('/me/password', data),
  myPets: () => get('/me'),
  createPet: (data) => post('/pets', data),
  updatePet: (id, data) => put(`/pets/${id}`, data),
  deletePet: (id) => del(`/pets/${id}`),
  petRecords: (id) => get(`/pets/${id}/records`),
  myBookings: () => get('/bookings'),
  createBooking: (data) => post('/bookings', data),
  cancelBooking: (id) => post(`/bookings/${id}/cancel`),
  requestReschedule: (id, data) => post(`/bookings/${id}/reschedule-request`, data),
  cancelRescheduleRequest: (id, reqId) => del(`/bookings/${id}/reschedule-request/${reqId}`),
  bookingHistory: (id) => get(`/bookings/${id}/history`),
  myNotifications: () => get('/notifications'),
  markNotificationsRead: () => post('/notifications/read'),

  // admin
  adminServices: () => get('/admin/services'),
  adminCreateService: (data) => post('/admin/services', data),
  adminUpdateService: (id, data) => patch(`/admin/services/${id}`, data),
  adminToggleService: (id) => patch(`/admin/services/${id}/toggle`),
  adminStats: () => get('/admin/stats'),
  adminBookings: (params = '') => get('/admin/bookings' + params),
  staffBookings: (params = '') => get('/staff/bookings' + params),
  staffBooking: (id) => get(`/staff/bookings/${id}`),
  staffUpdateBooking: (id, data) => patch(`/staff/bookings/${id}`, data),
  adminBooking: (id) => get(`/admin/bookings/${id}`),
  updateBooking: (id, data) => patch(`/admin/bookings/${id}`, data),
  adminCreateBooking: (data) => post('/admin/bookings', data),
  adminPets: (params = '') => get('/admin/pets' + params),
  adminPet: (id) => get(`/admin/pets/${id}`),
  adminUpdatePetPhoto: (id, photo_url) => patch(`/admin/pets/${id}/photo`, { photo_url }),
  adminAddRecord: (petId, data) => post(`/admin/pets/${petId}/records`, data),
  adminStaff: () => get('/admin/staff'),
  adminCreateStaff: (data) => post('/admin/staff', data),
  adminToggleStaff: (id) => patch(`/admin/staff/${id}/toggle`),
  adminUpdateStaffPhoto: (id, photo_url) => patch(`/admin/staff/${id}/photo`, { photo_url }),
  adminSchedule: () => get('/admin/schedule'),
  adminAddSchedule: (data) => post('/admin/schedule', data),
  adminDeleteSchedule: (id) => del(`/admin/schedule/${id}`),
  adminWalkIn: (data) => post('/admin/walkin', data),
  adminAnalytics: () => get('/admin/analytics'),
  adminNotifications: () => get('/admin/notifications'),
  adminMarkNotificationsRead: () => post('/admin/notifications/read'),
  adminOwners: (params = '') => get('/admin/owners' + params),
  adminOwner: (id) => get(`/admin/owners/${id}`),
  adminUpdateOwner: (id, data) => patch(`/admin/owners/${id}`, data),
  adminSetOwnerStatus: (id, status) => patch(`/admin/owners/${id}/status`, { status }),
  adminResetOwnerPassword: (id) => post(`/admin/owners/${id}/reset-password`),
  adminDeleteOwner: (id) => del(`/admin/owners/${id}`),
  adminPetRecords: (id) => get(`/admin/pets/${id}/records`),
  adminUpdateRecord: (id, data) => patch(`/admin/records/${id}`, data),
  adminDeleteRecord: (id) => del(`/admin/records/${id}`),
  adminRescheduleBooking: (id, data) => patch(`/admin/bookings/${id}/reschedule`, data),
  adminAssignBooking: (id, staff_id) => patch(`/admin/bookings/${id}/assign`, { staff_id }),
  adminBookingHistory: (id) => get(`/admin/bookings/${id}/history`),
  adminRescheduleRequest: (id, reqId, action) => patch(`/admin/bookings/${id}/reschedule-request/${reqId}`, { action }),
  reports: (type, params = '') => get(`/admin/reports/${type}` + params),
}

export const fmtMoney = (s) => (s.price_max ? `₱${s.price_min.toLocaleString()}–${s.price_max.toLocaleString()}` : `₱${s.price_min.toLocaleString()}`)
export const fmtDate = (d) => {
  if (!d) return '—'
  const x = new Date(d + 'T00:00:00')
  return x.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
export const fmtDateShort = (d) => {
  if (!d) return '—'
  const x = new Date(d + 'T00:00:00')
  return x.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

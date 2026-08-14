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

let mockMode = session.mock || new URLSearchParams(location.search).get('mock') === '1'

async function request(method, path, body, token) {
  if (mockMode) return mockRequest(method, path, body, token)
  const headers = { 'Content-Type': 'application/json' }
  const tk = token ?? session.token
  if (tk) headers.Authorization = `Bearer ${tk}`
  let res
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    return fallbackToMock(method, path, body, tk)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status >= 500) {
      // backend down or crashed (dev proxy surfaces this as 500) — fall back to demo mode
      return fallbackToMock(method, path, body, tk)
    }
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
  myPets: () => get('/me'),
  createPet: (data) => post('/pets', data),
  updatePet: (id, data) => put(`/pets/${id}`, data),
  deletePet: (id) => del(`/pets/${id}`),
  petRecords: (id) => get(`/pets/${id}/records`),
  myBookings: () => get('/bookings'),
  createBooking: (data) => post('/bookings', data),

  // admin
  adminStats: () => get('/admin/stats'),
  adminBookings: (params = '') => get('/admin/bookings' + params),
  adminBooking: (id) => get(`/admin/bookings/${id}`),
  updateBooking: (id, data) => patch(`/admin/bookings/${id}`, data),
  adminCreateBooking: (data) => post('/admin/bookings', data),
  adminPets: (params = '') => get('/admin/pets' + params),
  adminPet: (id) => get(`/admin/pets/${id}`),
  adminAddRecord: (petId, data) => post(`/admin/pets/${petId}/records`, data),
  adminStaff: () => get('/admin/staff'),
  adminCreateStaff: (data) => post('/admin/staff', data),
  adminToggleStaff: (id) => patch(`/admin/staff/${id}/toggle`),
  adminSchedule: () => get('/admin/schedule'),
  adminAddSchedule: (data) => post('/admin/schedule', data),
  adminDeleteSchedule: (id) => del(`/admin/schedule/${id}`),
  adminWalkIn: (data) => post('/admin/walkin', data),
  adminAnalytics: () => get('/admin/analytics'),
  adminNotifications: () => get('/admin/notifications'),
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

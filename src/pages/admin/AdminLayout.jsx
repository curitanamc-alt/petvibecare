import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { api } from '../../lib/api.js'
import { Logo, Avatar, StatusPill, cx } from '../../components/ui.jsx'
import NotificationsBell from '../../components/NotificationsBell.jsx'

const NAV_ADMIN = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { to: '/admin/pets', label: 'Customer Pets', icon: '🐾' },
  { to: '/admin/clients', label: 'Clients', icon: '👥' },
  { to: '/admin/services', label: 'Services', icon: '🩺' },
  { to: '/admin/reports', label: 'Reports', icon: '📄' },
  { to: '/admin/schedule', label: 'Staff Schedule', icon: '🕐' },
  { to: '/admin/staff', label: 'Team', icon: '🧑‍⚕️' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { to: '/admin/walkin', label: 'Walk-in / ER', icon: '🚪' },
]

const NAV_STAFF = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/appointments', label: 'My Appointments', icon: '📅' },
  { to: '/admin/pets', label: 'Customer Pets', icon: '🐾' },
  { to: '/admin/services', label: 'Services', icon: '🩺' },
  { to: '/admin/schedule', label: 'Staff Schedule', icon: '🕐' },
]

const BOTTOM_NAV_ADMIN = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { to: '/admin/pets', label: 'Pets', icon: '🐾' },
  { to: '/admin/clients', label: 'Clients', icon: '👥' },
]

const BOTTOM_NAV_STAFF = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { to: '/admin/pets', label: 'Pets', icon: '🐾' },
  { to: '/admin/schedule', label: 'Schedule', icon: '🕐' },
]

const item = ({ isActive }) =>
  cx(
    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200',
    isActive
      ? 'bg-amber-500 text-white shadow-md shadow-amber-900/20'
      : 'text-teal-100/70 hover:bg-white/10 hover:text-white',
  )

export default function AdminLayout() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const isAdmin = role === 'admin'
  const NAV = isAdmin ? NAV_ADMIN : NAV_STAFF
  const BOTTOM_NAV = isAdmin ? BOTTOM_NAV_ADMIN : BOTTOM_NAV_STAFF

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const submitSearch = (e) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/admin/appointments?q=${encodeURIComponent(q)}` : '/admin/appointments')
    setSearch('')
  }

  return (
    <div className="min-h-screen bg-sage-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal-900/40 backdrop-blur-sm"
          style={{ animation: 'fade-in 0.2s ease-out both' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-teal-700 via-teal-800 to-teal-900 max-lg:hidden">
        <SidebarContent user={user} logout={logout} navigate={navigate} nav={NAV} />
      </aside>

      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-teal-700 via-teal-800 to-teal-900 transition-transform duration-300 ease-out lg:hidden"
        style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <SidebarContent user={user} logout={logout} navigate={navigate} onNav={() => setSidebarOpen(false)} nav={NAV} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-sage-200/60 bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-4 px-5 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-charcoal-600 hover:bg-sage-100 transition-colors lg:hidden"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            {/* Search */}
            <form onSubmit={submitSearch} className="relative max-w-md flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search appointments, ref #, pet…"
                className="w-full rounded-xl border border-sage-200 bg-sage-50/60 py-2.5 pl-10 pr-4 text-sm text-charcoal-900 placeholder:text-charcoal-400 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/15"
              />
            </form>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-charcoal-500 sm:block">
                Welcome, <span className="font-semibold text-charcoal-900">{user?.full_name?.replace('Dr. ', '').split(' ')[0] || 'Staff'}</span>
              </span>
              <StatusPill tone={isAdmin ? 'amber' : 'teal'}>{isAdmin ? 'Admin' : 'Staff'}</StatusPill>
              <NotificationsBell
                fetchFn={api.adminNotifications}
                markReadFn={api.adminMarkNotificationsRead}
                emptyText="No notifications for you yet"
              />
              <Avatar name={user?.full_name} size="md" photoUrl={user?.photo_url} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-8 pb-24 sm:px-6 sm:py-10 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — frequent nav without the drawer */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sage-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {BOTTOM_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-teal-600' : 'text-charcoal-400 hover:text-teal-600',
                )
              }
            >
              <span className="text-lg leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-charcoal-400 transition-colors hover:text-teal-600"
          >
            <span className="text-lg leading-none">☰</span>
            More
          </button>
        </div>
      </nav>
    </div>
  )
}

function SidebarContent({ user, logout, navigate, onNav, nav }) {
  return (
    <>
      <div className="px-6 pb-6 pt-7">
        <Link to="/" className="transition-transform duration-200 hover:scale-[1.02]" onClick={onNav}>
          <Logo light small />
        </Link>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-teal-200/50">Staff workspace</p>
      </div>

      <nav className="flex-1 space-y-1.5 px-3.5">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={item} onClick={onNav}>
            <span className="text-base">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3.5 pb-5 pt-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3.5 py-3">
          <Avatar name={user?.full_name} size="sm" className="bg-amber-500" photoUrl={user?.photo_url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
            <p className="truncate text-xs text-teal-200/60">{user?.specialization || 'Staff'}</p>
          </div>
        </div>
        <Link
          to="/"
          onClick={onNav}
          className="mb-2 block rounded-xl px-3.5 py-2 text-xs font-semibold text-teal-200/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          View public site →
        </Link>
        <button
          onClick={() => { logout(); navigate('/') }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-900/20 transition-colors hover:bg-amber-600"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
          </svg>
          Log out
        </button>
      </div>
    </>
  )
}

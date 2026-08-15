import { NavLink, Outlet, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { Logo } from '../../components/ui.jsx'

const tab = ({ isActive }) =>
  `flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? 'bg-teal-600 text-white shadow-sm'
      : 'text-charcoal-500 hover:bg-sage-100 hover:text-teal-700'
  }`

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="min-h-screen bg-sage-50/80">
      <header className="border-b border-sage-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-charcoal-600 hover:bg-sage-100 transition-colors lg:hidden"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <Link to="/" className="transition-transform duration-200 hover:scale-[1.02]">
              <Logo small />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-charcoal-400 sm:block">
              Hi, <span className="font-semibold text-charcoal-800">{user?.full_name?.split(' ')[0]}</span>
            </span>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-charcoal-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-charcoal-900/40 backdrop-blur-sm lg:hidden"
          style={{ animation: 'fade-in 0.2s ease-out both' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[260px_1fr] lg:px-8">
        <nav className="hidden gap-1.5 lg:flex lg:flex-col">
          <SidebarLinks onNav={() => {}} />
        </nav>

        <nav
          className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1.5 bg-white p-6 pt-20 shadow-elevated lg:hidden"
          style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease-out' }}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-5 right-5 rounded-lg p-2 text-charcoal-400 hover:bg-sage-100"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <SidebarLinks onNav={() => setSidebarOpen(false)} />
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function SidebarLinks({ onNav }) {
  return (
    <>
      <NavLink to="/portal" end className={tab} onClick={onNav}>
        <span className="text-base">🏠</span> Overview
      </NavLink>
      <NavLink to="/portal/pets" className={tab} onClick={onNav}>
        <span className="text-base">🐾</span> My Pets
      </NavLink>
      <NavLink to="/portal/bookings" className={tab} onClick={onNav}>
        <span className="text-base">📅</span> My Bookings
      </NavLink>
      <NavLink to="/portal/profile" className={tab} onClick={onNav}>
        <span className="text-base">👤</span> Profile
      </NavLink>
      <Link
        to="/book"
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:from-amber-600 hover:to-amber-600 active:scale-[0.97] lg:mt-10"
        onClick={onNav}
      >
        + Book appointment
      </Link>
    </>
  )
}

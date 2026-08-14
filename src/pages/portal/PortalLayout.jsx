import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { Logo } from '../../components/ui.jsx'

const tab = ({ isActive }) => `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-teal-600 text-white' : 'text-charcoal-600 hover:bg-sage-100'}`

export default function PortalLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen bg-sage-50">
      <header className="border-b border-sage-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/"><Logo small /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-charcoal-400 sm:block">Hi, <span className="font-semibold text-charcoal-900">{user?.full_name?.split(' ')[0]}</span></span>
            <button onClick={logout} className="text-sm font-semibold text-charcoal-400 hover:text-red-600">Log out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          <NavLink to="/portal" end className={tab}>🏠 Overview</NavLink>
          <NavLink to="/portal/pets" className={tab}>🐾 My Pets</NavLink>
          <NavLink to="/portal/bookings" className={tab}>📅 My Bookings</NavLink>
          <NavLink to="/portal/profile" className={tab}>👤 Profile</NavLink>
          <Link to="/book" className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-amber-600 lg:mt-6">+ Book appointment</Link>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

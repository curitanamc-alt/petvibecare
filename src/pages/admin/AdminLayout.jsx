import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth.jsx'
import { Logo } from '../../components/ui.jsx'

const item = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-teal-600 text-white' : 'text-teal-100/80 hover:bg-white/10 hover:text-white'}`

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: '🏠' },
  { to: '/admin/appointments', label: 'Appointments', icon: '📅' },
  { to: '/admin/pets', label: 'Customer Pets', icon: '🐾' },
  { to: '/admin/schedule', label: 'Staff Schedule', icon: '🕐' },
  { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { to: '/admin/walkin', label: 'Walk-in / ER', icon: '🚪' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-sage-50">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-teal-600">
        <div className="px-5 py-5"><Link to="/admin"><Logo light small /></Link></div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={item}>
              <span>{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold text-white">{user?.full_name}</p>
          <p className="text-xs capitalize text-teal-100/70">{user?.role} · {user?.specialization || 'Staff'}</p>
          <button onClick={() => { logout(); navigate('/') }} className="mt-3 w-full rounded-lg bg-white/10 py-2 text-sm font-semibold text-white hover:bg-white/20">Log out</button>
        </div>
      </aside>

      <div className="pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sage-200 bg-white px-6">
          <p className="text-sm font-semibold text-charcoal-400">PetVibe Care · Staff workspace</p>
          <Link to="/" className="text-sm font-semibold text-teal-600 hover:underline">View public site →</Link>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { Logo, Button } from './ui.jsx'

const navLink = ({ isActive }) =>
  `px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-sage-100 text-teal-700'
      : 'text-charcoal-500 hover:text-teal-600 hover:bg-sage-50'
  }`

export default function PublicLayout() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-sage-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link to="/" className="transition-transform duration-200 hover:scale-[1.02]">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1.5 md:flex">
            <NavLink to="/" end className={navLink}>Home</NavLink>
            <NavLink to="/services" className={navLink}>Services</NavLink>
            <NavLink to="/pricing" className={navLink}>Pricing</NavLink>
            <NavLink to="/bundles" className={navLink}>Bundles</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {role === 'admin' && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                    Dashboard
                  </Button>
                )}
                {role === 'client' && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/portal')}>
                    My Portal
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/') }}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Log in
                </Button>
                <Button size="sm" onClick={() => navigate('/book')}>
                  Book Now
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex gap-1.5 overflow-x-auto px-6 pb-3 md:hidden scrollbar-none">
          <NavLink to="/" end className={navLink}>Home</NavLink>
          <NavLink to="/services" className={navLink}>Services</NavLink>
          <NavLink to="/pricing" className={navLink}>Pricing</NavLink>
          <NavLink to="/bundles" className={navLink}>Bundles</NavLink>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="mt-28 bg-teal-800 text-teal-100">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-20 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <Logo light />
            <p className="mt-5 text-sm leading-relaxed text-teal-200/70">
              Warm, modern veterinary care for your furbabies — check-ups, grooming, surgery, and everything in between.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Visit Us</h4>
            <ul className="mt-5 space-y-3 text-sm text-teal-200/70">
              <li>123 Mabini St., Brgy. San Lorenzo</li>
              <li>Makati City, Metro Manila</li>
              <li>(02) 8123 4567</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Hours</h4>
            <ul className="mt-5 space-y-3 text-sm text-teal-200/70">
              <li>Mon – Sat: 9:00 AM – 6:00 PM</li>
              <li>Sunday: Closed</li>
              <li className="pt-2">
                <span className="inline-block rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300">
                  Emergency: walk in anytime during hours
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">Quick Links</h4>
            <ul className="mt-5 space-y-3 text-sm">
              <li><Link to="/services" className="text-teal-200/70 transition-colors hover:text-white">Services</Link></li>
              <li><Link to="/pricing" className="text-teal-200/70 transition-colors hover:text-white">Pricing</Link></li>
              <li><Link to="/bundles" className="text-teal-200/70 transition-colors hover:text-white">Bundles</Link></li>
              <li><Link to="/book" className="text-teal-200/70 transition-colors hover:text-white">Book an Appointment</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-6 text-center text-xs text-teal-300/50">
          © {new Date().getFullYear()} PetVibe Care Veterinary Clinic. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

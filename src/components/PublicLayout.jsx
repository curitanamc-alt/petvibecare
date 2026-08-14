import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { Logo, Button } from './ui.jsx'

const navLink = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-sage-100 text-teal-700' : 'text-charcoal-600 hover:text-teal-600'}`

export default function PublicLayout() {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-sage-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/"><Logo /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navLink}>Home</NavLink>
            <NavLink to="/services" className={navLink}>Services</NavLink>
            <NavLink to="/pricing" className={navLink}>Pricing</NavLink>
            <NavLink to="/bundles" className={navLink}>Bundles</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {role === 'staff' && <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>Dashboard</Button>}
                {role === 'client' && <Button variant="outline" size="sm" onClick={() => navigate('/portal')}>My Portal</Button>}
                <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/') }}>Log out</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button>
                <Button size="sm" onClick={() => navigate('/book')}>Book Now</Button>
              </>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          <NavLink to="/" end className={navLink}>Home</NavLink>
          <NavLink to="/services" className={navLink}>Services</NavLink>
          <NavLink to="/pricing" className={navLink}>Pricing</NavLink>
          <NavLink to="/bundles" className={navLink}>Bundles</NavLink>
        </nav>
      </header>

      <main><Outlet /></main>

      <footer className="mt-20 bg-teal-600 text-teal-100">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo light />
            <p className="mt-3 text-sm leading-relaxed text-teal-100/80">Warm, modern veterinary care for your furbabies — check-ups, grooming, surgery, and everything in between.</p>
          </div>
          <div>
            <h4 className="font-bold text-white">Visit Us</h4>
            <ul className="mt-3 space-y-2 text-sm text-teal-100/80">
              <li>123 Mabini St., Brgy. San Lorenzo</li>
              <li>Makati City, Metro Manila</li>
              <li>(02) 8123 4567</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white">Hours</h4>
            <ul className="mt-3 space-y-2 text-sm text-teal-100/80">
              <li>Mon – Sat: 9:00 AM – 6:00 PM</li>
              <li>Sunday: Closed</li>
              <li className="pt-1"><span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">Emergency: walk in anytime during hours</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-sm text-teal-100/80">
              <li><Link to="/services" className="hover:text-white">Services</Link></li>
              <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link to="/bundles" className="hover:text-white">Bundles</Link></li>
              <li><Link to="/book" className="hover:text-white">Book an Appointment</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-teal-100/10 py-4 text-center text-xs text-teal-100/60">
          © {new Date().getFullYear()} PetVibe Care Veterinary Clinic. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

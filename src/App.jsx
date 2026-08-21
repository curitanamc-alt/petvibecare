import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { Spinner } from './components/ui.jsx'
import { PageTransition } from './components/PageTransition.jsx'
import PublicLayout from './components/PublicLayout.jsx'
import Landing from './pages/Landing.jsx'
import Services from './pages/Services.jsx'
import Pricing from './pages/Pricing.jsx'
import Bundles from './pages/Bundles.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Book from './pages/Book.jsx'
import PortalLayout from './pages/portal/PortalLayout.jsx'
import PortalHome from './pages/portal/PortalHome.jsx'
import MyPets from './pages/portal/MyPets.jsx'
import PetDetail from './pages/portal/PetDetail.jsx'
import MyBookings from './pages/portal/MyBookings.jsx'
import Profile from './pages/portal/Profile.jsx'
import AdminLayout from './pages/admin/AdminLayout.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import Appointments from './pages/admin/Appointments.jsx'
import AdminServices from './pages/admin/Services.jsx'
import AdminPets from './pages/admin/AdminPets.jsx'
import AdminPetDetail from './pages/admin/AdminPetDetail.jsx'
import Clients from './pages/admin/Clients.jsx'
import ClientDetail from './pages/admin/ClientDetail.jsx'
import Reports from './pages/admin/Reports.jsx'
import Schedule from './pages/admin/Schedule.jsx'
import Staff from './pages/admin/Staff.jsx'
import Analytics from './pages/admin/Analytics.jsx'
import WalkIn from './pages/admin/WalkIn.jsx'
import StaffDashboard from './pages/admin/StaffDashboard.jsx'
import StaffAppointments from './pages/admin/StaffAppointments.jsx'

// Conditionally render admin or staff views based on role
function AdminOrStaff({ admin, staff }) {
  const { role } = useAuth()
  return role === 'staff' ? staff : admin
}

function RequireClient() {
  const { user, role, ready } = useAuth()
  if (!ready) return <div className="py-20"><Spinner /></div>
  if (!user || role !== 'client') return <Navigate to="/login?next=/portal" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user, role, ready } = useAuth()
  if (!ready) return <div className="py-20"><Spinner /></div>
  if (!user || role !== 'admin') return <Navigate to="/login?next=/admin" replace />
  return <Outlet />
}

function RequireStaff() {
  const { user, role, ready } = useAuth()
  if (!ready) return <div className="py-20"><Spinner /></div>
  if (!user || (role !== 'admin' && role !== 'staff')) return <Navigate to="/login?next=/admin" replace />
  return <Outlet />
}

// Wraps admin-only pages: staff users see a redirect to the dashboard.
function AdminOnly() {
  const { role } = useAuth()
  if (role === 'staff') return <Navigate to="/admin" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/services" element={<PageTransition><Services /></PageTransition>} />
        <Route path="/pricing" element={<PageTransition><Pricing /></PageTransition>} />
        <Route path="/bundles" element={<PageTransition><Bundles /></PageTransition>} />
        <Route path="/book" element={<PageTransition><Book /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
      </Route>

      <Route path="/portal" element={<RequireClient />}>
        <Route element={<PortalLayout />}>
          <Route index element={<PageTransition><PortalHome /></PageTransition>} />
          <Route path="pets" element={<PageTransition><MyPets /></PageTransition>} />
          <Route path="pets/:id" element={<PageTransition><PetDetail /></PageTransition>} />
          <Route path="bookings" element={<PageTransition><MyBookings /></PageTransition>} />
          <Route path="profile" element={<PageTransition><Profile /></PageTransition>} />
        </Route>
      </Route>

      {/* Staff + Admin routes — RequireStaff allows both roles */}
      <Route path="/admin" element={<RequireStaff />}>
        <Route element={<AdminLayout />}>
          <Route index element={<PageTransition><AdminOrStaff admin={<AdminHome />} staff={<StaffDashboard />} /></PageTransition>} />
          <Route path="appointments" element={<PageTransition><AdminOrStaff admin={<Appointments />} staff={<StaffAppointments />} /></PageTransition>} />
          <Route path="pets" element={<PageTransition><AdminPets /></PageTransition>} />
          <Route path="pets/:id" element={<PageTransition><AdminPetDetail /></PageTransition>} />
          <Route path="schedule" element={<PageTransition><Schedule /></PageTransition>} />
          <Route path="services" element={<PageTransition><AdminServices /></PageTransition>} />
          {/* Admin-only pages wrapped with AdminOnly */}
          <Route element={<AdminOnly />}>
            <Route path="clients" element={<PageTransition><Clients /></PageTransition>} />
            <Route path="clients/:id" element={<PageTransition><ClientDetail /></PageTransition>} />
            <Route path="reports" element={<PageTransition><Reports /></PageTransition>} />
            <Route path="staff" element={<PageTransition><Staff /></PageTransition>} />
            <Route path="analytics" element={<PageTransition><Analytics /></PageTransition>} />
            <Route path="walkin" element={<PageTransition><WalkIn /></PageTransition>} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

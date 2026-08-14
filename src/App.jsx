import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { Spinner } from './components/ui.jsx'
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
import AdminPets from './pages/admin/AdminPets.jsx'
import AdminPetDetail from './pages/admin/AdminPetDetail.jsx'
import Schedule from './pages/admin/Schedule.jsx'
import Analytics from './pages/admin/Analytics.jsx'
import WalkIn from './pages/admin/WalkIn.jsx'

function RequireClient() {
  const { user, role, ready } = useAuth()
  if (!ready) return <div className="py-20"><Spinner /></div>
  if (!user || role !== 'client') return <Navigate to="/login?next=/portal" replace />
  return <Outlet />
}

function RequireStaff() {
  const { user, role, ready } = useAuth()
  if (!ready) return <div className="py-20"><Spinner /></div>
  if (!user || role !== 'staff') return <Navigate to="/login?next=/admin" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/services" element={<Services />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/bundles" element={<Bundles />} />
        <Route path="/book" element={<Book />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/portal" element={<RequireClient />}>
        <Route element={<PortalLayout />}>
          <Route index element={<PortalHome />} />
          <Route path="pets" element={<MyPets />} />
          <Route path="pets/:id" element={<PetDetail />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="/admin" element={<RequireStaff />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="pets" element={<AdminPets />} />
          <Route path="pets/:id" element={<AdminPetDetail />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="walkin" element={<WalkIn />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

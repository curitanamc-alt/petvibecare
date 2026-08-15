import { useEffect, useState } from 'react'
import { api, fmtDate } from '../../lib/api.js'
import { Button, Card, Field, Input, Select } from '../../components/ui.jsx'
import MedicalReportPrint from '../../components/MedicalReportPrint.jsx'

const isoDaysAgo = (n) => {
  const x = new Date()
  x.setDate(x.getDate() - n)
  return x.toISOString().slice(0, 10)
}

const REPORT_TYPES = [
  { value: 'appointments', label: '📅 Daily / weekly appointment schedule' },
  { value: 'medical', label: '🩺 Pet medical record summary' },
  { value: 'analytics', label: '📊 Analytics summary' },
]

const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show', rebooked: 'Rebooked' }

export default function Reports() {
  const [type, setType] = useState('appointments')
  const [from, setFrom] = useState(isoDaysAgo(6))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [staff, setStaff] = useState([])
  const [staffId, setStaffId] = useState('')
  const [pets, setPets] = useState([])
  const [petId, setPetId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.adminStaff().then(setStaff).catch(() => {})
    api.adminPets().then(setPets).catch(() => {})
  }, [])

  const generate = async () => {
    if (!from || !to) { setError('Pick a date range.'); return }
    if (type === 'medical' && !petId) { setError('Pick a pet.'); return }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from, to })
      if (type === 'appointments' && staffId) params.set('staff', staffId)
      const res = type === 'appointments'
        ? await api.reports('appointments', '?' + params.toString())
        : type === 'medical'
          ? await api.reports(`pet/${petId}/medical`)
          : await api.reports('analytics', '?' + params.toString())
      setData(res)
      // give the DOM a tick to render before printing on first generate
      requestAnimationFrame(() => window.scrollTo(0, 0))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Reports</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">Generate print-friendly schedules, medical summaries, and analytics — then print or save as PDF.</p>
      </div>

      <Card className="p-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Report type">
            <Select value={type} onChange={(e) => { setType(e.target.value); setData(null) }}>
              {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {type === 'appointments' ? (
            <Field label="Staff (optional)">
              <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="">All staff</option>
                {staff.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>)}
              </Select>
            </Field>
          ) : type === 'medical' ? (
            <Field label="Pet">
              <Select value={petId} onChange={(e) => setPetId(e.target.value)}>
                <option value="">Select pet…</option>
                {pets.map((p) => <option key={p.pet_id} value={p.pet_id}>{p.name} ({p.owner_name})</option>)}
              </Select>
            </Field>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="accent" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate report'}</Button>
          {data && (
            <Button variant="outline" onClick={() => window.print()}>
              🖨️ Print / Save as PDF
            </Button>
          )}
        </div>
      </Card>

      {/* ── Generated report (print-area) ── */}
      {data && (
        <div className="print-area">
          {type === 'appointments' && <AppointmentReport data={data} generatedAt={generatedAt} />}
          {type === 'medical' && <MedicalReport data={data} generatedAt={generatedAt} />}
          {type === 'analytics' && <AnalyticsReport data={data} generatedAt={generatedAt} />}
        </div>
      )}
    </div>
  )
}

function ReportHeader({ title, subtitle, generatedAt }) {
  return (
    <div className="mb-6 border-b-2 border-charcoal-900 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-charcoal-400">PetVibe Care · Veterinary Clinic</p>
          <h2 className="mt-1 text-2xl font-extrabold text-charcoal-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-charcoal-500">{subtitle}</p>}
        </div>
        <p className="text-xs text-charcoal-400">Generated {generatedAt}</p>
      </div>
    </div>
  )
}

function ReportTable({ headers, children }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} className="border-b-2 border-charcoal-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-charcoal-700">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function AppointmentReport({ data, generatedAt }) {
  const staffName = data.staff ? data.rows.find((r) => r.staff_id === Number(data.staff))?.staff_name : null
  return (
    <div className="print-report rounded-2xl border border-sage-200 bg-white p-8 shadow-card">
      <ReportHeader
        title="Appointment schedule"
        subtitle={`${fmtDate(data.from)} – ${fmtDate(data.to)}${staffName ? ` · ${staffName}` : ' · all staff'}`}
        generatedAt={generatedAt}
      />
      <p className="mb-4 text-sm text-charcoal-600">{data.rows.length} appointment{data.rows.length === 1 ? '' : 's'} in range.</p>
      {data.rows.length === 0 ? (
        <p className="py-10 text-center text-charcoal-400">No appointments in this range.</p>
      ) : (
        <ReportTable headers={['Date', 'Time', 'Pet', 'Owner', 'Service', 'Staff', 'Status']}>
          {data.rows.map((b) => (
            <tr key={b.booking_id} className="border-b border-sage-100">
              <td className="whitespace-nowrap px-3 py-2.5">{fmtDate(b.booking_date)}</td>
              <td className="px-3 py-2.5">{b.booking_time}</td>
              <td className="px-3 py-2.5 font-semibold">{b.pet_name}</td>
              <td className="px-3 py-2.5">{b.owner_name}</td>
              <td className="px-3 py-2.5">{b.service_name}</td>
              <td className="px-3 py-2.5">{b.staff_name || 'Unassigned'}</td>
              <td className="px-3 py-2.5 capitalize">{STATUS_LABEL[b.status] || b.status}</td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  )
}

function MedicalReport({ data, generatedAt }) {
  return <MedicalReportPrint pet={data.pet} records={data.records} generatedAt={generatedAt} />
}

function AnalyticsReport({ data, generatedAt }) {
  return (
    <div className="print-report rounded-2xl border border-sage-200 bg-white p-8 shadow-card">
      <ReportHeader title="Analytics summary" subtitle={`${fmtDate(data.from)} – ${fmtDate(data.to)}`} generatedAt={generatedAt} />
      <div className="mb-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        {[
          ['Total bookings', String(data.totalBookings)],
          ['Est. revenue', `₱${Number(data.revenue || 0).toLocaleString()}`],
          ['Services booked', String(data.bookingsByService?.length || 0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-sage-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">{k}</p>
            <p className="mt-1 text-lg font-extrabold text-teal-600">{v}</p>
          </div>
        ))}
      </div>

      <h3 className="mb-3 font-bold text-charcoal-900">Bookings by service</h3>
      {data.bookingsByService?.length ? (
        <ReportTable headers={['Service', 'Category', 'Bookings', 'Est. revenue']}>
          {data.bookingsByService.map((s) => (
            <tr key={s.name} className="border-b border-sage-100">
              <td className="px-3 py-2.5 font-semibold">{s.name}</td>
              <td className="px-3 py-2.5">{s.category}</td>
              <td className="px-3 py-2.5">{s.bookings}</td>
              <td className="px-3 py-2.5">₱{Number(s.revenue || 0).toLocaleString()}</td>
            </tr>
          ))}
        </ReportTable>
      ) : <p className="mb-6 text-sm text-charcoal-400">No bookings in this range.</p>}

      <h3 className="mb-3 mt-8 font-bold text-charcoal-900">Top clients</h3>
      {data.topClients?.length ? (
        <ReportTable headers={['#', 'Client', 'Phone', 'Bookings']}>
          {data.topClients.map((c, i) => (
            <tr key={c.full_name + i} className="border-b border-sage-100">
              <td className="px-3 py-2.5">{i + 1}</td>
              <td className="px-3 py-2.5 font-semibold">{c.full_name}</td>
              <td className="px-3 py-2.5">{c.phone || '—'}</td>
              <td className="px-3 py-2.5">{c.bookings}</td>
            </tr>
          ))}
        </ReportTable>
      ) : <p className="text-sm text-charcoal-400">No clients in this range.</p>}

      {(data.statusBreakdown?.length || 0) > 0 && (
        <>
          <h3 className="mb-3 mt-8 font-bold text-charcoal-900">Status breakdown</h3>
          <ReportTable headers={['Status', 'Count']}>
            {data.statusBreakdown.map((s) => (
              <tr key={s.status} className="border-b border-sage-100">
                <td className="px-3 py-2.5 capitalize">{STATUS_LABEL[s.status] || s.status}</td>
                <td className="px-3 py-2.5">{s.n}</td>
              </tr>
            ))}
          </ReportTable>
        </>
      )}
    </div>
  )
}

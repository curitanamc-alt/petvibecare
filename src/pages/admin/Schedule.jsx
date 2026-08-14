import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Button, Card, Field, Input, Modal, Select, Spinner } from '../../components/ui.jsx'

const DAYS = [
  { n: 0, label: 'Sun' }, { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' },
]

export default function Schedule() {
  const [staff, setStaff] = useState([])
  const [schedules, setSchedules] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ staff_id: '', day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: true })

  const load = () => Promise.all([api.adminStaff(), api.adminSchedule()]).then(([s, sc]) => { setStaff(s); setSchedules(sc) }).catch(() => {})
  useEffect(() => { load() }, [])

  if (!schedules) return <Spinner label="Loading schedules…" />

  const byStaffDay = {}
  for (const sc of schedules) byStaffDay[`${sc.staff_id}:${sc.day_of_week}`] = sc

  const add = async () => {
    if (!form.staff_id) return
    await api.adminAddSchedule(form)
    setAdding(false)
    setForm({ staff_id: '', day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: true })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Staff Schedule</h1>
          <p className="text-sm text-charcoal-400">Set weekly working hours per vet and groomer. Sunday is clinic-closed.</p>
        </div>
        <Button onClick={() => setAdding(true)}>+ Add shift</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-sage-200 bg-sage-50 text-xs font-bold uppercase tracking-wide text-charcoal-400">
              <th className="px-4 py-3">Staff</th>
              {DAYS.map((d) => <th key={d.n} className="px-3 py-3 text-center">{d.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.staff_id} className="border-b border-sage-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-charcoal-900">{s.full_name}</p>
                  <p className="text-xs capitalize text-charcoal-400">{s.role}{s.specialization ? ` · ${s.specialization}` : ''}</p>
                  <button
                    onClick={async () => { await api.adminToggleStaff(s.staff_id); load() }}
                    className={`mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.active ? 'bg-sage-100 text-teal-700 hover:bg-sage-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {s.active ? 'Active' : 'Inactive'} — toggle
                  </button>
                </td>
                {DAYS.map((d) => {
                  const sc = byStaffDay[`${s.staff_id}:${d.n}`]
                  return (
                    <td key={d.n} className="px-3 py-3 text-center">
                      {sc ? (
                        <div className={`rounded-lg p-2 text-xs ${sc.is_available ? 'bg-sage-100' : 'bg-gray-100'}`}>
                          <p className="font-semibold text-teal-700">{sc.start_time}–{sc.end_time}</p>
                          <p className="text-[11px] text-charcoal-400">{sc.is_available ? 'available' : 'unavailable'}</p>
                          <button
                            onClick={async () => {
                              if (window.confirm('Remove this shift?')) { await api.adminDeleteSchedule(sc.schedule_id); load() }
                            }}
                            className="mt-1 text-[11px] font-semibold text-red-500 hover:underline"
                          >
                            remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-charcoal-200">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add shift">
        <div className="space-y-4">
          <Field label="Staff member">
            <Select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
              <option value="">Select staff…</option>
              {staff.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.role})</option>)}
            </Select>
          </Field>
          <Field label="Day">
            <Select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
              {DAYS.map((d) => <option key={d.n} value={d.n}>{d.label}day</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
            <Field label="End"><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-charcoal-900">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} className="h-4 w-4 accent-teal-600" />
            Available (takes bookings)
          </label>
          {form.day_of_week === 0 && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Heads up: the clinic is closed Sundays.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.staff_id}>Add shift</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

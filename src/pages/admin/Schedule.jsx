import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Avatar, Button, Card, Field, Input, Modal, Select, Spinner, StatusPill, cx } from '../../components/ui.jsx'

const DAYS = [
  { n: 0, label: 'Sun' }, { n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' },
]

const ROLE_TONE = { admin: 'amber', vet: 'teal', groomer: 'green' }
const ROLE_CELL = {
  admin: 'bg-amber-500 text-white border-amber-600',
  vet: 'bg-teal-600 text-white border-teal-700',
  groomer: 'bg-emerald-600 text-white border-emerald-700',
}
const ROLE_LEGEND = [
  { role: 'vet', label: 'Vet' },
  { role: 'groomer', label: 'Groomer' },
  { role: 'admin', label: 'Admin' },
]

// Current week (Sunday → Saturday) so the grid shows real dates.
function weekDates() {
  const today = new Date()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay())
  return DAYS.map((d, i) => {
    const x = new Date(sunday)
    x.setDate(sunday.getDate() + i)
    return { ...d, date: x }
  })
}

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

  const todayDow = new Date().getDay()
  const week = weekDates()
  const shiftsThisWeek = schedules.filter((sc) => sc.is_available).length

  const openAdd = (staffId = '') => {
    setForm((f) => ({ ...f, staff_id: staffId || f.staff_id }))
    setAdding(true)
  }

  const add = async () => {
    if (!form.staff_id) return
    await api.adminAddSchedule(form)
    setAdding(false)
    setForm({ staff_id: '', day_of_week: 1, start_time: '09:00', end_time: '17:00', is_available: true })
    load()
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Staff Schedule</h1>
          <p className="mt-1 text-sm text-charcoal-500">Weekly working hours per vet and groomer. Sunday is clinic-closed.</p>
        </div>
        <Button variant="accent" onClick={() => openAdd()}>+ Add shift</Button>
      </div>

      {/* Summary + legend */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sage-100 px-3.5 py-1.5 text-xs font-bold text-teal-700">{staff.length} staff</span>
          <span className="rounded-full bg-sage-100 px-3.5 py-1.5 text-xs font-bold text-teal-700">{shiftsThisWeek} available shifts this week</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs font-semibold text-charcoal-500">
          {ROLE_LEGEND.map((r) => (
            <span key={r.role} className="flex items-center gap-1.5">
              <span className={cx('h-2.5 w-2.5 rounded-sm', r.role === 'vet' ? 'bg-teal-600' : r.role === 'groomer' ? 'bg-emerald-600' : 'bg-amber-500')} />
              {r.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-charcoal-200" /> Unavailable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-sage-300" /> Off
          </span>
        </div>
      </div>

      {/* Weekly matrix */}
      <Card className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            {/* Day headers */}
            <div className="grid grid-cols-[220px_repeat(7,1fr)] border-b border-sage-200 bg-sage-50/80">
              <div className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-charcoal-400">Staff</div>
              {week.map((d) => (
                <div key={d.n} className={cx('px-3 py-4 text-center', d.n === todayDow && 'bg-teal-600/10')}>
                  <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">{d.label}</p>
                  <p className={cx('mt-0.5 text-lg font-extrabold', d.n === todayDow ? 'text-teal-700' : 'text-charcoal-600')}>{d.date.getDate()}</p>
                  {d.n === 0 && <p className="mt-0.5 text-[10px] font-semibold text-charcoal-300">closed</p>}
                </div>
              ))}
            </div>

            {/* Staff rows */}
            {staff.map((s) => (
              <div key={s.staff_id} className={cx('grid grid-cols-[220px_repeat(7,1fr)] border-b border-sage-100 transition-colors', 'hover:bg-sage-50/40')}>
                {/* Staff column */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <Avatar name={s.full_name} size="sm" className="bg-teal-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-charcoal-900">{s.full_name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <StatusPill tone={ROLE_TONE[s.role] || 'green'} dot={false}>{s.role}</StatusPill>
                      {s.specialization && <span className="truncate text-[10px] text-charcoal-400">{s.specialization}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    title={`Add shift for ${s.full_name}`}
                    onClick={() => openAdd(String(s.staff_id))}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold text-teal-600 transition-colors hover:bg-teal-50"
                  >
                    +
                  </button>
                </div>

                {/* Day cells */}
                {week.map((d) => {
                  const sc = byStaffDay[`${s.staff_id}:${d.n}`]
                  return (
                    <div key={d.n} className={cx('flex items-stretch justify-center px-2 py-4', d.n === todayDow && 'bg-teal-600/5')}>
                      {sc ? (
                        <div
                          className={cx(
                            'relative flex w-full flex-col items-center justify-center rounded-xl border py-3 text-center shadow-sm',
                            sc.is_available ? ROLE_CELL[s.role] || ROLE_CELL.vet : 'border-charcoal-200 bg-charcoal-100 text-charcoal-500',
                          )}
                          title={`${sc.start_time}–${sc.end_time}${sc.is_available ? '' : ' (unavailable)'}`}
                        >
                          <span className="text-sm font-extrabold leading-none">{sc.start_time}</span>
                          <span className="mt-1 text-[10px] font-semibold opacity-80">to {sc.end_time}</span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (window.confirm('Remove this shift?')) { await api.adminDeleteSchedule(sc.schedule_id); load() }
                            }}
                            className="absolute -right-1.5 -top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-white text-[10px] font-bold text-red-500 shadow transition-transform hover:scale-110"
                            aria-label={`Remove ${d.label} shift`}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-sage-200 text-[10px] font-semibold text-charcoal-300">
                          off
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add shift">
        <div className="space-y-5">
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
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Start"><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
            <Field label="End"><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium text-charcoal-900">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} className="h-4 w-4 accent-teal-600" />
            Available (takes bookings)
          </label>
          {form.day_of_week === 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-600">Heads up: the clinic is closed Sundays.</p>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={add} disabled={!form.staff_id}>Add shift</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

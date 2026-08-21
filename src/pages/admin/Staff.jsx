import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { useAuth } from '../../lib/auth.jsx'
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, StatusPill } from '../../components/ui.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'

// Job titles are display-only — the clinic's access model is client/admin.
// The enum mirrors staff.role's CHECK constraint; add new titles freely.
const ROLES = ['admin', 'vet', 'groomer', 'front_desk']
const ROLE_TONE = { admin: 'amber', vet: 'teal', groomer: 'green', front_desk: 'blue' }
const ROLE_LABEL = { admin: 'Admin', vet: 'Vet', groomer: 'Groomer', front_desk: 'Front desk' }

export default function Staff() {
  const { user, refreshUser } = useAuth()
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [form, setForm] = useState({ full_name: '', role: 'vet', email: '', specialization: '' })

 const load = () => {
  setError('')
  api.adminStaff()
    .then(setStaff)
    .catch((e) => setError(e?.message || 'Could not load the team.'))
}
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.adminCreateStaff({
        full_name: form.full_name,
        role: form.role,
        email: form.email || undefined,
        specialization: form.specialization || undefined,
      })
      setAdding(false)
      setForm({ full_name: '', role: 'vet', email: '', specialization: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (s) => {
    const msg = s.active
      ? `Deactivate ${s.full_name}? They'll no longer be assignable to appointments (existing bookings are kept).`
      : `Reactivate ${s.full_name}?`
    if (!window.confirm(msg)) return
    setError('')
    try {
      await api.adminToggleStaff(s.staff_id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const savePhoto = async (s, photo_url) => {
    setError('')
    setPhotoBusy(true)
    try {
      await api.adminUpdateStaffPhoto(s.staff_id, photo_url)
      // If the admin just changed their own photo, refresh the session user so
      // the header avatar updates immediately.
      if (user?.staff_id === s.staff_id) await refreshUser()
      await load()
    } catch (err) {
      setError(err.message)
    } finally { setPhotoBusy(false) }
  }

  if (!staff) return <Spinner label="Loading team…" />

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Team</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Everyone who works at the clinic. Job titles are display-only — access is a simple client/admin split.
          </p>
        </div>
        <Button variant="accent" onClick={() => setAdding(true)}>+ Add staff</Button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
      )}

      {staff.length === 0 ? (
        <EmptyState icon="🧑‍⚕️" title="No staff yet">
          Add your first team member to start assigning appointments.
        </EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.staff_id} className="p-6">
              <div className="flex flex-col items-center text-center">
                <ImageUpload photoUrl={s.photo_url} onSave={(v) => savePhoto(s, v)} busy={photoBusy} round size="md" />
                <p className="mt-3 w-full truncate font-bold text-charcoal-900">{s.full_name}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                  <StatusPill tone={ROLE_TONE[s.role] || 'green'} dot={false}>{ROLE_LABEL[s.role] || s.role}</StatusPill>
                  {s.active ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="gray">Inactive</StatusPill>}
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-charcoal-400">Specialization</dt>
                  <dd className="truncate text-right font-medium text-charcoal-800">{s.specialization || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-charcoal-400">Email</dt>
                  <dd className="truncate text-right font-medium text-charcoal-800">{s.email || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-charcoal-400">Active bookings</dt>
                  <dd className="font-medium text-charcoal-800">{s.appointment_count}</dd>
                </div>
              </dl>
              <Button
                variant={s.active ? 'danger' : 'outline'}
                size="sm"
                className="mt-5 w-full"
                onClick={() => toggle(s)}
              >
                {s.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add staff member">
        <form onSubmit={create} className="space-y-5">
          <Field label="Full name">
            <Input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Dr. Jane Doe"
            />
          </Field>
          <Field label="Job title" hint="Display-only — job titles never control access.">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
            </Select>
          </Field>
          <Field label="Email" hint="Optional — new staff get no login credentials from here.">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@petvibe.ph"
            />
          </Field>
          <Field label="Specialization">
            <Input
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="Surgery & Orthopedics"
            />
          </Field>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !form.full_name.trim()}>{busy ? 'Adding…' : 'Add staff'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

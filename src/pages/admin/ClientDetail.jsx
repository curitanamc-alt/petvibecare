import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PetPhoto, Spinner, StatusBadge, StatusPill } from '../../components/ui.jsx'
import { speciesEmoji, speciesLabel } from '../../lib/species.js'

export default function ClientDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [tempPassword, setTempPassword] = useState(null)

  const load = () => {
    setError(null)
    api.adminOwner(id).then(setData).catch((e) => setError(e?.message || 'Could not load this client.'))
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [id])

  if (error) {
    return (
      <EmptyState icon="⚠️" title="Couldn't load this client">
        {error}
        <div className="mt-5"><Button variant="outline" size="sm" onClick={load}>Try again</Button></div>
      </EmptyState>
    )
  }

  if (!data) return <Spinner label="Loading client…" />

  const { owner, pets, bookings } = data

  const openEdit = () => {
    setForm({ full_name: owner.full_name, email: owner.email, phone: owner.phone, address: owner.address || '' })
    setFormError('')
    setEditOpen(true)
  }

  const saveEdit = async () => {
    setBusy(true)
    setFormError('')
    try {
      await api.adminUpdateOwner(owner.owner_id, form)
      setEditOpen(false)
      load()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async () => {
    await api.adminSetOwnerStatus(owner.owner_id, owner.status === 'suspended' ? 'active' : 'suspended')
    load()
  }

  const resetPassword = async () => {
    const r = await api.adminResetOwnerPassword(owner.owner_id)
    setTempPassword(r.temp_password)
  }

  return (
    <div className="space-y-7">
      <Link to="/admin/clients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        All clients
      </Link>

      {/* Profile */}
      <Card className="p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-teal-600 text-2xl font-bold text-white">
              {owner.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-charcoal-900">{owner.full_name}</h1>
                {owner.status === 'suspended'
                  ? <StatusPill tone="red">Suspended</StatusPill>
                  : <StatusPill tone="green">Active</StatusPill>}
                {owner.account_type === 'walk_in' && <Badge color="amber">Walk-in</Badge>}
              </div>
              <p className="mt-1 text-sm text-charcoal-500">{owner.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>Edit contact info</Button>
            <Button
              variant={owner.status === 'suspended' ? 'primary' : 'danger'}
              size="sm"
              onClick={toggleStatus}
            >
              {owner.status === 'suspended' ? '✓ Reactivate account' : 'Suspend account'}
            </Button>
            {owner.account_type !== 'walk_in' && (
              <Button variant="outline" size="sm" onClick={resetPassword}>Reset password</Button>
            )}
          </div>
        </div>

        {tempPassword && (
          <div className="mt-6 rounded-xl border border-teal-600/30 bg-teal-50 p-5">
            <p className="text-sm font-bold text-teal-700">✓ Temporary password generated</p>
            <p className="mt-1.5 text-sm text-teal-700/80">
              A reset email was logged to <b>{owner.email}</b>. Temp password:{' '}
              <code className="rounded bg-white px-2 py-0.5 font-mono font-bold">{tempPassword}</code>{' '}
              — the client should change it after logging in.
            </p>
            <button type="button" onClick={() => setTempPassword(null)} className="mt-2 text-xs font-semibold text-teal-600 hover:underline">Dismiss</button>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Phone', value: owner.phone || '—' },
            { label: 'Address', value: owner.address || '—' },
            { label: 'Client since', value: fmtDate(owner.created_at?.slice(0, 10)) },
            { label: 'Total bookings', value: owner.booking_count ?? bookings.length },
          ].map((f) => (
            <div key={f.label} className="rounded-xl bg-sage-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-400">{f.label}</p>
              <p className="mt-1 text-sm font-semibold text-charcoal-900">{f.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Pets */}
      <Card className="p-7">
        <h2 className="font-bold text-charcoal-900">Pets on file ({pets.length})</h2>
        {pets.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal-400">No pets registered under this account.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((p) => (
              <Link
                key={p.pet_id}
                to={`/admin/pets/${p.pet_id}`}
                className="flex items-center gap-4 rounded-xl border border-sage-200 p-4 transition-all duration-200 hover:border-teal-600 hover:bg-teal-50/50"
              >
                <PetPhoto photoUrl={p.photo_url} size="md" />
                <div className="min-w-0">
                  <p className="font-semibold text-teal-600">{p.name}</p>
                  <p className="truncate text-xs text-charcoal-400">{speciesEmoji(p.species)} {speciesLabel(p.species)}{p.breed ? ` · ${p.breed}` : ''}{p.weight_kg ? ` · ${p.weight_kg} kg` : ''}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Booking history */}
      <Card className="p-7">
        <h2 className="font-bold text-charcoal-900">Booking history ({bookings.length})</h2>
        {bookings.length === 0 ? (
          <p className="mt-4 text-sm text-charcoal-400">No bookings for this client yet.</p>
        ) : (
          <div className="mt-5 divide-y divide-sage-100">
            {bookings.map((b) => (
              <div key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal-900">
                    {b.service_name} <span className="ml-1 font-mono text-xs text-teal-600">{b.reference_code}</span>
                  </p>
                  <p className="text-xs text-charcoal-400">
                    {fmtDate(b.booking_date)} · {b.booking_time} · {b.pet_name} · {b.staff_name || 'unassigned'}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${owner.full_name}`}>
        <div className="space-y-5">
          {formError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{formError}</p>
          )}
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

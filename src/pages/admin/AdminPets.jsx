import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Button, Card, Field, Input, Modal, PetPhoto, Select, Spinner, cx } from '../../components/ui.jsx'
import { SPECIES, SPECIES_GROUPS, speciesColor, speciesEmoji, speciesLabel } from '../../lib/species.js'

const emptyForm = { full_name: '', phone: '', address: '', pet_name: '', species: 'dog', breed: '', gender: 'female', weight_kg: '' }

const SPECIES_TABS = [{ key: '', label: 'All pets' }, ...SPECIES_GROUPS]

export default function AdminPets() {
  const [params, setParams] = useSearchParams()
  const [pets, setPets] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const q = params.get('q') || ''
  const species = params.get('species') || ''

  const load = () => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    api.adminPets('?' + sp.toString()).then(setPets).catch(() => setPets([]))
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [q])

  const group = SPECIES_GROUPS.find((g) => g.key === species)
  const visible = useMemo(() => {
    if (!pets) return []
    if (!species || !group) return pets
    return pets.filter((p) => group.match(p.species))
  }, [pets, species, group])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const addPet = async () => {
    if (!form.full_name || !form.phone || !form.pet_name) {
      setError('Owner name, phone, and pet name are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.adminWalkIn({
        owner: { full_name: form.full_name, phone: form.phone, address: form.address },
        pet: { name: form.pet_name, species: form.species, breed: form.breed, gender: form.gender, weight_kg: form.weight_kg ? Number(form.weight_kg) : null },
        booking: { service_id: 1, booking_date: new Date().toISOString().slice(0, 10), booking_time: '09:00', staff_id: null, notes: 'Added from admin pet management' },
      })
      setShowAdd(false)
      setForm(emptyForm)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!pets) return <Spinner label="Loading pets…" />

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Customer Pets</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">Every pet on file, searchable by name, breed, or owner.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search name, breed, owner…"
            value={q}
            onChange={(e) => setParams(q ? { q: e.target.value } : {}, { replace: true })}
            className="w-64"
          />
          <Button variant="accent" onClick={() => setShowAdd(true)}>+ Add pet</Button>
        </div>
      </div>

      {/* Species filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {SPECIES_TABS.map((t) => (
          <button
            key={t.key || 'all'}
            type="button"
            onClick={() => setParams({ ...(q ? { q } : {}), ...(t.key ? { species: t.key } : {}) }, { replace: true })}
            className={cx(
              'rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200',
              species === t.key ? 'border-amber-500 bg-amber-500 text-white shadow-sm' : 'border-sage-200 bg-white text-charcoal-500 hover:border-teal-400 hover:text-teal-700',
            )}
          >
            {t.key ? `${speciesEmoji(t.key)} ` : '🐾 '}{t.label}
          </button>
        ))}
      </div>

      <Card>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-sage-200 bg-sage-50/80 text-xs font-bold uppercase tracking-wider text-charcoal-400">
                <th className="px-5 py-4">Pet ID</th>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Owner</th>
                <th className="px-5 py-4">Breed</th>
                <th className="px-5 py-4">Weight</th>
                <th className="px-5 py-4">Visits</th>
                <th className="px-5 py-4">Date added</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-charcoal-400">No pets found.</td></tr>}
              {visible.map((p) => (
                <tr key={p.pet_id} className="border-b border-sage-100 transition-colors hover:bg-sage-50/50">
                  <td className="px-5 py-4 font-mono text-xs text-charcoal-400">#{p.pet_id}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <PetPhoto photoUrl={p.photo_url} size="sm" />
                      <Link to={`/admin/pets/${p.pet_id}`} className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-charcoal-900">{p.owner_name}</p>
                    <p className="text-xs text-charcoal-400">{p.owner_phone}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge color={speciesColor(p.species)}>{speciesEmoji(p.species)} {speciesLabel(p.species)}</Badge>
                    <span className="ml-1.5 text-charcoal-600">{p.breed || '—'}</span>
                  </td>
                  <td className="px-5 py-4">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</td>
                  <td className="px-5 py-4">{p.booking_count}</td>
                  <td className="px-5 py-4 text-charcoal-400">{fmtDate(p.created_at?.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="divide-y divide-sage-100 md:hidden">
          {visible.length === 0 && <div className="px-5 py-14 text-center text-charcoal-400">No pets found.</div>}
          {visible.map((p) => (
            <div key={p.pet_id} className="flex items-center gap-4 px-5 py-4">
              <PetPhoto photoUrl={p.photo_url} size="md" />
              <div className="min-w-0 flex-1">
                <Link to={`/admin/pets/${p.pet_id}`} className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
                  {p.name}
                </Link>
                <p className="truncate text-xs text-charcoal-400">{p.owner_name}{p.owner_phone ? ` · ${p.owner_phone}` : ''}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal-500">
                  <Badge color={speciesColor(p.species)}>{speciesEmoji(p.species)} {speciesLabel(p.species)}</Badge>
                  <span>{p.breed || '—'}</span>
                  <span>{p.weight_kg ? `${p.weight_kg} kg` : '—'}</span>
                  <span>{p.booking_count} visits</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Add pet modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add new pet & owner" wide>
        <div className="space-y-6">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
          )}

          <div>
            <p className="text-sm font-bold text-charcoal-900">Owner information</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Full name *">
                <Input value={form.full_name} onChange={set('full_name')} placeholder="Juan Dela Cruz" />
              </Field>
              <Field label="Phone *">
                <Input value={form.phone} onChange={set('phone')} placeholder="0917 000 0000" />
              </Field>
              <Field label="Address">
                <Input value={form.address} onChange={set('address')} placeholder="City / barangay" />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-charcoal-900">Pet information</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Pet name *">
                <Input value={form.pet_name} onChange={set('pet_name')} placeholder="Rex" />
              </Field>
              <Field label="Species">
                <Select value={form.species} onChange={set('species')}>
                  {SPECIES.map((sp) => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
                </Select>
              </Field>
              <Field label="Breed">
                <Input value={form.breed} onChange={set('breed')} placeholder="Shih Tzu" />
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={set('gender')}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </Select>
              </Field>
              <Field label="Weight (kg)">
                <Input type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} placeholder="5.2" />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addPet} disabled={busy}>
              {busy ? 'Adding…' : 'Add pet & owner'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

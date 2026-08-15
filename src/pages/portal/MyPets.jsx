import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api.js'
import { SPECIES, speciesEmoji, speciesLabel } from '../../lib/species.js'
import { Button, Card, EmptyState, Field, Input, Modal, PetPhoto, Select, Spinner } from '../../components/ui.jsx'

const empty = { name: '', species: 'dog', breed: '', gender: 'female', birthdate: '', weight_kg: '' }

export default function MyPets() {
  const [pets, setPets] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.myPets().then((d) => setPets(d.pets)).catch(() => {})
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(empty); setEditing({}) }
  const openEdit = (p) => { setForm({ name: p.name, species: p.species, breed: p.breed || '', gender: p.gender || 'female', birthdate: p.birthdate || '', weight_kg: p.weight_kg ?? '' }); setEditing(p) }

  const save = async () => {
    if (!form.name) return
    setBusy(true)
    setError('')
    try {
      const payload = { ...form, weight_kg: form.weight_kg ? Number(form.weight_kg) : null }
      if (editing.pet_id) await api.updatePet(editing.pet_id, payload)
      else await api.createPet(payload)
      setEditing(null)
      await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const remove = async (p) => {
    if (!window.confirm(`Remove ${p.name} from your account? Bookings stay on file.`)) return
    await api.deletePet(p.pet_id)
    await load()
  }

  if (!pets) return <Spinner />

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">My Pets</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">Each pet has its own medical history, updated by our team after every visit.</p>
        </div>
        <Button onClick={openNew}>+ Add pet</Button>
      </div>

      {pets.length === 0 ? (
        <EmptyState title="No pets yet" icon="🐾">
          Add your first pet and we'll keep their medical history safe here.
        </EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {pets.map((p) => (
            <Card key={p.pet_id} className="p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex items-center gap-5">
                <PetPhoto photoUrl={p.photo_url} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-charcoal-900">{p.name}</p>
                  <p className="mt-1 text-sm text-charcoal-500">{speciesEmoji(p.species)} {p.breed || speciesLabel(p.species)} · {p.gender} · {p.weight_kg ? `${p.weight_kg} kg` : 'weight n/a'}</p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Link
                  to={`/portal/pets/${p.pet_id}`}
                  className="flex-1 rounded-[var(--radius-button)] bg-teal-600 px-3 py-2.5 text-center text-sm font-semibold text-white transition-all duration-200 hover:bg-teal-700 hover:shadow-sm active:scale-[0.97]"
                >
                  Medical history
                </Link>
                <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => remove(p)}>Remove</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.pet_id ? 'Edit pet' : 'Add a pet'}>
        <div className="grid gap-4 sm:grid-cols-2">
          {error && <p className="col-span-full rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>}
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Species">
            <Select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}>
              {SPECIES.map((sp) => <option key={sp.value} value={sp.value}>{sp.label}</option>)}
            </Select>
          </Field>
          <Field label="Breed"><Input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder="Shih Tzu" /></Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="female">Female</option><option value="male">Male</option>
            </Select>
          </Field>
          <Field label="Birthdate"><Input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} /></Field>
          <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></Field>
        </div>
        <div className="mt-7 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} disabled={busy || !form.name}>{busy ? 'Saving…' : 'Save pet'}</Button>
        </div>
      </Modal>
    </div>
  )
}

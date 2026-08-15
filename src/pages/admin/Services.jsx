import { useEffect, useMemo, useState } from 'react'
import { api, fmtMoney } from '../../lib/api.js'
import { useToast } from '../../components/Toast.jsx'
import { Button, Card, Field, Input, Modal, Select, Spinner, StatusPill, Textarea, cx } from '../../components/ui.jsx'
import { isDogTier, speciesEmoji, tierLabel, tierSpecies } from '../../lib/species.js'

const TIER_OPTIONS = [
  { value: '', label: 'Any pet' },
  { value: 'small', label: 'Dog — Small' },
  { value: 'medium', label: 'Dog — Medium' },
  { value: 'large', label: 'Dog — Large' },
  { value: 'xl', label: 'Dog — XL' },
  { value: 'xxl', label: 'Dog — XXL' },
  { value: 'xxxl', label: 'Dog — XXXL' },
  { value: 'cat', label: 'Cat' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'guinea_pig', label: 'Guinea Pig' },
  { value: 'rat', label: 'Fancy Rat' },
  { value: 'bird', label: 'Bird' },
  { value: 'pig', label: 'Pig' },
]

// "Suitable for" filter groups. Dogs & Cats are the main patients: generic
// services (no tier / 'any') show in BOTH of those filters. The exotic
// species (rabbit, guinea pig, rat, bird, pig) show only their own
// species-specific services.
const SERVICE_GROUPS = [
  { key: '', label: '🐾 All', match: () => true },
  { key: 'dog', label: '🐶 Dogs', match: (t) => isDogTier(t) },
  { key: 'cat', label: '🐱 Cats', match: (t) => t === 'cat' },
  { key: 'rabbit', label: '🐰 Rabbits', match: (t) => t === 'rabbit' },
  { key: 'guinea_pig', label: '🐹 Guinea pigs', match: (t) => t === 'guinea_pig' },
  { key: 'rat', label: '🐀 Rats', match: (t) => t === 'rat' },
  { key: 'bird', label: '🐦 Birds', match: (t) => t === 'bird' },
  { key: 'pig', label: '🐷 Pigs', match: (t) => t === 'pig' },
]

const isGeneric = (tier) => !tier || tier === 'any'

const tierSuitable = (tier, groupKey) => {
  if (!groupKey) return true // 'All' shows everything
  if ((groupKey === 'dog' || groupKey === 'cat') && isGeneric(tier)) return true // generic suits the main patients
  const g = SERVICE_GROUPS.find((x) => x.key === groupKey)
  return g ? g.match(tier) : false
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

const emptyForm = { name: '', category: '', description: '', price_min: '', price_max: '', duration_minutes: '', weight_tier: '', client_bookable: false }

export default function Services() {
  const toast = useToast()
  const [services, setServices] = useState(null)
  const [tab, setTab] = useState('')
  const [category, setCategory] = useState('')
  const [group, setGroup] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | service (edit)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.adminServices().then(setServices).catch(() => setServices([]))
  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    if (!services) return []
    return [...new Set(services.map((s) => s.category))].sort()
  }, [services])

  const visible = useMemo(() => {
    if (!services) return []
    return services.filter((s) => {
      if (tab === 'active' && !s.active) return false
      if (tab === 'inactive' && s.active) return false
      if (category && s.category !== category) return false
      if (!tierSuitable(s.weight_tier, group)) return false
      return true
    })
  }, [services, tab, category, group])

  const openNew = () => { setForm(emptyForm); setEditing({}); setError('') }
  const openEdit = (s) => {
    setForm({
      name: s.name, category: s.category, description: s.description || '',
      price_min: s.price_min ?? '', price_max: s.price_max ?? '', duration_minutes: s.duration_minutes ?? '',
      weight_tier: s.weight_tier || '', client_bookable: !!s.client_bookable,
    })
    setEditing(s)
    setError('')
  }

  const save = async () => {
    if (!form.name || !form.category || form.price_min === '') {
      setError('Name, category, and a minimum price are required.')
      return
    }
    setBusy(true)
    setError('')
    const payload = {
      ...form,
      price_min: Number(form.price_min),
      price_max: form.price_max === '' ? '' : Number(form.price_max),
      duration_minutes: form.duration_minutes === '' ? '' : Number(form.duration_minutes),
    }
    try {
      if (editing?.service_id) {
        await api.adminUpdateService(editing.service_id, payload)
        toast('Service updated.', { type: 'success' })
      } else {
        await api.adminCreateService(payload)
        toast('Service added.', { type: 'success' })
      }
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (s) => {
    const r = await api.adminToggleService(s.service_id)
    toast(`${r.name} is now ${r.active ? 'active' : 'inactive'}.`, { type: 'success' })
    load()
  }

  if (!services) return <Spinner label="Loading services…" />

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Services</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">Full catalog — {services.length} services across all categories.</p>
        </div>
        <Button variant="accent" onClick={openNew}>+ Add Service</Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-sage-200/80 bg-white p-1.5 shadow-card">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key || 'all'}
                type="button"
                onClick={() => setTab(t.key)}
                className={cx(
                  'rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                  tab === t.key ? 'bg-amber-500 text-white shadow-sm' : 'text-charcoal-500 hover:bg-sage-50 hover:text-charcoal-800',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-64">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <span className="ml-auto text-sm text-charcoal-400">{visible.length} service{visible.length === 1 ? '' : 's'}</span>
        </div>
        {/* Suitable-for filter (species) */}
        <div className="flex flex-wrap gap-1.5">
          {SERVICE_GROUPS.map((g) => (
            <button
              key={g.key || 'all'}
              type="button"
              onClick={() => setGroup(g.key)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
                group === g.key ? 'border-teal-600 bg-teal-600 text-white shadow-sm' : 'border-sage-200 bg-white text-charcoal-500 hover:border-teal-400 hover:text-teal-700',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="border-b border-sage-200 bg-sage-50/80 text-xs font-bold uppercase tracking-wider text-charcoal-400">
                <th className="px-5 py-4">Service</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Suitable for</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-charcoal-400">No services match these filters.</td></tr>}
              {visible.map((s) => (
                <tr key={s.service_id} className="border-b border-sage-100 transition-colors hover:bg-sage-50/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-charcoal-900">{s.name}</p>
                    {s.description && <p className="max-w-xs truncate text-xs text-charcoal-400">{s.description}</p>}
                  </td>
                  <td className="px-5 py-4 text-charcoal-600">{s.category}</td>
                  <td className="px-5 py-4 text-charcoal-600">{speciesEmoji(tierSpecies(s.weight_tier))} {tierLabel(s.weight_tier)}</td>
                  <td className="px-5 py-4 text-charcoal-600">{s.duration_minutes ? `~${s.duration_minutes} min` : '—'}</td>
                  <td className="px-5 py-4 font-semibold text-teal-600">{fmtMoney(s)}</td>
                  <td className="px-5 py-4">
                    {s.active ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="gray">Inactive</StatusPill>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        title="Edit service"
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-2 text-charcoal-400 transition-colors hover:bg-sage-100 hover:text-teal-700"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title={s.active ? 'Set inactive' : 'Set active'}
                        onClick={() => toggle(s)}
                        className={cx(
                          'rounded-lg p-2 transition-colors hover:bg-sage-100',
                          s.active ? 'text-teal-600' : 'text-charcoal-300',
                        )}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="1" y="5" width="22" height="14" rx="7" /><circle cx="16" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="divide-y divide-sage-100 md:hidden">
          {visible.length === 0 && <div className="px-5 py-14 text-center text-charcoal-400">No services match these filters.</div>}
          {visible.map((s) => (
            <div key={s.service_id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal-900">{s.name}</p>
                  <p className="mt-0.5 text-xs text-charcoal-400">{s.category}{s.duration_minutes ? ` · ~${s.duration_minutes} min` : ''}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {s.active ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="gray">Inactive</StatusPill>}
                  <button
                    type="button"
                    title="Edit service"
                    onClick={() => openEdit(s)}
                    className="rounded-lg p-2 text-charcoal-400 transition-colors hover:bg-sage-100 hover:text-teal-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-teal-600">{fmtMoney(s)}</span>
                <span className="text-xs text-charcoal-500">{speciesEmoji(tierSpecies(s.weight_tier))} {tierLabel(s.weight_tier)}</span>
                {s.description && <p className="w-full truncate text-xs text-charcoal-400">{s.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.service_id ? 'Edit service' : 'Add service'} wide>
        <div className="space-y-6">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service name *">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rabies Vaccine" />
            </Field>
            <Field label="Category *">
              <Input list="service-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Vaccination & Deworming" />
              <datalist id="service-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Min price (₱) *">
              <Input type="number" min="0" value={form.price_min} onChange={(e) => setForm({ ...form, price_min: e.target.value })} placeholder="400" />
            </Field>
            <Field label="Max price (₱)">
              <Input type="number" min="0" value={form.price_max} onChange={(e) => setForm({ ...form, price_max: e.target.value })} placeholder="500" />
            </Field>
            <Field label="Duration (minutes)">
              <Input type="number" min="0" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="30" />
            </Field>
            <Field label="Suitable for" hint="Which pets can use this service?">
              <Select value={form.weight_tier} onChange={(e) => setForm({ ...form, weight_tier: e.target.value })}>
                {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this service include?" />
              </Field>
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium text-charcoal-900">
            <input type="checkbox" checked={form.client_bookable} onChange={(e) => setForm({ ...form, client_bookable: e.target.checked })} className="h-4 w-4 accent-teal-600" />
            Available for online booking (clients can book this)
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : editing?.service_id ? 'Save changes' : 'Add service'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

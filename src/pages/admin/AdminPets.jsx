import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Card, Input, Spinner } from '../../components/ui.jsx'

export default function AdminPets() {
  const [params, setParams] = useSearchParams()
  const [pets, setPets] = useState(null)
  const q = params.get('q') || ''

  useEffect(() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    api.adminPets('?' + sp.toString()).then(setPets).catch(() => setPets([]))
  }, [q])

  if (!pets) return <Spinner label="Loading pets…" />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal-900">Customer Pets</h1>
          <p className="text-sm text-charcoal-400">Every pet on file, searchable by name, breed, or owner.</p>
        </div>
        <Input placeholder="Search name, breed, owner…" value={q} onChange={(e) => setParams(q ? { q: e.target.value } : {}, { replace: true })} className="w-64" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-sage-200 bg-sage-50 text-xs font-bold uppercase tracking-wide text-charcoal-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Pet</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Species / Breed</th>
              <th className="px-4 py-3">Gender</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {pets.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-charcoal-400">No pets found.</td></tr>}
            {pets.map((p) => (
              <tr key={p.pet_id} className="border-b border-sage-100 hover:bg-sage-50/50">
                <td className="px-4 py-3 font-mono text-xs text-charcoal-400">#{p.pet_id}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/pets/${p.pet_id}`} className="font-semibold text-teal-600 hover:underline">{p.name}</Link>
                </td>
                <td className="px-4 py-3">
                  <p className="text-charcoal-900">{p.owner_name}</p>
                  <p className="text-xs text-charcoal-400">{p.owner_phone}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={p.species === 'cat' ? 'amber' : 'teal'}>{p.species}</Badge>
                  <span className="ml-1 text-charcoal-600">{p.breed || '—'}</span>
                </td>
                <td className="px-4 py-3 capitalize">{p.gender || '—'}</td>
                <td className="px-4 py-3">{p.weight_kg ? `${p.weight_kg} kg` : '—'}</td>
                <td className="px-4 py-3">{p.booking_count}</td>
                <td className="px-4 py-3 text-charcoal-400">{fmtDate(p.created_at?.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

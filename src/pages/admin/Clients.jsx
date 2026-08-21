import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, fmtDate } from '../../lib/api.js'
import { Badge, Button, Card, Input, Modal, Spinner, StatusPill, cx } from '../../components/ui.jsx'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
]

export default function Clients() {
  const [params, setParams] = useSearchParams()
  const [owners, setOwners] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const q = params.get('q') || ''
  const status = params.get('status') || ''

  const load = () => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (status) sp.set('status', status)
    api.adminOwners('?' + sp.toString()).then(setOwners).catch(() => setOwners([]))
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await api.adminDeleteOwner(deleteTarget.owner_id)
      setDeleteTarget(null)
      load()
    } catch (e) {
      setDeleteError(e.message)
      setDeleteBusy(false)
    }
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [q, status])

  const setFilter = (k, v) => {
    const sp = new URLSearchParams(params)
    if (v) sp.set(k, v); else sp.delete(k)
    setParams(sp, { replace: true })
  }

  const visible = useMemo(() => owners || [], [owners])

  if (!owners) return <Spinner label="Loading clients…" />

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Clients</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">Every owner account on file — search, review, and manage account status.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-sage-200/80 bg-white p-1.5 shadow-card">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key || 'all'}
              type="button"
              onClick={() => setFilter('status', t.key)}
              className={cx(
                'rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200',
                status === t.key ? 'bg-amber-500 text-white shadow-sm' : 'text-charcoal-500 hover:bg-sage-50 hover:text-charcoal-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder="Search name, email, phone…"
            value={q}
            onChange={(e) => setFilter('q', e.target.value)}
            className="w-full pl-10 sm:w-72"
          />
        </div>
      </div>

      <Card>
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-sage-200 bg-sage-50/80 text-xs font-bold uppercase tracking-wider text-charcoal-400">
                <th className="px-5 py-4">Client</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Joined</th>
                <th className="px-5 py-4">Pets</th>
                <th className="px-5 py-4">Bookings</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-charcoal-400">No clients found.</td></tr>}
              {visible.map((o) => (
                <tr key={o.owner_id} className="border-b border-sage-100 transition-colors hover:bg-sage-50/50">
                  <td className="px-5 py-4">
                    <Link to={`/admin/clients/${o.owner_id}`} className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
                      {o.full_name}
                    </Link>
                    <p className="text-xs text-charcoal-400">{o.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-charcoal-700">{o.phone || '—'}</p>
                    <p className="max-w-[220px] truncate text-xs text-charcoal-400">{o.address || '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-charcoal-400">{fmtDate(o.created_at?.slice(0, 10))}</td>
                  <td className="px-5 py-4 font-semibold text-charcoal-900">{o.pet_count}</td>
                  <td className="px-5 py-4 text-charcoal-600">{o.booking_count}</td>
                  <td className="px-5 py-4">
                    <AccountStatus status={o.status} accountType={o.account_type} />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => { setDeleteError(''); setDeleteTarget(o) }}
                      title={`Delete ${o.full_name} and all their data`}
                      className="rounded-lg p-1.5 text-charcoal-300 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile stacked cards */}
        <div className="divide-y divide-sage-100 md:hidden">
          {visible.length === 0 && <div className="px-5 py-14 text-center text-charcoal-400">No clients found.</div>}
          {visible.map((o) => (
            <div key={o.owner_id} className="flex items-stretch">
              <Link to={`/admin/clients/${o.owner_id}`} className="min-w-0 flex-1 px-5 py-4 transition-colors hover:bg-sage-50/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-teal-600">{o.full_name}</p>
                    <p className="truncate text-xs text-charcoal-400">{o.email}</p>
                  </div>
                  <AccountStatus status={o.status} accountType={o.account_type} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-charcoal-500">
                  <span className="truncate">📞 {o.phone || '—'}</span>
                  <span>🐾 {o.pet_count} pet{o.pet_count === 1 ? '' : 's'}</span>
                  <span className="truncate">📍 {o.address || '—'}</span>
                  <span>📅 {fmtDate(o.created_at?.slice(0, 10))}</span>
                </div>
              </Link>
              <div className="flex items-center pr-3">
                <button
                  type="button"
                  onClick={() => { setDeleteError(''); setDeleteTarget(o) }}
                  title={`Delete ${o.full_name} and all their data`}
                  className="rounded-lg p-2 text-charcoal-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => !deleteBusy && setDeleteTarget(null)} title="Delete client account">
        <div className="space-y-5">
          {deleteTarget && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm leading-relaxed text-red-700">
                This permanently deletes <b>{deleteTarget.full_name}</b> and everything attached to the account:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700/90">
                <li>{deleteTarget.pet_count} pet{deleteTarget.pet_count === 1 ? '' : 's'} and their medical records</li>
                <li>{deleteTarget.booking_count} booking{deleteTarget.booking_count === 1 ? '' : 's'} and their history</li>
                <li>Notifications and login sessions</li>
              </ul>
              <p className="mt-3 text-sm font-semibold text-red-700">This cannot be undone.</p>
            </div>
          )}
          {deleteError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{deleteError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AccountStatus({ status, accountType }) {
  if (status === 'suspended') return <StatusPill tone="red">Suspended</StatusPill>
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusPill tone="green">Active</StatusPill>
      {accountType === 'walk_in' && <Badge color="amber">Walk-in</Badge>}
    </span>
  )
}

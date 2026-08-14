import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Button, Card, Field, Input, Spinner } from '../../components/ui.jsx'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.myProfile().then((d) => {
      setProfile(d.owner)
      setForm({ full_name: d.owner.full_name, phone: d.owner.phone, address: d.owner.address || '' })
    }).catch(() => {})
  }, [])

  if (!profile) return <Spinner />

  const save = async () => {
    setBusy(true)
    setSaved(false)
    try {
      await api.updateProfile(form)
      setSaved(true)
    } finally { setBusy(false) }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Profile settings</h1>
        <p className="text-sm text-charcoal-400">These details appear on your bookings and confirmations.</p>
      </div>
      <Card className="p-6">
        <div className="space-y-4">
          <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email" hint="Email can't be changed here — contact the clinic.">
            <Input value={profile.email} disabled className="bg-sage-50" />
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          {saved && <span className="text-sm font-semibold text-teal-600">✓ Saved</span>}
        </div>
      </Card>
    </div>
  )
}

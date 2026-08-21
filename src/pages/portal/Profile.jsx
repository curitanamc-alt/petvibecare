import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { Button, Card, Field, Input, Spinner } from '../../components/ui.jsx'
import ImageUpload from '../../components/ImageUpload.jsx'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '' })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState(null) // { ok, text }

  useEffect(() => {
    api.myProfile().then((d) => {
      setProfile(d.owner)
      setForm({ full_name: d.owner.full_name, email: d.owner.email, phone: d.owner.phone, address: d.owner.address || '' })
    }).catch((e) => setLoadError(e?.message || 'Could not load your profile.'))
  }, [])

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
        {loadError}
      </div>
    )
  }

  if (!profile) return <Spinner />

  // Walk-in profiles are created at the counter and have no password set.
  const hasLogin = profile.account_type !== 'walk_in'

  const edit = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaved(false)
  }

  const savePhoto = async (photo_url) => {
    setPhotoBusy(true)
    setError('')
    try {
      const updated = await api.updateProfile({ photo_url })
      setProfile(updated)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally { setPhotoBusy(false) }
  }

  const save = async () => {
    setError('')
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Full name, email and phone are required.')
      return
    }
    // Booking emails go to this address — reject garbage so the client
    // actually receives their confirmations (mirrors the server check).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    setBusy(true)
    setSaved(false)
    try {
      const updated = await api.updateProfile({ ...form, email: form.email.trim() })
      setProfile(updated)
      setSaved(true)
    } catch (e) {
      setError(e.message)
    } finally { setBusy(false) }
  }

  const changePassword = async () => {
    if (pw.new_password !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    if (pw.new_password.length < 6) {
      setPwMsg({ ok: false, text: 'New password must be at least 6 characters.' })
      return
    }
    setPwBusy(true)
    setPwMsg(null)
    try {
      await api.changePassword({ current_password: pw.current_password, new_password: pw.new_password })
      setPw({ current_password: '', new_password: '', confirm: '' })
      setPwMsg({ ok: true, text: 'Password updated.' })
    } catch (e) {
      setPwMsg({ ok: false, text: e.message })
    } finally { setPwBusy(false) }
  }

  return (
    <div className="max-w-lg space-y-10">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal-900">Profile settings</h1>
        <p className="mt-1.5 text-sm text-charcoal-500">These details appear on your bookings and confirmations.</p>
      </div>

      <Card className="p-8">
        <div className="space-y-6">
          <ImageUpload photoUrl={profile.photo_url} onSave={savePhoto} busy={photoBusy} round />
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
          )}
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => edit({ full_name: e.target.value })} />
          </Field>
          <Field label="Email" hint="Changing your email updates your login address — a verification link would be emailed in production.">
            <Input type="email" value={form.email} onChange={(e) => edit({ email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => edit({ phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => edit({ address: e.target.value })} />
          </Field>
        </div>
        <div className="mt-7 flex items-center gap-4">
          <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-teal-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Saved
            </span>
          )}
        </div>
      </Card>

      {hasLogin && (
      <Card className="p-8">
        <h2 className="font-bold text-charcoal-900">Change password</h2>
        <p className="mt-1 text-xs text-charcoal-400">Use a strong password you don't use elsewhere.</p>
        <div className="mt-6 space-y-6">
          <Field label="Current password">
            <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} placeholder="••••••••" />
          </Field>
          <Field label="New password" hint="At least 6 characters.">
            <Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} placeholder="••••••••" />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="••••••••" />
          </Field>
          {pwMsg && (
            <p className={`rounded-xl border px-5 py-3.5 text-sm font-medium ${pwMsg.ok ? 'border-teal-600/30 bg-teal-50 text-teal-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
              {pwMsg.text}
            </p>
          )}
          <Button
            onClick={changePassword}
            disabled={pwBusy || !pw.current_password || !pw.new_password}
          >
            {pwBusy ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </Card>
      )}
    </div>
  )
}

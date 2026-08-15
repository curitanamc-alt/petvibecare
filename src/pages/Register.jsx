import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { Button, Card, Field, Input, Logo } from '../components/ui.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', address: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(form)
      navigate('/portal')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-6 py-24 lg:px-8">
      <div className="mb-10 text-center">
        <Logo />
      </div>
      <Card className="p-10">
        <h1 className="text-2xl font-extrabold text-charcoal-900">Create your account</h1>
        <p className="mt-2 text-sm text-charcoal-500">Manage your pets, medical history, and bookings in one place.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
          )}
          <Field label="Full name">
            <Input required value={form.full_name} onChange={set('full_name')} placeholder="Juan Dela Cruz" />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={set('email')} placeholder="you@email.com" />
          </Field>
          <Field label="Phone">
            <Input required value={form.phone} onChange={set('phone')} placeholder="0917 000 0000" />
          </Field>
          <Field label="Password" hint="Used to log in to your portal.">
            <Input type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder="••••••••" />
          </Field>
          <Field label="Address (optional)">
            <Input value={form.address} onChange={set('address')} placeholder="City / barangay" />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-charcoal-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  )
}

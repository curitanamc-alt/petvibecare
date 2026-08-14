import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { api } from '../lib/api.js'
import { Button, Card, Field, Input, Logo } from '../components/ui.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demos, setDemos] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.demoAccounts().then(setDemos).catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await login(email, password)
      const dest = next || (data.role === 'staff' ? '/admin' : '/portal')
      navigate(dest)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center"><Logo /></div>
      <Card className="p-7">
        <h1 className="text-2xl font-extrabold text-charcoal-900">Log in</h1>
        <p className="mt-1 text-sm text-charcoal-400">Clients and clinic staff sign in here.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-charcoal-400">
          New to PetVibe? <Link to="/register" className="font-semibold text-teal-600 hover:underline">Create an account</Link>
        </p>
      </Card>

      {demos.length > 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-sage-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-400">Demo accounts</p>
          <div className="mt-2 space-y-2">
            {demos.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => { setEmail(d.email); setPassword(d.password) }}
                className="flex w-full items-center justify-between rounded-lg bg-sage-50 px-3 py-2 text-left text-sm hover:bg-sage-100"
              >
                <span className="font-semibold text-teal-700">{d.label}</span>
                <span className="text-xs text-charcoal-400">{d.email} · {d.password}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

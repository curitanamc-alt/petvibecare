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
    <div className="mx-auto flex max-w-md flex-col px-6 py-24 lg:px-8">
      <div className="mb-10 text-center">
        <Logo />
      </div>
      <Card className="p-10">
        <h1 className="text-2xl font-extrabold text-charcoal-900">Log in</h1>
        <p className="mt-2 text-sm text-charcoal-500">Clients and clinic staff sign in here.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-600">{error}</p>
          )}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </Field>
          <Field label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-charcoal-500">
          New to PetVibe?{' '}
          <Link to="/register" className="font-semibold text-teal-600 transition-colors hover:text-teal-700 hover:underline">
            Create an account
          </Link>
        </p>
      </Card>

      {demos.length > 0 && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-sage-200 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-charcoal-400">Demo accounts</p>
          <div className="mt-4 space-y-2.5">
            {demos.map((d) => (
              <button
                key={d.label}
                type="button"
                onClick={() => { setEmail(d.email); setPassword(d.password) }}
                className="flex w-full items-center justify-between rounded-xl bg-sage-50 px-5 py-3.5 text-left text-sm transition-colors hover:bg-sage-100"
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

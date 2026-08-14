import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, session } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user)
  const [role, setRole] = useState(session.role)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!session.token) { setReady(true); return }
    api.me()
      .then(({ role: r, user: u }) => { setRole(r); setUser(u) })
      .catch(() => { session.clear(); setUser(null); setRole(null) })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password })
    session.set(data)
    setRole(data.role)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (data) => {
    const res = await api.register(data)
    session.set(res)
    setRole(res.role)
    setUser(res.user)
    return res
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    session.clear()
    setUser(null)
    setRole(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const d = await api.me()
    setRole(d.role)
    setUser(d.user)
    session.set({ ...session, ...d })
    return d
  }, [])

  return (
    <AuthContext.Provider value={{ user, role, ready, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

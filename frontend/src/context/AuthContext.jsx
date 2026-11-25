import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const clear = useCallback(() => { setToken(null); setUser(null) }, [])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    if (!getToken()) return
    api.get('/api/auth/me').then(setUser).catch(clear).finally(() => setLoading(false))
  }, [clear])

  const accept = useCallback((data) => { setToken(data.token); setUser(data.user); return data.user }, [])

  const value = useMemo(() => ({
    user, loading,
    can: (permission) => Boolean(user && user.permissions.includes(permission)),
    login: async (identifier, password) => accept(await api.post('/api/auth/login', { identifier, password }, { auth: false })),
    register: async (payload) => accept(await api.post('/api/auth/register', payload, { auth: false })),
    logout: async () => { try { await api.post('/api/auth/logout') } catch { /* token may already be invalid */ } clear(); window.location.hash = '' },
    setUser,
  }), [user, loading, accept, clear])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

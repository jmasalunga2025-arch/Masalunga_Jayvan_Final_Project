import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const KEY = 'dams_theme'

const read = () => {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(read) // 'light' | 'dark' | 'system'

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches))
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((value) => {
    try { localStorage.setItem(KEY, value) } catch { /* ignore */ }
    setThemeState(value)
  }, [])

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

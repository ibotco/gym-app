import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeId = 'dark' | 'light' | 'midnight' | 'paper'

export interface ThemeDef {
  id: ThemeId
  name: string
  desc: string
  swatch: [string, string]
}

export const themes: ThemeDef[] = [
  { id: 'dark', name: 'Ink', desc: 'Default dark', swatch: ['#09090b', '#c8f542'] },
  { id: 'light', name: 'Paper', desc: 'Clean light', swatch: ['#f6f6f2', '#c8f542'] },
  { id: 'midnight', name: 'Midnight', desc: 'Deep blue-black', swatch: ['#0b1020', '#60a5fa'] },
  { id: 'paper', name: 'Warm paper', desc: 'Cream with ember', swatch: ['#faf6ee', '#ff6b2c'] },
]

const DARK: ThemeId[] = ['dark', 'midnight']

export function isDarkTheme(id: ThemeId) {
  return DARK.includes(id)
}

interface ThemeCtx {
  theme: ThemeId
  isDark: boolean
  toggle: () => void
  setTheme: (t: ThemeId) => void
  themes: ThemeDef[]
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('fitpro_theme') as ThemeId | null
    return saved && themes.some((t) => t.id === saved) ? saved : 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkTheme(theme))
    localStorage.setItem('fitpro_theme', theme)
  }, [theme])

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      isDark: isDarkTheme(theme),
      themes,
      setTheme: (t: ThemeId) => setThemeState(t),
      toggle: () => setThemeState((t) => (isDarkTheme(t) ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme')
  return v
}

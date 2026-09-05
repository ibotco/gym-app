import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'
import { LANGS, messages, type MsgKey } from '../i18n/messages'

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: MsgKey | string, vars?: Record<string, string | number>) => string
  langs: typeof LANGS
}

const Ctx = createContext<I18nCtx | null>(null)

function interpolate(raw: string, vars?: Record<string, string | number>) {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('fitpro_lang') as Lang | null
    return saved && messages[saved] ? saved : 'en'
  })

  useEffect(() => {
    document.documentElement.lang = lang === 'tw' ? 'ak' : lang
  }, [lang])

  const setLang = (l: Lang) => {
    localStorage.setItem('fitpro_lang', l)
    setLangState(l)
  }

  const t = (k: MsgKey | string, vars?: Record<string, string | number>) => {
    const table = messages[lang] || messages.en
    const raw = table[k] ?? messages.en[k] ?? String(k)
    if (typeof raw !== 'string') return String(k)
    return interpolate(raw, vars)
  }

  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n')
  return v
}

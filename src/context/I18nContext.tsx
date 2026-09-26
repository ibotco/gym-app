import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Lang } from '../types'
import { LANGS, messages, EN_DICT, type MsgKey } from '../i18n/messages'
import { detectLocale, isRtl, bcp47Of } from '../i18n/registry'
import { translate } from '../i18n/core'
import { makeFormatters, type Formatters } from '../i18n/format'
import { loadEnabledLangs, ENABLED_LANGS_EVENT } from '../lib/langSettings'

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** True when the active language renders right-to-left (Arabic, Hebrew, Urdu). */
  rtl: boolean
  t: (k: MsgKey | string, vars?: Record<string, string | number>) => string
  /** Locale-aware date/time/number/currency formatting. */
  fmt: Formatters
  langs: typeof LANGS
}

const Ctx = createContext<I18nCtx | null>(null)

const LANG_KEY = 'fitpro_lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && messages[saved]) return saved as Lang
  } catch { /* private mode */ }
  // Automatic detection from browser/device preferences.
  const preferred = typeof navigator !== 'undefined' && navigator.languages?.length
    ? navigator.languages
    : [typeof navigator !== 'undefined' ? navigator.language : 'en']
  return detectLocale(preferred) as Lang
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  // Languages enabled in Company settings → the header switcher only offers these.
  const [enabledLangs, setEnabledLangs] = useState<string[]>(loadEnabledLangs)
  const rtl = isRtl(lang)

  useEffect(() => {
    const refresh = () => setEnabledLangs(loadEnabledLangs())
    window.addEventListener(ENABLED_LANGS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(ENABLED_LANGS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  // If the active language gets disabled, fall back to the first enabled one.
  useEffect(() => {
    if (enabledLangs.length && !enabledLangs.includes(lang)) setLangState(enabledLangs[0] as Lang)
  }, [enabledLangs, lang])

  useEffect(() => {
    document.documentElement.lang = bcp47Of(lang)
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
  }, [lang, rtl])

  const setLang = (l: Lang) => {
    try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ }
    setLangState(l)
  }

  const t = useMemo(() => {
    const bcp = bcp47Of(lang)
    const chain = lang === 'en' ? [EN_DICT] : [messages[lang] || {}, EN_DICT]
    return (k: MsgKey | string, vars?: Record<string, string | number>) => translate(chain, k as string, vars, bcp)
  }, [lang])

  const fmt = useMemo(() => makeFormatters(lang), [lang])

  // Only languages enabled in Company settings are selectable.
  const langs = useMemo(() => {
    const enabled = LANGS.filter((l) => enabledLangs.includes(l.id))
    return enabled.length ? enabled : LANGS
  }, [enabledLangs])

  const value = useMemo(
    () => ({ lang, setLang, rtl, t, fmt, langs }),
    [lang, rtl, t, fmt, langs],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n')
  return v
}

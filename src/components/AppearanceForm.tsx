import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from './ui'
import { useTheme, type ThemeId } from '../context/ThemeContext'
import { useI18n } from '../context/I18nContext'
import { useToast } from '../context/ToastContext'
import type { Lang } from '../types'
import { cn } from '../lib/utils'

export function AppearanceForm() {
  const { theme, setTheme, themes } = useTheme()
  const { lang, setLang, langs, t } = useI18n()
  const toast = useToast()
  const [nextLang, setNextLang] = useState<Lang>(lang)
  const [nextTheme, setNextTheme] = useState<ThemeId>(theme)

  const save = () => {
    setLang(nextLang)
    setTheme(nextTheme)
    toast.success(t('appearance.saved'))
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold">{t('appearance.language')}</legend>
        <p className="mb-3 text-sm text-mist">{t('appearance.languageHint')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {langs.map((l) => (
            <label
              key={l.id}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition',
                nextLang === l.id ? 'border-lime bg-lime/10 ring-1 ring-lime' : 'border-line hover:border-lime/40',
              )}
            >
              <span>
                <span className="block font-semibold">{l.native}</span>
                <span className="text-xs text-mist">{l.label}</span>
              </span>
              <input
                type="radio"
                name="language"
                className="sr-only"
                checked={nextLang === l.id}
                onChange={() => setNextLang(l.id)}
              />
              {nextLang === l.id && <Check className="size-4 text-lime-dim dark:text-lime" />}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold">{t('appearance.theme')}</legend>
        <p className="mb-3 text-sm text-mist">{t('appearance.themeHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setNextTheme(th.id)}
              className={cn(
                'rounded-2xl border p-3 text-left transition',
                nextTheme === th.id ? 'border-lime ring-1 ring-lime' : 'border-line hover:border-lime/40',
              )}
            >
              <div className="mb-3 flex h-14 overflow-hidden rounded-xl">
                <span className="w-2/3" style={{ background: th.swatch[0] }} />
                <span className="w-1/3" style={{ background: th.swatch[1] }} />
              </div>
              <p className="font-semibold">{th.name}</p>
              <p className="text-xs text-mist">{th.desc}</p>
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit">{t('appearance.save')}</Button>
    </form>
  )
}

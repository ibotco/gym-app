import { useI18n } from '../context/I18nContext'
import type { Lang } from '../types'
import { Select } from './ui'

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang, langs, t } = useI18n()
  // Full English name of the active language, shown as a Bootstrap-style
  // tooltip when hovering the (compact) language code, e.g. EN → "English".
  const activeLabel = langs.find((l) => l.id === lang)?.label || lang
  return (
    <span className="group/lang relative inline-block">
      <Select
        aria-label={t('lang')}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className={compact ? 'w-[5.5rem]' : 'w-[9rem]'}
      >
        {langs.map((l) => (
          <option key={l.id} value={l.id}>{compact ? l.id.toUpperCase() : l.native}</option>
        ))}
      </Select>
      <span
        role="tooltip"
        className="pf-tip-card bs-tooltip-bottom pointer-events-none invisible absolute top-[calc(100%+10px)] left-1/2 z-50 -translate-x-1/2 [animation:none] opacity-0 transition-opacity duration-150 group-hover/lang:visible group-hover/lang:opacity-100 group-focus-within/lang:visible"
      >
        <span className="tooltip-arrow" />
        <span className="tooltip-inner">{activeLabel}</span>
      </span>
    </span>
  )
}

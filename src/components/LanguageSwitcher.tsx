import { useI18n } from '../context/I18nContext'
import type { Lang } from '../types'
import { Select } from './ui'

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang, langs, t } = useI18n()
  return (
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
  )
}

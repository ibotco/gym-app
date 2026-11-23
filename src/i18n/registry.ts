/**
 * Locale registry — the single place to add a new language.
 * Each locale points at a JSON resource file in ./locales and carries the
 * metadata needed for detection, Intl formatting and RTL layout.
 */
export interface LocaleDef {
  id: string
  /** English name */
  label: string
  /** Native name shown in the switcher */
  native: string
  /** BCP-47 tag used for Intl + <html lang> */
  bcp47: string
  /** Right-to-left script */
  rtl?: boolean
  /** Browser prefixes matched by auto-detection (in addition to bcp47) */
  match?: string[]
}

export const LOCALES: LocaleDef[] = [
  { id: 'en', label: 'English', native: 'English', bcp47: 'en' },
  { id: 'fr', label: 'French', native: 'Français', bcp47: 'fr' },
  { id: 'tw', label: 'Twi', native: 'Twi', bcp47: 'ak' },
  { id: 'es', label: 'Spanish', native: 'Español', bcp47: 'es' },
  { id: 'de', label: 'German', native: 'Deutsch', bcp47: 'de' },
  { id: 'it', label: 'Italian', native: 'Italiano', bcp47: 'it' },
  { id: 'pt-pt', label: 'Portuguese (Portugal)', native: 'Português (Portugal)', bcp47: 'pt-PT' },
  { id: 'pt-br', label: 'Portuguese (Brazil)', native: 'Português (Brasil)', bcp47: 'pt-BR' },
  { id: 'nl', label: 'Dutch', native: 'Nederlands', bcp47: 'nl' },
  { id: 'pl', label: 'Polish', native: 'Polski', bcp47: 'pl' },
  { id: 'tr', label: 'Turkish', native: 'Türkçe', bcp47: 'tr' },
  { id: 'ar', label: 'Arabic', native: 'العربية', bcp47: 'ar', rtl: true },
  { id: 'he', label: 'Hebrew', native: 'עברית', bcp47: 'he', rtl: true },
  { id: 'ru', label: 'Russian', native: 'Русский', bcp47: 'ru' },
  { id: 'uk', label: 'Ukrainian', native: 'Українська', bcp47: 'uk' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी', bcp47: 'hi' },
  { id: 'bn', label: 'Bengali', native: 'বাংলা', bcp47: 'bn' },
  { id: 'ur', label: 'Urdu', native: 'اردو', bcp47: 'ur', rtl: true, match: ['ur'] },
  { id: 'zh-cn', label: 'Chinese (Simplified)', native: '简体中文', bcp47: 'zh-CN', match: ['zh-cn', 'zh-hans', 'zh-hans-cn', 'zh-sg', 'zh-my', 'zh'] },
  { id: 'zh-tw', label: 'Chinese (Traditional)', native: '繁體中文', bcp47: 'zh-TW', match: ['zh-tw', 'zh-hant', 'zh-hant-tw', 'zh-hk', 'zh-hant-hk', 'zh-mo', 'zh-hant-mo'] },
  { id: 'ja', label: 'Japanese', native: '日本語', bcp47: 'ja' },
  { id: 'ko', label: 'Korean', native: '한국어', bcp47: 'ko' },
  { id: 'th', label: 'Thai', native: 'ไทย', bcp47: 'th' },
  { id: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', bcp47: 'vi' },
  { id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', bcp47: 'id' },
  { id: 'ms', label: 'Malay', native: 'Bahasa Melayu', bcp47: 'ms' },
  { id: 'sw', label: 'Swahili', native: 'Kiswahili', bcp47: 'sw' },
]

export const LOCALE_IDS = LOCALES.map((l) => l.id)

export const localeById = (id: string): LocaleDef | undefined => LOCALES.find((l) => l.id === id)

export const isRtl = (id: string): boolean => !!localeById(id)?.rtl

export const bcp47Of = (id: string): string => localeById(id)?.bcp47 || 'en'

/**
 * Pick the best supported locale from an ordered preference list
 * (e.g. navigator.languages). Exact id → bcp47 → explicit match list →
 * base-language prefix. Falls back to English.
 */
export function detectLocale(preferred: readonly string[]): string {
  const norm = preferred.map((p) => p.toLowerCase())
  for (const p of norm) {
    const exact = LOCALES.find((l) => l.id === p || l.bcp47.toLowerCase() === p)
    if (exact) return exact.id
    const viaMatch = LOCALES.find((l) => l.match?.includes(p))
    if (viaMatch) return viaMatch.id
  }
  for (const p of norm) {
    const base = p.split('-')[0]
    const byBase = LOCALES.find((l) => l.bcp47.toLowerCase().split('-')[0] === base || l.id.split('-')[0] === base)
    if (byBase) return byBase.id
  }
  return 'en'
}

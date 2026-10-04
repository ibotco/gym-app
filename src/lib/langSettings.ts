/**
 * Company language settings — which languages are enabled for selection in
 * the header language switcher. Multiple languages can be enabled at once;
 * at least one must stay enabled. Changes are broadcast via a window event
 * so the I18n provider re-reads the list live.
 */

export const ENABLED_LANGS_KEY = 'fitpro_enabled_langs_v1'
export const ENABLED_LANGS_EVENT = 'fitpro-enabled-langs'

/** Languages enabled out of the box. */
export const DEFAULT_ENABLED_LANGS = ['en', 'fr', 'tw']

export function loadEnabledLangs(): string[] {
  try {
    const raw = localStorage.getItem(ENABLED_LANGS_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length && arr.every((x) => typeof x === 'string')) return arr
    }
  } catch { /* private mode */ }
  return [...DEFAULT_ENABLED_LANGS]
}

export function saveEnabledLangs(ids: string[]) {
  try { localStorage.setItem(ENABLED_LANGS_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ENABLED_LANGS_EVENT))
}

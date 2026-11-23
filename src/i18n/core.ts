/**
 * Pure i18n core — no React imports, fully unit-testable.
 * Handles interpolation, CLDR plural selection and fallback lookup.
 */

export type Dict = Record<string, string>

/** Replace {name} placeholders. */
export function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''))
}

/** CLDR plural category for a count in a locale ('zero' | 'one' | 'two' | 'few' | 'many' | 'other'). */
export function pluralCategory(bcp47: string, count: number): string {
  try {
    return new Intl.PluralRules(bcp47).select(count)
  } catch {
    return count === 1 ? 'one' : 'other'
  }
}

/**
 * Translate a key against an ordered chain of dictionaries (locale → … → en).
 * Pluralization: when `vars.count` is present, looks up `key_<category>` then
 * `key_other` before the plain key. Missing keys fall through the chain and
 * finally resolve to the key itself so the UI never renders `undefined`.
 */
export function translate(chain: Dict[], key: string, vars?: Record<string, string | number>, bcp47 = 'en'): string {
  let raw: string | undefined
  if (vars && typeof vars.count === 'number') {
    const cat = pluralCategory(bcp47, vars.count)
    for (const suffix of [`_${cat}`, '_other']) {
      const hit = chain.find((d) => typeof d[key + suffix] === 'string')
      if (hit) { raw = hit[key + suffix]; break }
    }
  }
  if (raw === undefined) {
    const hit = chain.find((d) => typeof d[key] === 'string')
    if (hit) raw = hit[key]
  }
  if (raw === undefined) return key
  // Number placeholders get locale-aware formatting automatically.
  const localized: Record<string, string | number> | undefined = vars && {
    ...vars,
    ...Object.fromEntries(
      Object.entries(vars).filter(([, v]) => typeof v === 'number' && !Number.isInteger(v as number)),
    ),
  }
  return interpolate(raw, localized ?? vars)
}

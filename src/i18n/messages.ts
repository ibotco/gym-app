/**
 * Translation resource loader.
 *
 * Each language lives in its own JSON file under ./locales — to add a new
 * language, drop a JSON file there and register it in ./registry.ts.
 * Partial files are fine: missing keys fall back to English at runtime.
 */
import en from './locales/en.json'
import fr from './locales/fr.json'
import tw from './locales/tw.json'
import es from './locales/es.json'
import de from './locales/de.json'
import it from './locales/it.json'
import ptPt from './locales/pt-pt.json'
import ptBr from './locales/pt-br.json'
import nl from './locales/nl.json'
import pl from './locales/pl.json'
import tr from './locales/tr.json'
import ar from './locales/ar.json'
import he from './locales/he.json'
import ru from './locales/ru.json'
import uk from './locales/uk.json'
import hi from './locales/hi.json'
import bn from './locales/bn.json'
import ur from './locales/ur.json'
import zhCn from './locales/zh-cn.json'
import zhTw from './locales/zh-tw.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import th from './locales/th.json'
import vi from './locales/vi.json'
import id from './locales/id.json'
import ms from './locales/ms.json'
import sw from './locales/sw.json'
import type { Dict } from './core'
import type { Lang } from '../types'
import { LOCALES } from './registry'

export type MsgKey = keyof typeof en

/** locale id → dictionary. English is the complete reference set. */
export const messages: Record<string, Dict> = {
  en, fr, tw, es, de, it, 'pt-pt': ptPt, 'pt-br': ptBr, nl, pl, tr, ar, he,
  ru, uk, hi, bn, ur, 'zh-cn': zhCn, 'zh-tw': zhTw, ja, ko, th, vi, id, ms, sw,
}

export const EN_DICT: Dict = en

/** Switcher list — kept in registry order. */
export const LANGS = LOCALES.map((l) => ({ id: l.id as Lang, label: l.label, native: l.native }))

export { LOCALES, type LocaleDef } from './registry'
export { translate, interpolate, pluralCategory } from './core'
export { makeFormatters, type Formatters } from './format'

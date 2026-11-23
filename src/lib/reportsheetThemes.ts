import type { EduRecords, EduRow } from './eduRecords'

export type BuiltinReportsheetThemeId =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'

export type ReportsheetThemeId = BuiltinReportsheetThemeId | (string & {})

export interface ReportsheetThemeDef {
  id: ReportsheetThemeId
  name: string
  tagline: string
  description: string
  accentColor: string
  isCustom?: boolean
  baseThemeId?: BuiltinReportsheetThemeId
  canvasElementsJson?: string
  tableCellOverridesJson?: string
  canvasSettingsJson?: string
  reportOptionsJson?: string
  examName?: string
  certificateColor?: string
  createdAt?: string
}

export const REPORTSHEET_THEMES: ReportsheetThemeDef[] = [
  {
    id: 'theme-1',
    name: 'Theme 1',
    tagline: 'Classic Marksheet Template',
    description: 'Classic marksheet template layout with warm stone table headers, navy student summary, grading scale, and triple signature columns.',
    accentColor: '#16325c',
  },
  {
    id: 'theme-2',
    name: 'Theme 2',
    tagline: 'Classic Bordered Academic',
    description: 'Classic bordered layout with clean lines, structured grids, and a timeless academic look.',
    accentColor: '#1e293b',
  },
  {
    id: 'theme-3',
    name: 'Theme 3',
    tagline: 'Minimalist Modern',
    description: 'Minimalist open layout with soft dividers, circular student photo, and clean modern typography.',
    accentColor: '#334155',
  },
  {
    id: 'theme-4',
    name: 'Theme 4',
    tagline: 'Executive Navy Band',
    description: 'Bold navy header bands with high-contrast table headers, subtle row striping, and boxed signatures.',
    accentColor: '#0f172a',
  },
  {
    id: 'theme-5',
    name: 'Theme 5',
    tagline: 'Prestigious Framed Formal',
    description: 'Elegant framed sheet with classic serif headings, refined ruled tables, and a prestigious feel.',
    accentColor: '#27272a',
  },
  {
    id: 'theme-6',
    name: 'Theme 6',
    tagline: 'Contemporary Teal Accent',
    description: 'Vibrant teal-accented layout with tinted student bio panel, emerald headers, and crisp hierarchy.',
    accentColor: '#0f766e',
  },
]

export const REPORTSHEET_THEME_NAMES = REPORTSHEET_THEMES.map((t) => t.name)

const PUBLISHED_THEMES_STORAGE_KEY = 'fitpro:publishedReportsheetThemes:v1'
const DELETED_BUILTIN_THEMES_STORAGE_KEY = 'fitpro:deletedBuiltinReportsheetThemes:v1'
let runtimeCustomThemesCache: ReportsheetThemeDef[] | null = null
let runtimeDeletedBuiltinIdsCache: string[] | null = null

function parseThemeNumber(value?: string | null): number {
  const raw = String(value ?? '').trim()
  const match = /(?:^theme[-\s]*)(\d+)$/i.exec(raw)
  if (!match) return 0
  const n = parseInt(match[1], 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeBaseThemeId(value?: string | null): BuiltinReportsheetThemeId {
  const v = String(value ?? '').trim().toLowerCase()
  if (
    v === 'theme-1' ||
    v === 'theme-2' ||
    v === 'theme-3' ||
    v === 'theme-4' ||
    v === 'theme-5' ||
    v === 'theme-6'
  ) {
    return v
  }
  return 'theme-1'
}

function isDeletedBuiltinRow(row: EduRow): boolean {
  if (!row || row.id === 'active-theme') return false
  if (
    row.isDeletedBuiltinTheme === true ||
    String(row.isDeletedBuiltinTheme) === 'true' ||
    String(row.isDeletedBuiltinTheme) === '1'
  ) {
    return true
  }
  return String(row.id ?? '').startsWith('deleted-theme-')
}

function isCustomThemeRow(row: EduRow): boolean {
  if (!row || row.id === 'active-theme' || isDeletedBuiltinRow(row)) return false
  if (row.isCustomTheme === true || String(row.isCustomTheme) === 'true' || String(row.isCustomTheme) === '1') {
    return true
  }
  if (String(row.id ?? '').startsWith('custom-theme-')) return true
  const num = parseThemeNumber(String(row.themeId ?? row.themeName ?? ''))
  return num > REPORTSHEET_THEMES.length
}

function rowToCustomThemeDef(row: EduRow): ReportsheetThemeDef | null {
  const rawId = String(row.themeId ?? '').trim()
  const rawName = String(row.themeName ?? '').trim()
  const num = parseThemeNumber(rawId) || parseThemeNumber(rawName)
  const id = rawId || (num > 0 ? `theme-${num}` : '')
  const name = rawName || (num > 0 ? `Theme ${num}` : '')
  if (!id || !name) return null
  const hasExplicitCustomFlag =
    row.isCustomTheme === true ||
    String(row.isCustomTheme) === 'true' ||
    String(row.isCustomTheme) === '1' ||
    String(row.id ?? '').startsWith('custom-theme-')
  if (!hasExplicitCustomFlag && REPORTSHEET_THEMES.some((b) => b.id === id)) {
    return null
  }
  const baseThemeId = normalizeBaseThemeId(String(row.baseThemeId ?? 'theme-1'))
  const baseDef = REPORTSHEET_THEMES.find((b) => b.id === baseThemeId) ?? REPORTSHEET_THEMES[0]
  return {
    id,
    name,
    tagline: String(row.tagline ?? '').trim() || 'Published Custom Theme',
    description:
      String(row.description ?? '').trim() ||
      `Custom reportsheet theme published from Report Builder (based on ${baseDef.name}).`,
    accentColor: String(row.accentColor ?? '').trim() || baseDef.accentColor,
    isCustom: true,
    baseThemeId,
    canvasElementsJson: typeof row.canvasElementsJson === 'string' ? row.canvasElementsJson : undefined,
    tableCellOverridesJson: typeof row.tableCellOverridesJson === 'string' ? row.tableCellOverridesJson : undefined,
    canvasSettingsJson: typeof row.canvasSettingsJson === 'string' ? row.canvasSettingsJson : undefined,
    reportOptionsJson: typeof row.reportOptionsJson === 'string' ? row.reportOptionsJson : undefined,
    examName: typeof row.examName === 'string' ? row.examName : undefined,
    certificateColor: typeof row.certificateColor === 'string' ? row.certificateColor : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  }
}

function readCachedCustomThemes(): ReportsheetThemeDef[] {
  if (runtimeCustomThemesCache !== null) return runtimeCustomThemesCache
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PUBLISHED_THEMES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      runtimeCustomThemesCache = parsed.filter(
        (item): item is ReportsheetThemeDef =>
          Boolean(item && typeof item.id === 'string' && typeof item.name === 'string'),
      )
      return runtimeCustomThemesCache
    }
  } catch {
    // ignore storage errors
  }
  return []
}

function writeCachedCustomThemes(list: ReportsheetThemeDef[]): void {
  runtimeCustomThemesCache = list
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PUBLISHED_THEMES_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore storage errors
  }
}

function readCachedDeletedBuiltinIds(): string[] {
  if (runtimeDeletedBuiltinIdsCache !== null) return runtimeDeletedBuiltinIdsCache
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DELETED_BUILTIN_THEMES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      runtimeDeletedBuiltinIdsCache = parsed
        .map((x) => String(x ?? '').trim().toLowerCase())
        .filter(Boolean)
      return runtimeDeletedBuiltinIdsCache
    }
  } catch {
    // ignore storage errors
  }
  return []
}

function writeCachedDeletedBuiltinIds(ids: string[]): void {
  runtimeDeletedBuiltinIdsCache = ids
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DELETED_BUILTIN_THEMES_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore storage errors
  }
}

function sortThemesByOrder(themes: ReportsheetThemeDef[]): ReportsheetThemeDef[] {
  return [...themes].sort((a, b) => {
    const na = parseThemeNumber(a.id) || parseThemeNumber(a.name) || 9999
    const nb = parseThemeNumber(b.id) || parseThemeNumber(b.name) || 9999
    if (na !== nb) return na - nb
    return a.name.localeCompare(b.name)
  })
}

export function extractDeletedBuiltinIdsFromRecords(records?: EduRecords | null): Set<string> {
  if (!records) {
    return new Set(readCachedDeletedBuiltinIds())
  }
  const rows = (records.reportsheetTheme ?? []) as EduRow[]
  const ids = new Set<string>()
  for (const row of rows) {
    if (!isDeletedBuiltinRow(row)) continue
    const rawId =
      String(row.themeId ?? '').trim().toLowerCase() ||
      String(row.id ?? '')
        .replace(/^deleted-/, '')
        .trim()
        .toLowerCase()
    if (rawId) ids.add(rawId)
  }
  writeCachedDeletedBuiltinIds(Array.from(ids))
  return ids
}

export function hasDeletedBuiltinReportsheetThemes(records?: EduRecords | null): boolean {
  return extractDeletedBuiltinIdsFromRecords(records).size > 0
}

export function extractCustomThemesFromRecords(records?: EduRecords | null): ReportsheetThemeDef[] {
  if (!records) {
    return sortThemesByOrder(readCachedCustomThemes())
  }
  const rows = (records.reportsheetTheme ?? []) as EduRow[]
  const byId = new Map<string, ReportsheetThemeDef>()
  for (const row of rows) {
    if (!isCustomThemeRow(row)) continue
    const def = rowToCustomThemeDef(row)
    if (def) byId.set(def.id, def)
  }
  const extracted = sortThemesByOrder(Array.from(byId.values()))
  writeCachedCustomThemes(extracted)
  return extracted
}

export function getAllReportsheetThemes(records?: EduRecords | null): ReportsheetThemeDef[] {
  const deletedBuiltinIds = extractDeletedBuiltinIdsFromRecords(records)
  const custom = extractCustomThemesFromRecords(records)
  const customIds = new Set(custom.map((c) => c.id.toLowerCase()))
  const builtin = REPORTSHEET_THEMES.filter(
    (t) => !deletedBuiltinIds.has(t.id.toLowerCase()) && !customIds.has(t.id.toLowerCase()),
  )
  const combined = sortThemesByOrder([...builtin, ...custom])
  return combined.length > 0 ? combined : [REPORTSHEET_THEMES[0]]
}

export function getNextReportsheetThemeIdentity(records?: EduRecords | null): {
  number: number
  id: string
  name: string
} {
  const all = getAllReportsheetThemes(records)
  let maxNumber = 0
  for (const th of all) {
    const numFromId = parseThemeNumber(th.id)
    const numFromName = parseThemeNumber(th.name)
    if (numFromId > maxNumber) maxNumber = numFromId
    if (numFromName > maxNumber) maxNumber = numFromName
  }
  if (maxNumber <= 0) maxNumber = REPORTSHEET_THEMES.length
  const nextNumber = maxNumber + 1
  return {
    number: nextNumber,
    id: `theme-${nextNumber}`,
    name: `Theme ${nextNumber}`,
  }
}

export function findReportsheetTheme(idOrName?: string | null, records?: EduRecords | null): ReportsheetThemeDef {
  const needle = String(idOrName ?? '').trim().toLowerCase()
  const pool = getAllReportsheetThemes(records)
  if (!needle) return pool[0] ?? REPORTSHEET_THEMES[0]
  return (
    pool.find(
      (t) => t.id.toLowerCase() === needle || t.name.toLowerCase() === needle,
    ) ??
    pool[0] ??
    REPORTSHEET_THEMES[0]
  )
}

export function getActiveReportsheetTheme(records: EduRecords): ReportsheetThemeDef {
  const rows = (records.reportsheetTheme ?? []) as EduRow[]
  const activeRow =
    rows.find((r) => r.id === 'active-theme') ??
    rows.find((r) => !isCustomThemeRow(r) && !isDeletedBuiltinRow(r))
  return findReportsheetTheme(activeRow?.themeId || activeRow?.themeName, records)
}

export interface PublishReportsheetThemeDraft {
  tagline?: string
  description?: string
  accentColor?: string
  baseThemeId?: string
  canvasElementsJson?: string
  tableCellOverridesJson?: string
  canvasSettingsJson?: string
  reportOptionsJson?: string
  examName?: string
  certificateColor?: string
}

export function publishReportsheetThemeToRecords(
  records: EduRecords,
  draft: PublishReportsheetThemeDraft,
): { nextRecords: EduRecords; theme: ReportsheetThemeDef } {
  const { id, name } = getNextReportsheetThemeIdentity(records)
  const baseThemeId = normalizeBaseThemeId(draft.baseThemeId)
  const baseDef = REPORTSHEET_THEMES.find((b) => b.id === baseThemeId) ?? REPORTSHEET_THEMES[0]
  const nowIso = new Date().toISOString()

  const tagline = String(draft.tagline ?? '').trim() || baseDef.tagline
  const description =
    String(draft.description ?? '').trim() ||
    `Custom reportsheet theme (${tagline}) published from Report Builder.`
  const accentColor = String(draft.accentColor ?? '').trim() || baseDef.accentColor

  const newRow: EduRow = {
    id: `custom-${id}`,
    isCustomTheme: true,
    themeId: id,
    themeName: name,
    tagline,
    description,
    accentColor,
    baseThemeId,
    canvasElementsJson: draft.canvasElementsJson ?? '[]',
    tableCellOverridesJson: draft.tableCellOverridesJson ?? '{}',
    canvasSettingsJson: draft.canvasSettingsJson ?? '{}',
    reportOptionsJson: draft.reportOptionsJson ?? '[]',
    examName: draft.examName ?? '',
    certificateColor: draft.certificateColor ?? '',
    createdAt: nowIso.slice(0, 10),
    updatedAt: nowIso,
  }

  const existingRows = ((records.reportsheetTheme ?? []) as EduRow[]).filter(
    (r) =>
      r.id !== newRow.id &&
      r.id !== `deleted-${id}` &&
      !(isCustomThemeRow(r) && String(r.themeId ?? '').toLowerCase() === id.toLowerCase()),
  )
  const nextThemeRows = [...existingRows, newRow]
  const nextRecords: EduRecords = {
    ...records,
    reportsheetTheme: nextThemeRows,
  }

  // Sync runtime & localStorage caches immediately
  extractDeletedBuiltinIdsFromRecords(nextRecords)
  extractCustomThemesFromRecords(nextRecords)
  const publishedDef = findReportsheetTheme(id, nextRecords)

  return {
    nextRecords,
    theme: publishedDef,
  }
}

export function applyReportsheetThemeToRecords(
  records: EduRecords,
  themeIdOrName: string,
): { nextRecords: EduRecords; theme: ReportsheetThemeDef } {
  const theme = findReportsheetTheme(themeIdOrName, records)
  const previousTheme = getActiveReportsheetTheme(records)
  const nowIso = new Date().toISOString()

  const preservedExtraRows = ((records.reportsheetTheme ?? []) as EduRow[]).filter(
    (r) => isCustomThemeRow(r) || isDeletedBuiltinRow(r),
  )

  const themeRows: EduRow[] = [
    {
      id: 'active-theme',
      themeId: theme.id,
      themeName: theme.name,
      description: theme.description,
      updatedAt: nowIso,
    },
    ...preservedExtraRows,
  ]

  // Keep Exam Setup records that have no explicit custom override (or matched the previous school theme) aligned.
  const examSetupRows = ((records.examSetup ?? []) as EduRow[]).map((exam) => {
    const cur = String(exam.reportsheetTheme ?? '').trim()
    if (!cur || cur === previousTheme.name || cur === previousTheme.id) {
      return { ...exam, reportsheetTheme: theme.name }
    }
    return exam
  })

  return {
    theme,
    nextRecords: {
      ...records,
      reportsheetTheme: themeRows,
      ...(records.examSetup ? { examSetup: examSetupRows } : {}),
    },
  }
}

export function deleteReportsheetThemeFromRecords(
  records: EduRecords,
  themeIdOrName: string,
): {
  deleted: boolean
  deletedTheme: ReportsheetThemeDef | null
  activeTheme: ReportsheetThemeDef
  nextRecords: EduRecords
  reason?: 'not-found' | 'last-theme'
} {
  const needle = String(themeIdOrName ?? '').trim().toLowerCase()
  const currentThemes = getAllReportsheetThemes(records)
  const target =
    currentThemes.find(
      (t) => t.id.toLowerCase() === needle || t.name.toLowerCase() === needle,
    ) ?? null

  if (!target) {
    return {
      deleted: false,
      deletedTheme: null,
      activeTheme: getActiveReportsheetTheme(records),
      nextRecords: records,
      reason: 'not-found',
    }
  }

  if (currentThemes.length <= 1) {
    return {
      deleted: false,
      deletedTheme: target,
      activeTheme: currentThemes[0],
      nextRecords: records,
      reason: 'last-theme',
    }
  }

  const nowIso = new Date().toISOString()
  const targetIdLower = target.id.toLowerCase()
  const targetNameLower = target.name.toLowerCase()
  const isBuiltinSlot = REPORTSHEET_THEMES.some((b) => b.id.toLowerCase() === targetIdLower)

  const existingRows = (records.reportsheetTheme ?? []) as EduRow[]
  // Remove any custom theme row matching target, and remove active-theme temporarily so we rebuild it cleanly
  const remainingExtraRows: EduRow[] = existingRows.filter((r) => {
    if (!r || r.id === 'active-theme') return false
    if (isCustomThemeRow(r)) {
      const rThemeId = String(r.themeId ?? '').trim().toLowerCase()
      const rThemeName = String(r.themeName ?? '').trim().toLowerCase()
      if (
        r.id === `custom-${target.id}` ||
        rThemeId === targetIdLower ||
        rThemeName === targetNameLower
      ) {
        return false
      }
    }
    return isCustomThemeRow(r) || isDeletedBuiltinRow(r)
  })

  // If the deleted theme corresponds to one of the 6 built-in theme IDs, record a deletion tombstone
  if (
    isBuiltinSlot &&
    !remainingExtraRows.some(
      (r) =>
        isDeletedBuiltinRow(r) &&
        (String(r.themeId ?? '').trim().toLowerCase() === targetIdLower ||
          r.id === `deleted-${target.id}`),
    )
  ) {
    remainingExtraRows.push({
      id: `deleted-${target.id}`,
      isDeletedBuiltinTheme: true,
      themeId: target.id,
      themeName: target.name,
      updatedAt: nowIso,
    })
  }

  const tempRecords: EduRecords = {
    ...records,
    reportsheetTheme: remainingExtraRows,
  }
  const remainingThemes = getAllReportsheetThemes(tempRecords)
  const previousActive = getActiveReportsheetTheme(records)
  const nextActive =
    previousActive.id.toLowerCase() !== targetIdLower &&
    remainingThemes.some((t) => t.id === previousActive.id)
      ? previousActive
      : remainingThemes[0]

  const finalThemeRows: EduRow[] = [
    {
      id: 'active-theme',
      themeId: nextActive.id,
      themeName: nextActive.name,
      description: nextActive.description,
      updatedAt: nowIso,
    },
    ...remainingExtraRows,
  ]

  const examSetupRows = ((records.examSetup ?? []) as EduRow[]).map((exam) => {
    const cur = String(exam.reportsheetTheme ?? '').trim().toLowerCase()
    if (cur === targetNameLower || cur === targetIdLower) {
      return { ...exam, reportsheetTheme: nextActive.name }
    }
    return exam
  })

  const reportBuilderRows = ((records.reportBuilder ?? []) as EduRow[]).map((rep) => {
    if (String(rep.publishedThemeId ?? '').trim().toLowerCase() === targetIdLower) {
      return { ...rep, publishedThemeId: '' }
    }
    return rep
  })

  const nextRecords: EduRecords = {
    ...records,
    reportsheetTheme: finalThemeRows,
    ...(records.examSetup ? { examSetup: examSetupRows } : {}),
    ...(records.reportBuilder ? { reportBuilder: reportBuilderRows } : {}),
  }

  extractDeletedBuiltinIdsFromRecords(nextRecords)
  extractCustomThemesFromRecords(nextRecords)

  return {
    deleted: true,
    deletedTheme: target,
    activeTheme: nextActive,
    nextRecords,
  }
}

export function restoreDefaultReportsheetThemesToRecords(
  records: EduRecords,
): { nextRecords: EduRecords; activeTheme: ReportsheetThemeDef } {
  const nowIso = new Date().toISOString()
  const existingRows = (records.reportsheetTheme ?? []) as EduRow[]
  const customRows = existingRows.filter((r) => isCustomThemeRow(r))
  const currentActive = getActiveReportsheetTheme(records)

  const finalThemeRows: EduRow[] = [
    {
      id: 'active-theme',
      themeId: currentActive.id,
      themeName: currentActive.name,
      description: currentActive.description,
      updatedAt: nowIso,
    },
    ...customRows,
  ]

  const nextRecords: EduRecords = {
    ...records,
    reportsheetTheme: finalThemeRows,
  }

  extractDeletedBuiltinIdsFromRecords(nextRecords)
  extractCustomThemesFromRecords(nextRecords)

  return {
    nextRecords,
    activeTheme: getActiveReportsheetTheme(nextRecords),
  }
}

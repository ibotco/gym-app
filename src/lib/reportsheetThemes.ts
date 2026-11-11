import type { EduRecords, EduRow } from './eduRecords'

export type ReportsheetThemeId =
  | 'theme-1'
  | 'theme-2'
  | 'theme-3'
  | 'theme-4'
  | 'theme-5'
  | 'theme-6'

export interface ReportsheetThemeDef {
  id: ReportsheetThemeId
  name: string
  tagline: string
  description: string
  accentColor: string
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

export function findReportsheetTheme(idOrName?: string | null): ReportsheetThemeDef {
  const needle = String(idOrName ?? '').trim().toLowerCase()
  if (!needle) return REPORTSHEET_THEMES[0]
  return (
    REPORTSHEET_THEMES.find(
      (t) => t.id.toLowerCase() === needle || t.name.toLowerCase() === needle,
    ) ?? REPORTSHEET_THEMES[0]
  )
}

export function getActiveReportsheetTheme(records: EduRecords): ReportsheetThemeDef {
  const rows = (records.reportsheetTheme ?? []) as EduRow[]
  const activeRow = rows.find((r) => r.id === 'active-theme') ?? rows[0]
  return findReportsheetTheme(activeRow?.themeId || activeRow?.themeName)
}

export function applyReportsheetThemeToRecords(
  records: EduRecords,
  themeIdOrName: string,
): { nextRecords: EduRecords; theme: ReportsheetThemeDef } {
  const theme = findReportsheetTheme(themeIdOrName)
  const previousTheme = getActiveReportsheetTheme(records)
  const nowIso = new Date().toISOString()

  const themeRows: EduRow[] = [
    {
      id: 'active-theme',
      themeId: theme.id,
      themeName: theme.name,
      description: theme.description,
      updatedAt: nowIso,
    },
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

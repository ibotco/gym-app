import type { EduRecords, EduRow } from './eduRecords'
import { uid } from './utils'

export type CaActivityItem = {
  id: string
  name: string
  maxScore: number
}

export type CaExamLinkEntry = {
  examId: string
  examName: string
}

export type GradingSchemeId = 'standard' | 'bece' | 'preschool' | 'competency' | 'aptitude'

export const GRADING_SCHEMES: { id: GradingSchemeId; label: string; short: string }[] = [
  {
    id: 'standard',
    label: 'Standard — Excellent, Very Good, Good, Credit, Pass, Weak',
    short: 'Standard',
  },
  {
    id: 'bece',
    label: 'BECE — 1–9 Grading System with Aggregates',
    short: 'BECE (1–9)',
  },
  {
    id: 'preschool',
    label: 'Pre-School — Exceeding, Meeting, Approaching, Developing',
    short: 'Pre-School',
  },
  {
    id: 'competency',
    label: 'Competency — Advanced, Proficient, Approaching, Developing, Beginning',
    short: 'Competency',
  },
  {
    id: 'aptitude',
    label: 'Aptitude — Aptitude-based Scale',
    short: 'Aptitude',
  },
]

export function evaluateCaGrade(
  pct: number,
  scheme: GradingSchemeId = 'standard',
): { grade: string; remark: string } {
  const s = Math.max(0, Math.min(100, pct))
  if (scheme === 'bece') {
    if (s >= 80) return { grade: '1', remark: 'Highest' }
    if (s >= 70) return { grade: '2', remark: 'Higher' }
    if (s >= 65) return { grade: '3', remark: 'High' }
    if (s >= 60) return { grade: '4', remark: 'High Average' }
    if (s >= 55) return { grade: '5', remark: 'Average' }
    if (s >= 50) return { grade: '6', remark: 'Low Average' }
    if (s >= 45) return { grade: '7', remark: 'Low' }
    if (s >= 40) return { grade: '8', remark: 'Lower' }
    return { grade: '9', remark: 'Lowest' }
  }
  if (scheme === 'preschool') {
    if (s >= 80) return { grade: 'EX', remark: 'Exceeding' }
    if (s >= 65) return { grade: 'MT', remark: 'Meeting' }
    if (s >= 50) return { grade: 'AP', remark: 'Approaching' }
    return { grade: 'DV', remark: 'Developing' }
  }
  if (scheme === 'competency') {
    if (s >= 80) return { grade: 'A1', remark: 'Advanced' }
    if (s >= 70) return { grade: 'P2', remark: 'Proficient' }
    if (s >= 60) return { grade: 'AP3', remark: 'Approaching' }
    if (s >= 45) return { grade: 'D4', remark: 'Developing' }
    return { grade: 'B5', remark: 'Beginning' }
  }
  if (scheme === 'aptitude') {
    if (s >= 85) return { grade: 'Distinction', remark: 'Outstanding Aptitude' }
    if (s >= 70) return { grade: 'Merit', remark: 'Strong Aptitude' }
    if (s >= 50) return { grade: 'Pass', remark: 'Satisfactory Aptitude' }
    return { grade: 'Needs Support', remark: 'Developing Aptitude' }
  }
  // Standard
  if (s >= 80) return { grade: 'A', remark: 'Excellent' }
  if (s >= 70) return { grade: 'B+', remark: 'Very Good' }
  if (s >= 60) return { grade: 'B', remark: 'Good' }
  if (s >= 50) return { grade: 'C', remark: 'Credit' }
  if (s >= 40) return { grade: 'D', remark: 'Pass' }
  return { grade: 'F', remark: 'Weak' }
}

const cleanList = (v: unknown[]) =>
  [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]

export function parseDistNames(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanList(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return cleanList(parsed)
  } catch {
    /* fallback to delimiter split */
  }
  return cleanList(s.split(/[\n,;]/).map((x) => x.replace(/^\s*[-•]\s*/, '')))
}

export function normCaSec(raw: string): string {
  return String(raw ?? '').trim().replace(/^section\s+/i, '').trim().toLowerCase()
}

/** Extract all target Classes configured on a Continuous Assessment record. */
export function getCaClasses(caRow?: EduRow | null): string[] {
  if (!caRow) return []
  if (caRow.classesJson) {
    const parsed = parseDistNames(caRow.classesJson)
    if (parsed.length) return parsed
  }
  return parseDistNames(caRow.className)
}

/** Extract all target Sections configured on a Continuous Assessment record. */
export function getCaSections(caRow?: EduRow | null): string[] {
  if (!caRow) return []
  if (caRow.sectionsJson) {
    const parsed = parseDistNames(caRow.sectionsJson)
    if (parsed.length) return parsed
  }
  return parseDistNames(caRow.section)
}

/** Extract all target Terms configured on a Continuous Assessment record. */
export function getCaTerms(caRow?: EduRow | null): string[] {
  if (!caRow) return []
  if (caRow.termsJson) {
    const parsed = parseDistNames(caRow.termsJson)
    if (parsed.length) return parsed
  }
  const list = parseDistNames(caRow.term)
  return list.length ? list : ['Term 1']
}

/** Extract per-term linked Exam Setup metadata (`Record<term, { examId, examName }>`). */
export function getCaExamLinks(caRow?: EduRow | null): Record<string, CaExamLinkEntry> {
  if (!caRow) return {}
  if (caRow.examLinksJson) {
    try {
      const parsed = JSON.parse(String(caRow.examLinksJson))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const out: Record<string, CaExamLinkEntry> = {}
        for (const [tm, val] of Object.entries(parsed as Record<string, any>)) {
          if (val && typeof val === 'object') {
            out[tm] = {
              examId: String(val.examId ?? ''),
              examName: String(val.examName ?? ''),
            }
          }
        }
        if (Object.keys(out).length > 0) return out
      }
    } catch {
      /* ignore */
    }
  }
  const terms = getCaTerms(caRow)
  if (caRow.examId || caRow.examName) {
    const primaryTerm = terms[0] || 'Term 1'
    return {
      [primaryTerm]: {
        examId: String(caRow.examId ?? ''),
        examName: String(caRow.examName ?? ''),
      },
    }
  }
  return {}
}

/** Build a term-scoped subject storage key so multi-term scores for the same student never collide. */
export function caScopeSubjectKey(term: string | undefined | null, subject: string): string {
  const tm = String(term ?? '').trim()
  const sb = String(subject ?? '').trim()
  return tm ? `${tm}::${sb}` : sb
}

/** Resolve the matching key inside `scoresJson` or `classSheetJson` with backward-compatible fallback. */
export function resolveScopedSubjectMapKey(
  mapObj: Record<string, any>,
  subject: string,
  term?: string | null,
  primaryTerm?: string | null,
): string {
  const sb = String(subject ?? '').trim()
  const tm = String(term ?? '').trim()
  if (tm) {
    const exactScoped = `${tm}::${sb}`
    const foundScoped = Object.keys(mapObj).find(
      (k) => k.trim().toLowerCase() === exactScoped.toLowerCase(),
    )
    if (foundScoped) return foundScoped
  }
  // Fallback to legacy unscoped subject key when reading single-term or primary-term data
  const isPrimaryOrUnspecified =
    !tm || !primaryTerm || tm.toLowerCase() === String(primaryTerm).trim().toLowerCase()
  if (isPrimaryOrUnspecified) {
    const legacyKey = Object.keys(mapObj).find(
      (k) => !k.includes('::') && k.trim().toLowerCase() === sb.toLowerCase(),
    )
    if (legacyKey) return legacyKey
  }
  return tm ? `${tm}::${sb}` : sb
}

export function distFieldKey(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .replace(/^./, (c) => c.toLowerCase())
}

/** True when a Mark Distribution item represents the terminal/written Exam paper rather than CA. */
export function isExamDistributionPart(name: string): boolean {
  const n = name.trim().toLowerCase()
  return /\bexams?\b/.test(n) || /^terminal\b/.test(n) || /^written\b/.test(n) || /^final\s+paper\b/.test(n)
}

/** True when a CA distribution item is an aggregate bucket (e.g. "Class Score", "SBA (50%)", "CA") rather than a specific activity. */
export function isAggregateCaPart(name: string): boolean {
  const n = name.trim().toLowerCase()
  return (
    /^sba\b/.test(n) ||
    /^ca\b/.test(n) ||
    /^class\s*score\b/.test(n) ||
    /^continuous\s*assessment\b/.test(n)
  )
}

export type ParsedExamDistribution = {
  allParts: { name: string; maxMarks: number; isExam: boolean; isAggregateCa: boolean }[]
  caParts: { name: string; maxMarks: number; isAggregateCa: boolean }[]
  examParts: { name: string; maxMarks: number }[]
  concreteActivities: { name: string; maxScore: number }[]
  caTotalMax: number
  examTotalMax: number
  inferredClassScorePct: number | null
}

/** Inspect an Exam Setup row alongside `records.markDistribution` to extract CA vs Exam weights & activities. */
export function inspectExamDistribution(
  records: EduRecords,
  examRow?: EduRow | null,
): ParsedExamDistribution {
  if (!examRow) {
    return {
      allParts: [],
      caParts: [],
      examParts: [],
      concreteActivities: [],
      caTotalMax: 0,
      examTotalMax: 0,
      inferredClassScorePct: null,
    }
  }

  const mdRows = records.markDistribution ?? []
  const names = parseDistNames(
    (examRow as any).markDistribution ?? (examRow as any).markDistributions ?? (examRow as any).distribution,
  )

  const allParts = names.map((name) => {
    const md = mdRows.find(
      (m) => String(m.name ?? '').trim().toLowerCase() === name.trim().toLowerCase(),
    )
    const pctMatch = name.match(/\((\d+(?:\.\d+)?)%\)/)
    const isExam = isExamDistributionPart(name)
    const isAggregateCa = !isExam && isAggregateCaPart(name)

    let fallbackMax = 0
    if (isAggregateCa && examRow.classScorePct) fallbackMax = Number(examRow.classScorePct)
    else if (isExam && examRow.examScorePct) fallbackMax = Number(examRow.examScorePct)

    const rawMax = Number(md?.maxMarks ?? (pctMatch ? pctMatch[1] : fallbackMax))
    const maxMarks = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0
    return { name, maxMarks, isExam, isAggregateCa }
  })

  const caParts = allParts
    .filter((p) => !p.isExam)
    .map(({ name, maxMarks, isAggregateCa }) => ({ name, maxMarks, isAggregateCa }))
  const examParts = allParts
    .filter((p) => p.isExam)
    .map(({ name, maxMarks }) => ({ name, maxMarks }))

  const caTotalMax = caParts.reduce((s, p) => s + p.maxMarks, 0)
  const examTotalMax = examParts.reduce((s, p) => s + p.maxMarks, 0)

  let inferredClassScorePct: number | null = null
  if (examRow.classScorePct && Number.isFinite(Number(examRow.classScorePct)) && Number(examRow.classScorePct) > 0) {
    inferredClassScorePct = Math.round(Number(examRow.classScorePct))
  } else if (caTotalMax > 0 && examTotalMax > 0) {
    inferredClassScorePct = Math.round((caTotalMax / (caTotalMax + examTotalMax)) * 100)
  } else if (caTotalMax > 0 && caTotalMax < 100 && examParts.length > 0) {
    inferredClassScorePct = Math.round(caTotalMax)
  }

  const concreteActivities = caParts
    .filter((p) => !p.isAggregateCa)
    .map((p) => ({ name: p.name, maxScore: p.maxMarks > 0 ? p.maxMarks : 10 }))

  return {
    allParts,
    caParts,
    examParts,
    concreteActivities,
    caTotalMax,
    examTotalMax,
    inferredClassScorePct,
  }
}

/** Resolve the linked Exam Setup row for a specific term (or primary term) of a Continuous Assessment record. */
export function resolveLinkedExamForTerm(
  records: EduRecords,
  caRow?: EduRow | null,
  term?: string | null,
): EduRow | null {
  if (!caRow) return null
  const exams = records.examSetup ?? []
  if (!exams.length) return null

  const links = getCaExamLinks(caRow)
  const terms = getCaTerms(caRow)
  const targetTerm = String(term ?? terms[0] ?? '').trim()

  if (targetTerm) {
    const linkKey = Object.keys(links).find(
      (k) => k.trim().toLowerCase() === targetTerm.toLowerCase(),
    )
    const linkEntry = linkKey ? links[linkKey] : undefined
    if (linkEntry?.examId) {
      const byId = exams.find((e) => e.id === linkEntry.examId)
      if (byId) return byId
    }
    if (linkEntry?.examName) {
      const byName = exams.find(
        (e) => String(e.examName ?? '').trim().toLowerCase() === linkEntry.examName.trim().toLowerCase(),
      )
      if (byName) return byName
    }
  }

  // Fallback for single-term or legacy fields when targetTerm matches primary term (or only 1 term)
  if (!targetTerm || terms.length <= 1 || targetTerm.toLowerCase() === (terms[0] ?? '').toLowerCase()) {
    if (caRow.examId) {
      const byId = exams.find((e) => e.id === caRow.examId)
      if (byId) return byId
    }
    const caExamName = String(caRow.examName ?? '').trim().toLowerCase()
    if (caExamName) {
      const byName = exams.find(
        (e) => String(e.examName ?? '').trim().toLowerCase() === caExamName,
      )
      if (byName) return byName
    }
  }

  if (targetTerm) {
    const sameTerm = exams.filter(
      (e) => String(e.term ?? '').trim().toLowerCase() === targetTerm.toLowerCase(),
    )
    const withCa = sameTerm.find((e) => inspectExamDistribution(records, e).caParts.length > 0)
    if (withCa) return withCa
    if (sameTerm[0]) return sameTerm[0]
  }

  return null
}

/** Resolve primary linked Exam Setup row (backward-compatible helper). */
export function resolveLinkedExam(records: EduRecords, caRow?: EduRow | null): EduRow | null {
  return resolveLinkedExamForTerm(records, caRow, getCaTerms(caRow)[0])
}

/** Resolve ALL unique Exam Setup rows linked across all terms of a Continuous Assessment record. */
export function resolveAllLinkedExams(records: EduRecords, caRow?: EduRow | null): EduRow[] {
  if (!caRow) return []
  const seen = new Set<string>()
  const result: EduRow[] = []
  for (const tm of getCaTerms(caRow)) {
    const ex = resolveLinkedExamForTerm(records, caRow, tm)
    if (ex && !seen.has(ex.id)) {
      seen.add(ex.id)
      result.push(ex)
    }
  }
  if (result.length === 0) {
    const primary = resolveLinkedExamForTerm(records, caRow, null)
    if (primary) result.push(primary)
  }
  return result
}

/** Check whether a Continuous Assessment record is linked to a given Exam Setup row, returning the matched term if linked. */
export function matchCaTermForExam(
  records: EduRecords,
  caRow: EduRow,
  examRow: EduRow,
): string | null {
  const links = getCaExamLinks(caRow)
  for (const [tm, entry] of Object.entries(links)) {
    if (entry.examId && entry.examId === examRow.id) return tm
    if (
      entry.examName &&
      entry.examName.trim().toLowerCase() === String(examRow.examName ?? '').trim().toLowerCase()
    ) {
      return tm
    }
  }
  if (caRow.examId && caRow.examId === examRow.id) {
    return String(examRow.term ?? '').trim() || getCaTerms(caRow)[0] || 'Term 1'
  }
  const exName = String(examRow.examName ?? '').trim().toLowerCase()
  if (
    exName &&
    parseDistNames(caRow.examName).some((n) => n.toLowerCase() === exName)
  ) {
    return String(examRow.term ?? '').trim() || getCaTerms(caRow)[0] || 'Term 1'
  }
  for (const tm of getCaTerms(caRow)) {
    if (resolveLinkedExamForTerm(records, caRow, tm)?.id === examRow.id) {
      return tm
    }
  }
  return null
}

export function isCaLinkedToExam(records: EduRecords, caRow: EduRow, examRow: EduRow): boolean {
  return matchCaTermForExam(records, caRow, examRow) !== null
}

export function caAppliesToClassSection(
  caRow: EduRow,
  className?: string,
  section?: string,
): boolean {
  const clsKey = String(className ?? '').trim().toLowerCase()
  const secKey = normCaSec(String(section ?? ''))
  if (clsKey) {
    const classes = getCaClasses(caRow)
    if (!classes.some((c) => c.toLowerCase() === clsKey)) return false
  }
  if (secKey) {
    const secs = getCaSections(caRow)
    if (secs.length > 0 && !secs.some((s) => normCaSec(s) === secKey)) return false
  }
  return true
}

/**
 * Determine whether an Exam Setup row is synced/linked with Continuous Assessment,
 * and return the matching CA record (for class+section+term if available) + CA/Exam max marks & grading scheme.
 */
export function resolveExamCaSyncState(
  records: EduRecords,
  examRow?: EduRow | null,
  className?: string,
  section?: string,
): {
  isSynced: boolean
  classSectionCa: EduRow | null
  anyLinkedCa: EduRow | null
  matchedTerm: string
  caMax: number
  examMax: number
  gradingScheme: GradingSchemeId
} {
  if (!examRow) {
    return {
      isSynced: false,
      classSectionCa: null,
      anyLinkedCa: null,
      matchedTerm: 'Term 1',
      caMax: 50,
      examMax: 50,
      gradingScheme: 'standard',
    }
  }

  const assessments: EduRow[] = ((records as any).continuousAssessments ?? []) as EduRow[]
  const allForExam = assessments.filter((ca) => isCaLinkedToExam(records, ca, examRow))

  const clsKey = String(className ?? '').trim().toLowerCase()
  const classSectionCa = clsKey
    ? allForExam.find((ca) => caAppliesToClassSection(ca, className, section)) ?? null
    : null

  const anyLinkedCa = classSectionCa ?? allForExam[0] ?? null
  const matchedTerm =
    (classSectionCa ? matchCaTermForExam(records, classSectionCa, examRow) : null) ??
    (anyLinkedCa ? matchCaTermForExam(records, anyLinkedCa, examRow) : null) ??
    (String(examRow.term ?? '').trim() || 'Term 1')

  const explicitlySyncedOnExam = String(examRow.caSynced ?? '').toLowerCase() === 'yes'
  const isSynced = Boolean(classSectionCa || allForExam.length > 0 || explicitlySyncedOnExam)

  const distInfo = inspectExamDistribution(records, examRow)
  const rawCaPct = Number(
    classSectionCa?.classScorePct ??
      anyLinkedCa?.classScorePct ??
      examRow.classScorePct ??
      distInfo.inferredClassScorePct ??
      50,
  )
  const caMax = Number.isFinite(rawCaPct) && rawCaPct > 0 && rawCaPct <= 100 ? rawCaPct : 50
  const examMax = Math.max(0, 100 - caMax)
  const gradingScheme = ((classSectionCa?.gradingScheme ??
    anyLinkedCa?.gradingScheme ??
    examRow.gradingScheme ??
    'standard') as GradingSchemeId)

  return {
    isSynced,
    classSectionCa,
    anyLinkedCa,
    matchedTerm,
    caMax,
    examMax,
    gradingScheme,
  }
}

/** Compute a student's scaled Class Score (out of `caMax`) and optional Exam score from a Continuous Assessment row. */
export function computeStudentCaScoreFromRow(
  caRow: EduRow | null | undefined,
  subject: string,
  studentId: string,
  caMaxOverride?: number,
  termOverride?: string | null,
): { caScore: number | null; examScore: number | null } {
  if (!caRow) return { caScore: null, examScore: null }
  const caMax = caMaxOverride ?? (Number(caRow.classScorePct ?? 50) || 50)
  const primaryTerm = getCaTerms(caRow)[0] ?? 'Term 1'
  const effectiveTerm = String(termOverride ?? primaryTerm).trim()

  let acts: CaActivityItem[] = []
  let caScores: Record<string, Record<string, Record<string, string>>> = {}
  let csMap: Record<string, Record<string, { ca: string; exam: string }>> = {}
  try {
    const p = JSON.parse(String(caRow.activitiesJson || '[]'))
    if (Array.isArray(p)) acts = p
  } catch { /* ignore */ }
  try {
    const p = JSON.parse(String(caRow.scoresJson || '{}'))
    if (p && typeof p === 'object') caScores = p
  } catch { /* ignore */ }
  try {
    const p = JSON.parse(String(caRow.classSheetJson || '{}'))
    if (p && typeof p === 'object') csMap = p
  } catch { /* ignore */ }

  const subjKeyForScores = resolveScopedSubjectMapKey(caScores, subject, effectiveTerm, primaryTerm)
  const subjKeyForCs = resolveScopedSubjectMapKey(csMap, subject, effectiveTerm, primaryTerm)

  const stActScores = caScores[subjKeyForScores]?.[studentId] ?? {}
  const stCs = csMap[subjKeyForCs]?.[studentId]

  const rawActMax = acts.reduce((s, a) => s + (Number(a.maxScore) || 0), 0)
  let hasAct = false
  let rawSum = 0
  for (const a of acts) {
    const v = String(stActScores[a.id] ?? '').trim()
    if (v !== '' && Number.isFinite(Number(v))) {
      hasAct = true
      rawSum += Number(v)
    }
  }

  let caScore: number | null = null
  if (hasAct && rawActMax > 0) {
    caScore = Number(((rawSum / rawActMax) * caMax).toFixed(2))
  } else if (stCs && String(stCs.ca ?? '').trim() !== '' && Number.isFinite(Number(stCs.ca))) {
    caScore = Number(Number(stCs.ca).toFixed(2))
  }

  let examScore: number | null = null
  if (stCs && String(stCs.exam ?? '').trim() !== '' && Number.isFinite(Number(stCs.exam))) {
    examScore = Number(Number(stCs.exam).toFixed(2))
  }

  return { caScore, examScore }
}

/** Merge concrete CA activities from Exam Setup into an assessment's existing activities list without losing IDs/scores. */
export function mergeActivitiesFromExam(
  existing: CaActivityItem[],
  fromExam: { name: string; maxScore: number }[],
): CaActivityItem[] {
  if (!fromExam.length) return existing
  const next = [...existing]
  for (const item of fromExam) {
    const idx = next.findIndex((a) => a.name.trim().toLowerCase() === item.name.trim().toLowerCase())
    if (idx >= 0) {
      next[idx] = { ...next[idx], maxScore: item.maxScore }
    } else {
      next.push({ id: uid(), name: item.name, maxScore: item.maxScore })
    }
  }
  return next
}

/**
 * Sync a Continuous Assessment's Class Score % / Exam % structure into `examSetup` and `markDistribution`
 * using the canonical terminal columns `["Class Score", "Exam"]` so Mark Entries populates
 * Student Name, Register No, Roll, Is Absent, Class Score, Exam, Total, and Grade.
 */
export function buildExamSetupSyncPatch(
  records: EduRecords,
  params: {
    examRow?: EduRow | null
    desiredExamName?: string
    term: string
    caWeightPct: number
    gradingScheme?: GradingSchemeId
    activities: CaActivityItem[]
  },
): {
  examSetup: EduRow[]
  markDistribution: EduRow[]
  syncedExam: EduRow
} {
  const { examRow, desiredExamName, term, caWeightPct, gradingScheme = 'standard' } = params
  const examWeightPct = Math.max(0, 100 - caWeightPct)
  const mdList: EduRow[] = [...(records.markDistribution ?? [])]

  const upsertMd = (name: string, maxMarks: number, sortOrder: number) => {
    const idx = mdList.findIndex(
      (m) => String(m.name ?? '').trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (idx >= 0) {
      mdList[idx] = {
        ...mdList[idx],
        name,
        maxMarks: String(maxMarks),
      }
      return name
    }
    mdList.push({
      id: uid(),
      name,
      maxMarks: String(maxMarks),
      sortOrder: String(Math.min(10, Math.max(1, sortOrder))),
    })
    return name
  }

  const distNames: string[] = [upsertMd('Class Score', caWeightPct, 1)]
  if (examWeightPct > 0) {
    distNames.push(upsertMd('Exam', examWeightPct, 2))
  }

  const examList: EduRow[] = [...(records.examSetup ?? [])]
  let syncedExam: EduRow

  if (examRow) {
    syncedExam = {
      ...examRow,
      examName: desiredExamName?.trim() || String(examRow.examName ?? ''),
      term: term || String(examRow.term ?? ''),
      markDistribution: JSON.stringify(distNames),
      caSynced: 'Yes',
      classScorePct: String(caWeightPct),
      examScorePct: String(examWeightPct),
      gradingScheme,
    }
    const idx = examList.findIndex((e) => e.id === examRow.id)
    if (idx >= 0) examList[idx] = syncedExam
    else examList.push(syncedExam)
  } else {
    syncedExam = {
      id: uid(),
      examName: desiredExamName?.trim() || `${term} Examination`,
      examType: 'Marks And Grade',
      term,
      markDistribution: JSON.stringify(distNames),
      publish: 'Yes',
      publishResult: 'No',
      caSynced: 'Yes',
      classScorePct: String(caWeightPct),
      examScorePct: String(examWeightPct),
      gradingScheme,
      remarks: 'Synced with Continuous Assessment.',
    }
    examList.push(syncedExam)
  }

  return {
    examSetup: examList,
    markDistribution: mdList,
    syncedExam,
  }
}

/**
 * When an Exam Setup row is created or updated in Exam Setup, propagate name/term/distribution
 * changes to all linked Continuous Assessments (including multi-term examLinksJson).
 */
export function propagateExamSetupToContinuousAssessments(
  records: EduRecords,
  savedExam: EduRow,
  previousExam?: EduRow,
): EduRow[] | null {
  const assessments: EduRow[] = ((records as any).continuousAssessments ?? []) as EduRow[]
  if (!assessments.length) return null

  const prevName = String(previousExam?.examName ?? '').trim().toLowerCase()
  const nextName = String(savedExam.examName ?? '').trim()
  const parsed = inspectExamDistribution(records, savedExam)

  let changed = false
  const updated = assessments.map((ca) => {
    const links = getCaExamLinks(ca)
    let matchedInLinks = false
    const nextLinks: Record<string, CaExamLinkEntry> = { ...links }

    for (const [tm, entry] of Object.entries(links)) {
      const idMatch = entry.examId && entry.examId === savedExam.id
      const oldNameMatch = !entry.examId && prevName && entry.examName.trim().toLowerCase() === prevName
      const newNameMatch = !entry.examId && nextName && entry.examName.trim().toLowerCase() === nextName.toLowerCase()
      if (idMatch || oldNameMatch || newNameMatch) {
        matchedInLinks = true
        nextLinks[tm] = { examId: savedExam.id, examName: nextName }
      }
    }

    const matchesPrimaryId = ca.examId && ca.examId === savedExam.id
    const matchesOldName =
      !ca.examId &&
      prevName &&
      String(ca.examName ?? '').trim().toLowerCase() === prevName
    const matchesNewName =
      !ca.examId &&
      nextName &&
      String(ca.examName ?? '').trim().toLowerCase() === nextName.toLowerCase()

    if (!matchedInLinks && !matchesPrimaryId && !matchesOldName && !matchesNewName) return ca

    changed = true
    let existingActs: CaActivityItem[] = []
    try {
      const p = JSON.parse(String(ca.activitiesJson || '[]'))
      if (Array.isArray(p)) existingActs = p
    } catch {
      /* ignore */
    }
    const mergedActs = mergeActivitiesFromExam(existingActs, parsed.concreteActivities)
    const nextCaPct =
      parsed.inferredClassScorePct !== null
        ? parsed.inferredClassScorePct
        : Number(ca.classScorePct ?? 50) || 50

    const terms = getCaTerms(ca)
    const nextExamNames = cleanList(Object.values(nextLinks).map((v) => v.examName))

    return {
      ...ca,
      examId: matchesPrimaryId || terms.length <= 1 ? savedExam.id : ca.examId,
      examName: nextExamNames.length ? nextExamNames.join(', ') : nextName,
      examLinksJson: Object.keys(nextLinks).length ? JSON.stringify(nextLinks) : ca.examLinksJson ?? '',
      term: terms.length <= 1 ? String(savedExam.term ?? '').trim() || ca.term : ca.term,
      classScorePct: String(nextCaPct),
      examScorePct: String(Math.max(0, 100 - nextCaPct)),
      activitiesJson: JSON.stringify(mergedActs),
    }
  })

  return changed ? updated : null
}

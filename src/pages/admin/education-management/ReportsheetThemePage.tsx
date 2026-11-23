import { ensureSemesterResultTheme } from '../../../lib/semesterResultTheme'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { CustomSubjectTable, type SubjectColumn } from './CustomSubjectTable'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, ChevronRight, Palette, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { Button, PageHeader } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import {
  REPORTSHEET_THEMES,
  applyReportsheetThemeToRecords,
  deleteReportsheetThemeFromRecords,
  findReportsheetTheme,
  getActiveReportsheetTheme,
  getAllReportsheetThemes,
  hasDeletedBuiltinReportsheetThemes,
  restoreDefaultReportsheetThemesToRecords,
  type ReportsheetThemeDef,
  type ReportsheetThemeId,
} from '../../../lib/reportsheetThemes'

function resolveExamPartsForTheme(examName: string | undefined, records: EduRecords): Array<{ name: string; max: number }> | undefined {
  const target = String(examName ?? '').trim()
  if (!target) return undefined
  const examRow = ((records.examSetup ?? []) as EduRow[]).find(
    (r) => String(r.examName ?? r.name ?? '').trim() === target,
  )
  const names = parseMultiSelectValues(examRow?.markDistribution).map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) return undefined
  const distRows = (records.markDistribution ?? []) as EduRow[]
  return names.map((name) => {
    const match = distRows.find((d) => String(d.name ?? '').trim().toLowerCase() === name.toLowerCase())
    const max = Number(match?.maxMarks)
    return { name, max: Number.isFinite(max) && max > 0 ? max : 20 }
  })
}

interface SampleSubjectRow {
  subject: string
  classScore: number
  examScore: number
  colScores: number[]
  total: number
  position: string
  grade: string
  remarks: string
}

const SAMPLE_SUBJECTS_BASE: Array<{ subject: string; caRatio: number; exRatio: number; position: string }> = [
  { subject: 'Ghanaian Language Twi', caRatio: 0.86, exRatio: 0.90, position: '1st' },
  { subject: 'Computing', caRatio: 0.85, exRatio: 0.88, position: '2nd' },
  { subject: 'Creative Arts', caRatio: 0.80, exRatio: 0.87, position: '3rd' },
  { subject: 'Mathematics', caRatio: 0.88, exRatio: 0.93, position: '1st' },
  { subject: 'Integrated Science', caRatio: 0.79, exRatio: 0.84, position: '4th' },
  { subject: 'English Language', caRatio: 0.82, exRatio: 0.88, position: '2nd' },
  { subject: 'History of Ghana', caRatio: 0.76, exRatio: 0.83, position: '5th' },
  { subject: 'Religious and Moral Education', caRatio: 0.90, exRatio: 0.88, position: '1st' },
]

/** Exact sample subjects & performance ratios used by Theme 1 (Classic Marksheet Template). */
const CLASSIC_MARKSHEET_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Integrated Science',
  'Social Studies',
  'Information & Communication Technology',
]
const CLASSIC_MARKSHEET_RATIOS = [0.90, 0.85, 0.78, 0.78, 0.95]

function letterGradeForPct(pct: number): string {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  return 'F'
}

function remarkForTotal(total: number): { grade: string; remarks: string } {
  if (total >= 80) return { grade: '1', remarks: 'Excellent' }
  if (total >= 70) return { grade: '2', remarks: 'Very Good' }
  if (total >= 60) return { grade: '3', remarks: 'Good' }
  if (total >= 50) return { grade: '4', remarks: 'Credit' }
  return { grade: '5', remarks: 'Pass' }
}

function TeacherSignatureSvg({ variant = 'left', color = '#1e293b' }: { variant?: 'left' | 'right'; color?: string }) {
  if (variant === 'right') {
    return (
      <svg width="92" height="24" viewBox="0 0 92 24" fill="none" aria-hidden="true">
        <path
          d="M14 19C19 10 23 5 26 5C29 5 25 18 29 18C33 18 39 9 43 9C46 9 44 17 48 17C53 17 61 11 76 13"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg width="104" height="24" viewBox="0 0 104 24" fill="none" aria-hidden="true">
      <path
        d="M8 18C14 8 20 4 24 6C28 8 20 19 25 19C30 19 37 8 42 8C46 8 43 17 47 17C52 17 57 10 62 11C66 12 65 17 70 17C76 17 84 12 96 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DashedHolderBox({
  src,
  label,
  height,
  minWidth,
}: {
  src?: string
  label: string
  height: number
  minWidth: number
}) {
  if (src && src.startsWith('data:')) {
    return <img src={src} alt={label} draggable={false} style={{ height, objectFit: 'contain' }} />
  }
  return (
    <div
      style={{
        height,
        minWidth,
        display: 'inline-block',
        border: '1px dashed #c9c9c0',
        borderRadius: 3,
        fontSize: 7,
        color: '#9ca3af',
        textAlign: 'center',
        lineHeight: `${height}px`,
        padding: '0 6px',
      }}
    >
      {label}
    </div>
  )
}

// --- Content editing helpers (shared with Theme 1 classic renderer) ---

const MARKSHEET_BOX_TOKENS = ['logo', 'student_photo', 'left_signature', 'middle_signature', 'right_signature']

function resolveLineText(text: string, samples: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/gi, (whole, t) => samples[String(t).toLocaleLowerCase()] ?? whole)
}

function stripAlignWrapper(s: string): string {
  return String(s ?? '').replace(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(?:left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i, '$1')
}

function hasInlineHtml(s: string): boolean {
  return /<(b|i|u|s|a|span|div|h2|h3|strong|em)\b/i.test(s)
}

function contentLines(raw: unknown): string[] {
  return String(raw ?? '').split('\n').filter((l, i, a) => a.length > 1 || l.trim())
}

/** Footer lines are grouped into columns: a blank line starts a new column. */
function groupFooterLines(lines: string[]): string[][] {
  const groups: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (!String(line ?? '').trim()) {
      if (current.length) { groups.push(current); current = [] }
      continue
    }
    current.push(line)
  }
  if (current.length) groups.push(current)
  return groups
}

const isBoxLine = (line: string): boolean =>
  MARKSHEET_BOX_TOKENS.some((token) => String(line ?? '').includes(`{${token}}`))

function parseMultiSelectValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String) } catch { /* not JSON */ }
  }
  return []
}

export interface CustomSubjectEntry {
  subject: string
  classScore?: number
  examScore?: number
  partScores?: number[]
  position?: string
  grade?: string
  remarks?: string
}

export interface ThemeElementOverride {
  text?: string
  imageSrc?: string
  caption?: string
  hidden?: boolean
  offsetX?: number
  offsetY?: number
  width?: number
  height?: number
  style?: Record<string, unknown>
}

/**
 * Crisp A4 sheet renderer (560 x 780 base logical size) for all 6 Terminal Report
 * Sheet themes (Themes 1–5 + Theme 6 Classic Marksheet Template).
 * Uses explicit print-safe light colors so dark mode on the dashboard never alters
 * the white paper appearance.
 */
export function ReportsheetSheetRenderer({
  themeId,
  schoolName,
  schoolAddress,
  schoolPhone,
  schoolEmail,
  examName,
  logoDataUrl,
  studentPhotoDataUrl,
  leftSignatureDataUrl,
  middleSignatureDataUrl,
  rightSignatureDataUrl,
  templateCaption,
  parts,
  caWeight = 30,
  examWeight = 70,
  academicYear = '2025/2026',
  termLabel = '1',
  // Form field props for editable preview (Themes 2–6)
  headerContent,
  footerContent,
  reportOptions,
  photoStyle,
  topSpace,
  bottomSpace,
  leftSpace,
  rightSpace,
  backgroundImage,
  accentColorOverride,
  templateName,
  subjects: subjectsProp,
  customSubjects: customSubjectsProp,
  subjectCatalog,
  elementOverrides: elementOverridesProp,
  showPosition: showPositionProp,
  showGrade: showGradeProp,
  showRemark: showRemarkProp,
  showClassAvg: showClassAvgProp,
  showSubjectAvg: showSubjectAvgProp,
  renderPublishedOverlays = true,
}: {
  themeId: ReportsheetThemeId
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolEmail?: string
  examName?: string
  logoDataUrl?: string
  studentPhotoDataUrl?: string
  leftSignatureDataUrl?: string
  middleSignatureDataUrl?: string
  rightSignatureDataUrl?: string
  templateCaption?: string
  parts?: Array<{ name: string; max: number }>
  caWeight?: number
  examWeight?: number
  academicYear?: string
  termLabel?: string
  // Form field props for editable preview
  headerContent?: string
  footerContent?: string
  reportOptions?: string
  photoStyle?: string
  topSpace?: string
  bottomSpace?: string
  leftSpace?: string
  rightSpace?: string
  backgroundImage?: string
  accentColorOverride?: string
  templateName?: string
  subjects?: string[]
  customSubjects?: CustomSubjectEntry[]
  subjectCatalog?: EduRow[]
  elementOverrides?: Record<string, ThemeElementOverride>
  showPosition?: boolean
  showGrade?: boolean
  showRemark?: boolean
  showClassAvg?: boolean
  showSubjectAvg?: boolean
  renderPublishedOverlays?: boolean
}) {
  const matchedThemeDef = useMemo(() => findReportsheetTheme(themeId), [themeId])
  const effectiveThemeId = matchedThemeDef.baseThemeId || themeId

  const publishedSpec = useMemo(() => {
    if (!matchedThemeDef.isCustom) return null
    type SavedEl = {
      id: string
      type: string
      label: string
      x: number
      y: number
      width: number
      height: number
      offsetX?: number
      offsetY?: number
      text?: string
      imageSrc?: string
      caption?: string
      hidden?: boolean
      field?: string
      style?: Record<string, unknown>
    }
    let parsedElements: SavedEl[] = []
    let parsedCells: Record<string, ThemeElementOverride> = {}
    let parsedSettings: Record<string, unknown> = {}
    try {
      if (matchedThemeDef.canvasElementsJson) {
        const arr = JSON.parse(matchedThemeDef.canvasElementsJson)
        if (Array.isArray(arr)) parsedElements = arr
      }
    } catch { /* ignore */ }
    try {
      if (matchedThemeDef.tableCellOverridesJson) {
        const obj = JSON.parse(matchedThemeDef.tableCellOverridesJson)
        if (obj && typeof obj === 'object') parsedCells = obj
      }
    } catch { /* ignore */ }
    try {
      if (matchedThemeDef.canvasSettingsJson) {
        const obj = JSON.parse(matchedThemeDef.canvasSettingsJson)
        if (obj && typeof obj === 'object') parsedSettings = obj
      }
    } catch { /* ignore */ }

    const overrides: Record<string, ThemeElementOverride> = { ...parsedCells }
    const customEls: SavedEl[] = []
    let tableStyle: Record<string, unknown> | undefined
    for (const el of parsedElements) {
      if (!tableStyle && (el.id === 'subject-table' || el.type === 'table')) {
        tableStyle = el.style
      }
      if (String(el.id ?? '').startsWith('id_')) {
        customEls.push(el)
      } else if (el.id) {
        overrides[el.id] = {
          text: el.text,
          imageSrc: el.imageSrc,
          caption: el.caption,
          hidden: el.hidden,
          offsetX: el.offsetX,
          offsetY: el.offsetY,
          width: el.width,
          height: el.height,
          style: el.style,
        }
      }
    }
    return { overrides, customEls, tableStyle, settings: parsedSettings }
  }, [matchedThemeDef])

  const elementOverrides = elementOverridesProp ?? publishedSpec?.overrides
  const subjects = subjectsProp ?? (publishedSpec?.tableStyle?.subjects as string[] | undefined)
  const customSubjects = customSubjectsProp ?? (publishedSpec?.tableStyle?.customSubjects as CustomSubjectEntry[] | undefined)
  const effectiveCaWeight =
    publishedSpec?.tableStyle?.caWeight !== undefined && elementOverridesProp === undefined
      ? Number(publishedSpec.tableStyle.caWeight) || caWeight
      : caWeight
  const effectiveExamWeight =
    publishedSpec?.tableStyle?.examWeight !== undefined && elementOverridesProp === undefined
      ? Number(publishedSpec.tableStyle.examWeight) || examWeight
      : examWeight
  const showPosition =
    showPositionProp !== undefined
      ? showPositionProp
      : publishedSpec?.tableStyle?.showPosition !== false
  const showGrade =
    showGradeProp !== undefined
      ? showGradeProp
      : publishedSpec?.tableStyle?.showGrade !== false
  const showRemark =
    showRemarkProp !== undefined
      ? showRemarkProp
      : publishedSpec?.tableStyle?.showRemark !== false
  const showClassAvg =
    showClassAvgProp !== undefined
      ? showClassAvgProp
      : publishedSpec?.tableStyle?.showClassAvg !== false
  const showSubjectAvg =
    showSubjectAvgProp !== undefined
      ? showSubjectAvgProp
      : publishedSpec?.tableStyle?.showSubjectAvg !== false
  const effectiveLogoDataUrl =
    logoDataUrl ||
    (typeof publishedSpec?.settings?.schoolLogo === 'string' && publishedSpec.settings.schoolLogo
      ? publishedSpec.settings.schoolLogo
      : undefined)
  const effectiveExamName =
    examName ||
    matchedThemeDef.examName ||
    (typeof publishedSpec?.settings?.examName === 'string' ? publishedSpec.settings.examName : undefined)
  const effectiveReportOptions = reportOptions || matchedThemeDef.reportOptionsJson
  const effectiveTopSpace =
    topSpace !== undefined
      ? topSpace
      : publishedSpec?.settings?.marginTop !== undefined
        ? String(publishedSpec.settings.marginTop)
        : undefined
  const effectiveBottomSpace =
    bottomSpace !== undefined
      ? bottomSpace
      : publishedSpec?.settings?.marginBottom !== undefined
        ? String(publishedSpec.settings.marginBottom)
        : undefined
  const effectiveLeftSpace =
    leftSpace !== undefined
      ? leftSpace
      : publishedSpec?.settings?.marginLeft !== undefined
        ? String(publishedSpec.settings.marginLeft)
        : undefined
  const effectiveRightSpace =
    rightSpace !== undefined
      ? rightSpace
      : publishedSpec?.settings?.marginRight !== undefined
        ? String(publishedSpec.settings.marginRight)
        : undefined

  const ov = (id: string): ThemeElementOverride | undefined => elementOverrides?.[id]
  const ovText = (id: string, fallback: string): string => {
    const val = elementOverrides?.[id]?.text
    return val !== undefined ? val : fallback
  }
  const ovStyle = (id: string, base: React.CSSProperties = {}): React.CSSProperties => {
    const item = elementOverrides?.[id]
    if (!item) return base
    const next: React.CSSProperties = { ...base }
    if (item.hidden) {
      next.display = 'none'
      return next
    }
    const dx = item.offsetX ?? 0
    const dy = item.offsetY ?? 0
    if (dx !== 0 || dy !== 0) {
      next.transform = `translate(${dx}px, ${dy}px)`
      if (!next.position) next.position = 'relative'
      next.zIndex = 3
    }
    const s = item.style
    if (s?.customSize) {
      if (item.width !== undefined && item.width > 0) next.width = item.width
      if (item.height !== undefined && item.height > 0) next.height = item.height
    }
    if (s) {
      if (s.fontFamily) next.fontFamily = String(s.fontFamily)
      if (s.fontSize !== undefined) next.fontSize = Number(s.fontSize)
      if (s.color) next.color = String(s.color)
      if (s.align) {
        next.textAlign = s.align as React.CSSProperties['textAlign']
        if (next.width === 'fit-content' && !s.customSize) {
          if (s.align === 'center') {
            next.marginLeft = 'auto'
            next.marginRight = 'auto'
          } else if (s.align === 'right') {
            next.marginLeft = 'auto'
            next.marginRight = 0
          } else if (s.align === 'left') {
            next.marginLeft = 0
            next.marginRight = 'auto'
          }
        }
      }
      if (s.lineHeight !== undefined) next.lineHeight = Number(s.lineHeight)
      if (s.bold !== undefined) next.fontWeight = s.bold ? 700 : 400
      if (s.italic !== undefined) next.fontStyle = s.italic ? 'italic' : 'normal'
      if (s.underline !== undefined) next.textDecoration = s.underline ? 'underline' : 'none'
      if (s.bg) {
        next.background = String(s.bg)
        next.backgroundColor = String(s.bg)
      }
      if (s.borderWidth !== undefined) {
        const bw = Number(s.borderWidth)
        if (bw > 0) {
          next.border = `${bw}px ${(s.borderStyle as string) || 'solid'} ${(s.borderColor as string) || '#a9b1bd'}`
        } else {
          next.border = 'none'
        }
      }
      if (s.radius !== undefined) next.borderRadius = Number(s.radius)
      if (s.padding !== undefined) next.padding = Number(s.padding)
    }
    return next
  }

  const renderThemeLine = (
    elId: string,
    elLabel: string,
    defaultColor: string,
    defaultThickness = 2,
    defaultStyle: 'solid' | 'dashed' | 'dotted' | 'double' = 'solid',
    marginStyle: React.CSSProperties = {},
  ) => {
    const item = ov(elId)
    if (item?.hidden) return null
    const s = item?.style || {}
    const isVert = (s.orientation as string) === 'vertical'
    const thickness = (s.lineThickness as number) ?? defaultThickness
    const lStyle = (s.lineStyle as string) || defaultStyle
    const lColor = (s.bg as string) || (s.color as string) || defaultColor
    const rotation = (s.rotation as number) ?? 0
    const dx = item?.offsetX ?? 0
    const dy = item?.offsetY ?? 0
    const transforms: string[] = []
    if (dx !== 0 || dy !== 0) transforms.push(`translate(${dx}px, ${dy}px)`)
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`)
    const customSize = !!s.customSize

    return (
      <div
        data-element-id={elId}
        data-element-type="line"
        data-element-label={elLabel}
        data-default-color={defaultColor}
        data-default-thickness={String(defaultThickness)}
        data-default-line-style={defaultStyle}
        style={{
          ...marginStyle,
          width: isVert
            ? (customSize && item?.width ? item.width : 12)
            : (customSize && item?.width ? item.width : (marginStyle.width ?? '100%')),
          height: isVert
            ? (customSize && item?.height ? item.height : 120)
            : 'auto',
          padding: isVert ? '0 4px' : (marginStyle.padding ?? '4px 0'),
          marginTop: marginStyle.marginTop ?? -4,
          marginBottom: marginStyle.marginBottom ?? -4,
          alignSelf: customSize ? 'flex-start' : marginStyle.alignSelf,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          zIndex: dx !== 0 || dy !== 0 || rotation !== 0 ? 3 : 2,
          transform: transforms.length > 0 ? transforms.join(' ') : undefined,
        }}
      >
        <div
          style={
            isVert
              ? { width: 0, height: '100%', borderLeft: `${thickness}px ${lStyle} ${lColor}`, pointerEvents: 'none' }
              : { width: '100%', height: 0, borderTop: `${thickness}px ${lStyle} ${lColor}`, pointerEvents: 'none' }
          }
        />
      </div>
    )
  }

  const renderUnderlinedValue = ({
    elId,
    elLabel,
    fallbackText,
    lineId,
    lineLabel,
    lineColor = '#94a3b8',
    lineThickness = 1,
    lineStyle = 'solid',
    align = 'left',
    fontWeight = 600,
    fontSize,
    whiteSpace,
  }: {
    elId: string
    elLabel: string
    fallbackText: string
    lineId: string
    lineLabel: string
    lineColor?: string
    lineThickness?: number
    lineStyle?: 'solid' | 'dashed' | 'dotted' | 'double'
    align?: 'left' | 'center' | 'right'
    fontWeight?: number
    fontSize?: number
    whiteSpace?: React.CSSProperties['whiteSpace']
  }) => {
    const resolvedAlign = (ov(elId)?.style?.align as 'left' | 'center' | 'right' | undefined) || align
    return (
      <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', flexDirection: 'column' }}>
        <span
          data-element-id={elId}
          data-element-type="text"
          data-element-label={elLabel}
          style={ovStyle(elId, {
            width: 'fit-content',
            alignSelf: resolvedAlign === 'center' ? 'center' : resolvedAlign === 'right' ? 'flex-end' : 'flex-start',
            fontWeight,
            fontSize,
            color: '#0f172a',
            paddingBottom: 1,
            textAlign: resolvedAlign,
            whiteSpace,
            cursor: 'pointer',
          })}
        >
          {ovText(elId, fallbackText)}
        </span>
        {renderThemeLine(lineId, lineLabel, lineColor, lineThickness, lineStyle, {
          marginTop: -3,
          marginBottom: -3,
          padding: '3px 0',
        })}
      </span>
    )
  }

  const hasExamParts = Boolean(parts && parts.length > 0)
  const activeScoreComponents = useMemo(() => {
    if (parts && parts.length > 0) {
      return parts.map((p) => ({ name: p.name, max: Number(p.max) > 0 ? Number(p.max) : 10 }))
    }
    return [
      { name: 'Class Score', max: effectiveCaWeight },
      { name: 'Exam', max: effectiveExamWeight },
    ]
  }, [parts, effectiveCaWeight, effectiveExamWeight])
  const activeTotalMax = useMemo(
    () => activeScoreComponents.reduce((sum, c) => sum + c.max, 0) || 100,
    [activeScoreComponents],
  )

  const rows: SampleSubjectRow[] = useMemo(
    () => {
      if (customSubjects && customSubjects.length > 0) {
        return customSubjects.map((entry, idx) => {
          const baseItem = SAMPLE_SUBJECTS_BASE.find((s) => s.subject === entry.subject) || SAMPLE_SUBJECTS_BASE[idx % SAMPLE_SUBJECTS_BASE.length]
          const colScores = activeScoreComponents.map((comp, ci) => {
            if (Array.isArray(entry.partScores) && entry.partScores[ci] !== undefined) {
              return Number(entry.partScores[ci])
            }
            if (!hasExamParts) {
              if (ci === 0 && entry.classScore !== undefined) return Number(entry.classScore)
              if (ci === 1 && entry.examScore !== undefined) return Number(entry.examScore)
            }
            const baseRatio = ci === activeScoreComponents.length - 1 ? baseItem.exRatio : baseItem.caRatio
            const wobble = hasExamParts ? (ci % 2 === 0 ? 0.01 : -0.02) : 0
            const raw = comp.max * Math.min(0.98, Math.max(0.45, baseRatio + wobble))
            return Math.round(raw * 10) / 10
          })
          const total = Math.round(colScores.reduce((sum, v) => sum + v, 0) * 10) / 10
          const pct = (total / activeTotalMax) * 100
          const { grade, remarks } = remarkForTotal(pct)
          return {
            subject: entry.subject,
            classScore: colScores[0] ?? 0,
            examScore: colScores[1] ?? 0,
            colScores,
            total,
            position: entry.position || baseItem.position || `${idx + 1}`,
            grade: entry.grade || grade,
            remarks: entry.remarks || remarks,
          }
        })
      }
      const subjectList = subjects && subjects.length > 0 ? subjects : SAMPLE_SUBJECTS_BASE.map((s) => s.subject)
      return subjectList.map((subject, idx) => {
        const baseItem = SAMPLE_SUBJECTS_BASE.find((s) => s.subject === subject) || SAMPLE_SUBJECTS_BASE[idx % SAMPLE_SUBJECTS_BASE.length]
        const colScores = activeScoreComponents.map((comp, ci) => {
          const baseRatio = ci === activeScoreComponents.length - 1 ? baseItem.exRatio : baseItem.caRatio
          const wobble = hasExamParts ? (ci % 2 === 0 ? 0.01 : -0.02) : 0
          const raw = comp.max * Math.min(0.98, Math.max(0.45, baseRatio + wobble))
          return Math.round(raw * 10) / 10
        })
        const total = Math.round(colScores.reduce((sum, v) => sum + v, 0) * 10) / 10
        const pct = (total / activeTotalMax) * 100
        const { grade, remarks } = remarkForTotal(pct)
        return {
          subject,
          classScore: colScores[0] ?? 0,
          examScore: colScores[1] ?? 0,
          colScores,
          total,
          position: baseItem.position,
          grade,
          remarks,
        }
      })
    },
    [activeScoreComponents, activeTotalMax, hasExamParts, subjects, customSubjects],
  )

  // --- Form field parsing for editable preview (Themes 2–6) ---
  const samples: Record<string, string> = {
    institute_name: schoolName || 'School',
    institute_address: schoolAddress || 'Accra, Greater Accra',
    institute_email: schoolEmail || 'info@example.edu.gh',
    institute_phone_no: schoolPhone || '030 222 4455',
    exam_name: effectiveExamName?.trim() || 'First Term Examination',
  }
  const picked = parseMultiSelectValues(effectiveReportOptions).map((v) => String(v).trim().toLocaleLowerCase())
  const has = (opt: string) => picked.includes(opt.toLocaleLowerCase())

  const headerLines = contentLines(headerContent)
  const footerLines = contentLines(footerContent)
  const footerGroups = groupFooterLines(footerLines)
  const signatureGroups = footerGroups.filter((g) => g.some(isBoxLine))
  const trailingGroups = footerGroups.filter((g) => !g.some(isBoxLine))

  const boxImage: Record<string, string> = {
    logo: effectiveLogoDataUrl ?? '',
    student_photo: '',
    left_signature: leftSignatureDataUrl ?? '',
    middle_signature: middleSignatureDataUrl ?? '',
    right_signature: rightSignatureDataUrl ?? '',
  }

  const accentColor = accentColorOverride || matchedThemeDef.accentColor || '#1e293b'
  const padding = {
    top: effectiveTopSpace !== undefined && effectiveTopSpace !== '' ? Number(effectiveTopSpace) : undefined,
    bottom: effectiveBottomSpace !== undefined && effectiveBottomSpace !== '' ? Number(effectiveBottomSpace) : undefined,
    left: effectiveLeftSpace !== undefined && effectiveLeftSpace !== '' ? Number(effectiveLeftSpace) : undefined,
    right: effectiveRightSpace !== undefined && effectiveRightSpace !== '' ? Number(effectiveRightSpace) : undefined,
  }

  const renderPublishedCustomOverlays = () => {
    if (!renderPublishedOverlays || !publishedSpec || publishedSpec.customEls.length === 0) return null
    return publishedSpec.customEls.map((el) => {
      if (el.hidden) return null
      const s = el.style || {}
      const isLineLike = el.type === 'line' || el.type === 'divider'
      const isVertLine = (s.orientation as string) === 'vertical'
      const customBw = Number(s.borderWidth) || 0
      const customBs = (s.borderStyle as string) || 'solid'
      const customBc = (s.borderColor as string) || '#94a3b8'
      const hasCustomBorder = !isLineLike && customBw > 0 && customBs !== 'none'
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        border: isLineLike ? 'none' : hasCustomBorder ? `${customBw}px ${customBs} ${customBc}` : 'none',
        borderRadius: isLineLike ? 2 : ((s.radius as number) ?? 4),
        background: isLineLike ? 'transparent' : (s.bg === 'transparent' ? 'transparent' : ((s.bg as string) || 'rgba(255,255,255,0.92)')),
        display: 'flex',
        alignItems: 'center',
        justifyContent: isLineLike ? 'center' : (s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'),
        textAlign: (s.align as React.CSSProperties['textAlign']) || 'center',
        fontFamily: (s.fontFamily as string) || undefined,
        fontSize: (s.fontSize as number) ?? 12,
        fontWeight: s.bold ? 700 : undefined,
        fontStyle: s.italic ? 'italic' : undefined,
        textDecoration: s.underline ? 'underline' : undefined,
        color: (s.color as string) || '#1e293b',
        padding: isLineLike ? 0 : ((s.padding as number) ?? 4),
        overflow: isLineLike ? 'visible' : 'hidden',
        transform: isLineLike && (s.rotation as number) ? `rotate(${s.rotation}deg)` : undefined,
        pointerEvents: 'none',
        zIndex: 10,
      }
      if (isLineLike) {
        const lineThickness = (s.lineThickness as number) ?? 2
        const lineStyle = (s.lineStyle as string) || 'solid'
        const lineColor = (s.bg as string) || (el.type === 'line' ? '#1e293b' : '#94a3b8')
        return (
          <div key={el.id} style={baseStyle}>
            <div
              style={
                isVertLine
                  ? { width: 0, height: '100%', borderLeft: `${lineThickness}px ${lineStyle} ${lineColor}` }
                  : { width: '100%', height: 0, borderTop: `${lineThickness}px ${lineStyle} ${lineColor}` }
              }
            />
          </div>
        )
      }
      if (el.type === 'custom_heading') {
        return <div key={el.id} style={{ ...baseStyle, fontSize: (s.fontSize as number) ?? 16, fontWeight: 700 }}>{el.text || el.label}</div>
      }
      if (el.type === 'image' || el.type === 'logo') {
        const resolvedImgSrc = el.imageSrc || (el.field === 'school_logo' ? effectiveLogoDataUrl : undefined)
        return (
          <div key={el.id} style={{ ...baseStyle, background: resolvedImgSrc ? 'transparent' : '#f1f5f9', border: resolvedImgSrc ? baseStyle.border : '1px dashed #94a3b8', color: '#64748b', fontSize: 10 }}>
            {resolvedImgSrc ? <img src={resolvedImgSrc} alt={el.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : el.label}
          </div>
        )
      }
      if (el.type === 'signature') {
        const sigColor = (s.color as string) || '#1e293b'
        const sigCaption = el.caption ?? el.text ?? el.label
        return (
          <div key={el.id} style={{ ...baseStyle, flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
            {el.imageSrc ? (
              <img src={el.imageSrc} alt={sigCaption} draggable={false} style={{ maxHeight: Math.max(16, el.height - 16), objectFit: 'contain' }} />
            ) : (
              <svg width="78" height="22" viewBox="0 0 96 28" fill="none" style={{ flexShrink: 0 }}>
                <path d="M8 22C16 9 22 6 24 14C26 21 31 8 38 12C44 16 48 9 56 15C63 20 74 11 88 13" stroke={sigColor} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
            <div style={{ width: '82%', borderTop: '1px solid #64748b', paddingTop: 2, textAlign: 'center', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em', color: sigColor }}>
              {sigCaption}
            </div>
          </div>
        )
      }
      if (el.type === 'table') {
        const hdrBg = (s.headerBg as string) || '#f1f5f9'
        const hdrColor = (s.headerColor as string) || '#0f172a'
        const tblBorder = (s.borderColor as string) || '#cbd5e1'
        return (
          <div key={el.id} className="reportsheet-paper" style={{ ...baseStyle, background: '#fff', color: '#0f172a', fontSize: 9, flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
            {Array.isArray(s.customColumns) && s.customColumns.length > 0 ? <CustomSubjectTable columns={s.customColumns as SubjectColumn[]} rows={rows} headerBg={hdrBg} headerColor={hdrColor} borderColor={tblBorder} sampleRows={s.sampleTableRows as string[][] | undefined} sampleFooter={s.sampleTableFooter as string[] | undefined} subjectCatalog={subjectCatalog} useSubjectCatalog={s.useSubjectCatalog === true} style={{ marginTop: 0 }} /> : (
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: hdrBg, color: hdrColor }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: `1px solid ${tblBorder}` }}>Subject</th>
                  {activeScoreComponents.map((col, ci) => (
                    <th key={ci} style={{ textAlign: 'center', padding: '3px 4px', fontSize: 7.5, fontWeight: 700, border: `1px solid ${tblBorder}` }}>
                      {col.name} (/{col.max})
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: `1px solid ${tblBorder}` }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r, ri) => (
                  <tr key={ri} style={{ background: '#ffffff', color: '#0f172a' }}>
                    <td style={{ padding: '3px 4px', fontSize: 8, border: `1px solid ${tblBorder}` }}>{r.subject}</td>
                    {r.colScores.map((sc, ci) => (
                      <td key={ci} style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: `1px solid ${tblBorder}` }}>{sc}</td>
                    ))}
                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: `1px solid ${tblBorder}` }}>{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )
      }
      return <div key={el.id} style={baseStyle}>{el.text || el.label}</div>
    })
  }

  // Render a single content line with placeholder resolution
  const renderContentLine = (line: string, key: number, align: 'left' | 'center' | 'right' | 'justify' = 'left') => {
    const raw = String(line ?? '').trim()
    const text = stripAlignWrapper(raw)
    const only = /^\{([a-z_]+)\}$/i.exec(text)
    const token = only?.[1]?.toLocaleLowerCase() ?? ''
    if (token === 'student_details') {
      return <div key={key} style={{ textAlign: align }}>{renderStudentDetails(schoolName, examName ?? '', academicYear ?? '', termLabel ?? '', photoStyle)}</div>
    }
    if (token && (token === 'student_photo' || MARKSHEET_BOX_TOKENS.includes(token))) {
      return <div key={key} style={{ textAlign: align }}>{renderBoxToken(token, `box-${key}`, boxImage)}</div>
    }
    if (token) {
      const resolved = resolveLineText(text, samples)
      return <div key={key} style={{ fontSize: 9, minHeight: 11, color: accentColor, textAlign: align }}>{resolved || ' '}</div>
    }
    // Mixed content: split by placeholders, render images inline
    const holders = [...text.matchAll(/\{[a-z_]+\}/gi)]
    const isHolder = (raw: string) => MARKSHEET_BOX_TOKENS.includes(raw.slice(1, -1).toLocaleLowerCase())
    if (holders.some((m) => isHolder(m[0]))) {
      const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
      const parts = text.split(/\{[a-z_]+\}/i)
      return (
        <div key={key} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', justifyContent: justify }}>
          {parts.map((part, i) => (
            <Fragment key={i}>
              {part.trim() ? (
                hasInlineHtml(part.trim()) ? (
                  <span key={`t-${i}`} style={{ fontSize: 9, color: accentColor }} dangerouslySetInnerHTML={{ __html: stripAlignWrapper(resolveLineText(part.trim(), samples)) }} />
                ) : (
                  <span key={`t-${i}`} style={{ fontSize: 9, color: accentColor }}>{resolveLineText(part.trim(), samples)}</span>
                )
              ) : null}
              {holders[i] ? (
                isHolder(holders[i][0]) ? (
                  renderBoxToken(holders[i][0].slice(1, -1).toLocaleLowerCase(), `box-${i}-${key}`, boxImage)
                ) : (
                  <span key={`h-${i}`} style={{ fontSize: 9, color: accentColor }}>{resolveLineText(holders[i][0], samples)}</span>
                )
              ) : null}
            </Fragment>
          ))}
        </div>
      )
    }
    const resolved = resolveLineText(text, samples)
    return hasInlineHtml(resolved) ? (
      <div key={key} style={{ fontSize: 9, minHeight: 11, color: accentColor, textAlign: align }} dangerouslySetInnerHTML={{ __html: resolved || ' ' }} />
    ) : (
      <div key={key} style={{ fontSize: 9, minHeight: 11, color: accentColor, textAlign: align }}>{resolved || ' '}</div>
    )
  }

  const renderBoxToken = (token: string, key: string, images: Record<string, string>) => {
    const src = images[token] ?? ''
    const h = token === 'logo' ? 32 : 24
    return src.startsWith('data:') ? (
      <img key={key} src={src} alt={token} style={{ height: h, objectFit: 'contain' }} />
    ) : (
      <div key={key} style={{ height: h, minWidth: token === 'logo' ? 46 : 62, display: 'inline-block', border: '1px dashed #c9c9c0', borderRadius: 3, fontSize: 7, color: '#9ca3af', textAlign: 'center', lineHeight: `${h}px` }}>{token.replace(/_/g, ' ')}</div>
    )
  }

  // Render student details block (for {student_details} token)
  const renderStudentDetails = (name: string, exam: string, year: string, term: string, photoStyleStr?: string) => {
    const isRound = photoStyleStr?.toLowerCase().includes('round')
    const photoSize = photoStyleStr?.includes('240') ? 240 : 320
    const photoW = Math.round(photoSize * 320 / 320 * 0.5) // scale down for the 560px sheet
    const photoH = Math.round(photoW * 1.2)
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, flex: 1, fontSize: 8 }}>
          <div><div style={{ fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>STUDENT NAME</div><div style={{ fontSize: 8.5, fontWeight: 600, color: accentColor }}>Ama Owusu</div></div>
          <div><div style={{ fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>ADMISSION NO</div><div style={{ fontSize: 8.5, fontWeight: 600, color: accentColor }}>ADM-001</div></div>
          <div><div style={{ fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>CLASS</div><div style={{ fontSize: 8.5, fontWeight: 600, color: accentColor }}>Basic 7 A</div></div>
          <div><div style={{ fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>TERM</div><div style={{ fontSize: 8.5, fontWeight: 600, color: accentColor }}>Term {term}</div></div>
          <div><div style={{ fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>EXAM</div><div style={{ fontSize: 8.5, fontWeight: 600, color: accentColor }}>{exam || 'First Term Examination'}</div></div>
        </div>
        <div style={{ width: 36, height: 36, flex: 'none', background: '#e7e7e0', border: '1px solid #cfcfc6', borderRadius: isRound ? '9999px' : 3 }} />
      </div>
    )
  }

  // Theme 1: Classic Marksheet Template (matches Edit Marksheet Template Live Preview)
  const theme6Components = activeScoreComponents

  const theme6Rows = useMemo(() => {
    const maxMarks = theme6Components.reduce((sum, c) => sum + c.max, 0) || 100
    if (customSubjects && customSubjects.length > 0) {
      return customSubjects.map((entry, si) => {
        const defaultScores = theme6Components.map((comp, ci) => {
          if (Array.isArray(entry.partScores) && entry.partScores[ci] !== undefined) {
            return Number(entry.partScores[ci])
          }
          if (!hasExamParts) {
            if (ci === 0 && entry.classScore !== undefined) return Number(entry.classScore)
            if (ci === 1 && entry.examScore !== undefined) return Number(entry.examScore)
          }
          const wobble = ci % 2 === 0 ? 0.02 : -0.03
          const ratio = CLASSIC_MARKSHEET_RATIOS[si % CLASSIC_MARKSHEET_RATIOS.length]
          const score = Math.round(comp.max * (ratio + wobble))
          return Math.max(0, Math.min(comp.max, score))
        })
        const total = Math.round(defaultScores.reduce((sum, v) => sum + v, 0) * 10) / 10
        const pct = (total / maxMarks) * 100
        return {
          subject: entry.subject,
          colScores: defaultScores,
          total,
          grade: entry.grade || letterGradeForPct(pct),
          pos: entry.position || String(si + 1),
        }
      })
    }
    const subjectList = subjects && subjects.length > 0 ? subjects : CLASSIC_MARKSHEET_SUBJECTS
    return subjectList.map((subject, si) => {
      const colScores = theme6Components.map((comp, ci) => {
        const wobble = ci % 2 === 0 ? 0.02 : -0.03
        const ratio = CLASSIC_MARKSHEET_RATIOS[si % CLASSIC_MARKSHEET_RATIOS.length]
        const score = Math.round(comp.max * (ratio + wobble))
        return Math.max(1, Math.min(comp.max, score))
      })
      const total = colScores.reduce((sum, v) => sum + v, 0)
      const pct = (total / maxMarks) * 100
      return {
        subject,
        colScores,
        total,
        grade: letterGradeForPct(pct),
        pos: String(si + 1),
      }
    })
  }, [theme6Components, hasExamParts, subjects, customSubjects])

  // A published blank-form design contains only its explicitly placed elements.
  if (publishedSpec?.settings?.blankForm === true) {
    return <div className="reportsheet-paper" style={{ width: 560, minHeight: 780, position: 'relative', background: matchedThemeDef.certificateColor || '#fff', colorScheme: 'light' }}>
      {renderPublishedCustomOverlays()}
    </div>
  }

  if (effectiveThemeId === 'theme-1') {
    const labelStyle: React.CSSProperties = {
      fontSize: 8.5,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      color: '#6b7280',
      marginBottom: 2,
    }
    const valueStyle: React.CSSProperties = {
      fontSize: 11.5,
      fontWeight: 600,
      color: '#16325c',
      lineHeight: 1.25,
    }
    const tableOverride = ov('subject-table')?.style
    const tableBorderColor = (tableOverride?.borderColor as string) || '#d7d7d0'
    const tableHeaderBg = (tableOverride?.headerBg as string) || '#f1f1ec'
    const tableHeaderColor = (tableOverride?.headerColor as string) || '#16325c'
    const cellStyle: React.CSSProperties = {
      border: `1px solid ${tableBorderColor}`,
      padding: '4px 6px',
      fontSize: (tableOverride?.fontSize as number) ?? 9.5,
      color: (tableOverride?.color as string) || '#16325c',
    }
    const maxMarks = theme6Components.reduce((sum, c) => sum + c.max, 0) || 100
    const resolvedExamName = effectiveExamName?.trim() || 'First Term Examination'
    const safeTerm = String(termLabel ?? '1').trim() || '1'
    const resolvedTerm = safeTerm.toLowerCase().startsWith('term') ? safeTerm : `Term ${safeTerm}`
    const resolvedAddress = schoolAddress?.trim() || 'Accra, Greater Accra'
    const resolvedPhone = schoolPhone?.trim() || '030 222 4455'
    const resolvedEmail = schoolEmail?.trim() || 'info@example.edu.gh'
    const resolvedLogoSrc = ov('school-logo')?.imageSrc || effectiveLogoDataUrl
    const resolvedStudentPhotoSrc = ov('student-photo')?.imageSrc || studentPhotoDataUrl
    const logoH = ov('school-logo')?.style?.customSize && ov('school-logo')?.height ? ov('school-logo')!.height! : 32
    const logoW = ov('school-logo')?.style?.customSize && ov('school-logo')?.width ? ov('school-logo')!.width! : 46

    return (
      <div
        className="reportsheet-paper"
        style={{
          width: 560,
          minHeight: 780,
          position: 'relative',
          backgroundColor: matchedThemeDef.certificateColor || '#ffffff',
          color: '#16325c',
          colorScheme: 'light',
          fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
          paddingTop: padding.top ?? 20,
          paddingBottom: padding.bottom ?? 20,
          paddingLeft: padding.left ?? 18,
          paddingRight: padding.right ?? 18,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          userSelect: 'none',
        }}
      >
        {/* Header */}
        <div style={{ paddingBottom: 2 }}>
          <div
            data-element-id="school-logo"
            data-element-type="image"
            data-element-label="School Logo"
            style={ovStyle('school-logo', { cursor: 'pointer', display: 'inline-block' })}
          >
            <DashedHolderBox src={resolvedLogoSrc} label={ovText('school-logo', 'logo')} height={logoH} minWidth={logoW} />
          </div>
          <div
            data-element-id="school-name"
            data-element-type="text"
            data-element-label="School Name"
            style={ovStyle('school-name', { fontSize: 10, minHeight: 13, width: 'fit-content', color: '#16325c', marginTop: 3, cursor: 'pointer' })}
          >
            {ovText('school-name', schoolName || 'Airport City Flagship')}
          </div>
          <div
            data-element-id="school-address"
            data-element-type="text"
            data-element-label="School Address"
            style={ovStyle('school-address', { fontSize: 10, minHeight: 13, width: 'fit-content', color: '#16325c', cursor: 'pointer' })}
          >
            {ovText('school-address', `${resolvedAddress} · ${resolvedPhone} · ${resolvedEmail}`)}
          </div>
          <div
            data-element-id="exam-name"
            data-element-type="text"
            data-element-label="Exam Name"
            style={ovStyle('exam-name', { fontSize: 10, minHeight: 13, width: 'fit-content', color: '#16325c', cursor: 'pointer' })}
          >
            {ovText('exam-name', resolvedExamName)}
          </div>
        </div>

        {/* Header Horizontal Line (Theme 1) */}
        {renderThemeLine('header-line', 'Header Horizontal Line', '#16325c', 2, 'solid')}

        {/* Student Details Row + Square Photo Placeholder */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flex: 1 }}>
            {[
              ['STUDENT NAME', 'label-student-name', 'Student Name Label', 'student-name', 'Student Name', 'Ama Owusu'],
              ['ADMISSION NO', 'label-admission-no', 'Admission No Label', 'admission-no', 'Admission No', 'ADM-001'],
              ['CLASS', 'label-student-class', 'Class Label', 'student-class', 'Class', 'Basic 7 A'],
              ['TERM', 'label-term-label', 'Term Label', 'term-label', 'Term', resolvedTerm],
              ['EXAM', 'label-exam-name-field', 'Exam Label', 'exam-name-field', 'Exam', resolvedExamName],
            ].map(([lbl, lblId, lblTitle, elId, elLabel, defVal]) => (
              <div key={elId}>
                <div
                  data-element-id={lblId}
                  data-element-type="text"
                  data-element-label={lblTitle}
                  style={ovStyle(lblId, { ...labelStyle, cursor: 'pointer' })}
                >
                  {ovText(lblId, lbl)}
                </div>
                <div
                  data-element-id={elId}
                  data-element-type="text"
                  data-element-label={elLabel}
                  style={ovStyle(elId, { ...valueStyle, cursor: 'pointer' })}
                >
                  {ovText(elId, defVal)}
                </div>
              </div>
            ))}
          </div>
          <div
            data-element-id="student-photo"
            data-element-type="image"
            data-element-label="Student Photo"
            style={ovStyle('student-photo', {
              width: 38,
              height: 38,
              flex: 'none',
              background: '#e7e7e0',
              border: '1px solid #cfcfc6',
              borderRadius: 3,
              overflow: 'hidden',
              cursor: 'pointer',
            })}
          >
            {resolvedStudentPhotoSrc ? (
              <img src={resolvedStudentPhotoSrc} alt="Student" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : null}
          </div>
        </div>

        {/* Marks Table (Warm Stone Header & Totals) */}
        {Array.isArray(tableOverride?.customColumns) && tableOverride.customColumns.length > 0 ? <CustomSubjectTable columns={tableOverride.customColumns as SubjectColumn[]} rows={theme6Rows.map(r => ({ ...r, position: r.pos }))} subjectCatalog={subjectCatalog} headerBg={tableHeaderBg} headerColor={tableHeaderColor} borderColor={(tableOverride?.borderColor as string) || '#334155'} style={ovStyle('subject-table', { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9, marginTop: 8, cursor: 'pointer' })} /> : (
        <table
          data-element-id="subject-table"
          data-element-type="table"
          data-element-label="Subject Table"
          style={ovStyle('subject-table', { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9.5, marginTop: 2, cursor: 'pointer' })}
        >
          <thead>
            <tr>
              <th
                data-table-cell-key="th-subject"
                data-table-cell-label="Subject Header"
                style={{ ...cellStyle, textAlign: 'left', background: tableHeaderBg, color: tableHeaderColor, fontWeight: 700, width: '22%' }}
              >
                {ovText('th-subject', 'Subject')}
              </th>
              {theme6Components.map((comp, ci) => (
                <th
                  key={comp.name}
                  data-table-cell-key={`th-comp-${ci}`}
                  data-table-cell-label={`${comp.name} Header`}
                  style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, color: tableHeaderColor, fontWeight: 700, width: `calc((100% - 22% - 16% - ${showGrade ? '8%' : '0'} - ${showPosition ? '8%' : '0'}) / ${theme6Components.length})` }}
                >
                  <span>{ovText(`th-comp-${ci}`, comp.name)}</span>
                  <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{comp.max}</div>
                </th>
              ))}
              <th
                data-table-cell-key="th-total"
                data-table-cell-label="Total Header"
                style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, color: tableHeaderColor, fontWeight: 700, width: '16%' }}
              >
                <span>{ovText('th-total', 'Total')}</span>
                <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{maxMarks}</div>
              </th>
              {showGrade && (
                <th
                  data-table-cell-key="th-grade"
                  data-table-cell-label="Grade Header"
                  style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, color: tableHeaderColor, fontWeight: 700, width: '8%' }}
                >
                  {ovText('th-grade', 'Grade')}
                </th>
              )}
              {showPosition && (
                <th
                  data-table-cell-key="th-pos"
                  data-table-cell-label="Position Header"
                  style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, color: tableHeaderColor, fontWeight: 700, width: '8%' }}
                >
                  {ovText('th-pos', 'Pos')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {theme6Rows.map((r, ri) => (
              <tr key={`${r.subject}-${ri}`}>
                <td data-table-cell-key={`td-${ri}-subject`} data-table-cell-label="Subject Name" style={cellStyle}>
                  {ovText(`td-${ri}-subject`, r.subject)}
                </td>
                {r.colScores.map((sc, ci) => (
                  <td key={ci} data-table-cell-key={`td-${ri}-sc-${ci}`} data-table-cell-label={`${r.subject} Score ${ci + 1}`} style={{ ...cellStyle, textAlign: 'center' }}>
                    {ovText(`td-${ri}-sc-${ci}`, String(sc))}
                  </td>
                ))}
                <td data-table-cell-key={`td-${ri}-total`} data-table-cell-label={`${r.subject} Total`} style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>
                  {ovText(`td-${ri}-total`, String(r.total))}
                </td>
                {showGrade && (
                  <td data-table-cell-key={`td-${ri}-grade`} data-table-cell-label={`${r.subject} Grade`} style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>
                    {ovText(`td-${ri}-grade`, r.grade)}
                  </td>
                )}
                {showPosition && (
                  <td data-table-cell-key={`td-${ri}-pos`} data-table-cell-label={`${r.subject} Position`} style={{ ...cellStyle, textAlign: 'center' }}>
                    {ovText(`td-${ri}-pos`, String(r.pos))}
                  </td>
                )}
              </tr>
            ))}
            <tr>
              <td data-table-cell-key="td-sum-label" data-table-cell-label="Totals Row Label" style={{ ...cellStyle, background: tableHeaderBg, fontWeight: 700 }}>
                {ovText('td-sum-label', '')}
              </td>
              {theme6Components.map((comp, ci) => (
                <td
                  key={comp.name}
                  style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, fontWeight: 700 }}
                >
                  {theme6Rows.reduce((sum, r) => sum + (r.colScores[ci] ?? 0), 0)}
                </td>
              ))}
              <td style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, fontWeight: 700 }}>
                {theme6Rows.reduce((sum, r) => sum + r.total, 0)}
              </td>
              {showGrade && (
                <td style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, fontWeight: 700 }}>
                  —
                </td>
              )}
              {showPosition && (
                <td style={{ ...cellStyle, textAlign: 'center', background: tableHeaderBg, fontWeight: 700 }}>
                  —
                </td>
              )}
            </tr>
            {showClassAvg && (
              <tr>
                <td data-table-cell-key="td-avg-label" data-table-cell-label="Class Avg Label" style={{ ...cellStyle, background: '#e8e8e2', fontWeight: 700 }}>
                  {ovText('td-avg-label', 'Class Avg')}
                </td>
                {theme6Components.map((comp, ci) => {
                  const avg = theme6Rows.length > 0 ? theme6Rows.reduce((sum, r) => sum + (r.colScores[ci] ?? 0), 0) / theme6Rows.length : 0
                  return <td key={comp.name} style={{ ...cellStyle, textAlign: 'center', background: '#e8e8e2', fontWeight: 700 }}>{avg.toFixed(1)}</td>
                })}
                {theme6Rows.length > 0 ? <td style={{ ...cellStyle, textAlign: 'center', background: '#e8e8e2', fontWeight: 700 }}>{(theme6Rows.reduce((sum, r) => sum + r.total, 0) / theme6Rows.length).toFixed(1)}</td> : <td style={{ ...cellStyle, textAlign: 'center', background: '#e8e8e2' }} />}
                {showGrade && <td style={{ ...cellStyle, textAlign: 'center', background: '#e8e8e2' }} />}
                {showPosition && <td style={{ ...cellStyle, textAlign: 'center', background: '#e8e8e2' }} />}
              </tr>
            )}
          </tbody>
        </table>
        )}

        {/* Summary Metrics Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 2 }}>
          {[
            ['ATTENDANCE', 'label-attendance', 'Attendance Label', 'attendance-field', 'Attendance', '96%'],
            ['POSITION', 'label-position', 'Position Label', 'position-field', 'Position', '3rd of 32'],
            ['CLASS AVERAGE', 'label-class-average', 'Class Average Label', 'class-average', 'Class Average', '74.1'],
          ].map(([lbl, lblId, lblTitle, elId, elLabel, val]) => (
            <div key={elId}>
              <div
                data-element-id={lblId}
                data-element-type="text"
                data-element-label={lblTitle}
                style={ovStyle(lblId, { ...labelStyle, cursor: 'pointer' })}
              >
                {ovText(lblId, lbl)}
              </div>
              <div
                data-element-id={elId}
                data-element-type="text"
                data-element-label={elLabel}
                style={ovStyle(elId, { ...valueStyle, cursor: 'pointer' })}
              >
                {ovText(elId, val)}
              </div>
            </div>
          ))}
        </div>

        {/* Grading Scale Horizontal Line */}
        {renderThemeLine('grading-scale-line', 'Grading Scale Horizontal Line', '#e3e3dc', 1, 'solid')}

        {/* Grading Scale Line */}
        <div
          data-element-id="grading-scale"
          data-element-type="text"
          data-element-label="Grading Scale"
          style={ovStyle('grading-scale', {
            fontSize: 8.5,
            width: 'fit-content',
            color: '#6b7280',
            paddingTop: 2,
            cursor: 'pointer',
          })}
        >
          {ovText('grading-scale', 'Grading scale · A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D 50–59 · F below 50')}
        </div>

        {/* Class Teacher's Remark */}
        <div>
          <div
            data-element-id="label-class-teacher-remarks"
            data-element-type="text"
            data-element-label="Class Teacher Remark Label"
            style={ovStyle('label-class-teacher-remarks', { ...labelStyle, width: 'fit-content', cursor: 'pointer' })}
          >
            {ovText('label-class-teacher-remarks', "CLASS TEACHER'S REMARK")}
          </div>
          <div
            data-element-id="class-teacher-remarks"
            data-element-type="text"
            data-element-label="Class Teacher's Remark"
            style={ovStyle('class-teacher-remarks', { ...valueStyle, fontSize: 10.5, width: 'fit-content', cursor: 'pointer' })}
          >
            {ovText('class-teacher-remarks', 'A very promising term.')}
          </div>
        </div>

        {/* Footer — 3 Signature Columns + Printed Line + Template Caption */}
        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {renderThemeLine('footer-line', 'Footer Horizontal Line', '#e3e3dc', 1, 'solid')}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            {[
              {
                src: ov('class-teacher-signature')?.imageSrc || leftSignatureDataUrl,
                holder: 'left signature',
                caption: ov('class-teacher-signature')?.caption ?? ovText('class-teacher-signature', 'Class Teacher'),
                elId: 'class-teacher-signature',
                elLabel: 'Class Teacher Signature',
                elType: 'signature',
              },
              {
                src: ov('head-of-school-signature')?.imageSrc || middleSignatureDataUrl,
                holder: 'middle signature',
                caption: ov('head-of-school-signature')?.caption ?? ovText('head-of-school-signature', 'Head of School'),
                elId: 'head-of-school-signature',
                elLabel: 'Head of School Signature',
                elType: 'signature',
              },
              {
                src: ov('principal-signature')?.imageSrc || rightSignatureDataUrl,
                holder: 'right signature',
                caption: ov('principal-signature')?.caption ?? ovText('principal-signature', 'Principal'),
                elId: 'principal-signature',
                elLabel: 'Principal Signature',
                elType: 'signature',
              },
            ].map((sig) => {
              const sigItem = ov(sig.elId)
              const sigH = sigItem?.style?.customSize && sigItem.height ? Math.max(16, sigItem.height - 14) : 24
              return (
                <div
                  key={sig.holder}
                  data-element-id={sig.elId}
                  data-element-type={sig.elType}
                  data-element-label={sig.elLabel}
                  style={ovStyle(sig.elId, {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                  })}
                >
                  <DashedHolderBox src={sig.src} label={sig.holder} height={sigH} minWidth={62} />
                  <div style={{ fontSize: 9.5, color: (sigItem?.style?.color as string) || '#16325c' }}>{sig.caption}</div>
                </div>
              )
            })}
          </div>
          <div
            data-element-id="printed-line"
            data-element-type="text"
            data-element-label="Printed Line"
            style={ovStyle('printed-line', { fontSize: 9.5, width: 'fit-content', color: '#16325c', marginTop: 8, cursor: 'pointer' })}
          >
            {ovText('printed-line', 'Printed —')}
          </div>
          <div
            data-element-id="template-caption"
            data-element-type="text"
            data-element-label="Template Caption"
            style={ovStyle('template-caption', { fontSize: 8, width: 'fit-content', color: '#9ca3af', marginTop: 4, cursor: 'pointer' })}
          >
            {ovText('template-caption', templateCaption?.trim() || 'Sample(A4 Portrait) 1')}
          </div>
        </div>
        {renderPublishedCustomOverlays()}
      </div>
    )
  }

  const isTheme1 = effectiveThemeId === 'theme-2'
  const isTheme2 = effectiveThemeId === 'theme-3'
  const isTheme3 = effectiveThemeId === 'theme-4'
  const isTheme4 = effectiveThemeId === 'theme-5'
  const isTheme5 = effectiveThemeId === 'theme-6'

  // Use the theme's actual accentColor for primary — fixes mismatched colors
  const themeDef = matchedThemeDef
  const primary = accentColor || themeDef.accentColor
  const softTint = isTheme5 ? '#f0fdfa' : isTheme3 ? '#f8fafc' : '#ffffff'
  const borderTint = isTheme5 ? '#99f6e4' : isTheme3 ? '#cbd5e1' : '#334155'

  // Use form field margins if provided, otherwise default (nullish coalescing preserves 0)
  const sheetPadding = {
    top: padding.top ?? (isTheme4 ? 20 : 24),
    bottom: padding.bottom ?? 0,
    left: padding.left ?? (isTheme4 ? 20 : 24),
    right: padding.right ?? (isTheme4 ? 20 : 24),
  }

  const resolvedLogoSrc = ov('school-logo')?.imageSrc || effectiveLogoDataUrl
  const resolvedStudentPhotoSrc = ov('student-photo')?.imageSrc || studentPhotoDataUrl
  const resolvedLeftSigSrc = ov('class-teacher-signature')?.imageSrc || leftSignatureDataUrl
  const resolvedRightSigSrc = ov('head-teacher-signature')?.imageSrc || rightSignatureDataUrl
  const tableOverride = ov('subject-table')?.style
  const tableHeaderBg =
    (tableOverride?.headerBg as string) ||
    (isTheme3 || isTheme5 ? primary : isTheme1 ? '#eef2f6' : isTheme4 ? '#f1f5f9' : '#f8fafc')
  const tableHeaderColor = (tableOverride?.headerColor as string) || (isTheme3 || isTheme5 ? '#ffffff' : '#0f172a')

  return (
    <div
      className="reportsheet-paper"
      style={{
        width: 560,
        minHeight: 780,
        backgroundColor: matchedThemeDef.certificateColor || '#ffffff',
        backgroundImage: backgroundImage?.startsWith('data:') ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#0f172a',
        colorScheme: 'light',
        fontFamily: isTheme4
          ? 'Georgia, "Times New Roman", serif'
          : 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
        paddingTop: sheetPadding.top,
        paddingBottom: sheetPadding.bottom,
        paddingLeft: sheetPadding.left,
        paddingRight: sheetPadding.right,
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          border: isTheme4 ? '3px double #334155' : 'none',
          padding: isTheme4 ? '16px 18px' : 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top School Header — uses headerContent when provided, otherwise default layout */}
        {headerLines.length > 0 ? (
          <div style={{ paddingBottom: isTheme3 || isTheme5 ? 8 : 6 }}>
            {headerLines.map((line, i) => renderContentLine(line, i, 'center'))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingBottom: isTheme3 || isTheme5 ? 8 : 6,
            }}
          >
            <div
              data-element-id="school-logo"
              data-element-type="image"
              data-element-label="School Logo"
              style={ovStyle('school-logo', {
                width: 52,
                height: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: resolvedLogoSrc ? 'transparent' : '#f1f5f9',
                border: resolvedLogoSrc ? 'none' : '1px dashed #94a3b8',
                borderRadius: 4,
                color: '#64748b',
                fontSize: 8.5,
                fontWeight: 500,
                lineHeight: 1.15,
                textAlign: 'center',
                padding: resolvedLogoSrc ? 0 : 3,
                boxSizing: 'border-box',
                overflow: 'hidden',
                cursor: 'pointer',
              })}
            >
              {resolvedLogoSrc ? (
                <img
                  src={resolvedLogoSrc}
                  alt="School Logo"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
              ) : (
                <span>{ovText('school-logo', 'School Logo')}</span>
              )}
            </div>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div
                data-element-id="school-name"
                data-element-type="text"
                data-element-label="School Name"
                style={ovStyle('school-name', {
                  fontSize: isTheme4 ? 16 : 15,
                  fontWeight: 800,
                  width: 'fit-content',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  letterSpacing: isTheme2 || isTheme4 ? '0.01em' : '0.04em',
                  textTransform: isTheme2 || isTheme4 ? 'none' : 'uppercase',
                  color: isTheme5 ? primary : '#0f172a',
                  lineHeight: 1.2,
                  cursor: 'pointer',
                })}
              >
                {ovText(
                  'school-name',
                  isTheme2 || isTheme4 ? (schoolName || 'Airport City Flagship') : String(schoolName || 'Airport City Flagship').toUpperCase(),
                )}
              </div>
              <div
                data-element-id="school-address"
                data-element-type="text"
                data-element-label="School Address"
                style={ovStyle('school-address', { fontSize: 8.5, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto', color: '#475569', marginTop: 2, fontWeight: 500, cursor: 'pointer' })}
              >
                {ovText('school-address', schoolAddress || 'Accra, Greater Accra · Knowledge & Integrity')}
              </div>
              <div
                data-element-id="school-phone"
                data-element-type="text"
                data-element-label="School Phone"
                style={ovStyle('school-phone', { fontSize: 8, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto', color: '#64748b', marginTop: 1, cursor: 'pointer' })}
              >
                {ovText('school-phone', schoolPhone ? `Tel: ${schoolPhone}` : 'Tel: +233 24 000 0000 · info@school.edu.gh')}
              </div>
            </div>

            <div
              data-element-id="student-photo"
              data-element-type="image"
              data-element-label="Student Photo"
              style={ovStyle('student-photo', {
                width: 52,
                height: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: resolvedStudentPhotoSrc ? 'transparent' : '#f1f5f9',
                border: resolvedStudentPhotoSrc ? 'none' : '1px dashed #94a3b8',
                borderRadius: 4,
                color: '#64748b',
                fontSize: 8.5,
                fontWeight: 500,
                lineHeight: 1.15,
                textAlign: 'center',
                padding: resolvedStudentPhotoSrc ? 0 : 3,
                boxSizing: 'border-box',
                overflow: 'hidden',
                cursor: 'pointer',
              })}
            >
              {resolvedStudentPhotoSrc ? (
                <img
                  src={resolvedStudentPhotoSrc}
                  alt="Student Photo"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 4,
                    display: 'block',
                  }}
                />
              ) : (
                <span>{ovText('student-photo', 'Student Photo')}</span>
              )}
            </div>
          </div>
        )}

        {(isTheme3 || isTheme4 || isTheme5) &&
          renderThemeLine(
            'header-line',
            'Header Horizontal Line',
            isTheme4 ? '#475569' : primary,
            isTheme4 ? 1 : 2,
            'solid',
          )}

        {/* Report Title Banner */}
        {isTheme3 || isTheme5 ? (
          <div
            data-element-id="exam-title"
            data-element-type="text"
            data-element-label="Report Title Banner"
            style={ovStyle('exam-title', {
              marginTop: 8,
              backgroundColor: primary,
              color: '#ffffff',
              textAlign: 'center',
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              borderRadius: isTheme5 ? 3 : 0,
              cursor: 'pointer',
            })}
          >
            {ovText('exam-title', 'TERMINAL REPORT SHEET')}
          </div>
        ) : isTheme4 ? (
          <div style={{ marginTop: 8 }}>
            {renderThemeLine('exam-title-top-line', 'Title Top Horizontal Line', '#1e293b', 1.5, 'solid', {
              marginTop: -3,
              marginBottom: -3,
              padding: '3px 0',
            })}
            <div
              data-element-id="exam-title"
              data-element-type="text"
              data-element-label="Report Title Banner"
              style={ovStyle('exam-title', {
                backgroundColor: '#f8fafc',
                padding: '4.5px 8px',
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#0f172a',
                cursor: 'pointer',
              })}
            >
              {ovText('exam-title', 'TERMINAL REPORT SHEET')}
            </div>
            {renderThemeLine('exam-title-bottom-line', 'Title Bottom Horizontal Line', '#1e293b', 1.5, 'solid', {
              marginTop: -3,
              marginBottom: -3,
              padding: '3px 0',
            })}
          </div>
        ) : isTheme2 ? (
          <div style={{ marginTop: 10 }}>
            {renderThemeLine('exam-title-top-line', 'Title Top Horizontal Line', '#cbd5e1', 1, 'solid', {
              marginTop: -3,
              marginBottom: -3,
              padding: '3px 0',
            })}
            <div
              data-element-id="exam-title"
              data-element-type="text"
              data-element-label="Report Title Banner"
              style={ovStyle('exam-title', {
                padding: '4.5px 8px',
                backgroundColor: '#f8fafc',
                textAlign: 'center',
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#0f172a',
                cursor: 'pointer',
              })}
            >
              {ovText('exam-title', 'TERMINAL REPORT SHEET')}
            </div>
            {renderThemeLine('exam-title-bottom-line', 'Title Bottom Horizontal Line', '#475569', 1.5, 'solid', {
              marginTop: -3,
              marginBottom: -3,
              padding: '3px 0',
            })}
          </div>
        ) : (
          <div
            data-element-id="exam-title"
            data-element-type="text"
            data-element-label="Report Title Banner"
            style={ovStyle('exam-title', {
              marginTop: 8,
              padding: '4px 8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #334155',
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.09em',
              color: '#0f172a',
              cursor: 'pointer',
            })}
          >
            {ovText('exam-title', '[ TERMINAL REPORT SHEET ]')}
          </div>
        )}

        {/* Student Bio Details */}
        <div
          style={{
            marginTop: 9,
            padding: isTheme3 || isTheme5 ? '8px 10px' : '4px 0',
            backgroundColor: isTheme3 || isTheme5 ? softTint : 'transparent',
            border: isTheme5 ? `1px solid ${borderTint}` : isTheme3 ? '1px solid #e2e8f0' : 'none',
            borderRadius: isTheme3 || isTheme5 ? 4 : 0,
            fontSize: 8.5,
          }}
        >
          {/* Row 1: Name */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginBottom: 5,
            }}
          >
            <span
              data-element-id="label-student-name"
              data-element-type="text"
              data-element-label="Name Label"
              style={ovStyle('label-student-name', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', minWidth: 42, cursor: 'pointer' })}
            >
              {ovText('label-student-name', 'NAME:')}
            </span>
            {renderUnderlinedValue({
              elId: 'student-name',
              elLabel: 'Student Name',
              fallbackText: 'Owusu Boateng Samuel',
              lineId: 'student-name-line',
              lineLabel: 'Student Name Horizontal Line',
              lineColor: isTheme1 || isTheme4 ? '#475569' : '#94a3b8',
              align: isTheme1 || isTheme4 ? 'center' : 'left',
              fontWeight: 700,
              fontSize: 9.5,
            })}
          </div>

          {/* Row 2: Class / Roll / Term */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 0.85fr', gap: 10, marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-student-class"
                data-element-type="text"
                data-element-label="Class Label"
                style={ovStyle('label-student-class', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-student-class', 'CLASS:')}
              </span>
              {renderUnderlinedValue({
                elId: 'student-class',
                elLabel: 'Class',
                fallbackText: 'B4',
                lineId: 'student-class-line',
                lineLabel: 'Class Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 700,
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-academic-year"
                data-element-type="text"
                data-element-label="Academic Year Label"
                style={ovStyle('label-academic-year', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-academic-year', 'ACADEMIC YEAR:')}
              </span>
              {renderUnderlinedValue({
                elId: 'academic-year',
                elLabel: 'Academic Year',
                fallbackText: academicYear || '2026/2027',
                lineId: 'academic-year-line',
                lineLabel: 'Academic Year Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 700,
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-term-label"
                data-element-type="text"
                data-element-label="Term Label"
                style={ovStyle('label-term-label', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-term-label', 'TERM:')}
              </span>
              {renderUnderlinedValue({
                elId: 'term-label',
                elLabel: 'Term',
                fallbackText: String(termLabel ?? '1'),
                lineId: 'term-label-line',
                lineLabel: 'Term Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 700,
              })}
            </div>
          </div>

          {/* Row 3: Position / No. on Roll / Reopening */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 0.85fr 1.3fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-position"
                data-element-type="text"
                data-element-label="Position Label"
                style={ovStyle('label-position', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-position', 'POSITION:')}
              </span>
              {renderUnderlinedValue({
                elId: 'position-field',
                elLabel: 'Position',
                fallbackText: '1st',
                lineId: 'position-field-line',
                lineLabel: 'Position Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 700,
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-roll-number"
                data-element-type="text"
                data-element-label="No. on Roll Label"
                style={ovStyle('label-roll-number', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-roll-number', 'NO. ON ROLL:')}
              </span>
              {renderUnderlinedValue({
                elId: 'roll-number',
                elLabel: 'No. on Roll',
                fallbackText: '32',
                lineId: 'roll-number-line',
                lineLabel: 'No. on Roll Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 700,
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                data-element-id="label-reopening-date"
                data-element-type="text"
                data-element-label="Reopening Label"
                style={ovStyle('label-reopening-date', { fontWeight: 700, color: isTheme5 ? '#0f766e' : '#334155', cursor: 'pointer' })}
              >
                {ovText('label-reopening-date', 'REOPENING:')}
              </span>
              {renderUnderlinedValue({
                elId: 'reopening-date',
                elLabel: 'Reopening Date',
                fallbackText: '15th Sept, 2026',
                lineId: 'reopening-date-line',
                lineLabel: 'Reopening Date Horizontal Line',
                lineColor: isTheme2 ? '#cbd5e1' : '#94a3b8',
                align: 'center',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              })}
            </div>
          </div>
        </div>

        {/* Marks Table */}
        {Array.isArray(tableOverride?.customColumns) && tableOverride.customColumns.length > 0 ? <CustomSubjectTable columns={tableOverride.customColumns as SubjectColumn[]} rows={rows} subjectCatalog={subjectCatalog} headerBg={tableHeaderBg} headerColor={tableHeaderColor} borderColor={(tableOverride?.borderColor as string) || '#334155'} style={ovStyle('subject-table', { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9, marginTop: 8, cursor: 'pointer' })} /> : (
        <table
          data-element-id="subject-table"
          data-element-type="table"
          data-element-label="Subject Table"
          style={ovStyle('subject-table', {
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            marginTop: 10,
            fontSize: (tableOverride?.fontSize as number) ?? 8.5,
            cursor: 'pointer',
          })}
        >
          <thead>
            <tr
              style={{
                backgroundColor: tableHeaderBg,
                color: tableHeaderColor,
                borderTop: isTheme4 ? '1.5px solid #0f172a' : isTheme2 ? '1px solid #cbd5e1' : `1px solid ${borderTint}`,
                borderBottom: isTheme4
                  ? '1.5px solid #0f172a'
                  : isTheme2
                    ? '1.5px solid #475569'
                    : `1px solid ${borderTint}`,
              }}
            >
              {(() => {
                const compCount = activeScoreComponents.length
                const subjBase = compCount >= 3 ? 28 : 34
                const perCompBase = Math.max(9, Math.round(28 / Math.max(1, compCount)))
                const cols: Array<{ cellKey: string; label: string; align: 'left' | 'center'; base: number }> = [
                  { cellKey: 'th-subject', label: 'SUBJECT', align: 'left', base: subjBase },
                  ...activeScoreComponents.map((comp, ci) => {
                    const fallbackLabel = hasExamParts
                      ? (/\(\s*\d+/.test(comp.name) ? comp.name.toUpperCase() : `${comp.name.toUpperCase()} (${comp.max})`)
                      : (ci === 0 ? `CLASS SCORE (${caWeight}%)` : `EXAMS (${examWeight}%)`)
                    return {
                      cellKey: `th-comp-${ci}`,
                      label: fallbackLabel,
                      align: 'center' as const,
                      base: perCompBase,
                    }
                  }),
                  {
                    cellKey: 'th-total',
                    label: hasExamParts ? `TOTAL SCORE (${activeTotalMax})` : 'TOTAL SCORE (100%)',
                    align: 'center',
                    base: 14,
                  },
                  ...(showPosition ? [{ cellKey: 'th-pos', label: 'POSITION', align: 'center' as const, base: 10 }] : []),
                  ...(showRemark ? [{ cellKey: 'th-remark', label: 'REMARKS', align: 'center' as const, base: 13 }] : []),
                ]
                const totalBase = cols.reduce((s, c) => s + c.base, 0)
                return cols.map((c) => ({
                  cellKey: c.cellKey,
                  label: c.label,
                  align: c.align,
                  width: `${(c.base / totalBase * 100).toFixed(2)}%`,
                }))
              })().map((col) => (
                <th
                  key={col.cellKey}
                  data-table-cell-key={col.cellKey}
                  data-table-cell-label={col.label}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                    padding: '5px 5px',
                    fontWeight: 800,
                    fontSize: 7.5,
                    letterSpacing: '0.03em',
                    background: tableHeaderBg,
                    color: tableHeaderColor,
                    border: isTheme1 ? '1px solid #334155' : 'none',
                    borderTop: isTheme4 ? '1.5px solid #0f172a' : isTheme2 ? '1px solid #cbd5e1' : isTheme1 ? '1px solid #334155' : 'none',
                    borderBottom: isTheme4 ? '1.5px solid #0f172a' : isTheme2 ? '1.5px solid #475569' : isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {ovText(col.cellKey, col.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const rowBg =
                (isTheme3 || isTheme5) && idx % 2 === 1
                  ? isTheme5
                    ? '#f0fdfa'
                    : '#f8fafc'
                  : '#ffffff'
              return (
              <tr
                key={`${r.subject}-${idx}`}
                style={{
                  backgroundColor: rowBg,
                  borderBottom: isTheme1
                    ? '1px solid #334155'
                    : isTheme4 || isTheme2
                      ? '1px solid #cbd5e1'
                      : '1px solid #e2e8f0',
                }}
              >
                <td
                  data-table-cell-key={`td-${idx}-subject`}
                  data-table-cell-label="Subject Name"
                  style={{
                    padding: '4.5px 5px',
                    fontWeight: 600,
                    background: rowBg,
                    color: '#0f172a',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {ovText(`td-${idx}-subject`, r.subject)}
                </td>
                {r.colScores.map((sc, ci) => (
                  <td
                    key={ci}
                    data-table-cell-key={`td-${idx}-sc-${ci}`}
                    data-table-cell-label={`${r.subject} ${activeScoreComponents[ci]?.name || 'Score'}`}
                    style={{
                      padding: '4.5px 5px',
                      textAlign: 'center',
                      background: rowBg,
                      color: '#1e293b',
                      border: isTheme1 ? '1px solid #334155' : 'none',
                    }}
                  >
                    {ovText(`td-${idx}-sc-${ci}`, sc.toFixed(1))}
                  </td>
                ))}
                <td
                  data-table-cell-key={`td-${idx}-total`}
                  data-table-cell-label={`${r.subject} Total`}
                  style={{
                    padding: '4.5px 5px',
                    textAlign: 'center',
                    fontWeight: 800,
                    background: rowBg,
                    color: isTheme5 ? '#0f766e' : '#0f172a',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {ovText(`td-${idx}-total`, r.total.toFixed(1))}
                </td>
                {showPosition && (
                  <td
                    data-table-cell-key={`td-${idx}-pos`}
                    data-table-cell-label={`${r.subject} Position`}
                    style={{
                      padding: '4.5px 5px',
                      textAlign: 'center',
                      fontWeight: 600,
                      background: rowBg,
                      color: '#1e293b',
                      border: isTheme1 ? '1px solid #334155' : 'none',
                    }}
                  >
                    {ovText(`td-${idx}-pos`, r.position)}
                  </td>
                )}
                {showRemark && (
                  <td
                    data-table-cell-key={`td-${idx}-remark`}
                    data-table-cell-label={`${r.subject} Remark`}
                    style={{
                      padding: '4.5px 5px',
                      textAlign: 'center',
                      fontWeight: 700,
                      background: rowBg,
                      color: isTheme5 ? '#0d9488' : '#0f172a',
                      border: isTheme1 ? '1px solid #334155' : 'none',
                    }}
                  >
                    {ovText(`td-${idx}-remark`, r.remarks)}
                  </td>
                )}
              </tr>
              )
            })}
            {showClassAvg && (() => {
              const avgBg = isTheme3 || isTheme5 ? primary : '#eef2f6'
              return (
                <tr style={{ backgroundColor: avgBg, borderTop: isTheme4 ? '1.5px solid #0f172a' : isTheme2 ? '1.5px solid #475569' : undefined }}>
                  <td
                    data-table-cell-key="td-avg-label"
                    data-table-cell-label="Class Avg Label"
                    style={{ padding: '4.5px 5px', fontWeight: 800, background: avgBg, color: isTheme3 || isTheme5 ? '#ffffff' : '#0f172a', border: isTheme1 ? '1px solid #334155' : 'none' }}
                  >
                    {ovText('td-avg-label', 'Class Avg')}
                  </td>
                  {activeScoreComponents.map((_, ci) => (
                    <td
                      key={ci}
                      style={{ padding: '4.5px 5px', textAlign: 'center', fontWeight: 800, background: avgBg, color: isTheme3 || isTheme5 ? '#ffffff' : '#1e293b', border: isTheme1 ? '1px solid #334155' : 'none' }}
                    >
                      {rows.length > 0 ? (rows.reduce((s, r) => s + (r.colScores[ci] ?? 0), 0) / rows.length).toFixed(1) : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '4.5px 5px', textAlign: 'center', fontWeight: 800, background: avgBg, color: isTheme5 ? '#ccfbf1' : isTheme3 ? '#ffffff' : '#0f172a', border: isTheme1 ? '1px solid #334155' : 'none' }}>
                    {rows.length > 0 ? (rows.reduce((s, r) => s + r.total, 0) / rows.length).toFixed(1) : '—'}
                  </td>
                  {showPosition && <td style={{ padding: '4.5px 5px', background: avgBg, border: isTheme1 ? '1px solid #334155' : 'none' }} />}
                  {showRemark && <td style={{ padding: '4.5px 5px', background: avgBg, border: isTheme1 ? '1px solid #334155' : 'none' }} />}
                </tr>
              )
            })()}
          </tbody>
        </table>
        )}

        {/* Conduct, Attendance & Remarks Section — conditional on report options */}
        <div style={{ marginTop: 10, fontSize: 8.2, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {has('Attendance Percentage') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span
                  data-element-id="label-attendance"
                  data-element-type="text"
                  data-element-label="Attendance Label"
                  style={ovStyle('label-attendance', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
                >
                  {ovText('label-attendance', 'ATTENDANCE:')}
                </span>
                {renderUnderlinedValue({
                  elId: 'attendance-field',
                  elLabel: 'Attendance',
                  fallbackText: '96%',
                  lineId: 'attendance-field-line',
                  lineLabel: 'Attendance Horizontal Line',
                  lineColor: '#94a3b8',
                  align: 'center',
                  fontWeight: 700,
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span
                  data-element-id="label-attendance-total"
                  data-element-type="text"
                  data-element-label="Attendance Out Of Label"
                  style={ovStyle('label-attendance-total', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
                >
                  {ovText('label-attendance-total', 'OUT OF:')}
                </span>
                {renderUnderlinedValue({
                  elId: 'attendance-total',
                  elLabel: 'Attendance Total',
                  fallbackText: '100',
                  lineId: 'attendance-total-line',
                  lineLabel: 'Attendance Out Of Horizontal Line',
                  lineColor: '#94a3b8',
                  align: 'center',
                  fontWeight: 700,
                })}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span
                  data-element-id="label-promoted-to"
                  data-element-type="text"
                  data-element-label="Promoted To Label"
                  style={ovStyle('label-promoted-to', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
                >
                  {ovText('label-promoted-to', 'PROMOTED TO:')}
                </span>
                {renderUnderlinedValue({
                  elId: 'promoted-to',
                  elLabel: 'Promoted To',
                  fallbackText: '—',
                  lineId: 'promoted-to-line',
                  lineLabel: 'Promoted To Horizontal Line',
                  lineColor: '#94a3b8',
                  align: 'center',
                  fontWeight: 700,
                })}
              </div>
            </div>
          )}

          {/* Summary metrics from report options */}
          {has('Position') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>POSITION:</span>
                <span
                  data-element-id="summary-position"
                  data-element-type="text"
                  data-element-label="Summary Position"
                  style={ovStyle('summary-position', { fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4, cursor: 'pointer' })}
                >
                  {ovText('summary-position', '1st of 32')}
                </span>
              </div>
            </div>
          )}
          {has('Cumulative Average') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>CUMULATIVE AVG:</span>
                <span
                  data-element-id="summary-cumulative-avg"
                  data-element-type="text"
                  data-element-label="Cumulative Average"
                  style={ovStyle('summary-cumulative-avg', { fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4, cursor: 'pointer' })}
                >
                  {ovText('summary-cumulative-avg', '82.4')}
                </span>
              </div>
            </div>
          )}
          {has('Class Average') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>CLASS AVG:</span>
                <span
                  data-element-id="class-average"
                  data-element-type="text"
                  data-element-label="Class Average"
                  style={ovStyle('class-average', { fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4, cursor: 'pointer' })}
                >
                  {ovText('class-average', '74.1')}
                </span>
              </div>
            </div>
          )}
          {has('Result') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>RESULT:</span>
                <span
                  data-element-id="summary-result"
                  data-element-type="text"
                  data-element-label="Result Status"
                  style={ovStyle('summary-result', { fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4, cursor: 'pointer' })}
                >
                  {ovText('summary-result', 'PASS')}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              data-element-id="label-conduct"
              data-element-type="text"
              data-element-label="Conduct Label"
              style={ovStyle('label-conduct', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
            >
              {ovText('label-conduct', 'CONDUCT:')}
            </span>
            {renderUnderlinedValue({
              elId: 'conduct-field',
              elLabel: 'Conduct',
              fallbackText: 'Respectful',
              lineId: 'conduct-field-line',
              lineLabel: 'Conduct Horizontal Line',
              lineColor: '#94a3b8',
              lineStyle: isTheme2 ? 'dashed' : 'solid',
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              data-element-id="label-attitude"
              data-element-type="text"
              data-element-label="Attitude Label"
              style={ovStyle('label-attitude', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
            >
              {ovText('label-attitude', 'ATTITUDE:')}
            </span>
            {renderUnderlinedValue({
              elId: 'attitude-field',
              elLabel: 'Attitude',
              fallbackText: 'Hardworking',
              lineId: 'attitude-field-line',
              lineLabel: 'Attitude Horizontal Line',
              lineColor: '#94a3b8',
              lineStyle: isTheme2 ? 'dashed' : 'solid',
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              data-element-id="label-interest"
              data-element-type="text"
              data-element-label="Interest Label"
              style={ovStyle('label-interest', { fontWeight: 700, color: '#334155', cursor: 'pointer' })}
            >
              {ovText('label-interest', 'INTEREST:')}
            </span>
            {renderUnderlinedValue({
              elId: 'interest-field',
              elLabel: 'Interest',
              fallbackText: 'Reading',
              lineId: 'interest-field-line',
              lineLabel: 'Interest Horizontal Line',
              lineColor: '#94a3b8',
              lineStyle: isTheme2 ? 'dashed' : 'solid',
            })}
          </div>
          {has('Remark') && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                data-element-id="label-class-teacher-remarks"
                data-element-type="text"
                data-element-label="Class Teacher Remarks Label"
                style={ovStyle('label-class-teacher-remarks', { fontWeight: 700, color: isTheme5 ? primary : '#334155', minWidth: 130, cursor: 'pointer' })}
              >
                {ovText('label-class-teacher-remarks', "CLASS TEACHER'S REMARKS:")}
              </span>
              {renderUnderlinedValue({
                elId: 'class-teacher-remarks',
                elLabel: "Class Teacher's Remarks",
                fallbackText: 'Well organized, keep it up.',
                lineId: 'class-teacher-remarks-line',
                lineLabel: 'Class Teacher Remarks Horizontal Line',
                lineColor: '#94a3b8',
                lineStyle: isTheme2 ? 'dashed' : 'solid',
                align: isTheme1 || isTheme4 ? 'center' : 'left',
              })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              data-element-id="label-head-teacher-remarks"
              data-element-type="text"
              data-element-label="Head Teacher Remarks Label"
              style={ovStyle('label-head-teacher-remarks', { fontWeight: 700, color: isTheme5 ? primary : '#334155', minWidth: 130, cursor: 'pointer' })}
            >
              {ovText('label-head-teacher-remarks', "HEAD TEACHER'S REMARKS:")}
            </span>
            {renderUnderlinedValue({
              elId: 'head-teacher-remarks',
              elLabel: "Head Teacher's Remarks",
              fallbackText: 'An impressive performance.',
              lineId: 'head-teacher-remarks-line',
              lineLabel: 'Head Teacher Remarks Horizontal Line',
              lineColor: '#94a3b8',
              lineStyle: isTheme2 ? 'dashed' : 'solid',
              align: isTheme1 || isTheme4 ? 'center' : 'left',
            })}
          </div>
        </div>

        {/* Signatures Footer — uses footerContent when provided, otherwise default layout */}
        {footerLines.length > 0 ? (
          <div style={{ marginTop: 'auto', paddingTop: 14 }}>
            {signatureGroups.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 20,
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                {signatureGroups.map((group, gi) => (
                  <div key={gi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 120 }}>
                    {group.map((line, li) => renderContentLine(line, li, 'center'))}
                  </div>
                ))}
              </div>
            )}
            {trailingGroups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {trailingGroups.map((group, gi) =>
                  group.map((line, li) => renderContentLine(line, li + gi * 10, 'left')),
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
            }}
          >
            <div
              data-element-id="class-teacher-signature"
              data-element-type="signature"
              data-element-label="Class Teacher Signature"
              style={ovStyle('class-teacher-signature', {
                border: isTheme3 || isTheme5 ? `1px solid ${isTheme5 ? '#99f6e4' : '#e2e8f0'}` : 'none',
                backgroundColor: isTheme5 ? '#f0fdfa' : isTheme3 ? '#f8fafc' : 'transparent',
                borderRadius: 4,
                padding: isTheme3 || isTheme5 ? '6px 10px' : '2px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
              })}
            >
              <div>
                {resolvedLeftSigSrc ? (
                  <img
                    src={resolvedLeftSigSrc}
                    alt="Class Teacher Signature"
                    style={{
                      height: ov('class-teacher-signature')?.style?.customSize && ov('class-teacher-signature')?.height ? Math.max(16, ov('class-teacher-signature')!.height! - 18) : 26,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <TeacherSignatureSvg variant="left" color={(ov('class-teacher-signature')?.style?.color as string) || primary} />
                )}
              </div>
              {renderThemeLine('class-teacher-signature-line', 'Class Teacher Signature Horizontal Line', '#64748b', 1, 'solid', {
                width: '82%',
                marginTop: -1,
                marginBottom: -2,
                padding: '3px 0',
                alignSelf: 'center',
              })}
              <div
                style={{
                  width: '82%',
                  paddingTop: 2,
                  textAlign: 'center',
                  fontSize: 7.2,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: (ov('class-teacher-signature')?.style?.color as string) || '#475569',
                }}
              >
                {ov('class-teacher-signature')?.caption ?? ovText('class-teacher-signature', "CLASS TEACHER'S SIGNATURE")}
              </div>
            </div>

            <div
              data-element-id="head-teacher-signature"
              data-element-type="signature"
              data-element-label="Head Teacher Signature"
              style={ovStyle('head-teacher-signature', {
                border: isTheme3 || isTheme5 ? `1px solid ${isTheme5 ? '#99f6e4' : '#e2e8f0'}` : 'none',
                backgroundColor: isTheme5 ? '#f0fdfa' : isTheme3 ? '#f8fafc' : 'transparent',
                borderRadius: 4,
                padding: isTheme3 || isTheme5 ? '6px 10px' : '2px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: 'pointer',
              })}
            >
              <div>
                {resolvedRightSigSrc ? (
                  <img
                    src={resolvedRightSigSrc}
                    alt="Head Teacher Signature"
                    style={{
                      height: ov('head-teacher-signature')?.style?.customSize && ov('head-teacher-signature')?.height ? Math.max(16, ov('head-teacher-signature')!.height! - 18) : 26,
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <TeacherSignatureSvg variant="right" color={(ov('head-teacher-signature')?.style?.color as string) || primary} />
                )}
              </div>
              {renderThemeLine('head-teacher-signature-line', 'Head Teacher Signature Horizontal Line', '#64748b', 1, 'solid', {
                width: '82%',
                marginTop: -1,
                marginBottom: -2,
                padding: '3px 0',
                alignSelf: 'center',
              })}
              <div
                style={{
                  width: '82%',
                  paddingTop: 2,
                  textAlign: 'center',
                  fontSize: 7.2,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: (ov('head-teacher-signature')?.style?.color as string) || '#475569',
                }}
              >
                {ov('head-teacher-signature')?.caption ?? ovText('head-teacher-signature', "HEAD TEACHER'S SIGNATURE")}
              </div>
            </div>
          </div>
        )}

        {/* Grading Key Micro-footer — only shown when Grading Scale is in report options */}
        {has('Grading Scale') && (
          <div style={{ marginTop: 8 }}>
            {renderThemeLine('grading-scale-line', 'Grading Scale Horizontal Line', '#cbd5e1', 1, 'solid', {
              marginTop: -3,
              marginBottom: -2,
              padding: '3px 0',
            })}
            <div
              data-element-id="grading-scale"
              data-element-type="text"
              data-element-label="Grading Scale"
              style={ovStyle('grading-scale', {
                paddingTop: 3,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 6.8,
                color: '#475569',
                cursor: 'pointer',
              })}
            >
              <span>{ovText('grading-scale', 'GRADING: 80–100 Excellent · 70–79 Very Good · 60–69 Good · 50–59 Credit · <50 Pass')}</span>
              <span
                data-element-id="grading-scale-tag"
                data-element-type="text"
                data-element-label="Footer Tagline"
                style={ovStyle('grading-scale-tag', { cursor: 'pointer' })}
              >
                {ovText('grading-scale-tag', 'Official Terminal Report')}
              </span>
            </div>
          </div>
        )}
      </div>
      {renderPublishedCustomOverlays()}
    </div>
  )
}

/** Scales the 560x780 sheet smoothly to fit any card width. */
function ScaledSheetThumbnail({
  theme,
  isActive,
  onZoom,
  schoolName,
  schoolAddress,
  schoolPhone,
  schoolEmail,
  examName,
  parts,
  logoDataUrl,
  leftSignatureDataUrl,
  middleSignatureDataUrl,
  rightSignatureDataUrl,
  templateCaption,
  caWeight,
  examWeight,
  academicYear,
  termLabel,
  subjectCatalog,
}: {
  theme: ReportsheetThemeDef
  subjectCatalog?: EduRow[]
  isActive: boolean
  onZoom: () => void
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolEmail?: string
  examName?: string
  parts?: Array<{ name: string; max: number }>
  logoDataUrl?: string
  leftSignatureDataUrl?: string
  middleSignatureDataUrl?: string
  rightSignatureDataUrl?: string
  templateCaption?: string
  caWeight: number
  examWeight: number
  academicYear: string
  termLabel: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.36)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / 560)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      onClick={onZoom}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onZoom()
        }
      }}
      title={`Click to zoom in on ${theme.name}`}
      className="group relative w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-2xs transition hover:border-slate-300"
      style={{ height: Math.round(780 * scale) }}
    >
      <div
        style={{
          width: 560,
          height: 780,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        <ReportsheetSheetRenderer
          themeId={theme.id}
          subjectCatalog={subjectCatalog}
          schoolName={schoolName}
          schoolAddress={schoolAddress}
          schoolPhone={schoolPhone}
          schoolEmail={schoolEmail}
          examName={theme.examName || examName}
          parts={parts}
          logoDataUrl={logoDataUrl}
          leftSignatureDataUrl={leftSignatureDataUrl}
          middleSignatureDataUrl={middleSignatureDataUrl}
          rightSignatureDataUrl={rightSignatureDataUrl}
          templateCaption={templateCaption}
          caWeight={caWeight}
          examWeight={examWeight}
          academicYear={academicYear}
          termLabel={termLabel}
        />
      </div>

      {/* Active checkmark badge overlaid at top-right of active card preview */}
      {isActive && (
        <div
          className="pointer-events-none absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full shadow-md"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <Check className="size-4 stroke-[2.75]" />
        </div>
      )}

      {/* Subtle hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/10 group-hover:opacity-100">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
          <Search className="size-3.5" />
          Preview
        </span>
      </div>
    </div>
  )
}

export function ReportsheetThemePage() {
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches } = useApp()

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  )
  const schoolName = activeBranch?.name?.trim() || 'Airport City Flagship'
  const schoolAddress = activeBranch?.address || activeBranch?.city || 'Accra, Greater Accra'
  const schoolPhone = activeBranch?.phone || '030 222 4455'
  // Branch carries no email field yet — fall back to the school default.
  const schoolEmail = (activeBranch as { email?: string } | undefined)?.email || 'info@example.edu.gh'

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    const refresh = () => {
      const loaded = loadEduRecords(activeBranchId, activeBranch?.name)
      const updated = ensureSemesterResultTheme(loaded)
      if (updated !== loaded) saveEduRecords(activeBranchId, updated)
      setRecords(updated)
    }
    refresh()
    const unsubscribeHydrated = subscribeDbHydrated(refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('fitpro:eduThemesUpdated', refresh)
    return () => {
      unsubscribeHydrated()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('fitpro:eduThemesUpdated', refresh)
    }
  }, [activeBranchId, activeBranch?.name])

  const allThemes = useMemo(() => getAllReportsheetThemes(records), [records])
  const activeTheme = useMemo(() => getActiveReportsheetTheme(records), [records])
  const [zoomedThemeId, setZoomedThemeId] = useState<ReportsheetThemeId | null>(null)

  // Pull live CA / Exam percentage split, academic year, and any Marksheet Template assets
  const previewMeta = useMemo(() => {
    const cas = (records.continuousAssessments ?? []) as EduRow[]
    const latestCa = cas[0]
    const caPct = Number(latestCa?.classScorePct)
    const caWeight = Number.isFinite(caPct) && caPct > 0 && caPct < 100 ? caPct : 30
    const examWeight = 100 - caWeight

    const activeYr =
      ((records.academicYear ?? []) as EduRow[]).find(
        (r) => String(r.status ?? '').toLowerCase() === 'active',
      )?.name ||
      latestCa?.academicYear ||
      '2025/2026'

    const rawTerm = String(latestCa?.term || '1').replace(/^term\s*/i, '').trim() || '1'

    const tmplRows = (records.marksheetTemplate ?? []) as EduRow[]
    const primaryTmpl = tmplRows[0]
    const tmplWithLogo = tmplRows.find((r) => String(r.logoImage ?? '').startsWith('data:'))

    return {
      caWeight,
      examWeight,
      academicYear: String(activeYr),
      termLabel: rawTerm,
      examName: String(primaryTmpl?.examName || 'First Term Examination'),
      templateCaption: String(primaryTmpl?.templateName || 'Sample(A4 Portrait) 1'),
      logoDataUrl: tmplWithLogo ? String(tmplWithLogo.logoImage) : undefined,
      leftSignatureDataUrl: String(primaryTmpl?.leftSignature ?? '').startsWith('data:')
        ? String(primaryTmpl?.leftSignature)
        : undefined,
      middleSignatureDataUrl: String(primaryTmpl?.middleSignature ?? '').startsWith('data:')
        ? String(primaryTmpl?.middleSignature)
        : undefined,
      rightSignatureDataUrl: String(primaryTmpl?.rightSignature ?? '').startsWith('data:')
        ? String(primaryTmpl?.rightSignature)
        : undefined,
    }
  }, [records])

  const [deletingTheme, setDeletingTheme] = useState<ReportsheetThemeDef | null>(null)
  const hasDeletedDefaults = useMemo(
    () => hasDeletedBuiltinReportsheetThemes(records),
    [records],
  )

  const handleApplyTheme = (themeId: ReportsheetThemeId) => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const { nextRecords, theme } = applyReportsheetThemeToRecords(latestRecords, themeId)
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    window.dispatchEvent(new CustomEvent('fitpro:eduThemesUpdated'))
    toast.success('Theme saved successfully', `${theme.name} is now active for all report cards.`)
  }

  const handleRequestDeleteTheme = (theme: ReportsheetThemeDef) => {
    if (allThemes.length <= 1) {
      toast.warning('Cannot delete last theme', 'At least one reportsheet theme must remain available.')
      return
    }
    setDeletingTheme(theme)
  }

  const handleConfirmDeleteTheme = () => {
    if (!deletingTheme) return
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const result = deleteReportsheetThemeFromRecords(latestRecords, deletingTheme.id)
    if (!result.deleted) {
      toast.warning(
        'Cannot delete theme',
        result.reason === 'last-theme'
          ? 'At least one reportsheet theme must remain available.'
          : 'Theme could not be found.',
      )
      setDeletingTheme(null)
      return
    }
    setRecords(result.nextRecords)
    saveEduRecords(activeBranchId, result.nextRecords)
    window.dispatchEvent(new CustomEvent('fitpro:eduThemesUpdated'))
    if (zoomedThemeId === deletingTheme.id) {
      setZoomedThemeId(null)
    }
    toast.success(
      'Theme deleted',
      `${deletingTheme.name} has been removed from Reportsheet Theme.`,
    )
    setDeletingTheme(null)
  }

  const handleRestoreDefaults = () => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const { nextRecords } = restoreDefaultReportsheetThemesToRecords(latestRecords)
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    window.dispatchEvent(new CustomEvent('fitpro:eduThemesUpdated'))
    toast.success('Default themes restored', 'Built-in themes Theme 1 – Theme 6 have been restored.')
  }

  const zoomedTheme = useMemo(
    () => (zoomedThemeId ? allThemes.find((th) => th.id === zoomedThemeId) ?? null : null),
    [zoomedThemeId, allThemes],
  )

  // Keyboard navigation in Zoom Modal
  useEffect(() => {
    if (!zoomedThemeId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedThemeId(null)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = allThemes.findIndex((th) => th.id === zoomedThemeId)
        if (idx === -1) return
        const delta = e.key === 'ArrowRight' ? 1 : -1
        const nextIdx = (idx + delta + allThemes.length) % allThemes.length
        setZoomedThemeId(allThemes[nextIdx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomedThemeId, allThemes])

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        <span>/</span>
        <span>Education Management</span>
        <span>/</span>
        <span>{t('nav.eduExaminations')}</span>
        <span>/</span>
        <span className="font-semibold text-inherit">{t('nav.eduReportsheetTheme')}</span>
      </div>

      <PageHeader
        title={t('nav.eduReportsheetTheme')}
        desc={`${schoolName} — Choose a theme (${allThemes[0]?.name || 'Theme 1'} – ${allThemes[allThemes.length - 1]?.name || 'Theme 6'}) for all report cards`}
        actions={
          hasDeletedDefaults ? (
            <Button variant="ghost" size="sm" onClick={handleRestoreDefaults}>
              <RotateCcw className="size-4" /> Restore Default Themes
            </Button>
          ) : undefined
        }
      />

      {/* Active Theme Banner Card */}
      <div className="mb-6 rounded-xl border border-line bg-slate-50/90 px-5 py-4 dark:bg-white/[0.03]">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-mist uppercase">
          <Palette className="size-3.5" />
          <span>Active Theme</span>
        </div>
        <div className="mt-1 text-base font-bold">{activeTheme.name}</div>
        <p className="mt-0.5 text-xs text-mist">{activeTheme.description}</p>
      </div>

      {/* Theme Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {allThemes.map((theme) => {
          const isActive = theme.id === activeTheme.id
          const themeParts = resolveExamPartsForTheme(theme.examName || previewMeta.examName, records)
          return (
            <div
              key={theme.id}
              className={`flex flex-col rounded-2xl bg-surface p-3 transition ${
                isActive
                  ? 'border-2 border-slate-900 shadow-md dark:border-emerald-400'
                  : 'border border-line hover:border-slate-400/70 hover:shadow-xs'
              }`}
            >
              <ScaledSheetThumbnail
                theme={theme}
                subjectCatalog={records.subjectList ?? []}
                isActive={isActive}
                onZoom={() => setZoomedThemeId(theme.id)}
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolPhone={schoolPhone}
                schoolEmail={schoolEmail}
                examName={theme.examName || previewMeta.examName}
                parts={themeParts}
                logoDataUrl={previewMeta.logoDataUrl}
                leftSignatureDataUrl={previewMeta.leftSignatureDataUrl}
                middleSignatureDataUrl={previewMeta.middleSignatureDataUrl}
                rightSignatureDataUrl={previewMeta.rightSignatureDataUrl}
                templateCaption={previewMeta.templateCaption}
                caWeight={previewMeta.caWeight}
                examWeight={previewMeta.examWeight}
                academicYear={previewMeta.academicYear}
                termLabel={previewMeta.termLabel}
              />

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="shrink-0 text-sm font-bold">{theme.name}</span>
                <span className="truncate text-[11px] text-mist">{theme.tagline}</span>
              </div>

              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomedThemeId(theme.id)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-transparent px-2 py-1.5 text-xs font-medium text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
                >
                  <Search className="size-3.5" />
                  <span>Zoom In</span>
                </button>

                {isActive ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950"
                  >
                    <Check className="size-3.5 stroke-[2.5]" />
                    <span>Active</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyTheme(theme.id)}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-line bg-slate-50/70 px-2 py-1.5 text-xs font-semibold transition hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:bg-white/[0.04] dark:hover:border-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950"
                  >
                    Apply
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRequestDeleteTheme(theme)}
                  disabled={allThemes.length <= 1}
                  title={
                    allThemes.length <= 1
                      ? 'At least one reportsheet theme must remain'
                      : `Delete ${theme.name}`
                  }
                  aria-label={`Delete ${theme.name}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line p-1.5 text-mist transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Note */}
      <div className="mt-6 rounded-xl border border-line/70 bg-slate-50/50 px-4 py-3 text-xs leading-relaxed text-mist dark:bg-white/[0.02]">
        <strong className="font-semibold text-inherit">Note:</strong> The selected theme applies to
        all report card PDFs generated for this school across all classes. Changing the theme will
        take effect the next time a report card is downloaded or printed (existing saved copies are
        not altered retroactively).
      </div>

      {/* Full-Screen Zoom Preview Modal */}
      {zoomedTheme &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setZoomedThemeId(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(15, 23, 42, 0.78)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px 16px',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setZoomedThemeId(null)}
              aria-label="Close preview"
              style={{
                position: 'fixed',
                top: 18,
                right: 22,
                width: 38,
                height: 38,
                borderRadius: '9999px',
                backgroundColor: 'rgba(255,255,255,0.14)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X className="size-5" />
            </button>

            {/* Previous Theme Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const idx = allThemes.findIndex((th) => th.id === zoomedTheme.id)
                const prev =
                  allThemes[(idx - 1 + allThemes.length) % allThemes.length]
                setZoomedThemeId(prev.id)
              }}
              aria-label="Previous theme"
              style={{
                position: 'fixed',
                left: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 40,
                height: 40,
                borderRadius: '9999px',
                backgroundColor: 'rgba(255,255,255,0.14)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft className="size-5" />
            </button>

            {/* Next Theme Arrow */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const idx = allThemes.findIndex((th) => th.id === zoomedTheme.id)
                const next = allThemes[(idx + 1) % allThemes.length]
                setZoomedThemeId(next.id)
              }}
              aria-label="Next theme"
              style={{
                position: 'fixed',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 40,
                height: 40,
                borderRadius: '9999px',
                backgroundColor: 'rgba(255,255,255,0.14)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Modal Sheet + Dark Bottom Action Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  overflowY: 'auto',
                  overflowX: 'auto',
                  backgroundColor: '#ffffff',
                  padding: '6px 8px 0 8px',
                }}
              >
                <div style={{ width: 560, marginInline: 'auto' }}>
                <ReportsheetSheetRenderer
                  themeId={zoomedTheme.id}
                  subjectCatalog={records.subjectList ?? []}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  schoolPhone={schoolPhone}
                  schoolEmail={schoolEmail}
                  examName={zoomedTheme.examName || previewMeta.examName}
                  parts={resolveExamPartsForTheme(zoomedTheme.examName || previewMeta.examName, records)}
                  logoDataUrl={previewMeta.logoDataUrl}
                  leftSignatureDataUrl={previewMeta.leftSignatureDataUrl}
                  middleSignatureDataUrl={previewMeta.middleSignatureDataUrl}
                  rightSignatureDataUrl={previewMeta.rightSignatureDataUrl}
                  templateCaption={previewMeta.templateCaption}
                  caWeight={previewMeta.caWeight}
                  examWeight={previewMeta.examWeight}
                  academicYear={previewMeta.academicYear}
                  termLabel={previewMeta.termLabel}
                />
                </div>
              </div>

              {/* Bottom Dark Action Footer */}
              <div
                style={{
                  backgroundColor: '#27272a',
                  color: '#ffffff',
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                    {zoomedTheme.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#cbd5e1',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 380,
                    }}
                  >
                    {zoomedTheme.description}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {allThemes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRequestDeleteTheme(zoomedTheme)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        backgroundColor: 'rgba(239, 68, 68, 0.16)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  )}

                  {zoomedTheme.id === activeTheme.id ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        borderRadius: 8,
                        backgroundColor: '#10b981',
                        color: '#052e16',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      <Check className="size-4 stroke-[2.5]" />
                      Active Layout
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyTheme(zoomedTheme.id)
                        setZoomedThemeId(null)
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        borderRadius: 8,
                        backgroundColor: '#09090b',
                        color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.16)',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Check className="size-4 stroke-[2.5]" />
                      Apply Layout
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Reportsheet Theme Confirmation Modal */}
      {deletingTheme &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setDeletingTheme(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900"
              style={{
                borderRadius: 12,
                padding: 24,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Trash2 className="size-5 text-red-500" />
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
                  Delete Reportsheet Theme
                </span>
              </div>
              <p className="dark:text-zinc-400" style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                Are you sure you want to delete <strong>{deletingTheme.name}</strong> ({deletingTheme.tagline})?
                {deletingTheme.id === activeTheme.id
                  ? ' Since this is currently the active theme, another available theme will automatically be set as active.'
                  : ''}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant="ghost" onClick={() => setDeletingTheme(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleConfirmDeleteTheme}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

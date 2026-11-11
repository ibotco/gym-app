import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, ChevronRight, Palette, Search, X } from 'lucide-react'
import { PageHeader } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import {
  REPORTSHEET_THEMES,
  applyReportsheetThemeToRecords,
  getActiveReportsheetTheme,
  type ReportsheetThemeDef,
  type ReportsheetThemeId,
} from '../../../lib/reportsheetThemes'

interface SampleSubjectRow {
  subject: string
  classScore: number
  examScore: number
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

function SchoolCrestSvg({ accent = '#334155' }: { accent?: string }) {
  return (
    <svg width="42" height="46" viewBox="0 0 48 52" fill="none" aria-hidden="true">
      <path
        d="M24 3L6 10.5V24.5C6 36.2 13.7 45.8 24 49C34.3 45.8 42 36.2 42 24.5V10.5L24 3Z"
        fill="#f8fafc"
        stroke={accent}
        strokeWidth="2.2"
      />
      <path
        d="M24 8L11 13.4V24.2C11 33.1 16.5 40.6 24 43.3C31.5 40.6 37 33.1 37 24.2V13.4L24 8Z"
        stroke={accent}
        strokeWidth="1.1"
        strokeDasharray="2 1.5"
      />
      <path d="M16 22.5L24 18.5L32 22.5L24 26.5L16 22.5Z" fill={accent} />
      <path d="M18.5 24.5V29.5C18.5 31.2 21 32.5 24 32.5C27 32.5 29.5 31.2 29.5 29.5V24.5" stroke={accent} strokeWidth="1.6" />
      <circle cx="24" cy="13.5" r="1.8" fill={accent} />
    </svg>
  )
}

function StudentPortraitSvg({ rounded }: { rounded: boolean }) {
  return (
    <div
      style={{
        width: 46,
        height: rounded ? 46 : 50,
        borderRadius: rounded ? '9999px' : 4,
        overflow: 'hidden',
        border: rounded ? '2px solid #cbd5e1' : '1px solid #cbd5e1',
        background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="46" height="48" viewBox="0 0 46 48" fill="none" aria-hidden="true">
        <circle cx="23" cy="17" r="8.5" fill="#7c4a2d" />
        <path d="M15 15.5C15 10.8 18.5 8 23 8C27.5 8 31 10.8 31 15.5C28.8 13.8 26 13.2 23 13.2C20 13.2 17.2 13.8 15 15.5Z" fill="#1e293b" />
        <path d="M9 48C9.8 36.8 15.2 31 23 31C30.8 31 36.2 36.8 37 48H9Z" fill="#0284c7" />
        <path d="M19.5 31L23 36.5L26.5 31H19.5Z" fill="#ffffff" />
      </svg>
    </div>
  )
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
    return <img src={src} alt={label} style={{ height, objectFit: 'contain' }} />
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
  subjects,
  showPosition = true,
  showGrade = true,
  showRemark = true,
  showClassAvg = true,
  showSubjectAvg = true,
}: {
  themeId: ReportsheetThemeId
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolEmail?: string
  examName?: string
  logoDataUrl?: string
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
  showPosition?: boolean
  showGrade?: boolean
  showRemark?: boolean
  showClassAvg?: boolean
  showSubjectAvg?: boolean
}) {
  const rows: SampleSubjectRow[] = useMemo(
    () => {
      const subjectList = subjects && subjects.length > 0 ? subjects : SAMPLE_SUBJECTS_BASE.map((s) => s.subject)
      return subjectList.map((subject) => {
        const baseItem = SAMPLE_SUBJECTS_BASE.find((s) => s.subject === subject) || SAMPLE_SUBJECTS_BASE[0]
        const classScore = Math.round(baseItem.caRatio * caWeight * 10) / 10
        const examScore = Math.round(baseItem.exRatio * examWeight * 10) / 10
        const total = Math.round((classScore + examScore) * 10) / 10
        const { grade, remarks } = remarkForTotal(total)
        return {
          subject,
          classScore,
          examScore,
          total,
          position: baseItem.position,
          grade,
          remarks,
        }
      })
    },
    [caWeight, examWeight, subjects],
  )

  // --- Form field parsing for editable preview (Themes 2–6) ---
  const samples: Record<string, string> = {
    institute_name: schoolName || 'School',
    institute_address: schoolAddress || 'Accra, Greater Accra',
    institute_email: schoolEmail || 'info@example.edu.gh',
    institute_phone_no: schoolPhone || '030 222 4455',
    exam_name: examName?.trim() || 'First Term Examination',
  }
  const picked = parseMultiSelectValues(reportOptions).map((v) => String(v).trim().toLocaleLowerCase())
  const has = (opt: string) => picked.includes(opt.toLocaleLowerCase())

  const headerLines = contentLines(headerContent)
  const footerLines = contentLines(footerContent)
  const footerGroups = groupFooterLines(footerLines)
  const signatureGroups = footerGroups.filter((g) => g.some(isBoxLine))
  const trailingGroups = footerGroups.filter((g) => !g.some(isBoxLine))

  const boxImage: Record<string, string> = {
    logo: logoDataUrl ?? '',
    student_photo: '',
    left_signature: leftSignatureDataUrl ?? '',
    middle_signature: middleSignatureDataUrl ?? '',
    right_signature: rightSignatureDataUrl ?? '',
  }

  const accentColor = accentColorOverride || REPORTSHEET_THEMES.find((t) => t.id === themeId)?.accentColor || '#1e293b'
  const padding = {
    top: topSpace !== undefined && topSpace !== '' ? Number(topSpace) : undefined,
    bottom: bottomSpace !== undefined && bottomSpace !== '' ? Number(bottomSpace) : undefined,
    left: leftSpace !== undefined && leftSpace !== '' ? Number(leftSpace) : undefined,
    right: rightSpace !== undefined && rightSpace !== '' ? Number(rightSpace) : undefined,
  }

  // Render a single content line with placeholder resolution
  const renderContentLine = (line: string, key: number, align: 'left' | 'center' | 'right' | 'justify' = 'left') => {
    const raw = String(line ?? '').trim()
    const text = stripAlignWrapper(raw)
    const only = /^\{([a-z_]+)\}$/i.exec(text)
    const token = only?.[1]?.toLocaleLowerCase() ?? ''
    if (token === 'student_details') {
      return <div key={key} style={{ textAlign: align }}>{renderStudentDetails(schoolName, examName, academicYear, termLabel, photoStyle)}</div>
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
  const theme6Components = useMemo(() => {
    if (parts && parts.length > 0) return parts
    return [
      { name: 'Class Score', max: caWeight },
      { name: 'Exam', max: examWeight },
    ]
  }, [parts, caWeight, examWeight])

  const theme6Rows = useMemo(() => {
    const maxMarks = theme6Components.reduce((sum, c) => sum + c.max, 0) || 100
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
        pos: si + 1,
      }
    })
  }, [theme6Components, subjects])

  if (themeId === 'theme-1') {
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
    const cellStyle: React.CSSProperties = {
      border: '1px solid #d7d7d0',
      padding: '4px 6px',
      fontSize: 9.5,
      color: '#16325c',
    }
    const maxMarks = theme6Components.reduce((sum, c) => sum + c.max, 0) || 100
    const resolvedExamName = examName?.trim() || 'First Term Examination'
    const resolvedTerm = termLabel.toLowerCase().startsWith('term') ? termLabel : `Term ${termLabel}`
    const resolvedAddress = schoolAddress?.trim() || 'Accra, Greater Accra'
    const resolvedPhone = schoolPhone?.trim() || '030 222 4455'
    const resolvedEmail = schoolEmail?.trim() || 'info@example.edu.gh'

    return (
      <div
        style={{
          width: 560,
          minHeight: 780,
          backgroundColor: '#ffffff',
          color: '#16325c',
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
        <div style={{ borderBottom: '2px solid #16325c', paddingBottom: 6 }}>
          <div
            data-element-id="school-logo"
            data-element-type="image"
            data-element-label="School Logo"
            style={{ cursor: 'pointer' }}
          >
            <DashedHolderBox src={logoDataUrl} label="logo" height={32} minWidth={46} />
          </div>
          <div
            data-element-id="school-name"
            data-element-type="text"
            data-element-label="School Name"
            style={{ fontSize: 10, minHeight: 13, color: '#16325c', marginTop: 3, cursor: 'pointer' }}
          >
            {schoolName || 'Airport City Flagship'}
          </div>
          <div
            data-element-id="school-address"
            data-element-type="text"
            data-element-label="School Address"
            style={{ fontSize: 10, minHeight: 13, color: '#16325c', cursor: 'pointer' }}
          >
            {resolvedAddress} · {resolvedPhone} · {resolvedEmail}
          </div>
          <div
            data-element-id="exam-name"
            data-element-type="text"
            data-element-label="Exam Name"
            style={{ fontSize: 10, minHeight: 13, color: '#16325c', cursor: 'pointer' }}
          >
            {resolvedExamName}
          </div>
        </div>

        {/* Student Details Row + Square Photo Placeholder */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, flex: 1 }}>
            {[
              ['STUDENT NAME', 'student-name', 'student-name'],
              ['ADMISSION NO', 'admission-no', 'Admission No'],
              ['CLASS', 'student-class', 'Class'],
              ['TERM', 'term-label', 'Term'],
              ['EXAM', 'exam-name-field', 'Exam'],
            ].map(([lbl, elId, elLabel]) => (
              <div key={lbl}>
                <div style={labelStyle}>{lbl}</div>
                <div
                  data-element-id={elId}
                  data-element-type="text"
                  data-element-label={elLabel}
                  style={{ ...valueStyle, cursor: 'pointer' }}
                >
                  {lbl === 'STUDENT NAME' ? 'Ama Owusu' : lbl === 'ADMISSION NO' ? 'ADM-001' : lbl === 'CLASS' ? 'Basic 7 A' : lbl === 'TERM' ? resolvedTerm : resolvedExamName}
                </div>
              </div>
            ))}
          </div>
          <div
            data-element-id="student-photo"
            data-element-type="image"
            data-element-label="Student Photo"
            style={{
              width: 38,
              height: 38,
              flex: 'none',
              background: '#e7e7e0',
              border: '1px solid #cfcfc6',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Marks Table (Warm Stone Header & Totals) */}
        <table
          data-element-id="subject-table"
          data-element-type="table"
          data-element-label="Subject Table"
          style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9.5, marginTop: 2, cursor: 'pointer' }}
        >
          <thead>
            <tr>
              <th style={{ ...cellStyle, textAlign: 'left', background: '#f1f1ec', fontWeight: 700, width: '22%' }}>
                Subject
              </th>
              {theme6Components.map((comp) => (
                <th
                  key={comp.name}
                  style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700, width: `calc((100% - 22% - 16% - ${showGrade ? '8%' : '0'} - ${showPosition ? '8%' : '0'}) / ${theme6Components.length})` }}
                >
                  {comp.name}
                  <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{comp.max}</div>
                </th>
              ))}
              <th style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700, width: '16%' }}>
                Total
                <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>/{maxMarks}</div>
              </th>
              {showGrade && (
                <th style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700, width: '8%' }}>
                  Grade
                </th>
              )}
              {showPosition && (
                <th style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700, width: '8%' }}>
                  Pos
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {theme6Rows.map((r) => (
              <tr key={r.subject}>
                <td style={cellStyle}>{r.subject}</td>
                {r.colScores.map((sc, ci) => (
                  <td key={ci} style={{ ...cellStyle, textAlign: 'center' }}>
                    {sc}
                  </td>
                ))}
                <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
                {showGrade && <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{r.grade}</td>}
                {showPosition && <td style={{ ...cellStyle, textAlign: 'center' }}>{r.pos}</td>}
              </tr>
            ))}
            <tr>
              <td style={{ ...cellStyle, background: '#f1f1ec' }} />
              {theme6Components.map((comp, ci) => (
                <td
                  key={comp.name}
                  style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}
                >
                  {theme6Rows.reduce((sum, r) => sum + (r.colScores[ci] ?? 0), 0)}
                </td>
              ))}
              <td style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                {theme6Rows.reduce((sum, r) => sum + r.total, 0)}
              </td>
              {showGrade && (
                <td style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                  —
                </td>
              )}
              {showPosition && (
                <td style={{ ...cellStyle, textAlign: 'center', background: '#f1f1ec', fontWeight: 700 }}>
                  —
                </td>
              )}
            </tr>
            {showClassAvg && (
              <tr>
                <td style={{ ...cellStyle, background: '#e8e8e2', fontWeight: 700 }}>Class Avg</td>
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

        {/* Summary Metrics Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 2 }}>
          {[
            ['ATTENDANCE', 'attendance-field', 'Attendance', '96%'],
            ['POSITION', 'position-field', 'Position', '3rd of 32'],
            ['CLASS AVERAGE', 'class-average', 'Class Average', '74.1'],
          ].map(([lbl, elId, elLabel, val]) => (
            <div key={lbl}>
              <div style={labelStyle}>{lbl}</div>
              <div
                data-element-id={elId}
                data-element-type="text"
                data-element-label={elLabel}
                style={{ ...valueStyle, cursor: 'pointer' }}
              >
                {val}
              </div>
            </div>
          ))}
        </div>

        {/* Grading Scale Line */}
        <div
          data-element-id="grading-scale"
          data-element-type="text"
          data-element-label="Grading Scale"
          style={{
            fontSize: 8.5,
            color: '#6b7280',
            borderTop: '1px solid #e3e3dc',
            paddingTop: 5,
            cursor: 'pointer',
          }}
        >
          Grading scale · A+ 90–100 · A 80–89 · B 70–79 · C 60–69 · D 50–59 · F below 50
        </div>

        {/* Class Teacher's Remark */}
        <div>
          <div style={labelStyle}>CLASS TEACHER&apos;S REMARK</div>
          <div
            data-element-id="class-teacher-remarks"
            data-element-type="text"
            data-element-label="Class Teacher's Remark"
            style={{ ...valueStyle, fontSize: 10.5, cursor: 'pointer' }}
          >
            A very promising term.
          </div>
        </div>

        {/* Footer — 3 Signature Columns + Printed Line + Template Caption */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid #e3e3dc', paddingTop: 8 }}>
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
                src: leftSignatureDataUrl,
                holder: 'left signature',
                caption: 'Class Teacher',
                elId: 'class-teacher-signature',
                elLabel: 'Class Teacher Signature',
                elType: 'signature',
              },
              {
                src: middleSignatureDataUrl,
                holder: 'middle signature',
                caption: 'Head of School',
                elId: 'head-of-school-signature',
                elLabel: 'Head of School Signature',
                elType: 'signature',
              },
              {
                src: rightSignatureDataUrl,
                holder: 'right signature',
                caption: 'Principal',
                elId: 'principal-signature',
                elLabel: 'Principal Signature',
                elType: 'signature',
              },
            ].map((sig) => (
              <div
                key={sig.holder}
                data-element-id={sig.elId}
                data-element-type={sig.elType}
                data-element-label={sig.elLabel}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
              >
                <DashedHolderBox src={sig.src} label={sig.holder} height={24} minWidth={62} />
                <div style={{ fontSize: 9.5, color: '#16325c' }}>{sig.caption}</div>
              </div>
            ))}
          </div>
          <div
            data-element-id="printed-line"
            data-element-type="text"
            data-element-label="Printed Line"
            style={{ fontSize: 9.5, color: '#16325c', marginTop: 8, cursor: 'pointer' }}
          >Printed —</div>
          <div
            data-element-id="template-caption"
            data-element-type="text"
            data-element-label="Template Caption"
            style={{ fontSize: 8, color: '#9ca3af', marginTop: 4, cursor: 'pointer' }}
          >
            {templateCaption?.trim() || 'Sample(A4 Portrait) 1'}
          </div>
        </div>
      </div>
    )
  }

  const isTheme1 = themeId === 'theme-2'
  const isTheme2 = themeId === 'theme-3'
  const isTheme3 = themeId === 'theme-4'
  const isTheme4 = themeId === 'theme-5'
  const isTheme5 = themeId === 'theme-6'

  // Use the theme's actual accentColor for primary — fixes mismatched colors
  const themeDef = REPORTSHEET_THEMES.find((t) => t.id === themeId) ?? REPORTSHEET_THEMES[0]
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

  return (
    <div
      style={{
        width: 560,
        minHeight: 780,
        backgroundColor: '#ffffff',
        backgroundImage: backgroundImage?.startsWith('data:') ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#0f172a',
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
          <div
            style={{
              paddingBottom: isTheme3 || isTheme5 ? 10 : 8,
              borderBottom: isTheme3
                ? `2px solid ${primary}`
                : isTheme5
                  ? `2px solid ${primary}`
                  : isTheme4
                    ? '1px solid #475569'
                    : 'none',
            }}
          >
            {headerLines.map((line, i) => renderContentLine(line, i, 'center'))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingBottom: isTheme3 || isTheme5 ? 10 : 8,
              borderBottom: isTheme3
                ? `2px solid ${primary}`
                : isTheme5
                  ? `2px solid ${primary}`
                  : isTheme4
                    ? '1px solid #475569'
                    : 'none',
            }}
          >
            <div
              data-element-id="school-logo"
              data-element-type="image"
              data-element-label="School Logo"
              style={{ width: 48, display: 'flex', justifyContent: 'flex-start', flexShrink: 0, cursor: 'pointer' }}
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt=""
                  style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 4 }}
                />
              ) : (
                <SchoolCrestSvg accent={primary} />
              )}
            </div>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div
                data-element-id="school-name"
                data-element-type="text"
                data-element-label="School Name"
                style={{
                  fontSize: isTheme4 ? 16 : 15,
                  fontWeight: 800,
                  letterSpacing: isTheme2 || isTheme4 ? '0.01em' : '0.04em',
                  textTransform: isTheme2 || isTheme4 ? 'none' : 'uppercase',
                  color: isTheme5 ? primary : '#0f172a',
                  lineHeight: 1.2,
                }}
              >
                {isTheme2 || isTheme4 ? schoolName : schoolName.toUpperCase()}
              </div>
              <div
                data-element-id="school-address"
                data-element-type="text"
                data-element-label="School Address"
                style={{ fontSize: 8.5, color: '#475569', marginTop: 2, fontWeight: 500 }}
              >
                {schoolAddress || 'Accra, Greater Accra · Knowledge & Integrity'}
              </div>
              <div
                data-element-id="school-phone"
                data-element-type="text"
                data-element-label="School Phone"
                style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}
              >
                {schoolPhone ? `Tel: ${schoolPhone}` : 'Tel: +233 24 000 0000 · info@school.edu.gh'}
              </div>
            </div>

            <div data-element-id="student-photo" data-element-type="image" data-element-label="Student Photo" style={{ cursor: 'pointer' }}>
              <StudentPortraitSvg rounded={isTheme2} />
            </div>
          </div>
        )}

        {/* Report Title Banner */}
        {isTheme3 || isTheme5 ? (
          <div
            style={{
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
            }}
          >
            TERMINAL REPORT SHEET
          </div>
        ) : isTheme4 ? (
          <div
            style={{
              marginTop: 8,
              borderTop: '1px solid #334155',
              borderBottom: '1px solid #334155',
              padding: '4px 0',
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#0f172a',
            }}
          >
            TERMINAL REPORT SHEET
          </div>
        ) : isTheme2 ? (
          <div
            style={{
              marginTop: 10,
              paddingBottom: 6,
              borderBottom: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#475569',
            }}
          >
            TERMINAL REPORT SHEET
          </div>
        ) : (
          <div
            data-element-id="exam-title"
            data-element-type="text"
            data-element-label="Exam Title"
            style={{
              marginTop: 8,
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.09em',
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            [ TERMINAL REPORT SHEET ]
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
            <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569', minWidth: 42 }}>NAME:</span>
            <span
              data-element-id="student-name"
              data-element-type="text"
              data-element-label="Student Name"
              style={{
                flex: 1,
                fontWeight: 700,
                fontSize: 9.5,
                color: '#0f172a',
                borderBottom: isTheme1 || isTheme4 ? '1px solid #64748b' : '1px solid #e2e8f0',
                paddingBottom: 1,
                textAlign: isTheme1 || isTheme4 ? 'center' : 'left',
                cursor: 'pointer',
              }}
            >
              Owusu Boateng Samuel
            </span>
          </div>

          {/* Row 2: Class / Roll / Term */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 0.85fr', gap: 10, marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>CLASS:</span>
              <span
                data-element-id="student-class"
                data-element-type="text"
                data-element-label="Class"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  cursor: 'pointer',
                }}
              >
                B4
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>ACADEMIC YEAR:</span>
              <span
                data-element-id="academic-year"
                data-element-type="text"
                data-element-label="Academic Year"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  cursor: 'pointer',
                }}
              >
                {academicYear}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>TERM:</span>
              <span
                data-element-id="term-label"
                data-element-type="text"
                data-element-label="Term"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  cursor: 'pointer',
                }}
              >
                {termLabel}
              </span>
            </div>
          </div>

          {/* Row 3: Position / No. on Roll / Reopening */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 0.85fr 1.3fr', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>POSITION:</span>
              <span
                data-element-id="position-field"
                data-element-type="text"
                data-element-label="Position"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  cursor: 'pointer',
                }}
              >
                1st
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>NO. ON ROLL:</span>
              <span
                data-element-id="roll-number"
                data-element-type="text"
                data-element-label="Admission No / Roll No"
                style={{
                  flex: 1,
                  fontWeight: 700,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  cursor: 'pointer',
                }}
              >
                32
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? '#0f766e' : '#475569' }}>REOPENING:</span>
              <span
                data-element-id="reopening-date"
                data-element-type="text"
                data-element-label="Reopening Date"
                style={{
                  flex: 1,
                  fontWeight: 600,
                  textAlign: 'center',
                  borderBottom: isTheme2 ? 'none' : '1px solid #94a3b8',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                15th Sept, 2026
              </span>
            </div>
          </div>
        </div>

        {/* Marks Table */}
        <table
          data-element-id="subject-table"
          data-element-type="table"
          data-element-label="Subject Table"
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            marginTop: 10,
            fontSize: 8.5,
            cursor: 'pointer',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: isTheme3 || isTheme5 ? primary : isTheme1 ? '#f8fafc' : 'transparent',
                color: isTheme3 || isTheme5 ? '#ffffff' : '#0f172a',
                borderTop: isTheme4 ? '1.5px solid #0f172a' : isTheme2 ? 'none' : `1px solid ${borderTint}`,
                borderBottom: isTheme4
                  ? '1.5px solid #0f172a'
                  : isTheme2
                    ? '1.5px solid #cbd5e1'
                    : `1px solid ${borderTint}`,
              }}
            >
              {(() => {
                const colBase = [36, 14, 13, 14, 10, 13]
                const colLabels = ['SUBJECT', `CLASS SCORE (${caWeight}%)`, `EXAMS (${examWeight}%)`, 'TOTAL SCORE (100%)', 'POSITION', 'REMARKS']
                const colAligns = ['left', 'center', 'center', 'center', 'center', 'center'] as const
                const visibleIdx = [0, 1, 2, 3, ...(showPosition ? [4] : []), ...(showRemark ? [5] : [])]
                const totalBase = visibleIdx.reduce((s, i) => s + colBase[i], 0)
                return visibleIdx.map((i, vi) => ({
                  label: colLabels[i],
                  align: colAligns[i],
                  width: `${(colBase[i] / totalBase * 100).toFixed(2)}%`,
                }))
              })().map((col) => (
                <th
                  key={col.label}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                    padding: '5px 5px',
                    fontWeight: 800,
                    fontSize: 7.5,
                    letterSpacing: '0.03em',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.subject}
                style={{
                  backgroundColor:
                    (isTheme3 || isTheme5) && idx % 2 === 1
                      ? isTheme5
                        ? '#f0fdfa'
                        : '#f8fafc'
                      : '#ffffff',
                  borderBottom: isTheme1
                    ? '1px solid #334155'
                    : isTheme4
                      ? '1px solid #cbd5e1'
                      : '1px solid #e2e8f0',
                }}
              >
                <td
                  style={{
                    padding: '4.5px 5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {r.subject}
                </td>
                <td
                  style={{
                    padding: '4.5px 5px',
                    textAlign: 'center',
                    color: '#334155',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {r.classScore.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: '4.5px 5px',
                    textAlign: 'center',
                    color: '#334155',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {r.examScore.toFixed(1)}
                </td>
                <td
                  style={{
                    padding: '4.5px 5px',
                    textAlign: 'center',
                    fontWeight: 800,
                    color: isTheme5 ? '#0f766e' : '#0f172a',
                    border: isTheme1 ? '1px solid #334155' : 'none',
                  }}
                >
                  {r.total.toFixed(1)}
                </td>
                {showPosition && (
                  <td
                    style={{
                      padding: '4.5px 5px',
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#334155',
                      border: isTheme1 ? '1px solid #334155' : 'none',
                    }}
                  >
                    {r.position}
                  </td>
                )}
                {showRemark && (
                  <td
                    style={{
                      padding: '4.5px 5px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: isTheme5 ? '#0d9488' : '#1e293b',
                      border: isTheme1 ? '1px solid #334155' : 'none',
                    }}
                  >
                    {r.remarks}
                  </td>
                )}
              </tr>
            ))}
            {showClassAvg && (
              <tr style={{ backgroundColor: isTheme3 || isTheme5 ? primary : '#f1f5f9' }}>
                <td style={{ padding: '4.5px 5px', fontWeight: 800, color: isTheme3 || isTheme5 ? '#ffffff' : '#0f172a', border: isTheme1 ? '1px solid #334155' : 'none' }}>Class Avg</td>
                <td style={{ padding: '4.5px 5px', textAlign: 'center', fontWeight: 800, color: isTheme3 || isTheme5 ? '#ffffff' : '#334155', border: isTheme1 ? '1px solid #334155' : 'none' }}>
                  {rows.length > 0 ? (rows.reduce((s, r) => s + r.classScore, 0) / rows.length).toFixed(1) : '—'}
                </td>
                <td style={{ padding: '4.5px 5px', textAlign: 'center', fontWeight: 800, color: isTheme3 || isTheme5 ? '#ffffff' : '#334155', border: isTheme1 ? '1px solid #334155' : 'none' }}>
                  {rows.length > 0 ? (rows.reduce((s, r) => s + r.examScore, 0) / rows.length).toFixed(1) : '—'}
                </td>
                <td style={{ padding: '4.5px 5px', textAlign: 'center', fontWeight: 800, color: isTheme5 ? '#ccfbf1' : isTheme3 ? '#ffffff' : '#0f172a', border: isTheme1 ? '1px solid #334155' : 'none' }}>
                  {rows.length > 0 ? (rows.reduce((s, r) => s + r.total, 0) / rows.length).toFixed(1) : '—'}
                </td>
                {showPosition && <td style={{ padding: '4.5px 5px', border: isTheme1 ? '1px solid #334155' : 'none' }} />}
                {showRemark && <td style={{ padding: '4.5px 5px', border: isTheme1 ? '1px solid #334155' : 'none' }} />}
              </tr>
            )}
          </tbody>
        </table>

        {/* Conduct, Attendance & Remarks Section — conditional on report options */}
        <div style={{ marginTop: 10, fontSize: 8.2, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {has('Attendance Percentage') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>ATTENDANCE:</span>
                <span
                  data-element-id="attendance-field"
                  data-element-type="text"
                  data-element-label="Attendance"
                  style={{ flex: 1, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  96%
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>OUT OF:</span>
                <span
                  data-element-id="attendance-total"
                  data-element-type="text"
                  data-element-label="Attendance Total"
                  style={{ flex: 1, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  100
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, color: '#475569' }}>PROMOTED TO:</span>
                <span
                  data-element-id="promoted-to"
                  data-element-type="text"
                  data-element-label="Promoted To"
                  style={{ flex: 1, fontWeight: 700, textAlign: 'center', borderBottom: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  —
                </span>
              </div>
            </div>
          )}

          {/* Summary metrics from report options */}
          {has('Position') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>POSITION:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4 }}>1st of 32</span>
              </div>
            </div>
          )}
          {has('Cumulative Average') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>CUMULATIVE AVG:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4 }}>82.4</span>
              </div>
            </div>
          )}
          {has('Class Average') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>CLASS AVG:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4 }}>74.1</span>
              </div>
            </div>
          )}
          {has('Result') && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', fontSize: 7 }}>RESULT:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 8, marginLeft: 4 }}>PASS</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>CONDUCT:</span>
            <span
              data-element-id="conduct-field"
              data-element-type="text"
              data-element-label="Conduct"
              style={{ flex: 1, fontWeight: 600, color: '#0f172a', borderBottom: isTheme2 ? '1px dashed #e2e8f0' : '1px solid #cbd5e1', paddingBottom: 1, cursor: 'pointer' }}
            >
              Respectful
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>ATTITUDE:</span>
            <span
              data-element-id="attitude-field"
              data-element-type="text"
              data-element-label="Attitude"
              style={{ flex: 1, fontWeight: 600, color: '#0f172a', borderBottom: isTheme2 ? '1px dashed #e2e8f0' : '1px solid #cbd5e1', paddingBottom: 1, cursor: 'pointer' }}
            >
              Hardworking
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>INTEREST:</span>
            <span
              data-element-id="interest-field"
              data-element-type="text"
              data-element-label="Interest"
              style={{ flex: 1, fontWeight: 600, color: '#0f172a', borderBottom: isTheme2 ? '1px dashed #e2e8f0' : '1px solid #cbd5e1', paddingBottom: 1, cursor: 'pointer' }}
            >
              Reading
            </span>
          </div>
          {has('Remark') && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', minWidth: 130 }}>
                CLASS TEACHER&apos;S REMARKS:
              </span>
              <span
                data-element-id="class-teacher-remarks"
                data-element-type="text"
                data-element-label="Class Teacher's Remarks"
                style={{
                  flex: 1,
                  fontWeight: 600,
                  color: '#0f172a',
                  borderBottom: isTheme2 ? '1px dashed #e2e8f0' : '1px solid #cbd5e1',
                  paddingBottom: 1,
                  textAlign: isTheme1 || isTheme4 ? 'center' : 'left',
                  cursor: 'pointer',
                }}
              >
                Well organized, keep it up.
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 700, color: isTheme5 ? primary : '#475569', minWidth: 130 }}>
              HEAD TEACHER&apos;S REMARKS:
            </span>
            <span
              data-element-id="head-teacher-remarks"
              data-element-type="text"
              data-element-label="Head Teacher's Remarks"
              style={{
                flex: 1,
                fontWeight: 600,
                color: '#0f172a',
                borderBottom: isTheme2 ? '1px dashed #e2e8f0' : '1px solid #cbd5e1',
                paddingBottom: 1,
                textAlign: isTheme1 || isTheme4 ? 'center' : 'left',
                cursor: 'pointer',
              }}
            >
              An impressive performance.
            </span>
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
              style={{
                border: isTheme3 || isTheme5 ? `1px solid ${isTheme5 ? '#99f6e4' : '#e2e8f0'}` : 'none',
                backgroundColor: isTheme5 ? '#f0fdfa' : isTheme3 ? '#f8fafc' : 'transparent',
                borderRadius: 4,
                padding: isTheme3 || isTheme5 ? '6px 10px' : '2px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div data-element-id="class-teacher-signature" data-element-type="signature" data-element-label="Class Teacher Signature" style={{ cursor: 'pointer' }}>
                <TeacherSignatureSvg variant="left" color={primary} />
              </div>
              <div
                style={{
                  width: '82%',
                  borderTop: '1px solid #64748b',
                  marginTop: 2,
                  paddingTop: 3,
                  textAlign: 'center',
                  fontSize: 7.2,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#475569',
                }}
              >
                CLASS TEACHER&apos;S SIGNATURE
              </div>
            </div>

            <div
              style={{
                border: isTheme3 || isTheme5 ? `1px solid ${isTheme5 ? '#99f6e4' : '#e2e8f0'}` : 'none',
                backgroundColor: isTheme5 ? '#f0fdfa' : isTheme3 ? '#f8fafc' : 'transparent',
                borderRadius: 4,
                padding: isTheme3 || isTheme5 ? '6px 10px' : '2px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div data-element-id="head-teacher-signature" data-element-type="signature" data-element-label="Head Teacher Signature" style={{ cursor: 'pointer' }}>
                <TeacherSignatureSvg variant="right" color={primary} />
              </div>
              <div
                style={{
                  width: '82%',
                  borderTop: '1px solid #64748b',
                  marginTop: 2,
                  paddingTop: 3,
                  textAlign: 'center',
                  fontSize: 7.2,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#475569',
                }}
              >
                HEAD TEACHER&apos;S SIGNATURE
              </div>
            </div>
          </div>
        )}

        {/* Grading Key Micro-footer — only shown when Grading Scale is in report options */}
        {has('Grading Scale') && (
          <div
            data-element-id="grading-scale"
            data-element-type="text"
            data-element-label="Grading Scale"
            style={{
              marginTop: 8,
              paddingTop: 4,
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 6.8,
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <span>GRADING: 80–100 Excellent · 70–79 Very Good · 60–69 Good · 50–59 Credit · &lt;50 Pass</span>
            <span>Official Terminal Report</span>
          </div>
        )}
      </div>
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
  logoDataUrl,
  leftSignatureDataUrl,
  middleSignatureDataUrl,
  rightSignatureDataUrl,
  templateCaption,
  caWeight,
  examWeight,
  academicYear,
  termLabel,
}: {
  theme: ReportsheetThemeDef
  isActive: boolean
  onZoom: () => void
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolEmail?: string
  examName?: string
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
          schoolName={schoolName}
          schoolAddress={schoolAddress}
          schoolPhone={schoolPhone}
          schoolEmail={schoolEmail}
          examName={examName}
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
  const schoolEmail = activeBranch?.email || 'info@example.edu.gh'

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
  }, [activeBranchId, activeBranch?.name])

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

  const handleApplyTheme = (themeId: ReportsheetThemeId) => {
    const { nextRecords, theme } = applyReportsheetThemeToRecords(records, themeId)
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Theme saved successfully', `${theme.name} is now active for all report cards.`)
  }

  const zoomedTheme = useMemo(
    () => (zoomedThemeId ? REPORTSHEET_THEMES.find((th) => th.id === zoomedThemeId) ?? null : null),
    [zoomedThemeId],
  )

  // Keyboard navigation in Zoom Modal
  useEffect(() => {
    if (!zoomedThemeId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedThemeId(null)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = REPORTSHEET_THEMES.findIndex((th) => th.id === zoomedThemeId)
        if (idx === -1) return
        const delta = e.key === 'ArrowRight' ? 1 : -1
        const nextIdx = (idx + delta + REPORTSHEET_THEMES.length) % REPORTSHEET_THEMES.length
        setZoomedThemeId(REPORTSHEET_THEMES[nextIdx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomedThemeId])

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
        desc={`${schoolName} — Choose a theme (Theme 1 – Theme 6) for all report cards`}
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

      {/* 6 Theme Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {REPORTSHEET_THEMES.map((theme) => {
          const isActive = theme.id === activeTheme.id
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
                isActive={isActive}
                onZoom={() => setZoomedThemeId(theme.id)}
                schoolName={schoolName}
                schoolAddress={schoolAddress}
                schoolPhone={schoolPhone}
                schoolEmail={schoolEmail}
                examName={previewMeta.examName}
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

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setZoomedThemeId(theme.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-xs font-medium text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
                >
                  <Search className="size-3.5" />
                  <span>Zoom In</span>
                </button>

                {isActive ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950"
                  >
                    <Check className="size-3.5 stroke-[2.5]" />
                    <span>Active</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyTheme(theme.id)}
                    className="inline-flex items-center justify-center rounded-lg border border-line bg-slate-50/70 px-2.5 py-1.5 text-xs font-semibold transition hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:bg-white/[0.04] dark:hover:border-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-slate-950"
                  >
                    Apply
                  </button>
                )}
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
                const idx = REPORTSHEET_THEMES.findIndex((th) => th.id === zoomedTheme.id)
                const prev =
                  REPORTSHEET_THEMES[(idx - 1 + REPORTSHEET_THEMES.length) % REPORTSHEET_THEMES.length]
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
                const idx = REPORTSHEET_THEMES.findIndex((th) => th.id === zoomedTheme.id)
                const next = REPORTSHEET_THEMES[(idx + 1) % REPORTSHEET_THEMES.length]
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
                <ReportsheetSheetRenderer
                  themeId={zoomedTheme.id}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  schoolPhone={schoolPhone}
                  schoolEmail={schoolEmail}
                  examName={previewMeta.examName}
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
          </div>,
          document.body,
        )}
    </div>
  )
}

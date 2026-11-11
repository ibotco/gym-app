import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bold, Italic, Underline, Strikethrough, ALargeSmall, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Type,
  Check, ChevronLeft, ChevronRight, FileText, Palette, Plus, Pencil, Trash2,
  Search, X, Printer, Star, Copy, Globe,
} from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Textarea, Empty, SearchInput } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { uid } from '../../../lib/utils'
import {
  REPORTSHEET_THEMES,
  findReportsheetTheme,
  getActiveReportsheetTheme,
} from '../../../lib/reportsheetThemes'

// ---------------------------------------------------------------------------
// Token system (mirrors MARKSHEET_CONTENT_TOKENS in EduModulePage.tsx)
// ---------------------------------------------------------------------------

const RESULT_TEMPLATE_TOKENS = [
  'name', 'gender', 'father_name', 'mother_name', 'student_photo', 'register_no',
  'academic_session', 'roll', 'admission_date', 'class', 'section', 'category',
  'cast', 'religion', 'blood_group', 'birthday', 'email', 'phone',
  'student_address', 'permanent_address', 'exam_name', 'left_signature',
  'middle_signature', 'right_signature', 'print_date', 'principal_comments',
  'teacher_comments', 'logo', 'institute_name', 'institute_address',
  'institute_email', 'institute_phone_no', 'motto', 'term',
]

const BOX_TOKENS = ['logo', 'student_photo', 'left_signature', 'middle_signature', 'right_signature']

const TOKEN_SAMPLES: Record<string, string> = {
  name: 'Kwame Mensah', gender: 'Male', father_name: 'Kwasi Mensah', mother_name: 'Akua Mensah',
  register_no: 'GS-001', academic_session: '2026/2027', roll: '07', admission_date: '2024-09-02',
  class: 'Basic 7 A', section: 'A', category: 'General', cast: '—', religion: 'Christian',
  blood_group: 'O+', birthday: '2013-04-18', email: 'kwame.mensah@example.edu.gh', phone: '024 555 0101',
  student_address: '12 Liberation Road, Accra', permanent_address: '12 Liberation Road, Accra',
  exam_name: 'First Term Examination', term: 'Term 1', print_date: '—',
  principal_comments: 'Excellent progress — keep it up.', teacher_comments: 'A very promising term.',
  institute_name: 'Airport City Flagship', institute_address: 'Accra, Greater Accra',
  institute_email: 'info@example.edu.gh', institute_phone_no: '030 222 4455',
  motto: 'Excellence in Education', term: 'First Term',
}

// ---------------------------------------------------------------------------
// multiSelectValues helper (mirrors EduModulePage.tsx)
// ---------------------------------------------------------------------------

const multiSelectValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map((item) => String(item ?? '').trim()).filter(Boolean))]
  } catch { /* legacy single-value field */ }
  return [raw]
}

// ---------------------------------------------------------------------------
// Content field with tokens (mirrors ContentFieldWithTokens in EduModulePage.tsx)
// ---------------------------------------------------------------------------

const FORMAT_BTN = 'grid size-7 place-items-center rounded-md text-zinc-500 transition hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white'

function FormatToolbar({ onWrap, onBlock, onLink, onFontSize, onAlign, onColor }: {
  onWrap: (before: string, after: string, placeholder: string) => void
  onBlock: (tag: 'p' | 'h2' | 'h3') => void
  onLink: () => void
  onFontSize?: (size: string) => void
  onAlign?: (align: 'left' | 'center' | 'right' | 'justify') => void
  onColor?: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-zinc-900 px-1.5 py-1 dark:bg-zinc-900">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onWrap('<b>', '</b>', 'bold text')} title="Bold" aria-label="Bold" className="grid size-7 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"><Bold className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onWrap('<i>', '</i>', 'italic text')} title="Italic" aria-label="Italic" className="grid size-7 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"><Italic className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onWrap('<u>', '</u>', 'underlined text')} title="Underline" aria-label="Underline" className="grid size-7 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"><Underline className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onWrap('<s>', '</s>', 'strikethrough')} title="Strikethrough" aria-label="Strikethrough" className="grid size-7 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white"><Strikethrough className="size-3.5" /></button>
      <span className="mx-1 h-4 w-px shrink-0 bg-white/15" aria-hidden />
      <label className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-zinc-200">
        <ALargeSmall className="size-3.5 text-zinc-400" />
        <select
          aria-label="Font size"
          defaultValue=""
          onChange={(e) => { const v = e.target.value; if (v && onFontSize) onFontSize(v); e.target.value = '' }}
          className="bg-transparent text-xs outline-none"
        >
          <option value="">Size</option>
          <option value="8pt">8pt</option>
          <option value="10pt">10pt</option>
          <option value="12pt">12pt</option>
          <option value="14pt">14pt</option>
          <option value="16pt">16pt</option>
        </select>
      </label>
      <label className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-xs text-zinc-200">
        <Type className="size-3.5 text-zinc-400" />
        <select
          aria-label="Color"
          defaultValue=""
          onChange={(e) => { const v = e.target.value; if (v && onColor) onColor(v); e.target.value = '' }}
          className="bg-transparent text-xs outline-none"
        >
          <option value="">Color</option>
          <option value="#dc2626">Red</option>
          <option value="#ea580c">Orange</option>
          <option value="#ca8a04">Yellow</option>
          <option value="#16a34a">Green</option>
          <option value="#0284c7">Blue</option>
          <option value="#7c3aed">Purple</option>
          <option value="#1e293b">Slate</option>
        </select>
      </label>
      <span className="mx-1 h-4 w-px shrink-0 bg-white/15" aria-hidden />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign?.('left')} title="Align Left" aria-label="Align Left" className={FORMAT_BTN}><AlignLeft className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign?.('center')} title="Align Center" aria-label="Align Center" className={FORMAT_BTN}><AlignCenter className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign?.('right')} title="Align Right" aria-label="Align Right" className={FORMAT_BTN}><AlignRight className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onAlign?.('justify')} title="Justify" aria-label="Justify" className={FORMAT_BTN}><AlignJustify className="size-3.5" /></button>
      <span className="mx-1 h-4 w-px shrink-0 bg-white/15" aria-hidden />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onLink} title="Insert Link" aria-label="Insert Link" className={FORMAT_BTN}><LinkIcon className="size-3.5" /></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onBlock('h2')} title="Heading" aria-label="Heading" className={FORMAT_BTN}><span className="text-[10px] font-bold">H2</span></button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onBlock('h3')} title="Subheading" aria-label="Subheading" className={FORMAT_BTN}><span className="text-[10px] font-bold">H3</span></button>
    </div>
  )
}

function ContentFieldWithTokens({ value, rows = 3, ariaLabel, onChange, alignments, onAlignChange }: {
  value: string
  rows?: number
  ariaLabel: string
  onChange: (next: string) => void
  alignments?: string
  onAlignChange?: (next: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const insertAtCaret = (snippet: string, selectAfter = snippet.length) => {
    const start = ref.current?.selectionStart ?? value.length
    const end = ref.current?.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      const caret = start + selectAfter
      el.setSelectionRange(caret, caret)
    })
  }
  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || placeholder
    const snippet = `${before}${selected}${after}`
    onChange(`${value.slice(0, start)}${snippet}${value.slice(end)}`)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start, start + snippet.length)
    })
  }
  const blockForSelection = (tag: 'p' | 'h2' | 'h3') => {
    const map: Record<string, { before: string; after: string; ph: string }> = {
      p: { before: '', after: '', ph: '' },
      h2: { before: '<h2>', after: '</h2>', ph: 'Heading' },
      h3: { before: '<h3>', after: '</h3>', ph: 'Subheading' },
    }
    const cfg = map[tag]
    if (!cfg || tag === 'p') return
    wrapSelection(cfg.before, cfg.after, cfg.ph)
  }
  const insertLink = () => {
    const url = window.prompt('Enter link URL', 'https://')
    if (!url) return
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const selected = value.slice(start, end) || 'link text'
    wrapSelection(`<a href="${url}">`, '</a>', selected)
  }
  const applyFontSize = (size: string) => wrapSelection(`<span style="font-size:${size}">`, '</span>', 'sized text')
  const applyAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const raw = String(value ?? '')
    const lines = raw.split('\n')
    const startLine = raw.slice(0, start).split('\n').length - 1
    const endLine = raw.slice(0, Math.max(start, end)).split('\n').length - 1
    const wrapLine = (line: string, a: string) => {
      const m = line.match(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i)
      if (m) return `<div style="text-align:${a}">${m[2]}</div>`
      if (!String(line ?? '').trim()) return `<div style="text-align:${a}"></div>`
      return `<div style="text-align:${a}">${line}</div>`
    }
    let nextLines = lines.slice()
    for (let i = startLine; i <= endLine; i++) nextLines[i] = wrapLine(nextLines[i] ?? '', align)
    onChange(nextLines.join('\n'))
    if (onAlignChange) {
      let arr: string[] = []
      try { const parsed = JSON.parse(String(alignments ?? '[]')); arr = Array.isArray(parsed) ? parsed.slice() : [] } catch { arr = [] }
      const need = Math.max(nextLines.length, endLine + 1)
      while (arr.length < need) arr.push('left')
      for (let i = startLine; i <= endLine; i++) arr[i] = align
      onAlignChange(JSON.stringify(arr))
    }
    requestAnimationFrame(() => { if (!el) return; el.focus(); const pos = nextLines.slice(0, endLine + 1).join('\n').length; el.setSelectionRange(pos, pos) })
  }
  const applyColor = (color: string) => wrapSelection(`<span style="color:${color}">`, '</span>', 'colored text')
  const insert = (token: string) => insertAtCaret(`{${token}}`)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white focus-within:border-lime/40 focus-within:ring-2 focus-within:ring-lime/20 dark:bg-zinc-900">
      <FormatToolbar onWrap={wrapSelection} onBlock={blockForSelection} onLink={insertLink} onFontSize={applyFontSize} onAlign={applyAlign} onColor={applyColor} />
      <Textarea
        ref={ref}
        rows={rows}
        value={value}
        aria-label={ariaLabel}
        placeholder="Type static text, or click a placeholder below to insert it"
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[110px] rounded-none border-0 !bg-transparent px-3 py-2.5 text-sm leading-relaxed shadow-none focus:ring-0 focus-visible:ring-0"
      />
      <div className="flex flex-wrap gap-1.5 border-t border-line bg-zinc-50/60 px-2 py-2 dark:bg-white/[0.03]">
        {RESULT_TEMPLATE_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insert(token)}
            title={`Insert {${token}}`}
            className="rounded-full border border-line bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-mist shadow-sm transition hover:border-lime hover:text-zinc-900 dark:bg-zinc-800 dark:hover:text-white"
          >
            {`{${token}}`}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Image file field (reuses the file input pattern)
// ---------------------------------------------------------------------------

function ImageFileField({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result || ''))
    reader.readAsDataURL(file)
  }
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {value && value.startsWith('data:') ? (
          <img src={value} alt={label} className="h-16 w-16 rounded-lg border border-line object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-xs text-mist">
            No image
          </div>
        )}
        <label className="cursor-pointer rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs font-medium text-mist transition hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]">
          Choose File
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-red-500 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
    </Field>
  )
}

// ---------------------------------------------------------------------------
// Live A4 preview sheet
// ---------------------------------------------------------------------------

function ResultsTemplatePreview({
  templateName, pageLayout, backgroundImage, schoolName, photoStyle,
  topSpace, bottomSpace, rightSpace, leftSpace,
  headerContent, middleContent, footerContent, reportOptions, examName,
  logoImage, leftSignature, middleSignature, rightSignature,
  reportsheetTheme, templateType,
}: {
  templateName: string
  pageLayout: string
  backgroundImage: string
  schoolName: string
  photoStyle?: string
  topSpace?: string
  bottomSpace?: string
  rightSpace?: string
  leftSpace?: string
  headerContent?: string
  middleContent?: string
  footerContent?: string
  reportOptions?: string
  examName?: string
  logoImage?: string
  leftSignature?: string
  middleSignature?: string
  rightSignature?: string
  reportsheetTheme?: string
  templateType?: string
}) {
  const isCGPA = String(templateType ?? '').trim().toLocaleLowerCase() === 'cgpa'
  const [showSampleData, setShowSampleData] = useState(true)
  const landscape = String(pageLayout ?? '').trim().toLocaleLowerCase() === 'landscape'
  const designW = landscape ? 842 : 595
  const designH = landscape ? 595 : 842
  const printScale = Math.min(
    (landscape ? 1122.52 : 793.7) / designW,
    (landscape ? 793.7 : 1122.52) / designH,
  )
  const [zoom, setZoom] = useState(1)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelW, setPanelW] = useState(760)
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setPanelW(Math.max(entry.contentRect.width, 260))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fitScale = Math.min((panelW - 48) / designW, 560 / designH, 1.15)
  const scale = Math.max(fitScale * zoom, 0.3)
  const setZoomClamped = (next: number) => setZoom(Math.min(2, Math.max(0.5, next)))

  const printSheet = () => {
    const previous = document.title
    const name = String(templateName ?? '').trim() || 'Results Template'
    document.title = `${name} — Results`
    const restore = () => {
      document.title = previous
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  const bg = String(backgroundImage ?? '').trim()
  const margin = (raw: unknown, fallback: number) => {
    const n = Number(String(raw ?? '').trim())
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 90) : fallback
  }
  const pad = {
    top: margin(topSpace, 28), bottom: margin(bottomSpace, 28),
    right: margin(rightSpace, 28), left: margin(leftSpace, 28),
  }

  const picked = multiSelectValues(reportOptions).map((v) => String(v).trim().toLocaleLowerCase())
  const has = (name: string) => picked.includes(name.toLocaleLowerCase())

  const photo = /^(square|round)\s*-\s*(\d+)$/i.exec(String(photoStyle ?? '').trim())
  const photoShape = (photo?.[1] ?? '').toLocaleLowerCase()
  const photoPx = photo ? Math.max(18, Math.round(Number(photo[2]) / 8)) : 0

  const boxImage: Record<string, string> = {
    logo: String(logoImage ?? ''),
    left_signature: String(leftSignature ?? ''),
    middle_signature: String(middleSignature ?? ''),
    right_signature: String(rightSignature ?? ''),
  }
  const samples: Record<string, string> = {
    ...TOKEN_SAMPLES,
    institute_name: String(schoolName ?? '').trim() || 'School',
    ...(String(examName ?? '').trim() ? { exam_name: String(examName).trim() } : {}),
  }

  const resolveLineText = (text: string) =>
    text.replace(/\{([a-z_]+)\}/gi, (whole, t) => samples[String(t).toLocaleLowerCase()] ?? whole)

  const stripAlignWrapper = (s: string) => String(s ?? '').replace(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(?:left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i, '$1')
  const hasInlineHtml = (s: string) => /<(b|i|u|s|a|span|div|h2|h3|strong|em)\b/i.test(s)

  const renderBoxToken = (token: string, key: string) => {
    if (token === 'student_photo') {
      if (!photoShape) return null
      return <div key={key} style={{ width: photoPx, height: photoPx, background: '#e7e7e0', borderRadius: photoShape === 'round' ? '50%' : 3, border: '1px solid #cfcfc6' }} />
    }
    const src = boxImage[token] ?? ''
    const h = token === 'logo' ? 34 : 24
    return src.startsWith('data:')
      ? <img key={key} src={src} alt={token} style={{ height: h, objectFit: 'contain' }} />
      : <div key={key} style={{ height: h, minWidth: token === 'logo' ? 46 : 62, display: 'inline-block', border: '1px dashed #c9c9c0', borderRadius: 3, fontSize: 7, color: '#9ca3af', textAlign: 'center', lineHeight: `${h}px` }}>{token.replace(/_/g, ' ')}</div>
  }

  const textLine = (text: string, key: string, align: 'left' | 'center' | 'right' | 'justify' = 'left') => {
    let html = resolveLineText(text).replace(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(?:left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i, '$1')
    const hasHtml = /<(b|i|u|s|a|span|div|h2|h3|strong|em)\b/i.test(html)
    return hasHtml
      ? <div key={key} style={{ fontSize: 11, minHeight: 14, color: '#16325c', textAlign: align }} dangerouslySetInnerHTML={{ __html: html || ' ' }} />
      : <div key={key} style={{ fontSize: 11, minHeight: 14, color: '#16325c', textAlign: align }}>{html || ' '}</div>
  }

  // Get the active theme for coloring — findReportsheetTheme handles both ID and name
  const theme = findReportsheetTheme(reportsheetTheme)
  const borderColor = theme.accentColor
  const headerBg = `${theme.accentColor}15`

  // Build sample subject rows for the results table
  const subjects = [
    { name: 'English Language', ca: 26, exam: 62, total: 88 },
    { name: 'Mathematics', ca: 27, exam: 65, total: 92 },
    { name: 'Integrated Science', ca: 24, exam: 58, total: 82 },
    { name: 'Social Studies', ca: 25, exam: 55, total: 80 },
    { name: 'Ghanaian Language', ca: 26, exam: 60, total: 86 },
    { name: 'Computing', ca: 25, exam: 58, total: 83 },
    { name: 'Creative Arts', ca: 23, exam: 52, total: 75 },
    { name: 'RME', ca: 27, exam: 61, total: 88 },
  ]
  const classAvg = Math.round(subjects.reduce((s, r) => s + r.total, 0) / subjects.length)

  // CGPA helpers — CGPA templates show grade points instead of raw grades
  const GRADE_POINTS: Record<string, number> = { '1': 8, '2': 7, '3': 6, '4': 5, '5': 4 }
  const gradeOf = (total: number) => total >= 80 ? '1' : total >= 70 ? '2' : total >= 60 ? '3' : total >= 50 ? '4' : '5'
  const cgpa = isCGPA
    ? Number((subjects.reduce((s, r) => s + (GRADE_POINTS[gradeOf(r.total)] ?? 0), 0) / subjects.length).toFixed(2))
    : 0

  // Compute column widths for the preview table — SUBJECT and REMARK get more
  // space, numeric columns get less. Normalised to 100%.
  const _showPos = has('subject position')
  const _showGrade = isCGPA || has('grade')
  const _showRemark = has('remark')
  const _baseWidths = [24, 10, 10, 10]
  if (_showPos) _baseWidths.push(10)
  if (_showGrade) _baseWidths.push(10)
  if (_showRemark) _baseWidths.push(18)
  const _totalW = _baseWidths.reduce((s, w) => s + w, 0)
  const _colPcts = _baseWidths.map((w) => `${(w / _totalW * 100).toFixed(2)}%`)

  return (
    <div ref={panelRef} className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-mist">Live Preview</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSampleData((v) => !v)}
            className={`rounded-lg border px-2 py-0.5 text-xs transition ${showSampleData ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-line text-mist'}`}
            title="Toggle sample data"
          >
            Sample Data: {showSampleData ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoomClamped(zoom - 0.1)} className="rounded border border-line px-2 py-0.5 text-xs">−</button>
          <span className="text-xs text-mist">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoomClamped(zoom + 0.1)} className="rounded border border-line px-2 py-0.5 text-xs">+</button>
          <button type="button" onClick={printSheet} className="ml-2 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-emerald-500 dark:text-slate-950">
            <Printer className="size-3.5" />
            Print
          </button>
        </div>
      </div>
      <div style={{ width: designW * scale, minHeight: designH * scale, margin: '0 auto', overflow: 'hidden', borderRadius: 4 }}>
        <div
          style={{
            backgroundColor: bg.startsWith('data:') ? `url(${bg}) center/cover no-repeat` : '#ffffff',
            width: designW,
            minHeight: designH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div
            style={{
              width: designW,
              minHeight: designH,
              backgroundColor: '#ffffff',
              padding: `${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px`,
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
          {/* Header */}
          {headerContent && String(headerContent).trim() && (
            <div style={{ marginBottom: 8 }}>
              {String(headerContent).split('\n').filter((l) => l.trim()).map((line, i) => {
                const m = line.match(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i)
                const align = (m?.[1] as 'left' | 'center' | 'right' | 'justify') || 'left'
                const content = m?.[2] ?? line
                // Check for box tokens
                if (BOX_TOKENS.some((bt) => content.includes(`{${bt}}`))) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {content.split(/(\{[a-z_]+\})/g).map((part, j) => {
                        if (BOX_TOKENS.includes(part.replace(/[{}]/g, ''))) {
                          return renderBoxToken(part.replace(/[{}]/g, ''), `h${i}-${j}`)
                        }
                        return <span key={j} dangerouslySetInnerHTML={{ __html: resolveLineText(part) }} />
                      })}
                    </div>
                  )
                }
                return textLine(line, `h${i}`, align)
              })}
            </div>
          )}

          {/* Results Table */}
          <div style={{ marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, color: '#16325c', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: _colPcts[0] }} />
                <col style={{ width: _colPcts[1] }} />
                <col style={{ width: _colPcts[2] }} />
                <col style={{ width: _colPcts[3] }} />
                {_showPos && <col style={{ width: _colPcts[4] }} />}
                {_showGrade && <col style={{ width: _colPcts[_showPos ? 5 : 4] }} />}
                {_showRemark && <col style={{ width: _colPcts[4 + (_showPos ? 1 : 0) + (_showGrade ? 1 : 0)] }} />}
              </colgroup>
              <thead>
                <tr>
                  <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'left', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>SUBJECT</th>
                  <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'center', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>CLASS SCORE</th>
                  <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'center', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>EXAM</th>
                  <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'center', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>TOTAL</th>
                  {has('subject position') && <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'center', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>POSITION</th>}
                  {(isCGPA || has('grade')) && <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'center', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{isCGPA ? 'GRADE' : 'GRADE'}</th>}
                  {has('remark') && <th style={{ border: `1px solid ${borderColor}`, padding: '4px 6px', textAlign: 'left', backgroundColor: headerBg, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>REMARK</th>}
                </tr>
              </thead>
              <tbody>
                {showSampleData && subjects.map((s, idx) => {
                  const g = gradeOf(s.total)
                  const remark = s.total >= 80 ? 'Excellent' : s.total >= 70 ? 'Very Good' : s.total >= 60 ? 'Good' : s.total >= 50 ? 'Credit' : 'Pass'
                  const _zebra = idx % 2 === 1 ? 'rgba(15,23,42,0.04)' : 'transparent'
                  return (
                    <tr key={s.name} style={{ backgroundColor: _zebra }}>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px' }}>{s.name}</td>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>{s.ca}</td>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>{s.exam}</td>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', fontWeight: 700 }}>{s.total}</td>
                      {has('subject position') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>{['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][subjects.indexOf(s)]}</td>}
                      {(isCGPA || has('grade')) && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', fontWeight: isCGPA ? 700 : 400 }}>{isCGPA ? (GRADE_POINTS[g] ?? 4).toFixed(1) : g}</td>}
                      {has('remark') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'left' }}>{remark}</td>}
                    </tr>
                  )
                })}
                {showSampleData && (
                  <tr style={{ fontWeight: 700, backgroundColor: headerBg }}>
                    <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px' }} colSpan={3}>CLASS AVERAGE</td>
                    <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', fontWeight: 700 }}>{classAvg}</td>
                    {has('subject position') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>—</td>}
                    {(isCGPA || has('grade')) && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>{isCGPA ? cgpa.toFixed(1) : '—'}</td>}
                    {has('remark') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center' }}>—</td>}
                  </tr>
                )}
                {isCGPA && showSampleData && (
                  <tr style={{ fontWeight: 700 }}>
                    <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', backgroundColor: headerBg }} colSpan={3}>CGPA</td>
                    <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', backgroundColor: headerBg }}>—</td>
                    {has('subject position') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', backgroundColor: headerBg }}>—</td>}
                    <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', fontWeight: 700, backgroundColor: headerBg }}>{cgpa.toFixed(2)}</td>
                    {has('remark') && <td style={{ border: `1px solid ${borderColor}`, padding: '3px 6px', textAlign: 'center', backgroundColor: headerBg }}>—</td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Middle section */}
          {middleContent && String(middleContent).trim() && (
            <div style={{ marginBottom: 8 }}>
              {String(middleContent).split('\n').filter((l) => l.trim()).map((line, i) => {
                const m = line.match(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i)
                const align = (m?.[1] as 'left' | 'center' | 'right' | 'justify') || 'left'
                return textLine(line, `m${i}`, align)
              })}
            </div>
          )}

          {/* Additional stats row */}
          {has('cumulative average') || has('class average') || has('position') || has('grading scale') || has('attendance percentage') ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8, fontSize: 9 }}>
              {has('position') && (
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Position</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16325c' }}>3rd</div>
                </div>
              )}
              {has('cumulative average') && (
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Cumulative Avg</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16325c' }}>84.5</div>
                </div>
              )}
              {has('class average') && (
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Class Avg</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16325c' }}>{classAvg}</div>
                </div>
              )}
              {has('attendance percentage') && (
                <div>
                  <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280' }}>Attendance</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16325c' }}>95%</div>
                </div>
              )}
            </div>
          ) : null}

          {/* Grading scale */}
          {has('grading scale') && (
            <div style={{ marginBottom: 8, fontSize: 8 }}>
              <div style={{ fontWeight: 700, color: '#6b7280', marginBottom: 3, fontSize: 9 }}>GRADING SCALE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#16325c' }}>
                <tbody>
                  {[['1', '80-100', 'Excellent'], ['2', '70-79', 'Very Good'], ['3', '60-69', 'Good'], ['4', '50-59', 'Credit'], ['5', '0-49', 'Pass']].map(([g, r, d]) => (
                    <tr key={g}>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '2px 4px', textAlign: 'center', fontWeight: 700, color: '#16325c' }}>{g}</td>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '2px 4px', textAlign: 'center', color: '#16325c' }}>{r}</td>
                      <td style={{ border: `1px solid ${borderColor}`, padding: '2px 4px', color: '#16325c' }}>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {footerContent && String(footerContent).trim() && (
            <div style={{ marginTop: 8 }}>
              {String(footerContent).split('\n').filter((l) => l.trim()).map((line, i) => {
                const m = line.match(/^<div[^>]*style\s*=\s*["'][^"']*text-align\s*:\s*(left|center|right|justify)[^"']*["'][^>]*>([\s\S]*)<\/div>$/i)
                const align = (m?.[1] as 'left' | 'center' | 'right' | 'justify') || 'left'
                if (BOX_TOKENS.some((bt) => line.includes(`{${bt}}`))) {
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {line.split(/(\{[a-z_]+\})/g).map((part, j) => {
                        if (BOX_TOKENS.includes(part.replace(/[{}]/g, ''))) {
                          return renderBoxToken(part.replace(/[{}]/g, ''), `f${i}-${j}`)
                        }
                        return <span key={j} dangerouslySetInnerHTML={{ __html: resolveLineText(part) }} />
                      })}
                    </div>
                  )
                }
                return textLine(line, `f${i}`, align)
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ResultsTemplatePage
// ---------------------------------------------------------------------------

export function ResultsTemplatePage() {
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches } = useApp()

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  )
  const schoolName = activeBranch?.name?.trim() || 'Airport City Flagship'

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
  }, [activeBranchId, activeBranch?.name])

  const activeTheme = useMemo(() => getActiveReportsheetTheme(records), [records])
  const templates = useMemo(() => (records.resultsTemplate ?? []) as EduRow[], [records])

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [deleting, setDeleting] = useState<EduRow | null>(null)

  const filteredTemplates = useMemo(() => {
    if (!q.trim()) return templates
    const ql = q.toLowerCase()
    return templates.filter((r) =>
      String(r.templateName ?? '').toLowerCase().includes(ql) ||
      String(r.examName ?? '').toLowerCase().includes(ql) ||
      String(r.className ?? '').toLowerCase().includes(ql),
    )
  }, [templates, q])

  // Get available exams for the select
  const availableExams = useMemo(() => {
    const exams = (records.examSetup ?? []) as EduRow[]
    return exams.map((e) => ({ name: String(e.examName ?? '').trim(), id: String(e.id ?? '') }))
  }, [records])

  // Get available classes
  const availableClasses = useMemo(() => {
    const classes = (records.classList ?? []) as EduRow[]
    return classes.map((c) => ({ name: String(c.name ?? '').trim(), id: String(c.id ?? '') }))
  }, [records])

  const openNew = () => {
    setEditing({
      id: uid(),
      branch: activeBranch?.name ?? '',
      templateName: '',
      templateType: 'Standard',
      startFrom: 'Blank canvas',
      examName: availableExams[0]?.name ?? '',
      className: availableClasses[0]?.name ?? '',
      reportsheetTheme: activeTheme.name,
      pageLayout: 'Portrait',
      photoStyle: 'Square - 320',
      topSpace: '28',
      bottomSpace: '28',
      rightSpace: '28',
      leftSpace: '28',
      leftSignature: '',
      middleSignature: '',
      rightSignature: '',
      logoImage: '',
      backgroundImage: '',
      headerContent: `<div style="text-align:center">{institute_name}</div><div style="text-align:center">{motto}</div><div style="text-align:center">{exam_name} — {class}</div>`,
      middleContent: '',
      footerContent: `<div style="text-align:left">{left_signature}</div><div style="text-align:center">{middle_signature}</div><div style="text-align:right">{right_signature}</div>`,
      reportOptions: JSON.stringify(['Position', 'Cumulative Average', 'Class Average', 'Grading Scale', 'Remark']),
      createdAt: new Date().toISOString().slice(0, 10),
    })
  }

  const openEdit = (row: EduRow) => {
    setEditing({ ...row, reportsheetTheme: String(row.reportsheetTheme || activeTheme.name) })
  }

  const updateField = (key: string, value: string) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = () => {
    if (!editing) return
    if (!String(editing.templateName ?? '').trim()) {
      toast.error('Template name is required')
      return
    }
    if (!String(editing.headerContent ?? '').trim()) {
      toast.error('Header content is required')
      return
    }
    if (!String(editing.footerContent ?? '').trim()) {
      toast.error('Footer content is required')
      return
    }

    const idx = templates.findIndex((r) => String(r.id) === String(editing.id))
    const nextTemplates = [...templates]
    if (idx >= 0) {
      nextTemplates[idx] = { ...editing }
    } else {
      nextTemplates.unshift({ ...editing })
    }
    const nextRecords = { ...records, resultsTemplate: nextTemplates }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Results template saved', `${editing.templateName} has been saved.`)
    setEditing(null)
  }

  const handleDelete = () => {
    if (!deleting) return
    const nextTemplates = templates.filter((r) => String(r.id) !== String(deleting.id))
    const nextRecords = { ...records, resultsTemplate: nextTemplates }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Template deleted', `${deleting.templateName} has been removed.`)
    setDeleting(null)
  }

  const handleSetDefault = (row: EduRow) => {
    const nextTemplates = templates.map((r) => ({ ...r, isDefault: String(r.id) === String(row.id) ? 'true' : 'false' }))
    const nextRecords = { ...records, resultsTemplate: nextTemplates }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Default template set', `${row.templateName} is now the default.`)
  }

  const handleDuplicate = (row: EduRow) => {
    const copy: EduRow = {
      ...row,
      id: uid(),
      templateName: `${String(row.templateName ?? '')} (Copy)`,
      isDefault: 'false',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const nextTemplates = [copy, ...templates]
    const nextRecords = { ...records, resultsTemplate: nextTemplates }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Template duplicated', `${copy.templateName} has been created.`)
  }

  const handleTogglePublic = (row: EduRow) => {
    const isPublic = String(row.isPublic ?? '') === 'true'
    const nextTemplates = templates.map((r) => ({ ...r, isPublic: String(r.id) === String(row.id) ? (isPublic ? 'false' : 'true') : String(r.isPublic ?? 'false') }))
    const nextRecords = { ...records, resultsTemplate: nextTemplates }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success(isPublic ? 'Template made private' : 'Template made public', `${row.templateName} is now ${isPublic ? 'private' : 'public'}.`)
  }

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
        <span className="font-semibold text-inherit">{t('nav.eduResultsTemplate')}</span>
      </div>

      <PageHeader
        title={t('nav.eduResultsTemplate')}
        desc={`${schoolName} — Create and manage result card templates`}
      />

      {/* Active Theme Banner */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-slate-50/90 px-5 py-3 dark:bg-white/[0.03]">
        <Palette className="size-4 text-mist" />
        <div>
          <div className="text-xs font-bold tracking-wider text-mist uppercase">Active Reportsheet Theme</div>
          <div className="text-sm font-bold">{activeTheme.name}</div>
        </div>
      </div>

      {/* Template list */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search templates…" className="max-w-xs" />
        <Button variant="primary" onClick={openNew}>
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {filteredTemplates.length === 0 ? (
        <Empty
          title="No Results Templates"
          desc="Create your first results template to start generating report cards."
          action={<Button variant="primary" onClick={openNew}><Plus className="size-4" />New Template</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-4 py-3">Template Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Layout</th>
                <th className="px-4 py-3">Theme</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((row) => {
                const isDefault = String(row.isDefault ?? '') === 'true'
                const isPublic = String(row.isPublic ?? '') === 'true'
                const isCGPA = String(row.templateType ?? '').toLocaleLowerCase() === 'cgpa'
                return (
                <tr key={String(row.id)} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{String(row.templateName ?? '')}</span>
                      {isDefault && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                      {isPublic && <Globe className="size-3.5 text-sky-500" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${isCGPA ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-slate-50 text-slate-600 dark:bg-white/[0.04] dark:text-zinc-300'}`}>
                      {String(row.templateType ?? 'Standard')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist">{String(row.examName ?? '')}</td>
                  <td className="px-4 py-3 text-mist">{String(row.className ?? '')}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs dark:bg-white/[0.04]">
                      {String(row.pageLayout ?? 'Portrait')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist">{String(row.reportsheetTheme ?? 'Theme 1')}</td>
                  <td className="px-4 py-3 text-mist">{String(row.createdAt ?? '')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => handleSetDefault(row)} title="Set as default" className={`rounded-lg p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10 ${isDefault ? 'text-amber-400' : 'text-mist hover:text-zinc-900 dark:hover:text-white'}`}>
                        <Star className={`size-3.5 ${isDefault ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button type="button" onClick={() => handleDuplicate(row)} title="Duplicate" className="rounded-lg p-1.5 text-mist transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white">
                        <Copy className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => handleTogglePublic(row)} title={isPublic ? 'Make private' : 'Make public'} className={`rounded-lg p-1.5 transition hover:bg-black/5 dark:hover:bg-white/10 ${isPublic ? 'text-sky-500' : 'text-mist hover:text-zinc-900 dark:hover:text-white'}`}>
                        <Globe className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-mist transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white" title="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-mist transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Modal */}
      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '20px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900"
            style={{
              borderRadius: 12,
              maxWidth: '100%',
              width: 'min(1180px, 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 40px)',
            }}
          >
            {/* Header */}
            <div className="dark:border-zinc-700" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText className="size-4 text-indigo-600" />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {templates.find((r) => String(r.id) === String(editing.id)) ? 'Edit Results Template' : 'New Results Template'}
                </span>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="dark:text-zinc-400" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
                <X className="size-4" />
              </button>
            </div>

            {/* Body: form + preview */}
            <div style={{ display: 'flex', gap: 0, overflow: 'hidden', flex: 1 }}>
              {/* Form */}
              <div className="dark:border-zinc-700" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', maxWidth: 520, borderRight: '1px solid #e2e8f0' }}>
                <div className="space-y-4">
                  <Field label="Template Name" required>
                    <Input
                      value={String(editing.templateName ?? '')}
                      onChange={(e) => updateField('templateName', e.target.value)}
                      placeholder="e.g. Basic 7 Report Card"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Template Type" required hint="Standard grades or CGPA grade points">
                      <Select
                        value={String(editing.templateType ?? 'Standard')}
                        onChange={(e) => updateField('templateType', e.target.value)}
                      >
                        <option value="Standard">Standard</option>
                        <option value="CGPA">CGPA</option>
                      </Select>
                    </Field>
                    <Field label="Start From" required hint="Blank canvas or a pre-built arithmetic template">
                      <Select
                        value={String(editing.startFrom ?? 'Blank canvas')}
                        onChange={(e) => updateField('startFrom', e.target.value)}
                      >
                        <option value="Blank canvas">Blank canvas</option>
                        <option value="Arithmetic template">Arithmetic template</option>
                      </Select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Exam">
                      <Select
                        value={String(editing.examName ?? '')}
                        onChange={(e) => updateField('examName', e.target.value)}
                      >
                        {availableExams.map((ex) => (
                          <option key={ex.id} value={ex.name}>{ex.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Class">
                      <Select
                        value={String(editing.className ?? '')}
                        onChange={(e) => updateField('className', e.target.value)}
                      >
                        {availableClasses.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Reportsheet Theme">
                      <Select
                        value={String(editing.reportsheetTheme ?? 'Theme 1')}
                        onChange={(e) => updateField('reportsheetTheme', e.target.value)}
                      >
                        {REPORTSHEET_THEMES.map((th) => (
                          <option key={th.id} value={th.name}>{th.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Page Layout" required>
                      <Select
                        value={String(editing.pageLayout ?? 'Portrait')}
                        onChange={(e) => updateField('pageLayout', e.target.value)}
                      >
                        <option value="Portrait">Portrait</option>
                        <option value="Landscape">Landscape</option>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Photo Style" required>
                    <Select
                      value={String(editing.photoStyle ?? 'Square - 320')}
                      onChange={(e) => updateField('photoStyle', e.target.value)}
                    >
                      <option value="Square - 320">Square - 320</option>
                      <option value="Square - 240">Square - 240</option>
                      <option value="Round - 320">Round - 320</option>
                      <option value="Round - 240">Round - 240</option>
                    </Select>
                  </Field>

                  <div className="grid grid-cols-4 gap-3">
                    <Field label="Top (px)">
                      <Input type="number" value={String(editing.topSpace ?? '')} onChange={(e) => updateField('topSpace', e.target.value)} />
                    </Field>
                    <Field label="Bottom (px)">
                      <Input type="number" value={String(editing.bottomSpace ?? '')} onChange={(e) => updateField('bottomSpace', e.target.value)} />
                    </Field>
                    <Field label="Right (px)">
                      <Input type="number" value={String(editing.rightSpace ?? '')} onChange={(e) => updateField('rightSpace', e.target.value)} />
                    </Field>
                    <Field label="Left (px)">
                      <Input type="number" value={String(editing.leftSpace ?? '')} onChange={(e) => updateField('leftSpace', e.target.value)} />
                    </Field>
                  </div>

                  <Field label="Logo Image">
                    <ImageFileField label="Logo" value={String(editing.logoImage ?? '')} onChange={(v) => updateField('logoImage', v)} />
                  </Field>

                  <Field label="Background Image">
                    <ImageFileField label="Background" value={String(editing.backgroundImage ?? '')} onChange={(v) => updateField('backgroundImage', v)} />
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Left Signature">
                      <ImageFileField label="Left" value={String(editing.leftSignature ?? '')} onChange={(v) => updateField('leftSignature', v)} />
                    </Field>
                    <Field label="Middle Signature">
                      <ImageFileField label="Middle" value={String(editing.middleSignature ?? '')} onChange={(v) => updateField('middleSignature', v)} />
                    </Field>
                    <Field label="Right Signature">
                      <ImageFileField label="Right" value={String(editing.rightSignature ?? '')} onChange={(v) => updateField('rightSignature', v)} />
                    </Field>
                  </div>

                  <Field label="Header Content" required hint="Use {tokens} to insert dynamic values">
                    <ContentFieldWithTokens
                      value={String(editing.headerContent ?? '')}
                      rows={3}
                      ariaLabel="Header Content"
                      onChange={(v) => updateField('headerContent', v)}
                    />
                  </Field>

                  <Field label="Middle Content" hint="Optional section between header and results table">
                    <ContentFieldWithTokens
                      value={String(editing.middleContent ?? '')}
                      rows={3}
                      ariaLabel="Middle Content"
                      onChange={(v) => updateField('middleContent', v)}
                    />
                  </Field>

                  <Field label="Footer Content" required hint="Use {tokens} for signatures and dates">
                    <ContentFieldWithTokens
                      value={String(editing.footerContent ?? '')}
                      rows={3}
                      ariaLabel="Footer Content"
                      onChange={(v) => updateField('footerContent', v)}
                    />
                  </Field>

                  <Field label="Report Options" hint="Select which sections to include">
                    <div className="flex flex-wrap gap-2">
                      {['Attendance Percentage', 'Grading Scale', 'Position', 'Cumulative Average', 'Class Average', 'Subject Position', 'Remark', 'Result'].map((opt) => {
                        const checked = multiSelectValues(editing.reportOptions).includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const current = multiSelectValues(editing.reportOptions)
                              const next = checked ? current.filter((v) => v !== opt) : [...current, opt]
                              updateField('reportOptions', JSON.stringify(next))
                            }}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                              checked
                                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                : 'border-line text-mist hover:border-indigo-400/60'
                            }`}
                          >
                            {checked && <Check className="size-3 inline mr-1" />}
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 dark:bg-zinc-800" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <ResultsTemplatePreview
                  templateName={String(editing.templateName ?? '')}
                  pageLayout={String(editing.pageLayout ?? 'Portrait')}
                  backgroundImage={String(editing.backgroundImage ?? '')}
                  schoolName={schoolName}
                  photoStyle={String(editing.photoStyle ?? '')}
                  topSpace={String(editing.topSpace ?? '')}
                  bottomSpace={String(editing.bottomSpace ?? '')}
                  rightSpace={String(editing.rightSpace ?? '')}
                  leftSpace={String(editing.leftSpace ?? '')}
                  headerContent={String(editing.headerContent ?? '')}
                  middleContent={String(editing.middleContent ?? '')}
                  footerContent={String(editing.footerContent ?? '')}
                  reportOptions={String(editing.reportOptions ?? '')}
                  examName={String(editing.examName ?? '')}
                  logoImage={String(editing.logoImage ?? '')}
                  leftSignature={String(editing.leftSignature ?? '')}
                  middleSignature={String(editing.middleSignature ?? '')}
                  rightSignature={String(editing.rightSignature ?? '')}
                  reportsheetTheme={String(editing.reportsheetTheme ?? 'Theme 1')}
                  templateType={String(editing.templateType ?? 'Standard')}
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="dark:border-zinc-700" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}>
                <Check className="size-4" />
                {templates.find((r) => String(r.id) === String(editing.id)) ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div
          onClick={() => setDeleting(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
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
              maxWidth: 400,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Trash2 className="size-5 text-red-500" />
              <span style={{ fontSize: 16, fontWeight: 700 }}>Delete Template</span>
            </div>
            <p className="dark:text-zinc-400" style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Are you sure you want to delete <strong>{String(deleting.templateName ?? '')}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

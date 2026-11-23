import type { EduRecords, EduRow } from './eduRecords'
import { isCollectionMarkedCleared } from './dataReset'
import { deleteReportsheetThemeFromRecords, getAllReportsheetThemes, publishReportsheetThemeToRecords } from './reportsheetThemes'

/** Balance the complete Theme 7 design as a group, preserving relative placement. */
function balanceThemeSeven(records: EduRecords): EduRecords {
  const marker = 'theme-7-equal-a4-margins-v2'
  if ((records.reportThemeSampleMigrations ?? []).some(r => r.id === marker)) return records
  const theme = (records.reportsheetTheme ?? []).find(r => String(r.themeId ?? '').trim().toLowerCase() === 'theme-7')
  if (!theme) return records
  let elements: Array<Record<string, any>>
  try { const parsed = JSON.parse(String(theme.canvasElementsJson ?? '[]')); if (!Array.isArray(parsed)) return records; elements = parsed } catch { return records }
  const positioned = elements.filter(el => !el.hidden && String(el.id ?? '').startsWith('id_') && Number.isFinite(Number(el.x)) && Number.isFinite(Number(el.width)) && Number(el.width) > 0)
  if (!positioned.length) return records
  const left = Math.min(...positioned.map(el => Number(el.x)))
  const right = Math.max(...positioned.map(el => Number(el.x) + Number(el.width)))
  const width = right - left
  if (!(width > 0)) return records
  const scale = Math.min(1, 520 / width)
  const origin = (560 - width * scale) / 2
  const oldJson = String(theme.canvasElementsJson ?? '')
  const updatedJson = JSON.stringify(elements.map(el => {
    if (!String(el.id ?? '').startsWith('id_') || !Number.isFinite(Number(el.x)) || !Number.isFinite(Number(el.width))) return el
    return { ...el, x: Math.round((origin + (Number(el.x) - left) * scale) * 100) / 100, width: Math.round(Number(el.width) * scale * 100) / 100 }
  }))
  return { ...records,
    reportsheetTheme: (records.reportsheetTheme ?? []).map(r => r.id === theme.id ? { ...r, canvasElementsJson: updatedJson } : r),
    reportBuilder: (records.reportBuilder ?? []).map(r => String(r.publishedThemeId ?? '').toLowerCase() === 'theme-7' && r.canvasElementsJson === oldJson ? { ...r, canvasElementsJson: updatedJson } : r),
    reportThemeSampleMigrations: [...(records.reportThemeSampleMigrations ?? []), { id: marker }],
  }
}

/** Remove only the generated Theme 8, retaining user-created themes and reports. */
export function removeDefaultThemeEight(records: EduRecords): EduRecords {
  const theme = (records.reportsheetTheme ?? []).find(r => String(r.themeId ?? '').trim().toLowerCase() === 'theme-8' && (r.sampleKey === 'published-report-sample-v1' || r.sampleKey === 'semester-result-pdf-v1'))
  if (!theme) return records
  const result = deleteReportsheetThemeFromRecords(records, 'theme-8')
  if (!result.deleted) return records
  return { ...result.nextRecords, reportBuilder: (result.nextRecords.reportBuilder ?? []).filter(r => !(r.id === 'sample-report-v2-published' && String(r.reportsheetThemeId ?? '').toLowerCase() === 'theme-8')) }
}

/** Center the semester slip's principal blocks on the 560-unit A4 design canvas. */
function equalizeSemesterMargins(records: EduRecords): EduRecords {
  if ((records.reportThemeSampleMigrations ?? []).some(r => r.id === 'semester-result-equal-margins-v1')) return records
  const theme = (records.reportsheetTheme ?? []).find(r => r.sampleKey === 'semester-result-pdf-v1')
  if (!theme) return records
  let elements: Array<Record<string, any>>
  try { const parsed = JSON.parse(String(theme.canvasElementsJson ?? '[]')); if (!Array.isArray(parsed)) return records; elements = parsed } catch { return records }
  // Only adjust seed positions, leaving intentionally repositioned elements alone.
  const centered: Record<string, [number, number]> = {
    id_semester_school: [120, 330], id_semester_title: [125, 320], id_semester_faculty: [125, 320],
    id_semester_top_line: [36, 488], id_semester_table: [20, 520], id_semester_summary_bg: [36, 488],
    id_semester_bottom_line: [80, 400], id_semester_sample_label: [80, 400],
  }
  const oldJson = String(theme.canvasElementsJson ?? '')
  const updatedJson = JSON.stringify(elements.map(el => {
    const expected = centered[String(el.id)]
    return expected && el.x === expected[0] && el.width === expected[1] ? { ...el, x: (560 - el.width) / 2 } : el
  }))
  return { ...records,
    reportsheetTheme: (records.reportsheetTheme ?? []).map(r => r.id === theme.id ? { ...r, canvasElementsJson: updatedJson } : r),
    reportBuilder: (records.reportBuilder ?? []).map(r => r.publishedThemeId === theme.themeId && r.canvasElementsJson === oldJson ? { ...r, canvasElementsJson: updatedJson } : r),
    reportThemeSampleMigrations: [...(records.reportThemeSampleMigrations ?? []), { id: 'semester-result-equal-margins-v1' }],
  }
}

/** Update only untouched seed positions and sample cells; preserve subsequent user edits. */
function alignExistingSemesterTheme(records: EduRecords): EduRecords {
  if ((records.reportThemeSampleMigrations ?? []).some(r => r.id === 'semester-result-layout-v2')) return records
  const theme = (records.reportsheetTheme ?? []).find(r => r.sampleKey === 'semester-result-pdf-v1')
  if (!theme) return records
  let elements: Array<Record<string, any>>
  try { const parsed = JSON.parse(String(theme.canvasElementsJson ?? '[]')); if (!Array.isArray(parsed)) return records; elements = parsed } catch { return records }
  const positions: Record<string, [number, number, number, number]> = {
    id_semester_logo: [45,40,42,40], id_semester_school: [120,34,120,33], id_semester_title: [125,59,125,60], id_semester_faculty: [125,81,125,84],
    id_semester_top_line: [36,115,36,116], id_semester_name_label: [36,128,36,130], id_semester_name: [117,128,121,130],
    id_semester_id_label: [36,151,36,154], id_semester_id_value: [117,151,121,154], id_semester_school_label: [210,151,212,154], id_semester_school_value: [255,151,257,154], id_semester_date_label: [340,151,343,154], id_semester_date_value: [377,151,381,154],
    id_semester_level_label: [36,174,36,178], id_semester_level: [117,174,121,178], id_semester_year_label: [210,174,212,178], id_semester_year: [264,174,266,178], id_semester_term_label: [340,174,343,178], id_semester_term: [398,174,401,178],
    id_semester_table: [20,215,20,216], id_semester_summary_bg: [36,402,36,405], id_semester_count: [340,407,340,410], id_semester_count_val: [490,407,490,410],
    id_semester_credits: [340,425,340,428], id_semester_credits_val: [490,425,490,428], id_semester_gpa: [340,443,340,446], id_semester_gpa_val: [490,443,490,446], id_semester_cgpa: [340,461,340,464], id_semester_cgpa_val: [490,461,490,464], id_semester_bottom_line: [80,512,80,516], id_semester_sample_label: [80,528,80,532],
  }
  const oldJson = String(theme.canvasElementsJson ?? '')
  const updated = elements.map(el => {
    let next = { ...el }
    const pos = positions[String(el.id)]
    if (pos && el.x === pos[0] && el.y === pos[1]) next = { ...next, x: pos[2], y: pos[3] }
    if (el.id === 'id_semester_table') {
      const style = { ...(el.style || {}) }
      if (Array.isArray(style.customColumns)) style.customColumns = style.customColumns.map((c: any) => c.label === 'Course Code' && c.source === 'blank' ? { ...c, source: 'subjectCode' } : c)
      style.useSubjectCatalog = true
      if (Array.isArray(style.sampleTableRows) && style.sampleTableRows[0]?.[0] === 'CRS201') style.sampleTableRows = Array.from({ length: 6 }, () => ['', '', '', '', '', '', '', ''])
      if (Array.isArray(style.sampleTableFooter) && style.sampleTableFooter[3] === '18' && style.sampleTableFooter[5] === '55.50') style.sampleTableFooter = ['Total', '', '', '', '', '', '', '']
      next.style = style
    }
    const sampleDefaults: Record<string,string> = { id_semester_count_val: '6', id_semester_credits_val: '18.0', id_semester_gpa_val: '3.08', id_semester_cgpa_val: '3.19' }
    if (Object.prototype.hasOwnProperty.call(sampleDefaults, String(el.id)) && sampleDefaults[String(el.id)] === el.text) next.text = '—'
    return next
  })
  const updatedJson = JSON.stringify(updated)
  return { ...records,
    reportsheetTheme: (records.reportsheetTheme ?? []).map(r => r.id === theme.id ? { ...r, canvasElementsJson: updatedJson } : r),
    reportBuilder: (records.reportBuilder ?? []).map(r => r.publishedThemeId === theme.themeId && r.canvasElementsJson === oldJson ? { ...r, canvasElementsJson: updatedJson } : r),
    reportThemeSampleMigrations: [...(records.reportThemeSampleMigrations ?? []), { id: 'semester-result-layout-v2' }],
  }
}

/** Seed an editable example based on the supplied university result-slip layout once per branch. */
function ensureSemesterResultThemeSeed(records: EduRecords): EduRecords {
  if (isCollectionMarkedCleared('educationRecords')) return records
  if ((records.reportThemeSampleMigrations ?? []).some(r => r.id === 'semester-result-pdf-v1')) return balanceThemeSeven(equalizeSemesterMargins(alignExistingSemesterTheme(records)))
  const existing = (records.reportsheetTheme ?? []).find(r => r.sampleKey === 'semester-result-pdf-v1')
  if (existing) return balanceThemeSeven(equalizeSemesterMargins(alignExistingSemesterTheme({ ...records, reportThemeSampleMigrations: [...(records.reportThemeSampleMigrations ?? []), { id: 'semester-result-pdf-v1' }] })))
  const text = (id: string, label: string, x: number, y: number, width: number, height: number, size = 10, extra: Record<string, unknown> = {}) => ({
    id: `id_semester_${id}`, type: 'text', label, text: label, x, y, width, height,
    style: { bg: 'transparent', color: '#142e51', fontSize: size, align: 'left', padding: 0, ...extra },
  })
  const rule = (id: string, x: number, y: number, width: number) => ({ id: `id_semester_${id}`, type: 'line', label: 'Red Divider', x, y, width, height: 4, style: { bg: '#b91c1c', lineThickness: 1, lineStyle: 'solid', orientation: 'horizontal' } })
  const columns = [
    { label: 'Course Code', source: 'subjectCode', width: 12 }, { label: 'Course Title', source: 'subject', width: 29 },
    { label: 'Level', source: 'blank', width: 8 }, { label: 'Credit', source: 'blank', width: 8 },
    { label: 'Grade Point', source: 'blank', width: 11 }, { label: 'GPA', source: 'blank', width: 8 },
    { label: 'Grade', source: 'grade', width: 7 }, { label: 'Remark', source: 'remark', width: 17 },
  ]
  const sampleRows = [
    ['CRS201', 'Sample Course 1', '200', '3', '3.50', '10.50', 'B+', 'Very Good'],
    ['CRS202', 'Sample Course 2', '200', '3', '2.00', '6.00', 'C', 'Average'],
    ['CRS203', 'Sample Course 3', '200', '3', '3.00', '9.00', 'B', 'Good'],
    ['CRS204', 'Sample Course 4', '200', '3', '2.50', '7.50', 'C+', 'Fairly Good'],
    ['CRS205', 'Sample Course 5', '200', '3', '3.50', '10.50', 'B+', 'Very Good'],
    ['CRS206', 'Sample Course 6', '200', '3', '4.00', '12.00', 'A', 'Outstanding'],
  ]
  const elements = [
    { id: 'id_semester_logo', type: 'image', label: 'School Logo', field: 'school_logo', x: 45, y: 40, width: 65, height: 60, style: { bg: 'transparent' } },
    text('school', 'SCHOOL NAME', 120, 34, 330, 24, 17, { color: '#063365', bold: true, align: 'center' }),
    text('title', 'PROVISIONAL RESULT SLIP', 125, 59, 320, 20, 12, { color: '#063365', bold: true, align: 'center' }),
    text('faculty', 'Faculty / Department', 125, 81, 320, 20, 11, { color: '#ac2222', bold: true, align: 'center' }),
    rule('top_line', 36, 115, 488),
    text('name_label', 'Student Name:', 36, 128, 80, 18), text('name', 'Sample Student', 117, 128, 170, 18, 10, { bold: true }),
    text('id_label', 'Student ID:', 36, 151, 80, 18), text('id_value', 'STU-001', 117, 151, 85, 18, 10, { bold: true }),
    text('school_label', 'School:', 210, 151, 43, 18), text('school_value', 'Regular', 255, 151, 72, 18, 10, { bold: true }),
    text('date_label', 'Date:', 340, 151, 35, 18), text('date_value', 'Sample Date', 377, 151, 140, 18, 10, { bold: true }),
    text('level_label', 'Level:', 36, 174, 80, 18), text('level', '200', 117, 174, 80, 18, 10, { bold: true }),
    text('year_label', 'Acad Year:', 210, 174, 50, 18), text('year', '2026/2027', 264, 174, 70, 18, 10, { bold: true }),
    text('term_label', 'Semester:', 340, 174, 55, 18), text('term', '2nd Semester', 398, 174, 120, 18, 10, { bold: true }),
    { id: 'id_semester_table', type: 'table', label: 'Subject Table', field: 'subject_table', x: 20, y: 215, width: 520, height: 180, style: { customColumns: columns, sampleTableRows: sampleRows, useSubjectCatalog: true, sampleTableFooter: ['Total', '', '', '18', '', '55.50', '', ''], headerBg: '#f8bec9', headerColor: '#6b1115', borderColor: '#4b5563' } },
    { id: 'id_semester_summary_bg', type: 'text', label: 'Summary Background', text: ' ', x: 36, y: 402, width: 488, height: 84, style: { bg: '#f3f4f6', color: '#f3f4f6' } },
    text('count', 'No. of Courses Taken:', 340, 407, 145, 15, 8), text('count_val', '6', 490, 407, 28, 15, 8),
    text('credits', 'Total Credit Taken:', 340, 425, 145, 15, 8), text('credits_val', '18.0', 490, 425, 28, 15, 8),
    text('gpa', 'Semester GPA:', 340, 443, 145, 15, 8), text('gpa_val', '3.08', 490, 443, 28, 15, 8),
    text('cgpa', 'Cumulative GPA:', 340, 461, 145, 15, 8, { bold: true }), text('cgpa_val', '3.19', 490, 461, 28, 15, 8, { bold: true }),
    rule('bottom_line', 80, 512, 400),
    text('sample_label', 'SAMPLE DATA — replace with institution and student information', 80, 528, 400, 14, 8, { color: '#6b7280', align: 'center' }),
  ]
  const firstBuiltin = getAllReportsheetThemes(records).find(t => !t.isCustom)
  const result = publishReportsheetThemeToRecords(records, { tagline: 'Semester Result Slip (Sample)', description: 'University semester result slip based on the supplied reference. Contains illustrative sample values.', baseThemeId: firstBuiltin?.id ?? 'theme-1', canvasElementsJson: JSON.stringify(elements), canvasSettingsJson: JSON.stringify({ blankForm: true }), tableCellOverridesJson: '{}', reportOptionsJson: '[]' })
  const rows: EduRow[] = (result.nextRecords.reportsheetTheme ?? []).map(r => r.id === `custom-${result.theme.id}` ? { ...r, sampleKey: 'semester-result-pdf-v1' } : r)
  return balanceThemeSeven(equalizeSemesterMargins(alignExistingSemesterTheme({ ...result.nextRecords, reportsheetTheme: rows, reportThemeSampleMigrations: [...(records.reportThemeSampleMigrations ?? []), { id: 'semester-result-pdf-v1' }] })))
}

export function ensureSemesterResultTheme(records: EduRecords): EduRecords {
  return removeDefaultThemeEight(ensureSemesterResultThemeSeed(records))
}

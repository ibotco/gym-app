import type { CSSProperties } from 'react'

export type SubjectColumn = { label: string; source: string; width?: number }
export type SubjectTableRow = { subject: string; colScores: number[]; total: number; grade?: string; position?: string; remarks?: string }

/** Column labels are presentation only; only explicitly selected sources are populated. */
export function CustomSubjectTable({ columns, rows, headerBg, headerColor, borderColor, style, sampleRows, sampleFooter, subjectCatalog, useSubjectCatalog }: {
  columns: SubjectColumn[]; rows: SubjectTableRow[]; headerBg: string; headerColor: string; borderColor: string; style?: CSSProperties; sampleRows?: string[][]; sampleFooter?: string[]; subjectCatalog?: Array<{ name?: string; short?: string; code?: string }>; useSubjectCatalog?: boolean
}) {
  const cell: CSSProperties = { border: `1px solid ${borderColor}`, padding: '4px 5px', overflowWrap: 'anywhere' }
  const value = (row: SubjectTableRow, source: string) => {
    if (source.startsWith('score:')) return row.colScores[Number(source.slice(6))] ?? ''
    if (source === 'subject') return row.subject
    if (source === 'subjectCode') return subjectCatalog?.find(s => String(s.name ?? '').trim().toLowerCase() === row.subject.trim().toLowerCase())?.short ?? '' 
    if (source === 'total') return row.total
    if (source === 'grade') return row.grade ?? ''
    if (source === 'position') return row.position ?? ''
    if (source === 'remark') return row.remarks ?? ''
    return ''
  }
  return <table data-element-id="subject-table" data-element-type="table" data-element-label="Subject Table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 9, marginTop: 8, ...style }}>
    <thead><tr>{columns.map((col, i) => <th key={i} style={{ ...cell, width: col.width ? `${col.width}%` : undefined, background: headerBg, color: headerColor, textAlign: 'center', fontWeight: 700 }}>{col.label}</th>)}</tr></thead>
    <tbody>{sampleRows ? (useSubjectCatalog ? (subjectCatalog ?? []).slice(0, 6).map((subject, i) => ({ subject, row: sampleRows[i] ?? [] })) : sampleRows.map(row => ({ subject: undefined, row }))).map(({ row, subject }, ri) => <tr key={ri}>{columns.map((col, ci) => <td key={ci} style={{ ...cell, background: '#fff', color: '#0f172a', textAlign: ci === 0 || col.source === 'subject' || ci === columns.length - 1 ? 'left' : 'center' }}>{subject && col.source === 'subject' ? subject.name ?? '' : subject && col.source === 'subjectCode' ? subject.short ?? '' : row[ci] ?? ''}</td>)}</tr>) : rows.map((row, ri) => <tr key={ri}>{columns.map((col, ci) => <td key={ci} style={{ ...cell, background: '#fff', color: '#0f172a', textAlign: col.source === 'subject' ? 'left' : 'center' }}>{value(row, col.source)}</td>)}</tr>)}
      {sampleRows && sampleFooter && <tr>{columns.map((_, ci) => <td key={ci} style={{ ...cell, background: headerBg, color: headerColor, textAlign: ci === 0 ? 'left' : 'center' }}>{sampleFooter[ci] ?? ''}</td>)}</tr>}
    </tbody>
  </table>
}

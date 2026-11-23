type Row = { id: string; [key: string]: string }
const norm = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
const section = (value: unknown) => String(value ?? '').trim().replace(/^section\s+/i, '')
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
export function studentListClasses(rows: Row[]): string[] { return unique(rows.map(row => String(row.className ?? '').trim())) }
export function studentListSections(rows: Row[], className: string, configuredSections: Row[] = []): string[] {
  if (!className) return []
  const values = [...rows.filter(row => norm(row.className) === norm(className)).map(row => section(row.section)), ...configuredSections.map(row => section(row.name))]
  const seen = new Set<string>()
  return unique(values).filter(value => { const key = norm(value); if (seen.has(key)) return false; seen.add(key); return true })
}
export function filterStudentList(rows: Row[], className: string, sectionName: string): Row[] {
  return rows.filter(row => (!className || norm(row.className) === norm(className)) && (!sectionName || norm(section(row.section)) === norm(section(sectionName))))
}

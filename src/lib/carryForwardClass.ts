import type { EduRow } from './eduRecords'
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
/** Resolve class from the student record, including class names stored with a section suffix. */
export function carryForwardStudentClass(student: EduRow, classes: EduRow[]): string {
  const raw = String(student.className ?? '').trim()
  return classes.map(c => String(c.name ?? '').trim()).filter(Boolean).sort((a,b) => b.length-a.length)
    .find(name => norm(raw) === norm(name) || norm(raw).startsWith(norm(name) + ' ')) ?? raw
}
export function carryForwardClassOptions(students: EduRow[], classes: EduRow[]): string[] {
  return [...new Set([...classes.map(c => String(c.name ?? '').trim()), ...students.map(s => carryForwardStudentClass(s, classes))].filter(Boolean))].sort((a,b)=>a.localeCompare(b))
}
export function carryForwardInClass(student: EduRow, classes: EduRow[], selectedClass: string): boolean {
  return !selectedClass || norm(carryForwardStudentClass(student, classes)) === norm(selectedClass)
}
/** Year and term must match together on either side of a transfer. */
export function carryForwardMatchesPeriod(event: EduRow, year: string, term: string): boolean {
  if (!year && !term) return true
  const matches = (y: unknown, t: unknown) => (!year || norm(y) === norm(year)) && (!term || norm(t) === norm(term))
  return matches(event.fromSession, event.fromTerm) || matches(event.toSession, event.toTerm)
}

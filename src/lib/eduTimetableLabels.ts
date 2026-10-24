import type { EduRow } from './eduRecords'
import type { TtConfig } from './eduTimetableConfig'

const initials = (name: string) => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => (/\d/.test(word) ? word : word[0] ?? ''))
  .join('')
  .toLocaleUpperCase()
  .slice(0, 6)

const rowForName = (rows: EduRow[], name: string) => {
  const target = name.trim().toLocaleLowerCase()
  return rows.find((row) => String(row.name ?? '').trim().toLocaleLowerCase() === target)
}

export function classroomTimetableName(name: string, cfg: Pick<TtConfig, 'classroomNameDisplay'>, rooms: EduRow[]): string {
  if (cfg.classroomNameDisplay !== 'short') return name
  const row = rowForName(rooms, name)
  return String(row?.short ?? '').trim() || initials(name) || name
}

export function subjectTimetableName(name: string, cfg: Pick<TtConfig, 'subjectNameDisplay'>, subjects: EduRow[]): string {
  if (cfg.subjectNameDisplay !== 'short') return name
  const row = rowForName(subjects, name)
  return String(row?.short ?? '').trim() || String(row?.code ?? '').trim() || initials(name) || name
}

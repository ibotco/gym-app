import type { EduRecords, EduRow } from './eduRecords'

/** Named, term-linked timetable labels; lesson data remains in shared branch collections. */
export function timetableSchedules(records: EduRecords): EduRow[] {
  return records['ttSchedules'] ?? []
}

export function activeTimetableSchedule(records: EduRecords): EduRow | null {
  const schedules = timetableSchedules(records)
  return schedules.find((row) => row.active === 'Yes') ?? schedules[0] ?? null
}

export function academicTermLabel(term: EduRow): string {
  return [String(term.name ?? '').trim(), String(term.academicYear ?? '').trim()].filter(Boolean).join(' · ')
}

export function timetableScheduleCaption(schedule: EduRow | null | undefined): string {
  if (!schedule) return ''
  const term = [String(schedule.termName ?? '').trim(), String(schedule.academicYear ?? '').trim()].filter(Boolean).join(' · ')
  return [String(schedule.name ?? '').trim(), term].filter(Boolean).join(' — ')
}

import { uid } from './utils'

/**
 * Room allocation helpers (pure, unit-tested).
 *
 * A room allocation binds one room to one class lesson slot:
 * { room, day, period, className, subject?, teacher? }.
 * `autoAssignRooms` fills missing allocations from the class timetable,
 * preferring each class's home room and never double-booking a room.
 */

export type RoomLesson = { day: string; period: string; className: string; subject?: string; teacher?: string }
export type RoomAlloc = { id: string; room: string; day: string; period: string; className: string; subject?: string; teacher?: string }

export const slotKey = (room: string, day: string, period: string) => `${room}|${day}|${period}`

export type RoomMeta = { name: string; shared?: string }

/**
 * Candidate order for auto-assignment: the class home room first, then
 * dedicated (non-shared) classrooms, then shared rooms (labs, halls) last so
 * specialist space is only used when nothing else is free.
 */
export function orderRoomsForAssign(rooms: RoomMeta[], homeRoom?: string): string[] {
  const names = rooms.map((r) => r.name).filter(Boolean)
  const shared = new Set(rooms.filter((r) => r.shared === 'Yes').map((r) => r.name))
  const ordered = [
    ...names.filter((n) => n !== homeRoom && !shared.has(n)),
    ...names.filter((n) => n !== homeRoom && shared.has(n)),
  ]
  return homeRoom && names.includes(homeRoom) ? [homeRoom, ...ordered] : ordered
}

export type RoomRow = { id: string } & Record<string, string>

/**
 * One-time migration of pre-"shared room" rows (old `type` field) into the new
 * model: shared = Yes for anything that was not a plain classroom, and the
 * home classroom flag derived from which class lists the room as its home.
 */
export function migrateRoomRows(rows: RoomRow[], homeByRoom: Record<string, string>): RoomRow[] {
  return rows.map((r) => {
    if ('shared' in r || !('type' in r)) return r
    const next: RoomRow = { ...r }
    next.shared = r.type && r.type !== 'Classroom' ? 'Yes' : ''
    delete next.type
    if (!next.short) {
      next.short = (r.name ?? '')
        .split(/\s+/)
        .map((w) => (/\d/.test(w) ? w : w[0] ?? ''))
        .join('')
        .toUpperCase()
        .slice(0, 6)
    }
    const home = homeByRoom[r.name ?? '']
    if (home && next.homeClassroom !== 'Yes') {
      next.homeClassroom = 'Yes'
      next.homeClass = home
    }
    return next
  })
}

/** Slots already booked by an allocation row. */
export function bookedSlots(allocs: RoomAlloc[]): Set<string> {
  const s = new Set<string>()
  allocs.forEach((a) => {
    if (a.room && a.day && a.period) s.add(slotKey(a.room, a.day, a.period))
  })
  return s
}

/** True when the same room is double-booked on this slot by another row. */
export function isRoomClash(allocs: RoomAlloc[], row: RoomAlloc): boolean {
  return allocs.some((o) => o.id !== row.id && o.room === row.room && o.day === row.day && o.period === row.period)
}

/**
 * Pick a free room for a lesson: the class's home room first, then any other
 * room (in the given order) that is free on that slot. '' when none is free.
 */
export function pickRoom(
  lesson: RoomLesson,
  rooms: string[],
  booked: Set<string>,
  homeRoom?: string,
): string {
  const candidates = homeRoom && rooms.includes(homeRoom) ? [homeRoom, ...rooms.filter((r) => r !== homeRoom)] : rooms
  return candidates.find((r) => r && !booked.has(slotKey(r, lesson.day, lesson.period))) ?? ''
}

/**
 * Allocate rooms for timetable lessons that have no allocation yet.
 * Existing allocations are kept; a lesson is considered allocated when a row
 * matches its class + day + period. Returns the merged list plus counters.
 */
export function autoAssignRooms(
  lessons: RoomLesson[],
  allocs: RoomAlloc[],
  rooms: string[],
  homeRooms: Record<string, string>,
): { allocs: RoomAlloc[]; assigned: number; skipped: number } {
  const next: RoomAlloc[] = [...allocs]
  const booked = bookedSlots(next)
  let assigned = 0
  let skipped = 0
  for (const l of lessons) {
    if (!l.className || !l.day || !l.period) continue
    const has = next.some((a) => a.className === l.className && a.day === l.day && a.period === l.period)
    if (has) continue
    const room = pickRoom(l, rooms, booked, homeRooms[l.className])
    if (!room) {
      skipped++
      continue
    }
    booked.add(slotKey(room, l.day, l.period))
    next.push({
      id: uid(),
      room,
      day: l.day,
      period: l.period,
      className: l.className,
      subject: l.subject ?? '',
      teacher: l.teacher ?? '',
    })
    assigned++
  }
  return { allocs: next, assigned, skipped }
}

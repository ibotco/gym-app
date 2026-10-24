/**
 * Card holders — who a card can be issued to.
 *
 * The card engine itself (templates, rendering, printing, the status machine)
 * doesn't care who the holder is. What changes between a student, a staff
 * member and a gym member is only:
 *
 *   1. where the people come from,
 *   2. which fields make sense on the card,
 *   3. what those fields are called.
 *
 * This module owns exactly those three things, so the rest of Card Management
 * stays domain-agnostic.
 */
import type { EduRow } from './eduRecords'
import type { IdCardStudent } from './eduIdCards'

export const CARD_HOLDER_TYPES = ['Student', 'Staff', 'Member'] as const
export type CardHolderType = (typeof CARD_HOLDER_TYPES)[number]

export const isCardHolderType = (value: unknown): value is CardHolderType =>
  CARD_HOLDER_TYPES.includes(String(value ?? '').trim() as CardHolderType)

/** What a holder type is called when it appears on a card or in a filter. */
export const CARD_HOLDER_LABELS: Record<CardHolderType, { one: string; many: string; reference: string }> = {
  Student: { one: 'Student', many: 'Students', reference: 'Admission Number' },
  Staff: { one: 'Staff', many: 'Staff', reference: 'Employee Number' },
  Member: { one: 'Member', many: 'Members', reference: 'Membership Number' },
}

export type CardFieldDef = { key: string; label: string }

/** The detail rows a template can switch on, per holder type. */
export const CARD_FIELDS: Record<CardHolderType, { front: CardFieldDef[]; back: CardFieldDef[] }> = {
  Student: {
    front: [
      { key: 'admissionNo', label: 'Admission Number' },
      { key: 'holderName', label: 'Student Name' },
      { key: 'className', label: 'Class' },
      { key: 'section', label: 'Section / Stream' },
      { key: 'house', label: 'House' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'academicYear', label: 'Academic Year' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'rollNo', label: 'Roll No' },
      { key: 'guardian', label: 'Guardian' },
      { key: 'phone', label: 'Phone' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'expiryDate', label: 'Expiry Date' },
    ],
    back: [
      { key: 'schoolAddress', label: 'School address' },
      { key: 'schoolContact', label: 'Contact details' },
      { key: 'motto', label: 'School motto' },
      { key: 'admissionNo', label: 'Admission Number' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'guardian', label: 'Guardian' },
      { key: 'phone', label: 'Phone' },
      { key: 'emergencyContact', label: 'Emergency contact' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'house', label: 'House' },
      { key: 'validity', label: 'Validity / expiry note' },
      { key: 'returnNote', label: 'Return / property note' },
      { key: 'signature', label: 'Authorised signature' },
      { key: 'qr', label: 'QR code' },
      { key: 'barcode', label: 'Barcode' },
    ],
  },
  Staff: {
    front: [
      { key: 'employeeNo', label: 'Employee Number' },
      { key: 'holderName', label: 'Full Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'joinDate', label: 'Date Employed' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'expiryDate', label: 'Expiry Date' },
    ],
    back: [
      { key: 'schoolAddress', label: 'Organisation address' },
      { key: 'schoolContact', label: 'Contact details' },
      { key: 'motto', label: 'Motto' },
      { key: 'employeeNo', label: 'Employee Number' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'department', label: 'Department' },
      { key: 'phone', label: 'Phone' },
      { key: 'emergencyContact', label: 'Emergency contact' },
      { key: 'validity', label: 'Validity / expiry note' },
      { key: 'returnNote', label: 'Return / property note' },
      { key: 'signature', label: 'Authorised signature' },
      { key: 'qr', label: 'QR code' },
      { key: 'barcode', label: 'Barcode' },
    ],
  },
  Member: {
    front: [
      { key: 'membershipNo', label: 'Membership Number' },
      { key: 'holderName', label: 'Full Name' },
      { key: 'plan', label: 'Membership Plan' },
      { key: 'gender', label: 'Gender' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'joinDate', label: 'Member Since' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'expiryDate', label: 'Expiry Date' },
    ],
    back: [
      { key: 'schoolAddress', label: 'Organisation address' },
      { key: 'schoolContact', label: 'Contact details' },
      { key: 'motto', label: 'Motto' },
      { key: 'membershipNo', label: 'Membership Number' },
      { key: 'cardNo', label: 'ID Card Number' },
      { key: 'plan', label: 'Membership Plan' },
      { key: 'phone', label: 'Phone' },
      { key: 'emergencyContact', label: 'Emergency contact' },
      { key: 'validity', label: 'Validity / expiry note' },
      { key: 'returnNote', label: 'Return / property note' },
      { key: 'signature', label: 'Authorised signature' },
      { key: 'qr', label: 'QR code' },
      { key: 'barcode', label: 'Barcode' },
    ],
  },
}

/**
 * Backwards compatibility: templates saved before holder types existed used
 * `studentName` for the person's name. It's the same row as `holderName`.
 */
export const CARD_FIELD_ALIASES: Record<string, string> = { studentName: 'holderName' }

export const normaliseCardFields = (fields: string[]) =>
  fields.map((key) => CARD_FIELD_ALIASES[key] ?? key)

/** The default detail rows for a brand-new template of this holder type. */
export const defaultCardFields = (holderType: CardHolderType) => ({
  front: holderType === 'Student'
    ? ['admissionNo', 'holderName', 'className', 'section', 'house', 'gender', 'dateOfBirth', 'academicYear', 'cardNo']
    : holderType === 'Staff'
      ? ['employeeNo', 'holderName', 'department', 'designation', 'gender', 'phone', 'cardNo']
      : ['membershipNo', 'holderName', 'plan', 'gender', 'phone', 'joinDate', 'cardNo'],
  back: holderType === 'Student'
    ? ['schoolAddress', 'schoolContact', 'motto', 'validity', 'returnNote', 'signature', 'qr', 'barcode']
    : ['schoolAddress', 'schoolContact', 'validity', 'returnNote', 'signature', 'qr', 'barcode'],
})

/* ------------------------------------------------------------- the holders */

export type CardHolder = {
  /** Stable id of the underlying record (student id, staff id, member id). */
  id: string
  holderType: CardHolderType
  name: string
  /** Admission number, employee number or membership number. */
  reference: string
  photo: string
  gender: string
  dateOfBirth: string
  phone: string
  email: string
  /** Student */
  className: string
  section: string
  house: string
  guardian: string
  rollNo: string
  /** Staff */
  department: string
  designation: string
  joinDate: string
  /** Member */
  plan: string
  status: string
}

const text = (value: unknown) => String(value ?? '').trim()

/**
 * Turns a record id into a readable reference (ST_1 → EMP-001) for organisations
 * that don't keep their own employee / membership numbers.
 */
const derivedReference = (prefix: string, id: string) => {
  const digits = id.replace(/\D/g, '')
  return `${prefix}-${digits ? digits.slice(-3).padStart(3, '0') : id.slice(-3).toUpperCase()}`
}

/** The minimal shape we need from a user record to fill in a person's details. */
export type CardPersonSource = {
  id: string
  name?: string
  email?: string
  phone?: string
  avatar?: string
  photo?: string
  branchId?: string
  status?: string
}

const fromStudents = (students: IdCardStudent[]): CardHolder[] =>
  students.map((student) => ({
    id: student.id,
    holderType: 'Student' as const,
    name: student.name,
    reference: student.admissionNo,
    photo: student.photo,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth,
    phone: student.phone,
    email: '',
    className: student.className,
    section: student.section,
    house: student.house,
    guardian: student.guardian,
    rollNo: student.rollNo,
    department: '',
    designation: '',
    joinDate: '',
    plan: '',
    status: student.status || 'Active',
  }))

/** Staff records hold an employee number; the person's name lives on their user. */
const fromStaff = (records: EduRow[], users: CardPersonSource[]): CardHolder[] => {
  const byId = new Map(users.map((user) => [text(user.id), user]))
  return records.map((row) => {
    const user = byId.get(text(row.userId)) ?? byId.get(text(row.id))
    const name = text(row.name) || text(user?.name)
    return {
      id: text(row.id),
      holderType: 'Staff' as const,
      name: name || 'Unnamed staff',
      reference: text(row.employeeNumber) || derivedReference('EMP', text(row.staffId) || text(row.id)),
      photo: text(row.photo) || text(user?.photo) || text(user?.avatar),
      gender: text(row.gender),
      dateOfBirth: text(row.dob) || text(row.dateOfBirth),
      phone: text(row.phone) || text(user?.phone),
      email: text(row.email) || text(user?.email),
      className: '',
      section: '',
      house: '',
      guardian: '',
      rollNo: '',
      department: text(row.department) || text(row.directorateUnit),
      designation: text(row.staffDesignation) || text(row.title) || text(row.designation),
      joinDate: text(row.hireDate),
      plan: '',
      status: text(row.status) || 'Active',
    }
  })
}

/** Members are keyed by their membership; the person's name lives on their user. */
const fromMembers = (records: EduRow[], users: CardPersonSource[], planNames?: Map<string, string>): CardHolder[] => {
  const byId = new Map(users.map((user) => [text(user.id), user]))
  return records.map((row) => {
    const user = byId.get(text(row.userId)) ?? byId.get(text(row.id))
    const name = text(row.name) || text(user?.name)
    const planId = text(row.planId)
    return {
      id: text(row.id),
      holderType: 'Member' as const,
      name: name || 'Unnamed member',
      reference: text(row.membershipNo) || derivedReference('MEM', text(row.membershipId) || text(row.id)),
      photo: text(row.photo) || text(user?.photo) || text(user?.avatar),
      gender: text(row.gender),
      dateOfBirth: text(row.dob) || text(row.dateOfBirth),
      phone: text(row.phone) || text(user?.phone),
      email: text(row.email) || text(user?.email),
      className: '',
      section: '',
      house: '',
      guardian: '',
      rollNo: '',
      department: '',
      designation: '',
      joinDate: text(row.joinDate),
      plan: text(row.plan) || (planId ? planNames?.get(planId) ?? '' : ''),
      status: text(row.status) || 'Active',
    }
  })
}

export type CardHolderSources = {
  students: IdCardStudent[]
  staff: EduRow[]
  members: EduRow[]
  users: CardPersonSource[]
  planNames?: Map<string, string>
}

/** Builds the holder list for one type from whatever the app can supply. */
export const cardHolders = (type: CardHolderType, sources: CardHolderSources): CardHolder[] => {
  if (type === 'Student') return fromStudents(sources.students)
  if (type === 'Staff') return fromStaff(sources.staff, sources.users)
  return fromMembers(sources.members, sources.users, sources.planNames)
}

export const cardHoldersFor = (types: CardHolderType[], sources: CardHolderSources): CardHolder[] =>
  types.flatMap((type) => cardHolders(type, sources))

/** Turns a holder back into the card row stored with the card. */
export const holderCardValues = (holder: CardHolder) => ({
  holderType: holder.holderType,
  holder: holder.name,
  student: holder.name,
  admissionNo: holder.holderType === 'Student' ? holder.reference : '',
  employeeNo: holder.holderType === 'Staff' ? holder.reference : '',
  membershipNo: holder.holderType === 'Member' ? holder.reference : '',
  className: holder.className,
  section: holder.section,
  house: holder.house,
  gender: holder.gender,
  dateOfBirth: holder.dateOfBirth,
  guardian: holder.guardian,
  rollNo: holder.rollNo,
  department: holder.department,
  designation: holder.designation,
  plan: holder.plan,
  joinDate: holder.joinDate,
  phone: holder.phone,
  photo: holder.photo,
})

/**
 * ID Card Management — engine.
 *
 * Templates, card generation (single + bulk), numbering, status workflow,
 * replacement, verification, reporting and the role/permission matrix all live
 * here so the five ID Card pages stay thin.
 */
import type { EduRecords, EduRow } from './eduRecords'

/* ------------------------------------------------------------------ types */

export const ID_CARD_STATUSES = [
  'Generated', 'Printed', 'Issued', 'Active', 'Lost', 'Damaged', 'Replaced', 'Expired',
] as const

export type IdCardStatus = (typeof ID_CARD_STATUSES)[number]

/* Card Management is universal: a template is built for students, staff or
 * members, which decides where its holders come from and which fields it can
 * show. The definitions live in ./cardHolders — imported as values here, while
 * that module only ever imports types back from this file. */
import { holderCardValues, isCardHolderType, type CardHolder, type CardHolderType } from './cardHolders'
export { CARD_HOLDER_TYPES, CARD_FIELDS, CARD_HOLDER_LABELS, defaultCardFields, type CardHolder, type CardHolderType } from './cardHolders'

/** Statuses that mean "this card is in a student's hands and valid". */
export const ID_CARD_VALID_STATUSES: IdCardStatus[] = ['Issued', 'Active']

/** Statuses that should never appear on a newly printed card again. */
export const ID_CARD_INACTIVE_STATUSES: IdCardStatus[] = ['Lost', 'Damaged', 'Replaced', 'Expired']

const TRANSITIONS: Record<IdCardStatus, IdCardStatus[]> = {
  // Generated → Issued is allowed too: a school can hand a card straight over
  // without recording a print run first.
  Generated: ['Printed', 'Issued', 'Expired', 'Lost', 'Damaged'],
  Printed: ['Issued', 'Lost', 'Damaged', 'Expired'],
  Issued: ['Active', 'Lost', 'Damaged', 'Expired'],
  Active: ['Lost', 'Damaged', 'Expired'],
  Lost: ['Expired'],
  Damaged: ['Expired'],
  Replaced: ['Expired'],
  Expired: [],
}

export const allowedNextStatuses = (status: string): IdCardStatus[] =>
  TRANSITIONS[(String(status) as IdCardStatus) in TRANSITIONS ? (String(status) as IdCardStatus) : 'Generated'] ?? []

export const canTransition = (from: string, to: string) => allowedNextStatuses(from).includes(to as IdCardStatus)

export const ID_CARD_HISTORY_ACTIONS = [
  'Generated', 'Printed', 'Issued', 'Activated', 'Marked Lost', 'Marked Damaged', 'Replaced', 'Expired', 'Edited', 'Verified',
] as const
export type IdCardHistoryAction = (typeof ID_CARD_HISTORY_ACTIONS)[number]

export const ID_CARD_PERMISSION_KEYS = ['configure', 'generate', 'print', 'issue', 'replace', 'verify', 'reports'] as const
export type IdCardPermissionKey = (typeof ID_CARD_PERMISSION_KEYS)[number]

export const ID_CARD_PERMISSIONS: { key: IdCardPermissionKey; label: string; description: string }[] = [
  { key: 'configure', label: 'Configure templates', description: 'Create and edit card templates, layouts and numbering.' },
  { key: 'generate', label: 'Generate cards', description: 'Generate single or bulk ID cards from student records.' },
  { key: 'print', label: 'Print cards', description: 'Print individual cards, bulk print runs and print previews.' },
  { key: 'issue', label: 'Issue & track status', description: 'Record issue dates and officers, move cards through their statuses.' },
  { key: 'replace', label: 'Replace cards', description: 'Reissue lost or damaged cards and deactivate the old one.' },
  { key: 'verify', label: 'Search & verify', description: 'Look cards up and verify them by QR code or card number.' },
  { key: 'reports', label: 'View reports', description: 'Open the generated / printed / issued / active / lost / replaced / class summary reports.' },
]

/** Roles that always keep every ID Card permission (they can never lock themselves out). */
export const ID_CARD_ADMIN_ROLES = ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'admin', 'Administrator']

export const DEFAULT_ID_CARD_PERMISSION_ROLES: Record<IdCardPermissionKey, string[]> = {
  configure: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager'],
  generate: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist'],
  print: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist'],
  issue: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist'],
  replace: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager'],
  verify: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist', 'staff', 'head_office'],
  reports: ['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist', 'head_office'],
}

/* -------------------------------------------------------------- templates */

export const ID_CARD_FRONT_FIELDS = [
  { key: 'admissionNo', label: 'Admission Number' },
  { key: 'studentName', label: 'Student Name' },
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
] as const

export const ID_CARD_BACK_FIELDS = [
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
] as const

/** Where the student photo sits on the front of the card. */
export const ID_CARD_PHOTO_POSITIONS = ['Left', 'Right', 'Top', 'Bottom'] as const
export type IdCardPhotoPosition = (typeof ID_CARD_PHOTO_POSITIONS)[number]

/** Type families for the card. All are system fonts, so nothing has to download. */
export const ID_CARD_FONT_FAMILIES = [
  { id: 'sans', label: 'Sans (default)', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { id: 'serif', label: 'Serif', stack: "Georgia, 'Times New Roman', Times, serif" },
  { id: 'mono', label: 'Monospace', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Courier New', monospace" },
  { id: 'rounded', label: 'Rounded', stack: "'Trebuchet MS', 'Segoe UI', Verdana, Geneva, sans-serif" },
  { id: 'condensed', label: 'Condensed', stack: "'Arial Narrow', 'Helvetica Neue', Helvetica, Arial, sans-serif" },
] as const

/** Text size steps — a multiplier on every millimetre size on the card. */
export const ID_CARD_FONT_SCALES = [
  { label: '70%', value: 0.7 },
  { label: '75%', value: 0.75 },
  { label: '80%', value: 0.8 },
  { label: '85%', value: 0.85 },
  { label: '90%', value: 0.9 },
  { label: '95%', value: 0.95 },
  { label: '100% (normal)', value: 1 },
  { label: '105%', value: 1.05 },
  { label: '110%', value: 1.1 },
  { label: '115%', value: 1.15 },
  { label: '120%', value: 1.2 },
  { label: '125%', value: 1.25 },
  { label: '130%', value: 1.3 },
  { label: '140%', value: 1.4 },
  { label: '150%', value: 1.5 },
] as const

export const ID_CARD_LABEL_CASES = ['Sentence case', 'UPPERCASE'] as const

/** How an imported background image is fitted to the card. */
export const ID_CARD_BACKGROUND_FITS = [
  { id: 'Cover', label: 'Cover (fill, crop edges)', css: 'cover' },
  { id: 'Contain', label: 'Contain (fit whole image)', css: 'contain' },
  { id: 'Stretch', label: 'Stretch (fill exactly)', css: 'fill' },
] as const
export type IdCardBackgroundFit = (typeof ID_CARD_BACKGROUND_FITS)[number]['id']

export const backgroundFitCss = (id: string) =>
  ID_CARD_BACKGROUND_FITS.find((fit) => fit.id === id)?.css ?? 'cover'

export const fontStack = (id: string) =>
  ID_CARD_FONT_FAMILIES.find((font) => font.id === id)?.stack ?? ID_CARD_FONT_FAMILIES[0].stack

/** Where the QR code sits on the front of the card. */
export const ID_CARD_QR_POSITIONS = ['Bottom right', 'Bottom left', 'Top right'] as const
export type IdCardQrPosition = (typeof ID_CARD_QR_POSITIONS)[number]

/** Ready-made card sizes; anything else is a custom size typed in millimetres. */
export const ID_CARD_SIZE_PRESETS = [
  { label: 'CR80 PVC (85.6 × 54 mm)', widthMm: 85.6, heightMm: 54 },
  { label: 'CR79 PVC (85.6 × 51 mm)', widthMm: 85.6, heightMm: 51 },
  { label: 'Large badge (105 × 74 mm)', widthMm: 105, heightMm: 74 },
  { label: 'Portrait badge (54 × 85.6 mm)', widthMm: 54, heightMm: 85.6 },
] as const

export const ID_CARD_CUSTOM_SIZE = 'Custom size…'
export const ID_CARD_SIZE_LIMITS = { minWidth: 40, maxWidth: 220, minHeight: 25, maxHeight: 320 }

/** Keeps a typed-in size inside printable bounds. */
export const clampCardSize = (width: number, height: number) => ({
  widthMm: clamp(width || DEFAULT_ID_CARD_TEMPLATE.widthMm, ID_CARD_SIZE_LIMITS.minWidth, ID_CARD_SIZE_LIMITS.maxWidth),
  heightMm: clamp(height || DEFAULT_ID_CARD_TEMPLATE.heightMm, ID_CARD_SIZE_LIMITS.minHeight, ID_CARD_SIZE_LIMITS.maxHeight),
})

/** Name of the preset matching a size, or “Custom size…” when it matches none. */
export const sizePresetLabel = (widthMm: number, heightMm: number) =>
  ID_CARD_SIZE_PRESETS.find(
    (preset) => Math.abs(preset.widthMm - widthMm) < 0.05 && Math.abs(preset.heightMm - heightMm) < 0.05,
  )?.label ?? ID_CARD_CUSTOM_SIZE

export type IdCardTemplate = {
  id: string
  name: string
  /** Who this template issues cards to — drives the source, fields and labels. */
  holderType: CardHolderType
  status: string
  orientation: 'Portrait' | 'Landscape'
  widthMm: number
  heightMm: number
  backgroundColor: string
  headerColor: string
  textColor: string
  accentColor: string
  showLogo: boolean
  schoolName: string
  address: string
  contact: string
  motto: string
  frontFields: string[]
  backFields: string[]
  showPhoto: boolean
  photoPosition: IdCardPhotoPosition
  photoStyle: 'Square' | 'Circle'
  showQr: boolean
  qrPosition: IdCardQrPosition
  showBarcode: boolean
  showSignature: boolean
  signatureName: string
  signatureTitle: string
  backNote: string
  cardNoPrefix: string
  validityMonths: number
  printLayout: 'PVC Card' | 'A4 Sheet'
  cardsPerRow: number
  sizePreset: string
  fontFamily: string
  fontScale: number
  labelCase: string
  /** Imported artwork drawn behind the content — one per face. */
  frontBackground: string
  backBackground: string
  backgroundFit: string
  backgroundOpacity: number
}

export const DEFAULT_ID_CARD_TEMPLATE: Omit<IdCardTemplate, 'id' | 'name'> = {
  holderType: 'Student',
  status: 'Active',
  orientation: 'Landscape',
  widthMm: 85.6,
  heightMm: 54,
  backgroundColor: '#ffffff',
  headerColor: '#1d4ed8',
  textColor: '#0f172a',
  accentColor: '#f59e0b',
  showLogo: true,
  schoolName: '',
  address: '',
  contact: '',
  motto: '',
  frontFields: ['admissionNo', 'studentName', 'className', 'section', 'house', 'gender', 'dateOfBirth', 'academicYear', 'cardNo'],
  backFields: ['schoolAddress', 'schoolContact', 'motto', 'validity', 'returnNote', 'signature', 'qr', 'barcode'],
  showPhoto: true,
  photoPosition: 'Left',
  photoStyle: 'Square',
  showQr: true,
  qrPosition: 'Bottom right',
  showBarcode: true,
  showSignature: true,
  signatureName: '',
  signatureTitle: 'Headteacher',
  backNote: 'If found, please return to the school address shown above.',
  cardNoPrefix: 'IDC',
  validityMonths: 12,
  printLayout: 'PVC Card',
  cardsPerRow: 2,
  sizePreset: ID_CARD_SIZE_PRESETS[0].label,
  fontFamily: 'sans',
  fontScale: 1,
  labelCase: 'Sentence case',
  frontBackground: '',
  backBackground: '',
  backgroundFit: 'Cover',
  backgroundOpacity: 1,
}

const text = (value: unknown) => String(value ?? '').trim()
const num = (value: unknown) => {
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}
const bool = (value: unknown, fallback: boolean) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === 'yes' || raw === 'true' || raw === 'on' || raw === '1'
}
/** Only inline images ever get stored — a stray URL is dropped, never fetched. */
const dataImage = (value: unknown) => {
  const raw = text(value)
  return raw.startsWith('data:image/') ? raw : ''
}

const listValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return [...new Set(value.map(text).filter(Boolean))]
  const raw = text(value)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map(text).filter(Boolean))]
  } catch { /* legacy comma list */ }
  return [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))]
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const readIdCardTemplate = (row: EduRow): IdCardTemplate => {
  const size = clampCardSize(num(row.widthMm), num(row.heightMm))
  return {
    id: text(row.id),
    name: text(row.name) || 'Untitled template',
    // Templates saved before holder types existed are student templates.
    holderType: isCardHolderType(row.holderType) ? (text(row.holderType) as CardHolderType) : DEFAULT_ID_CARD_TEMPLATE.holderType,
    status: text(row.status) || 'Active',
    orientation: text(row.orientation) === 'Portrait' ? 'Portrait' : 'Landscape',
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    backgroundColor: text(row.backgroundColor) || DEFAULT_ID_CARD_TEMPLATE.backgroundColor,
    headerColor: text(row.headerColor) || DEFAULT_ID_CARD_TEMPLATE.headerColor,
    textColor: text(row.textColor) || DEFAULT_ID_CARD_TEMPLATE.textColor,
    accentColor: text(row.accentColor) || DEFAULT_ID_CARD_TEMPLATE.accentColor,
    showLogo: bool(row.showLogo, DEFAULT_ID_CARD_TEMPLATE.showLogo),
    schoolName: text(row.schoolName),
    address: text(row.address),
    contact: text(row.contact),
    motto: text(row.motto),
    frontFields: listValues(row.frontFields).length ? listValues(row.frontFields) : DEFAULT_ID_CARD_TEMPLATE.frontFields,
    backFields: listValues(row.backFields).length ? listValues(row.backFields) : DEFAULT_ID_CARD_TEMPLATE.backFields,
    showPhoto: bool(row.showPhoto, DEFAULT_ID_CARD_TEMPLATE.showPhoto),
    photoPosition: (ID_CARD_PHOTO_POSITIONS as readonly string[]).includes(text(row.photoPosition))
      ? (text(row.photoPosition) as IdCardPhotoPosition)
      : DEFAULT_ID_CARD_TEMPLATE.photoPosition,
    photoStyle: text(row.photoStyle) === 'Circle' ? 'Circle' : 'Square',
    showQr: bool(row.showQr, DEFAULT_ID_CARD_TEMPLATE.showQr),
    qrPosition: (ID_CARD_QR_POSITIONS as readonly string[]).includes(text(row.qrPosition))
      ? (text(row.qrPosition) as IdCardQrPosition)
      : DEFAULT_ID_CARD_TEMPLATE.qrPosition,
    showBarcode: bool(row.showBarcode, DEFAULT_ID_CARD_TEMPLATE.showBarcode),
    showSignature: bool(row.showSignature, DEFAULT_ID_CARD_TEMPLATE.showSignature),
    signatureName: text(row.signatureName),
    signatureTitle: text(row.signatureTitle) || DEFAULT_ID_CARD_TEMPLATE.signatureTitle,
    backNote: text(row.backNote) || DEFAULT_ID_CARD_TEMPLATE.backNote,
    cardNoPrefix: text(row.cardNoPrefix) || DEFAULT_ID_CARD_TEMPLATE.cardNoPrefix,
    validityMonths: clamp(Math.round(num(row.validityMonths)) || DEFAULT_ID_CARD_TEMPLATE.validityMonths, 1, 120),
    printLayout: text(row.printLayout) === 'A4 Sheet' ? 'A4 Sheet' : 'PVC Card',
    cardsPerRow: clamp(Math.round(num(row.cardsPerRow)) || DEFAULT_ID_CARD_TEMPLATE.cardsPerRow, 1, 4),
    // Older templates have no preset recorded — derive it from the stored size.
    sizePreset: text(row.sizePreset) || sizePresetLabel(size.widthMm, size.heightMm),
    fontFamily: ID_CARD_FONT_FAMILIES.some((font) => font.id === text(row.fontFamily))
      ? text(row.fontFamily)
      : DEFAULT_ID_CARD_TEMPLATE.fontFamily,
    fontScale: ID_CARD_FONT_SCALES.some((option) => option.value === num(row.fontScale))
      ? num(row.fontScale)
      : DEFAULT_ID_CARD_TEMPLATE.fontScale,
    labelCase: (ID_CARD_LABEL_CASES as readonly string[]).includes(text(row.labelCase))
      ? text(row.labelCase)
      : DEFAULT_ID_CARD_TEMPLATE.labelCase,
    frontBackground: dataImage(row.frontBackground),
    backBackground: dataImage(row.backBackground),
    backgroundFit: (ID_CARD_BACKGROUND_FITS as readonly { id: string }[]).some((fit) => fit.id === text(row.backgroundFit))
      ? text(row.backgroundFit)
      : DEFAULT_ID_CARD_TEMPLATE.backgroundFit,
    backgroundOpacity: clamp(num(row.backgroundOpacity) || DEFAULT_ID_CARD_TEMPLATE.backgroundOpacity, 0.05, 1),
  }
}

/** Flattens a template back into a storable record row (all values as strings). */
export const idCardTemplateRow = (template: IdCardTemplate): EduRow => ({
  id: template.id,
  name: template.name,
  holderType: template.holderType,
  status: template.status,
  orientation: template.orientation,
  widthMm: String(template.widthMm),
  heightMm: String(template.heightMm),
  backgroundColor: template.backgroundColor,
  headerColor: template.headerColor,
  textColor: template.textColor,
  accentColor: template.accentColor,
  showLogo: template.showLogo ? 'Yes' : 'No',
  schoolName: template.schoolName,
  address: template.address,
  contact: template.contact,
  motto: template.motto,
  frontFields: JSON.stringify(template.frontFields),
  backFields: JSON.stringify(template.backFields),
  showPhoto: template.showPhoto ? 'Yes' : 'No',
  photoPosition: template.photoPosition,
  photoStyle: template.photoStyle,
  showQr: template.showQr ? 'Yes' : 'No',
  qrPosition: template.qrPosition,
  showBarcode: template.showBarcode ? 'Yes' : 'No',
  showSignature: template.showSignature ? 'Yes' : 'No',
  signatureName: template.signatureName,
  signatureTitle: template.signatureTitle,
  backNote: template.backNote,
  cardNoPrefix: template.cardNoPrefix,
  validityMonths: String(template.validityMonths),
  printLayout: template.printLayout,
  cardsPerRow: String(template.cardsPerRow),
  sizePreset: template.sizePreset,
  fontFamily: template.fontFamily,
  fontScale: String(template.fontScale),
  labelCase: template.labelCase,
  frontBackground: template.frontBackground,
  backBackground: template.backBackground,
  backgroundFit: template.backgroundFit,
  backgroundOpacity: String(template.backgroundOpacity),
})

export const idCardTemplates = (records: EduRecords): IdCardTemplate[] =>
  (records.idCardTemplates ?? []).map(readIdCardTemplate)

export const activeIdCardTemplates = (records: EduRecords) =>
  idCardTemplates(records).filter((template) => template.status !== 'Inactive')

export const templateById = (records: EduRecords, id: string) =>
  idCardTemplates(records).find((template) => template.id === id)

/* ------------------------------------------------------------------ cards */

export type IdCard = {
  id: string
  cardNo: string
  holderType: CardHolderType
  holderId: string
  /** Kept for cards generated before Card Management became universal. */
  studentId: string
  student: string
  /** The person's name, whatever kind of holder they are. */
  holder: string
  admissionNo: string
  employeeNo: string
  membershipNo: string
  className: string
  section: string
  house: string
  department: string
  designation: string
  plan: string
  joinDate: string
  gender: string
  dateOfBirth: string
  academicYear: string
  photo: string
  rollNo: string
  guardian: string
  phone: string
  templateId: string
  templateName: string
  status: IdCardStatus
  issueDate: string
  expiryDate: string
  issuedBy: string
  printCount: number
  lastPrintedAt: string
  previousCardNo: string
  replacementReason: string
  replacementDate: string
  remarks: string
}

/** Reads one stored card row into the typed shape the screens work with. */
export const readIdCard = (row: EduRow): IdCard => ({
    id: text(row.id),
    cardNo: text(row.cardNo),
    holderType: isCardHolderType(row.holderType) ? (text(row.holderType) as CardHolderType) : 'Student',
    holderId: text(row.holderId),
    studentId: text(row.studentId),
    student: text(row.student),
    holder: text(row.holder) || text(row.student),
    admissionNo: text(row.admissionNo),
    employeeNo: text(row.employeeNo),
    membershipNo: text(row.membershipNo),
    className: text(row.className),
    section: text(row.section),
    house: text(row.house),
    department: text(row.department),
    designation: text(row.designation),
    plan: text(row.plan),
    joinDate: text(row.joinDate),
    gender: text(row.gender),
    dateOfBirth: text(row.dateOfBirth),
    academicYear: text(row.academicYear),
    photo: text(row.photo),
    rollNo: text(row.rollNo),
    guardian: text(row.guardian),
    phone: text(row.phone),
    templateId: text(row.templateId),
    templateName: text(row.templateName),
    status: (ID_CARD_STATUSES.includes(text(row.status) as IdCardStatus) ? text(row.status) : 'Generated') as IdCardStatus,
    issueDate: text(row.issueDate),
    expiryDate: text(row.expiryDate),
    issuedBy: text(row.issuedBy),
    printCount: num(row.printCount),
    lastPrintedAt: text(row.lastPrintedAt),
    previousCardNo: text(row.previousCardNo),
    replacementReason: text(row.replacementReason),
    replacementDate: text(row.replacementDate),
    remarks: text(row.remarks),
  })

export const idCards = (records: EduRecords): IdCard[] => (records.idCards ?? []).map(readIdCard)

/* --------------------------------------------------------------- students */

export type IdCardStudent = {
  id: string
  name: string
  admissionNo: string
  className: string
  rollNo: string
  section: string
  house: string
  gender: string
  dateOfBirth: string
  guardian: string
  phone: string
  photo: string
  status: string
}

/** Students enriched with the registration record's photo, gender, DOB, section and house. */
export function idCardStudents(records: EduRecords): IdCardStudent[] {
  const registrations = records.studentRegistration ?? []
  const byAdmission = new Map<string, EduRow>()
  const byName = new Map<string, EduRow>()
  for (const row of registrations) {
    const admission = text(row.admissionNo).toLowerCase()
    if (admission) byAdmission.set(admission, row)
    const name = text(row.name).toLowerCase()
    if (name && !byName.has(name)) byName.set(name, row)
  }
  return (records.studentList ?? [])
    .filter((row) => text(row.status) !== 'Inactive')
    .map((row) => {
      const name = text(row.name)
      const admission = text(row.admissionNo).toLowerCase()
      const extra = (admission ? byAdmission.get(admission) : undefined) ?? byName.get(name.toLowerCase())
      return {
        id: text(row.id),
        name,
        admissionNo: text(row.admissionNo) || text(extra?.admissionNo),
        className: text(row.className) || text(extra?.className),
        rollNo: text(row.rollNo) || text(extra?.rollNo),
        section: text(extra?.section),
        house: text(extra?.house),
        gender: text(extra?.gender),
        dateOfBirth: text(extra?.dateOfBirth),
        guardian: text(row.guardian) || text(extra?.guardian),
        phone: text(row.phone) || text(extra?.phone),
        photo: text(extra?.photo),
        status: text(row.status) || 'Active',
      }
    })
    .filter((student) => student.name)
    .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name))
}

export const idCardClassNames = (students: IdCardStudent[]) =>
  [...new Set(students.map((student) => student.className).filter(Boolean))].sort((a, b) => a.localeCompare(b))
export const idCardSections = (students: IdCardStudent[]) =>
  [...new Set(students.map((student) => student.section).filter(Boolean))].sort((a, b) => a.localeCompare(b))
export const idCardHouses = (students: IdCardStudent[]) =>
  [...new Set(students.map((student) => student.house).filter(Boolean))].sort((a, b) => a.localeCompare(b))

/* ------------------------------------------------------------- numbering */

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const nowTime = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const addMonths = (iso: string, months: number) => {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

export const currentAcademicYear = (records: EduRecords) => {
  const sessions = records.academicSessions ?? []
  const active = sessions.find((row) => text(row.status) === 'Active')
  return text(active?.name) || text(sessions[0]?.name) || text((records.academicYear ?? [])[0]?.name) || String(new Date().getFullYear())
}

/** Sequential, collision-free card number: PREFIX-YYYY-0001. */
export function nextCardNumber(records: EduRecords, template: Pick<IdCardTemplate, 'cardNoPrefix'>, academicYear: string) {
  const prefix = (template.cardNoPrefix || DEFAULT_ID_CARD_TEMPLATE.cardNoPrefix).toUpperCase()
  // "2026/2027" → 2026, so numbers read IDC-2026-0001 rather than IDC-20262027-0001.
  const year = (text(academicYear).match(/\d{4}/)?.[0]) || String(new Date().getFullYear())
  const used = new Set((records.idCards ?? []).map((row) => text(row.cardNo).toUpperCase()))
  const history = new Set((records.idCardHistory ?? []).map((row) => text(row.cardNo).toUpperCase()))
  for (let sequence = 1; sequence <= 99999; sequence += 1) {
    const candidate = `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
    if (!used.has(candidate) && !history.has(candidate)) return candidate
  }
  return `${prefix}-${year}-${Date.now().toString().slice(-6)}`
}

/** The payload encoded into the QR code and the barcode. */
export const idCardQrPayload = (card: Pick<IdCard, 'cardNo'>) => `IDC:${text(card.cardNo)}`

/** Accepts a raw card number or a scanned "IDC:…" payload. */
export const parseScannedCard = (value: string) => {
  const raw = text(value)
  if (!raw) return ''
  const match = raw.match(/IDC:([^\s|]+)/i)
  return (match ? match[1] : raw).toUpperCase()
}

/* ------------------------------------------------------------ generation */

export type GeneratedCard = { card: EduRow; history: EduRow }

/**
 * Builds card rows (and their "Generated" history entries) for the given
 * holders — students, staff or members. Anyone who already holds a valid card
 * is skipped unless `regenerate` is set.
 */
export function generateCards(
  records: EduRecords,
  options: {
    template: IdCardTemplate
    holders: CardHolder[]
    academicYear: string
    officer: string
    regenerate?: boolean
    makeId: () => string
  },
): { cards: EduRow[]; history: EduRow[]; skipped: string[] } {
  const { template, holders, academicYear, officer, regenerate = false, makeId } = options
  const existing = idCards(records)
  const held = new Set(
    existing
      .filter((card) => !ID_CARD_INACTIVE_STATUSES.includes(card.status))
      .map((card) => (card.holderId || card.studentId || card.holder || card.student).toLowerCase()),
  )
  const cards: EduRow[] = []
  const history: EduRow[] = []
  const skipped: string[] = []
  let working: EduRecords = records
  const today = todayIso()
  for (const holder of holders) {
    const key = (holder.id || holder.name).toLowerCase()
    if (!regenerate && held.has(key)) { skipped.push(holder.name); continue }
    const cardNo = nextCardNumber(working, template, academicYear)
    const card: EduRow = {
      id: makeId(),
      cardNo,
      ...holderCardValues(holder),
      holderId: holder.id,
      academicYear,
      templateId: template.id,
      templateName: template.name,
      status: 'Generated',
      issueDate: '',
      expiryDate: addMonths(today, template.validityMonths),
      issuedBy: '',
      printCount: '0',
      lastPrintedAt: '',
      previousCardNo: '',
      replacementReason: '',
      replacementDate: '',
      remarks: '',
    }
    cards.push(card)
    history.push(historyRow(makeId(), {
      cardNo,
      student: holder.name,
      action: 'Generated',
      fromStatus: '',
      toStatus: 'Generated',
      officer,
      reason: `Bulk generation · ${template.name}`,
    }))
    held.add(key)
    working = { ...working, idCards: [...(working.idCards ?? []), card] }
  }
  return { cards, history, skipped }
}

/** Replaces a lost / damaged card: the old one is deactivated, a new one is generated. */
export function replaceCard(
  records: EduRecords,
  options: {
    card: IdCard
    template: IdCardTemplate
    academicYear: string
    officer: string
    reason: string
    date: string
    makeId: () => string
  },
): { updated: EduRow; created: EduRow; history: EduRow[] } {
  const { card, template, academicYear, officer, reason, date, makeId } = options
  const cardNo = nextCardNumber(records, template, academicYear)
  const updated: EduRow = {
    ...(records.idCards ?? []).find((row) => text(row.id) === card.id),
    id: card.id,
    cardNo: card.cardNo,
    status: 'Replaced',
    replacementReason: reason,
    replacementDate: date,
    remarks: [card.remarks, `Replaced by ${cardNo} on ${date}`].filter(Boolean).join(' · '),
  }
  const created: EduRow = {
    id: makeId(),
    cardNo,
    studentId: card.studentId,
    student: card.student,
    admissionNo: card.admissionNo,
    className: card.className,
    section: card.section,
    house: card.house,
    gender: card.gender,
    dateOfBirth: card.dateOfBirth,
    academicYear: academicYear || card.academicYear,
    photo: card.photo,
    rollNo: card.rollNo,
    guardian: card.guardian,
    phone: card.phone,
    templateId: template.id,
    templateName: template.name,
    status: 'Generated',
    issueDate: '',
    expiryDate: addMonths(date, template.validityMonths),
    issuedBy: '',
    printCount: '0',
    lastPrintedAt: '',
    previousCardNo: card.cardNo,
    replacementReason: '',
    replacementDate: '',
    remarks: reason ? `Replacement for ${card.cardNo} · ${reason}` : `Replacement for ${card.cardNo}`,
  }
  const history = [
    historyRow(makeId(), {
      cardNo: card.cardNo,
      student: card.student,
      action: 'Replaced',
      fromStatus: card.status,
      toStatus: 'Replaced',
      officer,
      reason,
      date,
    }),
    historyRow(makeId(), {
      cardNo,
      student: card.student,
      action: 'Generated',
      fromStatus: '',
      toStatus: 'Generated',
      officer,
      reason: `Replacement card for ${card.cardNo}${reason ? ` · ${reason}` : ''}`,
      date,
    }),
  ]
  return { updated, created, history }
}

/* --------------------------------------------------------------- history */

export function historyRow(id: string, values: {
  cardNo: string
  student: string
  action: string
  fromStatus?: string
  toStatus?: string
  officer?: string
  reason?: string
  date?: string
}): EduRow {
  return {
    id,
    date: values.date ?? todayIso(),
    time: nowTime(),
    cardNo: values.cardNo,
    student: values.student,
    action: values.action,
    fromStatus: values.fromStatus ?? '',
    toStatus: values.toStatus ?? '',
    officer: values.officer ?? '',
    reason: values.reason ?? '',
  }
}

export const idCardHistory = (records: EduRecords) =>
  [...(records.idCardHistory ?? [])]
    .map((row) => ({
      id: text(row.id),
      date: text(row.date),
      time: text(row.time),
      cardNo: text(row.cardNo),
      student: text(row.student),
      action: text(row.action),
      fromStatus: text(row.fromStatus),
      toStatus: text(row.toStatus),
      officer: text(row.officer),
      reason: text(row.reason),
    }))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))

export const historyForCard = (records: EduRecords, cardNo: string) =>
  idCardHistory(records).filter((row) => row.cardNo.toUpperCase() === cardNo.toUpperCase())

/** Print history for a card — every "Printed" entry, newest first. */
export const printHistoryForCard = (records: EduRecords, cardNo: string) =>
  historyForCard(records, cardNo).filter((row) => row.action === 'Printed')

/* ------------------------------------------------------------ expiration */

/** Cards whose validity has lapsed — reported and auto-expired from the issuance page. */
export const expiredCardNos = (records: EduRecords, today = todayIso()) =>
  idCards(records)
    .filter((card) => card.expiryDate && card.expiryDate < today && card.status !== 'Expired' && card.status !== 'Replaced')
    .map((card) => card.cardNo)

/* ------------------------------------------------------------ permissions */

export type IdCardAccess = Record<IdCardPermissionKey, string[]>

export function readIdCardAccess(records: EduRecords): IdCardAccess {
  const row = (records.idCardSettings ?? [])[0] ?? {}
  const access = {} as IdCardAccess
  for (const permission of ID_CARD_PERMISSION_KEYS) {
    const roles = listValues(row[`perm_${permission}`])
    access[permission] = roles.length ? roles : [...DEFAULT_ID_CARD_PERMISSION_ROLES[permission]]
  }
  return access
}

export const idCardAccessRows = (access: IdCardAccess, settingsRow?: EduRow): EduRow => {
  const row: EduRow = { id: text(settingsRow?.id) || 'idcard-settings', ...(settingsRow ?? {}) }
  for (const permission of ID_CARD_PERMISSION_KEYS) row[`perm_${permission}`] = JSON.stringify(access[permission] ?? [])
  return row
}

/** True when the given role (id or name) may perform the action. */
export function canPerformIdCard(
  records: EduRecords,
  permission: IdCardPermissionKey,
  roleIds: string[],
): boolean {
  const roles = roleIds.map((role) => String(role ?? '').trim()).filter(Boolean)
  if (roles.some((role) => ID_CARD_ADMIN_ROLES.includes(role))) return true
  const allowed = readIdCardAccess(records)[permission] ?? []
  return roles.some((role) => allowed.some((entry) => entry.toLowerCase() === role.toLowerCase()))
}

/* ---------------------------------------------------------------- search */

export type IdCardSearchFilters = {
  query: string
  className: string
  status: string
  academicYear: string
}

export function searchIdCards(records: EduRecords, filters: IdCardSearchFilters): IdCard[] {
  const query = filters.query.trim().toLowerCase()
  return idCards(records).filter((card) => {
    if (filters.className && card.className !== filters.className) return false
    if (filters.status && card.status !== filters.status) return false
    if (filters.academicYear && card.academicYear !== filters.academicYear) return false
    if (!query) return true
    return [
      card.cardNo, card.student, card.admissionNo, card.className, card.section, card.house,
    ].some((value) => text(value).toLowerCase().includes(query))
  })
}

/** Verification: resolves a card number (or scanned payload) to card + student. */
export function verifyIdCard(records: EduRecords, value: string) {
  const cardNo = parseScannedCard(value)
  if (!cardNo) return { found: false as const, card: undefined, student: undefined, history: [] }
  const card = idCards(records).find((item) => item.cardNo.toUpperCase() === cardNo)
  if (!card) return { found: false as const, card: undefined, student: undefined, history: [], cardNo }
  const student = idCardStudents(records).find(
    (item) => (item.id && item.id === card.studentId) || item.name.toLowerCase() === card.student.toLowerCase(),
  )
  return {
    found: true as const,
    card,
    student,
    cardNo,
    history: historyForCard(records, card.cardNo),
    expired: card.expiryDate ? card.expiryDate < todayIso() : false,
  }
}

/* --------------------------------------------------------------- reports */

export type IdCardReportId =
  | 'generated' | 'printed' | 'issued' | 'active' | 'lost' | 'replaced' | 'classSummary' | 'expiring'

export type IdCardReportColumn = { key: string; label: string; numeric?: boolean }
export type IdCardReportRow = { id: string } & Record<string, string | number>
export type IdCardReport = {
  id: IdCardReportId
  label: string
  description: string
  columns: IdCardReportColumn[]
  rows: IdCardReportRow[]
  metrics: { label: string; value: string; hint?: string }[]
  emptyTitle: string
  emptyDescription: string
}

export const ID_CARD_REPORTS: { id: IdCardReportId; label: string; description: string }[] = [
  { id: 'generated', label: 'Generated Cards', description: 'Every card the system has generated, with template and date.' },
  { id: 'printed', label: 'Printed Cards', description: 'Cards that have been through a print run, with print counts.' },
  { id: 'issued', label: 'Issued Cards', description: 'Cards handed to students, with issue date and issuing officer.' },
  { id: 'active', label: 'Active Cards', description: 'Cards currently valid — issued or active and not expired.' },
  { id: 'lost', label: 'Lost Cards', description: 'Cards reported lost, and whether a replacement was issued.' },
  { id: 'replaced', label: 'Replaced Cards', description: 'Every replacement: old card, new card, reason and date.' },
  { id: 'classSummary', label: 'Class-wise Summary', description: 'Cards per class: generated, issued, active, lost and replaced.' },
  { id: 'expiring', label: 'Expiring Cards', description: 'Valid cards whose expiry date is near or already passed.' },
]

const metric = (label: string, value: string, hint?: string) => ({ label, value, hint })
const plural = (word: string) => (/(s|x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`)
const countLabel = (value: number, singular: string) =>
  `${value.toLocaleString()} ${value === 1 ? singular : plural(singular)}`
const historyDate = (records: EduRecords, cardNo: string, action: string, fallback = '') => {
  const entry = historyForCard(records, cardNo).find((row) => row.action === action)
  return entry?.date ?? fallback
}

export function buildIdCardReport(id: IdCardReportId, records: EduRecords, academicYear = ''): IdCardReport {
  const all = idCards(records).filter((card) => !academicYear || card.academicYear === academicYear)
  const today = todayIso()
  const base = ID_CARD_REPORTS.find((item) => item.id === id) ?? ID_CARD_REPORTS[0]

  if (id === 'classSummary') {
    const byClass = new Map<string, { generated: number; printed: number; issued: number; active: number; lost: number; replaced: number; expired: number }>()
    for (const card of all) {
      const key = card.className || 'Unassigned'
      const row = byClass.get(key) ?? { generated: 0, printed: 0, issued: 0, active: 0, lost: 0, replaced: 0, expired: 0 }
      row.generated += 1
      if (card.printCount > 0) row.printed += 1
      if (card.issueDate) row.issued += 1
      if (ID_CARD_VALID_STATUSES.includes(card.status) && !(card.expiryDate && card.expiryDate < today)) row.active += 1
      if (card.status === 'Lost') row.lost += 1
      if (card.status === 'Replaced') row.replaced += 1
      if (card.status === 'Expired' || (card.expiryDate && card.expiryDate < today)) row.expired += 1
      byClass.set(key, row)
    }
    const rows = [...byClass.entries()]
      .map(([className, row]) => ({ id: className, className, ...row, coverage: row.generated ? Math.round((row.issued / row.generated) * 100) : 0 }))
      .sort((a, b) => b.generated - a.generated)
    const issued = rows.reduce((sum, row) => sum + row.issued, 0)
    const generated = rows.reduce((sum, row) => sum + row.generated, 0)
    return {
      ...base,
      columns: [
        { key: 'className', label: 'Class' },
        { key: 'generated', label: 'Generated', numeric: true },
        { key: 'printed', label: 'Printed', numeric: true },
        { key: 'issued', label: 'Issued', numeric: true },
        { key: 'active', label: 'Active', numeric: true },
        { key: 'lost', label: 'Lost', numeric: true },
        { key: 'replaced', label: 'Replaced', numeric: true },
        { key: 'expired', label: 'Expired', numeric: true },
        { key: 'coverage', label: 'Issued %', numeric: true },
      ],
      rows: rows as IdCardReportRow[],
      metrics: [
        metric('Classes covered', countLabel(rows.length, 'class')),
        metric('Cards generated', countLabel(generated, 'card')),
        metric('Cards issued', countLabel(issued, 'card')),
        metric('Issue coverage', `${generated ? Math.round((issued / generated) * 100) : 0}%`),
      ],
      emptyTitle: 'No cards to summarise',
      emptyDescription: 'Generate ID cards to see the class-wise summary.',
    }
  }

  const rowsFor = (cards: IdCard[]): IdCardReportRow[] => cards.map((card) => ({
    id: card.id,
    cardNo: card.cardNo,
    student: card.student,
    admissionNo: card.admissionNo || '—',
    className: card.className || '—',
    section: card.section || '—',
    house: card.house || '—',
    academicYear: card.academicYear || '—',
    templateName: card.templateName || '—',
    status: card.status,
    issueDate: card.issueDate || '—',
    expiryDate: card.expiryDate || '—',
    issuedBy: card.issuedBy || '—',
    printCount: card.printCount,
    previousCardNo: card.previousCardNo || '—',
    replacementReason: card.replacementReason || '—',
    replacementDate: card.replacementDate || '—',
    generatedOn: historyDate(records, card.cardNo, 'Generated') || '—',
    lastPrintedAt: card.lastPrintedAt || '—',
  }))

  const withMetrics = (
    cards: IdCard[],
    columns: IdCardReportColumn[],
    metrics: IdCardReport['metrics'],
    emptyTitle: string,
    emptyDescription: string,
  ): IdCardReport => ({
    ...base,
    columns,
    rows: rowsFor(cards),
    metrics,
    emptyTitle,
    emptyDescription,
  })

  const commonColumns: IdCardReportColumn[] = [
    { key: 'cardNo', label: 'Card No' },
    { key: 'student', label: 'Student' },
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'className', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'house', label: 'House' },
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'status', label: 'Status' },
  ]

  switch (id) {
    case 'generated': {
      const cards = [...all].sort((a, b) => (historyDate(records, b.cardNo, 'Generated')).localeCompare(historyDate(records, a.cardNo, 'Generated')))
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'generatedOn', label: 'Generated on' },
        { key: 'templateName', label: 'Template' },
      ], [
        metric('Cards generated', countLabel(cards.length, 'card')),
        metric('This academic year', countLabel(cards.filter((card) => card.academicYear === currentAcademicYear(records)).length, 'card')),
        metric('Classes covered', countLabel(new Set(cards.map((card) => card.className).filter(Boolean)).size, 'class')),
        metric('Awaiting printing', countLabel(cards.filter((card) => card.printCount === 0).length, 'card')),
      ], 'No cards generated', 'Generate cards from student records to populate this report.')
    }
    case 'printed': {
      const cards = all.filter((card) => card.printCount > 0).sort((a, b) => b.printCount - a.printCount)
      const prints = cards.reduce((sum, card) => sum + card.printCount, 0)
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'printCount', label: 'Print runs', numeric: true },
        { key: 'lastPrintedAt', label: 'Last printed' },
      ], [
        metric('Cards printed', countLabel(cards.length, 'card')),
        metric('Print runs', countLabel(prints, 'print')),
        metric('Never printed', countLabel(all.filter((card) => card.printCount === 0).length, 'card')),
        metric('Average runs', cards.length ? (prints / cards.length).toFixed(1) : '0'),
      ], 'Nothing printed yet', 'Print a card to record a print run here.')
    }
    case 'issued': {
      const cards = all.filter((card) => Boolean(card.issueDate)).sort((a, b) => b.issueDate.localeCompare(a.issueDate))
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'issueDate', label: 'Issue date' },
        { key: 'issuedBy', label: 'Issuing officer' },
        { key: 'expiryDate', label: 'Expiry' },
      ], [
        metric('Cards issued', countLabel(cards.length, 'card')),
        metric('Outstanding', countLabel(all.filter((card) => !card.issueDate && !ID_CARD_INACTIVE_STATUSES.includes(card.status)).length, 'card')),
        metric('Officers involved', countLabel(new Set(cards.map((card) => card.issuedBy).filter(Boolean)).size, 'officer')),
        metric('Expiring soon', countLabel(cards.filter((card) => card.expiryDate && card.expiryDate >= today && card.expiryDate <= addMonths(today, 1)).length, 'card')),
      ], 'No cards issued yet', 'Record an issue date and officer on the Issuance page.')
    }
    case 'active': {
      const cards = all.filter((card) => ID_CARD_VALID_STATUSES.includes(card.status) && !(card.expiryDate && card.expiryDate < today))
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'issueDate', label: 'Issue date' },
        { key: 'expiryDate', label: 'Expiry' },
      ], [
        metric('Active cards', countLabel(cards.length, 'card')),
        metric('Coverage', `${all.length ? Math.round((cards.length / all.length) * 100) : 0}%`, 'Share of all generated cards'),
        metric('Classes covered', countLabel(new Set(cards.map((card) => card.className).filter(Boolean)).size, 'class')),
        metric('Expired', countLabel(all.filter((card) => card.status === 'Expired' || (card.expiryDate && card.expiryDate < today)).length, 'card')),
      ], 'No active cards', 'Issue cards to students to see them here.')
    }
    case 'lost': {
      const cards = all.filter((card) => card.status === 'Lost')
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'replacementReason', label: 'Reported reason' },
        { key: 'replacementDate', label: 'Reported on' },
      ], [
        metric('Lost cards', countLabel(cards.length, 'card')),
        metric('Replacement issued', countLabel(cards.filter((card) => Boolean(card.replacementDate)).length, 'card')),
        metric('Still outstanding', countLabel(cards.filter((card) => !card.replacementDate).length, 'card')),
        metric('Classes affected', countLabel(new Set(cards.map((card) => card.className).filter(Boolean)).size, 'class')),
      ], 'No lost cards reported', 'Cards reported lost from the Issuance page appear here.')
    }
    case 'replaced': {
      // The reason is recorded on the card that was retired, so look it up via previousCardNo.
      const byCardNo = new Map(all.map((card) => [card.cardNo.toUpperCase(), card]))
      const cards = all
        .filter((card) => card.status === 'Replaced' || Boolean(card.previousCardNo))
        .map((card) => (card.replacementReason ? card : { ...card, replacementReason: byCardNo.get(card.previousCardNo.toUpperCase())?.replacementReason ?? '' }))
        .sort((a, b) => b.replacementDate.localeCompare(a.replacementDate))
      return withMetrics(cards, [
        { key: 'cardNo', label: 'Old card' },
        { key: 'student', label: 'Student' },
        { key: 'admissionNo', label: 'Admission No' },
        { key: 'className', label: 'Class' },
        { key: 'status', label: 'Status' },
        { key: 'replacementReason', label: 'Reason' },
        { key: 'replacementDate', label: 'Replaced on' },
      ], [
        metric('Replacements', countLabel(cards.length, 'card')),
        metric('For loss', countLabel(cards.filter((card) => /lost/i.test(card.replacementReason)).length, 'card')),
        metric('For damage', countLabel(cards.filter((card) => /damag/i.test(card.replacementReason)).length, 'card')),
        metric('This academic year', countLabel(cards.filter((card) => card.academicYear === currentAcademicYear(records)).length, 'card')),
      ], 'No replacements yet', 'Replace a lost or damaged card to record it here.')
    }
    case 'expiring':
    default: {
      const cards = all
        .filter((card) => card.expiryDate && !ID_CARD_INACTIVE_STATUSES.includes(card.status))
        .filter((card) => card.expiryDate <= addMonths(today, 2))
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      return withMetrics(cards, [
        ...commonColumns,
        { key: 'expiryDate', label: 'Expiry' },
        { key: 'issuedBy', label: 'Issuing officer' },
      ], [
        metric('Expiring / expired', countLabel(cards.length, 'card')),
        metric('Already expired', countLabel(cards.filter((card) => card.expiryDate < today).length, 'card')),
        metric('Next 30 days', countLabel(cards.filter((card) => card.expiryDate >= today && card.expiryDate <= addMonths(today, 1)).length, 'card')),
        metric('Classes affected', countLabel(new Set(cards.map((card) => card.className).filter(Boolean)).size, 'class')),
      ], 'Nothing expiring', 'No card expires in the next two months.')
    }
  }
}

/** Rows shaped for the Excel / CSV exporters, keyed by the visible column labels. */
export const idCardExportRows = (report: IdCardReport): Record<string, unknown>[] =>
  report.rows.map((row) => {
    const next: Record<string, unknown> = {}
    for (const column of report.columns) next[column.label] = row[column.key]
    return next
  })

export const idCardReportFilename = (report: IdCardReport) =>
  `id-card-${String(report.id).replace(/([A-Z])/g, '-$1').toLowerCase()}-${todayIso()}`

/* ------------------------------------------------------------------ misc */

export const statusTone = (status: string): 'ok' | 'warn' | 'bad' | 'muted' => {
  const value = String(status).toLowerCase()
  if (value === 'active') return 'ok'
  if (value === 'issued' || value === 'printed') return 'ok'
  if (value === 'generated') return 'warn'
  if (value === 'lost' || value === 'damaged' || value === 'expired') return 'bad'
  return 'muted'
}

/** Field label lookup used by the card renderer. */
export const fieldLabel = (key: string) =>
  [...ID_CARD_FRONT_FIELDS, ...ID_CARD_BACK_FIELDS].find((field) => field.key === key)?.label
  ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())

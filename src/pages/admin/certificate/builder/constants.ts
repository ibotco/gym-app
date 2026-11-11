import { Database, ImageIcon, Shapes, Type } from 'lucide-react'
import type { CertPaletteGroup, CertPaletteItem } from './types'

export const GOOGLE_FONTS = ['Inter','Manrope','Sora','Montserrat','Playfair Display','Poppins','Roboto','Open Sans','Lato','Nunito']

export const CERT_GROUPS: { key: CertPaletteGroup; label: string }[] = [
  { key: 'database', label: 'Database Source' },
  { key: 'textbase', label: 'Textbase Source' },
  { key: 'media', label: 'Media & Graphics' },
  { key: 'shapes', label: 'Shapes & Frames' },
]

export const CERT_GROUP_ICONS: Record<CertPaletteGroup, any> = {
  database: Database,
  textbase: Type,
  media: ImageIcon,
  shapes: Shapes,
}

export const DB_VARIABLE_SOURCES = ['Student List', 'Employee List', 'Member List', 'Course List', 'Custom'] as const

export const DB_SOURCE_FIELDS: Record<string, string[]> = {
  'Student List': ['Student Name', 'Admission No', 'Roll Number', 'Class', 'Section', 'Parent Name', 'Guardian Name', 'Date of Birth', 'Gender', 'Address', 'Phone', 'Email', 'Course / Exam'],
  'Employee List': ['Employee Name', 'Employee ID', 'Department', 'Designation', 'Date of Joining', 'Phone', 'Email', 'Address'],
  'Member List': ['Member Name', 'Membership No', 'Membership Type', 'Joining Date', 'Phone', 'Email'],
  'Course List': ['Course / Exam', 'Course Code', 'Batch Name', 'Instructor', 'Duration', 'Batch Year'],
  'Custom': [],
}

export const CERT_PALETTE: CertPaletteItem[] = [
  { type: 'heading', label: 'Heading', defaultContent: 'Certificate of Achievement', group: 'textbase' },
  { type: 'text', label: 'Text', defaultContent: 'This is to certify that', group: 'textbase' },
  { type: 'student_name', label: 'Student Name', defaultContent: 'Ama Owusu', group: 'database' },
  { type: 'text', label: 'Employee Name', defaultContent: 'Kwame Mensah', group: 'database' },
  { type: 'text', label: 'Member Name', defaultContent: 'Abena Osei', group: 'database' },
  { type: 'text', label: 'Holder Name', defaultContent: '{holder_name}', group: 'database' },
  { type: 'course', label: 'Course / Exam', defaultContent: 'First Term Examination', group: 'database' },
  { type: 'text', label: 'Department', defaultContent: 'Human Resources', group: 'database' },
  { type: 'text', label: 'Designation', defaultContent: 'Senior Manager', group: 'database' },
  { type: 'text', label: 'Admission No', defaultContent: 'ADM-2024-001', group: 'database' },
  { type: 'text', label: 'Employee ID', defaultContent: 'EMP-2024-045', group: 'database' },
  { type: 'text', label: 'Membership No', defaultContent: 'MBR-2024-012', group: 'database' },
  { type: 'text', label: 'Certificate No', defaultContent: 'CERT-2024-0001', group: 'database' },
  { type: 'date', label: 'Issue Date', defaultContent: 'Issue Date: 2024-05-15', group: 'database' },
  { type: 'date', label: 'Expiry Date', defaultContent: 'Expiry Date: 2025-05-15', group: 'database' },
  { type: 'date', label: 'Date', defaultContent: 'Date: 2024-05-15', group: 'database' },
  { type: 'signature', label: 'Signature', defaultContent: 'Principal', group: 'textbase' },
  { type: 'signature_line', label: 'Signature Line', defaultContent: 'Authorised Signature', group: 'shapes' },
  { type: 'seal', label: 'Seal / Stamp', defaultContent: 'OFFICIAL SEAL', group: 'media' },
  { type: 'subject_table', label: 'Subject Grade Table', defaultContent: 'English, Mathematics, Science, Social Studies', group: 'database' },
  { type: 'text', label: 'Organization', defaultContent: 'FitPro Academy', group: 'textbase' },
  { type: 'logo', label: 'Logo', defaultContent: '', group: 'media' },
  { type: 'image', label: 'Image', defaultContent: '', group: 'media' },
  { type: 'badge', label: 'Badge', defaultContent: '', group: 'media' },
  { type: 'line', label: 'Line', defaultContent: '', group: 'shapes' },
  { type: 'rectangle', label: 'Rectangle', defaultContent: '', group: 'shapes' },
  { type: 'square', label: 'Square', defaultContent: '', group: 'shapes' },
  { type: 'circle', label: 'Circle', defaultContent: '', group: 'shapes' },
  { type: 'border', label: 'Border Frame', defaultContent: '', group: 'shapes' },
]

export const isDatabaseElement = (el: { type: string; group?: string; content: string; source?: string }) => {
  if ((el as any).group === 'database') return true
  if (el.source) return true
  if (['student_name','course','date','subject_table'].includes(el.type as string)) return true
  if (el.content && (el.content.includes('{{') || (el.content.includes('{') && el.content.includes('}')))) return true
  const dbDefaults = ['Ama Owusu','Kwame Mensah','Abena Osei','First Term Examination','Human Resources','Senior Manager','ADM-2024-001','EMP-2024-045','MBR-2024-012','CERT-2024-0001']
  if (dbDefaults.includes(el.content)) return true
  if (el.content && (el.content.startsWith('Issue Date:') || el.content.startsWith('Expiry Date:') || el.content.startsWith('Date:'))) return true
  return false
}

// Certificate Management — shared element model, palette and defaults.
// Owned by pages/admin/certificate so the Certificate menu carries its own files.
// @ts-nocheck

export type CertElementType = 'logo' | 'image' | 'badge' | 'heading' | 'text' | 'student_name' | 'course' | 'date' | 'signature' | 'rectangle' | 'circle' | 'border' | 'line'
export type CertElement = {
  id: string
  type: CertElementType
  x: number
  y: number
  w: number
  h: number
  content: string
  style: {
    fontFamily: string
    fontSize: number
    color: string
    textAlign: 'left' | 'center' | 'right'
    fontWeight: string
    fontStyle: string
    backgroundColor?: string
    borderWidth?: number
    borderColor?: string
    borderRadius?: number
  }
}
export const GOOGLE_FONTS = ['Inter','Manrope','Sora','Montserrat','Playfair Display','Poppins','Roboto','Open Sans','Lato','Nunito']
export const CERT_PALETTE: { type: CertElementType; label: string; defaultContent: string }[] = [
  { type: 'heading', label: 'Heading', defaultContent: 'Certificate of Achievement' },
  { type: 'text', label: 'Text', defaultContent: 'This is to certify that' },
  { type: 'student_name', label: 'Student Name', defaultContent: 'Ama Owusu' },
  { type: 'text', label: 'Employee Name', defaultContent: 'Kwame Mensah' },
  { type: 'text', label: 'Member Name', defaultContent: 'Abena Osei' },
  { type: 'text', label: 'Holder Name', defaultContent: '{holder_name}' },
  { type: 'course', label: 'Course / Exam', defaultContent: 'First Term Examination' },
  { type: 'text', label: 'Department', defaultContent: 'Human Resources' },
  { type: 'text', label: 'Designation', defaultContent: 'Senior Manager' },
  { type: 'text', label: 'Admission No', defaultContent: 'ADM-2024-001' },
  { type: 'text', label: 'Employee ID', defaultContent: 'EMP-2024-045' },
  { type: 'text', label: 'Membership No', defaultContent: 'MBR-2024-012' },
  { type: 'text', label: 'Certificate No', defaultContent: 'CERT-2024-0001' },
  { type: 'date', label: 'Issue Date', defaultContent: 'Issue Date: 2024-05-15' },
  { type: 'date', label: 'Expiry Date', defaultContent: 'Expiry Date: 2025-05-15' },
  { type: 'date', label: 'Date', defaultContent: 'Date: 2024-05-15' },
  { type: 'signature', label: 'Signature', defaultContent: 'Principal' },
  { type: 'text', label: 'Organization', defaultContent: 'FitPro Academy' },
  { type: 'logo', label: 'Logo', defaultContent: '' },
  { type: 'image', label: 'Image', defaultContent: '' },
  { type: 'badge', label: 'Badge', defaultContent: '' },
  { type: 'line', label: 'Line', defaultContent: '' },
  { type: 'rectangle', label: 'Rectangle', defaultContent: '' },
  { type: 'circle', label: 'Circle', defaultContent: '' },
  { type: 'border', label: 'Border Frame', defaultContent: '' },
]



export const getDefaultCertificateElements = (paperW: number, paperH: number, marginPx: number = 57): CertElement[] => {
  const uid = () => Math.random().toString(36).slice(2,9)
  const innerW = Math.max(100, paperW - marginPx*2)
  const innerH = Math.max(100, paperH - marginPx*2)
  const centerX = (w: number) => innerW/2 - w/2
  // More visible: larger fonts, bolder, higher contrast, bigger spacing
  const contentHeight = 420
  const startY = Math.max(24, (innerH - contentHeight)/2 - 30)
  return [
    {
      id: uid(),
      type: 'logo',
      content: '',
      x: centerX(100),
      y: startY,
      w: 100,
      h: 56,
      style: { fontFamily: 'Poppins', fontSize: 13, color: '#4a5568', textAlign: 'center', fontWeight: '600', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'heading',
      content: 'Certificate of Achievement',
      x: centerX(460),
      y: startY + 72,
      w: 460,
      h: 40,
      style: { fontFamily: 'Playfair Display', fontSize: 28, color: '#0f2a4d', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(400),
      y: startY + 124,
      w: 400,
      h: 4,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#b7791f', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#b7791f' }
    },
    {
      id: uid(),
      type: 'text',
      content: 'This is to certify that',
      x: centerX(360),
      y: startY + 142,
      w: 360,
      h: 22,
      style: { fontFamily: 'Inter', fontSize: 15, color: '#2d3748', textAlign: 'center', fontWeight: '500', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'student_name',
      content: 'Ama Owusu',
      x: centerX(360),
      y: startY + 170,
      w: 360,
      h: 36,
      style: { fontFamily: 'Poppins', fontSize: 26, color: '#b7791f', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(320),
      y: startY + 216,
      w: 320,
      h: 3,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#b7791f', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#b7791f' }
    },
    {
      id: uid(),
      type: 'text',
      content: 'has successfully completed the course with distinction',
      x: centerX(480),
      y: startY + 236,
      w: 480,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 13, color: '#2d3748', textAlign: 'center', fontWeight: '500', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'course',
      content: 'First Term Examination',
      x: centerX(400),
      y: startY + 268,
      w: 400,
      h: 28,
      style: { fontFamily: 'Poppins', fontSize: 18, color: '#0f172a', textAlign: 'center', fontWeight: '800', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      x: centerX(420),
      y: startY + 310,
      w: 420,
      h: 2,
      style: { fontFamily: 'Poppins', fontSize: 16, color: '#1e293b', textAlign: 'center', fontWeight: '700', fontStyle: 'normal', backgroundColor: '#1e293b' }
    },
    {
      id: uid(),
      type: 'date',
      content: 'Date: 2024-05-15',
      x: 32,
      y: innerH - 72,
      w: 220,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 12, color: '#334155', textAlign: 'left', fontWeight: '600', fontStyle: 'normal' }
    },
    {
      id: uid(),
      type: 'signature',
      content: 'Principal',
      x: innerW - 220 - 32,
      y: innerH - 72,
      w: 220,
      h: 20,
      style: { fontFamily: 'Inter', fontSize: 12, color: '#1e293b', textAlign: 'right', fontWeight: '700', fontStyle: 'normal' }
    },
  ]
}



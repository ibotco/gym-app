import type { CertElement } from './types'

export const getDefaultCertificateElements = (paperW: number, paperH: number, marginPx: number = 57): CertElement[] => {
  const uid = () => Math.random().toString(36).slice(2,9)
  const innerW = Math.max(100, paperW - marginPx*2)
  const innerH = Math.max(100, paperH - marginPx*2)
  const centerX = (w: number) => innerW/2 - w/2
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

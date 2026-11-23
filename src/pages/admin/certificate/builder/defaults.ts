import type { CertElement } from './types'

const CREST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="54" fill="#FFFBEB" stroke="#C69214" stroke-width="3"/>
  <circle cx="60" cy="60" r="47" stroke="#D4AF37" stroke-width="1.5" stroke-dasharray="3 3"/>
  <path d="M60 22L86 33V58C86 76.5 74.8 91.8 60 98C45.2 91.8 34 76.5 34 58V33L60 22Z" fill="#0F2A4D" stroke="#D4AF37" stroke-width="2.5"/>
  <path d="M60 31L78 39V57C78 70.5 70.3 82 60 87C49.7 82 42 70.5 42 57V39L60 31Z" fill="#173B6C" stroke="#FDE68A" stroke-width="1"/>
  <polygon points="60,41 64.2,50.2 74.2,51.4 66.8,58.3 68.8,68.2 60,63.3 51.2,68.2 53.2,58.3 45.8,51.4 55.8,50.2" fill="#FBBF24"/>
</svg>`

const SEAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="60" r="52" fill="#FEF3C7" stroke="#B45309" stroke-width="3"/>
  <circle cx="60" cy="60" r="44" fill="#FFFBEB" stroke="#D97706" stroke-width="1.5"/>
  <circle cx="60" cy="60" r="35" stroke="#B45309" stroke-width="1" stroke-dasharray="2.5 2.5"/>
  <polygon points="60,36 65,48 78,49 68,57 71,70 60,63 49,70 52,57 42,49 55,48" fill="#D97706"/>
  <text x="60" y="85" text-anchor="middle" font-family="Georgia, serif" font-size="8.5" font-weight="700" fill="#78350F" letter-spacing="1.4">OFFICIAL SEAL</text>
</svg>`

export const DEFAULT_CERTIFICATE_CREST_URI = `data:image/svg+xml;utf8,${encodeURIComponent(CREST_SVG)}`
export const DEFAULT_CERTIFICATE_SEAL_URI = `data:image/svg+xml;utf8,${encodeURIComponent(SEAL_SVG)}`

export const getDefaultCertificateElements = (
  paperW: number,
  paperH: number,
  marginPx: number = 57,
  institutionName?: string,
): CertElement[] => {
  const uid = () => Math.random().toString(36).slice(2, 9)
  const innerW = Math.max(280, paperW - marginPx * 2)
  const innerH = Math.max(320, paperH - marginPx * 2)
  const isLandscape = innerW > innerH
  const centerX = (w: number) => Math.round((innerW - w) / 2)

  const sideInset = Math.round(Math.max(40, innerW * 0.08))
  const usableW = Math.max(220, innerW - sideInset * 2)
  const clampW = (target: number) => Math.min(target, usableW)

  const crestSize = isLandscape ? 64 : 76
  const sealSize = isLandscape ? 68 : 76
  const colW = Math.min(190, Math.floor((usableW - sealSize - 32) / 2))

  // Balanced vertical rhythm across both Portrait and Landscape pages
  const crestY = Math.round(innerH * (isLandscape ? 0.055 : 0.065))
  const orgY = Math.round(innerH * (isLandscape ? 0.175 : 0.162))
  const titleY = Math.round(innerH * (isLandscape ? 0.225 : 0.212))
  const topRuleY = Math.round(innerH * (isLandscape ? 0.305 : 0.278))
  const preambleY = Math.round(innerH * (isLandscape ? 0.34 : 0.322))
  const recipientY = Math.round(innerH * (isLandscape ? 0.395 : 0.372))
  const nameRuleY = Math.round(innerH * (isLandscape ? 0.478 : 0.438))
  const citationY = Math.round(innerH * (isLandscape ? 0.515 : 0.478))
  const courseY = Math.round(innerH * (isLandscape ? 0.575 : 0.534))
  const sessionY = Math.round(innerH * (isLandscape ? 0.64 : 0.592))
  const footerLineY = Math.round(innerH * (isLandscape ? 0.825 : 0.805))

  const orgTitle = (institutionName || 'Springfield International Academy').trim().toUpperCase()
  const titleW = clampW(540)
  const preambleW = clampW(400)
  const recipientW = clampW(460)
  const citationW = clampW(520)
  const courseW = clampW(460)
  const sessionW = clampW(320)
  const orgW = clampW(520)

  const leftColX = sideInset
  const rightColX = innerW - sideInset - colW

  return [
    {
      id: uid(),
      type: 'logo',
      content: DEFAULT_CERTIFICATE_CREST_URI,
      group: 'media',
      x: centerX(crestSize),
      y: crestY,
      w: crestSize,
      h: crestSize,
      style: {
        fontFamily: 'Poppins',
        fontSize: 12,
        color: '#4a5568',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'text',
      content: orgTitle,
      group: 'textbase',
      x: centerX(orgW),
      y: orgY,
      w: orgW,
      h: 24,
      style: {
        fontFamily: 'Inter',
        fontSize: isLandscape ? 12 : 13,
        color: '#1e3a5f',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'heading',
      content: 'Certificate of Achievement',
      group: 'textbase',
      x: centerX(titleW),
      y: titleY,
      w: titleW,
      h: 46,
      style: {
        fontFamily: 'Playfair Display',
        fontSize: isLandscape ? 34 : 31,
        color: '#0f2a4d',
        textAlign: 'center',
        fontWeight: '800',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      group: 'shapes',
      x: centerX(clampW(180)),
      y: topRuleY,
      w: clampW(180),
      h: 3,
      style: {
        fontFamily: 'Poppins',
        fontSize: 16,
        color: '#c69214',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
        backgroundColor: '#c69214',
      },
    },
    {
      id: uid(),
      type: 'text',
      content: 'THIS CERTIFICATE IS PROUDLY PRESENTED TO',
      group: 'textbase',
      x: centerX(preambleW),
      y: preambleY,
      w: preambleW,
      h: 22,
      style: {
        fontFamily: 'Inter',
        fontSize: 11,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'student_name',
      content: 'Ama Owusu',
      group: 'database',
      source: 'Student List',
      x: centerX(recipientW),
      y: recipientY,
      w: recipientW,
      h: 44,
      style: {
        fontFamily: 'Playfair Display',
        fontSize: isLandscape ? 32 : 30,
        color: '#b45309',
        textAlign: 'center',
        fontWeight: '800',
        fontStyle: 'italic',
      },
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      group: 'shapes',
      x: centerX(clampW(320)),
      y: nameRuleY,
      w: clampW(320),
      h: 2,
      style: {
        fontFamily: 'Poppins',
        fontSize: 16,
        color: '#d4af37',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
        backgroundColor: '#d4af37',
      },
    },
    {
      id: uid(),
      type: 'text',
      content: 'has successfully completed the prescribed programme with distinction in',
      group: 'textbase',
      x: centerX(citationW),
      y: citationY,
      w: citationW,
      h: 24,
      style: {
        fontFamily: 'Inter',
        fontSize: 13,
        color: '#334155',
        textAlign: 'center',
        fontWeight: '500',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'course',
      content: 'First Term Examination',
      group: 'database',
      source: 'Examination',
      x: centerX(courseW),
      y: courseY,
      w: courseW,
      h: 32,
      style: {
        fontFamily: 'Poppins',
        fontSize: isLandscape ? 20 : 19,
        color: '#0f172a',
        textAlign: 'center',
        fontWeight: '800',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'text',
      content: '2026 / 2027 Academic Session',
      group: 'textbase',
      x: centerX(sessionW),
      y: sessionY,
      w: sessionW,
      h: 22,
      style: {
        fontFamily: 'Inter',
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
      },
    },
    // Left footer column: Date value + divider line + caption
    {
      id: uid(),
      type: 'date',
      content: '2026-11-12',
      group: 'database',
      source: 'System',
      x: leftColX,
      y: footerLineY - 26,
      w: colW,
      h: 22,
      style: {
        fontFamily: 'Inter',
        fontSize: 12,
        color: '#0f172a',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
      },
    },
    {
      id: uid(),
      type: 'line',
      content: '',
      group: 'shapes',
      x: leftColX,
      y: footerLineY,
      w: colW,
      h: 2,
      style: {
        fontFamily: 'Poppins',
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
        backgroundColor: '#94a3b8',
      },
    },
    {
      id: uid(),
      type: 'text',
      content: 'Date of Issue',
      group: 'textbase',
      x: leftColX,
      y: footerLineY + 8,
      w: colW,
      h: 20,
      style: {
        fontFamily: 'Inter',
        fontSize: 11,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
      },
    },
    // Center footer emblem: Official Verification Seal
    {
      id: uid(),
      type: 'badge',
      content: DEFAULT_CERTIFICATE_SEAL_URI,
      group: 'media',
      x: centerX(sealSize),
      y: footerLineY - Math.round(sealSize * 0.56),
      w: sealSize,
      h: sealSize,
      style: {
        fontFamily: 'Poppins',
        fontSize: 10,
        color: '#78350f',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
      },
    },
    // Right footer column: Signature divider line + Principal title
    {
      id: uid(),
      type: 'line',
      content: '',
      group: 'shapes',
      x: rightColX,
      y: footerLineY,
      w: colW,
      h: 2,
      style: {
        fontFamily: 'Poppins',
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'normal',
        backgroundColor: '#94a3b8',
      },
    },
    {
      id: uid(),
      type: 'signature',
      content: 'Principal',
      group: 'textbase',
      x: rightColX,
      y: footerLineY + 8,
      w: colW,
      h: 20,
      style: {
        fontFamily: 'Inter',
        fontSize: 12,
        color: '#1e293b',
        textAlign: 'center',
        fontWeight: '700',
        fontStyle: 'normal',
      },
    },
  ]
}

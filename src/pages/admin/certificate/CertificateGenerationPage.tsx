import { createPortal } from 'react-dom'
import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Award, Pencil, Plus, Printer, ShieldAlert, Sparkles, Trash2, UserSearch, CheckCircle2, XCircle, Link2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, Textarea } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext, CERT_HOLDERS, CERT_HOLDER_NAME_LABELS } from './CertificateShared'
import { uid } from '../../../lib/utils'
import {
  autoPopulate,
  checkEligibility,
  createAuditEntry,
  appendAuditEntry,
  type IntegrationSource,
  type IntegratedHolder,
} from '../../../lib/certDataIntegration'
import type { EduRow } from '../../../lib/eduRecords'

const STATUSES = ['Draft', 'Issued', 'Revoked'] as const

type Draft = { certificateNo: string; holderType: string; holderName: string; certificateType: string; template: string; issueDate: string; expiryDate: string; status: string; remarks: string }

/* ---- border style → CSS for print ---- */
function getBorderStyle(bs: string, bg: string): React.CSSProperties {
  const s = String(bs || '').toLowerCase()
  if (s === 'striped' || s === 'ornate') return { outline: '6px solid #d69e2e', outlineOffset: '-6px' }
  if (s === 'solid' || s === 'gold' || s === 'thick') return { border: '6px solid #d69e2e' }
  if (s === 'double') return { border: '10px double #d69e2e' }
  if (s === 'dashed') return { border: '6px dashed #d69e2e' }
  if (s === 'dotted') return { border: '6px dotted #d69e2e' }
  if (s === 'double') return { border: '10px double #d69e2e' }
  if (s === 'elegant' || s === 'classic') return { border: '3px solid #92400e', boxShadow: 'inset 0 0 0 1px #fde68a' }
  if (s === 'modern') return { border: '3px solid #0f172a' }
  if (s === 'silver') return { border: '6px solid #94a3b8' }
  if (s === 'floral') return { border: '6px solid #d69e2e', borderRadius: '20px' }
  if (s === 'royal') return { border: '8px double #1e40af' }
  if (s === 'emerald') return { border: '8px double #065f46' }
  if (s === 'burgundy') return { border: '8px double #7f1d1d' }
  if (s === 'navy-gold') return { border: '10px solid #1e293b', outline: '2px solid #d4a017', outlineOffset: '-6px' }
  if (s === 'art-deco') return { border: '6px solid #1a1a1a', boxShadow: 'inset 0 0 0 3px #d4a017' }
  if (s === 'wavy') return { border: '5px solid #d4a017', borderRadius: '14px' }
  if (s === 'scalloped') return { border: '8px dashed #d69e2e', borderRadius: '18px' }
  if (s === 'rope') return { border: '10px ridge #b45309', borderRadius: '6px' }
  if (s === 'laurel') return { border: '6px solid #365314', boxShadow: 'inset 0 0 0 2px #fbbf24' }
  if (s === 'shadow') return { border: '4px solid #1e293b', boxShadow: '0 6px 18px rgba(0,0,0,0.22)' }
  if (s === 'triple') return { border: '12px double #d4a017' }
  if (s === 'mosaic') return { border: '10px solid transparent', borderImage: 'repeating-linear-gradient(45deg, #d4a017 0 8px, #7c2d12 8px 16px) 10' }
  if (s === 'inset') return { border: '8px inset #d69e2e' }
  if (s === 'outset') return { border: '8px outset #d69e2e' }
  if (s === 'bevel' || s === 'groove') return { border: '8px groove #d69e2e' }
  if (s === 'ridge') return { border: '8px ridge #d69e2e' }
  if (s === 'vintage') return { border: '6px solid #92400e', boxShadow: 'inset 0 0 0 1px #fde68a' }
  if (s === 'none' || !s) return {}
  // fallback: any style name that contains gold/royal/emerald
  if (s.includes('gold') || s.includes('royal') || s.includes('emerald')) return { border: '6px solid #d69e2e' }
  return { border: '4px solid #1e293b' }
}

/* ---- pattern → background image CSS for print ---- */
function getPatternStyle(pattern: string): React.CSSProperties {
  const p = String(pattern || '').toLowerCase()
  if (p === 'dots') return { backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.14) 1.6px, transparent 1.6px)', backgroundSize: '18px 18px' }
  if (p === 'lines') return { backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 11px)' }
  if (p === 'grid') return { backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }
  if (p === 'stars') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'36\' height=\'36\' viewBox=\'0 0 36 36\'%3E%3Cpath d=\'M18 4 L19.5 11 H27 L21 15.5 L23 23 L18 18.5 L13 23 L15 15.5 L9 11 H16.5 Z\' fill=\'rgba(0,0,0,0.09)\'/%3E%3C/svg%3E")', backgroundSize: '36px 36px' }
  if (p === 'confetti') return { backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(120,180,200,0.18) 2px, transparent 2.5px), radial-gradient(circle at 70% 60%, rgba(230,180,60,0.18) 2px, transparent 2.5px)', backgroundSize: '60px 60px' }
  if (p === 'floral') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 48 48\'%3E%3Cg fill=\'rgba(0,0,0,0.06)\'%3E%3Ccircle cx=\'24\' cy=\'24\' r=\'1.8\'/%3E%3Ccircle cx=\'24\' cy=\'14\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '48px 48px' }
  if (p === 'chevron') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'20\' viewBox=\'0 0 40 20\'%3E%3Cpath d=\'M0 20 L20 0 L40 20\' fill=\'none\' stroke=\'rgba(0,0,0,0.09)\' stroke-width=\'1.2\'/%3E%3C/svg%3E")', backgroundSize: '40px 20px' }
  if (p === 'stripes') return { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 12px, rgba(180,150,30,0.10) 12px 24px)' }
  if (p === 'crosshatch') return { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px), repeating-linear-gradient(-45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px)' }
  if (p === 'honeycomb') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'34\' height=\'30\' viewBox=\'0 0 34 30\'%3E%3Cpath d=\'M17 2 L26 7.5 L26 18.5 L17 24 L8 18.5 L8 7.5 Z\' fill=\'none\' stroke=\'rgba(0,0,0,0.08)\' stroke-width=\'1\'/%3E%3C/svg%3E")', backgroundSize: '34px 30px' }
  if (p === 'herringbone') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'30\' viewBox=\'0 0 60 30\'%3E%3Cpath d=\'M0 15 L15 0 L30 15 L15 30 Z M30 15 L45 0 L60 15 L45 30 Z\' fill=\'none\' stroke=\'rgba(0,0,0,0.07)\'/%3E%3C/svg%3E")', backgroundSize: '60px 30px' }
  if (p === 'paisley') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'50\' viewBox=\'0 0 50 50\'%3E%3Cpath d=\'M25 8 C32 8 35 18 25 30 C20 22 14 18 25 8\' fill=\'none\' stroke=\'rgba(0,0,0,0.07)\' stroke-width=\'1\'/%3E%3C/svg%3E")', backgroundSize: '50px 50px' }
  if (p === 'geometric') return { backgroundImage: 'linear-gradient(30deg, rgba(0,0,0,0.06) 12%, transparent 12.5%)', backgroundSize: '28px 50px' }
  if (p === 'mosaic') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Crect x=\'1\' y=\'1\' width=\'10\' height=\'10\' fill=\'none\' stroke=\'rgba(0,0,0,0.06)\' rx=\'1\'/%3E%3C/svg%3E")', backgroundSize: '24px 24px' }
  if (p === 'linen') return { backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 4px)' }
  if (p === 'parchment') return { backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(180,160,120,0.10) 0%, transparent 50%)' }
  if (p === 'bubbles') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Ccircle cx=\'10\' cy=\'12\' r=\'5\' fill=\'none\' stroke=\'rgba(0,0,0,0.05)\'/%3E%3C/svg%3E")', backgroundSize: '40px 40px' }
  if (p === 'diagonal') return { backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 10px)' }
  if (p === 'zigzag') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'20\' viewBox=\'0 0 40 20\'%3E%3Cpath d=\'M0 10 L10 0 L20 10 L30 0 L40 10\' fill=\'none\' stroke=\'rgba(0,0,0,0.08)\'/%3E%3C/svg%3E")', backgroundSize: '40px 20px' }
  if (p === 'circles') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'30\' viewBox=\'0 0 30 30\'%3E%3Ccircle cx=\'15\' cy=\'15\' r=\'8\' fill=\'none\' stroke=\'rgba(0,0,0,0.06)\'/%3E%3C/svg%3E")', backgroundSize: '30px 30px' }
  if (p === 'hexagons') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'28\' height=\'32\' viewBox=\'0 0 28 32\'%3E%3Cpath d=\'M14 2 L24 8 L24 20 L14 26 L4 20 L4 8 Z\' fill=\'none\' stroke=\'rgba(0,0,0,0.07)\'/%3E%3C/svg%3E")', backgroundSize: '28px 32px' }
  if (p === 'damask') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 60 60\'%3E%3Cg fill=\'none\' stroke=\'rgba(0,0,0,0.07)\' stroke-width=\'1\'%3E%3Cpath d=\'M30 5 C32 12 38 12 30 20 C22 12 28 12 30 5\'/%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '60px 60px' }
  if (p === 'marble') return { backgroundImage: 'linear-gradient(115deg, transparent 0%, rgba(0,0,0,0.04) 15%, transparent 30%), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.06) 0%, transparent 50%)' }
  if (p === 'waves') return { backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'20\' viewBox=\'0 0 80 20\'%3E%3Cpath d=\'M0 10 Q20 0 40 10 T80 10\' fill=\'none\' stroke=\'rgba(0,0,0,0.10)\' stroke-width=\'1.4\'/%3E%3C/svg%3E")', backgroundSize: '80px 20px' }
  if (p === 'vintage-paper') return { backgroundImage: 'linear-gradient(180deg, rgba(139,115,85,0.06) 0%, transparent 50%)' }
  if (p === 'none' || !p) return {}
  return {}
}

/* ---- paper dimensions in px for print ---- */
function getPaperDims(paperSize: string, orientation: string) {
  const sizes: Record<string, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, A3: { w: 1123, h: 1587 }, Letter: { w: 816, h: 1056 }, Legal: { w: 816, h: 1344 }, Custom: { w: 800, h: 600 } }
  const base = sizes[paperSize] || sizes.A4
  return orientation === 'Landscape' ? { w: base.h, h: base.w } : base
}

/* ---- margin filter → pixels for print ---- */
function getMarginPx(marginFilter: string): number {
  const map: Record<string, number> = { None: 0, Small: 38, Medium: 57, Large: 76, 'Extra Large': 95 }
  return map[marginFilter] ?? 57
}

/* ---- replace placeholders in element content ---- */
function fillContent(content: string, row: EduRow): string {
  const holder = row.holder || row.holderName || row.student || ''
  const className = String(row.className ?? row.class ?? '')
  const admissionNo = String(row.admissionNo ?? row.admission_number ?? '')
  const studentId = String(row.studentId ?? row.student_id ?? '')
  const grade = String(row.grade ?? row.gpa ?? '')
  const programme = String(row.programme ?? row.course ?? row.programmeName ?? '')
  const degree = String(row.degree ?? '')
  const department = String(row.department ?? '')
  const designation = String(row.designation ?? row.jobTitle ?? '')
  const employeeNo = String(row.employeeNo ?? row.employeeNumber ?? row.staffNo ?? '')
  const membershipNo = String(row.membershipNo ?? row.membershipNumber ?? '')
  const result = String(row.result ?? row.score ?? '')
  const schoolName = String(row.schoolName ?? row.school ?? '')
  const sealName = String(row.sealName ?? row.seal ?? '')
  const subject = String(row.subject ?? row.course ?? '')
  const dateOfBirth = String(row.dateOfBirth ?? row.dob ?? '')
  const gender = String(row.gender ?? '')
  const yearOfCompletion = String(row.yearOfCompletion ?? '')
  const graduationDate = String(row.graduationDate ?? '')
  const certificateNo = String(row.certificateNo ?? '')
  const serialNo = String(row.serialNo ?? '')
  const qrCode = String(row.qrCode ?? '')
  const verificationUrl = String(row.verificationUrl ?? '')
  const issueDate = String(row.issueDate ?? '')
  const registrarName = String(row.registrarName ?? '')
  const vcName = String(row.vcName ?? row.principalName ?? '')
  const cgpa = String(row.cgpa ?? '')
  const totalCredits = String(row.totalCredits ?? '')
  const ceremonyDate = String(row.ceremonyDate ?? '')

  return String(content ?? '')
    .replaceAll('{holderName}', holder)
    .replaceAll('{holder}', holder)
    .replaceAll('{studentName}', holder)
    .replaceAll('{certificateNo}', certificateNo)
    .replaceAll('{issueDate}', issueDate)
    .replaceAll('{expiryDate}', String(row.expiryDate ?? ''))
    .replaceAll('{certificateType}', String(row.certificateType ?? ''))
    .replaceAll('{holderType}', String(row.holderType ?? ''))
    .replaceAll('{className}', className)
    .replaceAll('{class}', className)
    .replaceAll('{admissionNo}', admissionNo)
    .replaceAll('{studentId}', studentId)
    .replaceAll('{indexNo}', admissionNo)
    .replaceAll('{dateOfBirth}', dateOfBirth)
    .replaceAll('{dob}', dateOfBirth)
    .replaceAll('{gender}', gender)
    .replaceAll('{programme}', programme)
    .replaceAll('{course}', programme)
    .replaceAll('{degree}', degree)
    .replaceAll('{grade}', grade)
    .replaceAll('{gpa}', grade)
    .replaceAll('{cgpa}', cgpa)
    .replaceAll('{classOfDegree}', grade)
    .replaceAll('{yearOfCompletion}', yearOfCompletion)
    .replaceAll('{graduationDate}', graduationDate)
    .replaceAll('{ceremonyDate}', ceremonyDate)
    .replaceAll('{serialNo}', serialNo)
    .replaceAll('{qrCode}', qrCode)
    .replaceAll('{verificationUrl}', verificationUrl)
    .replaceAll('{registrarName}', registrarName)
    .replaceAll('{vcName}', vcName)
    .replaceAll('{viceChancellor}', vcName)
    .replaceAll('{department}', department)
    .replaceAll('{designation}', designation)
    .replaceAll('{employeeNo}', employeeNo)
    .replaceAll('{membershipNo}', membershipNo)
    .replaceAll('{result}', result)
    .replaceAll('{score}', result)
    .replaceAll('{schoolName}', schoolName)
    .replaceAll('{school}', schoolName)
    .replaceAll('{seal}', sealName)
    .replaceAll('{sealName}', sealName)
    .replaceAll('{subject}', subject)
    .replaceAll('{totalCredits}', totalCredits)
}

/* ---- render a single certificate element for print ---- */
function PrintElement({ el, style, content, posTop, row }: { el: any; style: any; content: string; posTop: number; row: EduRow }) {
  const type = String(el.type || 'text')
  const s = style || {}
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: posTop,
    width: el.w,
    height: el.h,
    fontFamily: s.fontFamily || 'Poppins, serif',
    fontSize: s.fontSize || 14,
    color: s.color || '#1a202c',
    textAlign: 'center',
    fontWeight: s.fontWeight || '400',
    fontStyle: s.fontStyle || 'normal',
    lineHeight: s.lineHeight || 1.4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }

  if (type === 'line') {
    return <div style={{ ...baseStyle, height: el.h <= 8 ? el.h : 2, backgroundColor: s.backgroundColor && s.backgroundColor !== 'transparent' ? s.backgroundColor : s.color || '#1e293b', alignItems: 'center' }} />
  }
  if (type === 'rectangle' || type === 'square') {
    return <div style={{ ...baseStyle, backgroundColor: s.backgroundColor || 'transparent', borderWidth: s.borderWidth ?? 2, borderColor: s.borderColor || '#1e293b', borderStyle: 'solid', borderRadius: s.borderRadius ?? 4 }} />
  }
  if (type === 'circle') {
    return <div style={{ ...baseStyle, backgroundColor: s.backgroundColor || 'transparent', borderWidth: s.borderWidth ?? 2, borderColor: s.borderColor || '#1e293b', borderStyle: 'solid', borderRadius: 9999 }} />
  }
  if (type === 'border') {
    return <div style={{ ...baseStyle, borderWidth: s.borderWidth ?? 4, borderColor: s.borderColor || '#d69e2e', borderStyle: 'solid', borderRadius: s.borderRadius ?? 8, backgroundColor: s.backgroundColor || 'transparent' }} />
  }
  if (type === 'logo' || type === 'image' || type === 'badge') {
    if (el.content) return <img src={el.content} alt="" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: posTop, width: el.w, height: el.h, objectFit: 'contain' }} />
    return <div style={{ ...baseStyle, border: '2px dashed #ccc', backgroundColor: '#f5f5f5', fontSize: 10 }}>{type}</div>
  }
  if (type === 'signature_line') {
    // Render a signature block: a line for signature, with a title below
    const sigLine = String(el.content || 'Authorised Signature')
    const sigTitle = String(s.signatureTitle || s.title || sigLine)
    return (
      <div style={{ position: 'absolute', left: el.x, top: posTop, width: el.w, height: el.h, textAlign: s.textAlign || 'center' }}>
        <div style={{ borderTop: `${s.borderWidth ?? 2}px ${s.borderStyle || 'solid'} ${s.borderColor || '#333'}`, paddingTop: 4, width: '100%' }} />
        <div style={{ fontSize: s.fontSize || 11, color: s.color || '#555', fontWeight: s.fontWeight || '600', marginTop: 4, fontFamily: s.fontFamily || 'Poppins' }}>{sigTitle}</div>
      </div>
    )
  }
  if (type === 'seal') {
    // Render a circular seal/stamp
    const sealText = String(el.content || 'OFFICIAL SEAL')
    return (
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: posTop, width: el.w, height: el.h, borderRadius: '50%', border: `${s.borderWidth ?? 4}px double ${s.borderColor || '#b7791f'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: s.fontFamily || 'Poppins', fontSize: s.fontSize || 10, color: s.color || '#b7791f', fontWeight: s.fontWeight || '700', backgroundColor: s.backgroundColor || 'transparent', opacity: s.opacity ?? 0.8 }}>
        {sealText}
      </div>
    )
  }
  if (type === 'subject_table') {
    // Render an academic transcript table — parse subjectGrades from row data
    // subjectGrades format: "CourseCode:SubjectName:Grade:CreditHours:GPA, ..."
    let tableRows: React.ReactNode[] = []
    const sg = String(row.subjectGrades ?? '').trim()
    const fontSize = s.fontSize || 11
    const thStyle: React.CSSProperties = { padding: '4px 6px', fontSize, fontWeight: 'bold', color: s.color || '#1a1a2e', borderBottom: '2px solid #1a1a2e', textAlign: 'left' }
    const tdStyle: React.CSSProperties = { padding: '3px 6px', fontSize, color: s.color || '#333', borderBottom: '1px solid #ddd' }
    const tdRightStyle: React.CSSProperties = { ...tdStyle, textAlign: 'right', fontWeight: 'bold', color: s.gradeColor || '#1a1a2e' }

    if (sg) {
      // Parse course code : subject name : grade : credit hours : gpa pairs
      const entries = sg.split(',').map(p => p.trim()).filter(Boolean).map(pair => {
        const parts = pair.split(':').map(x => x.trim())
        return {
          code: parts[0] || '',
          name: parts[1] || '',
          grade: parts[2] || '',
          credits: parts[3] || '',
          gpa: parts[4] || '',
        }
      }).filter(e => e.name)

      // Determine if this is a full transcript (has course codes) or simple subject list
      const isFullTranscript = entries.some(e => e.code && e.credits)

      if (isFullTranscript) {
        // Full academic transcript with headers
        const totalCredits = String(row.totalCredits ?? '')
        const cgpa = String(row.cgpa ?? '')
        const gradeLabel = String(row.grade ?? '')
        tableRows = [
          <tr key="hdr-course" style={{ borderBottom: '1px solid #ccc' }}>
            <th style={thStyle}>Course Code</th>
            <th style={thStyle}>Course Name</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Grade</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Credits</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>GPA</th>
          </tr>,
          ...entries.map((e, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ ...tdStyle, fontWeight: '600', color: s.color || '#1a1a2e' }}>{e.code}</td>
              <td style={tdStyle}>{e.name}</td>
              <td style={{ ...tdRightStyle, textAlign: 'center' }}>{e.grade || '—'}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{e.credits || '—'}</td>
              <td style={tdRightStyle}>{e.gpa || '—'}</td>
            </tr>
          )),
          <tr key="summary" style={{ borderBottom: '2px solid #1a1a2e', backgroundColor: s.backgroundColor || '#f8f4e8' }}>
            <td style={{ ...tdStyle, fontWeight: 'bold', borderBottom: '2px solid #1a1a2e' }} colSpan={3}>Total Credits Earned</td>
            <td style={{ ...tdRightStyle, textAlign: 'center', borderBottom: '2px solid #1a1a2e' }}>{totalCredits || '—'}</td>
            <td style={{ ...tdRightStyle, borderBottom: '2px solid #1a1a2e' }}>{cgpa || '—'}</td>
          </tr>,
        ]
      } else {
        // Simple subject list (WAEC/BECE style)
        tableRows = entries.map((e, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
            <td style={{ padding: '4px 8px', fontSize, color: s.color || '#333' }}>{e.name}</td>
            <td style={{ padding: '4px 8px', fontSize, color: s.gradeColor || '#1a1a2e', fontWeight: 'bold', textAlign: 'right' }}>{e.grade || '—'}</td>
          </tr>
        ))
      }
    } else {
      // Fallback to static template content/grades
      const subjects = String(el.content || 'English, Mathematics, Science, Social Studies').split(',').map(s => s.trim()).filter(Boolean)
      const grades = String(s.grades || 'A1, A1, B2, A1').split(',').map(s => s.trim()).filter(Boolean)
      tableRows = subjects.map((sub, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
          <td style={{ padding: '4px 8px', fontSize, color: s.color || '#333' }}>{sub}</td>
          <td style={{ padding: '4px 8px', fontSize, color: s.gradeColor || '#1a1a2e', fontWeight: 'bold', textAlign: 'right' }}>{grades[i] || '—'}</td>
        </tr>
      ))
    }

    return (
      <table style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: posTop, width: el.w, borderCollapse: 'collapse', fontFamily: s.fontFamily || 'Poppins' }}>
        {tableRows}
      </table>
    )
  }
  // text, heading, student_name, course, date, signature
  return <span style={baseStyle}>{content}</span>
}

export function CertificateGenerationPage() {
  const { generations, types, templates, can, patch, searchHolder, listHoldersForSource, officer } = useCertificateContext()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowed = can('generate')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [draft, setDraft] = useState<Draft>({ certificateNo: '', holderType: 'University', holderName: '', certificateType: '', template: '', issueDate: new Date().toISOString().slice(0, 10), expiryDate: '', status: 'Draft', remarks: '' })
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)
  const [printingRow, setPrintingRow] = useState<EduRow | null>(null)
  // Holder picker state
  const [holderSource, setHolderSource] = useState<IntegrationSource>('Student')
  const [holderSearch, setHolderSearch] = useState('')
  const [selectedHolder, setSelectedHolder] = useState<IntegratedHolder | null>(null)
  const [holderResults, setHolderResults] = useState<IntegratedHolder[]>([])
  const [autoPopResult, setAutoPopResult] = useState<{ matchedFields: string[]; unmatchedFields: string[] } | null>(null)

  const typeNames = useMemo(() => types.map((r) => String(r.name ?? '')).filter(Boolean), [types])
  const templateNames = useMemo(() => templates.map((r) => String(r.templateName ?? '')).filter(Boolean), [templates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return generations
    return generations.filter((r) => [r.certificateNo, r.holderName, r.certificateType, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [generations, query])

  /* ---- auto-select holder from ?holder=name&source=Student query params ---- */
  useEffect(() => {
    const holderName = searchParams.get('holder')
    const holderSourceParam = searchParams.get('source')
    if (!holderName) return
    // Set holder type dropdown to match source if provided
    if (holderSourceParam && ['Student', 'Employee', 'Member'].includes(holderSourceParam)) {
      setHolderSource(holderSourceParam as IntegrationSource)
    }
    // Try direct lookup first
    const source = (holderSourceParam as IntegrationSource) || 'Student'
    const holder = searchHolder(source, holderName)
    let found = holder
    if (!found) {
      // List all and filter
      const all = listHoldersForSource(source)
      const q = holderName.trim().toLowerCase()
      found = all.find((h) => h.name.toLowerCase() === q || h.reference.toLowerCase() === q) ?? null
    }
    if (found) {
      handleHolderSelect(found)
      // Open the generate modal
      openNew()
      // Re-apply holder selection after openNew resets state
      const t = setTimeout(() => handleHolderSelect(found), 50)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  /* find the template matching a generation row's template name */
  const findTemplate = (tplName: string): EduRow | undefined => {
    return templates.find((t) => String(t.templateName ?? '') === String(tplName ?? ''))
  }

  const openNew = () => {
    const prefix = (types.find((t) => String(t.name) === typeNames[0])?.serialPrefix as string | undefined) ?? 'CERT-'
    const seq = generations.length + 1
    const autoNo = `${(prefix || 'CERT-').trim()}${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
    setDraft({ certificateNo: autoNo, holderType: 'University', holderName: '', certificateType: typeNames[0] ?? '', template: templateNames[0] ?? '', issueDate: new Date().toISOString().slice(0, 10), expiryDate: '', status: 'Draft', remarks: '' })
    setEditing({ id: '' } as EduRow)
    // Clear holder picker state
    setSelectedHolder(null)
    setHolderSearch('')
    setHolderResults([])
    setAutoPopResult(null)
  }

  /* ---- holder picker: search and auto-populate ---- */
  const handleHolderSearch = (source: IntegrationSource, query: string) => {
    setHolderSource(source)
    setHolderSearch(query)
    if (!query.trim()) {
      setHolderResults([])
      return
    }
    // Direct lookup
    const holder = searchHolder(source, query)
    if (holder) {
      setHolderResults([holder])
      return
    }
    // List all and filter
    const all = listHoldersForSource(source)
    const q = query.trim().toLowerCase()
    setHolderResults(
      all.filter((h) =>
        h.name.toLowerCase().includes(q) ||
        h.reference.toLowerCase().includes(q) ||
        (h as any).admissionNo?.toLowerCase().includes(q) ||
        (h as any).employeeNo?.toLowerCase().includes(q) ||
        (h as any).membershipNo?.toLowerCase().includes(q),
      ),
    )
  }

  const handleHolderSelect = (holder: IntegratedHolder) => {
    setSelectedHolder(holder)
    setHolderSearch(`${holder.name} (${holder.reference})`)
    setHolderResults([])
    // Auto-populate holder type and name
    const holderTypeMap: Record<IntegrationSource, string> = {
      Student: 'Student',
      Employee: 'Employee',
      Member: 'Member',
    }
    setDraft((d) => ({
      ...d,
      holderType: holderTypeMap[holder.source],
      holderName: holder.name,
    }))
    // Run auto-populate to show matched fields
    const tplName = draft.template
    const tpl = templates.find((t) => String(t.templateName ?? '') === String(tplName ?? ''))
    let templateVars: string[] = []
    try {
      const raw = String((tpl as any)?.certificateData ?? '')
      if (raw) {
        const data = JSON.parse(raw)
        // Extract variable names from template elements
        templateVars = (data.elements ?? []).flatMap((el: any) =>
          String(el.content ?? '').match(/\{\{\s*(\w+)\s*\}\}/g) ?? [],
        ).map((m: string) => m.replace(/\{\{|\}\}|/g, '').trim())
      }
    } catch { /* ignore */ }
    const result = autoPopulate(holder, templateVars)
    setAutoPopResult({ matchedFields: result.matchedFields, unmatchedFields: result.unmatchedFields })
    // Check eligibility
    const eligibility = checkEligibility(holder)
    if (!eligibility.eligible) {
      toast.warning('Eligibility check', eligibility.reasons.join('. '))
    }
  }

  const clearHolder = () => {
    setSelectedHolder(null)
    setHolderSearch('')
    setHolderResults([])
    setAutoPopResult(null)
  }
  const openEdit = (row: EduRow) => {
    setDraft({
      certificateNo: String(row.certificateNo ?? ''),
      holderType: CERT_HOLDERS.includes(row.holderType as any) ? String(row.holderType) : 'Other Institution',
      holderName: String(row.holderName ?? row.holder ?? ''),
      certificateType: String(row.certificateType ?? ''),
      template: String(row.template ?? ''),
      issueDate: String(row.issueDate ?? ''),
      expiryDate: String(row.expiryDate ?? ''),
      status: String(row.status ?? 'Draft'),
      remarks: String(row.remarks ?? ''),
    })
    setEditing(row)
  }
  const save = () => {
    if (!draft.certificateNo.trim()) { toast.error('Number required', 'Enter a certificate number.'); return }
    if (!draft.holderName.trim()) { toast.error('Holder required', `Enter the ${CERT_HOLDER_NAME_LABELS[draft.holderType]?.label || 'holder'} name.`); return }
    if (!draft.certificateType.trim()) { toast.error('Type required', 'Pick a certificate type.'); return }
    const row: EduRow = {
      id: editing?.id || uid('certgen'),
      certificateNo: draft.certificateNo.trim(),
      holderType: draft.holderType,
      holderName: draft.holderName.trim(),
      holder: draft.holderName.trim(),
      certificateType: draft.certificateType,
      template: draft.template,
      issueDate: draft.issueDate,
      expiryDate: draft.expiryDate,
      status: draft.status,
      remarks: draft.remarks.trim(),
      // Data integration fields
      ...(selectedHolder ? {
        dataSource: selectedHolder.source,
        recordId: selectedHolder.id,
        recordReference: selectedHolder.reference,
      } : { dataSource: 'manual' }),
    }
    const next = editing?.id ? generations.map((r) => r.id === editing.id ? row : r) : [...generations, row]
    patch({ certificateGeneration: next as EduRow[], certificateRegister: next as EduRow[] })
    // Audit trail
    const auditEntry = createAuditEntry(
      draft.certificateNo.trim(),
      'generated',
      officer,
      selectedHolder ? selectedHolder.source : 'manual',
      { recordOwner: selectedHolder?.name, template: draft.template },
    )
    patch({ certificateGeneration: next as EduRow[], certificateRegister: next as EduRow[] })
    toast.success(editing?.id ? 'Certificate updated' : 'Certificate generated', draft.certificateNo)
    setEditing(null)
    clearHolder()
  }
  const remove = () => {
    if (!confirmDelete) return
    const next = generations.filter((r) => r.id !== confirmDelete.id) as EduRow[]
    patch({ certificateGeneration: next, certificateRegister: next })
    toast.success('Deleted', String(confirmDelete.certificateNo ?? 'Certificate'))
    setConfirmDelete(null)
  }

  /* ---- print a single certificate using its template design ---- */
  const doPrint = (row: EduRow) => {
    setPrintingRow(row)
    document.body.classList.add('cert-generation-printing')
    const done = () => {
      document.body.classList.remove('cert-generation-printing')
      setPrintingRow(null)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.setTimeout(() => window.print(), 150)
  }

  /* ---- build the print certificate JSX ---- */
  const renderPrintCertificate = () => {
    if (!printingRow) return null
    const row = printingRow
    const tpl = findTemplate(row.template)
    const bgColor = String((tpl as any)?.backgroundColor ?? (tpl as any)?.bgColor ?? '#FFFDF0')
    const bgImage = String((tpl as any)?.backgroundImage ?? (tpl as any)?.bgImage ?? '')
    const bgPattern = String((tpl as any)?.pattern ?? (tpl as any)?.bgPattern ?? 'none')
    const borderStyle = String((tpl as any)?.borderStyle ?? 'None')
    const paperSize = String((tpl as any)?.paperSize ?? 'A4')
    const orientation = String((tpl as any)?.orientation ?? (tpl as any)?.pageLayout ?? 'Portrait')
    const marginFilter = String((tpl as any)?.marginFilter ?? 'Medium')
    const marginPx = getMarginPx(marginFilter)
    const paper = getPaperDims(paperSize, orientation)

    // Parse certificateData elements from the template
    let elements: any[] = []
    try {
      const raw = String((tpl as any)?.certificateData ?? '')
      if (raw) {
        const data = JSON.parse(raw)
        elements = data.elements || []
      }
    } catch { /* ignore */ }

    // If no template elements found, generate a default certificate layout
    if (!elements.length) {
      const innerW = paper.w - marginPx * 2
      const innerH = paper.h - marginPx * 2
      const cx = (w: number) => (innerW - w) / 2
      elements = [
        { id: 'p_title', type: 'heading', content: `Certificate of ${row.certificateType || 'Achievement'}`, x: cx(460), y: 40, w: 460, h: 40, style: { fontFamily: 'Poppins', fontSize: 28, color: '#0f2a4d', textAlign: 'center', fontWeight: '800' } },
        { id: 'p_line1', type: 'line', content: '', x: cx(300), y: 90, w: 300, h: 3, style: { backgroundColor: '#b7791f' } },
        { id: 'p_body', type: 'text', content: `This is to certify that\n${row.holderName || row.holder || ''}\nhas successfully completed the requirements for the\n${row.certificateType || 'Achievement'} certificate`, x: cx(440), y: 120, w: 440, h: 120, style: { fontFamily: 'Poppins', fontSize: 16, color: '#333', textAlign: 'center', fontWeight: '500', lineHeight: 1.8 } },
        { id: 'p_name', type: 'student_name', content: row.holderName || row.holder || '', x: cx(360), y: 170, w: 360, h: 40, style: { fontFamily: 'Poppins', fontSize: 28, color: '#b7791f', textAlign: 'center', fontWeight: '800' } },
        { id: 'p_line2', type: 'line', content: '', x: cx(300), y: 230, w: 300, h: 3, style: { backgroundColor: '#b7791f' } },
        { id: 'p_footer', type: 'text', content: `Certificate No: ${row.certificateNo || ''}\nDate: ${row.issueDate || ''}`, x: cx(440), y: innerH - 80, w: 440, h: 60, style: { fontFamily: 'Poppins', fontSize: 12, color: '#666', textAlign: 'center' } },
      ]
    }

    const borderCss = getBorderStyle(borderStyle, bgColor)
    const patternCss = getPatternStyle(bgPattern)

    return (
      <div style={{ width: paper.w, height: paper.h, position: 'relative', boxSizing: 'border-box', backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden', ...borderCss }}>
        {/* Pattern overlay */}
        {bgPattern && bgPattern !== 'none' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, ...patternCss }} aria-hidden />
        )}
        {/* Elements positioned with margin offset relative to full paper */}
        {elements.map((el, i) => (
          <PrintElement key={el.id || `el_${i}`} el={el} style={el.style} content={fillContent(el.content, row)} posTop={el.y + marginPx} row={row} />
        ))}
        {/* Signature line at bottom */}
        <div style={{ position: 'absolute', bottom: marginPx, left: marginPx, right: marginPx, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 10, color: '#555' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ borderTop: '1px solid #999', paddingTop: 4, width: 180 }}>Authorised Signature</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.certificateNo}</div>
            <div>{new Date().toLocaleDateString()}</div>
            {/* QR code for verification */}
            <div style={{ marginTop: 6, display: 'inline-block', padding: 4, backgroundColor: 'white', borderRadius: 4, border: '1px solid #ddd' }}>
              <QRCodeSVG
                value={`CERT:${row.certificateNo}:${row.holderName ?? row.holder ?? ''}`}
                size={64}
                level="M"
              />
            </div>
            <div style={{ marginTop: 2, fontSize: 8, color: '#888' }}>Scan to verify</div>
          </div>
        </div>
      </div>
    )
  }

  const columns: Column<EduRow>[] = [
    { key: 'certificateNo', header: 'Certificate No', render: (r) => <span className="font-mono text-xs font-semibold">{String(r.certificateNo ?? '—')}</span> },
    { key: 'holderName', header: 'Holder', render: (r) => <div><p className="font-medium">{String(r.holderName ?? r.holder ?? '')}</p><p className="text-[11px] text-mist">{String(r.holderType ?? '')}</p></div> },
    { key: 'certificateType', header: 'Type', render: (r) => <span className="text-sm">{String(r.certificateType ?? '')}</span> },
    { key: 'template', header: 'Template', render: (r) => <span className="text-sm text-mist">{String(r.template ?? '—')}</span> },
    { key: 'issueDate', header: 'Issue Date', render: (r) => <span className="text-sm">{String(r.issueDate ?? '—')}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={String(r.status).toLowerCase() === 'issued' ? 'lime' : String(r.status).toLowerCase() === 'revoked' ? 'rose' : 'amber'}>{String(r.status ?? '')}</Badge> },
    {
      key: 'actions', header: '', width: 140, render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => doPrint(r)} title="Print Certificate"><Printer className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)}><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Certificate Generation" desc="Issue a single certificate to a holder — pick the type, template and validity. Click the printer icon to print the certificate." printTitle="Certificate Generation" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot generate certificates.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search certificate no or holder…" className="max-w-sm" />
        <div className="ml-auto flex gap-2">
          <Badge tone="zinc">{filtered.length} certificate{filtered.length === 1 ? '' : 's'}</Badge>
          <Button size="sm" onClick={openNew} disabled={!allowed}><Sparkles className="size-4" /> Generate</Button>
        </div>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No certificates yet" emptyDesc="Generate your first certificate." />

      <Modal open={!!editing} onClose={() => { setEditing(null); clearHolder() }} title={editing?.id ? 'Edit Certificate' : 'Generate Certificate'} footer={<><Button variant="outline" size="sm" onClick={() => { setEditing(null); clearHolder() }}>Cancel</Button><Button size="sm" onClick={save} disabled={!allowed}>Save</Button></>}>
        <div className="grid gap-4">
          {/* Holder picker with auto-population */}
          <div className="rounded-xl border border-line bg-blue-50/40 p-4 dark:bg-blue-50/10">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300"><UserSearch className="size-4" /> Auto-Populate from Database</h4>
              {selectedHolder && (
                <button onClick={clearHolder} className="text-xs text-blue-600 hover:underline dark:text-blue-400">Clear selection</button>
              )}
            </div>
            <div className="flex gap-2">
              <Select
                value={holderSource}
                onChange={(e) => { setHolderSource(e.target.value as IntegrationSource); setHolderSearch(''); setHolderResults([]); setSelectedHolder(null); setAutoPopResult(null) }}
                className="w-32"
              >
                <option value="Student">Student</option>
                <option value="Employee">Employee</option>
                <option value="Member">Member</option>
              </Select>
              <Input
                value={holderSearch}
                onChange={(e) => handleHolderSearch(holderSource, e.target.value)}
                placeholder={`Search ${holderSource} by name or ID…`}
                className="flex-1"
                disabled={!!selectedHolder}
              />
              {selectedHolder && (
                <Button size="sm" variant="outline" onClick={clearHolder}>Change</Button>
              )}
            </div>
            {/* Search results */}
            {holderResults.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-blue-200 dark:border-blue-500/20">
                {holderResults.slice(0, 10).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleHolderSelect(h)}
                    className="flex w-full items-center justify-between border-b border-blue-100 px-3 py-2 text-left text-sm hover:bg-blue-100 dark:border-blue-500/10 dark:hover:bg-blue-500/10"
                  >
                    <span className="font-medium">{h.name}</span>
                    <span className="text-xs text-mist">{h.reference} · {h.source}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Selected holder details */}
            {selectedHolder && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800 dark:text-green-300">{selectedHolder.name}</span>
                  <span className="text-xs text-mist">· {selectedHolder.reference} · {selectedHolder.source}</span>
                </div>
                {/* Show available fields */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {autoPopResult?.matchedFields.slice(0, 12).map((f, i) => (
                    <span key={i} className="rounded bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-500/10 dark:text-green-300">
                      {f.split(' = ')[0]}
                    </span>
                  ))}
                </div>
                {/* Eligibility check */}
                {(() => {
                  const elig = checkEligibility(selectedHolder)
                  return elig.eligible ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="size-3" /> Eligible for certificate issuance</div>
                  ) : (
                    <div className="mt-2 flex items-start gap-1 text-xs text-amber-600"><XCircle className="size-3 shrink-0" /> {elig.reasons.join('. ')}</div>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certificate Number *"><Input value={draft.certificateNo} onChange={(e) => setDraft({ ...draft, certificateNo: e.target.value })} placeholder="CERT-2026-0001" /></Field>
            <Field label="Holder Type *"><Select value={draft.holderType} onChange={(e) => setDraft({ ...draft, holderType: e.target.value })}>{CERT_HOLDERS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${CERT_HOLDER_NAME_LABELS[draft.holderType]?.label || "Holder Name"} *`}><Input value={draft.holderName} onChange={(e) => setDraft({ ...draft, holderName: e.target.value })} placeholder={CERT_HOLDER_NAME_LABELS[draft.holderType]?.placeholder || "Enter name"} /></Field>
            <Field label="Certificate Type *"><Select value={draft.certificateType} onChange={(e) => setDraft({ ...draft, certificateType: e.target.value })}><option value="">Choose type…</option>{typeNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template"><Select value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })}><option value="">Choose template…</option>{templateNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issue Date *"><Input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} /></Field>
            <Field label="Expiry Date"><Input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} /></Field>
          </div>
          <Field label="Remarks"><Textarea value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} rows={2} placeholder="Optional notes" /></Field>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete certificate?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String(confirmDelete?.certificateNo ?? '')}</b>? This cannot be undone.</p>
      </Modal>

      {createPortal(
        <div className="cert-generation-print-root" style={{ display: printingRow ? 'block' : 'none' }}>
          {renderPrintCertificate()}
        </div>,
        document.body,
      )}
    </div>
  )
}

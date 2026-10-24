/**
 * ID card rendering + printing.
 *
 * `IdCardFace` draws a single card face at true millimetre size (so what you
 * see is exactly what prints). `IdCardPrintSheet` mounts a hidden, print-only
 * sheet — PVC (one 85.6 × 54 mm page per card) or an A4 grid with cut marks.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import { backgroundFitCss, fieldLabel, fontStack, idCardQrPayload, type IdCard, type IdCardTemplate } from '../lib/eduIdCards'

export type IdCardSchool = {
  name: string
  address: string
  contact: string
  motto: string
  logo: string
}

export type IdCardSide = 'front' | 'back'

const FALLBACK_SCHOOL: IdCardSchool = { name: 'School Name', address: '', contact: '', motto: '', logo: '' }

/* Template field keys that don't match the stored property name exactly.
 * `holderName` is the universal name row; `studentName` is what templates saved
 * before Card Management became universal used. */
const FIELD_ALIASES: Record<string, string> = { studentName: 'holder', holderName: 'holder' }

const cardValue = (card: IdCard | undefined, key: string): string => {
  if (!card) return ''
  const row = card as unknown as Record<string, string | number | undefined>
  const field = FIELD_ALIASES[key] ?? key
  // Cards generated before the holder rename keep the person's name in `student`.
  const value = field === 'holder' ? (row.holder ?? row.student) : row[field]
  return String(value ?? '').trim()
}

function Barcode({ value, height = 26, width = 1.1, fontSize = 8 }: { value: string; height?: number; width?: number; fontSize?: number }) {
  const ref = useRef<SVGSVGElement | null>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        height,
        width,
        fontSize,
        margin: 0,
        background: 'transparent',
        lineColor: '#0f172a',
        displayValue: true,
      })
    } catch {
      /* Invalid characters for CODE128 — leave the placeholder empty. */
    }
  }, [value, height, width, fontSize])
  if (!value) return null
  return <svg ref={ref} className="w-full" style={{ height: height + 12 }} />
}

/** Photo on the left (default), mirrored right, or stacked above/below the fields. */
const frontLayoutClass = (position: IdCardTemplate['photoPosition']) => {
  const base = 'flex'
  if (position === 'Right') return `${base} flex-1 flex-row-reverse items-start gap-[2mm]`
  if (position === 'Top') return `${base} flex-1 flex-col items-center gap-[1.5mm]`
  if (position === 'Bottom') return `${base} flex-1 flex-col-reverse items-center gap-[1.5mm]`
  return `${base} flex-1 items-start gap-[2mm]`
}

/**
 * The card is a physical object, so every size on it is measured in millimetres
 * and scaled to the card: a CR80 (54 mm tall) is the reference, a 74 mm badge
 * gets proportionally larger type, a small tag tighter type. Pixel sizes would
 * stay frozen while the card grew or shrank around them.
 */
const TYPE_SCALE = { schoolName: 2.6, addressLine: 1.75, label: 2.05, value: 2.5, backText: 1.95, note: 1.8, footer: 1.7, signature: 1.9 }
/** Logo, and the QR size on each face — small enough to leave the details room. */
const LOGO_MM = 8
const QR_FRONT_MM = 11
const QR_BACK_MM = 15
/** Smallest QR we will draw, whatever the text size does to the furniture. */
const QR_MIN_MM = 9
/** Photo height (mm) when it sits beside the fields, and when stacked above/below them. */
const PHOTO_SIDE_MM = 26
const PHOTO_STACKED_MM = 22

const typeScale = (heightMm: number) => Math.min(1.7, Math.max(0.9, heightMm / 54))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const mm = (value: number) => `${Number(value.toFixed(2))}mm`
/** jsbarcode works in pixels, so convert our millimetre sizes for it. */
const pxPerMm = 3.7795
const px = (value: number) => Math.round(value * pxPerMm)

/** The field column fills the width when stacked, shares the row otherwise. */
const stackedClass = (position: IdCardTemplate['photoPosition']) =>
  position === 'Top' || position === 'Bottom' ? 'w-full min-w-0' : 'min-w-0 flex-1'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'

/** ID photos are 35 × 45 mm, so the frame keeps that 0.78 ratio at any size. */
function Photo({
  card, template, scale = 1, heightMm,
}: { card?: IdCard; template: IdCardTemplate; scale?: number; heightMm: number }) {
  const photo = cardValue(card, 'photo')
  const stacked = template.photoPosition === 'Top' || template.photoPosition === 'Bottom'
  const w = heightMm * 0.78
  const size: CSSProperties = { width: mm(w), height: mm(heightMm) }
  const fit: CSSProperties = { ...size, maxWidth: '40%', maxHeight: '100%', objectFit: 'cover' }
  const shape = { borderRadius: template.photoStyle === 'Circle' ? '999px' : mm(1.5 * scale) }
  if (!photo) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border border-dashed font-bold text-slate-400"
        style={{
          ...fit,
          ...shape,
          fontSize: mm(TYPE_SCALE.schoolName * scale),
          background: 'rgba(15,23,42,0.04)',
        }}
      >
        {initials(cardValue(card, 'holder') || 'Photo')}
      </div>
    )
  }
  return (
    <img
      src={photo}
      alt={cardValue(card, 'holder') || 'Card holder photo'}
      className="shrink-0"
      style={{ ...fit, ...shape }}
    />
  )
}

/**
 * One detail row on the card, written the way a school reads it:
 * “Admission Number : ADM-011”. The value is bold so it stays legible at
 * card size, and the line wraps instead of clipping long values.
 */
const FieldLine = ({
  label, value, color, scale = 1, upper = false,
}: { label: string; value: string; color: string; scale?: number; upper?: boolean }) => (
  <div className="flex items-baseline leading-tight" style={{ gap: mm(0.6 * scale) }}>
    <span
      className="shrink-0 font-semibold opacity-75"
      style={{ fontSize: mm(TYPE_SCALE.label * scale), textTransform: upper ? 'uppercase' : undefined }}
    >{label} :</span>
    <span className="min-w-0 break-words font-bold" style={{ color, fontSize: mm(TYPE_SCALE.value * scale) }}>{value || '—'}</span>
  </div>
)

/** One card face, drawn at the template's real millimetre size. */
export function IdCardFace({
  template,
  card,
  side = 'front',
  school = FALLBACK_SCHOOL,
  scale = 1,
}: {
  template: IdCardTemplate
  card?: IdCard
  side?: IdCardSide
  school?: IdCardSchool
  scale?: number
}) {
  const width = template.orientation === 'Portrait' ? Math.min(template.widthMm, template.heightMm) : template.widthMm
  const height = template.orientation === 'Portrait' ? Math.max(template.widthMm, template.heightMm) : template.heightMm
  const cardNo = cardValue(card, 'cardNo')
  const payload = idCardQrPayload({ cardNo } as IdCard)
  const name = template.schoolName || school.name
  const address = template.address || school.address
  const contact = template.contact || school.contact
  const motto = template.motto || school.motto

  /* Two scales: `ts` sizes the furniture (logo, QR, barcode, padding) to the
   * card, `fts` sizes the type — it adds the template's text size on top. The
   * text size must not shrink the details, so the fitting below only ever
   * trims them when the card genuinely runs out of room. */
  // Scale from the card's shorter side: a portrait badge is tall but narrow, and
  // it is the width that decides how big the letters can be.
  const ts = typeScale(Math.min(width, height))
  const fts = ts * (template.fontScale || 1)
  /* The furniture (logo, QR, barcode, photo, padding) is sized from `cs`: it
   * gives way as the text size grows, so picking a bigger size really does make
   * the details bigger instead of being capped at whatever already fitted. */
  const cs = ts / Math.pow(template.fontScale || 1, 0.6)
  const upperLabels = template.labelCase === 'UPPERCASE'
  /** Artwork imported for this face only — front and back have their own. */
  const background = (side === 'front' ? template.frontBackground : template.backBackground) || ''
  const backgroundOpacity = clamp((template.backgroundOpacity ?? 1) || 1, 0.05, 1)

  const qrInHeader = side === 'front' && template.showQr && template.qrPosition === 'Top right'
  const qrInFooter = side === 'front' && template.showQr && template.qrPosition !== 'Top right'
  const stacked = template.photoPosition === 'Top' || template.photoPosition === 'Bottom'
  const backFields = template.backFields.filter((key) => !['qr', 'barcode', 'signature'].includes(key))
  const backHasCodes = side === 'back' && (template.backFields.includes('qr') || template.backFields.includes('barcode'))

  /* ---------------------------------------------------------------- fitting
   * A card is a fixed piece of plastic: header + details + footer have to fit
   * inside it. Rather than clip the QR off the bottom (or hide the last field
   * rows), the detail type shrinks just enough to fit — and stays at full size
   * for templates that are not overloaded.
   */
  const headerTextMm = (TYPE_SCALE.schoolName + 2 * TYPE_SCALE.addressLine) * 1.2 * cs
  const headerMm = Math.max((qrInHeader ? QR_FRONT_MM : LOGO_MM) * cs, headerTextMm) + 2.4 * cs
  const footerTextMm = 2 * TYPE_SCALE.footer * 1.2 * fts
  const footerMm = Math.max(
    (side === 'front'
      ? (qrInFooter ? Math.max(QR_FRONT_MM * cs, QR_MIN_MM) / Math.max(cs, 0.001) + 1.2 : template.showBarcode ? 6 : 4)
      : (template.showSignature && template.backFields.includes('signature') ? 7 : 4.5) + 1.2) * cs,
    footerTextMm + 1.2 * cs,
  )
  const codesMm = backHasCodes ? (QR_BACK_MM + 2) * cs : 0
  const bodyMm = Math.max(10, height - headerMm - footerMm - codesMm - 2.4 * cs)

  /* The photo is sized from the space the body actually has, so it never
   * overflows the card and never squashes the details beside or under it. */
  const photoGap = 2 * cs
  const photoMm = template.showPhoto
    ? (stacked
      ? clamp(bodyMm * 0.38, PHOTO_STACKED_MM * 0.36, PHOTO_STACKED_MM * cs)
      : clamp(bodyMm, PHOTO_SIDE_MM * 0.7, PHOTO_SIDE_MM * cs))
    : 0
  // Stacked photos take their slice first; side-on photos sit beside the fields.
  const available = Math.max(8, bodyMm - (stacked && template.showPhoto ? photoMm + photoGap : 0))
  const rows = side === 'front' ? template.frontFields.length : backFields.length
  const pitch = (TYPE_SCALE.value * 1.25 + 0.8) * fts
  /* Stacked layouts have the full card width but lose the photo's height, so a
   * long field list wraps into two columns instead of shrinking to nothing. */
  const columns = stacked && rows > 3 && rows * pitch > available ? 2 : 1
  /* Largest type that still fits the rows into the space left over. The text
   * size picks the type; this only trims it when the card truly runs out of
   * room — so raising the size can never leave the details smaller than before. */
  const rowCount = Math.max(1, Math.ceil(rows / columns))
  const maxFs = rows ? available / (rowCount * (TYPE_SCALE.value * 1.25 + 0.8)) : fts
  const fs = Math.min(fts, Math.max(maxFs, 0.5 * cs))
  const fit = fts ? fs / fts : 1

  /* Never let the QR shrink past what a phone can reliably scan. */
  const qrBlock = (sizeMm: number) => (
    <div
      className="shrink-0 bg-white"
      style={{ padding: mm(0.5 * cs), borderRadius: mm(1 * cs), width: mm(Math.max(sizeMm * cs, QR_MIN_MM)), height: mm(Math.max(sizeMm * cs, QR_MIN_MM)) }}
    >
      <QRCodeSVG value={payload || 'IDC:SAMPLE'} size={48} level="M" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )

  const barcodeBlock = template.showBarcode || side === 'back' ? (
    <div className="min-w-0 flex-1">
      <Barcode value={cardNo || 'SAMPLE'} height={px(4.2 * cs)} width={Number((0.8 * cs).toFixed(2))} fontSize={px(TYPE_SCALE.footer * fs)} />
    </div>
  ) : null

  const cardMeta = (align: 'left' | 'right') => (
    <div className={`min-w-0 leading-tight opacity-80 ${align === 'right' ? 'text-right' : 'text-left'}`} style={{ fontSize: mm(TYPE_SCALE.footer * fts) }}>
      <div>{cardNo || 'IDC-0000'}</div>
      <div>{cardValue(card, 'academicYear')}</div>
    </div>
  )

  return (
    <div
      style={{
        // Reserves the enlarged footprint only — the face below does the scaling,
        // so `scale` is applied once, not twice.
        width: `${width * scale}mm`,
        height: `${height * scale}mm`,
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        data-id-card-side={side}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
          background: template.backgroundColor,
          color: template.textColor,
          fontFamily: fontStack(template.fontFamily),
          border: '0.4mm solid rgba(15,23,42,0.25)',
          borderRadius: '2mm',
          boxSizing: 'border-box',
        }}
      >
        {/* Imported background artwork — behind everything, never interactive */}
        {background && (
          <img
            src={background}
            alt=""
            aria-hidden="true"
            data-id-card-background={side}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: backgroundFitCss(template.backgroundFit),
              objectPosition: 'center',
              opacity: backgroundOpacity,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Header: logo, school name, address, contact, motto */}
        <div
          className="flex items-center"
          style={{ position: 'relative', zIndex: 1, background: template.headerColor, color: '#fff', gap: mm(1.5 * cs), padding: `${mm(1.2 * cs)} ${mm(2 * cs)}` }}
        >
          {template.showLogo && (
            school.logo
              ? <img src={school.logo} alt="" className="shrink-0" style={{ width: mm(LOGO_MM * cs), height: mm(LOGO_MM * cs), objectFit: 'contain', background: '#fff', borderRadius: mm(1 * cs), padding: mm(0.4 * cs) }} />
              : (
                <div
                  className="flex shrink-0 items-center justify-center font-black"
                  style={{ width: mm(LOGO_MM * cs), height: mm(LOGO_MM * cs), fontSize: mm(TYPE_SCALE.schoolName * cs), background: '#fff', color: template.headerColor, borderRadius: mm(1 * cs) }}
                >
                  {initials(name)}
                </div>
              )
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-extrabold uppercase tracking-wide" style={{ fontSize: mm(TYPE_SCALE.schoolName * cs) }}>{name}</div>
            {address && <div className="truncate opacity-90" style={{ fontSize: mm(TYPE_SCALE.addressLine * cs) }}>{address}</div>}
            {contact && <div className="truncate opacity-90" style={{ fontSize: mm(TYPE_SCALE.addressLine * cs) }}>{contact}</div>}
          </div>
          {qrInHeader && qrBlock(QR_FRONT_MM)}
        </div>

        {side === 'front' ? (
          <div className={frontLayoutClass(template.photoPosition)} style={{ position: 'relative', zIndex: 1, padding: `${mm(1.2 * cs)} ${mm(2 * cs)}`, minHeight: 0 }}>
            {template.showPhoto && <Photo card={card} template={template} scale={ts} heightMm={photoMm} />}
            <div
              className={`${stackedClass(template.photoPosition)} min-h-0`}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                columnGap: mm(2 * fs),
                rowGap: mm(0.8 * fs),
                alignContent: 'start',
              }}
            >
              {template.frontFields.map((key) => (
                <FieldLine key={key} label={fieldLabel(key)} value={cardValue(card, key)} color={template.textColor} scale={fs} upper={upperLabels} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between" style={{ position: 'relative', zIndex: 1, padding: `${mm(1.2 * cs)} ${mm(2 * cs)}` }}>
            <div className="flex min-h-0 flex-col justify-center" style={{ gap: mm(0.8 * fs) }}>
              {backFields.map((key) => {
                if (key === 'schoolAddress') return <p key={key} className="leading-tight" style={{ fontSize: mm(TYPE_SCALE.backText * fs) }}>{address}</p>
                if (key === 'schoolContact') return <p key={key} className="leading-tight" style={{ fontSize: mm(TYPE_SCALE.backText * fs) }}>{contact}</p>
                if (key === 'motto') return <p key={key} className="italic leading-tight" style={{ fontSize: mm(TYPE_SCALE.backText * fs) }}>{motto}</p>
                if (key === 'validity') {
                  return (
                    <p key={key} className="leading-tight" style={{ fontSize: mm(TYPE_SCALE.backText * fs) }}>
                      Valid until <strong>{cardValue(card, 'expiryDate') || '—'}</strong>
                    </p>
                  )
                }
                if (key === 'returnNote') return <p key={key} className="leading-tight opacity-80" style={{ fontSize: mm(TYPE_SCALE.note * fs) }}>{template.backNote}</p>
                return <FieldLine key={key} label={fieldLabel(key)} value={cardValue(card, key)} color={template.textColor} scale={fs} upper={upperLabels} />
              })}
            </div>
            {backHasCodes && (
              <div className="flex items-end" style={{ gap: mm(2 * cs) }}>
                {template.backFields.includes('qr') && qrBlock(QR_BACK_MM)}
                {template.backFields.includes('barcode') && barcodeBlock}
              </div>
            )}
          </div>
        )}

        {/* Footer strip: QR + barcode on the front, signature on the back */}
        <div
          className="flex items-end justify-between"
          style={{ position: 'relative', zIndex: 1, borderTop: `0.4mm solid ${template.accentColor}`, gap: mm(2 * cs), padding: `0 ${mm(2 * cs)} ${mm(1.2 * cs)}` }}
        >
          {side === 'front' ? (
            template.qrPosition === 'Bottom left' ? (
              <>
                {qrInFooter && qrBlock(QR_FRONT_MM)}
                {template.showBarcode && barcodeBlock}
              </>
            ) : (
              <>
                {template.showBarcode ? barcodeBlock : <span />}
                {qrInFooter ? qrBlock(QR_FRONT_MM) : <span className="opacity-80" style={{ fontSize: mm(TYPE_SCALE.footer * fts) }}>{cardNo || 'IDC-0000'}</span>}
              </>
            )
          ) : (
            <>
              <div className="leading-tight opacity-80" style={{ fontSize: mm(TYPE_SCALE.footer * fts) }}>
                {motto && <div className="italic">{motto}</div>}
                <div>{cardNo || 'IDC-0000'}</div>
                <div>{cardValue(card, 'academicYear')}</div>
              </div>
              {template.showSignature && template.backFields.includes('signature') && (
                <div className="text-center">
                  <div style={{ borderTop: '0.3mm solid #0f172a', width: mm(26 * cs), margin: '0 auto', paddingTop: mm(0.6 * cs) }} />
                  <div className="font-bold" style={{ fontSize: mm(TYPE_SCALE.signature * fts) }}>{template.signatureName || 'Authorised Signatory'}</div>
                  <div className="opacity-80" style={{ fontSize: mm(TYPE_SCALE.footer * fts) }}>{template.signatureTitle}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** PVC pages are cut to the card, so a custom size prints at true size. */
const printCss = (widthMm: number, heightMm: number) => `
  #idcard-print-sheet { display: none; }
  @media print {
    #root { display: none !important; }
    #idcard-print-sheet { display: block; }
    @page pvc-page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    @page a4-page { size: A4 portrait; margin: 8mm; }
    #idcard-print-sheet.idc-pvc { page: pvc-page; }
    #idcard-print-sheet.idc-a4 { page: a4-page; }
    #idcard-print-sheet .idc-page { break-after: page; page-break-after: always; overflow: hidden; }
    #idcard-print-sheet .idc-page:last-child { break-after: auto; page-break-after: auto; }
    #idcard-print-sheet .idc-grid { display: flex; flex-wrap: wrap; gap: 3mm; align-content: flex-start; }
    #idcard-print-sheet .idc-cell { border: 0.2mm dashed rgba(15,23,42,0.25); }
    #idcard-print-sheet .idc-card { break-inside: avoid; page-break-inside: avoid; }
    /* Keep imported background artwork in the printout. */
    #idcard-print-sheet .idc-card, #idcard-print-sheet .idc-card * {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
  }
`

export type IdCardPrintLayout = 'PVC' | 'A4'
export type IdCardPrintSides = 'Front' | 'Back' | 'Both'

/** Hidden print-only sheet. Mount it, and it prints itself then calls `onDone`. */
export function IdCardPrintSheet({
  template,
  cards,
  school,
  layout,
  sides,
  onDone,
}: {
  template: IdCardTemplate
  cards: IdCard[]
  school: IdCardSchool
  layout: IdCardPrintLayout
  sides: IdCardPrintSides
  onDone: () => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 120)
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
    }
  }, [onDone])

  const faces: { card: IdCard; side: IdCardSide }[] = []
  const push = (side: IdCardSide) => {
    for (const card of cards) faces.push({ card, side })
  }
  if (sides === 'Front' || sides === 'Both') push('front')
  if (sides === 'Back' || sides === 'Both') {
    // Backs print in reverse so a duplex run lines up front-to-back.
    if (sides === 'Both' && layout === 'A4') for (const card of [...cards].reverse()) faces.push({ card, side: 'back' })
    else push('back')
  }

  const fitPerRow = Math.max(1, Math.floor((186 + 3) / (template.widthMm + 3)))
  const perRow = layout === 'A4' ? Math.max(1, Math.min(4, Math.min(template.cardsPerRow || 2, fitPerRow))) : 1
  const pages: { card: IdCard; side: IdCardSide }[][] = []
  if (layout === 'PVC') {
    for (const face of faces) pages.push([face])
  } else {
    const perColumn = Math.max(1, Math.floor(240 / (template.heightMm + 4)))
    const perPage = perRow * perColumn
    for (let index = 0; index < faces.length; index += perPage) pages.push(faces.slice(index, index + perPage))
  }

  return createPortal(
    <>
      <style>{printCss(template.widthMm, template.heightMm)}</style>
      <div id="idcard-print-sheet" className={layout === 'PVC' ? 'idc-pvc' : 'idc-a4'}>
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className="idc-page">
            <div className={layout === 'A4' ? 'idc-grid' : undefined}>
              {page.map((face, faceIndex) => (
                <div key={`${face.card.id}-${face.side}-${faceIndex}`} className={layout === 'A4' ? 'idc-cell idc-card' : 'idc-card'}>
                  <IdCardFace template={template} card={face.card} side={face.side} school={school} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>,
    document.body,
  )
}

import type { ParsedLessonNote } from './lessonNoteCurriculum'

function escapeXml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Standard IEEE 802.3 CRC-32 for valid ZIP archives. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Build a valid uncompressed (STORE) ZIP Uint8Array from UTF-8 files. */
function buildZipArchive(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder()
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name)
    const dataBytes = encoder.encode(f.content)
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      offset: 0,
    }
  })

  let localSize = 0
  for (const e of entries) {
    e.offset = localSize
    localSize += 30 + e.nameBytes.length + e.dataBytes.length
  }

  let centralSize = 0
  for (const e of entries) {
    centralSize += 46 + e.nameBytes.length
  }

  const totalSize = localSize + centralSize + 22
  const out = new Uint8Array(totalSize)
  const view = new DataView(out.buffer)
  let pos = 0

  for (const e of entries) {
    view.setUint32(pos, 0x04034b50, true) // Local file header signature
    view.setUint16(pos + 4, 20, true) // Version needed (2.0)
    view.setUint16(pos + 6, 0x0800, true) // UTF-8 flag
    view.setUint16(pos + 8, 0, true) // Compression = 0 (STORE)
    view.setUint16(pos + 10, 0, true) // Mod time
    view.setUint16(pos + 12, 0x559d, true) // Mod date
    view.setUint32(pos + 14, e.crc, true)
    view.setUint32(pos + 18, e.dataBytes.length, true)
    view.setUint32(pos + 22, e.dataBytes.length, true)
    view.setUint16(pos + 26, e.nameBytes.length, true)
    view.setUint16(pos + 28, 0, true)
    pos += 30
    out.set(e.nameBytes, pos)
    pos += e.nameBytes.length
    out.set(e.dataBytes, pos)
    pos += e.dataBytes.length
  }

  const centralOffset = pos
  for (const e of entries) {
    view.setUint32(pos, 0x02014b50, true) // Central directory header signature
    view.setUint16(pos + 4, 20, true) // Version made by
    view.setUint16(pos + 6, 20, true) // Version needed
    view.setUint16(pos + 8, 0x0800, true) // UTF-8 flag
    view.setUint16(pos + 10, 0, true) // Compression = 0 (STORE)
    view.setUint16(pos + 12, 0, true)
    view.setUint16(pos + 14, 0x559d, true)
    view.setUint32(pos + 16, e.crc, true)
    view.setUint32(pos + 20, e.dataBytes.length, true)
    view.setUint32(pos + 24, e.dataBytes.length, true)
    view.setUint16(pos + 28, e.nameBytes.length, true)
    view.setUint16(pos + 30, 0, true)
    view.setUint16(pos + 32, 0, true)
    view.setUint16(pos + 34, 0, true)
    view.setUint16(pos + 36, 0, true)
    view.setUint32(pos + 38, 0, true)
    view.setUint32(pos + 42, e.offset, true)
    pos += 46
    out.set(e.nameBytes, pos)
    pos += e.nameBytes.length
  }

  // End of central directory record
  view.setUint32(pos, 0x06054b50, true)
  view.setUint16(pos + 4, 0, true)
  view.setUint16(pos + 6, 0, true)
  view.setUint16(pos + 8, entries.length, true)
  view.setUint16(pos + 10, entries.length, true)
  view.setUint32(pos + 12, centralSize, true)
  view.setUint32(pos + 16, centralOffset, true)
  view.setUint16(pos + 20, 0, true)

  return out
}

function wParagraphs(
  text: string,
  opts?: { bold?: boolean; color?: string; sizeHalfPt?: number; align?: 'left' | 'center' },
): string {
  const lines = String(text || '—').split(/\r?\n/)
  const sz = opts?.sizeHalfPt ?? 20
  const color = opts?.color ?? '1E293B'
  const jc = opts?.align === 'center' ? '<w:jc w:val="center"/>' : ''
  return lines
    .map(
      (line) => `<w:p>
        <w:pPr><w:spacing w:before="40" w:after="40"/>${jc}</w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
            ${opts?.bold ? '<w:b/>' : ''}
            <w:color w:val="${color}"/>
            <w:sz w:val="${sz}"/>
            <w:szCs w:val="${sz}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(line)}</w:t>
        </w:r>
      </w:p>`,
    )
    .join('')
}

function wCell(
  innerXml: string,
  opts?: { widthDxa?: number; gridSpan?: number; fillHex?: string },
): string {
  const wProp = opts?.widthDxa
    ? `<w:tcW w:w="${opts.widthDxa}" w:type="dxa"/>`
    : '<w:tcW w:w="0" w:type="auto"/>'
  const spanProp = opts?.gridSpan && opts.gridSpan > 1 ? `<w:gridSpan w:val="${opts.gridSpan}"/>` : ''
  const shdProp = opts?.fillHex
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fillHex}"/>`
    : ''
  return `<w:tc>
    <w:tcPr>${wProp}${spanProp}${shdProp}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:left w:w="130" w:type="dxa"/><w:right w:w="130" w:type="dxa"/></w:tcMar></w:tcPr>
    ${innerXml}
  </w:tc>`
}

export function buildLessonNoteDocxBytes(
  note: ParsedLessonNote,
  orientation: 'portrait' | 'landscape',
): Uint8Array {
  const isLandscape = orientation === 'landscape'
  const pageW = isLandscape ? 16838 : 11906
  const pageH = isLandscape ? 11906 : 16838
  const contentW = pageW - 1440 // 0.5in left + 0.5in right margins

  const col1 = Math.round(contentW * 0.22)
  const col2 = Math.round(contentW * 0.34)
  const col3 = Math.round(contentW * 0.18)
  const col4 = contentW - col1 - col2 - col3

  const pCol1 = Math.round(contentW * 0.20)
  const pCol2 = Math.round(contentW * 0.56)
  const pCol3 = contentW - pCol1 - pCol2

  const termBanner = `${note.term.toUpperCase()} – WEEKLY LESSON NOTES`

  const lessonBlocksXml = note.dailyLessons
    .map((lesson, idx) => {
      const pageBreak =
        idx > 0 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : ''

      return `${pageBreak}
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="${contentW}" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          ${wCell(
            wParagraphs(termBanner, { bold: true, color: 'FFFFFF', sizeHalfPt: 24, align: 'center' }) +
              wParagraphs(
                `${note.week} · ${note.subject} · ${note.schoolName}${note.teacher ? ` · Facilitator: ${note.teacher}` : ''}`,
                { bold: false, color: 'E0E7FF', sizeHalfPt: 18, align: 'center' },
              ),
            { widthDxa: contentW, gridSpan: 4, fillHex: '4F46E5' },
          )}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Week Ending', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.weekEnding), { widthDxa: col2 })}
          ${wCell(wParagraphs('Day', { bold: true }), { widthDxa: col3, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(`${lesson.day} (Lesson ${lesson.lessonNumber} of ${note.dailyLessons.length})`), { widthDxa: col4 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Duration', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.duration), { widthDxa: col2 })}
          ${wCell(wParagraphs('Strand', { bold: true }), { widthDxa: col3, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.strand), { widthDxa: col4 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Class', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.className), { widthDxa: col2 })}
          ${wCell(wParagraphs('Class Size', { bold: true }), { widthDxa: col3, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.classSize), { widthDxa: col4 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Sub Strand', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.subStrand), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Content Standard', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(note.contentStandard), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Indicator', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(lesson.indicatorText), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Performance Indicator', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(lesson.performanceIndicator), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Core Competencies', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(lesson.coreCompetencies), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('References', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(lesson.references), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
        <w:tr>
          ${wCell(wParagraphs('Keywords', { bold: true }), { widthDxa: col1, fillHex: 'F8FAFC' })}
          ${wCell(wParagraphs(lesson.keywords), { widthDxa: col2 + col3 + col4, gridSpan: 3 })}
        </w:tr>
      </w:tbl>

      <w:p><w:pPr><w:spacing w:before="80" w:after="40"/></w:pPr></w:p>

      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="${contentW}" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tr>
          ${wCell(wParagraphs('Phase / Duration', { bold: true, color: '1E1B4B' }), { widthDxa: pCol1, fillHex: 'EEF2FF' })}
          ${wCell(wParagraphs('Learners Activities', { bold: true, color: '1E1B4B' }), { widthDxa: pCol2, fillHex: 'EEF2FF' })}
          ${wCell(wParagraphs('Resources (TLMs)', { bold: true, color: '1E1B4B' }), { widthDxa: pCol3, fillHex: 'EEF2FF' })}
        </w:tr>
        <w:tr>
          ${wCell(
            wParagraphs('PHASE 1: STARTER', { bold: true, color: '4338CA' }) +
              wParagraphs(`(${lesson.starterDuration} — Preparing the Brain)`, { sizeHalfPt: 18, color: '475569' }),
            { widthDxa: pCol1, fillHex: 'F8FAFC' },
          )}
          ${wCell(wParagraphs(lesson.starterActivities), { widthDxa: pCol2 })}
          ${wCell(wParagraphs(lesson.resources), { widthDxa: pCol3 })}
        </w:tr>
        <w:tr>
          ${wCell(
            wParagraphs('PHASE 2: NEW LEARNING', { bold: true, color: '4338CA' }) +
              wParagraphs(`(${lesson.mainDuration} — Main & Assessment)`, { sizeHalfPt: 18, color: '475569' }),
            { widthDxa: pCol1, fillHex: 'F8FAFC' },
          )}
          ${wCell(wParagraphs(lesson.mainActivities), { widthDxa: pCol2 })}
          ${wCell(wParagraphs(lesson.resources), { widthDxa: pCol3 })}
        </w:tr>
        <w:tr>
          ${wCell(
            wParagraphs('PHASE 3: REFLECTION', { bold: true, color: '4338CA' }) +
              wParagraphs(`(${lesson.reflectionDuration} — Plenary & Review)`, { sizeHalfPt: 18, color: '475569' }),
            { widthDxa: pCol1, fillHex: 'F8FAFC' },
          )}
          ${wCell(wParagraphs(lesson.reflectionActivities), { widthDxa: pCol2 })}
          ${wCell(wParagraphs('Exit tickets, learner notebooks, homework prompt'), { widthDxa: pCol3 })}
        </w:tr>
      </w:tbl>`
    })
    .join('\n')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${lessonBlocksXml}
    <w:sectPr>
      <w:pgSz w:w="${pageW}" w:h="${pageH}"${isLandscape ? ' w:orient="landscape"' : ''}/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="20"/>
    </w:rPr>
  </w:style>
</w:styles>`

  return buildZipArchive([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', content: docRelsXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/document.xml', content: documentXml },
  ])
}

export function downloadLessonNoteDocx(
  note: ParsedLessonNote,
  orientation: 'portrait' | 'landscape',
): void {
  const bytes = buildLessonNoteDocxBytes(note, orientation)
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const safeSubj = note.subject.replace(/[^a-z0-9]+/gi, '_')
  const safeClass = note.className.replace(/[^a-z0-9]+/gi, '_')
  const safeWeek = note.week.replace(/[^a-z0-9]+/gi, '')
  const safeTerm = note.term.replace(/[^a-z0-9]+/gi, '')
  const filename = `${safeSubj}_${safeClass}_${safeWeek}_${safeTerm}_LessonNote_${orientation}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

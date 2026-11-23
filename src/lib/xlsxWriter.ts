// Minimal, dependency-free .xlsx writer.
// An .xlsx file is just a ZIP archive (STORE, no compression) containing a few
// XML parts. We build it with pure TypeScript so no external package is needed.

type CellValue = string | number | boolean | null | undefined

// ---- CRC-32 (standard PKZIP polynomial) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff >>> 0
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---- Minimal ZIP (STORE method) ----
const encoder = new TextEncoder()

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Write a 16-bit little-endian value into a buffer at offset. */
function p16(buf: Uint8Array, offset: number, n: number) {
  buf[offset] = n & 0xff
  buf[offset + 1] = (n >>> 8) & 0xff
}

/** Write a 32-bit little-endian value into a buffer at offset. */
function p32(buf: Uint8Array, offset: number, n: number) {
  buf[offset] = n & 0xff
  buf[offset + 1] = (n >>> 8) & 0xff
  buf[offset + 2] = (n >>> 16) & 0xff
  buf[offset + 3] = (n >>> 24) & 0xff
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  // Pre-compute entry metadata.
  const meta = entries.map((e) => {
    const name = encoder.encode(e.name)
    const crc = crc32(e.data)
    return { name, data: e.data, crc, size: e.data.length }
  })

  // Calculate total size.
  const LOCAL_HDR = 30
  const CENTRAL_HDR = 46
  const EOCD_SIZE = 22
  let localSize = 0
  for (const m of meta) localSize += LOCAL_HDR + m.name.length + m.size
  let centralSize = 0
  for (const m of meta) centralSize += CENTRAL_HDR + m.name.length
  const total = localSize + centralSize + EOCD_SIZE

  const out = new Uint8Array(total)
  let pos = 0
  const localOffsets: number[] = []

  // --- Local file headers + data ---
  for (const m of meta) {
    localOffsets.push(pos)
    p32(out, pos, 0x04034b50); pos += 4   // signature
    p16(out, pos, 20); pos += 2           // version needed
    p16(out, pos, 0); pos += 2            // flags
    p16(out, pos, 0); pos += 2            // method (STORE)
    p16(out, pos, 0); pos += 2            // mod time
    p16(out, pos, 0x21); pos += 2         // mod date (1980-01-01)
    p32(out, pos, m.crc); pos += 4        // CRC-32
    p32(out, pos, m.size); pos += 4       // compressed size
    p32(out, pos, m.size); pos += 4       // uncompressed size
    p16(out, pos, m.name.length); pos += 2
    p16(out, pos, 0); pos += 2            // extra field length
    out.set(m.name, pos); pos += m.name.length
    out.set(m.data, pos); pos += m.size
  }

  const centralStart = pos

  // --- Central directory ---
  for (let i = 0; i < meta.length; i++) {
    const m = meta[i]
    p32(out, pos, 0x02014b50); pos += 4   // signature
    p16(out, pos, 20); pos += 2           // version made by
    p16(out, pos, 20); pos += 2           // version needed
    p16(out, pos, 0); pos += 2            // flags
    p16(out, pos, 0); pos += 2            // method
    p16(out, pos, 0); pos += 2            // mod time
    p16(out, pos, 0x21); pos += 2         // mod date
    p32(out, pos, m.crc); pos += 4
    p32(out, pos, m.size); pos += 4
    p32(out, pos, m.size); pos += 4
    p16(out, pos, m.name.length); pos += 2
    p16(out, pos, 0); pos += 2            // extra field length
    p16(out, pos, 0); pos += 2            // file comment length
    p16(out, pos, 0); pos += 2            // disk number start
    p16(out, pos, 0); pos += 2            // internal attrs
    p32(out, pos, 0); pos += 4            // external attrs
    p32(out, pos, localOffsets[i]); pos += 4
    out.set(m.name, pos); pos += m.name.length
  }

  const centralDirSize = pos - centralStart

  // --- End of central directory ---
  p32(out, pos, 0x06054b50); pos += 4
  p16(out, pos, 0); pos += 2              // disk number
  p16(out, pos, 0); pos += 2              // disk w/ central dir
  p16(out, pos, meta.length); pos += 2
  p16(out, pos, meta.length); pos += 2
  p32(out, pos, centralDirSize); pos += 4
  p32(out, pos, centralStart); pos += 4
  p16(out, pos, 0); pos += 2              // comment length

  return out.subarray(0, pos)
}

// ---- XML helpers ----
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colName(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellXml(value: CellValue, ref: string): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`
}

export type ExportRow = Record<string, unknown>

/**
 * Builds a valid .xlsx workbook as a Uint8Array, with no external dependencies.
 */
export function buildXlsx(rows: ExportRow[]): Uint8Array {
  const header = rows.length ? Object.keys(rows[0]) : []
  const allRows = rows.length ? rows : [{}]

  const sheetRows: string[] = []
  sheetRows.push('<sheetData>')

  if (header.length) {
    const cells = header.map((h, i) => cellXml(h, `${colName(i)}1`)).join('')
    sheetRows.push(`<row r="1">${cells}</row>`)
  }

  allRows.forEach((row, rIdx) => {
    const r = rIdx + (header.length ? 2 : 1)
    const keys = header.length ? header : Object.keys(row)
    const cells: string[] = []
    keys.forEach((k, i) => {
      const v = row[k] as CellValue
      const xml = cellXml(v, `${colName(i)}${r}`)
      if (xml) cells.push(xml)
    })
    if (cells.length) sheetRows.push(`<row r="${r}">${cells.join('')}</row>`)
  })

  sheetRows.push('</sheetData>')

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetRows.join('')}</worksheet>`

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Variations" sheetId="1" r:id="rId1"/></sheets></workbook>`

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(relsXml) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
    { name: 'xl/styles.xml', data: encoder.encode(stylesXml) },
  ]

  return buildZip(entries)
}

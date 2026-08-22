// Minimal, dependency-free .xlsx writer.
// An .xlsx file is just a ZIP archive (STORE, no compression) containing a few
// XML parts. We build it with pure TypeScript so no external package is needed.

type CellValue = string | number | boolean | null | undefined

// ---- CRC-32 ----
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
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---- Minimal ZIP (STORE method) ----
const encoder = new TextEncoder()

interface ZipEntry {
  name: string
  data: Uint8Array
}

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff]
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: number[] = []
  const central: number[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // Local file header
    chunks.push(...u32(0x04034b50)) // signature
    chunks.push(...u16(20)) // version needed
    chunks.push(...u16(0)) // flags
    chunks.push(...u16(0)) // method (STORE)
    chunks.push(...u16(0)) // time
    chunks.push(...u16(0x21)) // date (1980-01-01)
    chunks.push(...u32(crc))
    chunks.push(...u32(size))
    chunks.push(...u32(size))
    chunks.push(...u16(nameBytes.length))
    chunks.push(...u16(0)) // extra length
    for (let i = 0; i < nameBytes.length; i++) chunks.push(nameBytes[i])
    for (let i = 0; i < entry.data.length; i++) chunks.push(entry.data[i])

    // Central directory entry
    central.push(...u32(0x02014b50))
    central.push(...u16(20)) // version made by
    central.push(...u16(20)) // version needed
    central.push(...u16(0)) // flags
    central.push(...u16(0)) // method
    central.push(...u16(0)) // time
    central.push(...u16(0x21)) // date
    central.push(...u32(crc))
    central.push(...u32(size))
    central.push(...u32(size))
    central.push(...u16(nameBytes.length))
    central.push(...u16(0)) // extra
    central.push(...u16(0)) // comment
    central.push(...u16(0)) // disk
    central.push(...u16(0)) // internal attrs
    central.push(...u32(0)) // external attrs
    central.push(...u32(offset)) // local header offset
    for (let i = 0; i < nameBytes.length; i++) central.push(nameBytes[i])

    offset += 30 + nameBytes.length + size
  }

  const centralStart = chunks.length
  const centralSize = central.length

  // End of central directory (always last)
  const eocd: number[] = []
  eocd.push(...u32(0x06054b50))
  eocd.push(...u16(0)) // disk
  eocd.push(...u16(0)) // disk with cd
  eocd.push(...u16(entries.length))
  eocd.push(...u16(entries.length))
  eocd.push(...u32(centralSize))
  eocd.push(...u32(centralStart))
  eocd.push(...u16(0)) // comment length

  return new Uint8Array([...chunks, ...central, ...eocd])
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
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
}

export type ExportRow = Record<string, unknown>

/**
 * Builds a valid .xlsx workbook as a Uint8Array, with no external dependencies.
 */
export function buildXlsx(rows: ExportRow[]): Uint8Array {
  const header = rows.length ? Object.keys(rows[0]) : []
  const allRows = rows.length ? rows : [{}]
  const totalCols = Math.max(1, header.length)

  const sheetRows: string[] = []
  sheetRows.push('<sheetData>')

  if (header.length) {
    const cells = header.map((h, i) => cellXml(h, `${colName(i)}1`)).join('')
    sheetRows.push(`<row r="1">${cells}</row>`)
  }

  allRows.forEach((row, rIdx) => {
    const r = rIdx + (header.length ? 2 : 1)
    const cells: string[] = []
    const keys = header.length ? header : Object.keys(row)
    keys.forEach((k, i) => {
      const v = row[k] as CellValue
      const xml = cellXml(v, `${colName(i)}${r}`)
      if (xml) cells.push(xml)
    })
    if (cells.length) sheetRows.push(`<row r="${r}">${cells.join('')}</row>`)
  })

  sheetRows.push('</sheetData>')

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetRows.join('')}</worksheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs></styleSheet>`

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

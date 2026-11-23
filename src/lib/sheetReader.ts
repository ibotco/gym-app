/**
 * Dependency-free reader for the statement files people actually have:
 * `.xlsx` workbooks and `.csv` / `.txt` exports.
 *
 * An .xlsx file is a ZIP of XML parts. We read the archive by hand (central
 * directory → local headers), inflate DEFLATE entries with the browser's
 * `DecompressionStream('deflate-raw')`, then pull the cells out of
 * `xl/worksheets/sheet1.xml` (resolving shared strings). No external package,
 * matching the hand-rolled writer in `xlsxWriter.ts`.
 */

export type SheetRow = string[]

const dv = (buf: ArrayBuffer) => new DataView(buf)

/** Inflate a raw DEFLATE payload using the platform decompressor. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream
  if (!DS) throw new Error('This browser cannot read compressed .xlsx files — save the statement as CSV instead.')
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DS('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Files inside a ZIP archive, keyed by their path. */
async function unzip(buffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const view = dv(buffer)
  const bytes = new Uint8Array(buffer)
  // Locate the End Of Central Directory record (scan back over the comment).
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx workbook.')
  const count = view.getUint16(eocd + 10, true)
  let ptr = view.getUint32(eocd + 16, true)

  const out: Record<string, Uint8Array> = {}
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break
    const method = view.getUint16(ptr + 10, true)
    const compSize = view.getUint32(ptr + 20, true)
    const nameLen = view.getUint16(ptr + 28, true)
    const extraLen = view.getUint16(ptr + 30, true)
    const commentLen = view.getUint16(ptr + 32, true)
    const localOffset = view.getUint32(ptr + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen))
    // Jump to the local header to find where the data really starts.
    const lNameLen = view.getUint16(localOffset + 26, true)
    const lExtraLen = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + lNameLen + lExtraLen
    const raw = bytes.subarray(start, start + compSize)
    out[name] = method === 0 ? raw : await inflateRaw(raw)
    ptr += 46 + nameLen + extraLen + commentLen
  }
  return out
}

const text = (b?: Uint8Array) => (b ? new TextDecoder().decode(b) : '')

/** Column letters (A, B, …, AA) → zero-based index. */
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Excel serial date → ISO date (1900 date system, Lotus leap-year quirk). */
export const excelSerialToIso = (serial: number): string => {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** Rows of the first worksheet, as raw strings (dates become ISO). */
export async function readXlsx(file: File): Promise<SheetRow[]> {
  const files = await unzip(await file.arrayBuffer())
  const sheetPath = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k))
    || Object.keys(files).find((k) => /^xl\/worksheets\/.*\.xml$/i.test(k))
  if (!sheetPath) throw new Error('The workbook has no worksheet.')
  const doc = new DOMParser().parseFromString(text(files[sheetPath]), 'application/xml')

  // Shared strings table (cells with t="s" point into it).
  const shared: string[] = []
  const sharedXml = Object.keys(files).find((k) => /sharedStrings\.xml$/i.test(k))
  if (sharedXml) {
    const sdoc = new DOMParser().parseFromString(text(files[sharedXml]), 'application/xml')
    sdoc.querySelectorAll('si').forEach((si) => shared.push(si.textContent || ''))
  }

  const rows: SheetRow[] = []
  doc.querySelectorAll('sheetData > row').forEach((row) => {
    const cells: string[] = []
    row.querySelectorAll('c').forEach((c) => {
      const ref = c.getAttribute('r') || ''
      const idx = ref ? colIndex(ref) : cells.length
      const type = c.getAttribute('t')
      const style = c.getAttribute('s')
      let value = ''
      if (type === 's') value = shared[Number(c.querySelector('v')?.textContent || 0)] || ''
      else if (type === 'inlineStr') value = c.querySelector('is')?.textContent || ''
      else value = c.querySelector('v')?.textContent || ''
      // Numbers carrying a date style come through as serials — normalise them.
      if (!type && style && /^\d+(\.\d+)?$/.test(value) && Number(value) > 20000 && Number(value) < 80000) {
        const iso = excelSerialToIso(Number(value))
        if (iso) value = iso
      }
      while (cells.length < idx) cells.push('')
      cells[idx] = value
    })
    rows.push(cells)
  })
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

/** Rows of a delimited text file (comma, semicolon or tab), quote-aware. */
export function readDelimited(content: string): SheetRow[] {
  const firstLine = content.split(/\r?\n/)[0] || ''
  const delim = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows: SheetRow[] = []
  let cell = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (quoted) {
      if (ch === '"') {
        if (content[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === delim) { row.push(cell); cell = ''; continue }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Read any supported statement file into rows. */
export async function readSheet(file: File): Promise<SheetRow[]> {
  if (/\.xlsx$/i.test(file.name)) return readXlsx(file)
  if (/\.xls$/i.test(file.name)) throw new Error('Legacy .xls files are not supported — save as .xlsx or CSV.')
  return readDelimited(await file.text())
}

/** Best-effort date parser for the formats banks export. */
export function parseStatementDate(raw: string): string {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  if (/^\d+(\.\d+)?$/.test(v) && Number(v) > 20000 && Number(v) < 80000) return excelSerialToIso(Number(v))
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(v)
  if (dmy) {
    const [, a, b, c] = dmy
    const year = c.length === 2 ? `20${c}` : c
    // Day-first unless the first number cannot be a day.
    const day = Number(a) > 12 ? a : a
    const month = Number(a) > 12 ? b : b
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const parsed = new Date(v)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

/** Money parser tolerant of thousands separators, currency codes and (123.45). */
export function parseStatementAmount(raw: string): number {
  let v = String(raw ?? '').trim()
  if (!v) return 0
  const negative = /^\(.*\)$/.test(v) || /-\s*$/.test(v) || v.startsWith('-')
  v = v.replace(/[()]/g, '').replace(/[^0-9.,-]/g, '')
  // 1.234,56 (European) → 1234.56
  if (/,\d{2}$/.test(v) && v.includes('.')) v = v.replace(/\./g, '').replace(',', '.')
  else v = v.replace(/,/g, '')
  const n = Math.abs(Number(v.replace(/-/g, '')) || 0)
  return negative ? -n : n
}

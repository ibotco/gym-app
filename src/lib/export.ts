import { downloadText, toCsv } from './utils'
import { buildXlsx, type ExportRow } from './xlsxWriter'

export type { ExportRow }

/**
 * Generates and downloads a real .xlsx workbook from row objects.
 * Built with a dependency-free writer (no `xlsx` package), so it always works
 * — including fully offline with no external modules installed.
 */
export async function exportExcel(filename: string, rows: ExportRow[]): Promise<boolean> {
  const safe = filename.replace(/\.xlsx?$/i, '')
  try {
    const data = buildXlsx(rows)
    // Copy into a fresh ArrayBuffer sized exactly to the data length so the
    // Blob doesn't see the pre-allocated tail padding from the Uint8Array.
    const ab = new ArrayBuffer(data.byteLength)
    new Uint8Array(ab).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    return await downloadBlob(`${safe}.xlsx`, blob)
  } catch {
    // Absolute last resort: fall back to CSV so the user still gets their data.
    return await exportCsv(safe, rows)
  }
}

/** Downloads rows as CSV. */
export function exportCsv(filename: string, rows: ExportRow[]): Promise<boolean> {
  const safe = filename.replace(/\.csv$/i, '')
  return downloadText(`${safe}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
}

/**
 * Downloads a Blob, trying the File System Access API first and falling back
 * to an anchor + object URL (mirrors downloadText but for binary data).
 */
async function downloadBlob(filename: string, blob: Blob): Promise<boolean> {
  const w = window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<{ createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }> }> }
  if (w.showSaveFilePicker) {
    try {
      const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : ''
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Spreadsheet', accept: { [blob.type]: [ext || '.xlsx'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return true
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return true
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    window.setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)
    return true
  } catch {
    return false
  }
}

/** Triggers the browser print dialog (Print → Save as PDF). */
export function exportPdf(): void {
  window.print()
}

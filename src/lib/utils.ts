import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatGhs(n: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatGhsExact(n: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(n)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function otp6() {
  try {
    const n = crypto.getRandomValues(new Uint32Array(1))[0]
    return String(100000 + (n % 900000))
  } catch {
    return String(100000 + Math.floor(Math.random() * 900000))
  }
}

export function daysUntil(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return d
}

export function bmi(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) return 0
  const m = heightCm / 100
  return +(weightKg / (m * m)).toFixed(1)
}

export function bmiLabel(v: number) {
  if (v < 18.5) return 'Underweight'
  if (v < 25) return 'Healthy'
  if (v < 30) return 'Overweight'
  return 'Obese'
}

export function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<{
    createWritable: () => Promise<{ write: (d: string | Blob) => Promise<void>; close: () => Promise<void> }>
  }>
}

/**
 * Save a file using the File System Access API (native "Save as" dialog).
 * Returns true if the save completed or the user deliberately cancelled,
 * false if the API is unavailable or threw (caller should fall back).
 */
async function saveWithFilePicker(filename: string, content: string, type: string): Promise<boolean> {
  const w = window as SaveFilePickerWindow
  if (!w.showSaveFilePicker) return false
  try {
    const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : ''
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'File', accept: { [type]: [ext || '.txt'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    return true
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return true // user cancelled the dialog
    return false
  }
}

/**
 * Downloads content as a file. Tries the File System Access API first
 * (most reliable), then falls back to a DOM anchor + Blob URL.
 * Returns true if a save was initiated, false if all methods failed.
 */
export async function downloadText(filename: string, content: string, type = 'text/csv'): Promise<boolean> {
  if (await saveWithFilePicker(filename, content, type)) return true

  try {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    // The anchor must be in the DOM for the download to trigger reliably
    // (Firefox and Safari ignore clicks on detached anchors).
    document.body.appendChild(a)
    a.click()
    // Delay revocation so the browser has time to start the download.
    window.setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)
    return true
  } catch {
    return false
  }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

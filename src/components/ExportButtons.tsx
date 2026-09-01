import { FileSpreadsheet, FileText, FileDown, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'
import { exportExcel, exportCsv, exportPdf, type ExportRow } from '../lib/export'

const BTN = 'inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5'
const ICON = 'size-5'
const ICON_STYLE = { width: 20, height: 20 } as const

export function ExportButtons({
  filename,
  rows,
  onDone,
  compact,
  className,
}: {
  /** Base filename without extension (e.g. "members"). */
  filename: string
  rows: ExportRow[]
  onDone?: (label: string, ok: boolean) => void
  compact?: boolean
  className?: string
}) {
  const [busy, setBusy] = useState<'' | 'excel' | 'csv'>('')
  const [done, setDone] = useState<'' | 'excel' | 'csv'>('')

  const run = async (kind: 'excel' | 'csv') => {
    setBusy(kind)
    setDone('')
    const ok = kind === 'excel' ? await exportExcel(filename, rows) : await exportCsv(filename, rows)
    setBusy('')
    setDone(kind)
    window.setTimeout(() => setDone(''), 1500)
    onDone?.(kind === 'excel' ? 'Excel' : 'CSV', ok)
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button type="button" className={cn(BTN, 'text-[#1d6f42] dark:text-emerald-300')} onClick={() => void run('excel')} title="Export as Excel (.xlsx)">
        {done === 'excel' ? <Check className={ICON} style={ICON_STYLE} /> : <FileSpreadsheet className={ICON} style={ICON_STYLE} />}
        {!compact && <span>Excel</span>}
      </button>
      <button type="button" className={cn(BTN, 'text-zinc-600 dark:text-zinc-300')} onClick={() => void run('csv')} title="Export as CSV">
        {done === 'csv' ? <Check className={ICON} style={ICON_STYLE} /> : <FileText className={ICON} style={ICON_STYLE} />}
        {!compact && <span>CSV</span>}
      </button>
      <button type="button" className={cn(BTN, 'text-[#b42318] dark:text-rose-300')} onClick={exportPdf} title="Print / save as PDF">
        <FileDown className={ICON} style={ICON_STYLE} />
        {!compact && <span>PDF</span>}
      </button>
      {busy && <span className="text-xs text-mist">preparing…</span>}
    </div>
  )
}

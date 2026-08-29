import { FileSpreadsheet, FileText, FileDown, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/utils'
import { exportExcel, exportCsv, exportPdf, type ExportRow } from '../lib/export'

const BTN = 'inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5'

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
        {done === 'excel' ? <Check className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}
        {!compact && <span>Excel</span>}
      </button>
      <button type="button" className={cn(BTN, 'text-zinc-600 dark:text-zinc-300')} onClick={() => void run('csv')} title="Export as CSV">
        {done === 'csv' ? <Check className="size-3.5" /> : <FileText className="size-3.5" />}
        {!compact && <span>CSV</span>}
      </button>
      <button type="button" className={cn(BTN, 'text-[#b42318] dark:text-rose-300')} onClick={exportPdf} title="Print / save as PDF">
        <FileDown className="size-3.5" />
        {!compact && <span>PDF</span>}
      </button>
      {busy && <span className="text-[11px] text-mist">preparing…</span>}
    </div>
  )
}

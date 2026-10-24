import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui'
import { statusLabel, statusTone, PO_PROGRESS } from '../../../lib/procurement'
import { formatDate } from '../../../lib/utils'
import type { ProcPOStatus } from '../../../types'

/** Status pill that prettifies snake_case statuses and picks a consistent tone. */
export function ProcStatus({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
}

/**
 * Document progress tracker:
 * Draft → Approved → Sent → Partially Received → Fully Received
 * Terminal states (rejected/cancelled) short-circuit the trail.
 */
export function DocProgress({ status }: { status: ProcPOStatus }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-rose-500/15 px-3 py-1 font-semibold text-rose-700 dark:text-rose-300">
          {statusLabel(status)}
        </span>
        <span className="text-mist">— this document is no longer active.</span>
      </div>
    )
  }
  // 'closed' sits past the end of the trail, so show every stage complete.
  const idx = status === 'closed'
    ? PO_PROGRESS.length - 1
    : Math.max(0, PO_PROGRESS.indexOf(status === 'pending_approval' ? 'draft' : status))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PO_PROGRESS.map((stage, i) => {
        const done = i <= idx
        const current = i === idx && status !== 'closed'
        return (
          <div key={stage} className="flex items-center gap-1.5">
            <span
              className={[
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                done ? 'bg-lime/20 text-lime-ink dark:text-lime' : 'bg-zinc-500/10 text-mist',
                current ? 'ring-1 ring-lime/50' : '',
              ].join(' ')}
            >
              {statusLabel(stage)}
            </span>
            {i < PO_PROGRESS.length - 1 && (
              <span className={done && i < idx ? 'text-lime' : 'text-mist/40'}>→</span>
            )}
          </div>
        )
      })}
      {status === 'pending_approval' && (
        <span className="ml-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Awaiting approval
        </span>
      )}
    </div>
  )
}

export type TimelineEvent = { label: string; at?: string; by?: string; tone?: 'lime' | 'amber' | 'rose' | 'zinc' }

/** Vertical activity timeline used on every procurement document view. */
export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  const shown = events.filter((e) => e.at)
  if (!shown.length) return <p className="text-xs text-mist">No activity recorded yet.</p>
  return (
    <ol className="space-y-3">
      {shown.map((e, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className={[
              'mt-1 size-2 rounded-full',
              e.tone === 'rose' ? 'bg-rose-500' : e.tone === 'amber' ? 'bg-amber-400' : e.tone === 'zinc' ? 'bg-zinc-400' : 'bg-lime',
            ].join(' ')} />
            {i < shown.length - 1 && <span className="mt-1 w-px flex-1 bg-zinc-500/20" />}
          </div>
          <div className="pb-1">
            <p className="text-sm font-medium">{e.label}</p>
            <p className="text-xs text-mist">
              {e.at ? formatDate(e.at.slice(0, 10)) : ''}{e.by ? ` · ${e.by}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Card listing related documents (PO ↔ GRN ↔ requisition). */
export function RelatedDocs({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

export function DocChip({ label, onClick }: { label: string; onClick?: () => void }) {
  const cls = 'rounded-lg border border-zinc-500/20 px-2.5 py-1 font-mono text-xs'
  return onClick
    ? <button className={`${cls} hover:border-lime hover:text-lime`} onClick={onClick}>{label}</button>
    : <span className={`${cls} text-mist`}>{label}</span>
}

/** Section heading inside the document modals. */
export function SubHead({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist">{children}</p>
}

export { statusLabel, statusTone }

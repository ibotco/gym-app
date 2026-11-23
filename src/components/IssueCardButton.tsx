/**
 * A domain's own "Issue card" button.
 *
 * Card Management is one shared module, but people don't work there — they work
 * in Students, Staff or Members. This drops a small action into those screens
 * that deep-links into Card Management with the right holder type preselected
 * (and the person pre-picked when it's on a row).
 */
import { IdCard as IdCardIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type IssueCardHolder = 'Student' | 'Staff' | 'Member'

/** Where a domain's "Issue card" button lands. */
export const issueCardHref = (holder: IssueCardHolder, recordId?: string) => {
  const query = new URLSearchParams({ holder })
  if (recordId) query.set('record', recordId)
  return `/admin/card-management/id-card-generation?${query.toString()}`
}

/**
 * Compact icon button for a table row. Uses a plain anchor so it works inside
 * forms and data tables without nesting interactive elements.
 */
export function IssueCardIconButton({
  holder,
  recordId,
  title,
  className = 'rounded-md p-1.5 text-mist hover:bg-lime/10 hover:text-lime-ink dark:hover:text-lime',
}: {
  holder: IssueCardHolder
  recordId: string
  title?: string
  className?: string
}) {
  return (
    <a
      href={issueCardHref(holder, recordId)}
      className={className}
      title={title ?? 'Issue an ID card'}
      aria-label={title ?? 'Issue an ID card'}
    >
      <IdCardIcon className="size-3.5" />
    </a>
  )
}

/** Full button — for a detail page header or a list toolbar. */
export function IssueCardButton({
  holder,
  recordId,
  label = 'Issue card',
  className = 'inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-lime/50 hover:text-lime-ink dark:border-white/10',
  children,
}: {
  holder: IssueCardHolder
  recordId?: string
  label?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <a href={issueCardHref(holder, recordId)} className={className} title={`${label} — opens Card Management`}>
      <IdCardIcon className="size-4" />
      {children ?? label}
    </a>
  )
}

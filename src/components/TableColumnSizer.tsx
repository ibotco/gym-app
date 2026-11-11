import type { ReactNode } from 'react'

/**
 * Intrinsic-width content for the first cell of a fixed-layout table. It is
 * visually hidden and zero-height, but lets that column size to its widest row
 * label without disturbing the equal-width columns beside it.
 */
export function TableColumnSizer({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width: 'max-content',
        height: 0,
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {children}
    </span>
  )
}

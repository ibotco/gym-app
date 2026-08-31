import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { Empty } from './ui'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Value used for sorting; when omitted the column is not sortable. */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  render: (row: T) => ReactNode
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

const PAGE_SIZES = [10, 25, 50, 100]

export function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize: initialPageSize = 10,
  emptyTitle = 'No records',
  emptyDesc,
}: {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  pageSize?: number
  emptyTitle?: string
  emptyDesc?: string
}) {
  const [sort, setSort] = useState<SortState>(null)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [page, setPage] = useState(1)

  // Reset to first page whenever the data or page size changes.
  useEffect(() => {
    setPage(1)
  }, [data.length, pageSize])

  const sorted = useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return data
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })
  }, [data, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = sorted.slice(start, start + pageSize)

  const onSort = (key: string) => {
    const col = columns.find((c) => c.key === key)
    if (!col?.sortValue) return
    setSort((s) => {
      if (s?.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const pageNumbers = useMemo(() => {
    const out: number[] = []
    const span = 1
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - span && i <= safePage + span)) out.push(i)
      else if (out[out.length - 1] !== -1) out.push(-1)
    }
    return out
  }, [totalPages, safePage])

  const alignCls = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

  return (
    <div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = !!c.sortValue
                const active = sort?.key === c.key
                return (
                  <th key={c.key} className={cn(alignCls(c.align), c.headerClassName)}>
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className={cn(
                          'dt-sort inline-flex items-center gap-1',
                          active && 'is-active',
                        )}
                      >
                        <span>{c.header}</span>
                        {active ? (
                          sort!.dir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={cn(alignCls(c.align), c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!sorted.length && <Empty title={emptyTitle} desc={emptyDesc} />}

      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-3 py-3 dark:border-white/5">
          <div className="flex items-center gap-3 text-xs text-mist">
            <span>
              Showing <span className="font-semibold text-inherit">{start + 1}–{Math.min(start + pageSize, sorted.length)}</span> of{' '}
              <span className="font-semibold text-inherit">{sorted.length}</span>
            </span>
            <label className="flex items-center gap-1.5">
              Rows
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-line bg-transparent px-1.5 py-1 text-xs font-semibold outline-none"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            {pageNumbers.map((n, i) =>
              n === -1 ? (
                <span key={`gap-${i}`} className="px-1 text-xs text-mist">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'grid size-8 place-items-center rounded-lg text-xs font-semibold transition',
                    n === safePage ? 'bg-lime text-lime-ink' : 'text-mist hover:bg-black/5 dark:hover:bg-white/5',
                  )}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/5"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

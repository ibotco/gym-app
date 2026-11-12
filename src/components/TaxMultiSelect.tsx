// Multi-tax picker used everywhere taxes are applied (POS, sale/invoice/quote
// editors, product form, supplier invoices, project invoices). Selection is a
// list of tax names; callers combine them additively (sum of rates on the same
// taxable base) and keep writing the legacy combined taxName/taxRate fields.
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

export interface TaxOption {
  name: string
  rate: number
}

export interface TaxMultiSelectProps {
  taxes: TaxOption[]
  /** selected tax names */
  selected: string[]
  onChange: (names: string[]) => void
  disabled?: boolean
  /** show a "No tax" row that clears the selection */
  allowNone?: boolean
  emptyLabel?: string
  ariaLabel?: string
  invalid?: boolean
  className?: string
}

export const taxSummaryLabel = (names: string[], emptyLabel = 'No tax') =>
  names.length === 0 ? emptyLabel : names.join(' + ')

/** Additive combination: every selected tax applies to the same base. */
export const sumTaxRates = (taxes: TaxOption[], names: string[]) =>
  names.reduce((acc, name) => acc + (taxes.find((t) => t.name === name)?.rate || 0), 0)

/** Split a stored taxName back into a selection (legacy single value or combined "A + B"). */
export const parseTaxSelection = (
  taxName?: string | null,
  stored?: { name: string; rate?: number }[] | null,
): string[] => {
  if (stored && stored.length) return stored.map((t) => t.name)
  if (!taxName || taxName === 'none') return []
  return taxName
    .split(' + ')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function TaxMultiSelect({
  taxes,
  selected,
  onChange,
  disabled = false,
  allowNone = true,
  emptyLabel = 'No tax',
  ariaLabel = 'Taxes',
  invalid = false,
  className,
}: TaxMultiSelectProps) {
  const id = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })

  const label = taxSummaryLabel(selected, emptyLabel)

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = Math.max(r.width, 220)
      const roomBelow = window.innerHeight - r.bottom - 12
      const roomAbove = r.top - 12
      const openUp = roomBelow < 220 && roomAbove > roomBelow
      const maxHeight = Math.max(160, Math.min(320, openUp ? roomAbove : roomBelow))
      setPos({
        top: openUp ? Math.max(8, r.top - 8 - maxHeight) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        width,
        maxHeight,
      })
    }
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    const onDocDown = (e: PointerEvent | TouchEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocDown)
    document.addEventListener('touchstart', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('pointerdown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        data-tax-multiselect=""
        className={cn('nice-select-control w-full', !open && 'is-closed', disabled && 'is-disabled', className)}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
      >
        <span className={cn('nice-select-value', selected.length === 0 && 'is-placeholder')} data-testid="tax-multi-label">
          {label}
        </span>
        <ChevronDown className="nice-select-icon" strokeWidth={1.75} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-tax-multiselect=""
            role="listbox"
            aria-multiselectable
            aria-label={ariaLabel}
            className="nice-select-menu"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto' }}
          >
            {allowNone && (
              <div
                role="option"
                aria-selected={selected.length === 0}
                data-active={selected.length === 0 || undefined}
                className="nice-select-option"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange([])
                }}
              >
                {emptyLabel}
              </div>
            )}
            {taxes.length === 0 && <div className="nice-select-empty">No tax rates configured</div>}
            {taxes.map((tax) => {
              const isSel = selected.includes(tax.name)
              return (
                <div
                  key={tax.name}
                  role="option"
                  aria-selected={isSel}
                  className={cn('nice-select-option flex items-center justify-between gap-3', isSel && 'is-selected')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    toggle(tax.name)
                  }}
                >
                  <span>{tax.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {tax.rate}%
                    {isSel && <Check size={14} className="text-lime" strokeWidth={2.5} aria-hidden />}
                  </span>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Per-line taxes cell (tax_mode = PRODUCT) ─────────────────────────────
// Compact trigger with tax chips; the popup lets you toggle taxes and shows
// the live amount of every tax on this line plus the line tax total.

export interface TaxLineCellProps {
  taxes: TaxOption[]
  selected: string[]
  onChange: (names: string[]) => void
  /** Computed taxes for this line (amounts shown in the popup). */
  lineTaxes?: { name: string; rate: number; amount: number }[]
  disabled?: boolean
  /** Display only — the selection is managed at order level (GLOBAL mode). */
  readOnly?: boolean
  itemName?: string
}

export function TaxLineCell({ taxes, selected, onChange, lineTaxes, disabled = false, readOnly = false, itemName }: TaxLineCellProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, maxHeight: 260 })

  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 250
      const roomBelow = window.innerHeight - r.bottom - 12
      const roomAbove = r.top - 12
      const openUp = roomBelow < 200 && roomAbove > roomBelow
      const maxHeight = Math.max(150, Math.min(300, openUp ? roomAbove : roomBelow))
      setPos({
        top: openUp ? Math.max(8, r.top - 8 - maxHeight) : r.bottom + 6,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        maxHeight,
      })
    }
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    const onDocDown = (e: PointerEvent | TouchEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocDown)
    document.addEventListener('touchstart', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('pointerdown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (name: string) => {
    if (readOnly) return
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }
  const total = (lineTaxes || []).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const fmt = (n: number) => n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={itemName ? `Taxes for ${itemName}` : 'Line taxes'}
        data-tax-line-cell=""
        className={cn(
          'flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-line bg-white px-1.5 py-1 text-left transition hover:border-lime/60 dark:bg-zinc-900',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
      >
        {selected.length === 0 && <span className="px-0.5 text-[11px] text-muted">No tax</span>}
        {selected.slice(0, 2).map((name) => (
          <span key={name} className="rounded-full bg-lime/15 px-1.5 py-0.5 text-[10px] font-semibold text-lime">
            {name}
          </span>
        ))}
        {selected.length > 2 && (
          <span className="rounded-full bg-lime/15 px-1.5 py-0.5 text-[10px] font-semibold text-lime">
            +{selected.length - 2}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-tax-line-cell=""
            role="listbox"
            aria-multiselectable
            aria-label={itemName ? `Tax options for ${itemName}` : 'Line tax options'}
            className="nice-select-menu"
            style={{ top: pos.top, left: pos.left, width: 250, maxHeight: pos.maxHeight, overflowY: 'auto' }}
          >
            {taxes.length === 0 && <div className="nice-select-empty">No tax rates configured</div>}
            {taxes.map((tax) => {
              const isSel = selected.includes(tax.name)
              const amount = (lineTaxes || []).find((t) => t.name === tax.name)
              return (
                <div
                  key={tax.name}
                  role="option"
                  aria-selected={isSel}
                  className={cn('nice-select-option flex items-center justify-between gap-3', isSel && 'is-selected')}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    toggle(tax.name)
                  }}
                >
                  <span className="flex items-center gap-2">
                    {isSel && <Check size={13} className="text-lime" strokeWidth={2.5} aria-hidden />}
                    <span>{tax.name}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted">
                    {tax.rate}%{amount ? ` = ${fmt(amount.amount)}` : ''}
                  </span>
                </div>
              )
            })}
            {readOnly ? (
              <div className="border-t border-line px-3 py-2 text-[11px] font-semibold text-mist">
                Applied to all products — change taxes in the order&apos;s tax panel or switch to Per-product mode.
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs font-semibold">
                <span>No tax — clear</span>
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-mist transition hover:bg-white/10"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange([])
                  }}
                >
                  Clear
                </button>
              </div>
            )}
            {selected.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs font-semibold tabular-nums">
                <span>Tax total</span>
                <span>{fmt(total)}</span>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

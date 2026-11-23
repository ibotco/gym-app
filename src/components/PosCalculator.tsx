import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calculator, RotateCcw, Delete } from 'lucide-react'
import { cn } from '../lib/utils'

type Op = '+' | '−' | '×' | '÷'

const apply = (a: number, b: number, op: Op): number =>
  op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b

const fmt = (n: number) => {
  if (!Number.isFinite(n)) return 'Error'
  return String(Math.round(n * 100) / 100)
}

const KEY_BASE = 'rounded-lg py-2 text-sm font-bold transition select-none'
const KEY_NUM = 'bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
const KEY_OP = 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15'

/** Calculator popover for the POS terminal bars — mirrors the reference design:
 *  AC / CE / backspace row, operator column, green equals. */
export function PosCalculatorButton() {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 60, right: 12 })

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const width = 264
      const right = Math.max(8, Math.min(window.innerWidth - width - 8, window.innerWidth - r.right))
      const top = Math.max(8, Math.min(r.bottom + 8, window.innerHeight - 400))
      setPos({ top, right })
    }
    setOpen((o) => !o)
  }

  // Dismiss on outside interaction / Escape. Anything marked [data-pos-calc]
  // (trigger or portalled panel) counts as inside.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Element | null
      if (t && typeof t.closest === 'function' && t.closest('[data-pos-calc]')) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const [entry, setEntry] = useState('0')
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)

  const resetAll = () => { setEntry('0'); setAcc(null); setOp(null); setFresh(true) }

  const inputDigit = (d: string) => {
    if (entry === 'Error') { setAcc(null); setOp(null) }
    if (fresh || entry === 'Error') { setEntry(d); setFresh(false); return }
    if (entry.replace(/[-.]/g, '').length >= 12) return
    setEntry(entry === '0' ? d : entry + d)
  }

  const inputDot = () => {
    if (fresh || entry === 'Error') { setEntry('0.'); setFresh(false); return }
    if (!entry.includes('.')) setEntry(entry + '.')
  }

  const backspace = () => {
    if (fresh || entry === 'Error') return
    setEntry(entry.length <= 1 || (entry.length === 2 && entry.startsWith('-')) ? '0' : entry.slice(0, -1))
  }

  const clearEntry = () => { setEntry('0'); setFresh(true) }

  const chooseOp = (nextOp: Op) => {
    if (entry === 'Error') return
    const cur = parseFloat(entry)
    if (acc !== null && op && !fresh) {
      const r = apply(acc, cur, op)
      if (!Number.isFinite(r)) { resetAll(); setEntry('Error'); return }
      setAcc(r)
      setEntry(fmt(r))
    } else if (acc === null || fresh === false) {
      setAcc(cur)
    }
    setOp(nextOp)
    setFresh(true)
  }

  const equals = () => {
    if (acc === null || !op || entry === 'Error') return
    const r = apply(acc, parseFloat(entry), op)
    setEntry(Number.isFinite(r) ? fmt(r) : 'Error')
    setAcc(null)
    setOp(null)
    setFresh(true)
  }

  const percent = () => {
    if (entry === 'Error') return
    setEntry(fmt(parseFloat(entry) / 100))
    setFresh(false)
  }

  return (
    <div data-pos-calc className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Calculator"
        title="Calculator"
        className={cn(
          'flex size-9 items-center justify-center rounded-lg border border-line text-mist transition hover:text-lime',
          open && 'text-lime',
        )}
      >
        <Calculator className="size-4" aria-hidden />
      </button>

      {open && createPortal(
        <div
          data-pos-calc
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[2147483647] w-64 rounded-xl border border-line bg-white p-3 shadow-2xl dark:bg-ink-2"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist">Calculator</p>
            <button
              type="button"
              onClick={resetAll}
              title="Reset calculator"
              aria-label="Reset calculator"
              className="rounded-md p-1 text-mist transition hover:text-lime"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
          </div>

          <div className="mb-2 rounded-lg border border-line bg-black/[0.03] px-3 py-1.5 text-right dark:bg-white/5">
            <p className="h-4 text-[10px] font-semibold text-mist">{acc !== null && op ? `${fmt(acc)} ${op}` : ' '}</p>
            <p className="truncate font-mono text-xl font-bold tabular-nums" data-testid="calc-display">{entry}</p>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button type="button" className={cn(KEY_BASE, 'bg-red-500 text-white hover:bg-red-600')} onClick={resetAll}>AC</button>
            <button type="button" className={cn(KEY_BASE, 'bg-amber-500 text-white hover:bg-amber-600')} onClick={clearEntry}>CE</button>
            <button type="button" className={cn(KEY_BASE, 'bg-amber-500 text-white hover:bg-amber-600')} onClick={backspace} aria-label="Backspace"><Delete className="mx-auto size-4" aria-hidden /></button>
            <button type="button" className={cn(KEY_BASE, KEY_OP)} onClick={() => chooseOp('÷')}>÷</button>

            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('7')}>7</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('8')}>8</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('9')}>9</button>
            <button type="button" className={cn(KEY_BASE, KEY_OP)} onClick={() => chooseOp('×')}>×</button>

            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('4')}>4</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('5')}>5</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('6')}>6</button>
            <button type="button" className={cn(KEY_BASE, KEY_OP)} onClick={() => chooseOp('−')}>−</button>

            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('1')}>1</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('2')}>2</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('3')}>3</button>
            <button type="button" className={cn(KEY_BASE, KEY_OP)} onClick={() => chooseOp('+')}>+</button>

            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={() => inputDigit('0')}>0</button>
            <button type="button" className={cn(KEY_BASE, KEY_NUM)} onClick={inputDot}>.</button>
            <button type="button" className={cn(KEY_BASE, KEY_OP)} onClick={percent}>%</button>
            <button type="button" className={cn(KEY_BASE, 'bg-green-600 text-white hover:bg-green-700')} onClick={equals}>=</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

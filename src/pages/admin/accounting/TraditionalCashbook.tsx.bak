import { useMemo, useState } from 'react'
import { PageHeader, Select, Field, Empty, Segmented } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { formatGhs } from '../../../lib/utils'
import { ReportPrintSheet } from '../../../components/ReportPrintSheet'
import { ExportButtons } from '../../../components/ExportButtons'
import { DataTable, type Column } from '../../../components/DataTable'
import type { ExportRow } from '../../../lib/export'

type Fmt = 'single' | 'double' | 'triple' | 'multi' | 'analytical'
/** combined = the classic two-sided cash book; receipts/payments = one-sided books. */
type Book = 'combined' | 'receipts' | 'payments'

const FMT_LABEL: Record<Fmt, string> = {
  single: 'Single column',
  double: 'Double column',
  triple: 'Triple column',
  multi: 'Multi-bank',
  analytical: 'Analytical',
}

const BOOK_TITLE: Record<Book, string> = {
  combined: 'Traditional Cashbook',
  receipts: 'Analysis Cashbook — Receipts',
  payments: 'Analysis Cashbook — Payments',
}

const BOOK_DESC: Record<Book, string> = {
  combined: 'The classic ruled cash book — single, double or triple column, with balance b/d, paired Dr/Cr sides, totals and balance c/d.',
  receipts: 'The receipts analysis cash book — Date, Particulars, Receipt No., Total, a column per chart bank/till account (cash included) and an analysis column per posting account, with Balance b/f, receipts and payments totals, and Balance c/d.',
  payments: 'The payments analysis cash book — Date, Particulars, Voucher No., Total, a column per chart bank/till account (cash included) and an analysis column per posting account, with Balance b/f, payments and receipts totals, and Balance c/d.',
}

/** One voucher line on either side of the cash book. */
type Side = { date: string; party: string; no: string; disc: number; cash: number; bank: number; acct: string; lines: { accountId: string; amount: number }[] }

/** A rendered row: combined uses left (Dr) + right (Cr); one-sided books use left only. */
type BookRow = { kind: 'open' | 'data' | 'total' | 'close'; left: string[]; right: string[] }
/** A book row tagged with its position, so paged/pinned rows keep a stable key. */
type ScreenRow = BookRow & { _i: number }

/** Max value columns on one printed sheet before a multi-bank ledger splits
    into column-group parts (each part repeats Date/Particulars/Vch. No.). */
const PRINT_MAX_VALUE_COLS = 5

const dFmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString()
const monthName = (m: string) => new Date(`2000-${m}-01T00:00:00`).toLocaleString(undefined, { month: 'long' })

/** Compact analysis-column label: the leading word of the account name, so
    "Membership Income" heads its column as "Membership" and "Utilities &
    Expenses" as "Utilities". Un-charted ids keep a compact "ac_1234" tag. */
const shortName = (name: string) => {
  if (name.startsWith('Account ')) return name.slice('Account '.length)
  const first = name.split(/\s*[—–]\s*|\s*&\s*|,/)[0].trim()
  const word = first.split(/\s+/)[0] ?? ''
  return word.length >= 3 ? word : name
}
const num = (v: number) => (v ? formatGhs(v) : '—')

/** Value-column headers per side, for the given format. */
const VALUE_HEADS: Record<Fmt, string[]> = {
  single: ['Cash'],
  double: ['Cash', 'Bank'],
  triple: ['Disc.', 'Cash', 'Bank'],
  multi: ['Cash', 'Bank'], // placeholder — multi uses one column per bank account
  analytical: ['Total', 'Cash'], // placeholder — analytical builds Total + Cash + bank + analysis columns
}

export function TraditionalCashbookPage({ book = 'combined' }: { book?: Book } = {}) {
  const app = useApp()
  const { receipts, paymentVouchers, accounts, journals } = app

  /** The cash book's money accounts: cash & cash equivalents (accountTypeId 3)
      and bank/till accounts (detailType 'Bank' / accountTypeId 16). These form
      the Dr/Cr money columns; every transaction touching them belongs in the book. */
  const moneyAccts = useMemo(() => {
    const cash = new Set<string>()
    const bank = new Set<string>()
    for (const a of accounts) {
      const dt = (a.detailType || '').toLowerCase()
      if (a.accountTypeId === 3 || dt.includes('cash and cash equivalent') || dt === 'cash on hand' || dt === 'petty cash') cash.add(a.id)
      else if (a.accountTypeId === 16 || dt === 'bank') bank.add(a.id)
    }
    return { cash, bank }
  }, [accounts])
  const isCashAcct = (id: string) => moneyAccts.cash.has(id)
  const isMoneyAcct = (id: string) => moneyAccts.cash.has(id) || moneyAccts.bank.has(id)


  const [fmt, setFmt] = useState<Fmt>(book === 'combined' ? 'single' : 'analytical')
  // The book always opens on the CURRENT year — loading every year of a
  // growing system would slow it down. Earlier years stay selectable.
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [month, setMonth] = useState('')
  /**
   * Analysis cashbooks: which months are included. The book opens on the
   * CURRENT month — there is no "all months" option, the same way the year
   * picker has no "all years".
   */
  const [monthsSel, setMonthsSel] = useState<Set<string>>(
    () => new Set([String(new Date().getMonth() + 1).padStart(2, '0')]),
  )
  /** Multi-bank: which bank-account columns are shown (null = all). */
  const [acctSel, setAcctSel] = useState<Set<string> | null>(null)
  /** Analytical: which posting-account analysis columns are shown (null = all). */
  const [anaSel, setAnaSel] = useState<Set<string> | null>(null)

  const toggleMonth = (m: string) => {
    setMonthsSel((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      // At least one month must stay picked — an empty book means nothing.
      return next.size ? next : prev
    })
  }

  /** Sum of a voucher's lines posted to discount accounts (Discount Allowed / Received). */
  const discountOf = (lines?: { accountId: string; amount: number }[]) =>
    (lines ?? []).reduce((s, l) => {
      const name = (accounts.find((a) => a.id === l.accountId)?.name || '').toLowerCase()
      return name.includes('discount') ? s + l.amount : s
    }, 0)

  /** Journal entries that touch a cash/bank account belong in the cash book too:
      a line DEBITING a money account is a receipt into it (Dr side); a line
      CREDITING one is a payment out of it (Cr side). The money amount is analysed
      across the opposite side's non-money lines (proportionally, so the analysis
      columns still sum to the money amount even for compound entries). */
  const journalSides = (side: 'dr' | 'cr'): Side[] => {
    const rows: Side[] = []
    const amtOf = (l: { debit: number; credit: number }, s: 'dr' | 'cr') => (s === 'dr' ? l.debit || 0 : l.credit || 0)
    for (const j of journals) {
      if (j.status === 'void') continue
      for (const l of j.lines) {
        const amt = amtOf(l, side)
        if (!amt || !isMoneyAcct(l.accountId)) continue
        // Opposite-side, non-money lines describe what the cash movement was for.
        const opp = j.lines.filter((x) => amtOf(x, side === 'dr' ? 'cr' : 'dr') > 0 && !isMoneyAcct(x.accountId))
        const oppTotal = opp.reduce((s, x) => s + amtOf(x, side === 'dr' ? 'cr' : 'dr'), 0)
        const lines = oppTotal > 0
          ? opp.map((x) => ({ accountId: x.accountId, amount: amt * (amtOf(x, side === 'dr' ? 'cr' : 'dr') / oppTotal) }))
          : [{ accountId: l.accountId, amount: amt }]
        rows.push({
          date: j.date,
          party: j.stakeholder || j.description || 'Journal entry',
          no: j.number,
          disc: 0,
          cash: isCashAcct(l.accountId) ? amt : 0,
          bank: isCashAcct(l.accountId) ? 0 : amt,
          acct: l.accountId,
          lines,
        })
      }
    }
    return rows
  }

  const drAll = useMemo<Side[]>(
    () =>
      [
        ...receipts
          .filter((r) => r.status !== 'void')
          .map((r) => ({
            date: r.date,
            party: r.receivedFrom,
            no: r.number,
            disc: discountOf(r.lines),
            cash: isCashAcct(r.depositAccountId) ? r.amount : 0,
            bank: isCashAcct(r.depositAccountId) ? 0 : r.amount,
            acct: r.depositAccountId,
            lines: r.lines ?? [],
          })),
        ...journalSides('dr'),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receipts, journals, accounts],
  )

  const crAll = useMemo<Side[]>(
    () =>
      [
        ...paymentVouchers
          .filter((p) => p.status !== 'void')
          .map((p) => ({
            date: p.date,
            party: p.paidTo,
            no: p.number,
            disc: discountOf(p.lines),
            cash: isCashAcct(p.paymentAccountId) ? p.amount : 0,
            bank: isCashAcct(p.paymentAccountId) ? 0 : p.amount,
            acct: p.paymentAccountId,
            lines: p.lines ?? [],
          })),
        ...journalSides('cr'),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paymentVouchers, journals, accounts],
  )

  const years = useMemo(() => {
    const ys = new Set([...drAll, ...crAll].map((e) => e.date.slice(0, 4)))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse() // newest first, every transaction year listed
  }, [drAll, crAll])

  /** Months included by the current filters (combined book: the single pick). */
  const selMonths = book === 'combined' ? (month ? [month] : []) : [...monthsSel].sort()

  const matchPeriod = (d: string) => {
    if (year && d.slice(0, 4) !== year) return false
    if (selMonths.length && !selMonths.includes(d.slice(5, 7))) return false
    return true
  }
  /** Opening balances consider everything before the earliest selected month. */
  const beforePeriod = (d: string) => {
    if (!year) return false
    if (selMonths.length) return d.slice(0, 7) < `${year}-${selMonths[0]}`
    return d.slice(0, 4) < year
  }

  const dr = useMemo(() => drAll.filter((e) => matchPeriod(e.date)), [drAll, year, month, monthsSel, book]) // eslint-disable-line react-hooks/exhaustive-deps
  const cr = useMemo(() => crAll.filter((e) => matchPeriod(e.date)), [crAll, year, month, monthsSel, book]) // eslint-disable-line react-hooks/exhaustive-deps

  /** A book only lists entries that touch its columns: a single-column (cash)
      cash book excludes bank-only vouchers, and so on. */
  const relevant = (e: Side) => (fmt === 'single' ? e.cash !== 0 : fmt === 'triple' ? true : e.cash !== 0 || e.bank !== 0)

  /** Bank columns ARE chart-of-accounts bank/till accounts — but only those
      the PERIOD's vouchers actually touch: a chart bank with no transaction
      in the period gets no column. Any other touched account joins too, so
      no money in the period is ever hidden. */
  const bankAccts = useMemo(() => {
    const ids = new Set<string>()
    for (const e of [...dr, ...cr]) if ((e.cash !== 0 || e.bank !== 0) && e.acct) ids.add(e.acct)
    return [...ids]
      .map((id) => {
        // Column names come from the chart of accounts — cash is the chart's
        // own "Cash and cash equivalents" account, banks are chart bank accounts.
        const chartName = accounts.find((a) => a.id === id)?.name
        return { id, name: (chartName && chartName !== id ? chartName : '') || `Account ${id}` }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [dr, cr, accounts])

  /** The columns actually rendered: the user's selection, or all by default. */
  const bankCols = useMemo(
    () => bankAccts.filter((c) => !acctSel || acctSel.has(c.id)),
    [bankAccts, acctSel],
  )

  /** Analytical: one analysis column per posting account used by the period's
      vouchers (voucher lines), excluding accounts already shown as bank columns. */
  const analysisAcctAll = useMemo(() => {
    const acctLabel = (id: string) => {
      const chartName = accounts.find((a) => a.id === id)?.name
      return (chartName && chartName !== id ? chartName : '') || `Account ${id}`
    }
    // Variable, never rigid: only the accounts actually involved in THIS
    // book's entries for the selected month(s)/year get an analysis column —
    // the receipts book analyses receipt accounts, the payments book payment
    // accounts, and the set follows the period filters.
    const srcEntries = book === 'payments' ? cr : dr
    const ids = new Set<string>()
    for (const e of srcEntries) {
      if (e.cash === 0 && e.bank === 0) continue
      for (const l of e.lines) if (l.amount) ids.add(l.accountId)
    }
    const bankIds = new Set(bankAccts.map((c) => c.id))
    const withNames = [...ids]
      .filter((id) => !bankIds.has(id))
      .map((id) => {
        const full = acctLabel(id)
        return { id, full, name: shortName(full) }
      })
    // If two accounts would shorten to the same label, keep their full names.
    const counts = new Map<string, number>()
    for (const c of withNames) counts.set(c.name, (counts.get(c.name) ?? 0) + 1)
    return withNames
      .map((c) => ({ id: c.id, name: (counts.get(c.name) ?? 0) > 1 ? c.full : c.name, full: c.full }))
      .sort((a, b) => a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dr, cr, bankAccts, accounts, book])

  /** The analysis columns actually rendered: the user's selection, or all. */
  const analysisAccts = useMemo(
    () => analysisAcctAll.filter((c) => !anaSel || anaSel.has(c.id)),
    [analysisAcctAll, anaSel],
  )

  const toggleAna = (id: string) => {
    setAnaSel((prev) => {
      const next = new Set(prev ?? analysisAcctAll.map((c) => c.id))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAcct = (id: string) => {
    setAcctSel((prev) => {
      const next = new Set(prev ?? bankAccts.map((c) => c.id))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Column headers of the current format (multi expands per bank account). */
  const headsVec = (): string[] =>
    fmt === 'single' ? ['Cash']
    : fmt === 'double' ? ['Cash', 'Bank']
    : fmt === 'triple' ? ['Disc.', 'Cash', 'Bank']
    : fmt === 'analytical'
    ? ['Total', ...bankCols.map((c) => c.name), ...analysisAccts.map((a) => a.name)]
    : ['Cash', ...bankCols.map((c) => c.name)]

  /** Value amounts of one entry, aligned with headsVec(). */
  const valuesVec = (e: Side): number[] =>
    fmt === 'single' ? [e.cash]
    : fmt === 'double' ? [e.cash, e.bank]
    : fmt === 'triple' ? [e.disc, e.cash, e.bank]
    : [e.cash, ...bankCols.map((c) => (e.acct === c.id ? e.bank : 0))]

  /** Balance brought down for one bank account column. */
  const openAcct = (id: string) =>
    drAll.filter((x) => beforePeriod(x.date) && x.acct === id).reduce((s2, x) => s2 + x.cash + x.bank, 0) -
    crAll.filter((x) => beforePeriod(x.date) && x.acct === id).reduce((s2, x) => s2 + x.cash + x.bank, 0)

  /** Opening balances aligned with headsVec(). */
  const openVec = (): number[] =>
    fmt === 'single' ? [opening.cash]
    : fmt === 'double' ? [opening.cash, opening.bank]
    : fmt === 'triple' ? [0, opening.cash, opening.bank]
    : [opening.cash, ...bankCols.map((c) => openAcct(c.id))]
  const drF = dr.filter(relevant)
  const crF = cr.filter(relevant)

  const sum = (rows: Side[], col: 'disc' | 'cash' | 'bank') => rows.reduce((s, e) => s + e[col], 0)

  const opening = {
    disc: 0,
    cash: sum(drAll.filter((e) => beforePeriod(e.date)), 'cash') - sum(crAll.filter((e) => beforePeriod(e.date)), 'cash'),
    bank: sum(drAll.filter((e) => beforePeriod(e.date)), 'bank') - sum(crAll.filter((e) => beforePeriod(e.date)), 'bank'),
  }
  const totals = {
    disc: { dr: sum(dr, 'disc'), cr: sum(cr, 'disc') },
    cash: { dr: sum(dr, 'cash'), cr: sum(cr, 'cash') },
    bank: { dr: sum(dr, 'bank'), cr: sum(cr, 'bank') },
  }
  const closing = {
    disc: 0,
    cash: opening.cash + totals.cash.dr - totals.cash.cr,
    bank: opening.bank + totals.bank.dr - totals.bank.cr,
  }

  const periodLabel =
    selMonths.length === 1
      ? `${monthName(selMonths[0])} ${year}`
      // Every month picked reads as the whole year rather than twelve names.
      : selMonths.length === 12
        ? `Year ${year}`
        : selMonths.length > 1
          ? `${selMonths.map(monthName).join(', ')} ${year}`
          : `Year ${year}`

  /** Formatted value cells for one side entry (or blanks). */
  const valueCells = (e: Side | undefined): string[] => {
    if (!e) return VALUE_HEADS[fmt].map(() => '')
    if (fmt === 'single') return [num(e.cash)]
    if (fmt === 'double') return [num(e.cash), num(e.bank)]
    return [num(e.disc), num(e.cash), num(e.bank)]
  }

  /** Raw value amounts shown for the current format. */
  const rawValues = (e: Side): number[] =>
    fmt === 'single' ? [e.cash] : fmt === 'double' ? [e.cash, e.bank] : [e.disc, e.cash, e.bank]

  /** Balance b/d and c/d cells per side, honouring Dr/Cr direction. */
  const balanceCells = (v: { disc: number; cash: number; bank: number }, positiveOnDr: boolean): string[] => {
    const show = (x: number) => ((positiveOnDr ? x >= 0 : x < 0) ? num(Math.abs(x)) : '')
    if (fmt === 'single') return [show(v.cash)]
    if (fmt === 'double') return [show(v.cash), show(v.bank)]
    return ['', show(v.cash), show(v.bank)]
  }

  const bookRows = useMemo<BookRow[]>(() => {
    const rows: BookRow[] = []
    const twoSided = book === 'combined'
    const src = book === 'payments' ? crF : drF

    if (twoSided) {
      // Opening balance.
      rows.push({
        kind: 'open',
        left: ['', 'To Balance b/d', '', ...balanceCells(opening, true)],
        right: ['', opening.cash < 0 || opening.bank < 0 ? 'By Balance b/d' : '', '', ...balanceCells(opening, false)],
      })
      // Paired transaction lines.
      const count = Math.max(drF.length, crF.length)
      for (let i = 0; i < count; i++) {
        const l = drF[i]
        const r = crF[i]
        rows.push({
          kind: 'data',
          left: [...(l ? [dFmt(l.date), l.party, l.no] : ['', '', '']), ...valueCells(l)],
          right: [...(r ? [dFmt(r.date), r.party, r.no] : ['', '', '']), ...valueCells(r)],
        })
      }
      // Totals.
      rows.push({
        kind: 'total',
        left: ['', 'Total', '', ...rawValues({ date: '', party: '', no: '', disc: totals.disc.dr, cash: totals.cash.dr, bank: totals.bank.dr, acct: '', lines: [] }).map(num)],
        right: ['', 'Total', '', ...rawValues({ date: '', party: '', no: '', disc: totals.disc.cr, cash: totals.cash.cr, bank: totals.bank.cr, acct: '', lines: [] }).map(num)],
      })
      // Closing balance carried down.
      rows.push({
        kind: 'close',
        left: ['', closing.cash < 0 || closing.bank < 0 ? 'To Balance c/d' : '', '', ...balanceCells(closing, false)],
        right: ['', closing.cash >= 0 || closing.bank >= 0 ? 'By Balance c/d' : '', '', ...balanceCells(closing, true)],
      })
      return rows
    }

    if (fmt === 'analytical') {
      // Analytical cash book (church/imprest style): Date | Particulars |
      // Vch. No. | Total | Cash | one column per bank account | one analysis
      // column per posting account — with Balance b/f, one summary row for
      // receipts and one for payments, and Balance c/d.
      const banks = bankCols
      const anas = analysisAccts
      const anaOf = (e: Side) => {
        const m = new Map<string, number>()
        for (const l of e.lines) m.set(l.accountId, (m.get(l.accountId) ?? 0) + l.amount)
        return m
      }
      const lineSum = (e: Side, id: string) => e.lines.reduce((s2, l) => (l.accountId === id ? s2 + l.amount : s2), 0)
      const anaBefore = (id: string) =>
        drAll.filter((x) => beforePeriod(x.date)).reduce((s2, x) => s2 + lineSum(x, id), 0) -
        crAll.filter((x) => beforePeriod(x.date)).reduce((s2, x) => s2 + lineSum(x, id), 0)
      const colTotals = (list: Side[]) => {
        const perAna = new Map<string, number>()
        for (const e of list) for (const [id, v] of anaOf(e)) perAna.set(id, (perAna.get(id) ?? 0) + v)
        return {
          total: list.reduce((s2, e) => s2 + e.cash + e.bank, 0),
          banks: banks.map((b) => list.reduce((s2, e) => s2 + (e.acct === b.id ? e.cash + e.bank : 0), 0)),
          anas: anas.map((a) => perAna.get(a.id) ?? 0),
        }
      }
      const bf = {
        total: banks.reduce((s2, b) => s2 + openAcct(b.id), 0),
        banks: banks.map((b) => openAcct(b.id)),
        anas: anas.map((a) => anaBefore(a.id)),
      }
      const rcTot = colTotals(drF)
      const payTot = colTotals(crF)
      const signed = (v: number) => (v < 0 ? `(${formatGhs(-v)})` : num(v))
      const vec = (t: { total: number; banks: number[]; anas: number[] }) =>
        [signed(t.total), ...t.banks.map(signed), ...t.anas.map(signed)]
      rows.push({ kind: 'open', left: ['', 'Balance b/f', '', ...vec(bf)], right: [] })
      for (const e of book === 'payments' ? crF : drF) {
        const m = anaOf(e)
        rows.push({
          kind: 'data',
          left: [
            dFmt(e.date), e.party, e.no,
            num(e.cash + e.bank),
            ...banks.map((b) => (e.acct === b.id ? num(e.cash + e.bank) : '—')),
            ...anas.map((a) => num(m.get(a.id) ?? 0)),
          ],
          right: [],
        })
      }
      const first = book === 'payments' ? payTot : rcTot
      const second = book === 'payments' ? rcTot : payTot
      rows.push({ kind: 'total', left: ['', book === 'payments' ? 'Total payments' : 'Total receipts', '', ...vec(first)], right: [] })
      rows.push({ kind: 'total', left: ['', book === 'payments' ? 'Total receipts' : 'Total payments', '', ...vec(second)], right: [] })
      rows.push({
        kind: 'close',
        left: ['', 'Balance c/d', '', ...vec({
          total: bf.total + rcTot.total - payTot.total,
          banks: bf.banks.map((v, i) => v + rcTot.banks[i] - payTot.banks[i]),
          anas: bf.anas.map((v, i) => v + rcTot.anas[i] - payTot.anas[i]),
        })],
        right: [],
      })
      return rows
    }

    // One-sided book: balance b/d, dated lines with a per-row Total column,
    // grand totals and balance c/d — as value vectors so Multi-bank works
    // with one column per bank account.
    const heads = headsVec()
    const oV = openVec()
    const rowSum = (v: number[]) => v.reduce((s2, x) => s2 + x, 0)
    rows.push({
      kind: 'open',
      left: ['', oV.some((v) => v < 0) ? 'By Balance b/d' : 'To Balance b/d', '', ...oV.map((v) => (v ? num(v) : '')), num(rowSum(oV))],
      right: [],
    })
    for (const e of src) {
      const vals = valuesVec(e)
      rows.push({
        kind: 'data',
        left: [dFmt(e.date), e.party, e.no, ...vals.map(num), num(rowSum(vals))],
        right: [],
      })
    }
    const totV = heads.map((_, i2) => src.reduce((s2, e) => s2 + valuesVec(e)[i2], 0))
    rows.push({
      kind: 'total',
      left: ['', 'Total', '', ...totV.map(num), num(rowSum(totV))],
      right: [],
    })
    // Balance c/d: receipts add to the balance, payments reduce it.
    // The discount column (triple) carries no balance — it stays blank.
    const sign = book === 'payments' ? -1 : 1
    const closeV = oV.map((v, i2) => v + sign * totV[i2])
    const cashIdx = fmt === 'triple' ? 1 : 0
    const balCols = fmt === 'triple' ? closeV.slice(1) : closeV
    rows.push({
      kind: 'close',
      left: [
        '',
        closeV[cashIdx] < 0 ? 'To Balance c/d' : 'By Balance c/d',
        '',
        ...closeV.map((v, i2) => (fmt === 'triple' && i2 === 0 ? '' : v ? num(v) : '')),
        num(rowSum(balCols)),
      ],
      right: [],
    })
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dr, cr, fmt, year, month, book, bankCols, analysisAccts])


  const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' }))

  const n = VALUE_HEADS[fmt].length
  const twoSided = book === 'combined'

  // Screen headers use compound labels in ONE row so CSV/Excel export keeps clean keys.
  // One-sided books name the voucher column after the book, like the classic
  // analysis cash book ("RECEIPT NO"); the combined book keeps "Vch. No.".
  const noHead = book === 'receipts' ? 'Receipt No.' : book === 'payments' ? 'Payment No.' : 'Vch. No.'
  const oneHeads = headsVec()
  const screenHeads = twoSided
    ? ['Date', 'Particulars', 'Vch. No.', ...VALUE_HEADS[fmt].map((h) => `${h} (Dr)`), 'Date', 'Particulars', 'Vch. No.', ...VALUE_HEADS[fmt].map((h) => `${h} (Cr)`)]
    : fmt === 'analytical'
    ? ['Date', 'Particulars', noHead, ...oneHeads]
    : ['Date', 'Particulars', noHead, ...oneHeads, 'Total']
  // Amount column indexes (0-based) inside a full row.
  const amountIdx = new Set<number>()
  if (twoSided) {
    for (let i = 3; i < 3 + n; i++) amountIdx.add(i)
    for (let i = 6 + n; i < 6 + 2 * n; i++) amountIdx.add(i)
  } else {
    for (let i = 3; i <= 3 + oneHeads.length; i++) amountIdx.add(i)
  }

  const rowVisible = book === 'combined' ? drF.length || crF.length : (book === 'payments' ? crF : drF).length

  const th = 'border border-zinc-400 bg-zinc-100 px-2 py-1 text-center font-bold'
  const td = 'border border-zinc-300 px-2 py-1'

  /**
   * Ruling of the PRINTED book, copied from the hand-ruled original: the
   * column lines run the full height, but horizontally only four rules are
   * drawn — under the headings, above the totals block, above Balance c/d,
   * and under it. Data rows are NOT ruled from each other.
   */
  const printRowCls = (rows: BookRow[], i: number) => {
    const row = rows[i]
    const summary = row.kind === 'total' || row.kind === 'close'
    const cls = [row.kind === 'data' ? '' : 'font-bold']
    const firstTotal = rows.findIndex((r) => r.kind === 'total')
    // The ledger's outer box closes at the end of the data rows: in the totals
    // block the Date column is left open (no left edge) and the closing rules
    // start after it, exactly as the hand-ruled book is drawn.
    if (summary) cls.push('cb-open-left')
    if (i === firstTotal) cls.push('cb-rule-top')
    if (row.kind === 'close') cls.push('cb-rule-top-inset', 'cb-rule-bottom-inset')
    return cls.filter(Boolean).join(' ') || undefined
  }

  /** Receipt/Payment analysis books (and the analytical format) — one A4 sheet, always landscape. */
  const isAnalysisBook = book === 'receipts' || book === 'payments' || fmt === 'analytical'

  /**
   * Squeeze the printed table onto ONE A4 landscape sheet: the more columns a
   * period has, the smaller the ruled type gets (mirrors the hand-ruled book,
   * which never continues onto a second sheet).
   */
  const fitClass = (cols: number) =>
    `cb-fit ${cols >= 16 ? 'cb-fit-xs' : cols >= 12 ? 'cb-fit-sm' : cols >= 9 ? 'cb-fit-md' : 'cb-fit-lg'}`

  /** The traditional ruled ledger — used by the print sheet. */
  const printTable = twoSided ? (
    <table className={`w-full border-collapse text-xs ${fitClass(6 + 2 * n)}`}>
      <thead>
        <tr>
          <th rowSpan={2} className={th}>Date</th>
          <th rowSpan={2} className={th}>Particulars</th>
          <th rowSpan={2} className={th}>Vch.</th>
          <th colSpan={n} className={th}>Receipts (Dr)</th>
          <th rowSpan={2} className={th}>Date</th>
          <th rowSpan={2} className={th}>Particulars</th>
          <th rowSpan={2} className={th}>Vch.</th>
          <th colSpan={n} className={th}>Payments (Cr)</th>
        </tr>
        <tr>
          {VALUE_HEADS[fmt].map((h) => (
            <th key={`dr-${h}`} className={th}>{h}</th>
          ))}
          {VALUE_HEADS[fmt].map((h) => (
            <th key={`cr-${h}`} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bookRows.map((row, i) => (
          <tr key={i} className={printRowCls(bookRows, i)}>
            {row.left.map((c, j) => (
              <td key={j} className={`${td} ${amountIdx.has(j) ? 'text-right' : ''}`}>{c}</td>
            ))}
            {row.right.map((c, j) => (
              <td key={j} className={`${td} ${amountIdx.has(j + 3 + n) ? 'text-right' : ''}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    (() => {
      // Very wide multi-bank ledgers split into column-group sheets for print:
      // each sheet repeats Date/Particulars/Vch. No. plus up to
      // PRINT_MAX_VALUE_COLS value columns; only the last sheet carries the
      // grand Total. The screen view stays one wide (scrollable) table.
      // Analytical carries Total as its first value column; the other formats
      // append it at the end (handled via totalIsTrailing below).
      const valueHeads = fmt === 'analytical' ? screenHeads.slice(3) : screenHeads.slice(3, -1)
      const totalIsTrailing = fmt !== 'analytical'
      const groups: string[][] = []
      // The ANALYSIS books never split: like the real ruled cash book they must
      // come off the printer as ONE A4 landscape sheet, however many analysis
      // columns the period has. The type auto-shrinks instead (cb-fit-*).
      if (!isAnalysisBook && fmt === 'multi' && valueHeads.length > PRINT_MAX_VALUE_COLS) {
        for (let i = 0; i < valueHeads.length; i += PRINT_MAX_VALUE_COLS) groups.push(valueHeads.slice(i, i + PRINT_MAX_VALUE_COLS))
      } else {
        groups.push(valueHeads)
      }
      return groups.map((heads, gi) => {
        const lastSheet = gi === groups.length - 1
        const valStart = 3 + gi * PRINT_MAX_VALUE_COLS
        const headCells = ['Date', 'Particulars', noHead, ...heads, ...(totalIsTrailing && lastSheet ? ['Total'] : [])]
        return (
          <div key={gi}>
            {groups.length > 1 && (
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">
                Part {gi + 1} of {groups.length} — {heads.join(', ')}
              </p>
            )}
            <table className={`w-full border-collapse text-xs ${fitClass(headCells.length)}`}>
              <thead>
                <tr>
                  {headCells.map((h, i) => (
                    <th key={`${h}-${i}`} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookRows.map((row, i) => {
                  const cells: { txt: string; amt: boolean }[] = [0, 1, 2].map((j) => ({ txt: row.left[j] ?? '', amt: false }))
                  for (let j = 0; j < heads.length; j++) cells.push({ txt: row.left[valStart + j] ?? '', amt: true })
                  if (totalIsTrailing && lastSheet) cells.push({ txt: row.left[row.left.length - 1] ?? '', amt: true })
                  return (
                    <tr key={i} className={printRowCls(bookRows, i)}>
                      {cells.map((c, j) => (
                        <td key={j} className={`${td} ${c.amt ? 'text-right' : ''}`}>{c.txt}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })
    })()
  )

  /** Tooltip map: short analysis header → the account's full name. */
  const anaFullOf = (h: string) => analysisAccts.find((a) => a.name === h)?.full

  // ---------------------------------------------------------------------
  // On-screen book: rendered through the shared DataTable so the cash book
  // gets the same sorting, paging and row-count chrome as every other table.
  // The book's structural lines (Balance b/f, the totals and Balance c/d)
  // are PINNED: they stay visible on every page and are never re-sorted, so
  // the ledger still reads top-to-bottom as a cash book.
  // ---------------------------------------------------------------------
  const screenRows = useMemo<ScreenRow[]>(() => bookRows.map((r, _i) => ({ ...r, _i })), [bookRows])
  const dataRows = useMemo(() => screenRows.filter((r) => r.kind === 'data'), [screenRows])
  const openRows = useMemo(() => screenRows.filter((r) => r.kind === 'open'), [screenRows])
  const summaryRows = useMemo(
    () => screenRows.filter((r) => r.kind === 'total' || r.kind === 'close'),
    [screenRows],
  )

  /** Full row cells, left side then right side (one-sided books have no right). */
  const cellsOf = (r: BookRow) => [...r.left, ...r.right]

  const amountIdxKey = [...amountIdx].join(',')
  const screenColumns = useMemo<Column<ScreenRow>[]>(
    () =>
      screenHeads.map((h, i) => {
        const isAmount = amountIdx.has(i)
        return {
          key: `c${i}`,
          header: <span title={anaFullOf(h)}>{h}</span>,
          align: isAmount ? 'right' : 'left',
          // No sorting: a cash book only reads correctly in book order (and
          // the two-sided book pairs an unrelated receipt and payment on each
          // line, so re-ordering it would be meaningless).
          render: (r) => cellsOf(r)[i] ?? '',
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screenHeads.join('|'), amountIdxKey, analysisAccts],
  )

  // Export the WHOLE book, not just the page on screen. Duplicate headers
  // (the two-sided book repeats Date/Particulars) get a "(2)" suffix so no
  // column is silently dropped, matching the old table-scraping behaviour.
  const exportRows = useMemo<ExportRow[]>(() => {
    const used = new Map<string, number>()
    const keys = screenHeads.map((h, i) => {
      const base = h || `Column ${i + 1}`
      const k = used.get(base) ?? 0
      used.set(base, k + 1)
      return k === 0 ? base : `${base} (${k + 1})`
    })
    return bookRows.map((r) => {
      const cells = cellsOf(r)
      const out: ExportRow = {}
      keys.forEach((k, i) => {
        out[k] = cells[i] ?? ''
      })
      return out
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookRows, screenHeads.join('|')])

  const title = BOOK_TITLE[book]

  // The Receipt/Payment ANALYSIS cash books always print A4 landscape with
  // narrow margins — their analysis columns vary by month and would not fit
  // portrait. Other ledgers go landscape only when they are wide: one-sided
  // books from 7 columns up (triple column, or multi-bank with 3+ banks);
  // two-sided books from two value columns per side (10+ columns).
  const landscapePrint = isAnalysisBook || (twoSided ? n >= 2 : screenHeads.length >= 7)

  return (
    <div>
      <ReportPrintSheet
        title={title}
        subtitle={`Period: ${periodLabel}`}
        landscape={landscapePrint}
        narrowMargins={isAnalysisBook}
        contactDetails={!isAnalysisBook}
      >
        <div className="space-y-2 text-sm">{printTable}</div>
      </ReportPrintSheet>

      <PageHeader title={title} desc={BOOK_DESC[book]} />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {book === 'combined' && (
            <Field label="Cash book format">
              <Segmented
                value={fmt}
                onChange={(v) => setFmt(v as Fmt)}
                options={[
                  { id: 'single', label: 'Single column' },
                  { id: 'double', label: 'Double column' },
                  { id: 'triple', label: 'Triple column' },
                ]}
              />
            </Field>
          )}
          <Field label="Year">
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-32">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </Field>
          {book === 'combined' && (
            <Field label="Month">
              <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-40">
                <option value="">All months</option>
                {monthNames.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </Select>
            </Field>
          )}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-[#2e75b6] px-6 text-sm font-bold text-white transition hover:brightness-110"
            >
              Print
            </button>
            {exportRows.length > 0 && <ExportButtons filename={book === 'combined' ? `traditional-cashbook-${fmt}` : book === 'receipts' ? 'analysis-cashbook-receipts' : 'analysis-cashbook-payments'} rows={exportRows} compact />}
          </div>
          {book !== 'combined' && (
            <div className="mt-3 w-full border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-mist">Months</span>
                {monthNames.map((mName, i) => {
                  const m = String(i + 1).padStart(2, '0')
                  const on = monthsSel.has(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleMonth(m)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-[#2e75b6] bg-[#2e75b6]/10 text-[#2e75b6] dark:border-sky-400 dark:text-sky-300' : 'border-line text-mist hover:text-inherit'}`}
                    >
                      {mName.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-mist">The book opens on the current month. Pick one or more months to include.</p>
            </div>
          )}
          {(fmt === 'multi' || fmt === 'analytical') && book !== 'combined' && bankAccts.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-mist">Bank columns</span>
                {bankAccts.map((c) => {
                  const on = !acctSel || acctSel.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAcct(c.id)}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-[#2e75b6] bg-[#2e75b6]/10 text-[#2e75b6] dark:border-sky-400 dark:text-sky-300' : 'border-line text-mist hover:text-inherit'}`}
                    >
                      {c.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setAcctSel(null)}
                  className="cursor-pointer text-xs text-[#1a56b0] hover:underline dark:text-sky-300"
                >
                  Select all
                </button>
              </div>
              <p className="mt-2 text-xs text-mist">Pick which bank accounts get their own column in the cash book.</p>
            </div>
          )}
          {book !== 'combined' && analysisAcctAll.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-mist">Analysis columns</span>
                {analysisAcctAll.map((c) => {
                  const on = !anaSel || anaSel.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAna(c.id)}
                      title={c.full}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-[#2e75b6] bg-[#2e75b6]/10 text-[#2e75b6] dark:border-sky-400 dark:text-sky-300' : 'border-line text-mist hover:text-inherit'}`}
                    >
                      {c.name}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setAnaSel(null)}
                  className="cursor-pointer text-xs text-[#1a56b0] hover:underline dark:text-sky-300"
                >
                  Select all
                </button>
              </div>
              <p className="mt-2 text-xs text-mist">Pick which posting accounts get their own analysis column.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div>
          {rowVisible ? (
            <DataTable<ScreenRow>
              columns={screenColumns}
              data={dataRows}
              pinnedTop={openRows}
              pinnedBottom={summaryRows}
              rowKey={(r) => String(r._i)}
              rowClassName={(r) => (r.kind === 'data' ? undefined : 'bg-black/5 font-semibold dark:bg-white/5')}
              pageSize={25}
            />
          ) : (
            <Empty title="No transactions" desc="Nothing recorded for the selected period and format columns. Adjust the year or month filters, or try another column format." />
          )}
        </div>
      </div>

      {book === 'combined' ? (
        <p className="mt-3 text-xs text-mist">
          Single column records cash only · Double column records cash and bank · Triple column adds the discount columns —
          discount values come from voucher lines posted to discount accounts.
        </p>
      ) : (
        <p className="mt-3 text-xs text-mist">
          The analysis cash book: every entry shows its Total, the chart bank/till account that held the money (cash posts
          to the chart's own Cash and cash equivalents account) and how it analyses across posting accounts — with
          Balance b/f, one summary row for receipts, one for payments, and Balance c/d.
        </p>
      )}
    </div>
  )
}

/** Standalone one-sided books (separate menus). */
export function ReceiptCashbookPage() {
  return <TraditionalCashbookPage book="receipts" />
}

export function PaymentCashbookPage() {
  return <TraditionalCashbookPage book="payments" />
}

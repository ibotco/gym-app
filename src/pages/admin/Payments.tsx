import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, CreditCard, Check, Printer, FileText,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { PageHeader, Button, Select, StatusBadge, Modal, Field, Input } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { copyPaystackLink } from '../../components/PaystackCheckout'
import { GatewayPayButton } from '../../components/GatewayPayButton'
import { isPaystackEnabled, isPaystackLive, methodLabel, refundPaystack } from '../../lib/paystack'
import type { Payment, PaymentMethod } from '../../types'

type SortKey = 'date' | 'member' | 'description' | 'method' | 'amount' | 'status'
type ColId = SortKey | 'action'

export function Payments({ embedded }: { embedded?: boolean } = {}) {
  const { payments, invoices, users, members, refundPayment, settlePayment, notify, upsertPayment, createPayment } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const [inv, setInv] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('momo')
  const [newOpen, setNewOpen] = useState(false)
  const [npMember, setNpMember] = useState('')
  const [npDesc, setNpDesc] = useState('')
  const [npAmount, setNpAmount] = useState('')
  const [collect, setCollect] = useState<Payment | null>(null)

  const nameOf = (memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    return users.find((u) => u.id === m?.userId)?.name || memberId
  }

  const memberUserOf = (memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    return users.find((u) => u.id === m?.userId)
  }

  // Theme tokens — mirror the Supplier payments list so both pages match in either theme.
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const PANEL_BD = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const ROW_ALT = isDark ? '#1f242b' : '#f1f5f9'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BD = isDark ? '#49515c' : '#cbd5e1'

  /** Id of the payment just created, briefly highlighted in the list. */
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(null), 2600)
    return () => window.clearTimeout(t)
  }, [justSaved])

  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'date', 'member', 'description', 'method', 'amount', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = payments.filter((p) => {
      if (st !== 'all' && p.status !== st) return false
      const blob = `${nameOf(p.memberId)} ${p.description} ${p.invoiceId}`.toLowerCase()
      return !ql || blob.includes(ql)
    })

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (p: Payment): string | number => {
      switch (sortKey) {
        case 'member': return nameOf(p.memberId).toLowerCase()
        case 'description': return p.description.toLowerCase()
        case 'method': return methodLabel(p.method).toLowerCase()
        case 'amount': return p.amount
        case 'status': return p.status.toLowerCase()
        default: return p.date
      }
    }
    return [...list].sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      // Payment records carry no createdAt, so ties keep store order (stable).
      return cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, q, st, sortKey, sortDir, members, users])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, st, showEntries])
  const totalPages = Math.max(1, Math.ceil(rows.length / showEntries))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * showEntries, safePage * showEntries),
    [rows, safePage, showEntries],
  )

  // ---- Toolbar actions (identical behaviour to Supplier payments) ----
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  /** Every filtered record — exports ignore pagination, matching Supplier payments. */
  const exportRows = (): Record<string, string | number>[] => rows.map((p) => ({
    Date: p.date,
    Member: nameOf(p.memberId),
    Description: p.description,
    Method: methodLabel(p.method),
    Amount: p.amount,
    Status: p.status,
  }))

  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || {})
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const val = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(val) ? `"${val}"` : val
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'payments.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('payments', exportRows())
    setBusy(''); if (ok) flashDone('excel')
  }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }

  const ToolbarBtn = ({ label, icon, onClick, busyKey, doneKey }:
    { label: string; icon: React.ReactNode; onClick: () => void; busyKey: typeof busy; doneKey: typeof done }) => (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={busy !== ''}
        aria-label={label}
        data-bs-toggle="tooltip"
        data-bs-placement="top"
        data-bs-title={label}
        className="btn grid size-10 place-items-center disabled:cursor-wait disabled:opacity-60" style={{ padding: 0 }}
      >
        {done === doneKey ? <Check className="size-5 text-emerald-500" strokeWidth={3} style={{ width: 20, height: 20 }} /> : icon}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-[0.375rem] bg-[#212529] px-2 py-1.5 text-sm font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#212529]" aria-hidden="true" />
      </span>
    </span>
  )

  const HEAD: { id: ColId; label: string; sort?: SortKey }[] = [
    { id: 'action', label: 'Action' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'member', label: 'Member', sort: 'member' },
    { id: 'description', label: 'Description', sort: 'description' },
    { id: 'method', label: 'Method', sort: 'method' },
    { id: 'amount', label: 'Amount', sort: 'amount' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const invoice = invoices.find((i) => i.id === inv)
  const pending = payments.find((p) => p.id === confirmId)
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.total, 0)

  const openConfirm = (p: Payment) => {
    setMethod(p.method)
    setConfirmId(p.id)
  }

  const openNew = () => {
    setNpMember(members[0]?.id || '')
    setNpDesc('')
    setNpAmount('')
    setNewOpen(true)
  }

  const submitNew = (collectOnline: boolean) => {
    if (!npMember) { toast.error('Select a member.'); return }
    const amount = Number(npAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount.'); return }
    const r = createPayment({
      memberId: npMember,
      amount,
      description: npDesc.trim() || 'Manual charge',
      method: collectOnline ? undefined : 'momo',
    })
    if (!r.ok) { toast.error(r.error || 'Could not create payment'); return }
    setNewOpen(false)
    // Surface the new record: reset to the newest-first default sort and page 1
    // so it is visible, then flash the row.
    setSortKey('date'); setSortDir('desc'); setPage(1)
    setJustSaved(r.payment!.id)
    if (collectOnline) {
      setCollect(r.payment!)
    } else {
      toast.success('Payment created', 'Pending — confirm receipt or collect online from the table.')
    }
  }

  const confirmPayment = () => {
    if (!pending) return
    upsertPayment({ ...pending, method })
    const r = settlePayment(pending.id)
    if (!r.ok) {
      toast.error(r.error || 'Could not confirm payment')
      return
    }
    const memberUser = memberUserOf(pending.memberId)
    if (memberUser) {
      notify({
        userId: memberUser.id,
        title: 'Payment confirmed',
        message: `${pending.description} (${formatGhsExact(pending.amount)}) was confirmed by ${user?.name || 'admin'}.`,
        channel: 'in-app',
      })
    }
    setConfirmId(null)
    toast.success('Payment confirmed', 'Invoice marked paid and membership updated if this was a renewal.')
  }

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-mist">Outstanding <span className="font-semibold text-zinc-900 dark:text-white">{formatGhsExact(outstanding)}</span> · Confirm cash / desk MoMo, or collect with Paystack.</p>
          <Button onClick={openNew}><Plus className="size-4" /> New payment</Button>
        </div>
      ) : (
        <PageHeader
          title="Payments & invoices"
          desc={`Outstanding ${formatGhsExact(outstanding)} · Confirm cash / desk MoMo, or collect with Paystack.`}
          actions={<Button onClick={openNew}><Plus className="size-4" /> New payment</Button>}
        />
      )}
      <section className={embedded ? 'rounded-xl border' : 'mt-4 rounded-xl border'} style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Select>
              <span>entries</span>
            </div>
            <ToolbarBtn label="Export CSV" icon={<Download className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handleCsv} busyKey="csv" doneKey="csv" />
            <ToolbarBtn label="Export Excel" icon={<FileSpreadsheet className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={() => void handleExcel()} busyKey="excel" doneKey="excel" />
            <ToolbarBtn label="Print" icon={<Printer className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePrint} busyKey="print" doneKey="print" />
            <div className="relative" ref={colsRef}>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={() => setColsOpen((v) => !v)}
                  aria-expanded={colsOpen}
                  aria-label="Column visibility"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-bs-title="Column visibility"
                  className="btn grid size-10 place-items-center" style={{ padding: 0 }}
                >
                  <Columns3 className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-[0.375rem] bg-[#212529] px-2 py-1.5 text-sm font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  Column visibility
                  <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#212529]" aria-hidden="true" />
                </span>
              </span>
              {colsOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border py-2 shadow-xl" style={{ background: CARD_BG, borderColor: INPUT_BD }} onClick={(e) => e.stopPropagation()}>
                  {HEAD.filter((h) => h.id !== 'action').map((h) => {
                    const on = visibleCols.has(h.id)
                    return (
                      <label key={h.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm" style={{ color: TEXT }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setVisibleCols((cur) => {
                            const next = new Set(cur)
                            if (next.has(h.id)) next.delete(h.id)
                            else next.add(h.id)
                            return next
                          })}
                          className="size-4 accent-indigo-600"
                        />
                        {h.label}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <ToolbarBtn label="Export PDF" icon={<FileText className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePdf} busyKey="pdf" doneKey="pdf" />
            <Select value={st} onChange={(e) => setSt(e.target.value)} className="w-[13rem]">
              <option value="all">All statuses</option>
              {['paid', 'pending', 'failed', 'refunded', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search member, description or invoice…"
              aria-label="Search payments"
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ background: INPUT_BG, borderColor: INPUT_BD, color: TEXT }}
            />
          </span>
        </div>

        <div className="mt-3 overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr style={{ background: TABLE_HEAD_BG }}>
                {shownHead.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    onClick={h.sort ? () => toggleSort(h.sort as SortKey) : undefined}
                    className={'whitespace-nowrap px-3 py-3 text-left font-semibold ' + (h.sort ? 'cursor-pointer select-none' : '')}
                    style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}
                  >
                    {h.label}
                    {h.sort && <SortIcon col={h.sort} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    background: p.id === justSaved
                      ? (isDark ? 'rgba(132,204,22,0.16)' : 'rgba(132,204,22,0.18)')
                      : idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setInv(p.invoiceId)}>Invoice</Button>
                        {(p.status === 'pending' || p.status === 'failed') && (
                          <>
                            <Button size="sm" onClick={() => openConfirm(p)}>Confirm payment</Button>
                            <GatewayPayButton
                              payment={p}
                              email={memberUserOf(p.memberId)?.email || ''}
                              name={nameOf(p.memberId)}
                              phone={memberUserOf(p.memberId)?.phone}
                              returnTo="/admin/payments"
                              label="Collect online"
                            />
                          </>
                        )}
                        {p.status === 'paid' && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            if (p.method === 'paystack' && p.reference && isPaystackLive()) {
                              const r = await refundPaystack(p.reference)
                              if (!r.ok) {
                                toast.error('Paystack refund failed', r.error)
                                return
                              }
                            }
                            refundPayment(p.id)
                            toast.info('Refund recorded')
                          }}>Refund</Button>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(p.date)}</td>}
                  {visibleCols.has('member') && <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{nameOf(p.memberId)}</td>}
                  {visibleCols.has('description') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{p.description}</td>}
                  {visibleCols.has('method') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {methodLabel(p.method)}
                      {p.gatewayChannel && <span className="block text-[11px]">{p.gatewayChannel}</span>}
                    </td>
                  )}
                  {visibleCols.has('amount') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(p.amount)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><StatusBadge status={p.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-5" style={{ color: TEXT_MUTED }}>
          <span className="text-sm">
            {rows.length === 0
              ? 'Showing 0 to 0 of 0 entries'
              : `Showing ${(safePage - 1) * showEntries + 1} to ${Math.min(safePage * showEntries, rows.length)} of ${rows.length} entries`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm disabled:opacity-40"
              style={{ borderColor: INPUT_BD, color: TEXT }}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </button>
            <span className="px-2 text-sm">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm disabled:opacity-40"
              style={{ borderColor: INPUT_BD, color: TEXT }}
            >
              Next <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New payment">
        <div className="space-y-3">
          <Field label="Member" required>
            <Select value={npMember} onChange={(e) => setNpMember(e.target.value)}>
              {members.map((m) => {
                const u = users.find((x) => x.id === m.userId)
                return <option key={m.id} value={m.id}>{u?.name || m.id}</option>
              })}
            </Select>
          </Field>
          <Field label="Description"><Input value={npDesc} onChange={(e) => setNpDesc(e.target.value)} placeholder="e.g. PT session — Kojo Mensah" /></Field>
          <Field label="Amount (GHS)" required><Input type="number" value={npAmount} onChange={(e) => setNpAmount(e.target.value)} placeholder="180" /></Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => submitNew(false)}>Create payment</Button>
            {isPaystackEnabled() && (
              <Button onClick={() => submitNew(true)}><CreditCard className="size-4" /> Create & collect online</Button>
            )}
          </div>
          {!isPaystackEnabled() && (
            <p className="text-xs text-mist">Paystack is not enabled — payments will be recorded as pending for manual confirmation.</p>
          )}
        </div>
      </Modal>

      <Modal open={!!collect} onClose={() => setCollect(null)} title="Collect payment online">
        {collect && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{nameOf(collect.memberId)}</p>
              <p className="mt-1">{collect.description}</p>
              <p className="stat-num mt-2 text-3xl">{formatGhsExact(collect.amount)}</p>
            </div>
            <GatewayPayButton
              payment={collect}
              email={memberUserOf(collect.memberId)?.email || ''}
              name={nameOf(collect.memberId)}
              phone={memberUserOf(collect.memberId)?.phone}
              returnTo="/admin/payments"
              size="md"
              onDone={(r) => { if (r.ok) setCollect(null) }}
            />
            <p className="text-xs text-mist">Collects via the member&apos;s gateway. Demo mode records the charge without moving real money.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!pending} onClose={() => setConfirmId(null)} title="Confirm payment received">
        {pending && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{nameOf(pending.memberId)}</p>
              <p className="mt-1">{pending.description}</p>
              <p className="stat-num mt-2 text-2xl">{formatGhsExact(pending.amount)}</p>
              <p className="mt-1 text-mist">This stays unpaid until you confirm funds were received.</p>
            </div>
            <Field label="Received via">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="momo">Mobile Money</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmPayment}>Confirm payment</Button>
              <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!inv} onClose={() => setInv(null)} title={invoice?.number || 'Invoice'}>
        {invoice && (
          <div id="invoice-print" className="space-y-3 text-sm">
            <div className="flex justify-between">
              <div>
                <p className="font-display text-lg">FitPro Gym</p>
                <p className="text-mist">Airport City, Accra · TIN C0067843210</p>
              </div>
              <StatusBadge status={invoice.status} />
            </div>
            <p>Bill to: {invoice.customerName || (invoice.memberId ? nameOf(invoice.memberId) : 'Walk-in customer')}</p>
            <p className="text-mist">Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueAt)}</p>
            <ul className="divide-y divide-line">
              {invoice.items.map((it) => (
                <li key={it.desc} className="flex justify-between py-2"><span>{it.desc}</span><span>{formatGhsExact(it.amount)}</span></li>
              ))}
            </ul>
            <p className="text-right font-display text-xl">Total {formatGhsExact(invoice.total)}</p>
            {invoice.status !== 'paid' && (
              <Button className="no-print w-full" onClick={() => {
                const p = payments.find((x) => x.invoiceId === invoice.id && x.status !== 'paid' && x.status !== 'refunded')
                if (p) { setInv(null); openConfirm(p) }
              }}>Confirm payment</Button>
            )}
            <Button className="no-print w-full" variant="outline" onClick={() => window.print()}>Print / PDF</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

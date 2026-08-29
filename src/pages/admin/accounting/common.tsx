import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Badge, Select, Field, Input, Modal, Button } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { ACCOUNT_TYPES, VOUCHER_METHODS, STAKEHOLDER_CLASSES } from '../../../lib/accounting'
import { useApp } from '../../../context/AppContext'
import { effectiveCurrencies, branchSettingsFor, baseCurrency } from '../../../lib/branchSettings'
import { roleName } from '../../../lib/permissions'
import type { Account, AccountType, BranchCurrency, RoleDef, StakeholderClass, VoucherMethod, VoucherStatus } from '../../../types'

/**
 * Currencies from the Currency settings table (Settings → Branch settings →
 * Currencies) for the active branch, plus the branch base currency code.
 */
export function useBranchCurrencies(): { currencies: BranchCurrency[]; base: string } {
  const { branchSettings, activeBranchId, company } = useApp()
  const currencies = useMemo(
    () => effectiveCurrencies(branchSettingsFor(branchSettings, activeBranchId)),
    [branchSettings, activeBranchId],
  )
  return { currencies, base: baseCurrency(currencies, company.currency) }
}

/**
 * Currency dropdown driven by the Currency settings table. A legacy value not
 * in the table is kept as an extra option so old vouchers still display it.
 */
export function CurrencySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { currencies } = useBranchCurrencies()
  const known = currencies.some((c) => c.code === value)
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && value && <option value={value}>{value}</option>}
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}{c.status === 'base' ? ' (base)' : ''}</option>
      ))}
    </Select>
  )
}

/**
 * All stakeholder classes for voucher forms/filters: the built-in system
 * classes plus every custom class created in Accounting settings →
 * Stakeholder Classes (e.g. "Ministry").
 */
export function useStakeholderClassOptions(): { id: string; label: string }[] {
  const { stakeholderClasses } = useApp()
  return useMemo(
    () => [
      ...STAKEHOLDER_CLASSES,
      ...stakeholderClasses.map((c) => ({ id: c.id, label: c.name })),
    ],
    [stakeholderClasses],
  )
}

/**
 * Stakeholder names for a voucher, grouped by role/register. Fully dynamic:
 * every role in the RBAC table — built-in (Branch Admin, Gym Manager, …) or
 * custom-created later — that has at least one user becomes its own group,
 * and its `portal` decides which stakeholder class it belongs to:
 *   customer    → Customers register + Members + customer-portal roles
 *   supplier    → Suppliers register + supplier-portal roles
 *   employee    → admin/coach-portal roles (Super Admin, Branch Admin, Staff, Trainer, …)
 *   branch      → the organisation's branches (gym clubs, church branches, …)
 *   shareholder / other → everything combined
 */
export type StakeholderGroup = { label: string; names: string[] }

export function useStakeholderGroups(cls: StakeholderClass | undefined): StakeholderGroup[] {
  const { customers, suppliers, members, users, roles, branches, activeCompany, stakeholderClasses, stakeholderEntities } = useApp()
  return useMemo(() => {
    const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b))
    const userName = (id: string) => users.find((u) => u.id === id)?.name || ''

    // Which portal a role id belongs to: RBAC table first (covers custom
    // roles), sensible fallback for legacy built-in ids.
    const portalOf = (roleId: string): RoleDef['portal'] =>
      roles.find((r) => r.id === roleId)?.portal
        ?? (roleId === 'member' ? 'member' : roleId === 'trainer' ? 'coach' : roleId === 'customer' ? 'customer' : roleId === 'supplier' ? 'supplier' : 'admin')

    // Users whose role belongs to the given portal (e.g. customer-portal
    // user accounts). Merged into the matching register group so we never
    // show duplicate "Customer" / "Customers" style groups.
    const portalUserNames = (portal: RoleDef['portal']) =>
      users.filter((u) => u.role !== 'member' && portalOf(u.role) === portal).map((u) => u.name)

    const customerGroup: StakeholderGroup = { label: 'Customers', names: dedupe([...customers.map((c) => c.name), ...portalUserNames('customer')]) }
    const memberGroup: StakeholderGroup = { label: 'Members', names: dedupe([...members.map((m) => userName(m.userId)), ...portalUserNames('member')]) }
    const supplierGroup: StakeholderGroup = { label: 'Suppliers', names: dedupe([...suppliers.map((s) => s.name), ...portalUserNames('supplier')]) }

    // Standing option for one-off / anonymous payers (POS-style walk-ins,
    // church visitors, …) — no register record needed.
    const walkInGroup: StakeholderGroup = { label: 'Walk-in', names: ['Walk-in Customer'] }

    // Branches of the active organisation (gym clubs, church branches, …) —
    // inter-branch transfers receive from / pay to another branch.
    const companyBranches = activeCompany
      ? branches.filter((b) => !b.companyId || b.companyId === activeCompany.id)
      : branches
    const branchGroup: StakeholderGroup = {
      label: 'Branches',
      names: dedupe(companyBranches.filter((b) => b.status !== 'inactive').map((b) => b.name)),
    }

    // One group per role (label = role display name) for users whose role's
    // portal is in the given set. Members are excluded — they surface via the
    // Members register group instead.
    const roleGroups = (portals: RoleDef['portal'][]): StakeholderGroup[] => {
      const byRole = new Map<string, string[]>()
      for (const u of users) {
        if (u.role === 'member') continue
        if (!portals.includes(portalOf(u.role))) continue
        const label = roleName(u.role, roles)
        byRole.set(label, [...(byRole.get(label) || []), u.name])
      }
      return Array.from(byRole.entries())
        .map(([label, names]) => ({ label, names: dedupe(names) }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }

    // Custom classes (Accounting settings → Stakeholder Classes) — each one
    // becomes a group of its active members, e.g. MINISTRY → Children
    // Ministry, Youth Ministry, Women's Ministry.
    const customGroupFor = (classId: string): StakeholderGroup | null => {
      const def = stakeholderClasses.find((c) => c.id === classId)
      if (!def) return null
      return {
        label: def.name,
        names: dedupe(stakeholderEntities.filter((e) => e.classId === classId && e.status === 'active').map((e) => e.name)),
      }
    }
    const allCustomGroups = stakeholderClasses
      .map((c) => customGroupFor(c.id))
      .filter((g): g is StakeholderGroup => !!g)

    let groups: StakeholderGroup[]
    switch (cls) {
      case 'customer': groups = [walkInGroup, customerGroup, memberGroup]; break
      case 'supplier': groups = [supplierGroup]; break
      case 'employee': groups = roleGroups(['admin', 'coach']); break
      case 'branch': groups = [branchGroup]; break
      default: {
        const custom = cls ? customGroupFor(cls) : null
        groups = custom
          ? [custom]
          : [walkInGroup, customerGroup, memberGroup, supplierGroup, branchGroup, ...allCustomGroups, ...roleGroups(['admin', 'coach'])]
      }
    }
    return groups.filter((g) => g.names.length > 0)
  }, [cls, customers, suppliers, members, users, roles, branches, activeCompany, stakeholderClasses, stakeholderEntities])
}

/**
 * "Received From" / "Paid To" dropdown fed by the stakeholder-class register,
 * with options grouped by role. A saved name that is no longer in any
 * register is kept as an extra option so old vouchers still display it.
 */
export function StakeholderSelect({
  stakeholderClass,
  value,
  onChange,
}: {
  stakeholderClass: StakeholderClass | undefined
  value: string
  onChange: (name: string) => void
}) {
  const groups = useStakeholderGroups(stakeholderClass)
  const known = groups.some((g) => g.names.includes(value))
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Please Select…</option>
      {!known && value && <option value={value}>{value}</option>}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.names.map((n) => <option key={`${g.label}:${n}`} value={n}>{n}</option>)}
        </optgroup>
      ))}
    </Select>
  )
}

/**
 * Quick-add button + modal for the voucher stakeholder field. Lets the
 * front desk create a new Customer / Supplier / custom-class member (e.g. a
 * Ministry) without leaving the New/Edit Income or Expense form. The created
 * record lands in the proper register and is selected immediately.
 */
export function QuickAddStakeholder({
  stakeholderClass,
  onCreated,
}: {
  stakeholderClass: StakeholderClass | undefined
  onCreated: (name: string) => void
}) {
  const { stakeholderClasses, customers, suppliers, upsertCustomer, upsertSupplier, upsertStakeholderEntity, stakeholderEntities } = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })

  const customDef = stakeholderClasses.find((c) => c.id === stakeholderClass)
  const kind = stakeholderClass === 'customer' ? 'customer' : stakeholderClass === 'supplier' ? 'supplier' : customDef ? 'custom' : null
  if (!kind) return null
  const noun = kind === 'customer' ? 'customer' : kind === 'supplier' ? 'supplier' : customDef!.name
  const titleNoun = kind === 'customer' ? 'Customer' : kind === 'supplier' ? 'Supplier' : customDef!.name

  const save = () => {
    const name = form.name.trim()
    if (!name) { toast.error('Enter a name.'); return }
    const now = new Date().toISOString()
    if (kind === 'customer') {
      if (customers.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast.error('This customer already exists.'); return }
      upsertCustomer({
        id: uid('cus'), name, email: form.email.trim(), phone: form.phone.trim(),
        category: 'Walk-in', status: 'active', totalSpent: 0, createdAt: now,
      })
    } else if (kind === 'supplier') {
      if (suppliers.some((x) => x.name.toLowerCase() === name.toLowerCase())) { toast.error('This supplier already exists.'); return }
      upsertSupplier({ id: uid('sup'), name, contact: name, email: form.email.trim(), phone: form.phone.trim() })
    } else {
      if (stakeholderEntities.some((e) => e.classId === customDef!.id && e.name.toLowerCase() === name.toLowerCase())) {
        toast.error(`"${name}" already exists in ${customDef!.name}.`); return
      }
      upsertStakeholderEntity({
        id: uid('se'), classId: customDef!.id, name,
        phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
        status: 'active', createdAt: now,
      })
    }
    toast.success(`New ${noun} added`, name)
    onCreated(name)
    setForm({ name: '', phone: '', email: '' })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Add New ${titleNoun}`}
        aria-label={`Add New ${titleNoun}`}
        className="grid h-[42px] w-10 shrink-0 place-items-center rounded border border-[#8aa0b5] bg-white text-mist transition hover:border-[#5b7c99] hover:text-[#16325c] dark:border-[#3f3f46] dark:bg-[#0d0d0f] dark:text-mist dark:hover:border-lime dark:hover:text-lime"
      >
        <UserPlus className="size-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Add New ${titleNoun}`}>
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`${titleNoun} name`} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+233 …" /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><UserPlus className="size-4" /> Add & select</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/**
 * Base currency + a lookup for the suggested conversion rate of a foreign
 * currency into the base, taken from the Currency Rates table (Accounting
 * settings → Currency Rates). Falls back to the inverse pair when only the
 * base→foreign direction is stored.
 */
export function useConversionRate(): { base: string; rateFor: (code: string) => number | undefined } {
  const { base } = useBranchCurrencies()
  const { currencyRates } = useApp()
  const rateFor = (code: string): number | undefined => {
    if (!code || code === base) return undefined
    const direct = currencyRates.find((r) => r.from === code && r.to === base)
    if (direct?.rate) return direct.rate
    const inverse = currencyRates.find((r) => r.from === base && r.to === code)
    return inverse?.rate ? Number((1 / inverse.rate).toFixed(6)) : undefined
  }
  return { base, rateFor }
}

/**
 * Conversion-rate input shown ONLY when the selected currency differs from
 * the branch base currency. Hidden (renders nothing) for base-currency
 * vouchers.
 */
export function ConversionRateField({
  currency,
  value,
  onChange,
}: {
  currency: string
  value: string
  onChange: (v: string) => void
}) {
  const { base, rateFor } = useConversionRate()
  if (!currency || currency === base) return null
  const suggested = rateFor(currency)
  return (
    <Field label={`Conversion Rate (1 ${currency} = ? ${base})`} required>
      <Input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={suggested ? String(suggested) : 'e.g. 15.50'}
      />
    </Field>
  )
}

/**
 * True for asset accounts that hold money — everything under "Cash and cash
 * equivalents": cash, petty cash, bank, mobile money (MoMo), card / gateway
 * settlement accounts (Mastercard, Visa, credit card, Paystack…), wallets.
 * Used to restrict the voucher Deposit / Payment account dropdowns.
 */
export function isCashOrBankAccount(a: Account): boolean {
  if (a.type !== 'asset') return false
  // Primary rule: the account's detail type marks it as a cash equivalent.
  if (/cash and cash equivalents|cash equivalents/i.test(a.detailType || '')) return true
  // Fallback: recognisable money-account names / detail types.
  const hay = `${a.detailType || ''} ${a.name}`.toLowerCase()
  return /\bcash\b|petty|bank|momo|mobile money|wallet|card|mastercard|visa|amex|paystack|hubtel|flutterwave|gateway|undeposited/.test(hay)
}

/**
 * Print a clean table of records (Bulk Actions → Print List). Matches the
 * classic Perfex-style list printout: big bold title, meta subtitle with
 * record count + print timestamp, uppercase light-grey header, grey cell
 * borders, right-aligned numeric columns, zebra striping, bold totals row.
 */
export function printTable(opts: {
  title: string
  subtitle?: string
  headers: { label: string; num?: boolean; width?: string; mono?: boolean; cls?: string }[]
  rows: (string | number)[][]
  totals?: (string | number)[]
  footer?: string
}) {
  const { title, subtitle, headers, rows, totals, footer } = opts
  const esc = (v: string | number | undefined | null) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Build <colgroup> widths when supplied so columns don't collapse on print.
  const colgroup = headers.some((h) => h.width)
    ? `<colgroup>${headers
        .map((h) => `<col${h.width ? ` style="width:${h.width}"` : ''} />`)
        .join('')}</colgroup>`
    : ''

  const th = headers
    .map((h) => `<th class="${[h.num ? 'num' : '', h.cls || ''].filter(Boolean).join(' ')}">${esc(h.label)}</th>`)
    .join('')

  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => {
            const h = headers[i] || {}
            const cls = [h.num ? 'num' : '', h.mono ? 'mono' : '', h.cls || ''].filter(Boolean).join(' ')
            return `<td class="${cls}">${esc(c)}</td>`
          })
          .join('')}</tr>`,
    )
    .join('')

  const numCount = headers.filter((h) => h.num).length
  const foot = totals
    ? `<tfoot><tr>${totals
        .map((c, i) => {
          const h = headers[i] || {}
          const isFirst = i === 0
          // Span the "Total" label across leading non-numeric columns.
          const span = isFirst && numCount > 0 ? ` colspan="${headers.length - numCount}"` : ''
          // When c is empty string in footer → render a visually blank cell.
          const cls = [h.num ? 'num' : '', h.cls || ''].filter(Boolean).join(' ')
          return `<td class="${cls}"${span}>${esc(c)}</td>`
        })
        .join('')}</tr></tfoot>`
    : ''

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{margin:14mm 12mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{font-family:Arial,Helvetica,"Liberation Sans",sans-serif;color:#111;font-size:12.5px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    h1{font-size:32px;font-weight:900;margin:0 0 2px;letter-spacing:-.01em;color:#000}
    p.meta{color:#555;font-size:12px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse;border:1.5px solid #c9ced6;table-layout:fixed}
    colgroup col{}
    th,td{border:1px solid #c9ced6;padding:9px 11px;text-align:left;vertical-align:middle;word-break:break-word;overflow-wrap:break-word}
    th{background:#eef1f5 !important;text-transform:uppercase;font-size:11px;letter-spacing:.05em;font-weight:800;color:#1a1a1a}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;white-space:nowrap}
    td.mono,th.mono{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:12px}
    tbody td{background:#fff}
    tbody tr:nth-child(even) td{background:#f7f9fb !important}
    tfoot td{font-weight:800;background:#f3f5f8 !important;border-top:1.5px solid #b8bfc8;font-size:12.5px}
    tfoot td.num{font-size:13px}
    .print-foot{margin-top:16px;font-size:10px;color:#777;text-align:center}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="meta">${esc(subtitle)}</p>` : ''}
    <table>${colgroup}<thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table>
    ${footer ? `<p class="print-foot">${esc(footer)}</p>` : ''}
  </body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 2000)
  }, 180)
}

/**
 * Batch-print many formal voucher documents in one print job, with a forced
 * page break between each. Each section is an object { styles, body } where
 * `styles` is a shared CSS snippet and `body` is the voucher's <body/> HTML
 * (reuses the per-voucher builders below).
 */
export function printVoucherBatch(title: string, sections: { styles: string; body: string }[]) {
  if (!sections.length) return
  // Use the first section's styles (they're all the same letterhead stylesheet
  // from the same builder, but de-dupe just in case).
  const uniqueStyles = Array.from(new Set(sections.map(s => s.styles)))
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page{margin:14mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
    .voucher{page-break-after:always}
    .voucher:last-child{page-break-after:auto}
    ${uniqueStyles.join('\n')}
  </style></head><body>
    ${sections.map(s => `<div class="voucher">${s.body}</div>`).join('')}
  </body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open(); doc.write(html); doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 2000)
  }, 200)
}

/**
 * Build the HTML fragment for a Receipt Voucher (styles + body) so it can be
 * composed into a batch print or printed standalone by printReceiptVoucher.
 */
export function receiptVoucherHtml(opts: {
  number: string; date: string; receivedFrom: string; amount: number;
  currencyWordsUnit?: string;
  lines: { description: string; narration?: string; amount: number }[];
  methodLabel: string; orgLine1: string; orgLine2?: string;
  tel?: string; email?: string; digitalAddress?: string; website?: string;
  logo?: string; issuedBy?: string; footerText: string;
}) {
  const esc = (v: string | number | undefined) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
  const lineRows = opts.lines.map((l) => `
    <tr>
      <td>${esc(l.description)}${l.narration ? `<br/><strong>Narration:</strong> ${esc(l.narration)}` : ''}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`).join('')
  const styles = `
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .hdr h2{font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.01em}
    .hdr h1{font-size:21px;margin:2px 0 8px;text-transform:uppercase}
    .contact{display:flex;gap:90px;font-size:12.5px}
    .contact div div{margin:1px 0}
    .hdr img{height:82px;width:82px;object-fit:contain}
    h3.title{text-align:center;font-size:22px;margin:16px 0 10px;font-weight:800}
    .row{display:flex;justify-content:space-between;margin:3px 6px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{padding:7px 9px;text-align:left;vertical-align:top;border:0}
    th{font-weight:bold}
    thead th{border-top:1.5px solid #333;border-bottom:1.5px solid #333}
    thead th:first-child{border-left:1.5px solid #333}
    thead th:last-child{border-right:1.5px solid #333}
    th.num,td.num{text-align:right;width:150px;border-left:1.5px solid #333}
    tbody td:first-child{border-left:1.5px solid #333}
    tbody td:last-child{border-right:1.5px solid #333}
    tbody tr td{border-bottom:1px solid #aaa}
    tbody tr:last-child td{border-bottom:0}
    tfoot td{border-top:1.5px solid #333;font-weight:bold;vertical-align:middle;padding-top:10px;padding-bottom:10px}
    tfoot td.num{border:1.5px solid #333;padding:14px 9px}
    .cashrow{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .issued{margin-top:46px;margin-left:auto;margin-right:60px;width:320px;text-align:center}
    .issued .top{display:flex;align-items:flex-end;gap:8px}
    .issued .line{flex:1;border-bottom:1.5px solid #111;height:20px}
    .issued .name{margin-top:4px;font-weight:bold}
    .foot{margin-top:26px;text-align:center;font-size:11px}`
  const body = `
    <div class="hdr">
      <div style="flex:1">
        <h2>${esc(opts.orgLine1)}</h2>
        ${opts.orgLine2 ? `<h1>${esc(opts.orgLine2)}</h1>` : ''}
        <div class="contact">
          <div>
            <div><strong>Tel:</strong> ${esc(opts.tel)}</div>
            <div><strong>Email:</strong> ${esc(opts.email)}</div>
          </div>
          <div>
            <div><strong>Digital Address:</strong> ${esc(opts.digitalAddress)}</div>
            <div><strong>Website Address:</strong> ${esc(opts.website)}</div>
          </div>
        </div>
      </div>
      ${opts.logo ? `<img src="${esc(opts.logo)}" alt="" />` : ''}
    </div>
    <h3 class="title">Receipt Voucher</h3>
    <div class="row"><span><strong>Received from:</strong> ${esc(opts.receivedFrom.toUpperCase())}</span><span><strong>Voucher No:</strong> ${esc(receiptBookNumber(opts.number))}</span></div>
    <div class="row"><span><strong>The sum of:</strong> ${esc(amountInWords(opts.amount, opts.currencyWordsUnit))}</span><span><strong>Date:</strong> ${esc(fmtDate(opts.date))}</span></div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
      <tfoot>
        <tr>
          <td><div class="cashrow"><span><strong>Cash/Cheque No.:</strong> ${esc(opts.methodLabel)}</span><span>Total</span></div></td>
          <td class="num">${money(opts.amount)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="issued">
      <div class="top"><strong>Issued By:</strong><span class="line"></span></div>
      ${opts.issuedBy ? `<div class="name">${esc(opts.issuedBy)}</div>` : ''}
    </div>
    <div class="foot">${esc(opts.footerText)}</div>`
  return { styles, body }
}

/** Print a formal Receipt Voucher document (organisation letterhead style). */
export function printReceiptVoucher(opts: Parameters<typeof receiptVoucherHtml>[0]) {
  const { styles, body } = receiptVoucherHtml(opts)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt Voucher ${opts.number}</title><style>
    @page{margin:14mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:13px}
    ${styles}
  </style></head><body>${body}</body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open(); doc.write(html); doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 2000)
  }, 150)
}

/** Spell an amount in words, e.g. 1900 → "One Thousand Nine Hundred Ghana Cedi(s)". */
export function amountInWords(amount: number, currency = 'Ghana Cedi(s)', subunit = 'Pesewa(s)'): string {
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const three = (n: number): string => {
    let out = ''
    if (n >= 100) { out += `${ONES[Math.floor(n / 100)]} Hundred`; n %= 100; if (n) out += ' ' }
    if (n >= 20) { out += TENS[Math.floor(n / 10)]; n %= 10; if (n) out += `-${ONES[n]}`; return out }
    return out + ONES[n]
  }
  const whole = Math.floor(Math.abs(amount))
  const frac = Math.round((Math.abs(amount) - whole) * 100)
  if (whole === 0 && frac === 0) return `Zero ${currency}`
  const SCALES = ['', ' Thousand', ' Million', ' Billion']
  const parts: string[] = []
  let n = whole, i = 0
  while (n > 0 && i < SCALES.length) {
    const chunk = n % 1000
    if (chunk) parts.unshift(three(chunk) + SCALES[i])
    n = Math.floor(n / 1000)
    i += 1
  }
  let words = parts.join(' ')
  if (words) words += ` ${currency}`
  if (frac) words += `${words ? ' and ' : ''}${three(frac)} ${subunit}`
  return words
}

/** "RV-2026-0003" → "0000003" (last numeric run, zero-padded like a receipt book). */
export function receiptBookNumber(number: string): string {
  const m = number.match(/(\d+)(?!.*\d)/)
  return m ? m[1].padStart(7, '0') : number
}

/** Build HTML fragment for a Payment Voucher for batch or single print. */
export function paymentVoucherHtml(opts: {
  number: string; date: string; paidTo: string; amount: number;
  currencyWordsUnit?: string;
  lines: { description: string; narration?: string; amount: number }[];
  methodLabel: string; orgLine1: string; orgLine2?: string;
  tel?: string; email?: string; digitalAddress?: string; website?: string;
  logo?: string; issuedBy?: string; footerText: string;
}) {
  const esc = (v: string | number | undefined) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
  const lineRows = opts.lines.map((l) => `
    <tr>
      <td>${esc(l.description)}${l.narration ? `<br/><strong>Narration:</strong> ${esc(l.narration)}` : ''}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`).join('')
  const styles = `
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .hdr h2{font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.01em}
    .hdr h1{font-size:21px;margin:2px 0 8px;text-transform:uppercase}
    .contact{display:flex;gap:90px;font-size:12.5px}
    .contact div div{margin:1px 0}
    .hdr img{height:82px;width:82px;object-fit:contain}
    h3.title{text-align:center;font-size:22px;margin:16px 0 10px;font-weight:800}
    .row{display:flex;justify-content:space-between;margin:3px 6px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{padding:7px 9px;text-align:left;vertical-align:top;border:0}
    th{font-weight:bold}
    thead th{border-top:1.5px solid #333;border-bottom:1.5px solid #333}
    thead th:first-child{border-left:1.5px solid #333}
    thead th:last-child{border-right:1.5px solid #333}
    th.num,td.num{text-align:right;width:150px;border-left:1.5px solid #333}
    tbody td:first-child{border-left:1.5px solid #333}
    tbody td:last-child{border-right:1.5px solid #333}
    tbody tr td{border-bottom:1px solid #aaa}
    tbody tr:last-child td{border-bottom:0}
    tfoot td{border-top:1.5px solid #333;font-weight:bold;vertical-align:middle;padding-top:10px;padding-bottom:10px}
    tfoot td.num{border:1.5px solid #333;padding:14px 9px}
    .cashrow{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .issued{margin-top:46px;margin-left:auto;margin-right:60px;width:320px;text-align:center}
    .issued .top{display:flex;align-items:flex-end;gap:8px}
    .issued .line{flex:1;border-bottom:1.5px solid #111;height:20px}
    .issued .name{margin-top:4px;font-weight:bold}
    .foot{margin-top:26px;text-align:center;font-size:11px}`
  const body = `
    <div class="hdr">
      <div style="flex:1">
        <h2>${esc(opts.orgLine1)}</h2>
        ${opts.orgLine2 ? `<h1>${esc(opts.orgLine2)}</h1>` : ''}
        <div class="contact">
          <div>
            <div><strong>Tel:</strong> ${esc(opts.tel)}</div>
            <div><strong>Email:</strong> ${esc(opts.email)}</div>
          </div>
          <div>
            <div><strong>Digital Address:</strong> ${esc(opts.digitalAddress)}</div>
            <div><strong>Website Address:</strong> ${esc(opts.website)}</div>
          </div>
        </div>
      </div>
      ${opts.logo ? `<img src="${esc(opts.logo)}" alt="" />` : ''}
    </div>
    <h3 class="title">Payment Voucher</h3>
    <div class="row"><span><strong>Paid to:</strong> ${esc(opts.paidTo.toUpperCase())}</span><span><strong>Voucher No:</strong> ${esc(receiptBookNumber(opts.number))}</span></div>
    <div class="row"><span><strong>The sum of:</strong> ${esc(amountInWords(opts.amount, opts.currencyWordsUnit))}</span><span><strong>Date:</strong> ${esc(fmtDate(opts.date))}</span></div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
      <tfoot>
        <tr>
          <td><div class="cashrow"><span><strong>Payment Mode:</strong> ${esc(opts.methodLabel)}</span><span>Total</span></div></td>
          <td class="num">${money(opts.amount)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="issued">
      <div class="top"><strong>Issued By:</strong><span class="line"></span></div>
      ${opts.issuedBy ? `<div class="name">${esc(opts.issuedBy)}</div>` : ''}
    </div>
    <div class="foot">${esc(opts.footerText)}</div>`
  return { styles, body }
}

/** Print a formal Payment Voucher document. */
export function printPaymentVoucher(opts: Parameters<typeof paymentVoucherHtml>[0]) {
  const { styles, body } = paymentVoucherHtml(opts)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payment Voucher ${opts.number}</title><style>
    @page{margin:14mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:13px}
    ${styles}
  </style></head><body>${body}</body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open(); doc.write(html); doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 2000)
  }, 150)
}

/** Build HTML fragment for a Journal Voucher for batch or single print. */
export function journalVoucherHtml(opts: {
  number: string; date: string; description: string; amount: number;
  lines: { account: string; debit: number; credit: number }[];
  orgLine1: string; orgLine2?: string;
  tel?: string; email?: string; digitalAddress?: string; website?: string;
  logo?: string; issuedBy?: string; footerText: string; notes?: string; currencyLabel?: string;
}) {
  const esc = (v: string | number | undefined) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }
  const totalDebit = opts.lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = opts.lines.reduce((s, l) => s + (l.credit || 0), 0)
  const lineRows = opts.lines.map((l) => `
    <tr>
      <td>${esc(l.account)}</td>
      <td class="num">${l.debit ? money(l.debit) : ''}</td>
      <td class="num">${l.credit ? money(l.credit) : ''}</td>
    </tr>`).join('')
  const styles = `
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .hdr h2{font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.01em}
    .hdr h1{font-size:21px;margin:2px 0 8px;text-transform:uppercase}
    .contact{display:flex;gap:90px;font-size:12.5px}
    .contact div div{margin:1px 0}
    .hdr img{height:82px;width:82px;object-fit:contain}
    h3.title{text-align:center;font-size:22px;margin:16px 0 10px;font-weight:800}
    .row{display:flex;justify-content:space-between;margin:3px 6px}
    .desc{margin:6px 6px 0;font-style:italic}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;border:1.5px solid #333}
    th,td{padding:7px 9px;text-align:left;vertical-align:top;border:0}
    th{font-weight:bold}
    th.num,td.num{text-align:right;width:130px;border-left:1.5px solid #333}
    thead th{border-bottom:1.5px solid #333}
    tbody tr td{border-bottom:1px solid #aaa}
    tbody tr:last-child td{border-bottom:0}
    tfoot td{font-weight:bold;border-top:1.5px solid #333}
    .notes{margin-top:10px;font-size:12px;color:#333}
    .issued{margin-top:46px;margin-left:auto;margin-right:60px;width:320px;text-align:center}
    .issued .top{display:flex;align-items:flex-end;gap:8px}
    .issued .line{flex:1;border-bottom:1.5px solid #111;height:20px}
    .issued .name{margin-top:4px;font-weight:bold}
    .foot{margin-top:26px;text-align:center;font-size:11px}`
  const body = `
    <div class="hdr">
      <div style="flex:1">
        <h2>${esc(opts.orgLine1)}</h2>
        ${opts.orgLine2 ? `<h1>${esc(opts.orgLine2)}</h1>` : ''}
        <div class="contact">
          <div>
            <div><strong>Tel:</strong> ${esc(opts.tel)}</div>
            <div><strong>Email:</strong> ${esc(opts.email)}</div>
          </div>
          <div>
            <div><strong>Digital Address:</strong> ${esc(opts.digitalAddress)}</div>
            <div><strong>Website Address:</strong> ${esc(opts.website)}</div>
          </div>
        </div>
      </div>
      ${opts.logo ? `<img src="${esc(opts.logo)}" alt="" />` : ''}
    </div>
    <h3 class="title">Journal Voucher</h3>
    <div class="row"><span><strong>Voucher No:</strong> ${esc(opts.number)}</span><span><strong>Date:</strong> ${esc(fmtDate(opts.date))}</span></div>
    <div class="desc">${esc(opts.description)}</div>
    <table>
      <thead><tr><th>Account</th><th class="num">Debit (${esc(opts.currencyLabel || '')})</th><th class="num">Credit (${esc(opts.currencyLabel || '')})</th></tr></thead>
      <tbody>${lineRows}</tbody>
      <tfoot>
        <tr>
          <td><strong>Total</strong></td>
          <td class="num">${money(totalDebit)}</td>
          <td class="num">${money(totalCredit)}</td>
        </tr>
      </tfoot>
    </table>
    ${opts.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(opts.notes)}</div>` : ''}
    <div class="issued">
      <div class="top"><strong>Prepared By:</strong><span class="line"></span></div>
      ${opts.issuedBy ? `<div class="name">${esc(opts.issuedBy)}</div>` : ''}
    </div>
    <div class="foot">${esc(opts.footerText)}</div>`
  return { styles, body }
}

/** Print a formal Journal Voucher document (letterhead + two-column debit/credit table). */
export function printJournalVoucher(opts: Parameters<typeof journalVoucherHtml>[0]) {
  const { styles, body } = journalVoucherHtml(opts)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Journal Voucher ${opts.number}</title><style>
    @page{margin:14mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:13px}
    ${styles}
  </style></head><body>${body}</body></html>`
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open(); doc.write(html); doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 2000)
  }, 150)
}

/** "1001 — Name" when the account has a code, plain "Name" otherwise. */
export function accountLabel(a: Pick<Account, 'code' | 'name'>): string {
  return a.code ? `${a.code} — ${a.name}` : a.name
}

export function statusTone(s: VoucherStatus): 'lime' | 'zinc' | 'rose' {
  if (s === 'posted') return 'lime'
  if (s === 'void') return 'rose'
  return 'zinc'
}

export function VoucherStatusBadge({ status }: { status: VoucherStatus }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  filterType,
  required,
}: {
  accounts: Account[]
  value: string
  onChange: (v: string) => void
  filterType?: AccountType
  required?: boolean
}) {
  const list = filterType ? accounts.filter((a) => a.type === filterType) : accounts
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{required ? 'Select account…' : 'None'}</option>
      {list.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
    </Select>
  )
}

export function MethodSelect({ value, onChange }: { value: VoucherMethod; onChange: (v: VoucherMethod) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as VoucherMethod)}>
      {VOUCHER_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
    </Select>
  )
}

export function StatusSelect({ value, onChange }: { value: VoucherStatus; onChange: (v: VoucherStatus) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as VoucherStatus)}>
      <option value="draft">draft</option>
      <option value="posted">posted</option>
      <option value="void">void</option>
    </Select>
  )
}

export function TypeLabel({ type }: { type: AccountType }) {
  return ACCOUNT_TYPES.find((t) => t.id === type)?.label || type
}

export function AccountField({ accounts, value, onChange, label = 'Account', filterType }: {
  accounts: Account[]; value: string; onChange: (v: string) => void; label?: string; filterType?: AccountType
}) {
  return (
    <Field label={label}>
      <AccountSelect accounts={accounts} value={value} onChange={onChange} filterType={filterType} />
    </Field>
  )
}

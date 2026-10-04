import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, Ticket, Search, Ban, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker, Empty } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../lib/utils'
import {
  COUPON_TARGET_TYPES, loadCoupons, saveCoupons, loadCouponAssignments, saveCouponAssignments,
  isCouponLive, couponValueLabel,
} from '../../lib/coupons'
import type { Coupon, CouponAssignment, CouponTargetType } from '../../types'

type TabId = 'assign' | 'master'

type CouponForm = {
  id?: string
  code: string
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  validFrom: string
  validTo: string
  status: 'active' | 'inactive'
  usageLimit: string
  minPurchase: string
  notes: string
}

type AssignForm = {
  id?: string
  couponId: string
  targetType: CouponTargetType
  targetId: string
  notes: string
}

const blankCoupon = (): CouponForm => ({
  code: '', name: '', discountType: 'percentage', discountValue: '',
  validFrom: new Date().toISOString().slice(0, 10), validTo: '', status: 'active', usageLimit: '', minPurchase: '', notes: '',
})

const blankAssign = (): AssignForm => ({ couponId: '', targetType: 'customer', targetId: '', notes: '' })

export function CouponsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tab: TabId = location.pathname.endsWith('master') ? 'master' : 'assign'

  const { members, users, inventory, invoices, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [coupons, setCoupons] = useState<Coupon[]>(() => loadCoupons())
  const [assignments, setAssignments] = useState<CouponAssignment[]>(() => loadCouponAssignments())
  const [q, setQ] = useState('')

  const [couponForm, setCouponForm] = useState<CouponForm | null>(null)
  const [assignForm, setAssignForm] = useState<AssignForm | null>(null)
  const [viewAssign, setViewAssign] = useState<CouponAssignment | null>(null)
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null)
  const [deletingAssign, setDeletingAssign] = useState<CouponAssignment | null>(null)

  const commitCoupons = (next: Coupon[]) => { setCoupons(next); saveCoupons(next) }
  const commitAssignments = (next: CouponAssignment[]) => { setAssignments(next); saveCouponAssignments(next) }

  const userName = (id: string) => users.find((u) => u.id === id)?.name || id
  const couponOf = (id: string) => coupons.find((c) => c.id === id)

  const targetLabel = (t: CouponTargetType, id: string): string => {
    if (t === 'customer') {
      const m = members.find((x) => x.userId === id)
      return m ? userName(m.userId) : id
    }
    if (t === 'product') {
      const it = inventory.find((x) => x.id === id)
      return it ? `${it.name}${it.sku ? ` — ${it.sku}` : ''}` : id
    }
    const inv = invoices.find((x) => x.id === id)
    return inv ? `${inv.number}${inv.customerName ? ` — ${inv.customerName}` : ''}` : id
  }

  const targetOptions = useMemo(() => {
    const type = assignForm?.targetType || 'customer'
    if (type === 'customer') return members.map((m) => ({ id: m.userId, label: targetLabel('customer', m.userId) }))
    if (type === 'product') return inventory.map((it) => ({ id: it.id, label: `${it.name}${it.sku ? ` — ${it.sku}` : ''}` }))
    return invoices.map((inv) => ({ id: inv.id, label: `${inv.number}${inv.customerName ? ` — ${inv.customerName}` : ''}` }))
  }, [assignForm?.targetType, members, inventory, invoices, users])

  const filteredAssignments = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return assignments
    return assignments.filter((a) => {
      const c = couponOf(a.couponId)
      return [a.targetLabel || '', c?.code || '', c?.name || ''].join(' ').toLowerCase().includes(s)
    })
  }, [assignments, coupons, q])

  const filteredCoupons = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return coupons
    return coupons.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(s))
  }, [coupons, q])

  // ── Coupon master CRUD ──
  const saveCoupon = () => {
    if (!couponForm) return
    const code = couponForm.code.trim().toUpperCase()
    const name = couponForm.name.trim()
    if (!code) { toast.error('Coupon code required.', 'Coupon Master'); return }
    if (!name) { toast.error('Coupon name required.', 'Coupon Master'); return }
    if (coupons.some((c) => c.code.toUpperCase() === code && c.id !== couponForm.id)) {
      toast.error('That coupon code already exists.', 'Coupon Master'); return
    }
    const value = Number(couponForm.discountValue)
    if (!(value > 0)) { toast.error('Discount value must be greater than zero.', 'Coupon Master'); return }
    if (couponForm.discountType === 'percentage' && value > 100) {
      toast.error('Percentage discount cannot exceed 100%.', 'Coupon Master'); return
    }
    if (couponForm.validFrom && couponForm.validTo && couponForm.validTo < couponForm.validFrom) {
      toast.error('Valid-to date must be on or after valid-from.', 'Coupon Master'); return
    }
    const isNew = !couponForm.id
    const next: Coupon = {
      id: couponForm.id || uid('cp'),
      code,
      name,
      discountType: couponForm.discountType,
      discountValue: value,
      validFrom: couponForm.validFrom,
      validTo: couponForm.validTo,
      status: couponForm.status,
      usageLimit: Math.max(0, Number(couponForm.usageLimit) || 0) || undefined,
      minPurchase: Math.max(0, Number(couponForm.minPurchase) || 0) || undefined,
      used: isNew ? 0 : (coupons.find((c) => c.id === couponForm.id)?.used ?? 0),
      notes: couponForm.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (coupons.find((c) => c.id === couponForm.id)?.createdAt || new Date().toISOString()),
    }
    const list = isNew ? [next, ...coupons] : coupons.map((c) => (c.id === next.id ? next : c))
    commitCoupons(list)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Coupon', `${isNew ? 'Created' : 'Updated'} ${code} — ${name}`)
    toast.success(isNew ? 'Coupon created' : 'Coupon updated', `${code} — ${name}`)
    setCouponForm(null)
  }

  const confirmDeleteCoupon = () => {
    if (!deletingCoupon) return
    const linked = assignments.filter((a) => a.couponId === deletingCoupon.id)
    commitCoupons(coupons.filter((c) => c.id !== deletingCoupon.id))
    if (linked.length) commitAssignments(assignments.filter((a) => a.couponId !== deletingCoupon.id))
    log(user?.id || 'system', 'DELETE', 'Coupon', `Deleted ${deletingCoupon.code}${linked.length ? ` (+${linked.length} assignment(s))` : ''}`)
    toast.success('Coupon deleted', deletingCoupon.code)
    setDeletingCoupon(null)
  }

  // ── Assignment CRUD ──
  const saveAssignment = () => {
    if (!assignForm) return
    const coupon = couponOf(assignForm.couponId)
    if (!coupon) { toast.error('Select a coupon.', 'Assign Coupon'); return }
    if (!assignForm.targetId) { toast.error('Select what to assign the coupon to.', 'Assign Coupon'); return }
    if (assignments.some((a) => a.couponId === assignForm.couponId && a.targetType === assignForm.targetType && a.targetId === assignForm.targetId && a.id !== assignForm.id)) {
      toast.error('This coupon is already assigned to that target.', 'Assign Coupon'); return
    }
    const isNew = !assignForm.id
    const next: CouponAssignment = {
      id: assignForm.id || uid('ca'),
      couponId: coupon.id,
      targetType: assignForm.targetType,
      targetId: assignForm.targetId,
      targetLabel: targetLabel(assignForm.targetType, assignForm.targetId),
      status: isNew ? 'active' : (assignments.find((a) => a.id === assignForm.id)?.status || 'active'),
      usedCount: assignments.find((a) => a.id === assignForm.id)?.usedCount ?? 0,
      notes: assignForm.notes.trim() || undefined,
      assignedAt: isNew ? new Date().toISOString() : (assignments.find((a) => a.id === assignForm.id)?.assignedAt || new Date().toISOString()),
      assignedBy: isNew ? (user?.id || 'system') : (assignments.find((a) => a.id === assignForm.id)?.assignedBy || user?.id),
    }
    const list = isNew ? [next, ...assignments] : assignments.map((a) => (a.id === next.id ? next : a))
    commitAssignments(list)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Coupon Assignment', `${isNew ? 'Assigned' : 'Updated'} ${coupon.code} → ${next.targetLabel}`)
    toast.success(isNew ? 'Coupon assigned' : 'Assignment updated', `${coupon.code} → ${next.targetLabel}`)
    setAssignForm(null)
  }

  const toggleAssignStatus = (a: CouponAssignment) => {
    const nextStatus = a.status === 'active' ? 'revoked' : 'active'
    commitAssignments(assignments.map((x) => (x.id === a.id ? { ...x, status: nextStatus } : x)))
    log(user?.id || 'system', 'UPDATE', 'Coupon Assignment', `${nextStatus === 'active' ? 'Reactivated' : 'Revoked'} ${couponOf(a.couponId)?.code || a.couponId} → ${a.targetLabel}`)
    toast.success(nextStatus === 'active' ? 'Assignment reactivated' : 'Assignment revoked', a.targetLabel || '')
  }

  const confirmDeleteAssignment = () => {
    if (!deletingAssign) return
    commitAssignments(assignments.filter((a) => a.id !== deletingAssign.id))
    log(user?.id || 'system', 'DELETE', 'Coupon Assignment', `Deleted ${couponOf(deletingAssign.couponId)?.code || deletingAssign.couponId} → ${deletingAssign.targetLabel}`)
    toast.success('Assignment deleted', deletingAssign.targetLabel || '')
    setDeletingAssign(null)
  }

  const exportMaster = () => {
    exportExcel(
      'coupons',
      filteredCoupons.map((c) => ({
        Code: c.code, Name: c.name,
        'Discount type': c.discountType === 'percentage' ? 'Percentage' : 'Fixed amount',
        Value: couponValueLabel(c), 'Valid from': c.validFrom, 'Valid to': c.validTo,
        'Usage limit': c.usageLimit || 'Unlimited', Used: c.used || 0,
        Status: c.status, Notes: c.notes || '',
      })),
    )
    toast.success('Export ready', 'Coupon master exported.')
  }

  const searchBox = (
    <div className="group relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist transition-colors group-focus-within:text-[#c8f542]" />
      <Input
        style={{ borderRadius: 999, paddingLeft: 44, paddingRight: 16 }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tab === 'assign' ? 'Search coupon or target…' : 'Search code or name…'}
        aria-label="Search"
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Coupons"
        desc="Create coupon master records and assign coupons to customers, products, or transactions."
      />

      {/* Module tabs — switch without leaving the Coupons module. */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'assign' as TabId, label: 'Assign Coupon', count: assignments.length, to: '/admin/coupons/assign' },
          { id: 'master' as TabId, label: 'Coupon Master', count: coupons.length, to: '/admin/coupons/master' },
        ]).map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { navigate(t.to); setQ('') }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? 'bg-lime/20 text-lime' : 'bg-zinc-500/15 text-mist hover:text-white'}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-lime/20 text-lime' : 'bg-zinc-500/15 text-mist'}`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Assign Coupon tab ─────────────────────────────────────────── */}
      {tab === 'assign' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {searchBox}
            {canManage && (
              <Button variant="primary" onClick={() => setAssignForm(blankAssign())}>
                <Plus className="size-4" /> Assign coupon
              </Button>
            )}
          </div>

          <div className="card overflow-x-auto">
            {filteredAssignments.length ? (
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                    <th className="px-4 py-3 font-semibold">Coupon</th>
                    <th className="px-4 py-3 font-semibold">Assigned to</th>
                    <th className="px-4 py-3 font-semibold">Assigned</th>
                    <th className="px-4 py-3 font-semibold">Used</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a) => {
                    const c = couponOf(a.couponId)
                    const typeMeta = COUPON_TARGET_TYPES.find((t) => t.id === a.targetType)
                    return (
                      <tr key={a.id} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-mono font-semibold">{c?.code || '—'}</p>
                          <p className="text-xs text-mist">{c ? `${c.name} · ${couponValueLabel(c)}` : 'Coupon deleted'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge tone={a.targetType === 'customer' ? 'sky' : a.targetType === 'product' ? 'violet' : 'orange'}>
                              {typeMeta?.label || a.targetType}
                            </Badge>
                            <span>{a.targetLabel || a.targetId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-mist">{formatDate(a.assignedAt.slice(0, 10))}</td>
                        <td className="px-4 py-3">{a.usedCount || 0}</td>
                        <td className="px-4 py-3">
                          {a.status === 'active' ? <Badge tone="lime">Active</Badge> : <Badge tone="rose">Revoked</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" title="View" className="rounded-lg p-2 text-mist transition hover:text-white" onClick={() => setViewAssign(a)}>
                              <Eye className="size-4" />
                            </button>
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  title="Edit"
                                  className="rounded-lg p-2 text-mist transition hover:text-white"
                                  onClick={() => setAssignForm({ id: a.id, couponId: a.couponId, targetType: a.targetType, targetId: a.targetId, notes: a.notes || '' })}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  title={a.status === 'active' ? 'Revoke' : 'Reactivate'}
                                  className="rounded-lg p-2 text-mist transition hover:text-amber-500"
                                  onClick={() => toggleAssignStatus(a)}
                                >
                                  {a.status === 'active' ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                                </button>
                                <button type="button" title="Delete" className="rounded-lg p-2 text-mist transition hover:text-rose-500" onClick={() => setDeletingAssign(a)}>
                                  <Trash2 className="size-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <Empty title="No coupon assignments" desc="Assign a coupon to a customer, product, or transaction to get started." />
            )}
          </div>
        </div>
      )}

      {/* ── Coupon Master tab ─────────────────────────────────────────── */}
      {tab === 'master' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {searchBox}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={exportMaster}>
                <FileSpreadsheet className="size-4" /> Export
              </Button>
              {canManage && (
                <Button variant="primary" onClick={() => setCouponForm(blankCoupon())}>
                  <Plus className="size-4" /> New coupon
                </Button>
              )}
            </div>
          </div>

          <div className="card overflow-x-auto">
            {filteredCoupons.length ? (
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Discount</th>
                    <th className="px-4 py-3 font-semibold">Valid from</th>
                    <th className="px-4 py-3 font-semibold">Valid to</th>
                    <th className="px-4 py-3 font-semibold">Usage</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((c) => {
                    const limitHit = (c.usageLimit || 0) > 0 && (c.used || 0) >= (c.usageLimit || 0)
                    return (
                      <tr key={c.id} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                        <td className="px-4 py-3">{c.name}</td>
                        <td className="px-4 py-3">
                          <Badge tone={c.discountType === 'percentage' ? 'lime' : 'sky'}>
                            {c.discountType === 'percentage' ? 'Percentage' : 'Fixed'} · {couponValueLabel(c)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-mist">{formatDate(c.validFrom)}</td>
                        <td className="px-4 py-3 text-mist">{c.validTo ? formatDate(c.validTo) : '—'}</td>
                        <td className="px-4 py-3">
                          {c.used || 0}{c.usageLimit ? ` / ${c.usageLimit}` : ' / ∞'}
                          {limitHit && <span className="ml-2 text-[11px] font-semibold text-amber-500">Limit reached</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.status === 'active'
                            ? (isCouponLive(c) ? <Badge tone="lime">Active</Badge> : <Badge tone="amber">Active · outside window</Badge>)
                            : <Badge tone="zinc">Inactive</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  title="Edit"
                                  className="rounded-lg p-2 text-mist transition hover:text-white"
                                  onClick={() => setCouponForm({
                                    id: c.id, code: c.code, name: c.name, discountType: c.discountType,
                                    discountValue: String(c.discountValue), validFrom: c.validFrom, validTo: c.validTo,
                                    status: c.status, usageLimit: c.usageLimit ? String(c.usageLimit) : '', minPurchase: c.minPurchase ? String(c.minPurchase) : '', notes: c.notes || '',
                                  })}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button type="button" title="Delete" className="rounded-lg p-2 text-mist transition hover:text-rose-500" onClick={() => setDeletingCoupon(c)}>
                                  <Trash2 className="size-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <Empty title="No coupons yet" desc="Create your first coupon master record to start assigning coupons." />
            )}
          </div>
        </div>
      )}

      {/* ── Coupon master modal ───────────────────────────────────────── */}
      <Modal open={!!couponForm} onClose={() => setCouponForm(null)} title={couponForm?.id ? 'Edit coupon' : 'New coupon'}>
        {couponForm && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Coupon code" required>
                <Input
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. WELCOME5"
                  className="font-mono"
                />
              </Field>
              <Field label="Coupon name" required>
                <Input value={couponForm.name} onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} placeholder="e.g. Welcome coupon" />
              </Field>
              <Field label="Discount type" required>
                <Select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as 'percentage' | 'fixed' })}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (GHS)</option>
                </Select>
              </Field>
              <Field label={couponForm.discountType === 'percentage' ? 'Discount value (%)' : 'Discount value (GHS)'} required>
                <Input type="number" min={0} step="0.01" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} />
              </Field>
              <Field label="Valid from" required>
                <DatePicker value={couponForm.validFrom} onChange={(v) => setCouponForm({ ...couponForm, validFrom: v })} />
              </Field>
              <Field label="Valid to">
                <DatePicker value={couponForm.validTo} onChange={(v) => setCouponForm({ ...couponForm, validTo: v })} />
              </Field>
              <Field label="Status">
                <Select value={couponForm.status} onChange={(e) => setCouponForm({ ...couponForm, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
              <Field label="Usage limit (blank = unlimited)">
                <Input type="number" min={0} step="1" value={couponForm.usageLimit} onChange={(e) => setCouponForm({ ...couponForm, usageLimit: e.target.value })} placeholder="Unlimited" />
              </Field>
              <Field label="Minimum purchase (GHS, blank = none)">
                <Input type="number" min={0} step="0.01" value={couponForm.minPurchase} onChange={(e) => setCouponForm({ ...couponForm, minPurchase: e.target.value })} placeholder="None" />
              </Field>
            </div>
            <Field label="Notes">
              <Input value={couponForm.notes} onChange={(e) => setCouponForm({ ...couponForm, notes: e.target.value })} placeholder="Optional note…" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCouponForm(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveCoupon}>{couponForm.id ? 'Save changes' : 'Create coupon'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Assign coupon modal ───────────────────────────────────────── */}
      <Modal open={!!assignForm} onClose={() => setAssignForm(null)} title={assignForm?.id ? 'Edit assignment' : 'Assign coupon'}>
        {assignForm && (
          <div className="space-y-3">
            <Field label="Coupon" required>
              <Select
                value={assignForm.couponId}
                placeholder="Search coupons…"
                onChange={(e) => setAssignForm({ ...assignForm, couponId: e.target.value })}
              >
                <option value="">Please Select…</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({couponValueLabel(c)}){c.status === 'active' ? '' : ' · inactive'}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Assign to" required>
                <Select
                  value={assignForm.targetType}
                  onChange={(e) => setAssignForm({ ...assignForm, targetType: e.target.value as CouponTargetType, targetId: '' })}
                >
                  {COUPON_TARGET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Target" required>
                <Select
                  value={assignForm.targetId}
                  placeholder="Search…"
                  onChange={(e) => setAssignForm({ ...assignForm, targetId: e.target.value })}
                >
                  <option value="">Please Select…</option>
                  {targetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Input value={assignForm.notes} onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} placeholder="Optional note…" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setAssignForm(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveAssignment}>{assignForm.id ? 'Save changes' : 'Assign coupon'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── View assignment ───────────────────────────────────────────── */}
      <Modal open={!!viewAssign} onClose={() => setViewAssign(null)} title="Coupon assignment" narrow>
        {viewAssign && (() => {
          const c = couponOf(viewAssign.couponId)
          const rows: [string, string][] = [
            ['Coupon', c ? `${c.code} — ${c.name}` : 'Coupon deleted'],
            ['Discount', c ? couponValueLabel(c) : '—'],
            ['Valid', c ? `${formatDate(c.validFrom)} → ${c.validTo ? formatDate(c.validTo) : 'no end'}` : '—'],
            ['Assigned to', `${COUPON_TARGET_TYPES.find((t) => t.id === viewAssign.targetType)?.label || viewAssign.targetType}: ${viewAssign.targetLabel || viewAssign.targetId}`],
            ['Assigned', formatDate(viewAssign.assignedAt.slice(0, 10))],
            ['Used', String(viewAssign.usedCount || 0)],
            ['Status', viewAssign.status === 'active' ? 'Active' : 'Revoked'],
            ['Notes', viewAssign.notes || '—'],
          ]
          return (
            <div className="space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line/60 pb-2 last:border-0">
                  <span className="text-mist">{k}</span>
                  <span className="text-right font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setViewAssign(null)}>Close</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Delete confirms ───────────────────────────────────────────── */}
      <Modal open={!!deletingCoupon} onClose={() => setDeletingCoupon(null)} title="Delete coupon" narrow>
        {deletingCoupon && (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              Delete coupon <span className="font-mono font-semibold text-inherit">{deletingCoupon.code}</span>?
              {assignments.some((a) => a.couponId === deletingCoupon.id) && (
                <> This also removes <span className="font-semibold text-inherit">{assignments.filter((a) => a.couponId === deletingCoupon.id).length}</span> assignment(s).</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeletingCoupon(null)}>Keep it</Button>
              <Button variant="danger" onClick={confirmDeleteCoupon}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deletingAssign} onClose={() => setDeletingAssign(null)} title="Delete assignment" narrow>
        {deletingAssign && (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              Delete this assignment of <span className="font-mono font-semibold text-inherit">{couponOf(deletingAssign.couponId)?.code || 'coupon'}</span> to{' '}
              <span className="font-semibold text-inherit">{deletingAssign.targetLabel || deletingAssign.targetId}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeletingAssign(null)}>Keep it</Button>
              <Button variant="danger" onClick={confirmDeleteAssignment}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <p className="flex items-center gap-1.5 pb-2 text-xs text-mist">
        <Ticket className="size-3.5" aria-hidden /> Coupons are independent of the Discounts table — codes here are managed in the Coupon Master tab.
      </p>
    </div>
  )
}

export default CouponsPage

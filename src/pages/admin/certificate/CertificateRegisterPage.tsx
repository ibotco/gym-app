import { createPortal } from 'react-dom'
import { useMemo, useState } from 'react'
import { Pencil, Plus, Printer, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext, CERT_HOLDERS, CERT_HOLDER_NAME_LABELS } from './CertificateShared'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'

const STATUSES = ['Draft', 'Issued', 'Revoked', 'Expired'] as const

type Draft = { holderType: string; holderName: string; certificateType: string; certificateNo: string; template: string; issueDate: string; expiryDate: string; status: string; remarks: string }

function statusTone(status: string): 'lime' | 'amber' | 'rose' | 'zinc' {
  const s = String(status ?? '').toLowerCase()
  if (s === 'issued') return 'lime'
  if (s === 'draft') return 'amber'
  if (s === 'revoked' || s === 'expired') return 'rose'
  return 'zinc'
}

export function CertificateRegisterPage() {
  const { registers, types, templates, can, patch } = useCertificateContext()
  const toast = useToast()
  const allowed = can('generate')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [draft, setDraft] = useState<Draft>({ holderType: 'University', holderName: '', certificateType: '', certificateNo: '', template: '', issueDate: new Date().toISOString().slice(0, 10), expiryDate: '', status: 'Draft', remarks: '' })
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)

  const typeNames = useMemo(() => types.map((r) => String(r.name ?? '')).filter(Boolean), [types])
  const templateNames = useMemo(() => templates.map((r) => String(r.templateName ?? '')).filter(Boolean), [templates])

  /* Sort by issue date descending — most recent first */
  const sortedRegisters = useMemo(() => {
    return [...registers].sort((a, b) => {
      const da = String(a.issueDate ?? '')
      const db = String(b.issueDate ?? '')
      return db.localeCompare(da)
    })
  }, [registers])

  /* Summary stats */
  const stats = useMemo(() => {
    const total = registers.length
    const byStatus: Record<string, number> = {}
    for (const r of registers) {
      const s = String(r.status ?? 'Draft')
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    const byType: Record<string, number> = {}
    for (const r of registers) {
      const t = String(r.certificateType ?? 'Unknown')
      byType[t] = (byType[t] ?? 0) + 1
    }
    const byHolder: Record<string, number> = {}
    for (const r of registers) {
      const h = String(r.holderType ?? 'Unknown')
      byHolder[h] = (byHolder[h] ?? 0) + 1
    }
    return { total, byStatus, byType, byHolder }
  }, [registers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedRegisters
    return sortedRegisters.filter((r) => [r.holderName, r.holder, r.certificateType, r.certificateNo, r.holderType, r.template, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [sortedRegisters, query])

  const openNew = () => {
    const prefix = (types.find((t) => String(t.name) === typeNames[0])?.serialPrefix as string | undefined) ?? 'CERT-'
    const seq = registers.length + 1
    const autoNo = `${(prefix || 'CERT-').trim()}${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
    setDraft({ holderType: 'University', holderName: '', certificateType: typeNames[0] ?? '', certificateNo: autoNo, template: templateNames[0] ?? '', issueDate: new Date().toISOString().slice(0, 10), expiryDate: '', status: 'Issued', remarks: '' })
    setEditing({ id: '' } as EduRow)
  }
  const openEdit = (row: EduRow) => {
    setDraft({
      holderType: CERT_HOLDERS.includes(row.holderType as any) ? String(row.holderType) : 'Other Institution',
      holderName: String(row.holderName ?? row.holder ?? ''),
      certificateType: String(row.certificateType ?? ''),
      certificateNo: String(row.certificateNo ?? ''),
      template: String(row.template ?? ''),
      issueDate: String(row.issueDate ?? ''),
      expiryDate: String(row.expiryDate ?? ''),
      status: String(row.status ?? 'Draft'),
      remarks: String(row.remarks ?? ''),
    })
    setEditing(row)
  }
  const save = () => {
    if (!draft.holderName.trim()) { toast.error('Holder required', `Enter the ${CERT_HOLDER_NAME_LABELS[draft.holderType]?.label || 'holder'} name.`); return }
    if (!draft.certificateType.trim()) { toast.error('Type required', 'Pick a certificate type.'); return }
    if (!draft.certificateNo.trim()) { toast.error('Number required', 'Enter a certificate number.'); return }
    const row: EduRow = {
      id: editing?.id || uid('certreg'),
      holderType: draft.holderType,
      holderName: draft.holderName.trim(),
      holder: draft.holderName.trim(),
      certificateType: draft.certificateType.trim(),
      certificateNo: draft.certificateNo.trim(),
      template: draft.template,
      issueDate: draft.issueDate,
      expiryDate: draft.expiryDate,
      status: draft.status,
      remarks: draft.remarks.trim(),
      createdAt: new Date().toISOString(),
    }
    const next = editing?.id ? registers.map((r) => r.id === editing.id ? row : r) : [...registers, row]
    patch({ certificateRegister: next as EduRow[], certificateGeneration: next as EduRow[] })
    toast.success(editing?.id ? 'Register updated' : 'Certificate registered', `${draft.holderType}: ${draft.certificateNo}`)
    setEditing(null)
  }
  const remove = () => {
    if (!confirmDelete) return
    const next = registers.filter((r) => r.id !== confirmDelete.id) as EduRow[]
    patch({ certificateRegister: next, certificateGeneration: next })
    toast.success('Deleted', String(confirmDelete.certificateNo ?? 'Entry'))
    setConfirmDelete(null)
  }
  const doPrint = () => {
    document.body.classList.add('cert-register-printing')
    const done = () => {
      document.body.classList.remove('cert-register-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.setTimeout(() => window.print(), 80)
  }

  const columns: Column<EduRow>[] = [
    { key: 'certificateNo', header: 'Certificate No', sortValue: (r) => String(r.certificateNo ?? ''), render: (r) => <span className="font-mono text-xs font-semibold">{String(r.certificateNo ?? '—')}</span> },
    { key: 'holderName', header: 'Holder', sortValue: (r) => String(r.holderName ?? r.holder ?? ''), render: (r) => <div><p className="font-medium">{String(r.holderName ?? r.holder ?? '')}</p><p className="text-[11px] text-mist">{String(r.holderType ?? '')}</p></div> },
    { key: 'certificateType', header: 'Type', sortValue: (r) => String(r.certificateType ?? ''), render: (r) => <Badge tone="zinc">{String(r.certificateType ?? '')}</Badge> },
    { key: 'template', header: 'Template', sortValue: (r) => String(r.template ?? ''), render: (r) => <span className="text-sm text-mist">{String(r.template ?? '—')}</span> },
    { key: 'issueDate', header: 'Issue Date', sortValue: (r) => String(r.issueDate ?? ''), render: (r) => <span className="text-sm">{String(r.issueDate ?? '—')}</span> },
    { key: 'expiryDate', header: 'Expiry', sortValue: (r) => String(r.expiryDate ?? ''), render: (r) => <span className="text-sm text-mist">{String(r.expiryDate ?? '—')}</span> },
    { key: 'dataSource', header: 'Source', sortValue: (r) => String(r.dataSource ?? ''), render: (r) => {
      const src = String(r.dataSource ?? 'manual')
      const tone = src === 'Student' ? 'blue' : src === 'Employee' ? 'violet' : src === 'Member' ? 'teal' : 'zinc'
      const label = src === 'manual' ? 'Manual' : src
      return <Badge tone={tone as 'blue' | 'violet' | 'teal' | 'zinc'}>{label}</Badge>
    } },
    { key: 'status', header: 'Status', sortValue: (r) => String(r.status ?? ''), render: (r) => <Badge tone={statusTone(String(r.status))}>{String(r.status ?? '')}</Badge> },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-sm text-mist">{String(r.remarks ?? '—')}</span> },
    {
      key: 'actions', header: '', width: 140, render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={doPrint} title="Print Register"><Printer className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openEdit(r)} title="Edit"><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)} title="Delete"><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Certificate Register" desc="The master ledger of every certificate issued — who received it, for what, and when." printTitle="Certificate Register" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot edit the register.</p>}

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mist">Total Issued</p>
          <p className="mt-1 text-2xl font-extrabold">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mist">Issued</p>
          <p className="mt-1 text-2xl font-extrabold text-lime-700">{stats.byStatus['Issued'] ?? 0}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mist">Draft / Pending</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{(stats.byStatus['Draft'] ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-mist">Revoked / Expired</p>
          <p className="mt-1 text-2xl font-extrabold text-rose-700">{(stats.byStatus['Revoked'] ?? 0) + (stats.byStatus['Expired'] ?? 0)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search holder, no, type, template, status…" className="max-w-sm" />
        <div className="ml-auto flex gap-2">
          <Badge tone="zinc">{filtered.length} record{filtered.length === 1 ? '' : 's'}</Badge>
          <Button size="sm" onClick={openNew} disabled={!allowed}><Plus className="size-4" /> New Entry</Button>
        </div>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No certificates registered" emptyDesc="Register a certificate to start your ledger." />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Register Entry' : 'New Register Entry'} footer={<><Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" onClick={save} disabled={!allowed}>Save</Button></>}>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Holder Type *"><Select value={draft.holderType} onChange={(e) => setDraft({ ...draft, holderType: e.target.value })}>{CERT_HOLDERS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
            <Field label={`${CERT_HOLDER_NAME_LABELS[draft.holderType]?.label || 'Holder Name'} *`}><Input value={draft.holderName} onChange={(e) => setDraft({ ...draft, holderName: e.target.value })} placeholder={CERT_HOLDER_NAME_LABELS[draft.holderType]?.placeholder || 'Enter name'} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certificate Type *"><Select value={draft.certificateType} onChange={(e) => setDraft({ ...draft, certificateType: e.target.value })}><option value="">Choose type…</option>{typeNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label="Certificate Number *"><Input value={draft.certificateNo} onChange={(e) => setDraft({ ...draft, certificateNo: e.target.value })} placeholder="CERT-2026-0001" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Template"><Select value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })}><option value="">Choose template…</option>{templateNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issue Date *"><Input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} /></Field>
            <Field label="Expiry Date"><Input type="date" value={draft.expiryDate} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} /></Field>
          </div>
          <Field label="Remarks"><Input value={draft.remarks} onChange={(e) => setDraft({ ...draft, remarks: e.target.value })} placeholder="Optional notes" /></Field>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete entry?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String(confirmDelete?.certificateNo ?? '')}</b>? This cannot be undone.</p>
      </Modal>

      {createPortal(
        <div className="cert-register-print-root">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #111', paddingBottom: 6, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Certificate Register</p>
              <p style={{ margin: 0, fontSize: 11, color: '#444' }}>Master ledger of all certificates issued</p>
            </div>
            <p style={{ margin: 0, fontSize: 10, color: '#444' }}>Printed {new Date().toLocaleDateString()}</p>
          </div>
          {/* Summary line */}
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#444', marginBottom: 8 }}>
            <span>Total: <b>{stats.total}</b></span>
            <span>Issued: <b>{stats.byStatus['Issued'] ?? 0}</b></span>
            <span>Draft: <b>{stats.byStatus['Draft'] ?? 0}</b></span>
            <span>Revoked: <b>{stats.byStatus['Revoked'] ?? 0}</b></span>
            <span>Expired: <b>{stats.byStatus['Expired'] ?? 0}</b></span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '14%' }}>Certificate No</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '18%' }}>Holder</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '16%' }}>Type</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '14%' }}>Template</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '9%' }}>Issue Date</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '9%' }}>Expiry</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '8%' }}>Status</th>
                <th style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'left', width: '12%' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sortedRegisters.length === 0 ? (
                <tr><td colSpan={8} style={{ border: '1px solid #999', padding: '12px 6px', textAlign: 'center', color: '#666' }}>No certificates registered</td></tr>
              ) : sortedRegisters.map((r) => (
                <tr key={r.id}>
                  <td style={{ border: '1px solid #999', padding: '3px 5px', fontFamily: 'monospace', fontWeight: 600 }}>{String(r.certificateNo ?? '—')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px' }}>
                    <div style={{ fontWeight: 600 }}>{String(r.holderName ?? r.holder ?? '')}</div>
                    <div style={{ fontSize: 8, color: '#666' }}>{String(r.holderType ?? '')}</div>
                  </td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px' }}>{String(r.certificateType ?? '')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px', color: '#444' }}>{String(r.template ?? '—')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px' }}>{String(r.issueDate ?? '—')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px', color: '#444' }}>{String(r.expiryDate ?? '—')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px' }}>{String(r.status ?? '')}</td>
                  <td style={{ border: '1px solid #999', padding: '3px 5px', color: '#444' }}>{String(r.remarks ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 8, fontSize: 9, color: '#666' }}>Total records: {stats.total}</p>
        </div>,
        document.body,
      )}
    </div>
  )
}

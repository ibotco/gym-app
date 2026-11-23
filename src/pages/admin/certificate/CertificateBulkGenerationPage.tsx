import { useMemo, useState } from 'react'
import { Layers, Pencil, Plus, ShieldAlert, Trash2, Users, ScanLine, CheckCircle2 } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext, CERT_HOLDERS } from './CertificateShared'
import { uid } from '../../../lib/utils'
import {
  listStudentsByClass,
  createAuditEntry,
  type IntegratedHolder,
} from '../../../lib/certDataIntegration'
import type { EduRow } from '../../../lib/eduRecords'

const STATUSES = ['Pending', 'Generated', 'Issued'] as const

type Draft = { batchName: string; certificateType: string; template: string; holderType: string; className: string; groupName: string; totalStudents: string; issueDate: string; status: string }

export function CertificateBulkGenerationPage() {
  const { bulks, types, templates, can, patch, records, officer } = useCertificateContext()
  const toast = useToast()
  const allowed = can('bulkGenerate')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [draft, setDraft] = useState<Draft>({ batchName: '', certificateType: '', template: '', holderType: 'University', className: '', groupName: '', totalStudents: '', issueDate: new Date().toISOString().slice(0, 10), status: 'Pending' })
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)
  // Class-based student selection
  const [selectedClass, setSelectedClass] = useState('')
  const [classStudents, setClassStudents] = useState<IntegratedHolder[]>([])

  const typeNames = useMemo(() => types.map((r) => String(r.name ?? '')).filter(Boolean), [types])
  const templateNames = useMemo(() => templates.map((r) => String(r.templateName ?? '')).filter(Boolean), [templates])

  // Get available classes from student data
  const availableClasses = useMemo(() => {
    const students = (records.studentList ?? []) as EduRow[]
    const classes = new Map<string, number>()
    students.forEach((s) => {
      const cls = String(s.className ?? '')
      if (cls) classes.set(cls, (classes.get(cls) ?? 0) + 1)
    })
    return Array.from(classes.entries()).map(([name, count]) => ({ name, count }))
  }, [records])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bulks
    return bulks.filter((r) => [r.batchName, r.certificateType, r.holderType, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [bulks, query])

  const openNew = () => {
    setDraft({ batchName: '', certificateType: typeNames[0] ?? '', template: templateNames[0] ?? '', holderType: 'University', className: '', groupName: '', totalStudents: '', issueDate: new Date().toISOString().slice(0, 10), status: 'Pending' })
    setEditing({ id: '' } as EduRow)
    setSelectedClass('')
    setClassStudents([])
  }
  const openEdit = (row: EduRow) => {
    setDraft({
      batchName: String(row.batchName ?? ''),
      certificateType: String(row.certificateType ?? ''),
      template: String(row.template ?? ''),
      holderType: CERT_HOLDERS.includes(row.holderType as any) ? String(row.holderType) : 'Other Institution',
      className: String(row.className ?? ''),
      groupName: String(row.groupName ?? ''),
      totalStudents: String(row.totalStudents ?? ''),
      issueDate: String(row.issueDate ?? ''),
      status: String(row.status ?? 'Pending'),
    })
    setEditing(row)
    // Load students for this class if it has one
    const cls = String(row.batchClass ?? row.className ?? '')
    if (cls) {
      const students = listStudentsByClass(records, cls)
      setClassStudents(students)
      setSelectedClass(cls)
    }
  }

  const handleClassSelect = (className: string) => {
    setSelectedClass(className)
    if (className) {
      const students = listStudentsByClass(records, className)
      setClassStudents(students)
      setDraft((d) => ({
        ...d,
        holderType: 'Student',
        className,
        totalStudents: String(students.length),
      }))
    } else {
      setClassStudents([])
    }
  }

  const save = () => {
    if (!draft.batchName.trim()) { toast.error('Batch name required', 'Give this batch a name.'); return }
    if (!draft.certificateType.trim()) { toast.error('Type required', 'Pick a certificate type.'); return }
    const row: EduRow = {
      id: editing?.id || uid('certbulk'),
      batchName: draft.batchName.trim(),
      certificateType: draft.certificateType,
      template: draft.template,
      holderType: draft.holderType,
      className: draft.className.trim(),
      groupName: draft.groupName.trim(),
      totalStudents: draft.totalStudents.trim() || String(classStudents.length || 0),
      issueDate: draft.issueDate,
      status: draft.status,
      ...(selectedClass ? { batchClass: selectedClass, studentIds: classStudents.map((s) => s.id).join(',') } : {}),
    }
    const next = editing?.id ? bulks.map((r) => r.id === editing.id ? row : r) : [...bulks, row]
    patch({ certificateBulkGeneration: next as EduRow[] })
    toast.success(editing?.id ? 'Batch updated' : 'Batch created', draft.batchName)
    setEditing(null)
    setSelectedClass('')
    setClassStudents([])
  }

  const generate = (row: EduRow) => {
    const next = bulks.map((r) => r.id === row.id ? { ...r, status: 'Generated' } : r) as EduRow[]
    patch({ certificateBulkGeneration: next })
    toast.success('Batch generated', String(row.batchName ?? 'Batch'))
    // Generate individual certificates for all students in the class
    const batchClass = String((row as Record<string, unknown>).batchClass ?? row.className ?? '')
    if (batchClass) {
      const students = listStudentsByClass(records, batchClass)
      const prefix = (types.find((t) => String(t.name) === String(row.certificateType))?.serialPrefix as string | undefined) ?? 'CERT-'
      const existingGens = (records.certificateGeneration ?? []) as EduRow[]
      const newCerts: EduRow[] = students.map((student, i) => {
        const seq = existingGens.length + i + 1
        const autoNo = `${(prefix || 'CERT-').trim()}${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
        return {
          id: uid('certgen'),
          certificateNo: autoNo,
          holderType: 'Student',
          holderName: student.name,
          holder: student.name,
          certificateType: String(row.certificateType),
          template: String(row.template ?? ''),
          issueDate: String(row.issueDate ?? new Date().toISOString().slice(0, 10)),
          expiryDate: '',
          status: 'Issued',
          remarks: `Bulk: ${row.batchName}`,
          dataSource: 'Student',
          recordId: student.id,
          recordReference: student.reference,
        }
      })
      const allGenerations = [...existingGens, ...newCerts]
      patch({ certificateGeneration: allGenerations as EduRow[], certificateRegister: allGenerations as EduRow[] })
      // Audit trail
      const auditEntry = createAuditEntry(String(row.batchName), 'generated', officer, 'Student', { details: `Bulk: ${students.length} certificates` })
      patch({ certificateAudit: [...((records as Record<string, unknown>).certificateAudit ?? []) as EduRow[], auditEntry as unknown as EduRow] as EduRow[] })
      toast.success(`${students.length} certificates generated`, `From class ${batchClass}`)
    }
  }

  const remove = () => {
    if (!confirmDelete) return
    patch({ certificateBulkGeneration: bulks.filter((r) => r.id !== confirmDelete.id) as EduRow[] })
    toast.success('Deleted', String(confirmDelete.batchName ?? 'Batch'))
    setConfirmDelete(null)
  }

  const columns: Column<EduRow>[] = [
    { key: 'batchName', header: 'Batch', render: (r) => <div><p className="font-semibold">{String(r.batchName ?? '')}</p><p className="text-[11px] text-mist">{String(r.holderType ?? '')} · {String(r.totalStudents ?? '—')} holders</p></div> },
    { key: 'certificateType', header: 'Type', render: (r) => <Badge tone="zinc">{String(r.certificateType ?? '')}</Badge> },
    { key: 'template', header: 'Template', render: (r) => <span className="text-sm text-mist">{String(r.template ?? '—')}</span> },
    { key: 'className', header: 'Class / Group', render: (r) => <span className="text-sm">{String(r.className ?? r.groupName ?? '—')}</span> },
    { key: 'issueDate', header: 'Issue Date', render: (r) => <span className="text-sm">{String(r.issueDate ?? '—')}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={String(r.status).toLowerCase() === 'issued' ? 'lime' : String(r.status).toLowerCase() === 'generated' ? 'lime' : 'amber'}>{String(r.status ?? '')}</Badge> },
    {
      key: 'actions', header: '', width: 180, render: (r) => (
        <div className="flex justify-end gap-1">
          {String(r.status) !== 'Generated' && String(r.status) !== 'Issued' && <Button size="sm" variant="outline" disabled={!allowed} onClick={() => generate(r)}><Layers className="size-3.5" /> Generate</Button>}
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openEdit(r)}><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)}><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Bulk Generation" desc="Generate certificates in bulk — by class, department or a custom group — then issue them together. Select a class to auto-populate all students from the database." printTitle="Certificate Bulk Generation" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot bulk generate.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search batches…" className="max-w-xs" />
        <div className="ml-auto flex gap-2">
          <Badge tone="zinc">{filtered.length} batch{filtered.length === 1 ? '' : 'es'}</Badge>
          <Button size="sm" onClick={openNew} disabled={!allowed}><Plus className="size-4" /> New Batch</Button>
        </div>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No batches yet" emptyDesc="Create a batch to generate certificates for many holders at once." />

      <Modal open={!!editing} onClose={() => { setEditing(null); setSelectedClass(''); setClassStudents([]) }} title={editing?.id ? 'Edit Batch' : 'New Batch'} footer={<><Button variant="outline" size="sm" onClick={() => { setEditing(null); setSelectedClass(''); setClassStudents([]) }}>Cancel</Button><Button size="sm" onClick={save} disabled={!allowed}>Save Batch</Button></>}>
        <div className="grid gap-4">
          {/* Class-based student selection */}
          {availableClasses.length > 0 && (
            <div className="rounded-xl border border-line bg-blue-50/40 p-4 dark:bg-blue-50/10">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300"><ScanLine className="size-4" /> Auto-Select Class from Student Database</h4>
              <div className="flex gap-2">
                <Select value={selectedClass} onChange={(e) => handleClassSelect(e.target.value)} className="flex-1">
                  <option value="">— Select a class —</option>
                  {availableClasses.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count} students)</option>)}
                </Select>
              </div>
              {selectedClass && classStudents.length > 0 && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">{classStudents.length} students found in {selectedClass}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {classStudents.slice(0, 15).map((s) => (
                      <span key={s.id} className="rounded bg-green-100 px-2 py-0.5 text-[10px] text-green-700 dark:bg-green-500/10 dark:text-green-300">
                        {s.name} · {s.reference}
                      </span>
                    ))}
                    {classStudents.length > 15 && <span className="text-xs text-mist">+{classStudents.length - 15} more…</span>}
                  </div>
                  <p className="mt-2 text-xs text-mist">Certificates will be auto-generated for all students when you click Generate.</p>
                </div>
              )}
            </div>
          )}
          <Field label="Batch Name *"><Input value={draft.batchName} onChange={(e) => setDraft({ ...draft, batchName: e.target.value })} placeholder="e.g. Graduation 2026 — Basic 7" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certificate Type *"><Select value={draft.certificateType} onChange={(e) => setDraft({ ...draft, certificateType: e.target.value })}><option value="">Choose type…</option>{typeNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
            <Field label="Template *"><Select value={draft.template} onChange={(e) => setDraft({ ...draft, template: e.target.value })}><option value="">Choose template…</option>{templateNames.map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Holder Type *"><Select value={draft.holderType} onChange={(e) => setDraft({ ...draft, holderType: e.target.value })}>{CERT_HOLDERS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
            <Field label="Total Holders"><Input type="number" value={draft.totalStudents} onChange={(e) => setDraft({ ...draft, totalStudents: e.target.value })} placeholder="e.g. 34" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Class"><Input value={draft.className} onChange={(e) => setDraft({ ...draft, className: e.target.value })} placeholder="e.g. Basic 7 A" /></Field>
            <Field label="Group / Department"><Input value={draft.groupName} onChange={(e) => setDraft({ ...draft, groupName: e.target.value })} placeholder="e.g. Science Dept" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issue Date"><Input type="date" value={draft.issueDate} onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })} /></Field>
            <Field label="Status"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete batch?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String(confirmDelete?.batchName ?? '')}</b>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

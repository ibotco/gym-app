import { useMemo, useState } from 'react'
import { Brush, Copy, FileImage, Layers, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Badge, Button, Modal, PageHeader, SearchInput } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext } from './CertificateShared'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'
import { CertificateBuilderModal, CertificateTemplateForm } from './CertificateBuilder'
import { useApp } from '../../../context/AppContext'

export function CertificateTemplatesPage() {
  const { templates, types, can, patch } = useCertificateContext()
  const { activeBranchId, branches, company } = useApp() as any
  const branch = branches?.find((b: any) => b.id === activeBranchId)
  const branchName: string = branch?.name ?? 'Main Branch'
  const companyName: string = company?.name ?? 'FitPro'
  const toast = useToast()
  const allowed = can('configure')
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<EduRow | null>(null)
  const [preview, setPreview] = useState<EduRow | null>(null)

  // Builder states — modal + full-page form (full fidelity from EduModulePage1)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderInitial, setBuilderInitial] = useState<any>(null)
  const [formActive, setFormActive] = useState(false)
  const [formInitial, setFormInitial] = useState<any>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((r) => [r.templateName, r.certificateType, r.holderType, r.pageLayout].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [templates, query])

  const collapseSidebar = () => window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: true } }))
  const expandSidebar = () => window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed: false } }))

  const saveBuilder = (row: any) => {
    const existingId = builderInitial?.id || formInitial?.id
    const existsInList = existingId && templates.some((r) => String(r.id) === String(existingId))
    const next = existsInList
      ? templates.map((r) => (String(r.id) === String(row.id) ? (row as EduRow) : r))
      : [...templates, row as EduRow]
    patch({ certificateTemplates: next as EduRow[] })
    toast.success(existsInList ? 'Template updated' : 'Template created', row.templateName)
    setBuilderOpen(false)
    setBuilderInitial(null)
    setFormActive(false)
    setFormInitial(null)
    expandSidebar()
  }

  const openBuilderNew = () => {
    setBuilderInitial(null)
    setFormInitial(null)
    setBuilderOpen(true)
  }
  const openBuilderEdit = (row: EduRow) => {
    setBuilderInitial(row)
    setBuilderOpen(true)
  }
  const openFormNew = () => {
    collapseSidebar()
    setFormInitial(null)
    setFormActive(true)
  }
  const openFormEdit = (row: EduRow) => {
    collapseSidebar()
    setFormInitial(row)
    setFormActive(true)
  }

  const remove = () => {
    if (!confirmDelete) return
    patch({ certificateTemplates: templates.filter((r) => r.id !== confirmDelete.id) as EduRow[] })
    toast.success('Deleted', String(confirmDelete.templateName ?? 'Template'))
    setConfirmDelete(null)
  }

  const columns: Column<EduRow>[] = [
    { key: 'templateName', header: 'Template', render: (r) => <div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg bg-amber-500/15"><FileImage className="size-4 text-amber-700" /></div><span className="font-semibold">{String(r.templateName ?? r.name ?? '')}</span></div> },
    { key: 'certificateType', header: 'Type', render: (r) => <Badge tone="zinc">{String(r.certificateType ?? '')}</Badge> },
    { key: 'holderType', header: 'Holder', render: (r) => <span className="text-sm">{String(r.holderType ?? '')}</span> },
    { key: 'paperSize', header: 'Paper', render: (r) => <span className="text-sm">{String(r.paperSize ?? '')} · {String(r.pageLayout ?? r.orientation ?? '')}</span> },
    { key: 'borderStyle', header: 'Border', render: (r) => <span className="text-sm text-mist">{String(r.borderStyle ?? '—')}</span> },
    {
      key: 'actions', header: '', width: 180, render: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => setPreview(r)} title="Preview"><Brush className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => { try { const copy = { ...r, id: uid('certtpl'), templateName: String((r as any).templateName ?? '') + ' Copy' }; console.log('[DUPLICATE] clicked, copy data:', { id: copy.id, name: copy.templateName, hasCertData: !!(copy as any).certificateData, certDataLength: (copy as any).certificateData?.length }); setBuilderInitial(copy); setBuilderOpen(true) } catch (e) { console.error('Duplicate error:', e); alert('Error duplicating template: ' + (e as Error).message) } }} title="Duplicate"><Copy className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => openBuilderEdit(r)} title="Edit (Builder)"><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirmDelete(r)}><Trash2 className="size-3.5 text-rose" /></Button>
        </div>
      ),
    },
  ]

  const handleFormBack = () => {
    expandSidebar()
    setFormActive(false)
    setFormInitial(null)
  }

  // Full-page builder takes over the page (like original certificateTemplates leaf did)
  if (formActive) {
    return (
      <CertificateTemplateForm
        initial={formInitial}
        onSave={saveBuilder}
        onBack={handleFormBack}
        branchName={branchName}
        branchId={activeBranchId}
        companyName={companyName}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Certificate Management" title="Certificate Templates" desc="Design the certificate — layout, paper, borders, background and the dynamic fields that will be printed." printTitle="Certificate Templates"
        actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={openFormNew} disabled={!allowed}><Layers className="size-4" /> Builder Page</Button><Button size="sm" onClick={openBuilderNew} disabled={!allowed}><Plus className="size-4" /> New Template</Button></div>}
      />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot edit templates.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search templates…" className="max-w-xs" />
        <Badge tone="zinc" className="ml-auto">{filtered.length} template{filtered.length === 1 ? '' : 's'}</Badge>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No templates yet" emptyDesc="Create a template to start issuing certificates." />

      {/* Modal builder (popup) */}
      <CertificateBuilderModal
        open={builderOpen}
        onClose={() => { setBuilderOpen(false); setBuilderInitial(null) }}
        initial={builderInitial}
        onSave={saveBuilder}
        branchName={branchName}
        branchId={activeBranchId}
        companyName={companyName}
      />

      {/* Quick preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Preview — ${String(preview?.templateName ?? preview?.name ?? '')}`} size="7xl" footer={<Button size="sm" variant="outline" onClick={() => setPreview(null)}>Close</Button>}>
        {preview && (
          <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 shadow-2xl ring-1 ring-white/10 sm:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `linear-gradient(45deg,#fff 25%,transparent 25%),linear-gradient(-45deg,#fff 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#fff 75%),linear-gradient(-45deg,transparent 75%,#fff 75%)`, backgroundSize: '20px 20px', backgroundPosition: '0 0,0 10px,10px -10px,-10px 0' }} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/[0.06]" />
            <div className="relative mx-auto max-w-3xl">
              <div className="mb-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-900 shadow">● Live Preview</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 ring-1 ring-white/15 backdrop-blur">A4 • {String((preview as any).certificateType ?? 'Achievement')}</span>
              </div>
              <div className="relative overflow-hidden rounded-2xl border bg-white p-10 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.15)] dark:bg-zinc-900" style={{ backgroundColor: String((preview as any).backgroundColor ?? (preview as any).bgColor ?? '#FFFDF0'), backgroundImage: (preview as any).backgroundImage || (preview as any).bgImage ? `url(${(preview as any).backgroundImage || (preview as any).bgImage})` : undefined, backgroundSize: 'cover', borderStyle: String((preview as any).borderStyle ?? '').toLowerCase().includes('dashed') ? 'dashed' : String((preview as any).borderStyle ?? '').toLowerCase().includes('dotted') ? 'dotted' : 'solid', borderWidth: String((preview as any).borderStyle ?? 'None') === 'None' ? 0 : 6, borderColor: '#d4a017' }}>
                {(() => { const pat = String((preview as any).bgPattern ?? (preview as any).pattern ?? 'none'); if (pat === 'none' || !pat) return null; const map: Record<string, React.CSSProperties> = {
                  dots: {backgroundImage:`radial-gradient(circle, rgba(0,0,0,0.14) 1.6px, transparent 1.6px)`, backgroundSize:'18px 18px'},
                  lines: {backgroundImage:`repeating-linear-gradient(0deg, transparent 0 10px, rgba(0,0,0,0.08) 10px 11px)`},
                  grid: {backgroundImage:`linear-gradient(to right, rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.07) 1px, transparent 1px)`, backgroundSize:'22px 22px'},
                  waves: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='20' viewBox='0 0 80 20'%3E%3Cpath d='M0 10 Q20 0 40 10 T80 10' fill='none' stroke='rgba(0,0,0,0.10)' stroke-width='1.4'/%3E%3C/svg%3E")`, backgroundSize:'80px 20px'},
                  chevron: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 20 L20 0 L40 20' fill='none' stroke='rgba(0,0,0,0.09)' stroke-width='1.2'/%3E%3C/svg%3E")`, backgroundSize:'40px 20px'},
                  stripes: {backgroundImage:`repeating-linear-gradient(45deg, transparent 0 12px, rgba(180,150,30,0.10) 12px 24px)`},
                  crosshatch: {backgroundImage:`repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px), repeating-linear-gradient(-45deg, transparent 0 14px, rgba(0,0,0,0.06) 14px 15px)`},
                  confetti: {backgroundImage:`radial-gradient(circle at 10% 20%, rgba(120,180,200,0.18) 2px, transparent 2.5px), radial-gradient(circle at 70% 60%, rgba(230,180,60,0.18) 2px, transparent 2.5px), radial-gradient(circle at 40% 80%, rgba(180,120,200,0.15) 1.8px, transparent 2.3px)`, backgroundSize:'60px 60px'},
                  damask: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='rgba(0,0,0,0.07)' stroke-width='1'%3E%3Cpath d='M30 5 C32 12 38 12 30 20 C22 12 28 12 30 5'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize:'60px 60px'},
                  stars: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Cpath d='M18 4 L19.5 11 H27 L21 15.5 L23 23 L18 18.5 L13 23 L15 15.5 L9 11 H16.5 Z' fill='rgba(0,0,0,0.09)'/%3E%3C/svg%3E")`, backgroundSize:'36px 36px'},
                  marble: {backgroundImage:`linear-gradient(115deg, transparent 0%, rgba(0,0,0,0.04) 15%, transparent 30%), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.06) 0%, transparent 50%)`},
                  honeycomb: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='30' viewBox='0 0 34 30'%3E%3Cpath d='M17 2 L26 7.5 L26 18.5 L17 24 L8 18.5 L8 7.5 Z' fill='none' stroke='rgba(0,0,0,0.08)' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize:'34px 30px'},
                  herringbone: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30' viewBox='0 0 60 30'%3E%3Cpath d='M0 15 L15 0 L30 15 L15 30 Z M30 15 L45 0 L60 15 L45 30 Z' fill='none' stroke='rgba(0,0,0,0.07)'/%3E%3C/svg%3E")`, backgroundSize:'60px 30px'},
                  paisley: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Cpath d='M25 8 C32 8 35 18 25 30 C20 22 14 18 25 8' fill='none' stroke='rgba(0,0,0,0.07)'/%3E%3C/svg%3E")`, backgroundSize:'50px 50px'},
                  floral: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cg fill='rgba(0,0,0,0.06)'%3E%3Ccircle cx='24' cy='24' r='1.8'/%3E%3Ccircle cx='24' cy='14' r='3'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize:'48px 48px'},
                  geometric: {backgroundImage:`linear-gradient(30deg, rgba(0,0,0,0.06) 12%, transparent 12.5%)`, backgroundSize:'28px 50px'},
                  mosaic: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='1' y='1' width='10' height='10' fill='none' stroke='rgba(0,0,0,0.06)' rx='1'/%3E%3C/svg%3E")`, backgroundSize:'24px 24px'},
                  linen: {backgroundImage:`repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0 1px, transparent 1px 4px)`},
                  parchment: {backgroundImage:`radial-gradient(ellipse at 20% 30%, rgba(180,160,120,0.10) 0%, transparent 50%)`},
                  bubbles: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='10' cy='12' r='5' fill='none' stroke='rgba(0,0,0,0.05)'/%3E%3C/svg%3E")`, backgroundSize:'40px 40px'},
                  diagonal: {backgroundImage:`repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 10px)`},
                  zigzag: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'%3E%3Cpath d='M0 10 L10 0 L20 10 L30 0 L40 10' fill='none' stroke='rgba(0,0,0,0.08)'/%3E%3C/svg%3E")`, backgroundSize:'40px 20px'},
                  circles: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'%3E%3Ccircle cx='15' cy='15' r='8' fill='none' stroke='rgba(0,0,0,0.06)'/%3E%3C/svg%3E")`, backgroundSize:'30px 30px'},
                  hexagons: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='32' viewBox='0 0 28 32'%3E%3Cpath d='M14 2 L24 8 L24 20 L14 26 L4 20 L4 8 Z' fill='none' stroke='rgba(0,0,0,0.07)'/%3E%3C/svg%3E")`, backgroundSize:'28px 32px'},
                  noise: {backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'%3E%3Crect width='50' height='50' opacity='0.04'/%3E%3C/svg%3E")`, backgroundSize:'50px 50px'},
                  'vintage-paper': {backgroundImage:`linear-gradient(180deg, rgba(139,115,85,0.06) 0%, transparent 50%)`},
                }; const sty = (map as any)[pat]; return sty ? <div className="pointer-events-none absolute inset-0 rounded-2xl" style={sty as any} /> : null; })()}
            <div className="mx-auto max-w-2xl text-center" style={{ fontFamily: 'Sora, serif' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Certificate of {String((preview as any).certificateType ?? 'Achievement')}</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 drop-shadow-sm">{String((preview as any).templateName ?? (preview as any).name ?? '')}</h2>
              <div className="mx-auto mt-6 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">{String((preview as any).certificateData ? (() => { try { const d = JSON.parse(String((preview as any).certificateData)); return (d.elements || []).map((e: any) => e.content).join('\n') } catch { return String((preview as any).certificateData) } })() : '').replaceAll('{holderName}', 'Alex Johnson').replaceAll('{certificateType}', String((preview as any).certificateType ?? 'Achievement')).replaceAll('{issueDate}', new Date().toLocaleDateString()).replaceAll('{certificateNo}', 'CERT-2026-0001').replaceAll('{branch}', branchName)}</div>
              <div className="mt-10 flex items-center justify-between border-t-2 border-amber-500/20 pt-5 text-xs">
                    <div className="text-left"><p className="font-bold text-zinc-900">Director</p><p className="text-[11px] uppercase tracking-wide text-zinc-500">Authorised signature</p></div>
                    <div className="h-10 w-px bg-amber-500/20" />
                    <div className="text-right"><p className="font-mono text-sm font-bold tracking-widest text-zinc-900">CERT-2026-0001</p><p className="text-[11px] text-zinc-500">{new Date().toLocaleDateString()}</p></div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-center text-xs font-medium text-white/60">This is exactly how it will print — background, border and fields are live.</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete template?" footer={<><Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button size="sm" tone="danger" onClick={remove}>Delete</Button></>}>
        <p className="text-sm">Delete <b>{String((confirmDelete as any)?.templateName ?? (confirmDelete as any)?.name ?? '')}</b>? This cannot be undone.</p>
      </Modal>
    </div>
  )
}

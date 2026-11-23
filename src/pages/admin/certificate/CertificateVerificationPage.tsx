import { useMemo, useState } from 'react'
import { BadgeCheck, Search, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { Badge, Button, Field, Input, PageHeader, SearchInput, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useToast } from '../../../context/ToastContext'
import { useCertificateContext } from './CertificateShared'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'

export function CertificateVerificationPage() {
  const { generations, can, patch, verifications } = useCertificateContext()
  const toast = useToast()
  const allowed = can('verify')
  const [query, setQuery] = useState('')
  const [searchNo, setSearchNo] = useState('')
  const [result, setResult] = useState<EduRow | null>(null)
  const [status, setStatus] = useState<'Valid' | 'Invalid' | 'Revoked' | 'Expired'>('Valid')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return verifications
    return verifications.filter((r) => [r.certificateNo, r.holderName, r.certificateType, r.status].some((v) => String(v ?? '').toLowerCase().includes(q)))
  }, [verifications, query])

  const verify = () => {
    const key = searchNo.trim().toLowerCase()
    if (!key) { toast.error('Enter a certificate number', 'Type the number to verify.'); return }
    const found = generations.find((r) => String(r.certificateNo ?? '').trim().toLowerCase() === key)
    if (!found) {
      setResult(null)
      toast.error('Not found', `No certificate matches ${searchNo.trim()}.`)
      // Log failed verification
      const row: EduRow = { id: uid('certver'), certificateNo: searchNo.trim(), holderName: '—', holderType: '—', certificateType: '—', issueDate: '', verifiedBy: 'System', verificationDate: new Date().toISOString().slice(0, 10), status: 'Invalid' }
      patch({ certificateVerification: [...verifications, row] as EduRow[] })
      return
    }
    setResult(found as EduRow)
    setStatus(String(found.status ?? '').toLowerCase() === 'revoked' ? 'Revoked' : String(found.status ?? '').toLowerCase() === 'issued' ? 'Valid' : 'Valid')
    const row: EduRow = {
      id: uid('certver'),
      certificateNo: String(found.certificateNo ?? ''),
      holderName: String(found.holderName ?? found.holder ?? ''),
      holderType: String(found.holderType ?? ''),
      certificateType: String(found.certificateType ?? ''),
      issueDate: String(found.issueDate ?? ''),
      verifiedBy: 'System',
      verificationDate: new Date().toISOString().slice(0, 10),
      status: String((found as Record<string, unknown>).status ?? 'Valid'),
    }
    patch({ certificateVerification: [...verifications, row] as EduRow[] })
    toast.success('Verified', `${String(found.certificateNo)} is ${String(found.status ?? 'Issued')}.`)
  }

  const columns: Column<EduRow>[] = [
    { key: 'certificateNo', header: 'Certificate No', render: (r) => <span className="font-mono text-xs font-semibold">{String(r.certificateNo ?? '—')}</span> },
    { key: 'holderName', header: 'Holder', render: (r) => <div><p className="font-medium">{String(r.holderName ?? '—')}</p><p className="text-[11px] text-mist">{String(r.holderType ?? '')}</p></div> },
    { key: 'certificateType', header: 'Type', render: (r) => <span className="text-sm">{String(r.certificateType ?? '—')}</span> },
    { key: 'verificationDate', header: 'Verified', render: (r) => <span className="text-sm">{String(r.verificationDate ?? '—')}</span> },
    { key: 'status', header: 'Result', render: (r) => <Badge tone={String(r.status).toLowerCase() === 'valid' ? 'lime' : String(r.status).toLowerCase() === 'invalid' ? 'rose' : 'amber'}>{String(r.status ?? '')}</Badge> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Certificate Management" title="Certificate Verification" desc="Verify a certificate by its number — confirm holder, type and whether it is still valid." printTitle="Certificate Verification" />
      {!allowed && <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"><ShieldAlert className="size-4" /> Your role cannot verify certificates.</p>}

      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm dark:bg-white/5">
        <h3 className="text-sm font-semibold">Verify a certificate</h3>
        <p className="text-xs text-mist">Enter the certificate number exactly as printed — including prefix and year.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Input value={searchNo} onChange={(e) => setSearchNo(e.target.value)} placeholder="e.g. CERT-2026-0001" className="max-w-sm" onKeyDown={(e) => e.key === 'Enter' && verify()} />
          <Button size="sm" onClick={verify} disabled={!allowed}><Search className="size-4" /> Verify</Button>
          {result && (
            <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs dark:border-white/10">
              {String(status).toLowerCase() === 'valid' ? <ShieldCheck className="size-4 text-lime-600" /> : <XCircle className="size-4 text-rose-600" />}
              <span className="font-semibold">{String(status)}</span>
              <span className="text-mist">· {String(result.certificateNo ?? '')}</span>
            </div>
          )}
        </div>
        {result && (
          <div className="mt-4 grid gap-3 rounded-xl bg-lime/10 p-4 dark:bg-lime/5">
            <div className="flex items-center gap-2 text-sm font-semibold text-lime-800 dark:text-lime-300"><BadgeCheck className="size-4" /> Certificate found</div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-mist">Holder:</span> <b>{String(result.holderName ?? result.holder ?? '')}</b> ({String(result.holderType ?? '')})</p>
              <p><span className="text-mist">Type:</span> <b>{String(result.certificateType ?? '')}</b></p>
              <p><span className="text-mist">Number:</span> <span className="font-mono">{String(result.certificateNo ?? '')}</span></p>
              <p><span className="text-mist">Issued:</span> {String(result.issueDate ?? '—')}</p>
              <p><span className="text-mist">Template:</span> {String(result.template ?? '—')}</p>
              <p><span className="text-mist">Status:</span> <Badge tone={String(result.status).toLowerCase() === 'issued' ? 'lime' : 'rose'}>{String(result.status ?? '')}</Badge></p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold">Verification history</h3>
        <SearchInput value={query} onChange={setQuery} placeholder="Search history…" className="max-w-xs" />
        <Badge tone="zinc" className="ml-auto">{filtered.length} checks</Badge>
      </div>
      <DataTable<EduRow> data={filtered as EduRow[]} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No verifications yet — verify a certificate above to see it here." />
    </div>
  )
}

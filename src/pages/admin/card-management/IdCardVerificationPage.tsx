/**
 * Search & Verification — look a card up by reference number, holder name,
 * card number or detail, or verify it by scanning / pasting the QR code.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/library'
import {
  Camera, CameraOff, History as HistoryIcon, IdCard as IdCardIcon, Printer, QrCode, ScanLine, Search, ShieldAlert,
} from 'lucide-react'
import { IdCardFace, IdCardPrintSheet } from '../../../components/IdCardSheet'
import { Badge, Button, Field, Input, Modal, PageHeader, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import {
  ID_CARD_STATUSES, idCardClassNames, idCardQrPayload, parseScannedCard, printHistoryForCard, searchIdCards,
  verifyIdCard, type IdCard, type CardHolder,
} from '../../../lib/eduIdCards'
import { CardHolderFilter, useIdCardContext } from './IdCardShared'

type ScanState = 'idle' | 'starting' | 'scanning' | 'denied'

export function IdCardVerificationPage() {
  const {
    records, templates, cards, holders, school, officer, can, patch,
    holderType, setHolderType, availableHolderTypes, holderLabels,
  } = useIdCardContext()
  const toast = useToast()
  const allowed = can('verify')

  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [scanValue, setScanValue] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [printCard, setPrintCard] = useState<IdCard | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const readerRef = useRef<BrowserQRCodeReader | null>(null)

  const classes = useMemo(
    () => [...new Set(cards.map((card) => card.className).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cards],
  )

  const results = useMemo(() => {
    const found = searchIdCards(records, { query, className: classFilter, status: statusFilter, academicYear: '' })
    return holderType === 'All' ? found : found.filter((card) => card.holderType === holderType)
  }, [records, query, classFilter, statusFilter, holderType])

  const selected = cards.find((card) => card.id === selectedId)
  const verification = useMemo(
    () => (selected ? verifyIdCard(records, selected.cardNo) : undefined),
    [records, selected],
  )
  const holder: CardHolder | undefined = holders.find(
    (item) => item.name.toLowerCase() === selected?.holder.toLowerCase(),
  )
  const template = templates.find((item) => item.id === selected?.templateId) ?? templates[0]
  const prints = selected ? printHistoryForCard(records, selected.cardNo) : []

  /** Scanning always counts as a verification event in the audit log. */
  const logVerification = (card: IdCard) => {
    const entry = {
      id: `idch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString().slice(0, 10),
      time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
      cardNo: card.cardNo,
      student: card.holder || card.student,
      action: 'Verified',
      fromStatus: card.status,
      toStatus: card.status,
      officer,
      reason: 'Verification lookup',
    }
    patch({ idCardHistory: [...(records.idCardHistory ?? []), entry] })
  }

  const handleScannedValue = (raw: string) => {
    const result = verifyIdCard(records, raw)
    if (!result.found || !result.card) {
      toast.error('Not recognised', `No ID card matches “${parseScannedCard(raw) || raw}”.`)
      return
    }
    setSelectedId(result.card.id)
    setQuery('')
    setScanValue(raw)
    logVerification(result.card)
    toast.success('Card verified', `${result.card.cardNo} · ${result.card.holder || result.card.student}`)
  }

  /* ------------------------------------------------------- camera scanning */
  const stopScan = () => {
    try { readerRef.current?.reset() } catch { /* already stopped */ }
    readerRef.current = null
    setScanState('idle')
  }

  const startScan = async () => {
    if (!allowed) return
    setScanState('starting')
    try {
      const reader = new BrowserQRCodeReader()
      readerRef.current = reader
      // Unhide the video first so the element is visible while decoding.
      setScanState('scanning')
      await new Promise((resolve) => window.setTimeout(resolve, 60))
      await reader.decodeFromVideoDevice(null, videoRef.current, (result) => {
        if (!result) return
        const payload = result.getText()
        stopScan()
        setScanValue(payload)
        handleScannedValue(payload)
      })
    } catch (error) {
      setScanState('denied')
      toast.error(
        'Camera unavailable',
        String((error as Error)?.message ?? error).slice(0, 160) || 'Allow camera access, or type / scan the code into the field below.',
      )
    }
  }

  useEffect(() => () => { try { readerRef.current?.reset() } catch { /* noop */ } }, [])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Card Management"
        title="Search & Verify ID Cards"
        desc="Find a card by reference number, holder name, card number or detail — or scan its QR code to verify it and see who it belongs to."
        printTitle="ID Card Verification"
      />

      {!allowed && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-4" /> Your role cannot search or verify ID cards. Ask an administrator for the “Search & verify” permission.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_1fr]">
        {/* Scan + search */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4 text-lime" /> Verify by QR code</h2>
            <video
              ref={videoRef}
              className={`mb-2 w-full rounded-xl bg-black transition-all ${scanState === 'scanning' ? 'h-48 opacity-100' : 'h-0 opacity-0'}`}
              muted
              playsInline
            />
            <div className="flex flex-wrap gap-2">
              {scanState === 'scanning'
                ? <Button size="sm" variant="outline" onClick={stopScan}><CameraOff className="size-4" /> Stop camera</Button>
                : <Button size="sm" onClick={() => void startScan()} disabled={!allowed}><Camera className="size-4" /> Scan with camera</Button>}
            </div>
            {scanState === 'denied' && (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                Camera access was blocked. A handheld scanner also works — click the field below and scan.
              </p>
            )}
            <form
              className="mt-3"
              onSubmit={(event) => { event.preventDefault(); if (allowed) handleScannedValue(scanValue) }}
            >
              <Field label="Card number or scanned code" hint="Handheld scanners type straight into this field">
                <Input
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  placeholder="IDC-2026-0001"
                  className="font-mono"
                  autoFocus
                />
              </Field>
              <Button size="sm" className="mt-2" type="submit" disabled={!allowed || !scanValue.trim()}>
                <ScanLine className="size-4" /> Verify
              </Button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Search className="size-4 text-lime" /> Search cards</h2>
            <div className="space-y-3">
              <Field label="Admission No / Student / Card No">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. ADM-001, Ama, IDC-2026-0001" />
              </Field>
              <Field label="Class">
                <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                  <option value="">All classes</option>
                  {classes.map((item) => (<option key={item} value={item}>{item}</option>))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {ID_CARD_STATUSES.map((status) => (<option key={status} value={status}>{status}</option>))}
                </Select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-mist">{results.length} match{results.length === 1 ? '' : 'es'}</p>
            <ul className="mt-2 max-h-72 space-y-1 overflow-auto">
              {results.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border px-2.5 py-2 text-left ${card.id === selectedId ? 'border-lime bg-lime/5' : 'border-line dark:border-white/10'}`}
                    onClick={() => { setSelectedId(card.id); if (allowed) logVerification(card) }}
                  >
                    <p className="truncate text-sm font-semibold">{card.holder || card.student}</p>
                    <p className="font-mono text-[11px] text-mist">{card.cardNo} · {card.className || '—'}</p>
                  </button>
                </li>
              ))}
              {!results.length && <li className="text-sm text-mist">No cards match this search.</li>}
            </ul>
          </section>
        </div>

        {/* Verification result */}
        <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
          {!selected && (
            <p className="flex items-center gap-2 py-10 text-center text-sm text-mist">
              <IdCardIcon className="size-4" /> Scan a code or pick a card to see its details, validity and print history.
            </p>
          )}

          {selected && template && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">{selected.holder || selected.student}</h2>
                  <p className="font-mono text-xs text-mist">{selected.cardNo}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {verification?.expired
                    ? <Badge tone="rose">Expired {selected.expiryDate}</Badge>
                    : <Badge tone={selected.status === 'Active' || selected.status === 'Issued' ? 'lime' : 'amber'}>{selected.status}</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setPrintCard(selected)}><Printer className="size-4" /> Print</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 overflow-auto">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Front</p>
                  <IdCardFace template={template} card={selected} side="front" school={school} />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Back</p>
                  <IdCardFace template={template} card={selected} side="back" school={school} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Admission No', selected.admissionNo],
                  ['Class', selected.className],
                  ['Section / Stream', selected.section],
                  ['House', selected.house],
                  ['Gender', selected.gender],
                  ['Date of birth', selected.dateOfBirth],
                  ['Academic year', selected.academicYear],
                  ['Issue date', selected.issueDate],
                  ['Issuing officer', selected.issuedBy],
                  ['Expiry date', selected.expiryDate],
                  ['Print runs', String(selected.printCount)],
                  ['QR payload', idCardQrPayload(selected)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line px-3 py-2 dark:border-white/10">
                    <p className="text-[11px] uppercase tracking-wide text-mist">{label}</p>
                    <p className="text-sm font-semibold">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {holder && (
                <div className="rounded-xl border border-line p-3 dark:border-white/10">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Guardian contact</p>
                  <p className="text-sm">
                    {holder.holderType === 'Student'
                      ? (holder.guardian || '—')
                      : holder.holderType === 'Staff'
                        ? (holder.department || holder.designation || '—')
                        : (holder.plan || '—')}
                    {holder.phone ? ` · ${holder.phone}` : ''}
                  </p>
                </div>
              )}

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><HistoryIcon className="size-4 text-lime" /> Print history</h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-mist">
                    <tr><th className="py-1">Date</th><th className="py-1">Time</th><th className="py-1">Officer</th><th className="py-1">Reason</th></tr>
                  </thead>
                  <tbody>
                    {prints.map((row) => (
                      <tr key={row.id} className="border-t border-line/60 dark:border-white/5">
                        <td className="py-1">{row.date || '—'}</td>
                        <td className="py-1">{row.time || '—'}</td>
                        <td className="py-1">{row.officer || '—'}</td>
                        <td className="py-1 text-mist">{row.reason || '—'}</td>
                      </tr>
                    ))}
                    {!prints.length && <tr><td colSpan={4} className="py-3 text-mist">This card has never been printed.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {printCard && template && (
        <Modal open onClose={() => setPrintCard(null)} title={`Print ${printCard.cardNo}`} xl>
          <IdCardPrintSheet
            template={template}
            cards={[printCard]}
            school={school}
            layout={template.printLayout === 'A4 Sheet' ? 'A4' : 'PVC'}
            sides="Both"
            onDone={() => setPrintCard(null)}
          />
        </Modal>
      )}
    </div>
  )
}

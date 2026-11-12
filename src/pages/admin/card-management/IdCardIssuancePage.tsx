/**
 * Card Issuance & Status Tracking — search every card, move it through
 * Generated → Printed → Issued → Active, record loss / damage, replace cards,
 * print, and read the full history of each card.
 */
import { useMemo, useState } from 'react'
import { Eye, Filter, History, Pencil, Printer, RefreshCw, ShieldAlert, Stamp, Timer, Upload, UserCheck } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { IdCardFace } from '../../../components/IdCardSheet'
import { Button, Field, Input, Modal, PageHeader, Select, Textarea } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import {
  ID_CARD_STATUSES, allowedNextStatuses, canTransition, expiredCardNos, historyRow, idCardHistory,
  replaceCard, todayIso, type IdCard, type IdCardStatus,
} from '../../../lib/eduIdCards'
import { fileToAvatarDataUrl } from '../../../lib/image'
import { uid } from '../../../lib/utils'
import { CardHolderFilter, IdCardPrintPreviewModal, IdCardStatusBadge, useIdCardContext } from './IdCardShared'

const ACTION_LABEL: Record<string, string> = {
  Printed: 'Printed',
  Issued: 'Issued',
  Active: 'Activated',
  Lost: 'Marked Lost',
  Damaged: 'Marked Damaged',
  Expired: 'Expired',
}

const REPLACEMENT_REASONS = ['Lost', 'Stolen', 'Damaged', 'Worn out', 'Data correction', 'Other']

export function IdCardIssuancePage() {
  const {
    records, templates, cards, school, academicYear, officer, can, patch,
    holderType, setHolderType, availableHolderTypes, holderLabels,
  } = useIdCardContext()
  const toast = useToast()
  const canPrint = can('print')
  const canIssue = can('issue')
  const canReplace = can('replace')

  /* A school admin wants student cards; the same screen serves staff and member
   * cards to whoever manages those. */
  const scoped = useMemo(
    () => (holderType === 'All' ? cards : cards.filter((card) => card.holderType === holderType)),
    [cards, holderType],
  )

  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [printCards, setPrintCards] = useState<IdCard[] | null>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueDate, setIssueDate] = useState(todayIso())
  const [issuedBy, setIssuedBy] = useState(officer)
  const [replaceCardRow, setReplaceCardRow] = useState<IdCard | null>(null)
  const [replaceReason, setReplaceReason] = useState('Lost')
  const [replaceNote, setReplaceNote] = useState('')
  const [replaceDate, setReplaceDate] = useState(todayIso())
  const [replaceTemplateId, setReplaceTemplateId] = useState('')
  const [historyCardNo, setHistoryCardNo] = useState('')
  const [viewCard, setViewCard] = useState<IdCard | null>(null)
  const [editCard, setEditCard] = useState<IdCard | null>(null)
  const [editPhoto, setEditPhoto] = useState('')
  const [editSection, setEditSection] = useState('')
  const [editHouse, setEditHouse] = useState('')
  const [editExpiry, setEditExpiry] = useState('')
  const [editRemarks, setEditRemarks] = useState('')

  const classes = useMemo(
    () => [...new Set(scoped.map((card) => card.className).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [scoped],
  )
  const years = useMemo(
    () => [...new Set(scoped.map((card) => card.academicYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [scoped],
  )
  const history = useMemo(() => idCardHistory(records), [records])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return scoped.filter((card) => {
      if (classFilter && card.className !== classFilter) return false
      if (statusFilter && card.status !== statusFilter) return false
      if (yearFilter && card.academicYear !== yearFilter) return false
      if (!search) return true
      return [card.cardNo, card.student, card.admissionNo, card.className].some((value) => value.toLowerCase().includes(search))
    })
  }, [scoped, query, classFilter, statusFilter, yearFilter])

  const selectedCards = useMemo(() => scoped.filter((card) => selected.includes(card.id)), [scoped, selected])
  const lapsed = useMemo(() => expiredCardNos(records), [records])
  const templateFor = (card: IdCard) => templates.find((item) => item.id === card.templateId) ?? templates[0]

  const applyStatus = (targets: IdCard[], to: IdCardStatus, extra: Record<string, string> = {}, reason = '') => {
    if (!targets.length) return
    const blocked = targets.filter((card) => !canTransition(card.status, to))
    if (blocked.length) {
      toast.error('Status not allowed', `${blocked.map((card) => card.cardNo).join(', ')} cannot move from their current status to ${to}.`)
      return
    }
    const ids = new Set(targets.map((card) => card.id))
    const nextCards = (records.idCards ?? []).map((row) => (
      ids.has(String(row.id))
        ? { ...row, ...extra, status: to }
        : row
    ))
    const entries = targets.map((card) => historyRow(uid('idch'), {
      cardNo: card.cardNo,
      student: card.student,
      action: ACTION_LABEL[to] ?? to,
      fromStatus: card.status,
      toStatus: to,
      officer,
      reason,
    }))
    patch({ idCards: nextCards, idCardHistory: [...(records.idCardHistory ?? []), ...entries] })
    toast.success(`${targets.length} card${targets.length === 1 ? '' : 's'} ${ACTION_LABEL[to]?.toLowerCase() ?? to.toLowerCase()}`, targets.length === 1 ? targets[0].cardNo : 'Status updated for the selection.')
  }

  const markPrinted = (targets: IdCard[]) => {
    if (!targets.length) return
    const ids = new Set(targets.map((card) => card.id))
    const now = todayIso()
    const nextCards = (records.idCards ?? []).map((row) => {
      if (!ids.has(String(row.id))) return row
      const prints = Number(row.printCount ?? 0) + 1
      return { ...row, printCount: String(prints), lastPrintedAt: now, status: row.status === 'Generated' ? 'Printed' : row.status }
    })
    const entries = targets.map((card) => historyRow(uid('idch'), {
      cardNo: card.cardNo,
      student: card.student,
      action: 'Printed',
      fromStatus: card.status,
      toStatus: card.status === 'Generated' ? 'Printed' : card.status,
      officer,
      reason: 'Print run recorded',
    }))
    patch({ idCards: nextCards, idCardHistory: [...(records.idCardHistory ?? []), ...entries] })
    toast.success('Print run recorded', `${targets.length} card${targets.length === 1 ? '' : 's'} marked as printed.`)
  }

  const issueSelected = () => {
    applyStatus(selectedCards, 'Issued', { issueDate, issuedBy }, `Issued by ${issuedBy}`)
    setIssueOpen(false)
    setSelected([])
  }

  const expireLapsed = () => {
    const due = scoped.filter((card) => lapsed.includes(card.cardNo))
    if (!due.length) { toast.error('Nothing to expire', 'No card has passed its expiry date.'); return }
    applyStatus(due, 'Expired', {}, 'Validity period ended')
  }

  const runReplacement = () => {
    if (!replaceCardRow) return
    const template = templates.find((item) => item.id === (replaceTemplateId || replaceCardRow.templateId)) ?? templates[0]
    if (!template) { toast.error('No template', 'Create a card template first.'); return }
    const result = replaceCard(records, {
      card: replaceCardRow,
      template,
      academicYear: academicYear,
      officer,
      reason: [replaceReason, replaceNote.trim()].filter(Boolean).join(' — '),
      date: replaceDate,
      makeId: () => uid('idcard'),
    })
    const ids = new Set([replaceCardRow.id])
    const nextCards = [
      ...(records.idCards ?? []).map((row) => (ids.has(String(row.id)) ? { ...row, ...result.updated } : row)),
      result.created,
    ]
    patch({ idCards: nextCards, idCardHistory: [...(records.idCardHistory ?? []), ...result.history] })
    setReplaceCardRow(null)
    setReplaceNote('')
    toast.success('Card replaced', `${replaceCardRow.cardNo} deactivated · ${String(result.created.cardNo)} issued.`)
  }

  const openEditor = (card: IdCard) => {
    setEditCard(card)
    setEditPhoto(card.photo)
    setEditSection(card.section)
    setEditHouse(card.house)
    setEditExpiry(card.expiryDate)
    setEditRemarks(card.remarks)
  }

  const saveEditor = () => {
    if (!editCard) return
    const next = (records.idCards ?? []).map((row) => (
      String(row.id) === editCard.id
        ? { ...row, photo: editPhoto, section: editSection, house: editHouse, expiryDate: editExpiry, remarks: editRemarks }
        : row
    ))
    patch({
      idCards: next,
      idCardHistory: [...(records.idCardHistory ?? []), historyRow(uid('idch'), {
        cardNo: editCard.cardNo,
        student: editCard.student,
        action: 'Edited',
        fromStatus: editCard.status,
        toStatus: editCard.status,
        officer,
        reason: 'Card details updated',
      })],
    })
    setEditCard(null)
    toast.success('Card updated', `${editCard.cardNo} saved.`)
  }

  const columns: Column<IdCard>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={filtered.length > 0 && filtered.every((card) => selected.includes(card.id))}
          onChange={(event) => setSelected(event.target.checked ? filtered.map((card) => card.id) : [])}
          aria-label="Select all cards in view"
        />
      ),
      render: (card) => (
        <input
          type="checkbox"
          checked={selected.includes(card.id)}
          onChange={() => setSelected((current) => (current.includes(card.id) ? current.filter((item) => item !== card.id) : [...current, card.id]))}
          aria-label={`Select ${card.cardNo}`}
        />
      ),
    },
    { key: 'cardNo', header: 'Card No', sortValue: (card) => card.cardNo, render: (card) => <span className="font-mono text-[11px]">{card.cardNo}</span> },
    { key: 'student', header: 'Student', sortValue: (card) => card.student, render: (card) => <span className="font-medium">{card.student}</span> },
    { key: 'admissionNo', header: 'Admission No', sortValue: (card) => card.admissionNo, render: (card) => card.admissionNo || '—' },
    { key: 'className', header: 'Class', sortValue: (card) => card.className, render: (card) => card.className || '—' },
    { key: 'status', header: 'Status', sortValue: (card) => card.status, render: (card) => <IdCardStatusBadge status={card.status} /> },
    { key: 'issueDate', header: 'Issued', sortValue: (card) => card.issueDate, render: (card) => card.issueDate || '—' },
    { key: 'issuedBy', header: 'Officer', sortValue: (card) => card.issuedBy, render: (card) => card.issuedBy || '—' },
    { key: 'expiryDate', header: 'Expires', sortValue: (card) => card.expiryDate, render: (card) => card.expiryDate || '—' },
    { key: 'printCount', header: 'Prints', align: 'right', sortValue: (card) => card.printCount, render: (card) => card.printCount },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (card) => {
        const next = allowedNextStatuses(card.status)
        return (
          <div className="flex flex-wrap justify-end gap-1">
            <Button size="sm" variant="outline" title="Preview / print this card" disabled={!canPrint} onClick={() => setPrintCards([card])}>
              <Printer className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" title="Issue to student" disabled={!canIssue || !next.includes('Issued')} onClick={() => { setSelected([card.id]); setIssueOpen(true) }}>
              <UserCheck className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" title="Replace (lost / damaged)" disabled={!canReplace} onClick={() => { setReplaceCardRow(card); setReplaceTemplateId(card.templateId) }}>
              <RefreshCw className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" title="View card" onClick={() => setViewCard(card)}>
              <Eye className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" title="Edit card details" disabled={!canIssue} onClick={() => openEditor(card)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" title="Card history" onClick={() => setHistoryCardNo(card.cardNo)}>
              <History className="size-3.5" />
            </Button>
            <Select
              value=""
              className="!w-auto !py-1 text-xs"
              onChange={(event) => {
                const to = event.target.value as IdCardStatus
                if (!to) return
                if (to === 'Printed') { markPrinted([card]); return }
                applyStatus([card], to, {}, `Set to ${to}`)
              }}
            >
              <option value="">Status…</option>
              {next.map((status) => (<option key={status} value={status}>{status}</option>))}
            </Select>
          </div>
        )
      },
    },
  ]

  const historyRows = history.filter((row) => !historyCardNo || row.cardNo === historyCardNo)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Card Management"
        title="Card Issuance & Status"
        desc="Record issue dates and officers, move cards through their lifecycle, replace lost or damaged cards and print on demand."
        printTitle="ID Card Issuance"
      />

      {(!canPrint || !canIssue || !canReplace) && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-4" />
          Some actions are switched off for your role ({[!canPrint && 'print', !canIssue && 'issue', !canReplace && 'replace'].filter(Boolean).join(', ')}). Searching and viewing history stay available.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        {/* The holder chips get their own full-width row: inside a grid cell
            they were squeezed to ~200px and wrapped one chip per line. */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-lime" />
            <h2 className="font-display text-base font-semibold">Filters</h2>
          </div>
          <CardHolderFilter
            value={holderType}
            onChange={setHolderType}
            available={availableHolderTypes}
            labels={holderLabels}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Field label="Search" hint="Card no, holder, reference, class">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cards…" />
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
          <Field label="Academic year">
            <Select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="">All years</option>
              {years.map((item) => (<option key={item} value={item}>{item}</option>))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setQuery(''); setClassFilter(''); setStatusFilter(''); setYearFilter(''); setSelected([]) }}>
              Clear filters
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 dark:border-white/10">
          <span className="text-xs text-mist">{selected.length} selected of {filtered.length} cards</span>
          <Button size="sm" variant="outline" disabled={!canPrint || !selectedCards.length} onClick={() => setPrintCards(selectedCards)}>
            <Printer className="size-4" /> Print / preview
          </Button>
          <Button size="sm" variant="outline" disabled={!canPrint || !selectedCards.length} onClick={() => markPrinted(selectedCards)}>
            <Stamp className="size-4" /> Record print run
          </Button>
          <Button size="sm" variant="outline" disabled={!canIssue || !selectedCards.length} onClick={() => setIssueOpen(true)}>
            <UserCheck className="size-4" /> Issue selected
          </Button>
          <Button size="sm" variant="outline" disabled={!canIssue || !selectedCards.length} onClick={() => applyStatus(selectedCards, 'Active', {}, 'Activated for the term')}>
            Activate selected
          </Button>
          <Button size="sm" variant="outline" disabled={!canIssue || !selectedCards.length} onClick={() => applyStatus(selectedCards, 'Lost', {}, 'Reported lost')}>
            Mark lost
          </Button>
          <Button size="sm" variant="outline" disabled={!canIssue || !selectedCards.length} onClick={() => applyStatus(selectedCards, 'Damaged', {}, 'Reported damaged')}>
            Mark damaged
          </Button>
          <Button size="sm" variant="outline" disabled={!canIssue || !lapsed.length} onClick={expireLapsed} title={`${lapsed.length} card(s) past their expiry date`}>
            <Timer className="size-4" /> Expire lapsed ({lapsed.length})
          </Button>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {ID_CARD_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter((current) => (current === status ? '' : status))}
            className={`rounded-xl border px-3 py-2 text-left ${statusFilter === status ? 'border-lime bg-lime/5' : 'border-line dark:border-white/10'}`}
          >
            <p className="text-[11px] uppercase tracking-wide text-mist">{status}</p>
            <p className="font-display text-lg font-semibold">{scoped.filter((card) => card.status === status).length}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white/60 p-3 dark:bg-white/5">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(card) => card.id}
          pageSize={25}
          emptyTitle="No ID cards yet"
          emptyDesc="Generate cards for students, staff or members, then issue and track them here."
        />
      </section>

      {printCards && printCards[0] && (
        <IdCardPrintPreviewModal
          open
          onClose={() => setPrintCards(null)}
          template={templateFor(printCards[0])}
          cards={printCards}
          school={school}
          title="Print ID cards"
        />
      )}

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title={`Issue ${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'}`}
        footer={(
          <>
            <Button variant="outline" size="sm" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={issueSelected}>Confirm issue</Button>
          </>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Issue date" required>
            <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </Field>
          <Field label="Issuing officer" required>
            <Input value={issuedBy} onChange={(event) => setIssuedBy(event.target.value)} />
          </Field>
        </div>
        <p className="mt-3 text-sm text-mist">
          Cards move to <strong>Issued</strong> and the issue date, officer and history entry are written against each one.
        </p>
      </Modal>

      <Modal
        open={Boolean(replaceCardRow)}
        onClose={() => setReplaceCardRow(null)}
        title={`Replace ${replaceCardRow?.cardNo ?? 'card'}`}
        footer={(
          <>
            <Button variant="outline" size="sm" onClick={() => setReplaceCardRow(null)}>Cancel</Button>
            <Button size="sm" onClick={runReplacement}>Issue replacement</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-mist">
            {replaceCardRow?.student} · {replaceCardRow?.className}
            {replaceCardRow?.section ? ` · ${replaceCardRow.section}` : ''}
            {replaceCardRow?.house ? ` · ${replaceCardRow.house}` : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reason" required>
              <Select value={replaceReason} onChange={(event) => setReplaceReason(event.target.value)}>
                {REPLACEMENT_REASONS.map((reason) => (<option key={reason} value={reason}>{reason}</option>))}
              </Select>
            </Field>
            <Field label="Replacement date" required>
              <Input type="date" value={replaceDate} onChange={(event) => setReplaceDate(event.target.value)} />
            </Field>
            <Field label="Template">
              <Select value={replaceTemplateId} onChange={(event) => setReplaceTemplateId(event.target.value)}>
                {templates.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
              </Select>
            </Field>
            <Field label="Note">
              <Textarea rows={2} value={replaceNote} onChange={(event) => setReplaceNote(event.target.value)} placeholder="Optional detail for the record" />
            </Field>
          </div>
          <p className="text-xs text-mist">
            The old card is deactivated (status <strong>Replaced</strong>) and a new card number is generated automatically. Both entries are written to the card history.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(viewCard)}
        onClose={() => setViewCard(null)}
        title={`${viewCard?.cardNo ?? 'Card'} — ${viewCard?.student ?? ''}`}
        xl
        footer={(
          <>
            <Button variant="outline" size="sm" onClick={() => setViewCard(null)}>Close</Button>
            <Button size="sm" disabled={!canPrint || !viewCard} onClick={() => viewCard && setPrintCards([viewCard])}><Printer className="size-4" /> Print</Button>
          </>
        )}
      >
        {viewCard && templateFor(viewCard) && (
          <div className="flex flex-wrap gap-6 overflow-auto">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Front</p>
              <IdCardFace template={templateFor(viewCard)!} card={viewCard} side="front" school={school} />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Back</p>
              <IdCardFace template={templateFor(viewCard)!} card={viewCard} side="back" school={school} />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(editCard)}
        onClose={() => setEditCard(null)}
        title={`Edit ${editCard?.cardNo ?? 'card'}`}
        footer={(
          <>
            <Button variant="outline" size="sm" onClick={() => setEditCard(null)}>Cancel</Button>
            <Button size="sm" onClick={saveEditor}>Save changes</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Student photo" hint="Overrides the photo on the student record · stored with the card">
            <div className="flex flex-wrap items-center gap-3">
              {editPhoto
                ? <img src={editPhoto} alt="" style={{ width: '22mm', height: '26mm', objectFit: 'cover', borderRadius: '1.5mm' }} />
                : <div className="flex size-16 items-center justify-center rounded-lg border border-dashed text-[10px] text-mist">No photo</div>}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm dark:border-white/10">
                <Upload className="size-4" /> Choose image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    fileToAvatarDataUrl(file, 480)
                      .then((dataUrl) => setEditPhoto(dataUrl))
                      .catch(() => toast.error('Image failed', 'That file could not be read.'))
                  }}
                />
              </label>
              {editPhoto && (
                <Button variant="outline" size="sm" onClick={() => setEditPhoto('')}>Remove</Button>
              )}
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Section / stream">
              <Input value={editSection} onChange={(event) => setEditSection(event.target.value)} />
            </Field>
            <Field label="House">
              <Input value={editHouse} onChange={(event) => setEditHouse(event.target.value)} />
            </Field>
            <Field label="Expiry date">
              <Input type="date" value={editExpiry} onChange={(event) => setEditExpiry(event.target.value)} />
            </Field>
            <Field label="Remarks">
              <Input value={editRemarks} onChange={(event) => setEditRemarks(event.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(historyCardNo)}
        onClose={() => setHistoryCardNo('')}
        title={`Card history — ${historyCardNo}`}
        xl
        footer={<Button variant="outline" size="sm" onClick={() => setHistoryCardNo('')}>Close</Button>}
      >
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-mist">
              <tr>
                <th className="py-1.5">Date</th>
                <th className="py-1.5">Time</th>
                <th className="py-1.5">Action</th>
                <th className="py-1.5">From</th>
                <th className="py-1.5">To</th>
                <th className="py-1.5">Officer</th>
                <th className="py-1.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={row.id} className="border-t border-line/60 dark:border-white/5">
                  <td className="py-1.5">{row.date || '—'}</td>
                  <td className="py-1.5">{row.time || '—'}</td>
                  <td className="py-1.5 font-medium">{row.action}</td>
                  <td className="py-1.5">{row.fromStatus || '—'}</td>
                  <td className="py-1.5">{row.toStatus || '—'}</td>
                  <td className="py-1.5">{row.officer || '—'}</td>
                  <td className="py-1.5 text-mist">{row.reason || '—'}</td>
                </tr>
              ))}
              {!historyRows.length && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-mist">No history recorded for this card.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

    </div>
  )
}

/**
 * Shared plumbing for the five ID Card pages: branch records, the signed-in
 * user's roles, permission checks, school details and status badges.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Badge, Button, Field, Modal, Select } from '../../../components/ui'
import { IdCardFace, IdCardPrintSheet, type IdCardPrintLayout, type IdCardPrintSides, type IdCardSchool } from '../../../components/IdCardSheet'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import {
  activeIdCardTemplates, canPerformIdCard, currentAcademicYear, idCards, idCardStudents, idCardTemplates,
  statusTone, CARD_HOLDER_TYPES, CARD_HOLDER_LABELS,
  type IdCard, type IdCardPermissionKey, type IdCardStatus, type IdCardTemplate,
} from '../../../lib/eduIdCards'
import { loadCardStore, saveCardStore } from '../../../lib/cardStore'
import {
  cardHolders, type CardHolder, type CardHolderType, type CardPersonSource,
} from '../../../lib/cardHolders'
import { loadEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'

export function useIdCardContext() {
  const { activeBranchId, company, branches, roles, staff, members, users, plans } = useApp()
  const { user } = useAuth()
  /* Two stores on purpose: the people (and the academic year) live with their
   * own modules, while cards, templates and permissions belong to Card
   * Management. Reading both keeps a school's students and a gym's members
   * available to the same card screens. */
  const [records, setRecords] = useState<EduRecords>(() => loadCardStore(activeBranchId))
  const [people, setPeople] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  useEffect(() => {
    setRecords(loadCardStore(activeBranchId))
    setPeople(loadEduRecords(activeBranchId))
  }, [activeBranchId])

  const roleDef = roles.find((role) => role.id === user?.role)
  const userRoles = [String(user?.role ?? ''), String(roleDef?.name ?? '')].filter(Boolean)

  const school: IdCardSchool = {
    name: company?.name ?? 'Organisation Name',
    address: [company?.address, company?.stateRegion, company?.country].filter(Boolean).join(', '),
    contact: [company?.phone, company?.email].filter(Boolean).join(' · '),
    motto: '',
    logo: company?.logoImage ?? company?.printHeader?.headerImage ?? '',
  }

  const templates = useMemo(() => idCardTemplates(records), [records])
  const activeTemplates = useMemo(() => activeIdCardTemplates(records), [records])
  const cards = useMemo(() => idCards(records), [records])
  const students = useMemo(() => idCardStudents(people), [people])
  const academicYear = useMemo(() => currentAcademicYear(people), [people])
  const officer = String(user?.name ?? roleDef?.name ?? user?.role ?? 'System').trim() || 'System'

  /* ---- holders ----------------------------------------------------------
   * Everyone a card could be issued to. Staff and members are scoped to the
   * active branch; a record with no branch is treated as shared across the
   * organisation so seeded data still shows up. */
  const inBranch = (branchId: unknown) => !String(branchId ?? '').trim() || String(branchId) === activeBranchId

  const sources = useMemo(() => ({
    students,
    staff: (staff ?? []).filter((record) => inBranch(record.branchId)) as unknown as EduRow[],
    members: (members ?? []).filter((record) => inBranch(record.branchId)) as unknown as EduRow[],
    users: (users ?? []) as unknown as CardPersonSource[],
    planNames: new Map((plans ?? []).map((plan) => [String(plan.id), String(plan.name ?? '')])),
  }), [students, staff, members, users, plans, activeBranchId])

  /** Holder types that actually have someone in them — no point offering an empty tab. */
  const availableHolderTypes = useMemo(
    () => CARD_HOLDER_TYPES.filter((type) => cardHolders(type, sources).length > 0),
    [sources],
  )

  const [holderType, setHolderType] = useState<CardHolderType | 'All'>('All')

  /** The people offered for card generation, honouring the holder-type filter. */
  const holders: CardHolder[] = useMemo(() => {
    const types = holderType === 'All'
      ? (availableHolderTypes.length ? [...availableHolderTypes] : ['Student' as CardHolderType])
      : [holderType]
    return types.flatMap((type) => cardHolders(type, sources))
  }, [sources, holderType, availableHolderTypes])

  const can = useCallback(
    (permission: IdCardPermissionKey) => canPerformIdCard(records, permission, userRoles),
    [records, userRoles.join('|')],
  )

  /** Writes through to storage AND updates state, so every page refreshes at once. */
  const patch = useCallback((next: Record<string, EduRow[]>) => {
    setRecords((current) => {
      const merged = { ...current, ...next }
      saveCardStore(activeBranchId, merged)
      return merged
    })
  }, [activeBranchId])

  const availableRoles = [
    ...roles.map((role) => ({ id: String(role.id ?? ''), name: String(role.name ?? role.id ?? '') })),
    ...['super_admin', 'company_admin', 'branch_admin', 'gym_manager', 'receptionist', 'staff', 'head_office']
      .filter((id) => !roles.some((role) => role.id === id))
      .map((id) => ({ id, name: id.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase()) })),
  ]

  return {
    activeBranchId, records, school, templates, activeTemplates, cards, students, academicYear,
    officer, userRoles, availableRoles, can, patch,
    // universal bits
    holders, sources, holderType, setHolderType, availableHolderTypes, holderLabels: CARD_HOLDER_LABELS,
  }
}

/**
 * Holder-type filter. Only the types that actually have someone in them are
 * offered, so a school sees Students and a gym sees Members rather than three
 * empty tabs.
 */
export function CardHolderFilter({
  value,
  onChange,
  available,
  labels = CARD_HOLDER_LABELS,
}: {
  value: CardHolderType | 'All'
  onChange: (next: CardHolderType | 'All') => void
  available: CardHolderType[]
  labels?: Record<CardHolderType, { one: string; many: string; reference: string }>
}) {
  if (available.length < 2) return null
  const options: (CardHolderType | 'All')[] = ['All', ...available]
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Card holder type">
      {options.map((option) => {
        const active = value === option
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={
              active
                ? // The transparent-turned-lime border keeps every chip the same
                  // height, so a selected chip never sits off the baseline.
                  'whitespace-nowrap rounded-full border border-lime bg-lime px-3 py-1 text-xs font-semibold text-black'
                : 'whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs text-mist hover:text-ink dark:border-white/10'
            }
          >
            {option === 'All' ? 'All holders' : labels[option].many}
          </button>
        )
      })}
    </div>
  )
}

/** The reference number shown for a holder — admission, employee or membership. */
export const holderReferenceLabel = (holderType: CardHolderType) => CARD_HOLDER_LABELS[holderType].reference

export const defaultTemplate = (templates: IdCardTemplate[]): IdCardTemplate | undefined =>
  templates.find((template) => template.status === 'Active') ?? templates[0]

export function IdCardStatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  const chip = tone === 'ok' ? 'lime' : tone === 'warn' ? 'amber' : tone === 'bad' ? 'rose' : 'zinc'
  return <Badge tone={chip}>{status}</Badge>
}

/** Card numbers are long — show them in a monospaced chip. */
export const CardNo = ({ value }: { value: string }) => (
  <span className="font-mono text-[11px] tracking-tight">{value || '—'}</span>
)

export const cardStatuses: IdCardStatus[] = [
  'Generated', 'Printed', 'Issued', 'Active', 'Lost', 'Damaged', 'Replaced', 'Expired',
]

export const EMPTY_CARD_LIST: IdCard[] = []
export type { EduRecords, EduRow }


/**
 * Print preview for a set of cards: choose PVC (one card per page) or an A4
 * grid, front / back / both sides, then send it to the printer.
 */
export function IdCardPrintPreviewModal({
  open,
  onClose,
  template,
  cards,
  school,
  title = 'Print preview',
}: {
  open: boolean
  onClose: () => void
  template: IdCardTemplate
  cards: IdCard[]
  school: IdCardSchool
  title?: string
}) {
  const [layout, setLayout] = useState<IdCardPrintLayout>(template.printLayout === 'A4 Sheet' ? 'A4' : 'PVC')
  const [sides, setSides] = useState<IdCardPrintSides>('Both')
  const [printing, setPrinting] = useState(false)

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => { if (!printing) onClose() }}
      title={`${title} — ${cards.length} card${cards.length === 1 ? '' : 's'}`}
      xl
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={printing}>Close</Button>
          <Button size="sm" onClick={() => setPrinting(true)} disabled={printing || !cards.length}>
            <Printer className="size-4" /> {printing ? 'Printing…' : 'Print'}
          </Button>
        </>
      )}
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Layout">
          <Select value={layout} onChange={(event) => setLayout(event.target.value as IdCardPrintLayout)}>
            <option value="PVC">PVC card — one 85.6 × 54 mm page per card</option>
            <option value="A4">A4 sheet — cards per sheet</option>
          </Select>
        </Field>
        <Field label="Sides">
          <Select value={sides} onChange={(event) => setSides(event.target.value as IdCardPrintSides)}>
            <option value="Front">Front only</option>
            <option value="Back">Back only</option>
            <option value="Both">Front and back</option>
          </Select>
        </Field>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-xl bg-black/5 p-3 dark:bg-white/5">
        <div className="flex flex-wrap gap-4">
          {cards.slice(0, layout === 'A4' ? 8 : 4).map((card) => (
            <div key={card.id} className="space-y-1">
              {sides !== 'Back' && <IdCardFace template={template} card={card} side="front" school={school} />}
              {sides !== 'Front' && <IdCardFace template={template} card={card} side="back" school={school} />}
            </div>
          ))}
          {cards.length > (layout === 'A4' ? 8 : 4) && (
            <p className="w-full text-xs text-mist">Previewing the first few cards — all {cards.length} go to the printer.</p>
          )}
        </div>
      </div>
      {printing && (
        <IdCardPrintSheet
          template={template}
          cards={cards}
          school={school}
          layout={layout}
          sides={sides}
          onDone={() => { setPrinting(false); onClose() }}
        />
      )}
    </Modal>
  )
}

/**
 * ID Card Generation — build cards from student records, one at a time or in
 * bulk by class, section/stream, house or the whole school.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, GraduationCap, IdCard as IdCardIcon, Search, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { IdCardFace } from '../../../components/IdCardSheet'
import { Badge, Button, Field, Input, PageHeader, SearchInput, Select, Switch } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import {
  ID_CARD_INACTIVE_STATUSES, generateCards, idCardHouses, idCardClassNames, idCardSections, todayIso,
  CARD_HOLDER_TYPES, type IdCard, type IdCardTemplate, type CardHolder, type CardHolderType,
  readIdCard,
} from '../../../lib/eduIdCards'
import { uid } from '../../../lib/utils'
import { CardHolderFilter, IdCardPrintPreviewModal, IdCardStatusBadge, useIdCardContext } from './IdCardShared'

type Scope = 'all' | 'class' | 'section' | 'house'

export function IdCardGenerationPage() {
  const {
    records, templates, cards, school, academicYear, officer, can, patch,
    holders, holderType, setHolderType, availableHolderTypes, holderLabels,
  } = useIdCardContext()
  const toast = useToast()
  const allowed = can('generate')

  const defaultId = String(((records.idCardSettings ?? [])[0] ?? {}).defaultTemplateId ?? '').trim()
  const [templateId, setTemplateId] = useState(defaultId || templates[0]?.id || '')
  const template: IdCardTemplate | undefined = templates.find((item) => item.id === templateId) ?? templates[0]
  const [year, setYear] = useState(academicYear)
  const [scope, setScope] = useState<Scope>('all')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [houseFilter, setHouseFilter] = useState('')
  const [query, setQuery] = useState('')
  const [regenerate, setRegenerate] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  /* Deep link from a domain screen: /id-card-generation?holder=staff&record=<id>
   * picks the holder type and pre-selects that person. */
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const holderParam = params.get('holder')
    if (holderParam && (CARD_HOLDER_TYPES as readonly string[]).includes(holderParam)) {
      setHolderType(holderParam as CardHolderType)
    }
    const record = params.get('record')
    if (record) {
      setSelected([record.toLowerCase()])
      // Consume it so a refresh doesn't keep re-selecting.
      const next = new URLSearchParams(params)
      next.delete('record')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [justGenerated, setJustGenerated] = useState<IdCard[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)

  const classes = useMemo(() => idCardClassNames(holders as never), [holders])
  const sections = useMemo(() => idCardSections(holders as never), [holders])
  const houses = useMemo(() => idCardHouses(holders as never), [holders])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return holders.filter((holder) => {
      if (scope === 'class' && classFilter && holder.className !== classFilter) return false
      if (scope === 'section' && sectionFilter && holder.section !== sectionFilter) return false
      if (scope === 'house' && houseFilter && holder.house !== houseFilter) return false
      if (search && ![holder.name, holder.reference, holder.className, holder.department, holder.plan].some((value) => value.toLowerCase().includes(search))) return false
      return true
    })
  }, [holders, scope, classFilter, sectionFilter, houseFilter, query])

  const existingByStudent = useMemo(() => {
    const map = new Map<string, IdCard>()
    for (const card of cards) {
      const key = (card.holderId || card.studentId || card.holder || card.student).toLowerCase()
      const current = map.get(key)
      if (!current || ID_CARD_INACTIVE_STATUSES.includes(current.status)) map.set(key, card)
    }
    return map
  }, [cards])

  const holderKey = (holder: CardHolder) => (holder.id || holder.name).toLowerCase()
  const allSelected = filtered.length > 0 && filtered.every((holder) => selected.includes(holderKey(holder)))
  const pending = filtered.filter((holder) => !existingByStudent.has(holderKey(holder)))

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))

  const runGeneration = (targets: CardHolder[]) => {
    if (!template) { toast.error('No template', 'Create a card template first.'); return }
    if (!targets.length) { toast.error('Nothing selected', 'Pick at least one person.'); return }
    const result = generateCards(records, {
      template,
      holders: targets,
      academicYear: year,
      officer,
      regenerate,
      makeId: () => uid('idcard'),
    })
    if (!result.cards.length) {
      toast.error('No cards generated', result.skipped.length
        ? 'Everyone selected already holds a card. Tick “Regenerate” to issue fresh ones.'
        : 'Nothing could be generated for this selection.')
      return
    }
    patch({
      idCards: [...(records.idCards ?? []), ...result.cards],
      idCardHistory: [...(records.idCardHistory ?? []), ...result.history],
    })
    setJustGenerated(result.cards.map(readIdCard))
    setSelected([])
    toast.success(
      `${result.cards.length} card${result.cards.length === 1 ? '' : 's'} generated`,
      result.skipped.length
        ? `${result.skipped.length} skipped — those people already hold a card.`
        : `${template.name} · ${year}`,
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Card Management"
        title="Generate ID Cards"
        desc="Create cards from student records — one student at a time, or in bulk by class, section/stream, house or the whole school."
        printTitle="ID Card Generation"
      />

      {!allowed && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-4" /> Your role cannot generate ID cards. Ask an administrator for the “Generate cards” permission.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Card template">
            <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {(holderType === 'All' ? templates : templates.filter((item) => item.holderType === holderType)).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              {!templates.length && <option value="">No templates yet</option>}
            </Select>
          </Field>
          <Field label="Academic year">
            <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="2026/2027" />
          </Field>
          <Field label="Generate for">
            <Select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
              <option value="all">Everyone</option>
              <option value="class">By class</option>
              <option value="section">By section / stream</option>
              <option value="house">By house</option>
            </Select>
          </Field>
          {scope === 'class' && (
            <Field label="Class">
              <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="">Choose a class…</option>
                {classes.map((item) => (<option key={item} value={item}>{item}</option>))}
              </Select>
            </Field>
          )}
          {scope === 'section' && (
            <Field label="Section / stream">
              <Select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                <option value="">Choose a section…</option>
                {sections.map((item) => (<option key={item} value={item}>{item}</option>))}
              </Select>
            </Field>
          )}
          {scope === 'house' && (
            <Field label="House">
              <Select value={houseFilter} onChange={(event) => setHouseFilter(event.target.value)}>
                <option value="">Choose a house…</option>
                {houses.map((item) => (<option key={item} value={item}>{item}</option>))}
              </Select>
            </Field>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 dark:border-white/10">
          <SearchInput value={query} onChange={setQuery} placeholder="Search people…" className="w-full max-w-xs" />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={regenerate} onChange={setRegenerate} disabled={!allowed} /> Regenerate for people who already hold a card
          </label>
          <p className="text-xs text-mist">
            {filtered.length} in view · {pending.length} without a card · {cards.length} cards on file
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setSelected(pending.map(holderKey))}>
              <Users className="size-4" /> Select people without a card
            </Button>
            <Button size="sm" disabled={!allowed || !selected.length} onClick={() => runGeneration(filtered.filter((holder) => selected.includes(holderKey(holder))))}>
              <Sparkles className="size-4" /> Generate selected ({selected.length})
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white/60 dark:bg-white/5">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 dark:border-white/10">
          <GraduationCap className="size-4 text-lime" />
          <h2 className="font-display text-base font-semibold">People</h2>
          <div className="ml-auto">
            <CardHolderFilter
              value={holderType}
              onChange={setHolderType}
              available={availableHolderTypes}
              labels={holderLabels}
            />
          </div>
        </div>
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="sticky top-0 bg-black/5 text-left text-[11px] uppercase tracking-wide text-mist dark:bg-white/10">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelected(event.target.checked ? filtered.map(holderKey) : [])}
                    aria-label="Select everyone in view"
                    disabled={!allowed}
                  />
                </th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Reference</th>
                <th className="px-2 py-2">Detail</th>
                <th className="px-2 py-2">Existing card</th>
                <th className="px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((holder) => {
                const key = holderKey(holder)
                const existing = existingByStudent.get(key)
                const detail = holder.holderType === 'Student'
                  ? holder.className || '—'
                  : holder.holderType === 'Staff'
                    ? holder.department || holder.designation || '—'
                    : holder.plan || '—'
                return (
                  <tr key={key} className="border-t border-line/60 dark:border-white/5">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={() => toggle(key)}
                        aria-label={`Select ${holder.name}`}
                        disabled={!allowed}
                      />
                    </td>
                    <td className="px-2 py-2 font-medium">{holder.name}</td>
                    <td className="px-2 py-2"><Badge tone={holder.holderType === 'Student' ? 'sky' : holder.holderType === 'Staff' ? 'violet' : 'lime'}>{holder.holderType}</Badge></td>
                    <td className="px-2 py-2 font-mono text-[11px]">{holder.reference || '—'}</td>
                    <td className="px-2 py-2">{detail}</td>
                    <td className="px-2 py-2">
                      {existing
                        ? (
                          <span className="flex items-center gap-1.5">
                            <IdCardStatusBadge status={existing.status} />
                            <span className="font-mono text-[11px]">{existing.cardNo}</span>
                          </span>
                        )
                        : <span className="text-mist">None</span>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button size="sm" variant="outline" disabled={!allowed} onClick={() => runGeneration([holder])}>
                        <IdCardIcon className="size-3.5" /> Generate
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-mist">
                    Nobody matches this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {justGenerated.length > 0 && template && (
        <section className="rounded-2xl border border-lime/40 bg-lime/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              <BadgeCheck className="size-4 text-lime" /> {justGenerated.length} card{justGenerated.length === 1 ? '' : 's'} generated on {todayIso()}
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Search className="size-4" /> Preview & print</Button>
              <Button size="sm" variant="outline" onClick={() => setJustGenerated([])}>Dismiss</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 overflow-auto">
            {justGenerated.slice(0, 8).map((card) => (
              <IdCardFace key={card.id} template={template} card={card} side="front" school={school} />
            ))}
            {justGenerated.length > 8 && <p className="text-xs text-mist">+ {justGenerated.length - 8} more</p>}
          </div>
        </section>
      )}

      {template && (
        <IdCardPrintPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          template={template}
          cards={justGenerated}
          school={school}
          title="Print generated cards"
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, CalendarDays, CalendarRange, Check, HelpCircle, X } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Empty } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { useI18n } from '../../../context/I18nContext'
import { useApp } from '../../../context/AppContext'
import { cn, uid } from '../../../lib/utils'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { migrateTimeOffRows, stateOf, withSlot, type SlotState } from '../../../lib/eduTimeOff'
import {
  DEFAULT_BELL_TIMES, DEFAULT_DAY_NAMES, DEFAULT_PERIOD_NAMES, MAX_DAYS, MAX_PERIODS,
  WEEKEND_OPTIONS, loadTtConfig, makePeriodShort, type TtConfig,
} from '../../../lib/eduTimetableConfig'
import { breakAppliesToClass, breakBeforePeriodIndex, breakClassNames, breakDisplayTime, breakPrintFontSize, breakPrintTitle, breakScopeLabel, breakTimeDefaults, breakTimeRange, classBreaksFor } from '../../../lib/eduTimetableBreaks'

type RuleKind = 'classRules' | 'teacherRules' | 'timeOff' | 'constraints'
type Section = RuleKind | 'definition' | 'breaks'

type OptionDef = string | { value: string; label: string }
type FieldDef = { key: string; label: string; type: 'text' | 'number' | 'select'; options?: OptionDef[]; required?: boolean }

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: 'teacherConsec', label: 'Teacher: max consecutive periods' },
  { value: 'classConsec', label: 'Class: max consecutive periods' },
  { value: 'classSubjectOnce', label: 'Class: at most one lesson per subject per day' },
]
const kindLabel = (v: string) => KIND_OPTIONS.find((k) => k.value === v)?.label ?? v
const makeBreakShort = (name: string) => name.trim().split(/\s+/).filter(Boolean).map((word) => word.charAt(0)).join('').toLocaleUpperCase()

const CLASS_FIELDS: FieldDef[] = [
  { key: 'className', label: 'Class', type: 'text', required: true },
  { key: 'maxPerDay', label: 'Max periods per day', type: 'number' },
  { key: 'maxPerWeek', label: 'Max periods per week', type: 'number' },
]
const teacherFields = (days: string[], periods: string[]): FieldDef[] => [
  { key: 'teacher', label: 'Teacher', type: 'text', required: true },
  { key: 'maxPerDay', label: 'Max periods per day', type: 'number' },
  { key: 'maxPerWeek', label: 'Max periods per week', type: 'number' },
  { key: 'unavailableDay', label: 'Unavailable day', type: 'select', options: ['Any', ...days] },
  { key: 'unavailablePeriod', label: 'Unavailable period', type: 'select', options: ['Any', ...periods] },
]
const fieldsFor = (kind: RuleKind, days: string[], periods: string[]): FieldDef[] => {
  if (kind === 'classRules') return CLASS_FIELDS
  if (kind === 'teacherRules') return teacherFields(days, periods)
  if (kind === 'timeOff') {
    return [
      { key: 'whoType', label: 'Who', type: 'select', options: ['Teacher', 'Class'], required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'day', label: 'Day', type: 'select', options: days, required: true },
      { key: 'from', label: 'From period', type: 'select', options: periods },
      { key: 'to', label: 'To period', type: 'select', options: periods },
    ]
  }
  return [
    { key: 'kind', label: 'Constraint', type: 'select', options: KIND_OPTIONS, required: true },
    { key: 'target', label: 'Applies to (blank = all)', type: 'text' },
    { key: 'value', label: 'Max consecutive', type: 'number' },
  ]
}

const THEAD = 'border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]'
const TH = 'px-3 py-2.5'
const TD = 'px-3 py-2'

const blankDef = (): EduRow => ({
  id: 'tt-config',
  daysCount: '5',
  periodsPerDay: '8',
  dayNames: '',
  dayShorts: '',
  periodNames: '',
  periodShorts: '',
  bellTimes: '',
  weekend: WEEKEND_OPTIONS[0],
  workZeroPeriods: 'Yes',
  showDayNumbers: '',
  multiTerm: '',
  teacherNameDisplay: 'full',
  classroomNameDisplay: 'full',
  subjectNameDisplay: 'full',
  breakNameDisplay: 'full',
  showBreaks: 'Yes',
  printShowClassroom: 'Yes',
  printShowTeacher: 'Yes',
  printShowSubject: 'Yes',
})
const readDef = (branchId: string): EduRow => {
  const row = (loadEduRecords(branchId)['ttConfig'] ?? [])[0]
  if (!row) return blankDef()
  const clean = { ...blankDef(), ...row }
  delete clean.breakTitle // Drop the legacy branch-wide field when the definition is next saved.
  delete clean.printPeriodNameDisplay // Period print labels now follow breakNameDisplay.
  return clean
}

const splitList = (v: string | undefined) => (v ?? '').split('|').map((s) => s.trim())

type ClassBreaksSectionProps = {
  activeBranchId: string
  records: EduRecords
  setRecords: (next: EduRecords) => void
  classes: string[]
  cfg: TtConfig
}

function ClassBreaksSection({ activeBranchId, records, setRecords, classes, cfg }: ClassBreaksSectionProps) {
  const toast = useToast()
  const [classSelection, setClassSelection] = useState('')
  const [classSearch, setClassSearch] = useState('')
  const [edit, setEdit] = useState<EduRow | null>(null)
  const sortedClasses = [...classes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const visibleClasses = sortedClasses.filter((name) => name.toLocaleLowerCase().includes(classSearch.trim().toLocaleLowerCase()))
  const className = classSelection && classes.includes(classSelection) ? classSelection : sortedClasses[0] ?? ''
  const beforePeriods = cfg.periods.map((period, index) => ({ period, index }))
  const rows = classBreaksFor(records['classBreaks'] ?? [], className)
  const editTargets = edit ? breakClassNames(edit) : []
  const positionName = (index: number) => cfg.periods[index] ?? `Period ${index + 1}`
  const hasAvailablePosition = beforePeriods.some(({ index }) => !rows.some((row) => breakBeforePeriodIndex(row) === index))

  const persistBreaks = (nextRows: EduRow[]) => {
    const next = { ...records, classBreaks: nextRows }
    setRecords(next)
    saveEduRecords(activeBranchId, next)
  }

  const updateTargetClasses = (nextNames: string[]) => {
    if (!edit) return
    const uniqueNames = [...new Set(nextNames)]
    setEdit({ ...edit, classNames: JSON.stringify(uniqueNames), className: uniqueNames[0] || edit.className })
  }

  const openAdd = () => {
    if (!className || !beforePeriods.length || !hasAvailablePosition) return
    const preferredIndex = Math.min(2, cfg.periods.length - 1)
    const positionsFromPreferred = [...beforePeriods.slice(preferredIndex), ...beforePeriods.slice(0, preferredIndex)]
    const beforePeriodIndex = rows.some((row) => breakBeforePeriodIndex(row) === preferredIndex)
      ? positionsFromPreferred.find(({ index }) => !rows.some((row) => breakBeforePeriodIndex(row) === index))?.index ?? preferredIndex
      : preferredIndex
    const suggested = breakTimeDefaults(cfg, beforePeriodIndex)
    setClassSearch('')
    setEdit({
      id: uid(), className, classNames: JSON.stringify([className]), applyToAll: '', name: '', short: '', shortManuallyEdited: '', printText: '', printFontSize: '12',
      beforePeriodIndex: String(beforePeriodIndex),
      startTime: suggested.startTime, endTime: suggested.endTime,
      timeEdited: '',
    })
  }

  const openEdit = (row: EduRow) => {
    const currentIndex = breakBeforePeriodIndex(row)
    const safeIndex = currentIndex >= 0 && currentIndex < cfg.periods.length ? currentIndex : Math.min(2, cfg.periods.length - 1)
    const suggested = breakTimeDefaults(cfg, safeIndex)
    const name = row.name || row.title || ''
    const savedShort = String(row.short ?? '').trim()
    const generatedShort = makeBreakShort(name)
    const shortManuallyEdited = !!savedShort
      && savedShort.toLocaleUpperCase() !== generatedShort
      && savedShort.toLocaleLowerCase() !== String(name).trim().toLocaleLowerCase()
    const storedPrintText = String(row.printText ?? '').trim()
    const hasCustomPrintText = !!storedPrintText && (row.printTextCustom === 'Yes'
      || storedPrintText.toLocaleLowerCase() !== String(name).trim().toLocaleLowerCase())
    const printText = hasCustomPrintText ? storedPrintText : breakPrintTitle(row)
    setClassSearch('')
    setEdit({
      ...row,
      classNames: JSON.stringify(breakClassNames(row)),
      printTextCustom: hasCustomPrintText ? 'Yes' : '',
      applyToAll: row.applyToAll === 'Yes' ? 'Yes' : '',
      name,
      short: shortManuallyEdited ? savedShort : generatedShort,
      shortManuallyEdited: shortManuallyEdited ? 'Yes' : '',
      printText,
      printFontSize: String(breakPrintFontSize(row)),
      beforePeriodIndex: String(safeIndex),
      startTime: row.timeEdited === 'Yes' ? row.startTime ?? '' : suggested.startTime,
      endTime: row.timeEdited === 'Yes' ? row.endTime ?? '' : suggested.endTime,
      timeEdited: row.timeEdited === 'Yes' ? 'Yes' : '',
    })
  }

  const updatePosition = (value: string) => {
    if (!edit) return
    const beforePeriodIndex = Number(value)
    const suggested = breakTimeDefaults(cfg, beforePeriodIndex)
    setEdit({
      ...edit,
      beforePeriodIndex: value,
      ...(edit.timeEdited === 'Yes' ? {} : suggested),
    })
  }

  const saveBreak = () => {
    if (!edit) return
    const name = String(edit.name ?? '').trim()
    const short = String(edit.short ?? '').trim() || makeBreakShort(name)
    const enteredPrintText = String(edit.printText ?? '').trim()
    const printText = edit.printTextCustom === 'Yes' ? enteredPrintText : ''
    const printFontSize = String(breakPrintFontSize(edit))
    const beforePeriodIndex = Number(edit.beforePeriodIndex)
    const startTime = String(edit.startTime ?? '').trim()
    const endTime = String(edit.endTime ?? '').trim()
    if (!name) {
      toast.error('Break name is required')
      return
    }
    if (!Number.isInteger(beforePeriodIndex) || beforePeriodIndex < 0 || beforePeriodIndex >= cfg.periods.length) {
      toast.error('Choose a period position for the break')
      return
    }
    if (!startTime || !endTime || startTime >= endTime) {
      toast.error('Enter a valid start and end time for the break')
      return
    }
    const applyToAll = edit.applyToAll === 'Yes'
    const targetClasses = applyToAll
      ? classes
      : [...new Set(breakClassNames(edit).filter((name) => classes.includes(name)))]
    if (!targetClasses.length) {
      toast.error(applyToAll ? 'There are no classes to apply this break to' : 'Select at least one class')
      return
    }
    const ownerClass = targetClasses[0] || edit.className || className
    const allRows = records['classBreaks'] ?? []
    const duplicate = allRows.some((row) => row.id !== edit.id
      && breakBeforePeriodIndex(row) === beforePeriodIndex
      && targetClasses.some((target) => breakAppliesToClass(row, target)))
    if (duplicate) {
      toast.error('A break already exists at that period position for at least one selected class')
      return
    }
    const clean: EduRow = {
      ...edit,
      className: ownerClass,
      classNames: JSON.stringify(targetClasses),
      applyToAll: applyToAll ? 'Yes' : '',
      name,
      short,
      printText,
      printTextCustom: printText ? 'Yes' : '',
      printFontSize,
      beforePeriodIndex: String(beforePeriodIndex),
      startTime,
      endTime,
      timeEdited: edit.timeEdited === 'Yes' ? 'Yes' : '',
    }
    delete clean.title
    delete clean.afterPeriodIndex
    delete clean.shortManuallyEdited
    persistBreaks(allRows.some((row) => row.id === edit.id)
      ? allRows.map((row) => (row.id === edit.id ? clean : row))
      : [...allRows, clean])
    toast.success('Break saved', `${name} · before ${positionName(beforePeriodIndex)}`)
    setEdit(null)
  }

  const removeBreak = (row: EduRow) => {
    persistBreaks((records['classBreaks'] ?? []).filter((item) => item.id !== row.id))
    toast.success('Break removed', row.name || row.title || className)
  }

  return (
    <>
      <div className="card">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <div className="mr-auto">
            <p className="text-sm font-bold">Breaks in period sequence</p>
            <p className="mt-0.5 text-xs text-mist">Breaks can apply to one, multiple, or all classes. Each is shown before a period but is not counted as a period, so teaching-period numbers stay unchanged. For {className || 'the selected class'}: {cfg.periods.length} periods and {rows.length} break(s). Times are suggested from adjacent bells and can be edited.</p>
          </div>
          <Field label="Class" className="w-56">
            <Select value={className} disabled={!classes.length} onChange={(e) => setClassSelection(e.target.value)}>
              {sortedClasses.map((name) => (<option key={name} value={name}>{name}</option>))}
            </Select>
          </Field>
          <Button size="sm" onClick={openAdd} disabled={!className || !beforePeriods.length || !hasAvailablePosition}>
            <Plus className="size-4" /> Add break
          </Button>
        </div>
        {!classes.length ? (
          <div className="p-6"><Empty title="No classes yet" desc="Add classes first, then add breaks to their period sequences." /></div>
        ) : !rows.length ? (
          <div className="p-6"><Empty title="No breaks for this class" desc="Classes start with no breaks configured. Add a break before any period." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-xs">
              <thead><tr className={THEAD}>
                <th className={TH}>Name</th><th className={TH}>Applies to</th><th className={TH}>Short</th><th className={TH}>Break position</th><th className={TH}>Start / End</th><th className={TH}>Print label</th><th className={TH}>Print size</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((row) => {
                  const index = breakBeforePeriodIndex(row)
                  return (
                    <tr key={row.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className={`${TD} font-semibold`}>{row.name || row.title}</td>
                      <td className={TD} title={row.applyToAll === 'Yes' ? 'All classes' : breakClassNames(row).join(', ')}>{breakScopeLabel(row)}</td>
                      <td className={TD}>{row.short || row.name || row.title || '—'}</td>
                      <td className={TD}>{cfg.periods[index] ? `Before ${positionName(index)}` : '—'}</td>
                      <td className={TD}>{breakDisplayTime(cfg, row) || '—'}</td>
                      <td className={TD}>{breakPrintTitle(row)}</td>
                      <td className={TD}>{breakPrintFontSize(row)} px</td>
                      <td className={`${TD} text-right`}>
                        <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => openEdit(row)}><Pencil className="size-3.5" /></button>
                        <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Delete" onClick={() => removeBreak(row)}><Trash2 className="size-3.5" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name ? 'Edit break period' : 'Add break period'}>
        {edit && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name of the break">
                <Input value={edit.name ?? ''} placeholder="e.g. First Break" onChange={(e) => {
                  const name = e.target.value
                  setEdit({ ...edit, name, short: edit.shortManuallyEdited === 'Yes' ? edit.short : makeBreakShort(name) })
                }} />
              </Field>
              <Field label="Short" hint="Auto-generated from the break name; edit it to customize. Clear a custom value to resume automatic generation.">
                <Input value={edit.short ?? ''} placeholder={makeBreakShort(String(edit.name ?? '')) || 'Auto-generated'} onChange={(e) => {
                  const short = e.target.value
                  setEdit({
                    ...edit,
                    short: short.trim() ? short : makeBreakShort(String(edit.name ?? '')),
                    shortManuallyEdited: short.trim() ? 'Yes' : '',
                  })
                }} />
              </Field>
              <Field label="Apply to classes" className="sm:col-span-2">
                <div className="grid gap-2 rounded-lg border border-line p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="size-4 accent-lime"
                      checked={edit.applyToAll === 'Yes'}
                      onChange={(e) => setEdit({ ...edit, applyToAll: e.target.checked ? 'Yes' : '' })}
                    />
                    All classes
                  </label>
                  {edit.applyToAll === 'Yes' ? (
                    <p className="text-xs text-mist">This break applies to all {sortedClasses.length} classes.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          className="min-w-[180px] flex-1"
                          aria-label="Search classes"
                          placeholder="Search classes…"
                          value={classSearch}
                          onChange={(e) => setClassSearch(e.target.value)}
                        />
                        <Button size="sm" variant="outline" onClick={() => updateTargetClasses([...editTargets, ...visibleClasses])} disabled={!visibleClasses.length}>Select visible</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateTargetClasses([])} disabled={!editTargets.length}>Clear</Button>
                      </div>
                      <p className="text-[11px] text-mist">{editTargets.length} of {sortedClasses.length} classes selected.</p>
                      <div className="flex max-h-40 flex-wrap items-center gap-x-4 gap-y-2 overflow-y-auto">
                        {visibleClasses.length ? visibleClasses.map((name) => (
                          <label key={name} className="flex items-center gap-2 whitespace-nowrap text-xs">
                            <input
                              type="checkbox"
                              className="size-4 accent-lime"
                              checked={editTargets.includes(name)}
                              onChange={(e) => updateTargetClasses(e.target.checked
                                ? [...editTargets, name]
                                : editTargets.filter((item) => item !== name))}
                            />
                            {name}
                          </label>
                        )) : <p className="text-xs text-mist">No matching classes.</p>}
                      </div>
                    </>
                  )}
                </div>
              </Field>
              <div className="grid grid-cols-12 gap-2 sm:col-span-2">
                <Field label="Break position" className="col-span-6 min-w-0">
                  <Select value={edit.beforePeriodIndex ?? '0'} onChange={(e) => updatePosition(e.target.value)}>
                    {beforePeriods.map(({ period, index }) => (<option key={period} value={String(index)}>Before {period}</option>))}
                  </Select>
                </Field>
                <Field label="Start" className="col-span-3 min-w-0">
                  <Input type="time" className="min-w-0" style={{ minWidth: 0, padding: '8px 4px', fontSize: 12 }} value={edit.startTime ?? ''} onChange={(e) => setEdit({ ...edit, startTime: e.target.value, timeEdited: 'Yes' })} />
                </Field>
                <Field label="End" className="col-span-3 min-w-0">
                  <Input type="time" className="min-w-0" style={{ minWidth: 0, padding: '8px 4px', fontSize: 12 }} value={edit.endTime ?? ''} onChange={(e) => setEdit({ ...edit, endTime: e.target.value, timeEdited: 'Yes' })} />
                </Field>
              </div>
              <div className="grid grid-cols-12 gap-3 sm:col-span-2">
                <Field label="Print Detail label" hint="Used for the vertical break bar in printouts. Clear it to use the selected Full/Short name; the horizontal break row uses the break Name." className="col-span-8 min-w-0">
                  <Input className="min-w-0" value={edit.printText ?? ''} placeholder="Text for printouts" onChange={(e) => {
                  const printText = e.target.value
                  setEdit({ ...edit, printText, printTextCustom: printText.trim() ? 'Yes' : '' })
                }} />
                </Field>
                <Field label="Print label font size" hint="Font size for the vertical label in printouts (6–36 px)." className="col-span-4 min-w-0">
                  <Input type="number" className="min-w-0" min={6} max={36} step={1} value={edit.printFontSize ?? '12'} onChange={(e) => setEdit({ ...edit, printFontSize: e.target.value })} />
                </Field>
              </div>
            </div>
            <p className="text-xs text-mist">Suggested time from adjacent bell periods: {breakTimeRange(cfg, Number(edit.beforePeriodIndex)) || 'No gap available; enter the time manually.'}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveBreak}>Save break</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

/**
 * Timetable Rules — constraints applied by Auto-generate, plus the aSc-style
 * timetable definition: periods per day, number of days, bell times / renamed
 * periods, renamed days, weekend and day-number display options.
 */
export function EduTimetableRulesPage() {
  const { t } = useI18n()
  const toast = useToast()
  const { activeBranchId, branches, staff, users } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name

  const [records, setRecords] = useState(() => loadEduRecords(activeBranchId))
  const [def, setDef] = useState<EduRow>(() => readDef(activeBranchId))
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setDef(readDef(activeBranchId))
    setEdit(null)
    setDel(null)
    setDefModal(null)
  }, [activeBranchId])

  const cfg = loadTtConfig(records)

  const [kind, setKind] = useState<Section>('classRules')
  const [edit, setEdit] = useState<(EduRow & { __kind?: RuleKind }) | null>(null)
  const [del, setDel] = useState<(EduRow & { __kind?: RuleKind }) | null>(null)
  const [defModal, setDefModal] = useState<null | 'periods' | 'days'>(null)
  const [periodEdits, setPeriodEdits] = useState<{ name: string; short: string; time: string; shortManuallyEdited: boolean }[]>([])
  const [dayEdits, setDayEdits] = useState<{ name: string; short: string }[]>([])
  const [toType, setToType] = useState<'Teacher' | 'Class'>('Teacher')
  const [toName, setToName] = useState('')

  // Upgrade legacy range rows to the per-slot availability model, once.
  useEffect(() => {
    const rows = records['timeOff'] ?? []
    const migrated = migrateTimeOffRows(rows, cfg.days, cfg.periods)
    if (migrated === rows) return
    const all = { ...records, timeOff: migrated }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records])

  const rows = kind === 'definition' || kind === 'breaks' ? [] : records[kind] ?? []
  const fields = kind === 'definition' || kind === 'breaks' ? [] : fieldsFor(kind, cfg.days, cfg.periods)

  const persist = (next: EduRow[], k: RuleKind) => {
    const all = { ...records, [k]: next }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }

  const submit = () => {
    if (!edit) return
    const k = edit.__kind ?? (kind as RuleKind)
    const fs = fieldsFor(k, cfg.days, cfg.periods)
    const missing = fs.find((f) => f.required && !String(edit[f.key] ?? '').trim())
    if (missing) {
      toast.error(`${missing.label} is required`)
      return
    }
    const list = records[k] ?? []
    const clean: EduRow = { ...edit }
    delete (clean as { __kind?: RuleKind }).__kind
    const exists = list.some((r) => r.id === edit.id)
    persist(exists ? list.map((r) => (r.id === edit.id ? clean : r)) : [...list, clean], k)
    toast.success(exists ? 'Rule updated' : 'Rule added', String(edit[fs[0].key] || ''))
    setEdit(null)
  }

  // ---- definition (aSc-style timetable setup) ----
  const openPeriodModal = () => {
    const names = splitList(def.periodNames)
    const shorts = splitList(def.periodShorts)
    const bells = splitList(def.bellTimes)
    setPeriodEdits(Array.from({ length: MAX_PERIODS }, (_, i) => {
      const name = names[i] || DEFAULT_PERIOD_NAMES[i]
      const generatedShort = makePeriodShort(name)
      const savedShort = String(shorts[i] ?? '').trim()
      const shortManuallyEdited = !!savedShort && savedShort.toLocaleUpperCase() !== generatedShort
      return {
        name,
        short: shortManuallyEdited ? savedShort : generatedShort,
        shortManuallyEdited,
        time: bells[i] || DEFAULT_BELL_TIMES[i],
      }
    }))
    setDefModal('periods')
  }
  const openDayModal = () => {
    const names = splitList(def.dayNames)
    const shorts = splitList(def.dayShorts)
    setDayEdits(Array.from({ length: MAX_DAYS }, (_, i) => ({
      name: names[i] || DEFAULT_DAY_NAMES[i],
      short: shorts[i] || DEFAULT_DAY_NAMES[i].slice(0, 3),
    })))
    setDefModal('days')
  }
  const savePeriodModal = () => {
    const names = periodEdits.map((p, i) => p.name.trim() || DEFAULT_PERIOD_NAMES[i])
    const shorts = periodEdits.map((p, i) => p.short.trim() || makePeriodShort(names[i]))
    const bells = periodEdits.map((p) => p.time.trim())
    const namesDefault = names.every((n, i) => n === DEFAULT_PERIOD_NAMES[i])
    const shortsDefault = shorts.every((short, i) => short === makePeriodShort(names[i]))
    setDef({
      ...def,
      periodNames: namesDefault ? '' : names.join(' | '),
      periodShorts: shortsDefault ? '' : shorts.join(' | '),
      bellTimes: bells.every((b, i) => b === DEFAULT_BELL_TIMES[i]) ? '' : bells.join(' | '),
    })
    setDefModal(null)
    toast.success('Periods & bell times updated', 'Period short names are generated from the full names unless customized. Remember to save the definition.')
  }
  const saveDayModal = () => {
    const names = dayEdits.map((d) => d.name.trim())
    const shorts = dayEdits.map((d) => d.short.trim())
    const defaultNames = names.every((n, i) => n === DEFAULT_DAY_NAMES[i])
    const defaultShorts = shorts.every((s, i) => s === DEFAULT_DAY_NAMES[i].slice(0, 3))
    setDef({
      ...def,
      dayNames: defaultNames ? '' : names.join(' | '),
      dayShorts: defaultShorts ? '' : shorts.join(' | '),
    })
    setDefModal(null)
    toast.success('Day names updated', 'Remember to save the definition')
  }
  const saveDefinition = () => {
    const all = { ...records, ttConfig: [def] }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
    toast.success('Timetable definition saved', `${def.daysCount} day(s) × ${def.periodsPerDay} period(s) per day — grids and Auto-generate now follow it`)
  }

  // ---- Time Off availability grid (aSc-style) ----
  const toPeople = (() => {
    const teach = new Set<string>()
    const cls = new Set<string>()
    ;(records['staffList'] ?? []).forEach((s) => s.name && teach.add(s.name))
    staff
      .filter((employee) => (!employee.branchId || employee.branchId === activeBranchId)
        && (employee.staffType === 'teacher' || employee.staffCategory?.trim().toLocaleLowerCase() === 'teaching'))
      .forEach((employee) => {
        const name = users.find((account) => account.id === employee.userId)?.name?.trim()
        if (name) teach.add(name)
      })
    ;(records['classTimetable'] ?? []).forEach((l) => {
      if (l.teacher) teach.add(l.teacher)
      if (l.className) cls.add(l.className)
    })
    ;(records['classList'] ?? []).forEach((c) => {
      const label = [c.name, c.section].filter(Boolean).join(' ')
      if (label) cls.add(label)
    })
    ;(records['timeOff'] ?? []).forEach((r) => (r.whoType === 'Class' ? cls : teach).add(r.name))
    return { teachers: [...teach].sort(), classes: [...cls].sort() }
  })()
  const toOptions = toType === 'Teacher' ? toPeople.teachers : toPeople.classes
  const toWho = toName && toOptions.includes(toName) ? toName : toOptions[0] ?? ''
  const toRow = (records['timeOff'] ?? []).find((r) => r.whoType === toType && r.name === toWho)
  const toLessons = (records['classTimetable'] ?? []).filter((l) =>
    toType === 'Teacher' ? l.teacher === toWho : l.className === toWho,
  )

  const saveToRows = (next: EduRow[]) => {
    const all = { ...records, timeOff: next }
    setRecords(all)
    saveEduRecords(activeBranchId, all)
  }
  const setSlotState = (day: string, period: string, state: SlotState) => {
    if (!toWho) return
    const next = withSlot(toRow, toType, toWho, day, period, state)
    saveToRows(toRow ? (records['timeOff'] ?? []).map((r) => (r.id === toRow.id ? next : r)) : [...(records['timeOff'] ?? []), next])
  }
  const cycleSlot = (day: string, period: string, dir: 1 | -1) => {
    const order: SlotState[] = ['ok', 'blocked', 'conditional']
    const cur = stateOf(toRow, day, period)
    setSlotState(day, period, order[(order.indexOf(cur) + dir + order.length) % order.length])
  }
  const clearPerson = () => {
    if (!toRow) return
    saveToRows((records['timeOff'] ?? []).filter((r) => r.id !== toRow.id))
    toast.success('Time off cleared', toWho)
  }
  const blockedCount = toRow ? (toRow.blocked ?? '').split(';').filter((s) => s.trim()).length : 0
  const condCount = toRow ? (toRow.conditional ?? '').split(';').filter((s) => s.trim()).length : 0

  const sections: { id: Section; label: string }[] = [
    { id: 'classRules', label: t('nav.eduClassRules') },
    { id: 'teacherRules', label: t('nav.eduTeacherRules') },
    { id: 'timeOff', label: t('nav.eduTimeOff') },
    { id: 'constraints', label: t('nav.eduConstraints') },
    { id: 'definition', label: t('nav.eduTtDefinition') },
    { id: 'breaks', label: 'Breaks' },
  ]

  const defaultFor = (k: RuleKind): Partial<EduRow> =>
    k === 'timeOff'
      ? { whoType: 'Teacher', day: cfg.days[0] ?? '', from: cfg.periods[0] ?? '', to: cfg.periods[0] ?? '' }
      : k === 'constraints'
        ? { kind: 'teacherConsec', target: '', value: '3' }
        : {}

  const checkbox = (checked: boolean, onChange: (v: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-lime" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>Timetable</span>
        <span>/</span><span className="font-semibold text-inherit">{t('nav.eduTimetableRules')}</span>
      </div>
      <PageHeader
        title={t('nav.eduTimetableRules')}
        desc={`${branchName ?? 'Branch'} · Rules and timetable definition applied when the timetable is auto-generated.`}
      />

      {/* Section bar — same format as the System settings category bar */}
      <div className="settings-catbar segmented-shell mb-4 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line bg-white p-1 dark:bg-ink-2">
        {sections.map((sct) => (
          <button
            key={sct.id}
            type="button"
            onClick={() => setKind(sct.id)}
            aria-current={sct.id === kind ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-bold transition',
              sct.id === kind
                ? 'bg-lime text-lime-ink'
                : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
            )}
          >
            {sct.label}
          </button>
        ))}
      </div>

      {kind === 'definition' ? (
        <div className="grid gap-4 lg:max-w-3xl">
          <div className="card">
            <div className="border-b border-line p-3">
              <p className="flex items-center gap-2 text-sm font-bold"><CalendarDays className="size-4" /> Timetable for days of week</p>
            </div>
            <div className="grid gap-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Periods per day" className="w-40">
                  <Select value={def.periodsPerDay} onChange={(e) => setDef({ ...def, periodsPerDay: e.target.value })}>
                    {Array.from({ length: MAX_PERIODS }, (_, i) => i + 1).map((n) => (<option key={n} value={String(n)}>{n}</option>))}
                  </Select>
                </Field>
                <Button variant="outline" size="sm" className="mt-4" onClick={openPeriodModal}><Pencil className="size-3.5" /> Bell times / Rename periods</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Field label="Number of days" className="w-40">
                  <Select value={def.daysCount} onChange={(e) => setDef({ ...def, daysCount: e.target.value })}>
                    {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => (<option key={n} value={String(n)}>{n}</option>))}
                  </Select>
                </Field>
                <Button variant="outline" size="sm" className="mt-4" onClick={openDayModal}><Pencil className="size-3.5" /> Rename days</Button>
              </div>
              {checkbox(def.workZeroPeriods === 'Yes', (v) => setDef({ ...def, workZeroPeriods: v ? 'Yes' : '' }), 'Work with zero periods')}
              {checkbox(def.showDayNumbers === 'Yes', (v) => setDef({ ...def, showDayNumbers: v ? 'Yes' : '' }), 'Show day number instead of day name (e.g. Day 1 instead of Monday)')}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Weekend" className="min-w-0">
                  <Select value={def.weekend} onChange={(e) => setDef({ ...def, weekend: e.target.value })}>
                    {WEEKEND_OPTIONS.map((w) => (<option key={w} value={w}>{w}</option>))}
                  </Select>
                </Field>
                <Field label="Teacher name display" hint="Short uses the HR short name, or initials if no short name is set.">
                  <Select value={def.teacherNameDisplay || 'full'} onChange={(e) => setDef({ ...def, teacherNameDisplay: e.target.value })}>
                    <option value="full">Full name</option>
                    <option value="short">Short name</option>
                  </Select>
                </Field>
                <Field label="Classroom name display" hint="Short uses the classroom's saved Short value, or an abbreviation.">
                  <Select value={def.classroomNameDisplay || 'full'} onChange={(e) => setDef({ ...def, classroomNameDisplay: e.target.value })}>
                    <option value="full">Full name</option>
                    <option value="short">Short name</option>
                  </Select>
                </Field>
                <Field label="Subject name display" hint="Short uses Short name or initials.">
                  <Select value={def.subjectNameDisplay || 'full'} onChange={(e) => setDef({ ...def, subjectNameDisplay: e.target.value })}>
                    <option value="full">Full name</option>
                    <option value="short">Short name</option>
                  </Select>
                </Field>
                <Field label="Break name display" hint="Full/Short controls break and period names in print. A custom Print Detail label overrides the vertical break bar; the horizontal break row and timetable grids use the break Name.">
                  <Select value={def.breakNameDisplay || 'full'} onChange={(e) => setDef({ ...def, breakNameDisplay: e.target.value })}>
                    <option value="full">Full name</option>
                    <option value="short">Short name</option>
                  </Select>
                </Field>
                <Field label="Period names in print" hint="Linked to Break name display; changing either setting updates both.">
                  <Select value={def.breakNameDisplay || 'full'} onChange={(e) => setDef({ ...def, breakNameDisplay: e.target.value })}>
                    <option value="full">Full name</option>
                    <option value="short">Short name</option>
                  </Select>
                </Field>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold">Break visibility</p>
                <p className="mt-1 text-xs text-mist">This setting shows or hides configured breaks on class timetable grids and printouts.</p>
                <div className="mt-3">
                  {checkbox(def.showBreaks !== 'No', (v) => setDef({ ...def, showBreaks: v ? 'Yes' : 'No' }), 'Show breaks')}
                </div>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold">Print timetable content</p>
                <p className="mt-1 text-xs text-mist">Choose which lesson details appear in print layouts. The selected class, teacher or room heading remains visible.</p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {checkbox(def.printShowClassroom !== 'No', (v) => setDef({ ...def, printShowClassroom: v ? 'Yes' : 'No' }), 'Show classroom')}
                  {checkbox(def.printShowTeacher !== 'No', (v) => setDef({ ...def, printShowTeacher: v ? 'Yes' : 'No' }), 'Show teacher')}
                  {checkbox(def.printShowSubject !== 'No', (v) => setDef({ ...def, printShowSubject: v ? 'Yes' : 'No' }), 'Show subject')}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="border-b border-line p-3">
              <p className="flex items-center gap-2 text-sm font-bold"><CalendarRange className="size-4" /> Weeks / Terms</p>
            </div>
            <div className="grid gap-2 p-4">
              {checkbox(def.multiTerm === 'Yes', (v) => setDef({ ...def, multiTerm: v ? 'Yes' : '' }), 'I want to create multi term or multi-week timetable that will be different in each week or term')}
              <p className="text-xs text-mist">The definition is stored with this branch and used by the Class, Teacher and Room grids, prints and Auto-generate.</p>
            </div>
          </div>

          <div>
            <Button onClick={saveDefinition}>Save definition</Button>
          </div>
        </div>
      ) : kind === 'breaks' ? (
        <ClassBreaksSection key={activeBranchId} activeBranchId={activeBranchId} records={records} setRecords={setRecords} classes={toPeople.classes} cfg={cfg} />
      ) : kind === 'timeOff' ? (
        <div className="card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <Field label="Who" className="w-32">
              <Select value={toType} onChange={(e) => { setToType(e.target.value as 'Teacher' | 'Class'); setToName('') }}>
                <option value="Teacher">Teacher</option>
                <option value="Class">Class</option>
              </Select>
            </Field>
            <Field label="Name" className="w-56">
              <Select value={toWho} onChange={(e) => setToName(e.target.value)}>
                {toOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
              </Select>
            </Field>
            <p className="text-xs text-mist">{blockedCount} inappropriate · {condCount} conditional</p>
            <div className="ml-auto">
              <Button size="sm" variant="outline" onClick={clearPerson} disabled={!toRow}><Trash2 className="size-4" /> Clear for {toWho || '…'}</Button>
            </div>
          </div>

          {!toWho ? (
            <div className="p-6"><Empty title="No teachers or classes yet" desc="Add staff or classes first, then set their availability here." /></div>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="w-full min-w-[720px] border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-24 rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">Day</th>
                    {cfg.periods.map((p, pi) => (
                      <th key={p} className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">{cfg.shortPeriods[pi] || p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfg.days.map((d, di) => (
                    <tr key={d}>
                      <td className="rounded-lg border border-line bg-black/[0.02] px-2 py-2 text-[11px] font-bold dark:bg-white/[0.03]">{cfg.showDayNumbers ? `Day ${di + 1}` : (cfg.shortDays[di] ?? d)}</td>
                      {cfg.periods.map((p) => {
                        const st = stateOf(toRow, d, p)
                        const hasLesson = toLessons.some((l) => l.day === d && l.period === p)
                        return (
                          <td key={p} className="p-0">
                            <button
                              type="button"
                              onClick={() => cycleSlot(d, p, 1)}
                              onContextMenu={(e) => { e.preventDefault(); cycleSlot(d, p, -1) }}
                              title={`${d} ${p} — left click: appropriate → inappropriate → conditional; right click reverses`}
                              className={cn(
                                'flex h-11 w-full min-w-[52px] items-center justify-center rounded-lg border border-line/60 transition hover:border-line',
                                hasLesson ? 'bg-black/10 dark:bg-white/10' : 'bg-transparent',
                              )}
                            >
                              {st === 'blocked' ? (
                                <X className="size-4 text-rose-600 dark:text-rose-400" aria-label="Inappropriate" />
                              ) : st === 'conditional' ? (
                                <HelpCircle className="size-4 text-sky-600 dark:text-sky-400" aria-label="Conditional" />
                              ) : (
                                <Check className="size-4 text-lime-600 dark:text-lime-400" aria-label="Appropriate" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-mist">
                <span className="flex items-center gap-1.5"><Check className="size-4 text-lime-600 dark:text-lime-400" /> Appropriate</span>
                <span className="flex items-center gap-1.5"><HelpCircle className="size-4 text-sky-600 dark:text-sky-400" /> Conditional (used only if nothing else fits)</span>
                <span className="flex items-center gap-1.5"><X className="size-4 text-rose-600 dark:text-rose-400" /> Inappropriate</span>
              </div>
              <p className="mt-1 text-xs text-mist">Use left and right mouse buttons to set. The gray background shows the actual timetable. Auto-generate never places lessons on inappropriate slots and avoids conditional ones.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
            <p className="text-sm font-bold">{sections.find((s) => s.id === kind)?.label}</p>
            <Button size="sm" onClick={() => setEdit({ ...defaultFor(kind as RuleKind), id: uid(), __kind: kind as RuleKind })}>
              <Plus className="size-4" /> {kind === 'constraints' ? 'Add constraint' : 'Add rule'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className={THEAD}>
                  {fields.map((f) => (<th key={f.key} className={TH}>{f.label}</th>))}
                  <th className={`${TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    {fields.map((f) => (
                      <td key={f.key} className={`${TD} ${f.key === 'className' || f.key === 'teacher' || f.key === 'name' ? 'font-semibold' : ''}`}>
                        {f.key === 'kind'
                          ? kindLabel(String(r[f.key] ?? ''))
                          : String(r[f.key] ?? '').trim() ? String(r[f.key]) : '—'}
                      </td>
                    ))}
                    <td className={`${TD} text-right`}>
                      <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Edit" onClick={() => setEdit({ ...r, __kind: kind as RuleKind })}><Pencil className="size-3.5" /></button>
                      <button className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Delete" onClick={() => setDel({ ...r, __kind: kind as RuleKind })}><Trash2 className="size-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty title="No rules yet" desc="Add a rule to constrain automatic timetable generation." />}
          </div>
        </div>
      )}

      {/* Rule modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={(records[edit?.__kind ?? (kind as RuleKind)] ?? []).some((r) => r.id === edit?.id) ? 'Edit rule' : 'Add rule'}>
        {edit && (
          <div className="grid gap-3">
            {fieldsFor(edit.__kind ?? (kind as RuleKind), cfg.days, cfg.periods).map((f) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.type === 'select' ? (
                  <Select value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} placeholder="Select…">
                    {(f.options ?? []).map((o) => {
                      const v = typeof o === 'string' ? o : o.value
                      const l = typeof o === 'string' ? o : o.label
                      return <option key={v} value={v}>{l}</option>
                    })}
                  </Select>
                ) : (
                  <Input type={f.type === 'number' ? 'number' : 'text'} value={String(edit[f.key] ?? '')} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit}>Save rule</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete rule modal */}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete rule?">
        {del && (
          <>
            <p className="text-sm text-mist">
              Delete the rule for <span className="font-semibold text-inherit">{String(del[fieldsFor(del.__kind ?? (kind as RuleKind), cfg.days, cfg.periods)[0].key] || 'this entry')}</span>? Auto-generate will no longer apply it.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { const k = del.__kind ?? (kind as RuleKind); persist((records[k] ?? []).filter((r) => r.id !== del.id), k); toast.success('Rule deleted'); setDel(null) }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Bell times / rename periods */}
      <Modal open={defModal === 'periods'} onClose={() => setDefModal(null)} title="Bell times / Rename periods">
        <div className="grid gap-2">
          <div className="grid grid-cols-[24px_minmax(0,1fr)_64px_minmax(0,1fr)] gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-mist sm:grid-cols-[24px_minmax(0,1.4fr)_80px_minmax(0,1fr)]">
            <span />
            <span>Period name</span>
            <span>Short</span>
            <span>Bell time</span>
          </div>
          {periodEdits.map((p, i) => (
            <div key={i} className="grid grid-cols-[24px_minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[24px_minmax(0,1.4fr)_80px_minmax(0,1fr)]">
              <span className="text-xs font-bold text-mist">{i + 1}</span>
              <Input className="min-w-0" aria-label={`Period ${i + 1} name`} value={p.name} onChange={(e) => {
                const name = e.target.value
                setPeriodEdits(periodEdits.map((x, xi) => (xi === i ? { ...x, name, short: x.shortManuallyEdited ? x.short : makePeriodShort(name) } : x)))
              }} placeholder={`Period ${i + 1}`} />
              <Input className="min-w-0" aria-label={`Period ${i + 1} short name`} value={p.short} onChange={(e) => {
                const short = e.target.value
                setPeriodEdits(periodEdits.map((x, xi) => (xi === i ? { ...x, short: short.trim() ? short : makePeriodShort(x.name), shortManuallyEdited: !!short.trim() } : x)))
              }} placeholder={makePeriodShort(p.name)} />
              <Input className="min-w-0" aria-label={`Period ${i + 1} bell time`} value={p.time} onChange={(e) => setPeriodEdits(periodEdits.map((x, xi) => (xi === i ? { ...x, time: e.target.value } : x)))} placeholder="08:00 – 08:45" />
            </div>
          ))}
          <p className="text-xs text-mist">Short names auto-generate from the period name and keep updating until manually customized. The first “Periods per day” entries are used. Breaks remain separate and do not count as periods.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={savePeriodModal}>Apply</Button>
            <Button variant="ghost" onClick={() => setDefModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Rename days */}
      <Modal open={defModal === 'days'} onClose={() => setDefModal(null)} title="Rename days">
        <div className="grid gap-2">
          {dayEdits.map((d, i) => (
            <div key={i} className="grid grid-cols-[24px_1fr_90px] items-center gap-2">
              <span className="text-xs font-bold text-mist">{i + 1}</span>
              <Input value={d.name} onChange={(e) => setDayEdits(dayEdits.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))} placeholder={DEFAULT_DAY_NAMES[i]} />
              <Input value={d.short} onChange={(e) => setDayEdits(dayEdits.map((x, xi) => (xi === i ? { ...x, short: e.target.value } : x)))} placeholder={DEFAULT_DAY_NAMES[i].slice(0, 3)} />
            </div>
          ))}
          <p className="text-xs text-mist">Short names appear in the timetable headers and prints; the first “Number of days” entries are used everywhere a day appears.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={saveDayModal}>Apply</Button>
            <Button variant="ghost" onClick={() => setDefModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

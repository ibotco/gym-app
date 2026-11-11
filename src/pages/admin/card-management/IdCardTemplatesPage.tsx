/**
 * ID Card Templates — design the front and back of the card: school branding,
 * which student fields appear, photo style, QR / barcode and print layout.
 * Every change is previewed live at true card size.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, ImagePlus, Layers, Plus, Save, ShieldAlert, Star, Trash2, Upload } from 'lucide-react'
import { IdCardFace } from '../../../components/IdCardSheet'
import { Button, Field, Input, Modal, PageHeader, Select, Switch, Textarea } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import {
  DEFAULT_ID_CARD_TEMPLATE,
  ID_CARD_BACK_FIELDS,
  ID_CARD_FRONT_FIELDS,
  idCardTemplateRow,
  ID_CARD_SIZE_PRESETS,
  ID_CARD_CUSTOM_SIZE,
  ID_CARD_PHOTO_POSITIONS,
  ID_CARD_SIZE_LIMITS,
  clampCardSize,
  sizePresetLabel,
  ID_CARD_QR_POSITIONS,
  ID_CARD_FONT_FAMILIES,
  ID_CARD_FONT_SCALES,
  ID_CARD_LABEL_CASES,
  ID_CARD_BACKGROUND_FITS,
  CARD_FIELDS,
  CARD_HOLDER_TYPES,
  readIdCard,
  defaultCardFields,
  type CardHolderType,
  type IdCardTemplate,
  type IdCardPhotoPosition,
  type IdCardQrPosition,
} from '../../../lib/eduIdCards'
import { fileToCardBackgroundDataUrl, validateCardBackgroundFile } from '../../../lib/image'
import { uid } from '../../../lib/utils'
import type { EduRow } from '../../../lib/eduRecords'
import { useIdCardContext } from './IdCardShared'

const SIZE_PRESETS = ID_CARD_SIZE_PRESETS
/** Live preview magnifications — 100% is the true printed size. */
const PREVIEW_ZOOMS = [1, 1.5, 2, 3]

const blankTemplate = (): IdCardTemplate => ({
  ...DEFAULT_ID_CARD_TEMPLATE,
  id: '',
  name: '',
  schoolName: '',
})

const FieldToggle = ({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (next: boolean) => void }) => (
  <label className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs dark:border-white/10">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-3.5 accent-lime" />
    <span className="truncate">{label}</span>
  </label>
)

/** Import, preview and clear one face's background artwork. */
const BackgroundImageInput = ({
  label, hint, value, disabled, onChange,
}: {
  label: string
  hint: string
  value: string
  disabled: boolean
  onChange: (dataUrl: string) => void
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const toast = useToast()

  const pick = async (file: File | undefined) => {
    if (!file) return
    const problem = validateCardBackgroundFile(file)
    if (problem) { toast.error('Image not accepted', problem); return }
    try {
      const dataUrl = await fileToCardBackgroundDataUrl(file)
      if (dataUrl.length > 2_500_000) {
        toast.error('Image too large', 'Even after compressing it is over 2 MB. Try a smaller or simpler image.')
        return
      }
      onChange(dataUrl)
      toast.success('Background imported', `${label} updated.`)
    } catch (error) {
      toast.error('Could not import image', error instanceof Error ? error.message : 'Unknown error.')
    }
  }

  return (
    <div className="rounded-xl border border-line p-3 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11px] text-mist">{hint}</p>
        </div>
        {value && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] text-rose hover:border-rose/50 disabled:opacity-50 dark:border-white/10"
            onClick={() => onChange('')}
            disabled={disabled}
          >
            <Trash2 className="size-3" /> Remove
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="grid size-16 flex-none place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-white/70 dark:border-white/10 dark:bg-white/5">
          {value
            ? <img src={value} alt="" className="size-full object-cover" />
            : <ImagePlus className="size-5 text-mist/70" aria-hidden />}
        </div>
        <div className="min-w-0">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> {value ? 'Replace image' : 'Import image'}
          </Button>
          <p className="mt-1 text-[11px] text-mist">JPG, PNG or WebP · up to 8 MB · resized to 1200 px</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            void pick(file)
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

export function IdCardTemplatesPage() {
  const { records, templates, school, students, holders, can, patch } = useIdCardContext()
  const toast = useToast()
  const allowed = can('configure')

  const [draft, setDraft] = useState<IdCardTemplate>(() => ({
    ...blankTemplate(),
    ...(templates[0] ?? {}),
  }))
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '')
  const [confirmDelete, setConfirmDelete] = useState<IdCardTemplate | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const current = templates.find((template) => template.id === selectedId) ?? templates[0]
    setDraft(current ? { ...current } : blankTemplate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, templates.length])

  const settingsRow = (records.idCardSettings ?? [])[0]
  const defaultId = String(settingsRow?.defaultTemplateId ?? '').trim() || templates[0]?.id || ''

  const set = <K extends keyof IdCardTemplate>(key: K, value: IdCardTemplate[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  /** Typing a size moves the template to “Custom size…” unless it matches a preset. */
  const setSize = (widthMm: number, heightMm: number) => {
    const size = clampCardSize(widthMm, heightMm)
    setDraft((current) => ({
      ...current,
      widthMm: size.widthMm,
      heightMm: size.heightMm,
      sizePreset: sizePresetLabel(size.widthMm, size.heightMm),
    }))
  }

  /* Switching holder type changes which fields even make sense, so start the
   * template from that type's defaults. */
  const setHolderType = (next: CardHolderType) => {
    if (next === draft.holderType) return
    const defaults = defaultCardFields(next)
    setDraft((current) => ({ ...current, holderType: next, frontFields: [...defaults.front], backFields: [...defaults.back] }))
  }

  const toggleField = (side: 'frontFields' | 'backFields', key: string) =>
    setDraft((current) => {
      const list = current[side]
      return { ...current, [side]: list.includes(key) ? list.filter((item) => item !== key) : [...list, key] }
    })

  /* The preview shows a real person of this template's holder type, falling back
   * to a sensible example when the branch has nobody of that kind yet. */
  const sampleCard = useMemo(() => {
    const type = draft.holderType
    const holder = holders.find((item) => item.holderType === type) ?? holders[0]
    const example: Record<CardHolderType, Record<string, string>> = {
      Student: {
        holder: 'Ama Owusu', admissionNo: 'ADM-001', className: 'Basic 7 A', section: 'Section A',
        house: 'Aggrey House', rollNo: '1', guardian: 'Kofi Owusu', gender: 'Female',
        dateOfBirth: '2013-04-12',
      },
      Staff: {
        holder: 'Grace Adjei', employeeNo: 'EMP-014', department: 'Administration',
        designation: 'Senior Administrator', gender: 'Female', dateOfBirth: '1988-03-22',
        joinDate: '2019-09-02',
      },
      Member: {
        holder: 'Daniel Nartey', membershipNo: 'MEM-0231', plan: 'Annual Fitness',
        gender: 'Male', dateOfBirth: '1994-11-09', joinDate: '2025-01-15',
      },
    }
    const fallback = example[type]
    const row: EduRow = {
      id: 'preview',
      cardNo: `${draft.cardNoPrefix || 'IDC'}-2026-0001`,
      holderType: type,
      holderId: holder?.id ?? '',
      holder: holder?.name ?? fallback.holder,
      student: holder?.name ?? fallback.holder,
      admissionNo: holder?.holderType === 'Student' ? holder.reference : (fallback.admissionNo ?? ''),
      employeeNo: holder?.holderType === 'Staff' ? holder.reference : (fallback.employeeNo ?? ''),
      membershipNo: holder?.holderType === 'Member' ? holder.reference : (fallback.membershipNo ?? ''),
      className: holder?.className ?? fallback.className ?? '',
      section: holder?.section ?? fallback.section ?? '',
      house: holder?.house ?? fallback.house ?? '',
      department: holder?.department ?? fallback.department ?? '',
      designation: holder?.designation ?? fallback.designation ?? '',
      plan: holder?.plan ?? fallback.plan ?? '',
      joinDate: holder?.joinDate ?? fallback.joinDate ?? '',
      gender: holder?.gender ?? fallback.gender ?? '',
      dateOfBirth: holder?.dateOfBirth ?? fallback.dateOfBirth ?? '',
      academicYear: '2026/2027',
      photo: holder?.photo ?? '',
      rollNo: holder?.rollNo ?? fallback.rollNo ?? '',
      guardian: holder?.guardian ?? fallback.guardian ?? '',
      phone: holder?.phone ?? '020 111 0001',
      templateId: draft.id,
      templateName: draft.name,
      status: 'Issued',
      issueDate: '2026-09-15',
      expiryDate: '2027-09-15',
      issuedBy: '',
      printCount: '0',
      lastPrintedAt: '',
      previousCardNo: '',
      replacementReason: '',
      replacementDate: '',
      remarks: '',
    }
    return readIdCard(row)
  }, [draft.cardNoPrefix, draft.id, draft.name, draft.holderType, holders, students])

  const save = (asNew = false) => {
    if (!draft.name.trim()) { toast.error('Name required', 'Give the template a name before saving.'); return }
    const id = asNew ? uid('idctpl') : (draft.id || uid('idctpl'))
    const row = idCardTemplateRow({ ...draft, id })
    const rows = templates.map(idCardTemplateRow)
    const existing = rows.find((item) => item.id === id)
    const next = asNew || !existing ? [...rows, row] : rows.map((item) => (item.id === id ? row : item))
    patch({ idCardTemplates: next })
    setSelectedId(id)
    setDraft({ ...draft, id })
    toast.success(asNew ? 'Template created' : 'Template saved', `${draft.name} is ready to use for card generation.`)
  }

  const setDefault = (id: string) => {
    patch({ idCardSettings: [{ ...(settingsRow ?? {}), id: settingsRow?.id ?? 'idcard-settings', defaultTemplateId: id }] })
    toast.success('Default template set', 'New cards use this template unless another is chosen.')
  }

  const remove = (template: IdCardTemplate) => {
    patch({ idCardTemplates: templates.filter((item) => item.id !== template.id).map(idCardTemplateRow) })
    setConfirmDelete(null)
    if (selectedId === template.id) { setSelectedId(''); setDraft(blankTemplate()) }
    toast.success('Template deleted', `${template.name} removed.`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Card Management"
        title="ID Card Templates"
        desc="Design the front and back of an ID card for students, staff or members — branding, which fields appear, photo style, QR / barcode and print layout."
        printTitle="ID Card Templates"
        actions={allowed ? (
          <>
            <Button size="sm" variant="outline" onClick={() => { setSelectedId(''); setDraft(blankTemplate()) }}>
              <Plus className="size-4" /> New
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(true)} disabled={!draft.name.trim()}>
              <Copy className="size-4" /> Save as new
            </Button>
            <Button size="sm" onClick={() => save(false)}><Save className="size-4" /> Save template</Button>
          </>
        ) : undefined}
      />

      {!allowed && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="size-4" /> Your role can view templates but not change them. Ask an administrator for the “Configure templates” permission.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,16rem)_1fr]">
        {/* Template list */}
        <section className="rounded-2xl border border-line bg-white/60 p-3 dark:bg-white/5">
          <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold"><Layers className="size-4 text-lime" /> Templates</h2>
          <ul className="space-y-1.5">
            {templates.map((template) => (
              <li key={template.id}>
                <div className={`rounded-xl border px-2.5 py-2 ${template.id === selectedId ? 'border-lime bg-lime/5' : 'border-line dark:border-white/10'}`}>
                  <button type="button" className="w-full text-left" onClick={() => setSelectedId(template.id)}>
                    <p className="truncate text-sm font-semibold">{template.name}</p>
                    <p className="text-[11px] text-mist">
                      {template.orientation} · {template.widthMm} × {template.heightMm} mm ·{' '}
                      {ID_CARD_FONT_FAMILIES.find((font) => font.id === template.fontFamily)?.label ?? 'Sans'} ·{' '}
                      {Math.round(template.fontScale * 100)}% · {template.status}
                    </p>
                  </button>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-md px-1.5 py-0.5 text-[11px] hover:bg-black/5 dark:hover:bg-white/10"
                      title="Use by default for new cards"
                      onClick={() => setDefault(template.id)}
                    >
                      <Star className={`inline size-3 ${template.id === defaultId ? 'fill-current text-amber-500' : ''}`} /> Default
                    </button>
                    {allowed && (
                      <button
                        type="button"
                        className="rounded-md px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                        onClick={() => setConfirmDelete(template)}
                      >
                        <Trash2 className="inline size-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {!templates.length && <li className="px-1 text-sm text-mist">No templates yet — save the design on the right to create one.</li>}
          </ul>
        </section>

        {/* Editor + preview */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Template name" required>
                <Input value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Basic School 2026/27" disabled={!allowed} />
              </Field>
              <Field label="Card holder type" hint="Who this template issues cards to — sets the source, fields and labels">
                  <Select value={draft.holderType} onChange={(event) => setHolderType(event.target.value as CardHolderType)} disabled={!allowed}>
                    {CARD_HOLDER_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
                  </Select>
                </Field>
                <Field label="Status">
                <Select value={draft.status} onChange={(event) => set('status', event.target.value)} disabled={!allowed}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
              <Field label="Orientation">
                <Select value={draft.orientation} onChange={(event) => set('orientation', event.target.value as IdCardTemplate['orientation'])} disabled={!allowed}>
                  <option value="Landscape">Landscape</option>
                  <option value="Portrait">Portrait</option>
                </Select>
              </Field>
              <Field label="Card size" hint="Pick a preset or choose Custom size… and type the millimetres">
                <Select
                  value={draft.sizePreset}
                  onChange={(event) => {
                    const preset = SIZE_PRESETS.find((item) => item.label === event.target.value)
                    if (preset) {
                      setDraft((current) => ({
                        ...current,
                        sizePreset: preset.label,
                        widthMm: preset.widthMm,
                        heightMm: preset.heightMm,
                      }))
                    } else {
                      set('sizePreset', ID_CARD_CUSTOM_SIZE)
                    }
                  }}
                  disabled={!allowed}
                >
                  {SIZE_PRESETS.map((preset) => (<option key={preset.label} value={preset.label}>{preset.label}</option>))}
                  <option value={ID_CARD_CUSTOM_SIZE}>{ID_CARD_CUSTOM_SIZE}</option>
                </Select>
              </Field>
              <Field label="Width (mm)">
                <Input
                  type="number"
                  min={ID_CARD_SIZE_LIMITS.minWidth}
                  max={ID_CARD_SIZE_LIMITS.maxWidth}
                  step={0.1}
                  value={draft.widthMm}
                  onChange={(event) => setSize(Number(event.target.value), draft.heightMm)}
                  disabled={!allowed}
                />
              </Field>
              <Field label="Height (mm)">
                <Input
                  type="number"
                  min={ID_CARD_SIZE_LIMITS.minHeight}
                  max={ID_CARD_SIZE_LIMITS.maxHeight}
                  step={0.1}
                  value={draft.heightMm}
                  onChange={(event) => setSize(draft.widthMm, Number(event.target.value))}
                  disabled={!allowed}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(['backgroundColor', 'headerColor', 'textColor', 'accentColor'] as const).map((key) => (
                <Field key={key} label={key.replace('Color', ' colour').replace(/^./, (letter) => letter.toUpperCase())}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft[key]}
                      onChange={(event) => set(key, event.target.value)}
                      disabled={!allowed}
                      className="h-9 w-10 rounded-lg border border-line bg-transparent p-0.5 dark:border-white/10"
                      aria-label={key}
                    />
                    <Input value={draft[key]} onChange={(event) => set(key, event.target.value)} disabled={!allowed} className="font-mono text-xs" />
                  </div>
                </Field>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="School name" hint={`Blank uses “${school.name}”`}>
                <Input value={draft.schoolName} onChange={(event) => set('schoolName', event.target.value)} placeholder={school.name} disabled={!allowed} />
              </Field>
              <Field label="Motto" hint="Printed on the back">
                <Input value={draft.motto} onChange={(event) => set('motto', event.target.value)} placeholder="e.g. Knowledge, Truth and Service" disabled={!allowed} />
              </Field>
              <Field label="Address" hint={`Blank uses “${school.address}”`}>
                <Input value={draft.address} onChange={(event) => set('address', event.target.value)} placeholder={school.address} disabled={!allowed} />
              </Field>
              <Field label="Contact details" hint={`Blank uses “${school.contact}”`}>
                <Input value={draft.contact} onChange={(event) => set('contact', event.target.value)} placeholder={school.contact} disabled={!allowed} />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Card number prefix" hint="Card numbers run PREFIX-YEAR-0001">
                <Input value={draft.cardNoPrefix} onChange={(event) => set('cardNoPrefix', event.target.value.toUpperCase())} disabled={!allowed} />
              </Field>
              <Field label="Validity (months)">
                <Input type="number" min={1} max={120} value={draft.validityMonths} onChange={(event) => set('validityMonths', Number(event.target.value) || 12)} disabled={!allowed} />
              </Field>
              <Field label="Print layout">
                <Select value={draft.printLayout} onChange={(event) => set('printLayout', event.target.value as IdCardTemplate['printLayout'])} disabled={!allowed}>
                  <option value="PVC Card">PVC card (one per page)</option>
                  <option value="A4 Sheet">A4 sheet (grid)</option>
                </Select>
              </Field>
              <Field label="Cards per row (A4)">
                <Input type="number" min={1} max={4} value={draft.cardsPerRow} onChange={(event) => set('cardsPerRow', Number(event.target.value) || 2)} disabled={!allowed} />
              </Field>
              <Field label="Font" hint="Applied to the whole card">
                <Select value={draft.fontFamily} onChange={(event) => set('fontFamily', event.target.value)} disabled={!allowed}>
                  {ID_CARD_FONT_FAMILIES.map((font) => (<option key={font.id} value={font.id}>{font.label}</option>))}
                </Select>
              </Field>
              <Field label="Text size" hint="Scales every size on the card">
                <Select value={String(draft.fontScale)} onChange={(event) => set('fontScale', Number(event.target.value) || 1)} disabled={!allowed}>
                  {ID_CARD_FONT_SCALES.map((option) => (<option key={option.value} value={String(option.value)}>{option.label}</option>))}
                </Select>
              </Field>
              <Field label="Field labels" hint="How the detail labels read">
                <Select value={draft.labelCase} onChange={(event) => set('labelCase', event.target.value)} disabled={!allowed}>
                  {ID_CARD_LABEL_CASES.map((option) => (<option key={option} value={option}>{option}</option>))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
              <h2 className="mb-2 text-sm font-semibold">Front layout</h2>
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs"><Switch checked={draft.showLogo} onChange={(value) => set('showLogo', value)} disabled={!allowed} /> School logo</label>
                <label className="flex items-center gap-2 text-xs"><Switch checked={draft.showPhoto} onChange={(value) => set('showPhoto', value)} disabled={!allowed} /> Photo</label>
                <div className="flex items-center gap-2 text-xs">
                  <span>Photo position</span>
                  <Select
                    value={draft.photoPosition}
                    onChange={(event) => set('photoPosition', event.target.value as IdCardPhotoPosition)}
                    disabled={!allowed}
                  >
                    {ID_CARD_PHOTO_POSITIONS.map((position) => (<option key={position} value={position}>{position}</option>))}
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span>Photo style</span>
                  <Select value={draft.photoStyle} onChange={(event) => set('photoStyle', event.target.value as IdCardTemplate['photoStyle'])} disabled={!allowed}>
                    <option value="Square">Square</option>
                    <option value="Circle">Circle</option>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs"><Switch checked={draft.showQr} onChange={(value) => set('showQr', value)} disabled={!allowed} /> QR code</label>
                <div className="flex items-center gap-2 text-xs">
                  <span>QR position</span>
                  <Select
                    value={draft.qrPosition}
                    onChange={(event) => set('qrPosition', event.target.value as IdCardQrPosition)}
                    disabled={!allowed}
                  >
                    {ID_CARD_QR_POSITIONS.map((position) => (<option key={position} value={position}>{position}</option>))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-xs"><Switch checked={draft.showBarcode} onChange={(value) => set('showBarcode', value)} disabled={!allowed} /> Barcode</label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CARD_FIELDS[draft.holderType].front.map((field) => (
                  <FieldToggle
                    key={field.key}
                    label={field.label}
                    checked={draft.frontFields.includes(field.key)}
                    onChange={() => allowed && toggleField('frontFields', field.key)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
              <h2 className="mb-2 text-sm font-semibold">Back layout</h2>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs"><Switch checked={draft.showSignature} onChange={(value) => set('showSignature', value)} disabled={!allowed} /> Authorised signature</label>
                <Field label="Signatory name">
                  <Input value={draft.signatureName} onChange={(event) => set('signatureName', event.target.value)} disabled={!allowed} />
                </Field>
                <Field label="Signatory title">
                  <Input value={draft.signatureTitle} onChange={(event) => set('signatureTitle', event.target.value)} disabled={!allowed} />
                </Field>
                <Field label="Return / property note">
                  <Textarea rows={2} value={draft.backNote} onChange={(event) => set('backNote', event.target.value)} disabled={!allowed} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CARD_FIELDS[draft.holderType].back.map((field) => (
                  <FieldToggle
                    key={field.key}
                    label={field.label}
                    checked={draft.backFields.includes(field.key)}
                    onChange={() => allowed && toggleField('backFields', field.key)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Background images</h2>
                <p className="text-[11px] text-mist">Import artwork for each face — it prints behind the card content.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BackgroundImageInput
                label="Front background"
                hint="Drawn behind the photo and student details"
                value={draft.frontBackground}
                disabled={!allowed}
                onChange={(value) => set('frontBackground', value)}
              />
              <BackgroundImageInput
                label="Back background"
                hint="Drawn behind the terms, signature and codes"
                value={draft.backBackground}
                disabled={!allowed}
                onChange={(value) => set('backBackground', value)}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Fit" hint="How the image fills the card">
                <Select value={draft.backgroundFit} onChange={(event) => set('backgroundFit', event.target.value)} disabled={!allowed}>
                  {ID_CARD_BACKGROUND_FITS.map((fit) => (<option key={fit.id} value={fit.id}>{fit.label}</option>))}
                </Select>
              </Field>
              <Field label="Opacity" hint={`${Math.round((draft.backgroundOpacity || 1) * 100)}% — lower it to keep text readable`}>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round((draft.backgroundOpacity || 1) * 100)}
                  disabled={!allowed}
                  onChange={(event) => set('backgroundOpacity', (Number(event.target.value) || 100) / 100)}
                  className="mt-2 w-full accent-lime"
                  aria-label="Background opacity"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white/60 p-4 dark:bg-white/5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-mist">Zoom</span>
                <div className="flex overflow-hidden rounded-lg border border-line dark:border-white/10">
                  {PREVIEW_ZOOMS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setZoom(level)}
                      className={`px-2 py-1 text-xs transition ${zoom === level ? 'bg-lime text-black' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                    >
                      {level * 100}%
                    </button>
                  ))}
                </div>
                <span className="text-xs text-mist">
                  {draft.widthMm} × {draft.heightMm} mm
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-6 overflow-auto">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Front</p>
                <IdCardFace template={draft} card={sampleCard} side="front" school={school} scale={zoom} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-mist">Back</p>
                <IdCardFace template={draft} card={sampleCard} side="back" school={school} scale={zoom} />
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete template"
        footer={(
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button size="sm" onClick={() => confirmDelete && remove(confirmDelete)}>Delete</Button>
          </>
        )}
      >
        <p className="text-sm text-mist">
          Delete “{confirmDelete?.name}”? Cards already generated keep their data, but will fall back to the default template when reprinted.
        </p>
      </Modal>
    </div>
  )
}

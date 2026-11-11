import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, UploadCloud, X } from 'lucide-react'
import { Button, Modal, Field, Input, Select, Textarea } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { useApp } from '../../../context/AppContext'
import { uid } from '../../../lib/utils'
import { loadEduRecords, saveEduRecords } from '../../../lib/eduRecords'
import { applyReportsheetThemeToRecords } from '../../../lib/reportsheetThemes'
import {
  MarksheetPreview,
  ContentFieldWithTokens,
  resolveMarkParts,
  buildMarksheetRows,
  compactImageField,
  MARKSHEET_PREVIEW_PARTS,
  MARKSHEET_CONTENT_TOKENS,
  type MarkPart,
} from './EduModulePage'

/** Fields for the Add Marksheet Template modal, matching eduMenu.json marksheetTemplate. */
const MARKSHEET_TEMPLATE_FIELDS = [
  { key: 'examName', label: 'Exam Name', type: 'select' as const, source: 'examSetup', required: true },
  { key: 'templateName', label: 'Template Name', type: 'text' as const, required: true },
  { key: 'reportsheetTheme', label: 'Reportsheet Theme', type: 'select' as const, keepOrder: true, options: ['Theme 1', 'Theme 2', 'Theme 3', 'Theme 4', 'Theme 5', 'Theme 6'] },
  { key: 'pageLayout', label: 'Page Layout', type: 'select' as const, options: ['Portrait', 'Landscape'], keepOrder: true, required: true },
  { key: 'photoStyle', label: 'Photo Style', type: 'select' as const, options: ['Square - 320', 'Square - 240', 'Round - 320', 'Round - 240'], keepOrder: true, required: true },
  { key: 'topSpace', label: 'Top Space (px)', type: 'number' as const },
  { key: 'bottomSpace', label: 'Bottom Space (px)', type: 'number' as const },
  { key: 'rightSpace', label: 'Right Space (px)', type: 'number' as const },
  { key: 'leftSpace', label: 'Left Space (px)', type: 'number' as const },
  { key: 'leftSignature', label: 'Left Signature', type: 'image' as const, display: 'file' as const },
  { key: 'middleSignature', label: 'Middle Signature', type: 'image' as const, display: 'file' as const },
  { key: 'rightSignature', label: 'Right Signature', type: 'image' as const, display: 'file' as const },
  { key: 'logoImage', label: 'Logo Image', type: 'image' as const, display: 'file' as const },
  { key: 'backgroundImage', label: 'Background Image', type: 'image' as const, display: 'file' as const },
  { key: 'headerContent', label: 'Header Content', type: 'textarea' as const, required: true, display: 'tokens' as const },
  { key: 'footerContent', label: 'Footer Content', type: 'textarea' as const, required: true, display: 'tokens' as const },
  { key: 'reportOptions', label: 'Report Options', type: 'multiselect' as const, display: 'checkboxes' as const, keepOrder: true, options: ['Attendance Percentage', 'Grading Scale', 'Position', 'Cumulative Average', 'Class Average', 'Subject Position', 'Remark', 'Result'] },
]

type FieldDef = (typeof MARKSHEET_TEMPLATE_FIELDS)[number]

const multiSelectValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value.trim()) {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String) } catch { /* not JSON */ }
  }
  return []
}

export function AddMarksheetTemplateModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name ?? ''

  const records = loadEduRecords(activeBranchId, branchName)

  const [edit, setEdit] = useState<Record<string, string> | null>(null)

  // Initialize edit state when modal opens
  const initialEdit = useCallback(() => ({
    id: uid(),
    branch: branchName,
    examName: '',
    templateName: '',
    reportsheetTheme: 'Theme 1',
    pageLayout: 'Portrait',
    photoStyle: 'Square - 320',
    topSpace: '20',
    bottomSpace: '20',
    rightSpace: '15',
    leftSpace: '15',
    leftSignature: '',
    middleSignature: '',
    rightSignature: '',
    logoImage: '',
    backgroundImage: '',
    headerContent: '{institute_name}\n{exam_name}',
    footerContent: '{left_signature}\nClass Teacher\n\n{middle_signature}\nHead of School\n\n{right_signature}\nPrincipal\n\nPrinted {print_date}',
    reportOptions: JSON.stringify([]),
    createdAt: new Date().toISOString().slice(0, 10),
  }), [branchName])

  // Initialize edit state when modal opens/closes.
  // useEffect handles the normal case; the render-phase fallback ensures
  // edit is set on the very first render (before useEffect fires), preventing
  // a blank modal flash. The key prop in ReportBuilderPage forces a re-mount
  // on each open, making the render-phase pattern reliable here.
  if (open && !edit) {
    setEdit(initialEdit())
  }
  useEffect(() => {
    if (open) {
      setEdit(initialEdit())
    } else {
      setEdit(null)
    }
  }, [open, initialEdit])

  const updateEditField = (key: string, value: string) => {
    setEdit((cur) => (cur ? { ...cur, [key]: value } : cur))
  }

  const readImage = (file: File, key: string) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }
    if (file.size > 2_000_000) {
      toast.error('Image too large (max 2 MB)')
      return
    }
    const rd = new FileReader()
    rd.onload = () => setEdit((cur) => (cur ? { ...cur, [key]: String(rd.result) } : cur))
    rd.readAsDataURL(file)
  }

  // Resolve mark parts for the selected exam
  const partsForExam = useCallback((examName: string): MarkPart[] => {
    const exam = (records.examSetup ?? []).find(
      (row) => String(row.examName ?? '').trim() === examName,
    )
    const names = multiSelectValues(exam?.markDistribution)
    if (!names.length) return []
    return resolveMarkParts(names, records.markDistribution ?? [])
  }, [records])

  const examComponents = edit ? partsForExam(String(edit.examName ?? '')) : []

  const submit = () => {
    if (!edit) return
    const missing = MARKSHEET_TEMPLATE_FIELDS.find((f) => {
      if (!f.required) return false
      return !String(edit[f.key] ?? '').trim()
    })
    if (missing) {
      toast.error(`${missing.label} is required`)
      return
    }

    const normalizedEdit = {
      ...edit,
      reportsheetTheme: String(edit.reportsheetTheme || 'Theme 1'),
    }

    const existing = records.marksheetTemplate ?? []
    const nextRows = [...existing, normalizedEdit]

    const { nextRecords: themeSyncedRecords } = applyReportsheetThemeToRecords(
      { ...records, marksheetTemplate: nextRows },
      normalizedEdit.reportsheetTheme,
    )

    saveEduRecords(activeBranchId, {
      ...records,
      marksheetTemplate: nextRows,
      reportsheetTheme: themeSyncedRecords.reportsheetTheme ?? [],
      ...(themeSyncedRecords.examSetup ? { examSetup: themeSyncedRecords.examSetup } : {}),
    })

    toast.success('Template added', `${String(normalizedEdit.templateName || '')} (${normalizedEdit.reportsheetTheme})`)
    setEdit(null)
    onClose()
  }

  const examOptions = (records.examSetup ?? [])
    .map((row) => String(row.examName ?? '').trim())
    .filter(Boolean)

  return (
    <Modal open={open} onClose={onClose} title="Add Marksheet Template" wide xl>
      {edit && (
        <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
          {/* Form fields */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:col-span-6">
            {MARKSHEET_TEMPLATE_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                className={`min-w-0 ${['headerContent', 'footerContent', 'reportOptions'].includes(f.key) ? 'col-span-1 sm:col-span-2 lg:col-span-12' : 'col-span-1 sm:col-span-1 lg:col-span-6'}`}
              >
                {f.type === 'select' ? (
                  <Select
                    value={String(edit[f.key] ?? '')}
                    onChange={(e) => updateEditField(f.key, e.target.value)}
                    placeholder="Select…"
                  >
                    {f.key === 'examName' && <option value="">Select exam…</option>}
                    {f.options ? f.options.map((o: string) => (<option key={o} value={o}>{o}</option>)) : examOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </Select>
                ) : f.type === 'multiselect' && f.display === 'checkboxes' ? (
                  <div className="flex flex-wrap gap-x-5 gap-y-2.5 rounded-xl border border-line p-3">
                    {f.options!.map((option: string) => {
                      const values = multiSelectValues(edit[f.key])
                      return (
                        <label key={option} className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 flex-none accent-blue-600"
                            checked={values.includes(option)}
                            aria-label={option}
                            onChange={(e) => updateEditField(f.key, JSON.stringify(e.target.checked ? [...values, option] : values.filter((v) => v !== option)))}
                          />
                          <span className="min-w-0">{option}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : f.type === 'textarea' && f.display === 'tokens' ? (
                  <ContentFieldWithTokens
                    value={String(edit[f.key] ?? '')}
                    alignments={String((edit as any)[f.key === 'headerContent' ? 'headerAlignments' : f.key === 'footerContent' ? 'footerAlignments' : ''] ?? '')}
                    ariaLabel={`${f.label} content`}
                    onChange={(next) => updateEditField(f.key, next)}
                    onAlignChange={(next) => {
                      const k = f.key === 'headerContent' ? 'headerAlignments' : f.key === 'footerContent' ? 'footerAlignments' : ''
                      if (k) updateEditField(k, next)
                    }}
                  />
                ) : f.type === 'textarea' ? (
                  <Textarea rows={3} value={String(edit[f.key] ?? '')} onChange={(e) => updateEditField(f.key, e.target.value)} />
                ) : f.type === 'image' ? (
                  <label
                    className={compactImageField('marksheetTemplate', f as any)
                      ? 'flex min-h-[42px] cursor-pointer items-center justify-start gap-2 rounded-md border border-line bg-transparent px-3 py-2 text-sm text-mist transition hover:border-lime hover:text-inherit'
                      : 'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-black/[0.02] p-4 text-center text-xs text-mist transition hover:border-lime hover:text-inherit dark:bg-white/[0.03]'}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const file = e.dataTransfer.files?.[0]
                      if (file) readImage(file, f.key)
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) readImage(file, f.key)
                        e.target.value = ''
                      }}
                    />
                    {String(edit[f.key] ?? '').startsWith('data:') ? (
                      <img
                        src={String(edit[f.key])}
                        alt={compactImageField('marksheetTemplate', f as any) ? 'Selected file preview' : 'Cover preview'}
                        className={compactImageField('marksheetTemplate', f as any) ? 'size-8 shrink-0 rounded-md object-cover' : 'h-24 w-16 rounded-md object-cover'}
                      />
                    ) : (
                      <UploadCloud className={compactImageField('marksheetTemplate', f as any) ? 'size-4 shrink-0' : 'size-6'} />
                    )}
                    <span>{String(edit[f.key] ?? '')
                      ? (compactImageField('marksheetTemplate', f as any) ? 'Change file' : 'Click or drop a file to replace')
                      : (compactImageField('marksheetTemplate', f as any) ? 'Select file' : 'Drag and drop a file here or click')}</span>
                  </label>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={String(edit[f.key] ?? '')}
                    onChange={(e) => updateEditField(f.key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-0 lg:col-span-6">
            <MarksheetPreview
              templateName={String(edit.templateName ?? '')}
              reportsheetTheme={String(edit.reportsheetTheme || 'Theme 1')}
              pageLayout={String(edit.pageLayout ?? '')}
              backgroundImage={String(edit.backgroundImage ?? '')}
              schoolName={String(branchName ?? 'School')}
              photoStyle={String(edit.photoStyle ?? '')}
              topSpace={String(edit.topSpace ?? '')}
              bottomSpace={String(edit.bottomSpace ?? '')}
              rightSpace={String(edit.rightSpace ?? '')}
              leftSpace={String(edit.leftSpace ?? '')}
              headerContent={String(edit.headerContent ?? '')}
              footerContent={String(edit.footerContent ?? '')}
              reportOptions={String(edit.reportOptions ?? '')}
              parts={examComponents}
              examName={String(edit.examName ?? '')}
              logoImage={String(edit.logoImage ?? '')}
              leftSignature={String(edit.leftSignature ?? '')}
              middleSignature={String(edit.middleSignature ?? '')}
              rightSignature={String(edit.rightSignature ?? '')}
              showHeader={String(edit.headerContent ?? '').trim() !== ''}
              showMiddle={true}
              showFooter={String(edit.footerContent ?? '').trim() !== ''}
            />
          </div>

          <div className="flex gap-2 sticky bottom-0 z-10 -mb-4 rounded-b-xl border-t border-line bg-white px-1 pb-4 pt-3 dark:bg-[#141416] lg:col-span-12">
            <Button className="flex-1" onClick={submit}>Save</Button>
            <Button variant="ghost" onClick={() => { setEdit(null); onClose() }}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

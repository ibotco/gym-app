import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { DataTable, type Column } from '../../../components/DataTable'
import { Button, Field, Modal, MultiSelect, PageHeader, SearchInput, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { uid } from '../../../lib/utils'

const cleanValues = (values: unknown[]) => [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]

function parseSubjects(value: unknown): string[] {
  if (Array.isArray(value)) return cleanValues(value)
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return cleanValues(parsed)
  } catch {
    // Keep legacy/plain-text values readable if the stored value is not JSON.
  }
  return cleanValues(raw.split(/[\n,;]/).map((subject) => subject.replace(/^\s*[-•]\s*/, '')))
}

const parseSections = parseSubjects

export function EduAssignClassSubjectsPage() {
  const { activeBranchId, branches } = useApp()
  const { t } = useI18n()
  const toast = useToast()
  const activeBranchName = branches.find((branch) => branch.id === activeBranchId)?.name

  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState<EduRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [del, setDel] = useState<EduRow | null>(null)

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
    setEdit(null)
    setIsNew(false)
    setDel(null)
    setQuery('')
  }, [activeBranchId])

  const rows = records.assignClassSubjects ?? []
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return rows
    return rows.filter((row) => [
      row.className,
      ...parseSections(row.sections ?? row.section),
      ...parseSubjects(row.subjects),
    ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)))
  }, [rows, query])

  const openAdd = () => {
    setIsNew(true)
    setEdit({ id: uid(), className: '', sections: '[]', subjects: '[]' })
  }

  const openEdit = (row: EduRow) => {
    const { section, ...record } = row
    setIsNew(false)
    setEdit({
      ...record,
      sections: JSON.stringify(parseSections(row.sections ?? section)),
      subjects: JSON.stringify(parseSubjects(row.subjects)),
    })
  }

  const classRows = records.classList ?? []
  const className = String(edit?.className ?? '').trim()
  const classOptions = cleanValues([
    ...classRows.map((row) => row.name),
    className,
  ]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  const configuredSections = (records.academicSections ?? []).map((row) =>
    String(row.name ?? '').trim().replace(/^section\s+/i, ''),
  )
  const sectionOptions = className ? cleanValues([
    ...configuredSections,
    ...parseSections(edit?.sections ?? edit?.section),
  ]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })) : []
  const subjectOptions = cleanValues([
    ...(records.subjectList ?? []).map((row) => row.name),
    ...parseSubjects(edit?.subjects),
  ]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const save = () => {
    if (!edit) return
    const selectedClass = String(edit.className ?? '').trim()
    const selectedSections = parseSections(edit.sections ?? edit.section)
    const subjects = parseSubjects(edit.subjects)
    if (!activeBranchId) { toast.error('Select a branch first'); return }
    if (!selectedClass) { toast.error('Class is required'); return }
    if (!selectedSections.length) { toast.error('Select at least one section'); return }
    if (!subjects.length) { toast.error('Select at least one subject'); return }

    const currentRows = records.assignClassSubjects ?? []
    const selectedSectionKeys = new Set(selectedSections.map((section) => section.toLocaleLowerCase()))
    const duplicate = currentRows.find((row) => row.id !== edit.id
      && String(row.className ?? '').trim().toLocaleLowerCase() === selectedClass.toLocaleLowerCase()
      && parseSections(row.sections ?? row.section).some((section) => selectedSectionKeys.has(section.toLocaleLowerCase())))
    if (duplicate) {
      toast.error('Subjects are already assigned to one or more selected sections', 'Edit the existing assignment instead.')
      return
    }

    const saved: EduRow = {
      id: String(edit.id || uid()),
      className: selectedClass,
      sections: JSON.stringify(selectedSections),
      subjects: JSON.stringify(subjects),
    }
    const exists = currentRows.some((row) => row.id === saved.id)
    const nextRecords: EduRecords = {
      ...records,
      assignClassSubjects: exists
        ? currentRows.map((row) => row.id === saved.id ? saved : row)
        : [...currentRows, saved],
    }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success(exists ? 'Class subjects updated' : 'Class subjects assigned', `${selectedClass} ${selectedSections.join(', ')}`)
    setEdit(null)
  }

  const remove = (row: EduRow) => {
    if (!activeBranchId) return
    const nextRecords: EduRecords = {
      ...records,
      assignClassSubjects: (records.assignClassSubjects ?? []).filter((item) => item.id !== row.id),
    }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
    toast.success('Class subject assignment deleted', `${row.className} ${parseSections(row.sections ?? row.section).join(', ')}`)
    setDel(null)
  }

  const columns: Column<EduRow>[] = [
    {
      key: 'sl',
      header: 'Sl',
      render: (row) => String(rows.findIndex((item) => item.id === row.id) + 1),
    },
    {
      key: 'className',
      header: 'Class',
      sortValue: (row) => row.className ?? '',
      render: (row) => String(row.className ?? '—'),
    },
    {
      key: 'sections',
      header: 'Section',
      sortValue: (row) => parseSections(row.sections ?? row.section).join(', '),
      render: (row) => {
        const sections = parseSections(row.sections ?? row.section)
        return sections.length ? (
          <ul className="space-y-1">
            {sections.map((section) => <li key={section}>- {section}</li>)}
          </ul>
        ) : <span className="text-mist">—</span>
      },
    },
    {
      key: 'subjects',
      header: 'Subject',
      sortValue: (row) => parseSubjects(row.subjects).join(', '),
      render: (row) => {
        const subjects = parseSubjects(row.subjects)
        return subjects.length ? (
          <ul className="space-y-1">
            {subjects.map((subject) => <li key={subject}>- {subject}</li>)}
          </ul>
        ) : <span className="text-mist">—</span>
      },
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10"
            title="Edit"
            aria-label={`Edit subjects for ${row.className} ${parseSections(row.sections ?? row.section).join(', ')}`}
            onClick={() => openEdit(row)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-mist hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
            title="Delete"
            aria-label={`Delete subjects for ${row.className} ${parseSections(row.sections ?? row.section).join(', ')}`}
            onClick={() => setDel(row)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span>Education Management</span>
        <span>/</span><span>{t('nav.eduSubjects')}</span>
        <span>/</span><span className="font-semibold text-inherit">{t('nav.eduAssignClassSubjects')}</span>
      </div>
      <PageHeader
        title={t('nav.eduAssignClassSubjects')}
        desc={`${activeBranchName ? `${activeBranchName} · ` : ''}Assignments follow the currently selected company and branch.`}
      />

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search class subject assignments…" />
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" /> Add Assign Class Subjects
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={filteredRows}
          rowKey={(row) => row.id}
          emptyTitle="No class subjects assigned"
          emptyDesc="Add an assignment to link subjects to a class and section."
        />
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={isNew ? 'Add Assign Class Subjects' : 'Edit Assign Class Subjects'}
      >
        {edit && (
          <div className="grid gap-3">
            <Field label="Class" required>
              <Select
                value={className}
                onChange={(event) => setEdit((current) => current ? { ...current, className: event.target.value, sections: '[]' } : current)}
                placeholder="Select class…"
              >
                {classOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </Field>
            <Field label="Section" required hint={!configuredSections.length ? 'Add sections under Classes → Sections first.' : undefined}>
              <MultiSelect
                options={sectionOptions.map((section) => ({ value: section, label: section }))}
                values={parseSections(edit.sections ?? edit.section)}
                onChange={(sections) => setEdit((current) => current ? { ...current, sections: JSON.stringify(sections) } : current)}
                placeholder={className ? 'Select Multiple Sections' : 'Select Class First'}
                disabled={!className}
                aria-label="Select multiple sections"
              />
            </Field>
            <Field label="Subject" required>
              <MultiSelect
                options={subjectOptions.map((subject) => ({ value: subject, label: subject }))}
                values={parseSubjects(edit.subjects)}
                onChange={(subjects) => setEdit((current) => current ? { ...current, subjects: JSON.stringify(subjects) } : current)}
                placeholder="Select Multiple Subject"
                aria-label="Select multiple subjects"
              />
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>Save</Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete class subject assignment?">
        {del && (
          <>
            <p className="text-sm text-mist">
              Delete the subject assignment for <span className="font-semibold text-inherit">{del.className} {parseSections(del.sections ?? del.section).join(', ')}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => remove(del)}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

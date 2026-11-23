import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Save, Trash2 } from 'lucide-react'
import { Badge, Button, Field, Input } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { loadPromotionGradeSettings, savePromotionGradeSettings } from '../../../lib/promotions'

export function GradeSettingsPage() {
  const { log, activeCompanyId } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [grades, setGrades] = useState<string[]>(() => loadPromotionGradeSettings(activeCompanyId).grades)
  const [savedGrades, setSavedGrades] = useState(grades)
  const [draft, setDraft] = useState('')
  const hasChanges = JSON.stringify(grades) !== JSON.stringify(savedGrades)

  useEffect(() => {
    const companyGrades = loadPromotionGradeSettings(activeCompanyId).grades
    setGrades(companyGrades)
    setSavedGrades(companyGrades)
    setDraft('')
  }, [activeCompanyId])

  const save = () => {
    const normalizedGrades: string[] = []
    const seen = new Set<string>()
    grades.forEach((value) => {
      const label = value.trim()
      const key = label.toLocaleLowerCase()
      if (label && !seen.has(key)) {
        seen.add(key)
        normalizedGrades.push(label)
      }
    })
    const latest = loadPromotionGradeSettings(activeCompanyId)
    const persisted = savePromotionGradeSettings({ ...latest, grades: normalizedGrades }, activeCompanyId)
    if (!persisted) {
      toast.error('Grade settings were not saved', 'Browser storage is unavailable. Please try again.')
      return
    }
    setGrades(normalizedGrades)
    setSavedGrades(normalizedGrades)
    log(user?.id || 'system', 'UPDATE', 'HRJobSettings', 'Updated promotion grade options')
    toast.success('Grade settings saved')
  }

  const addGrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = draft.trim()
    if (!label) {
      toast.error('Enter a grade.')
      return
    }
    if (grades.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase())) {
      toast.error('That grade already exists.')
      return
    }
    const nextGrades = [...grades, label]
    const latest = loadPromotionGradeSettings(activeCompanyId)
    const persisted = savePromotionGradeSettings({ ...latest, grades: nextGrades }, activeCompanyId)
    if (!persisted) {
      toast.error('Grade was not saved', 'Browser storage is unavailable. Please try again.')
      return
    }
    setGrades(nextGrades)
    setSavedGrades(nextGrades)
    setDraft('')
    log(user?.id || 'system', 'UPDATE', 'HRJobSettings', `Added promotion grade: ${label}`)
    toast.success('Grade added and saved', 'It is ready to use in promotion forms.')
  }

  const removeGrade = (label: string) => {
    setGrades(grades.filter((item) => item !== label))
    toast.success('Grade removed', 'Save to apply. Existing promotion history will be retained.')
  }

  const moveGrade = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= grades.length) return
    const next = [...grades]
    ;[next[index], next[target]] = [next[target], next[index]]
    setGrades(next)
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Promotion Grades</h2>
          <p className="mt-1 text-sm text-mist">Manage grade options used by Payroll promotion forms. Order matters: place the most senior grade first; higher grades appear above lower grades.</p>
        </div>
        <Badge tone="zinc">{grades.length}</Badge>
      </div>

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={addGrade}>
        <Field label="Add grade" className="min-w-0 flex-1">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="e.g. Grade 4" />
        </Field>
        <Button type="submit">Add grade</Button>
      </form>

      <div className="mt-4 divide-y divide-line rounded-xl border border-line">
        {grades.map((grade, index) => (
          <div key={grade} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <Badge tone={index === 0 ? 'lime' : 'zinc'}>Rank {index + 1}</Badge>
              <span className="text-sm font-medium">{grade}</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={index === 0} className="rounded-lg p-2 text-mist hover:text-lime disabled:opacity-30" aria-label={`Move ${grade} higher`} title="Move higher" onClick={() => moveGrade(index, -1)}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={index === grades.length - 1} className="rounded-lg p-2 text-mist hover:text-lime disabled:opacity-30" aria-label={`Move ${grade} lower`} title="Move lower" onClick={() => moveGrade(index, 1)}>
                <ArrowDown className="size-4" />
              </button>
              <button type="button" className="rounded-lg p-2 text-mist hover:text-ember" aria-label={`Remove ${grade}`} title="Remove grade" onClick={() => removeGrade(grade)}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {!grades.length && <p className="px-3 py-8 text-center text-sm text-mist">No grade options yet.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {hasChanges ? <p className="text-xs text-mist">You have unsaved changes.</p> : <span />}
        <Button onClick={save} disabled={!hasChanges}><Save className="size-4" /> Save</Button>
      </div>
    </div>
  )
}

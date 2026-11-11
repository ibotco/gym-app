import { useApp } from '../context/AppContext'
import { Field, Input, Select, Textarea, DatePicker } from './ui'
import type { CustomFieldValues } from '../types'

/**
 * Renders the admin-defined custom fields for a module (member, customer, lead,
 * …) as editable inputs. `values` is keyed by custom field id.
 */
export function CustomFields({
  module,
  values,
  onChange,
  gridClass = 'grid gap-3 sm:grid-cols-2',
}: {
  module: string
  values: CustomFieldValues
  onChange: (values: CustomFieldValues) => void
  gridClass?: string
}) {
  const { customFields } = useApp()
  const fields = customFields.filter((f) => f.module === module)
  if (!fields.length) return null
  const set = (id: string, v: string) => onChange({ ...values, [id]: v })

  return (
    <div className={gridClass}>
      {fields.map((f) => {
        const val = values[f.id] ?? ''
        return (
          <Field key={f.id} label={f.name} required={f.required}>
            {f.type === 'text' && <Input value={val} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === 'textarea' && <Textarea value={val} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === 'number' && <Input type="number" value={val} onChange={(e) => set(f.id, e.target.value)} />}
            {f.type === 'select' && (
              <Select value={val} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Select…</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            )}
            {f.type === 'checkbox' && (
              <div className="flex h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[#c8f542]"
                  checked={val === '1' || val === 'true' || val === 'on' || val === 'yes'}
                  onChange={(e) => set(f.id, e.target.checked ? '1' : '')}
                />
                <span className="text-sm text-mist">Yes</span>
              </div>
            )}
            {f.type === 'date' && <DatePicker value={val} onChange={(v) => set(f.id, v)} />}
          </Field>
        )
      })}
    </div>
  )
}

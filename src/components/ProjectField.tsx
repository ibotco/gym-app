import { useApp } from '../context/AppContext'
import { MODULES } from '../lib/modules'
import { Field, Select } from './ui'

/**
 * True when the Project Management module is available in the system and the
 * active company has switched it on (Company Settings → App Enables).
 * It ships DISABLED — a company opts in explicitly.
 */
export function useProjectModule(): boolean {
  const { company, modules } = useApp()
  const available = MODULES.some((m) => m.id === 'projects') && modules.projects !== false
  return available && company.projectManagement === true
}

/** Project association selector rendered inside document forms; hidden when the module is off. */
export function ProjectField({ value, onChange }: { value: string; onChange: (projectId: string) => void }) {
  const enabled = useProjectModule()
  const { projects } = useApp()
  if (!enabled) return null
  return (
    <Field label="Project">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No project</option>
        {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
      </Select>
    </Field>
  )
}

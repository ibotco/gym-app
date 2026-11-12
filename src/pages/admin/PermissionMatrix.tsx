import { useEffect, useMemo, useState } from 'react'
import { Save, Check, ChevronRight } from 'lucide-react'
import { PageHeader, Button, Badge, Select, SearchField } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PERMISSION_MATRIX, loadMatrix, saveMatrix, emptyActions, type MatrixActions, type MatrixState } from '../../lib/permissionMatrix'
import type { RoleDef } from '../../types'

const ACTIONS: { key: keyof MatrixActions; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
]

export function PermissionMatrix() {
  const app = useApp()
  const { roles } = app
  const { hasPermission, user } = useAuth()
  const toast = useToast()
  const currentDefinition = user ? roles.find((role) => role.id === user.role) : undefined
  const delegatedCompanyRole = Boolean(currentDefinition && !currentDefinition.builtin && currentDefinition.companyId === (user?.companyId || app.activeCompanyId))
  const matrixScope = user?.role === 'super_admin' ? 'global' : user?.companyId || app.activeCompanyId || 'global'

  const canManage = Boolean(user && (user.role === 'super_admin' || user.role === 'company_admin' || delegatedCompanyRole) && hasPermission('roles.manage'))

  const [roleId, setRoleId] = useState<string>('')
  const [matrix, setMatrix] = useState<MatrixState>(() => loadMatrix(matrixScope))

  useEffect(() => {
    setMatrix(loadMatrix(matrixScope))
    setRoleId('')
  }, [matrixScope])
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState(false)

  const role = roles.find((r) => r.id === roleId) || null
  const roleMatrix = roleId ? matrix[roleId] || {} : {}

  // Which roles are assignable in the matrix (admin-portal roles).
  const adminRoles = roles.filter((r) => r.portal === 'admin')

  const visibleModules = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return PERMISSION_MATRIX
    return PERMISSION_MATRIX
      .map((m) => ({
        ...m,
        rows: m.rows.filter((r) => r.label.toLowerCase().includes(ql) || m.label.toLowerCase().includes(ql)),
      }))
      .filter((m) => m.rows.length > 0)
  }, [q])

  const getActions = (key: string): MatrixActions => roleMatrix[key] || emptyActions()

  const setAction = (rowKey: string, action: keyof MatrixActions, value: boolean) => {
    if (!roleId) return
    setMatrix((prev) => {
      const cur = { ...(prev[roleId]?.[rowKey] || emptyActions()), [action]: value }
      const roleRows = { ...(prev[roleId] || {}), [rowKey]: cur }
      return { ...prev, [roleId]: roleRows }
    })
  }

  const setRowAll = (rowKey: string, value: boolean) => {
    if (!roleId) return
    setMatrix((prev) => {
      const roleRows = { ...(prev[roleId] || {}), [rowKey]: { view: value, create: value, edit: value, delete: value } }
      return { ...prev, [roleId]: roleRows }
    })
  }

  const rowAllChecked = (rowKey: string) => {
    const a = getActions(rowKey)
    return a.view && a.create && a.edit && a.delete
  }

  const rowPartiallyChecked = (rowKey: string) => {
    const a = getActions(rowKey)
    return (a.view || a.create || a.edit || a.delete) && !rowAllChecked(rowKey)
  }

  const moduleRowKeys = (module: (typeof PERMISSION_MATRIX)[number]) => module.rows.map((r) => r.key)

  const moduleAllChecked = (module: (typeof PERMISSION_MATRIX)[number]) =>
    moduleRowKeys(module).length > 0 && moduleRowKeys(module).every((k) => rowAllChecked(k))

  const setModuleAll = (module: (typeof PERMISSION_MATRIX)[number], value: boolean) => {
    if (!roleId) return
    setMatrix((prev) => {
      const roleRows = { ...(prev[roleId] || {}) }
      for (const k of moduleRowKeys(module)) {
        roleRows[k] = { view: value, create: value, edit: value, delete: value }
      }
      return { ...prev, [roleId]: roleRows }
    })
  }

  const save = () => {
    if (!roleId) { toast.error('Select a role first.'); return }
    saveMatrix(matrix, matrixScope)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
    toast.success('Permission matrix saved', role?.name)
  }

  return (
    <div>
      <PageHeader
        title="Permission Matrix"
        desc="Grant granular View, Create, Edit, and Delete access per module for a role."
        actions={
          <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save} disabled={!canManage || !roleId}>
            {saved ? <Check className="size-4" /> : <Save className="size-4" />} Save matrix
          </Button>
        }
      />

      {!canManage && (
        <div className="mb-4 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm">
          <span className="font-semibold">View only.</span> Only the Super Admin or a role with “Manage roles & permissions” can edit the matrix.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-64">
          <option value="">Select a role…</option>
          {adminRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <SearchField value={q} onChange={setQ} placeholder="Search modules…" className="w-full max-w-xs" />
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Module</th>
              <th className="text-center">Check All</th>
              {ACTIONS.map((a) => <th key={a.key} className="text-center">{a.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleModules.map((m) => (
              <ModuleGroup
                key={m.key}
                module={m}
                getActions={getActions}
                rowAllChecked={rowAllChecked}
                rowPartiallyChecked={rowPartiallyChecked}
                setAction={setAction}
                setRowAll={setRowAll}
                moduleAllChecked={moduleAllChecked(m)}
                setModuleAll={(v) => setModuleAll(m, v)}
                disabled={!canManage || !roleId}
              />
            ))}
            {!visibleModules.length && (
              <tr><td colSpan={6} className="py-6 text-center text-sm text-mist">No modules match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModuleGroup({
  module,
  getActions,
  rowAllChecked,
  rowPartiallyChecked,
  setAction,
  setRowAll,
  moduleAllChecked,
  setModuleAll,
  disabled,
}: {
  module: (typeof PERMISSION_MATRIX)[number]
  getActions: (k: string) => MatrixActions
  rowAllChecked: (k: string) => boolean
  rowPartiallyChecked: (k: string) => boolean
  setAction: (k: string, a: keyof MatrixActions, v: boolean) => void
  setRowAll: (k: string, v: boolean) => void
  moduleAllChecked: boolean
  setModuleAll: (v: boolean) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {/* Module header row */}
      <tr className="bg-black/5 dark:bg-white/5">
        <td className="font-bold">
          <button className="flex items-center gap-1.5" onClick={() => setOpen((v) => !v)} disabled={disabled}>
            <ChevronRight className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
            {module.label}
          </button>
        </td>
        <td className="text-center">
          <CheckCell checked={moduleAllChecked} onChange={(v) => setModuleAll(v)} disabled={disabled} />
        </td>
        {ACTIONS.map((a) => <td key={a.key} className="text-center"><span className="text-mist">—</span></td>)}
      </tr>
      {open && module.rows.map((row) => {
        const actions = getActions(row.key)
        return (
          <tr key={row.key}>
            <td className="pl-8 text-mist">{row.label}</td>
            <td className="text-center">
              <CheckCell
                checked={rowAllChecked(row.key)}
                indeterminate={rowPartiallyChecked(row.key)}
                onChange={(v) => setRowAll(row.key, v)}
                disabled={disabled}
              />
            </td>
            {ACTIONS.map((a) => (
              <td key={a.key} className="text-center">
                <input
                  type="checkbox"
                  className="size-4 accent-[#c8f542]"
                  checked={actions[a.key]}
                  disabled={disabled}
                  onChange={(e) => setAction(row.key, a.key, e.target.checked)}
                  aria-label={`${row.label} ${a.label}`}
                />
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

function CheckCell({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (v: boolean) => void
  disabled: boolean
}) {
  return (
    <input
      type="checkbox"
      className="size-4 accent-[#c8f542]"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked
      }}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      aria-label="Check all"
    />
  )
}

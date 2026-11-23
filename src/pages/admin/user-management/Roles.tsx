import { StudentPermissions } from './StudentPermissions'
import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Lock } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Segmented, Empty } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { userCompanyId } from '../../../lib/accessScope'
import { PERMISSION_GROUPS, portalGroups, slugifyRole } from '../../../lib/permissions'
import { PermissionMatrix } from '../PermissionMatrix'
import { MODULES } from '../../../lib/modules'
import { NAV } from '../../../components/layout/DashboardLayout'
import { useI18n } from '../../../context/I18nContext'
import type { Permission, RoleDef } from '../../../types'

const portalLabel = (p: RoleDef['portal']) =>
  p === 'admin' ? 'Admin console' : p === 'coach' ? 'Coach portal' : p === 'member' ? 'Member app' : p === 'customer' ? 'Customer portal' : p === 'student' ? 'Student portal' : p === 'parent' ? 'Parent portal (not available)' : 'Supplier portal'

// Existing definitions remain unchanged; this maps their groups to the
// actual sidebar module that owns them. Unmapped/custom groups stay visible.
const MODULE_PERMISSION_GROUPS: Record<string,string[]> = {
  overview:['Dashboard'], organizations:['Companies','Branches','Cost Centers'], people:['People','Leads'],
  userManagement:['Users','Roles & Permissions','Audit'], hrm:['Human Resources'], accounting:['Accounting','Payments'],
  inventory:['Inventory'], assets:['Assets Management'], sales:['Sales'], purchases:['Purchases'],
  communications:['Notifications'], programs:['Memberships','Classes','Check-in'], educationManagement:['Education'],
  settings:['Settings','Reports'],
}
type MenuNode = { key?: string; to?: string; children?: readonly MenuNode[] }
function menuLeaves(root: MenuNode): {key:string}[] {
  const seen = new Set<string>(), rows:{key:string}[]=[]
  const visit=(node:MenuNode)=>{if(node.children){node.children.forEach(visit);return}if(node.key && node.to && !seen.has(node.key)){seen.add(node.key);rows.push({key:node.key})}}
  visit(root);return rows
}

type RoleDraft = { id: string; name: string; description: string; portal: RoleDef['portal']; permissions: string[] }
type PermissionDraft = { key: string; label: string; group: string; description: string; companyId?: string }

function toDraft(r: RoleDef): RoleDraft {
  return { id: r.id, name: r.name, description: r.description || '', portal: r.portal, permissions: [...r.permissions] }
}

export function RolesAdmin() {
  const app = useApp()
  const { user: me, hasPermission } = useAuth()
  const toast = useToast()
  const { t } = useI18n()
  const { roles, permissions, users, upsertRole, deleteRole, upsertPermission, deletePermission, patchUser, log } = app
  const companyScopeId = me && me.role !== 'super_admin' ? userCompanyId(me, app.branches) : undefined

  const currentDefinition = me ? roles.find((role) => role.id === me.role) : undefined
  // Super Admin and Company Admin can manage definitions. A tenant custom role
  // may delegate the same capability only inside its own company; branch-level
  // and other built-in roles cannot turn roles.manage into cross-company access.
  const delegatedCompanyRole = Boolean(currentDefinition && !currentDefinition.builtin && currentDefinition.companyId === companyScopeId)
  const canManage = Boolean(me && (me.role === 'super_admin' || me.role === 'company_admin' || delegatedCompanyRole) && hasPermission('roles.manage'))

  const [studentPermissionsOpen, setStudentPermissionsOpen] = useState(false)
  const [view, setView] = useState('roles')
  const [roleModal, setRoleModal] = useState<RoleDraft | null>(null)
  const [isNewRole, setIsNewRole] = useState(false)
  const [permModal, setPermModal] = useState<PermissionDraft | null>(null)
  const [isNewPerm, setIsNewPerm] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'role' | 'permission'; id: string } | null>(null)

  const permissionGroups = useMemo(
    () => Array.from(new Set([...PERMISSION_GROUPS, ...permissions.map((permission) => permission.group)])),
    [permissions],
  )

  const byGroup = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const group of permissionGroups) map.set(group, [])
    for (const permission of permissions) {
      const list = map.get(permission.group) || []
      list.push(permission)
      map.set(permission.group, list)
    }
    return map
  }, [permissionGroups, permissions])

  const groupsForPortal = (portal: RoleDef['portal']) => {
    if (portal !== 'admin') return portalGroups(portal)
    const portalOnly = new Set(['Coach portal', 'Member portal', 'Student portal', 'Parent portal', 'Customer portal', 'Supplier portal'])
    return permissionGroups.filter((group) => !portalOnly.has(group))
  }

  const roleIdFor = (name: string) => {
    const base = slugifyRole(name)
    if (!companyScopeId) return base
    return `role_${companyScopeId}_${base.replace(/^role_/, '')}`
  }

  const permissionKeyFor = (keyOrLabel: string) => {
    const base = keyOrLabel.trim()
    if (!companyScopeId || base.startsWith(`${companyScopeId}.`)) return base
    return `${companyScopeId}.${base}`
  }

  const usersInRole = (roleId: string) => users.filter((u) => u.role === roleId).length

  const roleColumns: Column<RoleDef>[] = [
    {
      key: 'name', header: 'Role', sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <span className="size-3 shrink-0 rounded-full" style={{ background: r.color || '#a1a1aa' }} aria-hidden />
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              {r.name}
              {r.builtin && <Lock className="size-3.5 text-mist" aria-label="Built-in role" />}
            </p>
            <p className="text-xs text-mist">{r.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'portal', header: 'Portal', sortValue: (r) => r.portal,
      render: (r) => <Badge tone={r.portal === 'admin' ? 'sky' : r.portal === 'coach' ? 'violet' : r.portal === 'member' ? 'lime' : r.portal === 'customer' ? 'rose' : 'amber'}>{portalLabel(r.portal)}</Badge>,
    },
    { key: 'users', header: 'Users', sortValue: (r) => usersInRole(r.id), align: 'center', render: (r) => r.id === 'student' ? <span className="text-xs text-mist">Server-managed</span> : r.id === 'parent' ? <span className="text-xs text-mist">Not available</span> : usersInRole(r.id) },
    { key: 'perms', header: 'Permissions', sortValue: (r) => r.permissions.length, align: 'center', render: (r) => r.id === 'student' ? <span className="text-xs text-mist">Editable per company</span> : r.id === 'parent' ? <span className="text-xs text-mist">Not available</span> : r.permissions.length },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="whitespace-nowrap">
          {r.id === 'student' && (me?.role === 'super_admin' || me?.role === 'company_admin') && <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => setStudentPermissionsOpen(true)} aria-label="Edit Student permissions" title="Edit Student permissions"><Pencil className="size-4" /></button>}
          {!['student','parent'].includes(r.id) && (!r.builtin || me?.role === 'super_admin') && (
            <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEditRole(r)} aria-label={`Edit ${r.name}`}><Pencil className="size-4" /></button>
          )}
          {!r.builtin && (
            <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setConfirmDelete({ type: 'role', id: r.id })} aria-label={`Delete ${r.name}`}><Trash2 className="size-4" /></button>
          )}
        </span>
      ),
    },
  ]

  if (!canManage) {
    return (
      <div>
        <PageHeader eyebrow="Access control" title="Roles & permissions" />
        <Empty title="Not authorised" desc="You need the ‘Manage roles & permissions’ permission to view this page." />
      </div>
    )
  }

  const openNewRole = () => {
    setIsNewRole(true)
    setRoleModal({ id: roleIdFor('New role'), name: '', description: '', portal: 'admin', permissions: [] })
  }

  const openEditRole = (r: RoleDef) => {
    if (['student','parent'].includes(r.id) || (r.builtin && me?.role !== 'super_admin')) return
    setIsNewRole(false)
    setRoleModal(toDraft(r))
  }

  const togglePerm = (key: string) => {
    if (!roleModal) return
    setRoleModal((d) => d && ({
      ...d,
      permissions: d.permissions.includes(key) ? d.permissions.filter((k) => k !== key) : [...d.permissions, key],
    }))
  }

  const saveRole = () => {
    if (!roleModal) return
    if (roleModal.name.trim().length < 2) { toast.error('Role name must be at least 2 characters.'); return }
    const id = isNewRole ? roleIdFor(roleModal.name) : roleModal.id
    if (isNewRole && roles.some((r) => r.id === id)) { toast.error('A role with that name already exists in this scope.'); return }
    const original = roles.find((r) => r.id === roleModal.id)
    if (original && ['student','parent'].includes(original.id)) { toast.error('This role is protected; parent access is not available yet.'); return }
    if (original?.builtin && me?.role !== 'super_admin') {
      toast.error('Built-in roles are protected from company edits.')
      return
    }
    const record: RoleDef = {
      id,
      companyId: original?.builtin ? undefined : (original?.companyId || companyScopeId),
      name: roleModal.name.trim(),
      description: roleModal.description.trim() || undefined,
      portal: roleModal.portal,
      permissions: roleModal.permissions,
      builtin: original?.builtin,
      color: original?.color,
    }
    upsertRole(record)
    log(me?.id || 'admin', isNewRole ? 'CREATE' : 'UPDATE', 'Role', `${isNewRole ? 'Created' : 'Updated'} ${companyScopeId ? 'company ' : ''}role ${record.name}`)
    toast.success(isNewRole ? 'Company role created' : 'Role saved')
    setRoleModal(null)
  }

  const doDeleteRole = () => {
    if (!confirmDelete) return
    const r = roles.find((x) => x.id === confirmDelete.id)
    // Reassign affected users to a safe default.
    const fallback = r?.portal === 'member' ? 'member' : 'staff'
    users.filter((u) => u.role === confirmDelete.id).forEach((u) => patchUser(u.id, { role: fallback }))
    deleteRole(confirmDelete.id)
    log(me?.id || 'admin', 'DELETE', 'Role', `Deleted role ${r?.name || confirmDelete.id}`)
    toast.success('Role deleted')
    setConfirmDelete(null)
  }

  const openNewPermission = () => {
    setIsNewPerm(true)
    setNewGroup(false)
    setPermModal({ key: '', label: '', group: permissionGroups[0] || 'General', description: '' })
  }

  const openEditPermission = (permission: Permission) => {
    if (permission.builtin) return
    setIsNewPerm(false)
    setNewGroup(false)
    setPermModal({
      key: permission.key,
      label: permission.label,
      group: permission.group,
      description: permission.description || '',
      companyId: permission.companyId,
    })
  }

  const savePermission = () => {
    if (!permModal) return
    if (permModal.label.trim().length < 2) { toast.error('Permission label must be at least 2 characters.'); return }
    const group = permModal.group.trim() || 'General'
    const requestedKey = isNewPerm
      ? permModal.key.trim() || slugifyRole(permModal.label).replace('role_', 'custom.')
      : permModal.key
    const key = isNewPerm && companyScopeId ? permissionKeyFor(requestedKey) : requestedKey
    if (!key) { toast.error('Enter a permission key.'); return }
    const collision = permissions.some((permission) => permission.key === key && permission.key !== permModal.key)
    if (collision) { toast.error('That permission key already exists.'); return }
    upsertPermission({
      key,
      companyId: isNewPerm ? companyScopeId : (permModal.companyId || companyScopeId),
      label: permModal.label.trim(),
      group,
      description: permModal.description.trim() || undefined,
      builtin: false,
    })
    log(me?.id || 'admin', isNewPerm ? 'CREATE' : 'UPDATE', 'Permission', `${isNewPerm ? 'Created' : 'Updated'} ${companyScopeId ? 'company ' : ''}permission ${key}`)
    toast.success(isNewPerm ? 'Company permission created' : 'Permission saved')
    setPermModal(null)
  }

  const doDeletePermission = () => {
    if (!confirmDelete) return
    const p = permissions.find((x) => x.key === confirmDelete.id)
    deletePermission(confirmDelete.id)
    log(me?.id || 'admin', 'DELETE', 'Permission', `Deleted permission ${p?.label || confirmDelete.id}`)
    toast.success('Permission deleted')
    setConfirmDelete(null)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        desc="Create roles and permissions, then assign permissions to each role."
        actions={
          view === 'roles'
            ? <Button onClick={openNewRole}><Plus className="size-4" /> New role</Button>
            : view === 'permissions'
              ? <Button onClick={openNewPermission}><Plus className="size-4" /> New permission</Button>
              : undefined
        }
      />
      <div className="mb-4"><Segmented value={view} onChange={setView} options={[{ id: 'roles', label: 'Roles' }, { id: 'permissions', label: 'Permissions' }, { id: 'matrix', label: 'Matrix' }]} /></div>
      <div className="mb-4 rounded-xl border border-lime/25 bg-lime/10 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">
        <span className="font-semibold">{companyScopeId ? `Company scope · ${app.activeCompany?.name || companyScopeId}` : 'Platform scope · Super Admin'}</span>
        <span className="ml-2 text-mist">Built-in definitions are protected; custom definitions stay in this scope.</span>
      </div>

      {view === 'matrix' && <PermissionMatrix />}

      {view === 'roles' && (
        <div className="card">
          <DataTable
            columns={roleColumns}
            data={roles}
            rowKey={(r) => r.id}
            emptyTitle="No roles"
            emptyDesc="Create your first role with the New role button."
          />
        </div>
      )}

      {view === 'permissions' && (<>
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><strong>Access-control status:</strong> Existing definitions are shown under their modules. Menu-level actions are a catalog only and are not enforced. Student portal permissions are enforced separately in the Student role editor.</div>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map(module => {
            const groups = MODULE_PERMISSION_GROUPS[module.id] || []
            const list = permissions.filter(p => groups.includes(p.group))
            const root = NAV.find(entry => module.navKeys.includes(entry.key))
            const menus = root ? menuLeaves(root) : []
            return <div key={module.id} className="card p-4">
              <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">{module.label}</p><span className="text-xs text-mist">{app.modules[module.id] === false ? 'Module off' : 'Module on'}</span></div>
              {list.length ? <ul className="mt-2 space-y-1.5">{list.map(p => <li key={p.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"><div className="min-w-0"><p className="break-words font-semibold">{p.label}</p><p className="break-all font-mono text-[11px] text-mist">{p.key}</p></div>{p.builtin ? <Lock className="size-3.5 shrink-0 text-mist" aria-label="Built-in permission"/> : <span className="flex shrink-0"><button className="rounded p-1 text-mist hover:text-lime" onClick={()=>openEditPermission(p)} aria-label={`Edit ${p.label}`}><Pencil className="size-4"/></button><button className="rounded p-1 text-mist hover:text-ember" onClick={()=>setConfirmDelete({type:'permission',id:p.key})} aria-label={`Delete ${p.label}`}><Trash2 className="size-4"/></button></span>}</li>)}</ul> : <p className="mt-3 text-sm text-mist">No existing permission definitions for this module.</p>}
              <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-semibold">Available menus ({menus.length})</summary><p className="mt-2 text-xs text-mist">Catalog only — individual menu permissions are not enforced.</p>{menus.length ? <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm text-mist">{menus.map(menu=><li key={menu.key} className="break-words">{t(menu.key)}</li>)}</ul> : <p className="mt-2 text-sm text-mist">No separate menus listed.</p>}</details>
            </div>
          })}
        </div>
        {permissionGroups.filter(g=>!Object.values(MODULE_PERMISSION_GROUPS).some(groups=>groups.includes(g)) && (byGroup.get(g)||[]).length>0).map(g=><div key={g} className="card mt-4 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">{g} · Other / portal permissions</p><ul className="mt-2 space-y-1.5">{(byGroup.get(g)||[]).map(p=><li key={p.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"><div className="min-w-0"><p className="break-words font-semibold">{p.label}</p><p className="break-all font-mono text-[11px] text-mist">{p.key}</p></div>{p.builtin ? <Lock className="size-3.5 shrink-0 text-mist" aria-label="Built-in permission"/> : <span className="flex shrink-0"><button className="rounded p-1 text-mist hover:text-lime" onClick={()=>openEditPermission(p)} aria-label={`Edit ${p.label}`}><Pencil className="size-4"/></button><button className="rounded p-1 text-mist hover:text-ember" onClick={()=>setConfirmDelete({type:'permission',id:p.key})} aria-label={`Delete ${p.label}`}><Trash2 className="size-4"/></button></span>}</li>)}</ul></div>)}
      </>)}

      {studentPermissionsOpen && me && <StudentPermissions key={app.activeCompanyId} userId={me.id} email={me.email} companyId={app.activeCompanyId} companyName={app.activeCompany?.name || 'Selected company'} onClose={()=>setStudentPermissionsOpen(false)} />}
      {/* Role editor */}
      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title={isNewRole ? 'New role' : `Edit role — ${roleModal?.name || ''}`} wide>
        {roleModal && (
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role name" required>
                <Input value={roleModal.name} disabled={!isNewRole} onChange={(e) => setRoleModal({ ...roleModal, name: e.target.value })} placeholder="e.g. Receptionist" />
              </Field>
              <Field label="Portal">
                <Select
                  value={roleModal.portal}
                  disabled={!isNewRole}
                  onChange={(e) => {
                    const portal = e.target.value as RoleDef['portal']
                    // Switching portal resets the permission selection to that
                    // portal's relevant set so the list reflects the portal.
                    const relevant = groupsForPortal(portal)
                    const keys = permissions.filter((p) => relevant.includes(p.group)).map((p) => p.key)
                    setRoleModal({ ...roleModal, portal, permissions: keys })
                  }}
                >
                  <option value="admin">Admin console</option>
                  <option value="coach">Coach portal</option>
                  <option value="member">Member app</option>
                  <option value="customer">Customer portal</option>
                  <option value="supplier">Supplier portal</option>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description"><Input value={roleModal.description} onChange={(e) => setRoleModal({ ...roleModal, description: e.target.value })} placeholder="What this role is for" /></Field>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Permissions</p>
                <span className="text-xs text-mist">{roleModal.permissions.length} selected</span>
              </div>
              <div className="max-h-[46vh] space-y-3 overflow-y-auto rounded-xl border border-line p-3">
                {groupsForPortal(roleModal.portal).map((g) => {
                  const list = byGroup.get(g) || []
                  if (!list.length) return null
                  const allOn = list.every((p) => roleModal.permissions.includes(p.key))
                  return (
                    <div key={g}>
                      <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-semibold">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#c8f542]"
                          checked={allOn}
                          onChange={() => {
                            const keys = list.map((p) => p.key)
                            setRoleModal((d) => d && ({
                              ...d,
                              permissions: allOn
                                ? d.permissions.filter((k) => !keys.includes(k))
                                : Array.from(new Set([...d.permissions, ...keys])),
                            }))
                          }}
                        />
                        {g}
                      </label>
                      <div className="ml-6 mt-1 grid gap-1 sm:grid-cols-2">
                        {list.map((p) => (
                          <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm text-mist hover:bg-white/5">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-[#c8f542]"
                              checked={roleModal.permissions.includes(p.key)}
                              onChange={() => togglePerm(p.key)}
                            />
                            <span>{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoleModal(null)}>Cancel</Button>
              <Button onClick={saveRole}>{isNewRole ? 'Create role' : 'Save role'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Permission editor */}
      <Modal open={!!permModal} onClose={() => setPermModal(null)} title={isNewPerm ? 'New permission' : 'Edit permission'}>
        {permModal && (
          <div className="grid gap-3">
            <Field label="Label" required><Input value={permModal.label} onChange={(e) => setPermModal({ ...permModal, label: e.target.value, key: isNewPerm ? slugifyRole(e.target.value).replace('role_', 'custom.') : permModal.key })} placeholder="e.g. Manage membership freezes" /></Field>
            <Field label="Key">
              <Input value={permModal.key} disabled={!isNewPerm} onChange={(e) => setPermModal({ ...permModal, key: e.target.value })} placeholder="custom.manage_freezes" className="font-mono" />
              {companyScopeId && <p className="mt-1 text-[11px] text-mist">New permission keys are stored under this company: {companyScopeId}</p>}
            </Field>
            <Field label="Group">
              {newGroup ? (
                <div className="flex gap-2">
                  <Input value={permModal.group} onChange={(e) => setPermModal({ ...permModal, group: e.target.value })} placeholder="New group name" />
                  <Button variant="outline" size="sm" onClick={() => { setNewGroup(false); setPermModal({ ...permModal, group: permissionGroups[0] || 'General' }) }}>Cancel</Button>
                </div>
              ) : (
                <Select value={permModal.group} onChange={(e) => {
                  if (e.target.value === '__new__') { setNewGroup(true); setPermModal({ ...permModal, group: '' }) }
                  else setPermModal({ ...permModal, group: e.target.value })
                }}>
                  {permissionGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                  <option value="__new__">New group…</option>
                </Select>
              )}
            </Field>
            <Field label="Description"><Textarea value={permModal.description} onChange={(e) => setPermModal({ ...permModal, description: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPermModal(null)}>Cancel</Button>
              <Button onClick={savePermission}>{isNewPerm ? 'Create permission' : 'Save permission'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Confirm delete">
        <p className="text-sm text-mist">
          {confirmDelete?.type === 'role'
            ? 'Deleting this role will reassign its users to a default role. This cannot be undone.'
            : 'Deleting this permission removes it from every role. This cannot be undone.'}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => (confirmDelete?.type === 'role' ? doDeleteRole() : doDeletePermission())}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

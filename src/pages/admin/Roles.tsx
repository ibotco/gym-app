import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Lock } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Segmented, Empty } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { PERMISSION_GROUPS, portalGroups, slugifyRole } from '../../lib/permissions'
import { PermissionMatrix } from './PermissionMatrix'
import type { Permission, RoleDef } from '../../types'

const portalLabel = (p: RoleDef['portal']) =>
  p === 'admin' ? 'Admin console' : p === 'coach' ? 'Coach portal' : p === 'member' ? 'Member app' : p === 'customer' ? 'Customer portal' : 'Supplier portal'

type RoleDraft = { id: string; name: string; description: string; portal: RoleDef['portal']; permissions: string[] }

function toDraft(r: RoleDef): RoleDraft {
  return { id: r.id, name: r.name, description: r.description || '', portal: r.portal, permissions: [...r.permissions] }
}

export function RolesAdmin() {
  const app = useApp()
  const { user: me, hasPermission } = useAuth()
  const toast = useToast()
  const { roles, permissions, users, upsertRole, deleteRole, upsertPermission, deletePermission, patchUser, log } = app

  const canManage = hasPermission('roles.manage')

  const [view, setView] = useState('roles')
  const [roleModal, setRoleModal] = useState<RoleDraft | null>(null)
  const [isNewRole, setIsNewRole] = useState(false)
  const [permModal, setPermModal] = useState<{ key: string; label: string; group: string; description: string } | null>(null)
  const [isNewPerm, setIsNewPerm] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'role' | 'permission'; id: string } | null>(null)

  const byGroup = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const g of PERMISSION_GROUPS) map.set(g, [])
    for (const p of permissions) {
      const list = map.get(p.group) || []
      list.push(p)
      map.set(p.group, list)
    }
    return map
  }, [permissions])

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
    { key: 'users', header: 'Users', sortValue: (r) => usersInRole(r.id), align: 'center', render: (r) => usersInRole(r.id) },
    { key: 'perms', header: 'Permissions', sortValue: (r) => r.permissions.length, align: 'center', render: (r) => r.permissions.length },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="whitespace-nowrap">
          <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEditRole(r)} aria-label={`Edit ${r.name}`}><Pencil className="size-4" /></button>
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
    setRoleModal({ id: slugifyRole('New role'), name: '', description: '', portal: 'admin', permissions: [] })
  }

  const openEditRole = (r: RoleDef) => {
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
    const id = isNewRole ? slugifyRole(roleModal.name) : roleModal.id
    if (isNewRole && roles.some((r) => r.id === id)) { toast.error('A role with that name already exists.'); return }
    const original = roles.find((r) => r.id === roleModal.id)
    const record: RoleDef = {
      id,
      name: roleModal.name.trim(),
      description: roleModal.description.trim() || undefined,
      portal: roleModal.portal,
      permissions: roleModal.permissions,
      builtin: original?.builtin,
      color: original?.color,
    }
    upsertRole(record)
    log(me?.id || 'admin', isNewRole ? 'CREATE' : 'UPDATE', 'Role', `${isNewRole ? 'Created' : 'Updated'} role ${record.name}`)
    toast.success(isNewRole ? 'Role created' : 'Role saved')
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
    setPermModal({ key: '', label: '', group: PERMISSION_GROUPS[0], description: '' })
  }

  const savePermission = () => {
    if (!permModal) return
    if (permModal.label.trim().length < 2) { toast.error('Permission label must be at least 2 characters.'); return }
    const group = permModal.group.trim() || 'General'
    let key = isNewPerm ? permModal.key.trim() || slugifyRole(permModal.label).replace('role_', 'custom.') : permModal.key
    if (!key) { toast.error('Enter a permission key.'); return }
    const collision = permissions.some((p) => p.key === key && p.key !== permModal.key)
    if (collision) { toast.error('That permission key already exists.'); return }
    upsertPermission({ key, label: permModal.label.trim(), group, description: permModal.description.trim() || undefined, builtin: false })
    log(me?.id || 'admin', isNewPerm ? 'CREATE' : 'UPDATE', 'Permission', `${isNewPerm ? 'Created' : 'Updated'} permission ${key}`)
    toast.success(isNewPerm ? 'Permission created' : 'Permission saved')
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

      {view === 'permissions' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PERMISSION_GROUPS.map((g) => {
            const list = byGroup.get(g) || []
            if (!list.length) return null
            return (
              <div key={g} className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">{g}</p>
                <ul className="mt-2 space-y-1.5">
                  {list.map((p) => (
                    <li key={p.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.label}</p>
                        <p className="truncate font-mono text-[11px] text-mist">{p.key}</p>
                      </div>
                      {p.builtin
                        ? <Lock className="size-3.5 shrink-0 text-mist" aria-label="Built-in permission" />
                        : <button className="shrink-0 rounded p-1 text-mist hover:text-ember" onClick={() => setConfirmDelete({ type: 'permission', id: p.key })} aria-label={`Delete ${p.label}`}><Trash2 className="size-4" /></button>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

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
                    const relevant = portalGroups(portal)
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
                {portalGroups(roleModal.portal).map((g) => {
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
              <Input value={permModal.key} onChange={(e) => setPermModal({ ...permModal, key: e.target.value })} placeholder="custom.manage_freezes" className="font-mono" />
            </Field>
            <Field label="Group">
              {newGroup ? (
                <div className="flex gap-2">
                  <Input value={permModal.group} onChange={(e) => setPermModal({ ...permModal, group: e.target.value })} placeholder="New group name" />
                  <Button variant="outline" size="sm" onClick={() => { setNewGroup(false); setPermModal({ ...permModal, group: PERMISSION_GROUPS[0] }) }}>Cancel</Button>
                </div>
              ) : (
                <Select value={permModal.group} onChange={(e) => {
                  if (e.target.value === '__new__') { setNewGroup(true); setPermModal({ ...permModal, group: '' }) }
                  else setPermModal({ ...permModal, group: e.target.value })
                }}>
                  {PERMISSION_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
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

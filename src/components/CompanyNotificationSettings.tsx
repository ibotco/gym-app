import { useEffect, useMemo, useState } from 'react'
import { Eye, PencilLine, RotateCcw } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, SearchField, Textarea } from './ui'
import { cloneCompanyNotificationSettings, DEFAULT_COMPANY_NOTIFICATION_SETTINGS, loadCompanyNotificationSettings } from '../lib/companyNotificationSettings'
import { MODULES, type ModuleState } from '../lib/modules'
import type { CompanyNotificationSetting, NotificationDestination, NotificationRecipient } from '../types'

const DESTINATIONS: { id: NotificationDestination; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'mobile', label: 'Mobile App' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

const RECIPIENTS: { id: NotificationRecipient; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'guardian', label: 'Guardian' },
  { id: 'member', label: 'Member' },
  { id: 'staff', label: 'Staff' },
  { id: 'trainer', label: 'Trainer' },
  { id: 'customer', label: 'Customer' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'user', label: 'User' },
  { id: 'approver', label: 'Approver' },
  { id: 'manager', label: 'Manager' },
  { id: 'admin', label: 'Administrator' },
  { id: 'donor', label: 'Donor' },
  { id: 'visitor', label: 'Visitor' },
]

const MODULE_LABELS = new Map(MODULES.map((module) => [module.id, module.label]))
const moduleLabel = (id: string) => MODULE_LABELS.get(id) ?? id

type TemplateModal =
  | { mode: 'view'; id: string }
  | { mode: 'edit'; id: string; message: string }
  | null

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function CompanyNotificationSettings({
  settings,
  modules,
  onSave,
}: {
  settings?: CompanyNotificationSetting[]
  modules: ModuleState
  onSave: (settings: CompanyNotificationSetting[]) => void
}) {
  const [rows, setRows] = useState<CompanyNotificationSetting[]>(() => loadCompanyNotificationSettings(settings))
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<TemplateModal>(null)

  useEffect(() => {
    setRows(loadCompanyNotificationSettings(settings))
  }, [settings])

  const visibleRows = useMemo(
    () => rows.filter((row) => modules[row.moduleId] === true),
    [rows, modules],
  )
  const enabledModuleCount = useMemo(
    () => new Set(visibleRows.map((row) => row.moduleId)).size,
    [visibleRows],
  )
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return visibleRows
    return visibleRows.filter((row) =>
      `${row.event} ${moduleLabel(row.moduleId)} ${row.sampleMessage}`.toLocaleLowerCase().includes(normalized),
    )
  }, [visibleRows, query])

  const updateRow = (id: string, patch: Partial<CompanyNotificationSetting>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  const activeModalRow = modal ? rows.find((row) => row.id === modal.id) : undefined

  return (
    <div className="mt-4 space-y-4">
      <PageHeader
        eyebrow="Communication"
        title="Notification settings"
        desc="Events follow the sidebar modules. New modules get a starter event automatically; only enabled modules are shown. Channel, recipient, and template choices are saved per event."
        actions={(
          <>
            <Button
              variant="outline"
              onClick={() => setRows(cloneCompanyNotificationSettings(DEFAULT_COMPANY_NOTIFICATION_SETTINGS))}
              title="Restore the starter event list and sample templates"
            >
              <RotateCcw className="size-4" /> Restore defaults
            </Button>
            <Button onClick={() => onSave(cloneCompanyNotificationSettings(rows))}>
              Save settings
            </Button>
          </>
        )}
      />

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{visibleRows.length} events</Badge>
          <span className="text-sm text-mist">Across {enabledModuleCount} active modules with events · saved with company settings in this browser.</span>
        </div>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search modules, events or messages…"
          className="w-full sm:max-w-sm"
        />
      </div>

      <div className="rounded-2xl border border-line bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto rounded-2xl">
          <table className="data min-w-[1600px] w-full">
            <thead>
              <tr>
                <th className="w-[160px]">Module</th>
                <th className="w-[210px]">Notification event</th>
                <th className="w-[250px]">Destination</th>
                <th className="w-[220px]">Recipient</th>
                <th className="w-[175px]">SMS template ID</th>
                <th className="w-[210px]">WhatsApp template ID</th>
                <th className="min-w-[390px]">Sample message</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td><Badge tone="zinc">{moduleLabel(row.moduleId)}</Badge></td>
                  <td className="font-semibold text-ink dark:text-zinc-100">{row.event}</td>
                  <td>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {DESTINATIONS.filter((option) => row.availableDestinations.includes(option.id)).map((option) => (
                        <label key={option.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-ink/80 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[#c8f542]"
                            checked={row.destinations.includes(option.id)}
                            aria-label={`${row.event}: send via ${option.label}`}
                            onChange={() => updateRow(row.id, { destinations: toggleValue(row.destinations, option.id) })}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {RECIPIENTS.filter((option) => row.availableRecipients.includes(option.id)).map((option) => (
                        <label key={option.id} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-ink/80 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-[#c8f542]"
                            checked={row.recipients.includes(option.id)}
                            aria-label={`${row.event}: notify ${option.label}`}
                            onChange={() => updateRow(row.id, { recipients: toggleValue(row.recipients, option.id) })}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Input
                      value={row.smsTemplateId}
                      onChange={(event) => updateRow(row.id, { smsTemplateId: event.target.value })}
                      placeholder="Not set"
                      aria-label={`${row.event} SMS template ID`}
                      className="min-w-[145px] text-xs"
                    />
                  </td>
                  <td>
                    <Input
                      value={row.whatsappTemplateId}
                      onChange={(event) => updateRow(row.id, { whatsappTemplateId: event.target.value })}
                      placeholder="Not set"
                      aria-label={`${row.event} WhatsApp template ID`}
                      className="min-w-[180px] text-xs"
                    />
                  </td>
                  <td>
                    <div className="max-w-[430px]">
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-ink/75 dark:text-zinc-300">
                        {row.sampleMessage || 'No sample message added.'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setModal({ mode: 'edit', id: row.id, message: row.sampleMessage })}
                        >
                          <PencilLine className="size-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setModal({ mode: 'view', id: row.id })}
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-mist">
                    {visibleRows.length === 0
                      ? 'No notification events are available. Enable a module with notification events in Module Management.'
                      : `No notification events match “${query}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs text-mist">
          Template IDs and message examples are configuration data. Actual email, SMS, mobile-app, or WhatsApp delivery depends on the relevant channel being integrated.
        </p>
        <Button onClick={() => onSave(cloneCompanyNotificationSettings(rows))}>Save settings</Button>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? `Edit sample message${activeModalRow ? ` · ${activeModalRow.event}` : ''}` : `Sample message${activeModalRow ? ` · ${activeModalRow.event}` : ''}`}
        wide
      >
        {modal?.mode === 'edit' && activeModalRow && (
          <div className="space-y-4">
            <p className="text-sm text-mist">Keep template placeholders such as <code className="rounded bg-black/5 px-1 dark:bg-white/10">{'{{student_name}}'}</code> intact so they can be replaced with event data.</p>
            <Field label="Message template">
              <Textarea
                rows={9}
                value={modal.message}
                onChange={(event) => setModal({ ...modal, message: event.target.value })}
                className="min-h-[210px] font-mono text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={() => {
                updateRow(modal.id, { sampleMessage: modal.message })
                setModal(null)
              }}>Apply to draft</Button>
            </div>
          </div>
        )}
        {modal?.mode === 'view' && activeModalRow && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-black/[0.02] p-4 dark:bg-white/[0.03]">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink dark:text-zinc-100">
                {activeModalRow.sampleMessage || 'No sample message added.'}
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setModal(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

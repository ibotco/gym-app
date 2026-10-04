import { useState } from 'react'
import { Save, TerminalSquare, Info } from 'lucide-react'
import { PageHeader, Button, Field, Input, Textarea, DatePicker, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { APP_VERSION } from '../../lib/version'

/**
 * Developer-managed system settings. Only the Super Admin (developer seat)
 * can open this page — the App Version shown in the dashboard footer is
 * controlled here, not from Company settings.
 */
export function SystemSettingsPage() {
  const { systemSettings, setSystemSettings, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({
    appName: systemSettings.appName,
    appVersion: systemSettings.appVersion,
    releaseDate: systemSettings.releaseDate || '',
    releaseNotes: systemSettings.releaseNotes || '',
  })

  const save = () => {
    const appName = form.appName.trim()
    if (!appName) { toast.error('Enter an application name.'); return }
    const version = form.appVersion.trim()
    if (!version) { toast.error('Enter an application version.'); return }
    setSystemSettings({
      appName,
      appVersion: version,
      releaseDate: form.releaseDate || undefined,
      releaseNotes: form.releaseNotes.trim() || undefined,
    })
    log(user?.id || 'system', 'UPDATE', 'SystemSettings', `${appName} — version set to ${version}`)
    toast.success('System settings saved', `Footer now shows ${appName} · Version ${version}.`)
  }

  return (
    <div>
      <PageHeader
        title="System settings"
        desc="Developer-managed application settings. These apply across every company and branch."
        actions={<Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><Save className="size-4" /> Save</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-4" />
            <h3 className="font-semibold">Application release</h3>
          </div>
          <p className="mt-1 text-sm text-mist">Shown in the dashboard footer as “Copyright © {form.appName || '…'} {new Date().getFullYear()} … Version {form.appVersion || '…'}”.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="App Name" required>
              <Input value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })} placeholder="e.g. iGracesoft App" />
            </Field>
            <Field label="App Version" required>
              <Input value={form.appVersion} onChange={(e) => setForm({ ...form, appVersion: e.target.value })} placeholder="7.0" className="font-mono" />
            </Field>
            <Field label="Release date">
              <DatePicker value={form.releaseDate} onChange={(v) => setForm({ ...form, releaseDate: v })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Release notes">
              <Textarea rows={4} value={form.releaseNotes} onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })} placeholder="What changed in this release…" />
            </Field>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Info className="size-4" />
            <h3 className="font-semibold">Build information</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-mist">App name</span>
              <span className="font-semibold">{systemSettings.appName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-mist">Code build version</span>
              <Badge tone="zinc">{APP_VERSION}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-mist">Displayed version</span>
              <Badge tone="lime">{systemSettings.appVersion}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-mist">Release date</span>
              <span className="font-semibold">{systemSettings.releaseDate || '—'}</span>
            </div>
            <p className="pt-1 text-xs text-mist">
              The code build version is fixed at compile time (<code className="font-mono">src/lib/version.ts</code>).
              The displayed version above overrides it in the footer and can be updated here after deploying an update package.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

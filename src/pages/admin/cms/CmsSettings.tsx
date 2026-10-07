import { useState } from 'react'
import { Save, Undo2 } from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Textarea, Switch } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import type { CmsSettings } from '../../../lib/cms'

const LANGUAGES = ['English', 'French', 'Twi', 'Spanish', 'Arabic']

export function CmsSettingsPage() {
  const { cms, setCms, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [s, setS] = useState<CmsSettings>({ ...cms.settings, socialLinks: { ...cms.settings.socialLinks } })

  const setSocial = (k: keyof CmsSettings['socialLinks'], v: string) => setS({ ...s, socialLinks: { ...s.socialLinks, [k]: v } })

  const save = () => {
    setCms({ ...cms, settings: s })
    log(user?.id || 'system', 'UPDATE', 'FrontCMS', 'Updated CMS settings')
    toast.success('CMS settings saved')
  }

  const cancel = () => { setS({ ...cms.settings, socialLinks: { ...cms.settings.socialLinks } }); toast.info('Changes discarded') }

  const image = (label: string, value?: string, onChange?: (v?: string) => void) => (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-2">
          <img src={value} alt="" className="h-12 w-12 rounded object-contain" />
          <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ember" onClick={() => onChange?.(undefined)}>Remove</button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-3 py-3 text-xs text-mist hover:border-lime/50">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return
            const r = new FileReader(); r.onload = () => onChange?.(String(r.result)); r.readAsDataURL(f)
          }} />
        </label>
      )}
    </Field>
  )

  return (
    <div>
      <PageHeader title="CMS settings" desc="Configure your public website." />
      <div className="mt-4 max-w-2xl space-y-4">
        <div className="card p-5">
          <p className="font-semibold">General</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Website name"><Input value={s.websiteName} onChange={(e) => setS({ ...s, websiteName: e.target.value })} /></Field>
            <Field label="Default language"><Select value={s.defaultLanguage} onChange={(e) => setS({ ...s, defaultLanguage: e.target.value })}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</Select></Field>
            {image('Website logo', s.logoImage, (v) => setS({ ...s, logoImage: v }))}
            {image('Favicon', s.faviconImage, (v) => setS({ ...s, faviconImage: v }))}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Contact information</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Address"><Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
            <Field label="Contact info"><Input value={s.contactInfo} onChange={(e) => setS({ ...s, contactInfo: e.target.value })} /></Field>
            <Field label="Email address"><Input value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
            <Field label="Phone number"><Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Social media links</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Facebook"><Input value={s.socialLinks.facebook || ''} onChange={(e) => setSocial('facebook', e.target.value)} placeholder="https://facebook.com/…" /></Field>
            <Field label="Instagram"><Input value={s.socialLinks.instagram || ''} onChange={(e) => setSocial('instagram', e.target.value)} placeholder="https://instagram.com/…" /></Field>
            <Field label="X (Twitter)"><Input value={s.socialLinks.twitter || ''} onChange={(e) => setSocial('twitter', e.target.value)} placeholder="https://x.com/…" /></Field>
            <Field label="YouTube"><Input value={s.socialLinks.youtube || ''} onChange={(e) => setSocial('youtube', e.target.value)} placeholder="https://youtube.com/…" /></Field>
            <Field label="LinkedIn"><Input value={s.socialLinks.linkedin || ''} onChange={(e) => setSocial('linkedin', e.target.value)} placeholder="https://linkedin.com/…" /></Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Footer & maps</p>
          <div className="mt-3 space-y-3">
            <Field label="Footer text"><Textarea value={s.footerText} onChange={(e) => setS({ ...s, footerText: e.target.value })} rows={2} /></Field>
            <Field label="Google Maps embed URL"><Input value={s.googleMapsUrl || ''} onChange={(e) => setS({ ...s, googleMapsUrl: e.target.value })} placeholder="https://maps.google.com/…" /></Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Status & SEO</p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"><span className="text-sm font-semibold">Enable website</span><Switch checked={s.websiteEnabled} onChange={(v) => setS({ ...s, websiteEnabled: v })} /></label>
            <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"><span className="text-sm font-semibold">Maintenance mode</span><Switch checked={s.maintenanceMode} onChange={(v) => setS({ ...s, maintenanceMode: v })} /></label>
            <Field label="Meta keywords"><Input value={s.metaKeywords} onChange={(e) => setS({ ...s, metaKeywords: e.target.value })} /></Field>
            <Field label="Meta description"><Textarea value={s.metaDescription} onChange={(e) => setS({ ...s, metaDescription: e.target.value })} rows={2} /></Field>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancel}><Undo2 className="size-4" /> Cancel</Button>
          <Button onClick={save}><Save className="size-4" /> Save settings</Button>
        </div>
      </div>
    </div>
  )
}

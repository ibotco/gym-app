import { useState } from 'react'
import { Save, Undo2 } from 'lucide-react'
import { PageHeader, Button, Field, Input, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { DEFAULT_FRONTEND_CMS } from '../../data/seed'
import type { FrontendCmsSettings } from '../../types'

export function FrontendCms() {
  const { company, setCompany } = useApp()
  const toast = useToast()

  const [cms, setCms] = useState<FrontendCmsSettings>(() => ({ ...DEFAULT_FRONTEND_CMS, ...(company.frontendCms || {}) }))
  const set = (patch: Partial<FrontendCmsSettings>) => setCms((c) => ({ ...c, ...patch }))

  const save = () => {
    setCompany({ ...company, frontendCms: cms })
    toast.success('Frontend CMS settings saved')
  }

  const cancel = () => {
    setCms({ ...DEFAULT_FRONTEND_CMS, ...(company.frontendCms || {}) })
    toast.info('Changes discarded')
  }

  return (
    <div>
      <PageHeader title="Frontend CMS settings" desc="Manage the content shown on your public website." />

      <div className="mt-4 max-w-2xl space-y-4">
        <div className="card p-5">
          <p className="font-semibold">Hero section</p>
          <div className="mt-3 space-y-3">
            <Field label="Headline (line 1)"><Input value={cms.heroHeadline} onChange={(e) => set({ heroHeadline: e.target.value })} /></Field>
            <Field label="Highlight (line 2)"><Input value={cms.heroHighlight} onChange={(e) => set({ heroHighlight: e.target.value })} /></Field>
            <Field label="Subheadline"><Input value={cms.heroSubheadline} onChange={(e) => set({ heroSubheadline: e.target.value })} /></Field>
            <Field label="Call-to-action text"><Input value={cms.heroCtaText} onChange={(e) => set({ heroCtaText: e.target.value })} /></Field>
            <Field label="Hero background image">
              {cms.heroImage ? (
                <div className="flex items-center gap-2">
                  <img src={cms.heroImage} alt="" className="h-12 w-20 rounded object-cover" />
                  <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ember" onClick={() => set({ heroImage: undefined })}>Remove</button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-3 py-3 text-xs text-mist hover:border-lime/50">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return
                    const r = new FileReader(); r.onload = () => set({ heroImage: String(r.result) }); r.readAsDataURL(f)
                  }} />
                </label>
              )}
            </Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">About section</p>
          <div className="mt-3 space-y-3">
            <Field label="Title"><Input value={cms.aboutTitle} onChange={(e) => set({ aboutTitle: e.target.value })} /></Field>
            <Field label="Body"><Textarea value={cms.aboutBody} onChange={(e) => set({ aboutBody: e.target.value })} rows={4} /></Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Social links</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Instagram"><Input value={cms.socialInstagram || ''} onChange={(e) => set({ socialInstagram: e.target.value })} placeholder="https://instagram.com/…" /></Field>
            <Field label="X (Twitter)"><Input value={cms.socialTwitter || ''} onChange={(e) => set({ socialTwitter: e.target.value })} placeholder="https://x.com/…" /></Field>
            <Field label="Facebook"><Input value={cms.socialFacebook || ''} onChange={(e) => set({ socialFacebook: e.target.value })} placeholder="https://facebook.com/…" /></Field>
            <Field label="YouTube"><Input value={cms.socialYoutube || ''} onChange={(e) => set({ socialYoutube: e.target.value })} placeholder="https://youtube.com/…" /></Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">SEO</p>
          <div className="mt-3 space-y-3">
            <Field label="Meta title"><Input value={cms.seoTitle || ''} onChange={(e) => set({ seoTitle: e.target.value })} /></Field>
            <Field label="Meta description"><Textarea value={cms.seoDescription || ''} onChange={(e) => set({ seoDescription: e.target.value })} rows={3} /></Field>
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

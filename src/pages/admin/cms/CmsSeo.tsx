import { useState } from 'react'
import { Save, Undo2, FileText, Bot } from 'lucide-react'
import { PageHeader, Button, Field, Input, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import type { CmsSeoSettings } from '../../../lib/cms'

export function CmsSeoPage() {
  const { cms, setCms, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [s, setS] = useState<CmsSeoSettings>({ ...cms.seo })

  const save = () => {
    setCms({ ...cms, seo: s })
    log(user?.id || 'system', 'UPDATE', 'FrontCMS', 'Updated SEO settings')
    toast.success('SEO settings saved')
  }

  const cancel = () => { setS({ ...cms.seo }); toast.info('Changes discarded') }

  return (
    <div>
      <PageHeader title="SEO settings" desc="Search-engine optimisation for your website." />
      <div className="mt-4 max-w-2xl space-y-4">
        <div className="card p-5">
          <p className="font-semibold">Metadata</p>
          <div className="mt-3 space-y-3">
            <Field label="Meta title"><Input value={s.metaTitle} onChange={(e) => setS({ ...s, metaTitle: e.target.value })} /></Field>
            <Field label="Meta description"><Textarea value={s.metaDescription} onChange={(e) => setS({ ...s, metaDescription: e.target.value })} rows={2} /></Field>
            <Field label="Meta keywords"><Input value={s.metaKeywords} onChange={(e) => setS({ ...s, metaKeywords: e.target.value })} placeholder="gym, fitness, accra" /></Field>
            <Field label="Canonical URL"><Input value={s.canonicalUrl || ''} onChange={(e) => setS({ ...s, canonicalUrl: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Google Analytics ID"><Input value={s.googleAnalyticsId || ''} onChange={(e) => setS({ ...s, googleAnalyticsId: e.target.value })} placeholder="G-XXXXXXXXXX" /></Field>
            <Field label="Open Graph image">
              {s.ogImage ? (
                <div className="flex items-center gap-2">
                  <img src={s.ogImage} alt="" className="h-12 w-20 rounded object-cover" />
                  <button className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ember" onClick={() => setS({ ...s, ogImage: undefined })}>Remove</button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-3 py-3 text-xs text-mist hover:border-lime/50">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return
                    const r = new FileReader(); r.onload = () => setS({ ...s, ogImage: String(r.result) }); r.readAsDataURL(f)
                  }} />
                </label>
              )}
            </Field>
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold">Tools</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => toast.success('Sitemap generated')}><FileText className="size-4" /> Generate sitemap</Button>
            <Button variant="outline" onClick={() => toast.success('robots.txt generated')}><Bot className="size-4" /> Generate robots.txt</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancel}><Undo2 className="size-4" /> Cancel</Button>
          <Button onClick={save}><Save className="size-4" /> Save SEO settings</Button>
        </div>
      </div>
    </div>
  )
}

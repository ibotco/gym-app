import { useEffect, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { Button, Field, Input, Textarea, Switch } from '../../../components/ui'
import { loadCompanyEmailSettings, saveCompanyEmailSettings, validEmail } from '../../../lib/companyEmailSettings'

export function CompanyEmailSettings() {
  const { activeCompanyId, companies } = useApp()
  const toast = useToast()
  const [settings, setSettings] = useState(() => loadCompanyEmailSettings(activeCompanyId))
  useEffect(() => { setSettings(loadCompanyEmailSettings(activeCompanyId)) }, [activeCompanyId])
  const name = companies.find(c => c.id === activeCompanyId)?.name || 'this company'
  function save() {
    const replyTo = settings.replyTo.trim()
    if (replyTo && !validEmail(replyTo)) { toast.error('Enter a valid reply-to email address.'); return }
    try { saveCompanyEmailSettings(activeCompanyId, { ...settings, replyTo }); toast.success('Email settings saved') }
    catch { toast.error('Could not save email settings in this browser.') }
  }
  return <div className="card mt-4 overflow-hidden">
    <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4"><h2 className="font-semibold">Email settings</h2><p className="text-sm text-mist">For emails sent from {name}</p></div>
    <div className="space-y-6 p-5">
      <p className="text-xs text-mist">Saved in this browser for the selected company. Applies to supported app email sends from this browser, not scheduled or external emails. EmailJS depends on its template.</p>
      <Field label="Reply-to address"><Input type="email" value={settings.replyTo} onChange={e => setSettings({...settings, replyTo:e.target.value})} /><p className="mt-1 text-xs text-mist">Where replies from recipients are delivered.</p></Field>
      <Field label="Signature"><Textarea rows={4} placeholder="Appended to every email you send" value={settings.signature} onChange={e => setSettings({...settings, signature:e.target.value})} /></Field>
      <Field label="Footer"><Textarea rows={3} value={settings.footer} onChange={e => setSettings({...settings, footer:e.target.value})} /></Field>
      <div className="space-y-2"><p className="text-sm font-medium">Send me a copy of every email</p><Switch checked={settings.sendCopy} onChange={v => setSettings({...settings, sendCopy:v})} aria-label="Send me a copy of every email" /><p className="text-xs text-mist">A blind copy goes to the active provider's From email address, including verification emails.</p></div>
      <div className="flex justify-end border-t border-line pt-4"><Button onClick={save}>Save settings</Button></div>
    </div>
  </div>
}

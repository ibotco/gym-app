import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Mail, Plus, Trash2, Pencil, Paperclip } from 'lucide-react'
import { PageHeader, Button, Field, Input, Modal } from '../../../components/ui'
import { RichBodyEditor, plainToHtml, stripHtml } from '../../../components/RichBodyEditor'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useLicense } from '../../../context/LicenseContext'
import { getNoticeAudiences } from '../../../lib/noticeAudiences'
import { useToast } from '../../../context/ToastContext'
import { formatDateTime, uid } from '../../../lib/utils'

type Attachment = { name: string; dataUrl: string; size: number }
type Notice = { id: string; title: string; message: string; createdAt: string; author: string; noticeDate?: string; publishOn?: string; audiences?: string[]; attachment?: Attachment }
type NoticeForm = { id?: string; title: string; message: string; noticeDate: string; publishOn: string; audiences: string[]; attachment?: Attachment }
const noticeKey = (companyId: string) => `fitpro_notice_board_v1_${companyId}`
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const safeMessage = (message: string) => DOMPurify.sanitize(plainToHtml(message), { USE_PROFILES: { html: true } })
function loadNotices(companyId: string): Notice[] {
  try {
    const value = JSON.parse(localStorage.getItem(noticeKey(companyId)) || '[]')
    return Array.isArray(value) ? value.filter((n): n is Notice => n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.message === 'string' && typeof n.createdAt === 'string') : []
  } catch { return [] }
}

export function NotificationsAdmin() {
  const { activeCompanyId, roles, modules } = useApp()
  const { user } = useAuth()
  const { currentPackage, pkgActive } = useLicense()
  const toast = useToast()
  const [notices, setNotices] = useState<Notice[]>(() => loadNotices(activeCompanyId))
  const [selected, setSelected] = useState<string[]>([])
  const [form, setForm] = useState<NoticeForm | null>(null)
  const [view, setView] = useState<Notice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const roleOptions = getNoticeAudiences(roles, activeCompanyId, modules, currentPackage?.modules, pkgActive)
  const unavailableSelected = (form?.audiences || []).filter(id => !roleOptions.some(role => role.id === id))
  useEffect(() => {
    setNotices(loadNotices(activeCompanyId)); setSelected([]); setForm(null); setView(null); setConfirmDelete(false)
    const onStorage = (e: StorageEvent) => { if (e.key === noticeKey(activeCompanyId)) { setNotices(loadNotices(activeCompanyId)); setSelected([]) } }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [activeCompanyId])
  function saveNotices(next: Notice[]) {
    try { localStorage.setItem(noticeKey(activeCompanyId), JSON.stringify(next)); setNotices(next); return true }
    catch { toast.error('Could not save notices in this browser.'); return false }
  }
  function editNotice(n?: Notice) {
    const today = localToday()
    setForm(n ? { id:n.id, title:n.title, message:safeMessage(n.message), noticeDate:n.noticeDate || n.createdAt.slice(0,10), publishOn:n.publishOn || n.createdAt.slice(0,10), audiences:n.audiences || [], attachment:n.attachment } : {title:'', message:'', noticeDate:today, publishOn:today, audiences:[]})
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form || fileBusy) return
    const html = safeMessage(form.message)
    if (!form.title.trim() || !stripHtml(html).trim() || !form.noticeDate || !form.publishOn) { toast.error('Enter a title, notice date, publish date and message.'); return }
    const latest = loadNotices(activeCompanyId)
    if (form.id && !latest.some(n => n.id === form.id)) { toast.error('This notice no longer exists.'); return }
    const fields = { title:form.title.trim(), message:html, noticeDate:form.noticeDate, publishOn:form.publishOn, audiences:form.audiences, attachment:form.attachment }
    const next = form.id
      ? latest.map(n => n.id === form.id ? { ...n, ...fields } : n)
      : [{ id:uid('notice'), ...fields, createdAt:new Date().toISOString(), author:user?.name || 'User' }, ...latest]
    if (saveNotices(next)) { toast.success(form.id ? 'Notice updated' : 'Notice saved'); setForm(null) }
  }
  function addAttachment(file?: File) {
    if (!file) return
    if (file.size > 512 * 1024) { toast.error('Attachment exceeds the 512 KB limit.'); return }
    setFileBusy(true)
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || ''); const base64 = result.split(',')[1]
      if (!base64) toast.error('Could not read attachment.')
      else setForm(prev => prev ? { ...prev, attachment:{name:file.name, size:file.size, dataUrl:`data:application/octet-stream;base64,${base64}`} } : prev)
      setFileBusy(false)
    }
    reader.onerror = () => { setFileBusy(false); toast.error('Could not read attachment.') }
    reader.readAsDataURL(file)
  }
  const deleteSelected = () => {
    const latest = loadNotices(activeCompanyId)
    if (saveNotices(latest.filter(n => !selected.includes(n.id)))) { setSelected([]); setConfirmDelete(false); toast.success('Selected notices deleted') }
  }
  if (form) return <div>
    <PageHeader title={form.id ? 'Edit Message' : 'Compose New Message'} desc="Compose a notice for your company." />
    <form className="card overflow-hidden" onSubmit={submit}>
      <h2 className="border-b border-line px-5 py-4 text-lg font-semibold">{form.id ? 'Edit Message' : 'Compose New Message'}</h2>
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-4">
          <Field label="Title" required><Input value={form.title} maxLength={180} onChange={e => setForm({...form,title:e.target.value})} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Notice Date" required><Input type="date" value={form.noticeDate} onChange={e => setForm({...form,noticeDate:e.target.value})} required /></Field>
            <Field label="Publish On" required><Input type="date" value={form.publishOn} onChange={e => setForm({...form,publishOn:e.target.value})} required /></Field>
          </div>
          <Field label="Attachment">
            {form.attachment && <div className="mb-2 flex items-center gap-2 text-sm"><Paperclip className="size-4" /><span className="min-w-0 flex-1 truncate">{form.attachment.name}</span><button type="button" className="text-ember underline" onClick={() => setForm({...form,attachment:undefined})}>Remove</button></div>}
            <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addAttachment(e.dataTransfer.files[0]) }} className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-line px-3 py-3 text-sm text-mist hover:border-violet-500"><Paperclip className="mr-2 size-4" />Drag and drop a file here or click<input type="file" className="sr-only" onChange={e => { addAttachment(e.target.files?.[0]); e.target.value='' }} /></label>
            <p className="mt-1 text-xs text-mist">One file, maximum 512 KB. Stored with the notice in browser-backed storage.</p>
          </Field>
          <Field label="Message" required><RichBodyEditor tall value={form.message} onChange={message => setForm(prev => prev ? {...prev,message} : prev)} showTags={false} plainTextPaste /></Field>
        </div>
        <aside className="space-y-6">
          <fieldset><legend className="mb-2 text-sm font-semibold">Message To</legend><div className="max-h-64 space-y-2 overflow-y-auto">{roleOptions.map(role => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.audiences.includes(role.id)} onChange={e => setForm({...form,audiences:e.target.checked ? [...form.audiences,role.id] : form.audiences.filter(x => x !== role.id)})} />{role.name}</label>)}</div>{unavailableSelected.length > 0 && <div className="mt-3 border-t border-line pt-2"><p className="mb-2 text-xs text-mist">Previously selected, no longer available:</p>{unavailableSelected.map(id => <label key={id} className="flex items-center gap-2 text-sm text-mist"><input type="checkbox" checked onChange={() => setForm({...form,audiences:form.audiences.filter(x => x !== id)})} />{roles.find(r => r.id === id && (!r.companyId || r.companyId === activeCompanyId))?.name || (id === 'audience_student' ? 'Student' : id === 'audience_parent' ? 'Parent / Guardian' : id === 'audience_congregation' ? 'Congregation' : id)}</label>)}</div>}<p className="mt-2 text-xs text-mist">Roles follow enabled modules, assigned permissions and the active package where mapped. Education and Church use system module switches because company package mappings are unavailable. Audience is recorded only; access and delivery are not restricted by this selection.</p></fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">Send By</legend><div className="space-y-2">{['Email','SMS','Mobile App'].map(channel => <label key={channel} className="flex items-center gap-2 text-sm text-mist"><input type="checkbox" disabled />{channel}</label>)}</div><p className="mt-2 text-xs text-mist">Delivery is not connected.</p></fieldset>
        </aside>
      </div>
      <div className="border-t border-line px-5 py-4"><p className="mb-3 text-xs text-mist">Publish On is recorded as a planned date only; automatic publishing is not active. Notices remain visible to notice-board administrators.</p><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={fileBusy}>{fileBusy ? 'Reading file…' : 'Save notice'}</Button></div></div>
    </form>
  </div>
  return <div>
    <PageHeader title="Notice Board" desc="Post and manage company notices." />
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="text-lg font-semibold">Notice Board</h2><div className="flex flex-wrap gap-2"><Button onClick={() => editNotice()}><Plus className="size-4" /> Post New Message</Button><Button variant="outline" disabled={!selected.length} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete Notice Board{selected.length ? ` (${selected.length})` : ''}</Button></div></div>
      <div className="px-5 py-2">
        {notices.length > 0 && <label className="flex items-center gap-2 border-b border-line py-3 text-xs text-mist"><input type="checkbox" checked={selected.length === notices.length} onChange={e => setSelected(e.target.checked ? notices.map(n => n.id) : [])} /> Select all notices</label>}
        {notices.length === 0 ? <p className="py-10 text-center text-sm text-mist">No notices yet. Post a new message to get started.</p> : <ul>{notices.map(n => <li key={n.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0"><input type="checkbox" aria-label={`Select ${n.title}`} checked={selected.includes(n.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, n.id] : prev.filter(id => id !== n.id))} /><Mail className="size-4 shrink-0 text-violet-500" aria-hidden="true" /><button type="button" className="min-w-0 flex-1 break-words text-left text-sm font-medium text-violet-600 hover:underline dark:text-violet-400" onClick={() => setView(n)}>{n.title}</button><button type="button" className="rounded p-2 text-mist hover:bg-black/5 dark:hover:bg-white/5" aria-label={`Edit ${n.title}`} onClick={() => editNotice(n)}><Pencil className="size-4" /></button></li>)}</ul>}
      </div>
    </div>
    <p className="mt-3 text-xs text-mist">Notices are saved separately from personal notifications. This board uses browser-backed storage; cross-device availability depends on database synchronization. Posting does not send email or SMS.</p>
    {view && <Modal open title={view.title} onClose={() => setView(null)} maxWidth="2xl"><div className="break-words text-sm" dangerouslySetInnerHTML={{__html:safeMessage(view.message)}} />{view.attachment && /^data:application\/octet-stream;base64,[A-Za-z0-9+/=]+$/.test(view.attachment.dataUrl) && <a href={view.attachment.dataUrl} download={view.attachment.name} className="mt-4 inline-flex items-center gap-2 text-sm text-violet-500 underline"><Paperclip className="size-4" />{view.attachment.name}</a>}<p className="mt-5 border-t border-line pt-3 text-xs text-mist">Posted {formatDateTime(view.createdAt)}{view.author ? ` · ${view.author}` : ''}{view.noticeDate ? ` · Notice date: ${view.noticeDate}` : ''}{view.publishOn ? ` · Planned publish date: ${view.publishOn}` : ''}</p></Modal>}
    <Modal open={confirmDelete} title="Delete notices" onClose={() => setConfirmDelete(false)} narrow><p className="text-sm">Delete {selected.length} selected notice{selected.length === 1 ? '' : 's'}? This cannot be undone.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={deleteSelected}>Delete</Button></div></Modal>
  </div>
}

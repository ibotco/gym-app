import { useEffect, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { Button, Field, Input, Textarea } from '../../../components/ui'

type Calendar = { cutoff: string; dates: string }
const blank: Calendar = { cutoff: '', dates: '' }
const storageKey = (id: string) => `fitpro_cron_school_calendar:${id}`
function load(id: string): Calendar {
  try { const value = JSON.parse(localStorage.getItem(storageKey(id)) || '{}'); return { cutoff: typeof value.cutoff === 'string' ? value.cutoff : '', dates: typeof value.dates === 'string' ? value.dates : '' } } catch { return blank }
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function CronSchoolCalendar() {
  const { activeCompanyId } = useApp()
  const toast = useToast()
  const [form, setForm] = useState(() => load(activeCompanyId))
  useEffect(() => setForm(load(activeCompanyId)), [activeCompanyId])
  function save() {
    const dates = form.dates.split(/[\s,]+/).filter(Boolean)
    if (dates.some(d => !validDate(d))) { toast.error('Enter valid school dates in YYYY-MM-DD format.'); return }
    if (form.cutoff && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.cutoff)) { toast.error('Enter a valid cutoff time.'); return }
    try { const saved = { cutoff: form.cutoff, dates: [...new Set(dates)].sort().join('\n') }; localStorage.setItem(storageKey(activeCompanyId), JSON.stringify(saved)); setForm(saved); toast.success('School calendar saved in this browser') }
    catch { toast.error('Could not save the school calendar.') }
  }
  return <section className="card overflow-hidden">
    <div className="border-b border-line px-5 py-3"><h2 className="font-semibold">School calendar for attendance</h2><p className="mt-1 text-sm text-mist">List confirmed school days only. Dates not listed, including holidays, will be excluded.</p></div>
    <div className="space-y-4 p-5">
      <p className="text-sm text-amber-700 dark:text-amber-300">Attendance automation is not active. This draft is saved in this browser only and is not connected to a server job.</p>
      <Field label="Attendance submission cutoff (company timezone)"><Input type="time" value={form.cutoff} onChange={e => setForm({...form,cutoff:e.target.value})}/></Field>
      <Field label="Confirmed school dates"><Textarea rows={6} placeholder={'YYYY-MM-DD, one date per line'} value={form.dates} onChange={e => setForm({...form,dates:e.target.value})}/></Field>
      <div className="flex justify-end"><Button onClick={save}>Save calendar draft</Button></div>
    </div>
  </section>
}

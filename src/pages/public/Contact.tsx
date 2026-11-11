import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { Button, Field, Input, Textarea, Select } from '../../components/ui'
import { BRANCHES, COMPANY } from '../../data/seed'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { uid } from '../../lib/utils'

export function Contact() {
  const [params] = useSearchParams()
  const consult = params.get('consult') === '1'
  const [form, setForm] = useState({
    name: '', email: '', phone: '', interest: consult ? 'Free consultation' : 'General', message: '',
  })
  const { upsertLead } = useApp()
  const toast = useToast()
  const { t } = useI18n()

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('contact.kicker')}</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-5xl">
        {consult ? t('contact.consultTitle') : t('contact.title')}
      </h1>
      <p className="mt-3 max-w-xl text-mist">{t('contact.sub')}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <form
          className="card space-y-3 p-6"
          onSubmit={(e) => {
            e.preventDefault()
            upsertLead({
              id: uid('ld'),
              name: form.name,
              email: form.email,
              phone: form.phone,
              source: 'Contact form',
              status: 'new',
              notes: form.message,
              createdAt: new Date().toISOString().slice(0, 10),
              interest: form.interest,
            })
            toast.success(t('contact.received'), t('contact.receivedSub'))
            setForm({ name: '', email: '', phone: '', interest: 'General', message: '' })
          }}
        >
          <Field label={t('contact.name')}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('auth.email')}><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t('auth.phone')}><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label={t('contact.interest')}>
            <Select value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })}>
              {['General', 'Free consultation', 'Monthly', 'VIP', 'Corporate Wellness', 'PT', 'Yoga'].map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label={t('contact.message')}><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <Button type="submit" className="w-full">{consult ? t('contact.request') : t('contact.send')}</Button>
          <p className="text-xs text-mist">{t('contact.privacy')}</p>
        </form>

        <div className="space-y-4">
          <div className="card grid gap-4 p-6 sm:grid-cols-2">
            <Info icon={<Phone className="size-4" />} t="Phone" d={COMPANY.phone} />
            <Info icon={<Mail className="size-4" />} t="Email" d={COMPANY.email} />
            <Info icon={<MapPin className="size-4" />} t="Flagship" d={COMPANY.address} />
            <Info icon={<Clock className="size-4" />} t="Support" d="Daily 06:00 – 21:00 GMT" />
          </div>
          <div className="map-frame h-72 overflow-hidden rounded-2xl border border-white/10">
            <iframe title="Map" src="https://maps.google.com/maps?q=Airport%20City%20Accra&t=&z=14&ie=UTF8&iwloc=&output=embed" loading="lazy" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BRANCHES.map((b) => (
              <div key={b.id} className="card p-4 text-sm">
                <p className="font-semibold">{b.name}</p>
                <p className="text-mist">{b.address}</p>
                <p className="text-mist">{b.hours}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ icon, t, d }: { icon: ReactNode; t: string; d: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid size-9 place-items-center rounded-lg bg-lime/10 text-lime">{icon}</div>
      <div>
        <p className="text-xs text-mist">{t}</p>
        <p className="font-semibold">{d}</p>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Button } from '../../components/ui'
import { PLANS } from '../../data/seed'
import { formatGhs } from '../../lib/utils'
import { useI18n } from '../../context/I18nContext'

export function Membership() {
  const nav = useNavigate()
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('membership.kicker')}</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">{t('membership.title')}</h1>
      <p className="mt-4 max-w-2xl text-mist">{t('membership.sub')}</p>

      <div className="mt-12 grid gap-4 lg:grid-cols-4">
        {PLANS.filter((p) => p.type !== 'day-pass').map((p) => (
          <div key={p.id} className={`card flex flex-col p-6 ${p.popular ? 'ring-1 ring-lime' : ''}`}>
            {p.popular && <span className="chip mb-3 w-fit bg-lime text-lime-ink">{t('home.mostChosen')}</span>}
            <h2 className="font-display text-xl">{p.name}</h2>
            <p className="stat-num mt-3 text-4xl">{formatGhs(p.price)}</p>
            <p className="text-xs text-mist">{p.durationDays} days · auto-renew optional</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-lime" />{f}</li>
              ))}
            </ul>
            <Button className="mt-6 w-full" onClick={() => nav(`/register?plan=${p.id}`)}>Start {p.name}</Button>
          </div>
        ))}
      </div>

      <div className="mt-6 card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-xl">{t('membership.visiting')}</p>
          <p className="text-sm text-mist">{t('membership.dayPass', { price: formatGhs(60) })}</p>
        </div>
        <Button variant="outline" onClick={() => nav('/register?plan=pl_day')}>{t('membership.buyDay')}</Button>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          ['Freeze', 'Pause up to 30 days a year. Medical freezes unlimited with a note.'],
          ['Guests', 'Monthly includes one guest. Black Card is unlimited, with taste.'],
          ['Cancel', '30 days’ notice on annual. Monthly ends at period close. No hold music.'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-mist">{d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

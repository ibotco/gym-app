import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Star, ShieldCheck, Smartphone, MapPin, Check, Quote } from 'lucide-react'
import { Button } from '../../components/ui'
import { TESTIMONIALS, TRAINERS, PLANS, BLOG, BRANCHES, COMPANY } from '../../data/seed'
import { formatGhs } from '../../lib/utils'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { useI18n } from '../../context/I18nContext'
import { uid } from '../../lib/utils'

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
}

export function Home() {
  const [email, setEmail] = useState('')
  const toast = useToast()
  const { upsertLead } = useApp()
  const nav = useNavigate()
  const { t } = useI18n()

  return (
    <div>
      <section className="relative min-h-[92vh] overflow-hidden">
        <img src="/images/hero.jpg" alt="FitPro training floor" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/25" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-4 pb-16 pt-28 md:px-6 md:pb-24">
          <motion.div initial="hidden" animate="show" variants={fade} className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-lime">
              {t('home.kicker')}
            </p>
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-white md:text-7xl">
              {t('home.hero1')}
              <br />
              <span className="text-lime">{t('home.hero2')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-zinc-300">{t('home.heroSub')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register"><Button size="lg">{t('join')} <ArrowRight className="size-4" /></Button></Link>
              <Link to="/contact?consult=1"><Button size="lg" variant="outline">{t('consult')}</Button></Link>
              <Link to="/membership"><Button size="lg" variant="ghost">{t('viewPlans')}</Button></Link>
            </div>
            <div className="mt-10 flex items-center gap-4 text-sm text-zinc-400">
              <div className="flex -space-x-2">
                {['/images/success-1.jpg', '/images/success-2.jpg', '/images/success-3.jpg', '/images/trainer-2.jpg'].map((s) => (
                  <img key={s} src={s} alt="" className="size-9 rounded-full border-2 border-black object-cover" />
                ))}
              </div>
              {t('home.socialProof')}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-ink-2">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-white/5 md:grid-cols-4 md:divide-x md:divide-y-0">
          {[
            ['2,375', t('home.statMembers')],
            ['18', t('home.statTrainers')],
            ['46', t('home.statClasses')],
            ['4', t('home.statClubs')],
          ].map(([n, l]) => (
            <div key={l} className="px-6 py-8">
              <p className="stat-num text-4xl text-lime md:text-5xl">{n}</p>
              <p className="mt-1 text-sm text-mist">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('home.programming')}</p>
            <h2 className="font-display mt-2 text-3xl font-semibold md:text-4xl">{t('home.featured')}</h2>
          </div>
          <Link to="/services" className="hidden text-sm font-semibold text-lime md:inline-flex md:items-center md:gap-1">
            {t('home.allServices')} <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { img: '/images/program-pt.jpg', t: 'Personal Training', d: '1:1 programming with strength and physique specialists.' },
            { img: '/images/program-hiit.jpg', t: 'Group Classes', d: 'HIIT, Volt Ride, Ringcraft, Reformer — booked to the minute.' },
            { img: '/images/program-nutrition.jpg', t: 'Nutrition Coaching', d: 'Accra-realist macros. No imported-powder religion.' },
            { img: '/images/program-strength.jpg', t: 'Strength & Conditioning', d: 'Barbell literacy for operators, not just athletes.' },
          ].map((p) => (
            <Link key={p.t} to="/services" className="group relative overflow-hidden rounded-2xl">
              <img src={p.img} alt={p.t} className="h-80 w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-display text-xl font-semibold">{p.t}</h3>
                <p className="mt-1 text-sm text-zinc-300">{p.d}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-ink-2 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('home.proof')}</p>
          <h2 className="font-display mt-2 text-3xl font-semibold md:text-4xl">{t('home.success')}</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((story) => (
              <figure key={story.id} className="card p-6">
                <div className="flex items-center gap-3">
                  <img src={story.avatar} alt={story.name} className="size-12 rounded-full object-cover" />
                  <div>
                    <figcaption className="font-semibold">{story.name}</figcaption>
                    <p className="text-xs text-mist">{story.role}</p>
                  </div>
                </div>
                <Quote className="mt-4 size-5 text-lime/60" />
                <blockquote className="mt-2 text-sm leading-relaxed text-zinc-300">“{story.quote}”</blockquote>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-lime">{story.result}</p>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('nav.membership')}</p>
            <h2 className="font-display mt-2 text-3xl font-semibold md:text-4xl">{t('home.pricingTitle')}</h2>
          </div>
          <Link to="/membership" className="text-sm font-semibold text-lime">{t('home.compare')}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.filter((p) => p.type !== 'day-pass').map((p) => (
            <div key={p.id} className={`card relative p-6 ${p.popular ? 'ring-1 ring-lime' : ''}`}>
              {p.popular && <span className="absolute -top-3 right-4 chip bg-lime text-lime-ink">{t('home.mostChosen')}</span>}
              <p className="text-sm text-mist">{p.name}</p>
              <p className="stat-num mt-2 text-4xl">{formatGhs(p.price)}</p>
              <p className="text-xs text-mist">{p.durationDays === 365 ? t('home.perYear') : p.durationDays === 90 ? t('home.perQuarter') : t('home.perMonth')}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-lime" />{f}</li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant={p.popular ? 'lime' : 'outline'} onClick={() => nav(`/register?plan=${p.id}`)}>
                {t('home.start', { name: p.name })}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 md:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('home.coaches')}</p>
            <h2 className="font-display mt-2 text-3xl font-semibold md:text-4xl">{t('home.hire')}</h2>
            <p className="mt-3 text-mist">{t('home.hireSub')}</p>
            <Link to="/trainers" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-lime">{t('home.meetFloor')} <ArrowRight className="size-4" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TRAINERS.map((tr) => (
              <Link key={tr.id} to="/trainers" className="group overflow-hidden rounded-2xl">
                <div className="relative h-56">
                  <img src={tr.photo} alt={tr.userId} className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-semibold">{['Kojo Mensah', 'Amara Cole', 'Erik Holm', 'Priya Nair'][['tr_1', 'tr_2', 'tr_3', 'tr_4'].indexOf(tr.id)]}</p>
                    <p className="text-xs text-mist">{tr.specialties[0]} · {tr.rating} ★</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-900 to-black">
          <div className="grid items-center md:grid-cols-2">
            <div className="p-8 md:p-12">
              <Smartphone className="size-8 text-lime" />
              <h2 className="font-display mt-4 text-3xl font-semibold">{t('home.appTitle')}</h2>
              <p className="mt-3 text-mist">{t('home.appSub')}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {[t('home.app1'), t('home.app2'), t('home.app3'), t('home.app4')].map((x) => (
                  <li key={x} className="flex gap-2"><Check className="size-4 text-lime" />{x}</li>
                ))}
              </ul>
              <div className="mt-6 flex gap-3">
                <Button variant="dark">App Store</Button>
                <Button variant="outline">Google Play</Button>
              </div>
            </div>
            <div className="relative h-80 md:h-full">
              <img src="/images/app-phone.jpg" alt="FitPro mobile app" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-display text-3xl font-semibold">{t('home.journal')}</h2>
          <Link to="/blog" className="text-sm font-semibold text-lime">{t('home.allEssays')}</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {BLOG.slice(0, 3).map((b) => (
            <Link key={b.id} to={`/blog/${b.slug}`} className="card overflow-hidden">
              <img src={b.image} alt="" className="h-44 w-full object-cover" />
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-lime">{b.category} · {b.readMins} min</p>
                <h3 className="mt-2 font-display text-lg font-semibold leading-snug">{b.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-mist">{b.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-ink-2 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-2 md:px-6">
          <div>
            <h2 className="font-display text-3xl font-semibold">{t('home.visit')}</h2>
            <p className="mt-2 text-mist">{COMPANY.address} · {COMPANY.phone}</p>
            <ul className="mt-6 space-y-3">
              {BRANCHES.map((b) => (
                <li key={b.id} className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 size-4 text-lime" />
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-mist">{b.address} · {b.hours}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="map-frame h-80 overflow-hidden rounded-2xl border border-white/10">
            <iframe
              title="FitPro Airport City on Google Maps"
              src="https://maps.google.com/maps?q=Airport%20City%20Accra&t=&z=14&ie=UTF8&iwloc=&output=embed"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="card flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{t('home.newsletter')}</p>
            <h2 className="font-display mt-1 text-2xl font-semibold">{t('home.newsTitle')}</h2>
            <p className="mt-1 text-sm text-mist">{t('home.newsSub')}</p>
          </div>
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              upsertLead({
                id: uid('ld'),
                name: email.split('@')[0],
                email,
                phone: '',
                source: 'Newsletter',
                status: 'new',
                notes: 'Newsletter signup from home',
                createdAt: new Date().toISOString().slice(0, 10),
                interest: 'Newsletter',
              })
              toast.success('You’re on the list.', 'First note lands Friday.')
              setEmail('')
            }}
          >
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" className="field" />
            <Button type="submit">Subscribe</Button>
          </form>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-4 pb-10 text-xs text-mist md:px-6">
        <span className="inline-flex items-center gap-1"><ShieldCheck className="size-4 text-lime" /> JWT · OAuth · GDPR</span>
        <span className="inline-flex items-center gap-1"><Star className="size-4 text-lime" /> WCAG AA surfaces</span>
        <span className="inline-flex items-center gap-1"><Play className="size-4 text-lime" /> Stripe · PayPal · MoMo</span>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Button } from '../../components/ui'
import { TRAINERS, USERS } from '../../data/seed'

export function About() {
  const names: Record<string, string> = {
    tr_1: 'Kojo Mensah',
    tr_2: 'Amara Cole',
    tr_3: 'Erik Holm',
    tr_4: 'Priya Nair',
  }
  return (
    <div>
      <section className="relative h-[48vh] min-h-[340px] overflow-hidden">
        <img src="/images/about-studio.jpg" alt="FitPro lobby" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-black/30" />
        <div className="relative mx-auto flex h-full max-w-7xl items-end px-4 pb-12 md:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">About FitPro</p>
            <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">A serious gym for a serious city.</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-2 md:px-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Overview</h2>
          <p className="mt-4 leading-relaxed text-zinc-300">
            FitPro opened its Airport City flagship in 2023 with a simple argument: Accra already had loud gyms.
            It did not have an operator that treated programming, hospitality, and software as one product.
          </p>
          <p className="mt-3 leading-relaxed text-zinc-300">
            Today we run four clubs — Airport City, Osu, East Legon, and Tema — on a single membership graph.
            Members check in with a QR card. Coaches write plans in the same system finance uses to invoice.
            That is not a slogan. It is the architecture.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Mission', 'Make professional-grade training the default, not the luxury exception, for working Accra.'],
            ['Vision', 'The most trusted fitness operating system in West Africa — clubs people are proud to belong to.'],
            ['Standard', 'Every coach holds a recognised cert. Every floor is staffed. Every number is auditable.'],
            ['Promise', 'If we sold you a plan, we will notice when you stop showing up — and we will call once.'],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-lime">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-2 py-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <h2 className="font-display text-2xl font-semibold">Leadership & floor</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[{ n: 'Naa Adjeley Quaye', r: 'Founder & Super Admin', img: '/images/member-ava-5.jpg' },
              { n: 'Kwesi Ampofo', r: 'General Manager', img: '/images/member-ava-2.jpg' },
              ...TRAINERS.map((t) => ({ n: names[t.id], r: t.specialties[0] + ' · Head', img: t.photo })),
            ].slice(0, 6).map((p) => (
              <div key={p.n} className="overflow-hidden rounded-2xl border border-white/5">
                <img src={p.img} alt={p.n} className="h-64 w-full object-cover object-top" />
                <div className="p-4">
                  <p className="font-semibold">{p.n}</p>
                  <p className="text-xs text-mist">{p.r}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="font-display text-2xl font-semibold">Certifications we recognise</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {['NASM-CPT', 'CSCS', 'USAW L2', 'RYT-500', 'ACE-CPT', 'Precision Nutrition L1', 'FMS', 'Les Mills', 'First Aid / AED', 'ISO 45001 floor ops'].map((c) => (
            <span key={c} className="chip border border-white/10 bg-white/5">{c}</span>
          ))}
        </div>
        <div className="mt-10">
          <Link to="/register"><Button>Join the club</Button></Link>
        </div>
      </section>
    </div>
  )
}

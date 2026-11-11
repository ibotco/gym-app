import { Link } from 'react-router-dom'
import { Button } from '../../components/ui'
import { ArrowRight } from 'lucide-react'

const services = [
  { slug: 'pt', title: 'Personal Training', img: '/images/program-pt.jpg', blurb: 'Bespoke blocks, weekly check-ins, and a coach who reads your calendar.', points: ['Movement screen', 'Periodised plan', 'In-app logging', 'From GHS 150 / session'] },
  { slug: 'group', title: 'Group Classes', img: '/images/program-hiit.jpg', blurb: 'Forty-six sessions a week. Capacity-managed. Waitlists that promote automatically.', points: ['HIIT, ride, boxing, yoga', 'Live capacity', 'Member app booking', 'All plans included'] },
  { slug: 'nutrition', title: 'Nutrition Coaching', img: '/images/program-nutrition.jpg', blurb: 'Macros that survive Accra traffic and Friday waakye.', points: ['Bloodwork review', 'Local food swaps', 'Weekly async notes', 'Quarterly+ included'] },
  { slug: 'loss', title: 'Weight Loss Programmes', img: '/images/success-1.jpg', blurb: 'Twelve-week fat-loss phases with strength protected.', points: ['DEXA / InBody', 'Deficit you can train in', 'Habit scoreboard', 'Retention-backed'] },
  { slug: 'sc', title: 'Strength & Conditioning', img: '/images/program-strength.jpg', blurb: 'Barbell literacy for people with jobs. No circus.', points: ['Squat / hinge / press', 'Aerobic base', 'Meet prep available', 'Platforms at every club'] },
  { slug: 'corp', title: 'Corporate Wellness', img: '/images/gym-floor.jpg', blurb: 'Seat licences for teams. Reporting your people ops will actually open.', points: ['Bulk memberships', 'On-site workshops', 'Anonymised utilisation', 'Invoice monthly'] },
]

export function Services() {
  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-16 md:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Services</p>
        <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">The work, named clearly.</h1>
        <p className="mt-4 max-w-2xl text-mist">Six offers. No “holistic lifestyle packages”. You know what you’re buying.</p>
      </section>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 md:px-6">
        {services.map((s, i) => (
          <article key={s.slug} className={`card grid overflow-hidden md:grid-cols-2 ${i % 2 ? 'md:[&>img]:order-2' : ''}`}>
            <img src={s.img} alt={s.title} className="h-64 w-full object-cover md:h-full" />
            <div className="p-8">
              <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-mist">{s.blurb}</p>
              <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                {s.points.map((p) => <li key={p} className="text-zinc-300">· {p}</li>)}
              </ul>
              <div className="mt-6 flex gap-3">
                <Link to="/contact?consult=1"><Button>Talk to us</Button></Link>
                <Link to="/membership" className="inline-flex items-center gap-1 text-sm font-semibold text-lime">
                  See plans <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

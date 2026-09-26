import { Church, Users, HandCoins, CalendarDays } from 'lucide-react'
import { PageHeader } from '../../components/ui'

const AREAS = [
  { icon: Users, title: 'Congregation Directory', desc: 'Members and families, contact details, membership status and pastoral notes.' },
  { icon: CalendarDays, title: 'Services & Events', desc: 'Service schedules, church events, attendance tracking and check-ins.' },
  { icon: HandCoins, title: 'Tithes & Offerings', desc: 'Giving records, pledges, funds and receipting for every contribution.' },
  { icon: Church, title: 'Groups & Follow-up', desc: 'Ministries, cell groups, visits, counselling and first-timer follow-up.' },
]

export function ChurchManagement() {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Administration</span><span>/</span><span className="font-semibold text-inherit">Church Management</span></div>
      <PageHeader title="Church Management" desc="Manage congregation, services, giving and ministries from one place." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {AREAS.map((a) => (
          <div key={a.title} className="card flex flex-col p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime"><a.icon className="size-5" /></span>
            <p className="mt-3 font-extrabold">{a.title}</p>
            <p className="mt-1 flex-1 text-[12px] text-mist">{a.desc}</p>
            <p className="mt-3 rounded-lg bg-black/5 px-3 py-2 text-[11px] font-bold text-mist dark:bg-white/5">Module workspace in development — screens will appear here in a platform update.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

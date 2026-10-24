import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Avatar, SearchInput, Empty } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { bmi, bmiLabel } from '../../lib/utils'
import { ChevronRight } from 'lucide-react'

export function TrainerMembers() {
  const { user } = useAuth()
  const { trainers, members, users, memberships, plans } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const mine = members.filter((m) => m.trainerId === me?.id)
  const [q, setQ] = useState('')

  const filtered = mine.filter((m) => {
    const u = users.find((x) => x.id === m.userId)
    const hay = `${u?.name ?? ''} ${u?.email ?? ''} ${m.goals.join(' ')}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <div>
      <PageHeader eyebrow="Coach" title="Assigned members" desc={`${mine.length} members assigned to you.`} />
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search members…" /></div>
      {!filtered.length && <Empty title="No members found" desc={q ? 'Try a different search.' : 'No members are assigned to you yet.'} />}
      <ul className="grid gap-3 md:grid-cols-2">
        {filtered.map((m) => {
          const u = users.find((x) => x.id === m.userId)
          const ms = memberships.find((x) => x.id === m.membershipId)
          const plan = plans.find((p) => p.id === (ms?.planId || m.planId))
          const b = bmi(m.weightKg ?? 0, m.heightCm ?? 0)
          return (
            <li key={m.id}>
              <Link to={`/coach/members/${m.id}`} className="card flex items-center gap-3 p-4 transition hover:border-lime/40">
                <Avatar src={u?.avatar} name={u?.name ?? '?'} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u?.name}</p>
                  <p className="truncate text-xs text-mist">{plan?.name ?? 'No plan'} · {m.goals.join(', ') || 'No goals set'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{b ? `${b} BMI` : '—'}</p>
                  <p className="text-xs text-mist">{b ? bmiLabel(b) : ''}</p>
                </div>
                <ChevronRight className="size-4 text-mist" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

import { useState } from 'react'
import { PageHeader, Button, Field, Select, Textarea, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { Sparkles } from 'lucide-react'

export function MemberAI() {
  const { user } = useAuth()
  const { members } = useApp()
  const m = members.find((x) => x.userId === user?.id)
  const [goal, setGoal] = useState(m?.goals[0] || 'Fat loss')
  const [out, setOut] = useState<string | null>(null)

  const generate = () => {
    const name = user?.name.split(' ')[0]
    const recs: Record<string, string> = {
      'Fat loss': `${name}, keep a 400 kcal deficit on training days and 250 on rest days. Protein 1.8g/kg (${m ? Math.round(m.weightKg * 1.8) : 120}g). Three full-body sessions + one Volt Ride. Walk 8k steps — Accra humidity counts, so split them morning/evening. Sleep before you add cardio.`,
      Hypertrophy: `${name}, 4-day upper/lower. Double progression on compounds. 1.6–2.2g/kg protein. Don’t cut harder than 0.4% bodyweight per week or you’ll give the muscle back. Friday Iron Hour stays.`,
      Mobility: `${name}, ten minutes of 90/90 and T-spine before every lift. Sunday Reset is non-negotiable. Strength twice weekly so the new range has something to own.`,
      '5K run': `${name}, two easy Zone-2 runs (traffic-safe loops or treadmill), one interval session, keep the trap-bar work. Heat rule: if it’s 29°C+ at 06:00, the run moves indoors.`,
      Strength: `${name}, squat / hinge / press each week. Singles only if you slept 7h. Accessory work is for joints, not Instagram.`,
    }
    setOut(recs[goal] || recs['Fat loss'])
  }

  return (
    <div>
      <PageHeader eyebrow="AI coach" title="Recommendations" desc="Rule-based guidance using your profile. Not a medical device." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <Field label="Primary goal">
            <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {['Fat loss', 'Hypertrophy', 'Strength', 'Mobility', '5K run'].map((g) => <option key={g}>{g}</option>)}
            </Select>
          </Field>
          <Button onClick={generate}><Sparkles className="size-4" /> Generate plan notes</Button>
          <div className="flex flex-wrap gap-2">
            <Badge tone="lime">Workout</Badge>
            <Badge tone="sky">Nutrition</Badge>
            <Badge tone="amber">Recovery</Badge>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Today’s suggestion</h3>
          {out ? <p className="mt-3 text-sm leading-relaxed text-zinc-300">{out}</p> : <p className="mt-3 text-sm text-mist">Pick a goal and generate.</p>}
          {out && (
            <div className="mt-4 rounded-xl bg-lime/10 p-3 text-sm">
              <p className="font-semibold text-lime">Nutrition cue</p>
              <p className="mt-1">Anchor lunch: grilled tilapia, extra veg, rice scaled to training load. 500ml water before the session.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { PageHeader, Button, Field, Input, StatCard } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { bmi, bmiLabel, uid } from '../../lib/utils'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function MemberProgress() {
  const { user } = useAuth()
  const { members, progress, addProgress, upsertMember } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const logs = progress.filter((p) => p.memberId === m?.id)
  const [w, setW] = useState(String(m?.weightKg || 70))
  const [waist, setWaist] = useState('')
  const last = logs.at(-1)
  const b = m ? bmi(Number(w) || m.weightKg, m.heightCm) : 0

  return (
    <div>
      <PageHeader title="Fitness tracking" desc="Weight, BMI, measurements, workout log." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Current weight" value={`${last?.weight ?? m?.weightKg ?? '—'} kg`} />
        <StatCard label="BMI" value={String(b)} hint={bmiLabel(b)} />
        <StatCard label="Body fat" value={last?.bodyFat ? `${last.bodyFat}%` : '—'} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Weight trend</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={logs}>
                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} domain={['dataMin-2', 'dataMax+2']} />
                <Tooltip />
                <Line dataKey="weight" stroke="#C8F542" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-semibold">Log today</h3>
          <Field label="Weight kg"><Input value={w} onChange={(e) => setW(e.target.value)} /></Field>
          <Field label="Waist cm"><Input value={waist} onChange={(e) => setWaist(e.target.value)} /></Field>
          <Button onClick={() => {
            if (!m) return
            addProgress({ id: uid('pr'), memberId: m.id, date: new Date().toISOString().slice(0, 10), weight: Number(w), waist: waist ? Number(waist) : undefined, notes: '' })
            upsertMember({ ...m, weightKg: Number(w) })
            toast.success('Logged')
          }}>Save</Button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mist">Goal progress</p>
            <ul className="mt-2 text-sm">{m?.goals.map((g) => <li key={g}>· {g}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  )
}

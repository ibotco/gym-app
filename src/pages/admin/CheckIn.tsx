import { useState } from 'react'
import { PageHeader, Button, Input, Select, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/utils'

export function CheckInDesk() {
  const { members, users, branches, checkIn, attendance, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('FITPRO-MB1-AMA')
  const [branchId, setBranchId] = useState('br_airport')
  const [last, setLast] = useState<string | null>(null)

  const scan = () => {
    const m = members.find((x) => x.qrCode.toLowerCase() === code.trim().toLowerCase())
    if (!m) { toast.error('Unknown card'); return }
    const u = users.find((x) => x.id === m.userId)
    checkIn(m.id, branchId)
    log(user?.id || 'desk', 'CHECKIN', 'Attendance', `QR ${m.qrCode} @ ${branchId}`)
    setLast(`${u?.name} checked in`)
    toast.success('Checked in', u?.name)
  }

  return (
    <div>
      <PageHeader title="QR / barcode check-in" desc="Scan a digital card or type the membership code." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card p-6">
          <div className="mx-auto mb-6 grid size-40 place-items-center rounded-2xl bg-white p-3">
            <QrFake value={code} />
          </div>
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input className="mt-3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="FITPRO-…" />
          <Button className="mt-3 w-full" size="lg" onClick={scan}>Check in</Button>
          {last && <p className="mt-3 text-center text-sm text-lime">{last}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {members.slice(0, 6).map((m) => (
              <button key={m.id} onClick={() => setCode(m.qrCode)} className="chip bg-white/5 hover:bg-white/10">
                {m.qrCode}
              </button>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Live tape</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {attendance.slice(0, 14).map((a) => {
              const m = members.find((x) => x.id === a.memberId)
              const u = users.find((x) => x.id === m?.userId)
              return (
                <li key={a.id} className="flex items-center justify-between border-b border-white/5 py-2">
                  <span>{u?.name}</span>
                  <span className="text-mist">{a.date} {a.time} · {a.type}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function QrFake({ value }: { value: string }) {
  const cells = 11
  const hash = (s: string, i: number) => {
    let h = 0
    for (let c = 0; c < s.length; c++) h = (h * 31 + s.charCodeAt(c) + i) >>> 0
    return h
  }
  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className="size-full" role="img" aria-label={`QR for ${value}`}>
      <rect width={cells} height={cells} fill="white" />
      {Array.from({ length: cells * cells }).map((_, i) => {
        const x = i % cells
        const y = Math.floor(i / cells)
        const finder = (x < 3 && y < 3) || (x > cells - 4 && y < 3) || (x < 3 && y > cells - 4)
        const on = finder || hash(value, i) % 3 === 0
        return on ? <rect key={i} x={x} y={y} width="1" height="1" fill="#111" /> : null
      })}
    </svg>
  )
}

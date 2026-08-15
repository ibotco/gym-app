import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { PageHeader, Button, Badge, StatusBadge, Avatar } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatGhs } from '../../lib/utils'
import { CredentialsPanel } from '../../components/CredentialsPanel'

export function StaffDetail() {
  const { id } = useParams()
  const app = useApp()
  const { hasRole } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager')
  const rec = app.staff.find((s) => s.id === id)
  const u = app.users.find((x) => x.id === rec?.userId)

  useEffect(() => {
    if (window.location.hash === '#credentials') {
      document.getElementById('credentials')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [id])

  if (!rec || !u) {
    return <p>Staff record not found. <Link to="/admin/staff" className="text-lime">Back</Link></p>
  }

  return (
    <div>
      <PageHeader
        eyebrow="Staff profile"
        title={u.name}
        desc={u.email}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => {
                document.getElementById('credentials')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}><KeyRound className="size-4" /> Credentials</Button>
            )}
            <Button variant="soft" onClick={() => {
              app.patchUser(u.id, { status: u.status === 'suspended' ? 'active' : 'suspended' })
              toast.info('Status updated')
            }}>
              {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
            <Link to="/admin/staff" className="inline-flex">
              <Button variant="outline">Back to staff</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card flex items-center gap-4 p-5">
          <Avatar src={u.avatar} name={u.name} size="xl" />
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={u.status} />
              <Badge>{u.role.replace('_', ' ')}</Badge>
              {u.mustChangePassword && <Badge tone="amber">Password change required</Badge>}
            </div>
            <p className="mt-2 text-sm text-mist">{rec.title} · {rec.department}</p>
            <p className="text-sm text-mist">Home club: {app.branches.find((b) => b.id === u.branchId)?.name || '—'}</p>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Employment</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Item k="Phone" v={u.phone} />
            <Item k="Username" v={u.username || u.email.split('@')[0]} />
            <Item k="Hired" v={formatDate(rec.hireDate)} />
            <Item k="Salary" v={formatGhs(rec.salary)} />
            <Item k="Leave" v={`${rec.leaveBalance} days`} />
            <Item k="Email" v={u.email} />
          </dl>
        </div>
      </div>

      {canEdit && (
        <div className="mt-4">
          <CredentialsPanel user={u} kind="staff" />
        </div>
      )}
    </div>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

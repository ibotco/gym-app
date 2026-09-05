import { useState } from 'react'
import { PageHeader, SearchInput, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { formatDateTime } from '../../lib/utils'

export function Audit() {
  const { audit, users } = useApp()
  const [q, setQ] = useState('')
  const rows = audit.filter((a) => `${a.action} ${a.entity} ${a.details}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <PageHeader title="Audit logs" desc="Immutable activity trail for GDPR and internal control." />
      <SearchInput value={q} onChange={setQ} placeholder="Filter actions…" />
      <div className="mt-4 card table-wrap">
        <table className="data">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-mist">{formatDateTime(a.createdAt)}</td>
                <td>{users.find((u) => u.id === a.userId)?.name || a.userId}</td>
                <td><Badge tone="lime">{a.action}</Badge></td>
                <td>{a.entity}</td>
                <td className="text-mist">{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

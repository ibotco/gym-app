import { ClipboardCheck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/ui'
import { ApprovalHistoryPage } from './ApprovalHistory'
import { ApprovalReportsPage } from './ApprovalReports'
import { ApprovalRuleBuilderPage } from './ApprovalRuleBuilder'
import { PendingApprovalsPage } from './PendingApprovals'

const SECTIONS: Record<string, { title: string; description: string }> = {
  pending: {
    title: 'Pending Approvals',
    description: 'Review and act on requests awaiting approval.',
  },
  history: {
    title: 'Approval History',
    description: 'Review decisions and completed approval requests.',
  },
  rules: {
    title: 'Approval Rule Builder',
    description: 'Configure approval routes and rules for workflows.',
  },
  reports: {
    title: 'Approval Reports',
    description: 'View approval activity and workflow reports.',
  },
}

export function ApprovalsPage() {
  const { section = 'pending' } = useParams()
  if (section === 'rules') return <ApprovalRuleBuilderPage />
  if (section === 'pending') return <PendingApprovalsPage />
  if (section === 'history') return <ApprovalHistoryPage />
  if (section === 'reports') return <ApprovalReportsPage />
  const current = SECTIONS[section] ?? SECTIONS.pending

  return (
    <div>
      <PageHeader title={current.title} desc={current.description} />
      <section className="card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-lime">
            <ClipboardCheck className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Approvals</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mist">
              This section is ready for the shared approval workflow. Existing workflow-specific approval processes remain in their respective modules.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

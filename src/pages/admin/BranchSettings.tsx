import { PageHeader } from '../../components/ui'
import { BranchSettingsPanel } from './BranchSettingsPanel'

export function BranchSettings() {
  return (
    <div>
      <PageHeader
        title="Branch settings"
        desc="Override company-level settings for individual branches. Branches inherit company settings by default."
      />
      <BranchSettingsPanel />
    </div>
  )
}

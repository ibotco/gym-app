import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, PageHeader, Select, Switch } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useLicense } from '../../../context/LicenseContext'
import { accountLabel, isCashOrBankAccount } from '../accounting/common'
import { readFeeDefaultAccount, readFeeIntegrationEnabled, saveFeeDefaultAccount } from '../../../lib/feeIntegrationSettings'

export function FeeIntegrationSettings(){
 const {modules,accounts,activeCompanyId}=useApp();const {canModule}=useLicense()
 const [accountId,setAccountId]=useState(()=>readFeeDefaultAccount(activeCompanyId));const [enabled,setEnabled]=useState(()=>readFeeIntegrationEnabled(activeCompanyId));const [result,setResult]=useState('')
 useEffect(()=>{setAccountId(readFeeDefaultAccount(activeCompanyId));setEnabled(readFeeIntegrationEnabled(activeCompanyId));setResult('')},[activeCompanyId])
 if(modules.accounting!==true || !canModule('accounting')) return <div className="card p-5 text-sm">Fee Integration is available only when Accounting is enabled and included in the current app package.</div>
 const available=accounts.filter(a=>isCashOrBankAccount(a)&&a.status!=='inactive')
 const missing=!!accountId && !available.some(a=>a.id===accountId)
 function save(){if(!activeCompanyId || (accountId && available.filter(a=>a.id===accountId).length!==1)){setResult('Select an available bank or cash account, or clear the selection.');return}try{saveFeeDefaultAccount(activeCompanyId,accountId,enabled);setResult('Settings saved locally and queued for database sync.')}catch{setResult('Could not save the default account in this browser.')}}
 return <div className="space-y-5"><PageHeader title="Fee Integration" desc="Configure the default account for Student Finance."/><section className="card max-w-3xl space-y-5 p-5"><Field label="Default bank or cash account"><Select value={accountId} onChange={e=>{setAccountId(e.target.value);setResult('')}}><option value="">No default account</option>{missing&&<option value={accountId}>Unavailable account — {accountId}</option>}{available.map(a=><option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</Select><p className="mt-1 text-xs text-mist">Preselected on new fee collections in this browser; collectors can change it. It records an account choice only and does not move money.</p></Field><div className="flex items-start gap-3"><Switch checked={enabled} onChange={setEnabled} aria-label="Enable fees accounting integration"/><div><p className="text-sm font-semibold">Enable fees accounting integration</p><p className="mt-1 text-xs text-mist">When enabled, eligible new payments request an accounting receipt.</p></div></div><p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Browser-coordinated posting is not atomic or guaranteed duplicate-free across sessions. Verify Account History and database sync; no actual bank transfer is made. Existing payments are not posted automatically.</p>{result&&<p role="status" className="text-sm">{result}</p>}<div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={save}>Save default account</Button><Link className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400" to="/admin/education-management/fees-configurations/fee-types">Review Fees Mapping</Link></div></section></div>
}

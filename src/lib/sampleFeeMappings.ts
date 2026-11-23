import type { EduRecords } from './eduRecords'

type Account={id:string;name:string;type:string;status?:string;code?:string}
const samples=['Tuition Fee','Registration Fee','ICT Fee','Library Fee','Examination Fee','Sports Fee','Laboratory Fee','Activity Fee','Transport Fee','Development Levy']
const marker='sample-fee-income-mapping-v1'
/** Illustrative, one-time migration; existing mappings and edited samples are never replaced. */
export function mapSampleFees(records:EduRecords,accounts:readonly Account[]):EduRecords {
 if ((records.feeSampleMigrations||[]).some(r=>r.id===marker)) return records
 const choices=accounts.filter(a=>a.id==='ac_q35' && a.type==='income' && a.status==='active' && a.name==='Service/Fee Income')
 if(choices.length!==1) return records
 const types=records.feeTypes||[]
 if(!types.some(t=>samples.some((name,i)=>t.id===`sample-fee-type-v1-${i+1}` && t.name===`Sample — ${name}`))) return records
 const account=choices[0];const label=[account.code,account.name].filter(Boolean).join(' — ')
 const mapped=types.map(row=>{
  const matches=samples.some((name,i)=>row.id===`sample-fee-type-v1-${i+1}` && row.name===`Sample — ${name}`)
  if(!matches||String(row.feesMappingAccountId||'').trim()||String(row.feesMapping||'').trim())return row
  return {...row,feesMappingAccountId:account.id,feesMapping:label}
 })
 return {...records,feeTypes:mapped,feeSampleMigrations:[...(records.feeSampleMigrations||[]),{id:marker}]}
}

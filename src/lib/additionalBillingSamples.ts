import type { EduRecords, EduRow } from './eduRecords'

/** Add ten plainly identified demonstration students and their sample term bills once per branch. */
export function addAdditionalBillingSamples(records: EduRecords): EduRecords {
 const marker='extra-student-bills-v1'
 if ((records.feeSampleMigrations??[]).some(r=>r.id===marker)) return records
 const group=(records.feeGroups??[]).find(g=>g.id==='sample-fee-group-v1-1' && g.name==='Sample — Basic Term Fees')
 if (!group || !(records.termSemester??[]).some(t=>t.name==='Term 1' && t.academicYear==='2026/2027')) return records
 let items: {feeTypeId:string;name:string;amount:string;dueDate:string}[]=[]
 try { const x=JSON.parse(group.itemsJson||'[]'); if(Array.isArray(x)) items=x } catch { return records }
 if(!items.length || items.some(x=>!x.feeTypeId||!x.name||!x.dueDate||!/^\d+(?:\.\d{1,2})?$/.test(String(x.amount)))) return records
 const names=['Sample — Abena Mensah','Sample — Nana Agyeman','Sample — Esi Adjei','Sample — Kofi Arthur','Sample — Mansa Amoah','Sample — Kwesi Appiah','Sample — Akua Lamptey','Sample — Kwaku Anane','Sample — Adjoa Tetteh','Sample — Yaw Ofori']
 const students=[...(records.studentList??[])], bills=[...(records.studentBilling??[])]
 names.forEach((name,i)=>{
  const n=i+11, id=`sample-extra-student-v1-${n}`, admissionNo=`SAMPLE-2026-${n}`
  if(students.some(s=>s.id===id || s.admissionNo===admissionNo)) return
  const student:EduRow={id,admissionNo,name,className:`Basic ${7+i%3} ${i%2?'B':'A'}`,rollNo:`S${n}`,guardian:'',phone:'',status:'Active',remarks:'Illustrative sample student.'}
  students.push(student)
  items.forEach((item,j)=>bills.push({id:`sample-extra-billing-v1-${n}-${j+1}`,studentId:id,admissionNo,student:name,className:student.className,billingDate:'2026-09-01',academicYear:'2026/2027',term:'Term 1',dueDate:item.dueDate,amount:Number(item.amount).toFixed(2),status:'Unpaid',feeType:item.name,feeTypeId:item.feeTypeId,feeGroupId:group.id,feeGroupName:group.name,reference:`SAMPLE:extra-billing-v1:${n}:${j+1}`,allocationSource:'feesGroup',remarks:'Illustrative sample allocation; not a real charge.'}))
 })
 return {...records,studentList:students,studentBilling:bills,feeSampleMigrations:[...(records.feeSampleMigrations??[]),{id:marker}]}
}

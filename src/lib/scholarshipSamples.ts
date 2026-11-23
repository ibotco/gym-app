import { EDU_SEED } from './eduSeed'
import type { EduRecords, EduRow } from './eduRecords'

/** One-time illustrative data, scoped to the branch; never replaces existing data. */
export function addScholarshipSamples(records: EduRecords): EduRecords {
 const marker = 'scholarship-demo-v1'
 if ((records.scholarshipSampleMigrations ?? []).some(r=>r.id===marker)) return records
 const types = ['Sample — Merit','Sample — Need-Based','Sample — Sports','Sample — Staff Ward','Sample — Special Needs'].map((name,i)=>({ id:`sample-scholarship-type-v1-${i+1}`, name, description:'Illustrative sample, not a real award.' }))
 const sponsors = ['Sample — School Fund','Sample — Community Foundation','Sample — Sports Trust','Sample — Staff Fund','Sample — Access Fund'].map((name,i)=>({id:`sample-scholarship-sponsor-v1-${i+1}`,name,sponsorType:['School','NGO','Trust','School','NGO'][i],contact:'',fundingCapacity:'10000.00',notes:'Illustrative sample sponsor.'}))
 const categories=['Merit-Based Scholarship','Need-Based Scholarship','Sports Scholarship','Staff Ward Scholarship','Special Needs Scholarship']
 const schemes=types.map((t,i)=>({id:`sample-scholarship-scheme-v1-${i+1}`,name:`Sample — ${categories[i]}`,category:categories[i],valueType:'Fixed Amount',value:'100.00',startDate:'',endDate:'',eligibility:'Illustrative sample; review before use.',budget:'10000.00',sponsorId:sponsors[i].id,feeTypeIds:'[]',status:'Active'}))
 const actual=(records.studentList??[]).filter(s=>EDU_SEED.studentList.some(original=>original.id===s.id&&original.name===s.name&&original.admissionNo===s.admissionNo)).slice(0,10)
 const awards:EduRow[]=actual.map((s,i)=>({id:`sample-scholarship-award-v1-${s.id}`,studentId:s.id,student:s.name,admissionNo:s.admissionNo??'',scholarshipTypeId:types[i%5].id,type:types[i%5].name,amount:'100.00',session:'2026/2027',term:'Term 1',status:'Active',remarks:'Illustrative sample; no billing deduction.'}))
 const applications:EduRow[]=actual.slice(0,5).map((s,i)=>({id:`sample-scholarship-application-v1-${s.id}`,studentId:s.id,student:s.name,admissionNo:s.admissionNo??'',schemeId:schemes[i].id,schemeName:schemes[i].name,academicYear:'2026/2027',term:'Term 1',status:['Draft','Submitted','Under Review','Approved','Waitlisted'][i],academic:'',financial:'',conduct:'',extracurricular:'',comments:'Illustrative sample; approval does not generate an award.'}))
 const renewals:EduRow[]=awards.slice(0,5).map((a,i)=>({id:`sample-scholarship-renewal-v1-${a.studentId}`,awardId:a.id,student:a.student,awardType:a.type,academicYear:'2026/2027',term:'Term 2',gpa:['3.50','2.80','3.10','3.20','2.70'][i],minimumGpa:'3.00',attendance:['95','88','92','90','84'][i],minimumAttendance:'85',status:'Pending',comments:'Illustrative sample; figures are not imported.'}))
 const append=(key:string,items:EduRow[])=>{const existing=records[key]??[];return [...existing,...items.filter(x=>!existing.some(e=>e.id===x.id))]}
 return {...records,scholarshipTypes:append('scholarshipTypes',types),scholarshipSponsors:append('scholarshipSponsors',sponsors),scholarshipSchemes:append('scholarshipSchemes',schemes),scholarships:append('scholarships',awards),scholarshipApplications:append('scholarshipApplications',applications),scholarshipRenewals:append('scholarshipRenewals',renewals),scholarshipSampleMigrations:[...(records.scholarshipSampleMigrations??[]),{id:marker}]}
}

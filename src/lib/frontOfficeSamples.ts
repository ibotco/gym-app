import type { EduRecords, EduRow } from './eduRecords'
import { EDUCATION_CLEAR_MARKER } from './educationMenuClear'
export const FRONT_OFFICE_SAMPLE_MARKER = 'frontOfficeSampleMarker'
export const FRONT_OFFICE_SAMPLES:Record<string,string[]> = {
 Reference:['Google Ads','Facebook Ads','Advertisement','Teacher','Parent Referral'],
 Source:['Walk-in','Phone','Website','Referral','Social Media'],
 Response:['Information Provided','Follow-up Required','Appointment Scheduled','Resolved','Referred to Staff'],
 'Calling Purpose':['Admission Enquiry','Fee Enquiry','Attendance','Appointment','General Information'],
 'Visiting Purpose':['Admission Enquiry','Meet Student','Meet Staff','Fee Payment','Document Collection'],
 'Complaint Type':['Facilities','Academic','Transport','Billing','Other'],
}
/** Add missing examples once per branch. Never re-add after the Front Desk has
 * been intentionally cleared, or after a user removes an individual entry. */
export function addFrontOfficeSamples(records:EduRecords):{records:EduRecords;added:number}{
 if ((records[FRONT_OFFICE_SAMPLE_MARKER]??[]).some(x=>x.id==='v1') || (records[EDUCATION_CLEAR_MARKER]??[]).some(x=>x.id==='frontOfficeSetup'||x.id===FRONT_OFFICE_SAMPLE_MARKER)) return {records,added:0}
 const existing=records.frontOfficeSetup??[];const seen=new Set(existing.map(r=>`${String(r.category??'').trim().toLowerCase()}\0${String(r.name??'').trim().toLowerCase()}`));const additions:EduRow[]=[]
 for(const [category,names] of Object.entries(FRONT_OFFICE_SAMPLES)) names.forEach((name,i)=>{const key=`${category.toLowerCase()}\0${name.toLowerCase()}`;if(!seen.has(key)){seen.add(key);additions.push({id:`front-office-example-${category.toLowerCase().replace(/[^a-z]+/g,'-')}-${i+1}`,category,name})}})
 return {records:{...records,frontOfficeSetup:[...existing,...additions],[FRONT_OFFICE_SAMPLE_MARKER]:[{id:'v1'}]},added:additions.length}
}

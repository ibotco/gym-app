import { planEducationMenuClear } from './educationMenuClear'
export const CERTIFICATE_DATA_MENUS=[
 {id:'types',label:'Certificate Types',tables:['certificateTypes'],desc:'Certificate type definitions; existing certificates and templates remain.'},
 {id:'register',label:'Certificate Register',tables:['certificateRegister','certificateGeneration'],desc:'Shared certificate records: clearing this also clears Certificate Generation.'},
 {id:'templates',label:'Certificate Templates',tables:['certificateTemplates'],desc:'Certificate template records. Existing certificates and linked template references remain.'},
 {id:'generation',label:'Certificate Generation',tables:['certificateRegister','certificateGeneration'],desc:'Shared certificate records: clearing this also clears Certificate Register.'},
 {id:'bulk',label:'Bulk Generation',tables:['certificateBulkGeneration'],desc:'Bulk generation batch records only; generated certificates and audit entries remain.'},
 {id:'verification',label:'Certificate Verification',tables:['certificateVerification'],desc:'Saved verification records only; certificate records remain.'},
 {id:'reports',label:'Certificate Reports',tables:['certificateReports'],desc:'Saved certificate report records only; underlying certificates and verifications remain.'},
 {id:'settings',label:'Certificate Settings',tables:['certificateSettings'],desc:'Certificate settings records; related certificates and Education settings remain.'},
] as const
export function planCertificateDataClear(raw:string,ids:string[]){
 if(!ids.length||ids.some(id=>!CERTIFICATE_DATA_MENUS.some(m=>m.id===id)))throw new Error('Unknown or empty certificate menu selection')
 const selected=CERTIFICATE_DATA_MENUS.filter(m=>ids.includes(m.id)).map(m=>({id:m.id,key:m.label,tables:[...m.tables]}))
 return planEducationMenuClear(raw,selected,ids)
}

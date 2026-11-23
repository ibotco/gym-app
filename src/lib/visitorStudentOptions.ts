type Row = {id:string; [key:string]:string}
const norm=(s:unknown)=>String(s??'').trim().toLocaleLowerCase()
const sectionName=(s:unknown)=>String(s??'').trim().replace(/^section\s+/i,'')
const unique=(xs:string[])=>[...new Set(xs.filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
/** A student may use separate class/section fields or a combined class label. */
export function visitorClasses(classes:Row[],students:Row[]):string[]{
 const names=classes.map(r=>String(r.name??'').trim()).filter(Boolean)
 // If no class register exists, only separate class/section data can be safely used.
 return unique([...names,...students.filter(s=>s.section).map(s=>String(s.className??'').trim())])
}
export function visitorSections(className:string,classes:Row[],students:Row[]):string[]{
 if(!className.trim())return []
 const registered=classes.filter(c=>norm(c.name)===norm(className)).map(c=>sectionName(c.section))
 const fromStudents=students.flatMap(s=>{
  const cls=String(s.className??'').trim(), sec=sectionName(s.section)
  if(norm(cls)===norm(className))return sec?[sec]:[]
  if(cls.toLocaleLowerCase().startsWith(className.trim().toLocaleLowerCase()+' ')) {const suffix=sectionName(cls.slice(className.trim().length));return suffix?[suffix]:[]}
  return []
 })
 return unique([...registered,...fromStudents])
}
export function visitorStudents(className:string,section:string,students:Row[]):Row[]{
 if(!className.trim()||!section.trim())return []
 return students.filter(s=>{const cls=norm(s.className),target=norm(className),sec=norm(sectionName(s.section));return (cls===target&&sec===norm(sectionName(section)))||(!sec&&cls===norm(`${className.trim()} ${sectionName(section)}`))})
}

/** Read RFC-style CSV with quoted commas, quotes and newlines. */
export function parseQuestionCsv(input:string):Record<string,string>[] {
 if(input.length>1_000_000)throw new Error('CSV exceeds 1 MB.')
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false
 for(let i=0;i<input.length;i++){const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}if(c==='"'){if(cell.length||closed)throw new Error('Invalid CSV quote.');quoted=true;continue}if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&input[i+1]==='\n')i++;rows.push(row);row=[]}continue}if(closed)throw new Error('Unexpected text after CSV quote.');cell+=c}
 if(quoted)throw new Error('Unclosed CSV quote.');if(cell||row.length){row.push(cell);rows.push(row)}
 const headers=(rows.shift()??[]).map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase());if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column names.');if(!headers.includes('subject')||!headers.includes('question'))throw new Error('CSV must contain subject and question columns.')
 const data=rows.filter(r=>r.some(x=>x.trim()));if(data.length>1000)throw new Error('Maximum 1000 questions per import.');return data.map((r,i)=>{if(r.length!==headers.length)throw new Error(`Incorrect number of columns on row ${i+2}.`);const obj:Record<string,string>={};headers.forEach((h,j)=>obj[h]=r[j].trim());if(!obj.subject||!obj.question)throw new Error(`Subject and question are required on row ${i+2}.`);if(obj.marks&&(!Number.isFinite(Number(obj.marks))||Number(obj.marks)<0))throw new Error(`Invalid marks on row ${i+2}.`);return obj})
}

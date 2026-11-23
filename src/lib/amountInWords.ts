const units=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen']
const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']
function underThousand(n:number):string {const parts:string[]=[];if(n>=100){parts.push(`${units[Math.floor(n/100)]} hundred`);n%=100}if(n>=20){parts.push(tens[Math.floor(n/10)]+(n%10?`-${units[n%10]}`:''))}else if(n>0)parts.push(units[n]);return parts.join(' ')}
function wholeWords(n:number):string {if(n===0)return 'zero';const labels=['','thousand','million','billion','trillion'];const out:string[]=[];for(let i=0;n>0;i++){const group=n%1000;if(group)out.unshift(`${underThousand(group)}${labels[i]?` ${labels[i]}`:''}`);n=Math.floor(n/1000)}return out.join(' ')}
type Currency={major:[string,string];minor?:[string,string]}
const names:Record<string,Currency>={GHS:{major:['Ghana cedi','Ghana cedis'],minor:['pesewa','pesewas']},NGN:{major:['Nigerian naira','Nigerian naira'],minor:['kobo','kobo']},ZAR:{major:['South African rand','South African rand'],minor:['cent','cents']},KES:{major:['Kenyan shilling','Kenyan shillings'],minor:['cent','cents']},USD:{major:['US dollar','US dollars'],minor:['cent','cents']},EUR:{major:['euro','euros'],minor:['cent','cents']},GBP:{major:['British pound','British pounds'],minor:['penny','pence']},CAD:{major:['Canadian dollar','Canadian dollars'],minor:['cent','cents']},AUD:{major:['Australian dollar','Australian dollars'],minor:['cent','cents']},CNY:{major:['Chinese yuan','Chinese yuan'],minor:['fen','fen']},INR:{major:['Indian rupee','Indian rupees'],minor:['paisa','paise']},JPY:{major:['Japanese yen','Japanese yen']},AED:{major:['UAE dirham','UAE dirhams'],minor:['fil','fils']},SAR:{major:['Saudi riyal','Saudi riyals'],minor:['halala','halalas']},CHF:{major:['Swiss franc','Swiss francs'],minor:['rappen','rappen']},SEK:{major:['Swedish krona','Swedish kronor'],minor:['öre','öre']},BRL:{major:['Brazilian real','Brazilian reais'],minor:['centavo','centavos']},MXN:{major:['Mexican peso','Mexican pesos'],minor:['centavo','centavos']}}
/** Converts an exact two-decimal accounting amount to English words without rounding. */
export function amountInWords(value:unknown,currency:unknown):string {
 const raw=String(value??'').trim(),code=String(currency??'').trim().toUpperCase();const m=/^(\d+)(?:\.(\d{1,2}))?$/.exec(raw)
 if(!m||!/^\d{1,14}$/.test(m[1])||!/^\d{0,2}$/.test(m[2]||'')||!/^([A-Z]{3})$/.test(code))return 'Review required'
 const major=Number(m[1]),minor=Number((m[2]||'').padEnd(2,'0'));if(!Number.isSafeInteger(major*100+minor))return 'Review required'
 const cur=names[code];if(cur&&!cur.minor&&minor!==0)return 'Review required'
 const majorName=cur ? cur.major[major===1?0:1] : code
 const minorText=minor ? cur?.minor ? ` and ${wholeWords(minor)} ${cur.minor[minor===1?0:1]}` : ` and ${String(minor).padStart(2,'0')}/100` : ''
 const text=`${wholeWords(major)} ${majorName}${minorText} only`;return text[0].toUpperCase()+text.slice(1)
}

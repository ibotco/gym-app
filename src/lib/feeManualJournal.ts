type Row={id:string;[key:string]:unknown}
type Acct={id:string;code:string;name:string;status?:string}
const norm=(v:unknown)=>String(v??'').trim().toLowerCase()
/** A suggestion only: mappings may have changed since the payment was recorded. */
export function feeManualJournal(payment:Row,bills:readonly Row[],feeTypes:readonly Row[],accounts:readonly Acct[],cashIds:readonly string[]) {
 const fail=(error:string)=>({error,amount:'',debit:'',credit:''})
 const billMatches=bills.filter(b=>b.id===payment.billingId)
 if(billMatches.length!==1)return fail('The linked fee item is missing or ambiguous. Review the payment before entering a journal.')
 const bill=billMatches[0];const id=String(bill.feeTypeId??'').trim(),name=norm(bill.feeType)
 const types=id?feeTypes.filter(t=>t.id===id):name?feeTypes.filter(t=>norm(t.name)===name):[]
 if(types.length!==1)return fail('The fee type is missing or ambiguous. Review its mapping first.')
 const mappedId=String(types[0].feesMappingAccountId??'').trim(),cashId=String(payment.accountId??'').trim()
 const debit=accounts.filter(a=>a.id===cashId),credit=accounts.filter(a=>a.id===mappedId)
 if(!cashId || debit.length!==1 || !cashIds.includes(cashId) || norm(debit[0].status)==='inactive')return fail('The recorded Pay to Account is missing, inactive or not a cash/bank account. Review it in Accounting.')
 if(!mappedId || credit.length!==1 || norm(credit[0].status)==='inactive')return fail('The current fee type mapping is missing, ambiguous or inactive. Review Fee Mapping first.')
 if(cashId===mappedId)return fail('The debit and mapped credit account are the same. Review Fee Mapping first.')
 const value=String(payment.amount??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(value))return fail('The payment amount is invalid; review it first.')
 const [whole,frac='']=value.split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'))
 if(!Number.isSafeInteger(n)||n<=0)return fail('The payment amount is invalid; review it first.')
 return {error:'',amount:(n/100).toFixed(2),debit:`${debit[0].code} — ${debit[0].name}`,credit:`${credit[0].code} — ${credit[0].name}`}
}

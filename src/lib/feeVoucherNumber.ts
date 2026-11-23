/** User-supplied payment reference only; it does not create an accounting voucher. */
export function normalizeFeeVoucherNumber(value:unknown):string|null {
 if(typeof value!=='string') return null
 const v=value.trim()
 return /^(?:[A-Za-z]{1,12}[-/]?)?\d{1,12}$/.test(v) ? v : null
}
/** Random reference with an optional prefix and 12 digits, not a reserved or sequential accounting voucher number. */
export function generateFeeVoucherNumber(source: Pick<Crypto,'getRandomValues'> | undefined = globalThis.crypto, prefix = 'FV-'):string {
 try {
  if (!source || typeof source.getRandomValues !== 'function') return ''
  let result=''
  // Rejection sampling avoids bias and preserves leading zeroes.
  for(let attempt=0;attempt<10 && result.length<12;attempt++) {
   for(const b of source.getRandomValues(new Uint8Array(24))) {
    if(b<250) result+=String(b%10)
    if(result.length===12) break
   }
  }
  return result.length===12 && /^[A-Za-z]{1,12}[-/]?$/.test(prefix) ? `${prefix}${result}` : ''
 } catch { return '' }
}

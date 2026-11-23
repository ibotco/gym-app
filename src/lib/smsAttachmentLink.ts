/** Attachments are sent as a user-provided HTTPS link, never as an uploaded file. */
export function smsTextWithAttachment(message:string, link:string):{text:string;error?:string} {
 const text=message.trim(), value=link.trim()
 if (!value) return {text}
 try {
  const url=new URL(value)
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || /\s/.test(value)) throw new Error('invalid')
  return {text:`${text}\n${url.href}`}
 } catch { return {text,error:'Enter a valid HTTPS attachment link without credentials.'} }
}

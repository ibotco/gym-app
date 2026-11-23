import { activeSmsGateway, currentSmsSettings, smsProviderCredentials, smsProviderReady } from './smsGateway'
import { apiUrl } from './mysqlBridge'

export function normalizeInternationalPhone(value: string): string | null {
  const raw = value.trim()
  if (!/^\+[0-9 ()-]+$/.test(raw)) return null
  const digits = raw.replace(/\D/g, '')
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null
}

/** Returns request outcome only. Neither provider acceptance nor delivery is guaranteed. */
export async function sendDirectSms(to: string, message: string): Promise<{ok:boolean; error?:string}> {
  const number = normalizeInternationalPhone(to)
  if (!number || !message.trim()) return {ok:false,error:'Enter a valid international number and message.'}
  if (!activeSmsGateway()) return {ok:false,error:'Enable and select an active SMS provider in Company Settings → Communication → SMS gateway.'}
  const config = currentSmsSettings()
  if (!smsProviderReady(config)) return {ok:false,error:'Configure the selected SMS provider in Company Settings → Communication → SMS gateway.'}
  const legacy = config.smsMode === 'hubtel' || config.smsMode === 'webhook'
  const payload = legacy
    ? {channel:'sms',mode:config.smsMode,to:number,message:message.trim(),webhookUrl:config.smsWebhookUrl,hubtelClientId:config.hubtelClientId,hubtelClientSecret:config.hubtelClientSecret,hubtelFrom:config.hubtelFrom}
    : {provider:config.smsMode,credentials:smsProviderCredentials(config),to:number,message:message.trim()}
  try {
    const response = await fetch(apiUrl(legacy ? '/api/notify' : '/api/sms-provider'), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const data = await response.json().catch(() => ({})) as {ok?:boolean;error?:string}
    return response.ok && data.ok ? {ok:true} : {ok:false,error:data.error || 'The provider request was not confirmed. Verify before retrying.'}
  } catch { return {ok:false,error:'The request outcome is unknown. Check the provider before retrying to avoid a duplicate.'} }
}

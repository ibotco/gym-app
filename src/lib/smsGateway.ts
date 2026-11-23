import type { CredentialSettings, MessagingConfig } from '../types'
import { loadIntegrations } from './integrations'
import { loadCredentialSettings } from './credentials'
/** Shared SMS settings; credentials remain in the existing settings store. */
export function activeSmsGateway(): boolean {
 const m = loadCredentialSettings().messaging
 if (m.smsDefaultSet === false || (m.smsProviderStates && m.smsProviderStates[m.smsMode] !== true)) return false
 return loadIntegrations().some(r => r.id === 'int_sms' && r.active)
}
export function currentSmsSettings(): MessagingConfig { return loadCredentialSettings().messaging }
/** Preserve the centrally managed SMS settings when unrelated credential settings change. */
export function preserveSmsSettings(next: CredentialSettings, saved: CredentialSettings): CredentialSettings {
 const {smsExtraProviders,smsHubtelDefaultApplied,smsDefaultSet,smsProviderStates,smsMode,smsWebhookUrl,hubtelClientId,hubtelClientSecret,hubtelFrom,mnotifyApiKey,mnotifySender,wigalUsername,wigalApiKey,wigalSender,twilioAccountSid,twilioAuthToken,twilioSender}=saved.messaging
 return {...next,messaging:{...next.messaging,smsExtraProviders,smsHubtelDefaultApplied,smsDefaultSet,smsProviderStates,smsMode,smsWebhookUrl,hubtelClientId,hubtelClientSecret,hubtelFrom,mnotifyApiKey,mnotifySender,wigalUsername,wigalApiKey,wigalSender,twilioAccountSid,twilioAuthToken,twilioSender}}
}

export function smsProviderCredentials(m: MessagingConfig) {
 switch (m.smsMode) {
  case 'mnotify': return {apiKey:m.mnotifyApiKey, sender:m.mnotifySender}
  case 'wigal': return {username:m.wigalUsername, apiKey:m.wigalApiKey, sender:m.wigalSender}
  case 'twilio': return {accountSid:m.twilioAccountSid, authToken:m.twilioAuthToken, sender:m.twilioSender}
  case 'clickatell': case 'msg91': case 'africastalking': case 'textlocal': case 'smscountry': return m.smsExtraProviders?.[m.smsMode] || {}
  default: return {}
 }
}
export function smsProviderReady(m: MessagingConfig): boolean {
 switch (m.smsMode) {
  case 'hubtel': return !!(m.hubtelClientId.trim() && m.hubtelClientSecret.trim() && m.hubtelFrom.trim())
  case 'mnotify': return !!(m.mnotifyApiKey.trim() && m.mnotifySender.trim() && m.mnotifySender.trim().length <= 11)
  case 'wigal': return !!(m.wigalUsername.trim() && m.wigalApiKey.trim() && m.wigalSender.trim())
  case 'twilio': return /^AC[0-9a-f]{32}$/i.test(m.twilioAccountSid.trim()) && !!(m.twilioAuthToken.trim() && m.twilioSender.trim())
  case 'clickatell': return !!m.smsExtraProviders?.clickatell?.apiKey?.trim()
  case 'msg91': return !!(m.smsExtraProviders?.msg91?.apiKey?.trim() && m.smsExtraProviders?.msg91?.sender?.trim() && m.smsExtraProviders?.msg91?.route?.trim())
  case 'africastalking': return !!(m.smsExtraProviders?.africastalking?.apiKey?.trim() && m.smsExtraProviders?.africastalking?.username?.trim())
  case 'textlocal': return !!(m.smsExtraProviders?.textlocal?.apiKey?.trim() && m.smsExtraProviders?.textlocal?.sender?.trim())
  case 'smscountry': return !!(m.smsExtraProviders?.smscountry?.username?.trim() && m.smsExtraProviders?.smscountry?.password?.trim() && m.smsExtraProviders?.smscountry?.sender?.trim())
  case 'webhook': return /^https:\/\//i.test(m.smsWebhookUrl.trim())
  default: return false
 }
}

/** One-time preference update; retain every provider's saved fields and later user choices. */
export function applyInitialHubtelDefault(m: MessagingConfig): MessagingConfig {
 if (m.smsHubtelDefaultApplied) return m
 const states = m.smsProviderStates ? {...m.smsProviderStates} : m.smsMode === 'link' ? {} : {[m.smsMode]:true}
 return {...m, smsMode:'hubtel', smsDefaultSet:true, smsProviderStates:{...states,hubtel:true}, smsHubtelDefaultApplied:true}
}

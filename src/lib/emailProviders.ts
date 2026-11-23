import { defaultMail, MAIL_KEY, type MailConfig, type EmailProviderEntry, type MailProvider } from './mail'
export function withoutRegistry(mail:MailConfig): EmailProviderEntry['config'] {
 const {emailProviders: _p,emailDefault: _d,...config}=mail;return config
}
/** Preserve an existing saved setup, but don't invent a configured provider for a fresh browser. */
export function emailRegistry(mail:MailConfig): {entries:EmailProviderEntry[]; defaultProvider:MailProvider|null} {
 if (Array.isArray(mail.emailProviders)) return {entries:mail.emailProviders,defaultProvider:mail.emailDefault ?? null}
 if (!localStorage.getItem(MAIL_KEY)) return {entries:[],defaultProvider:null}
 return {entries:[{provider:mail.provider,active:mail.live,config:withoutRegistry(mail)}], defaultProvider:mail.live ? mail.provider : null}
}
/** One atomic browser-store value includes both the active settings and provider list. */
export function withEmailRegistry(previous:MailConfig, entries:EmailProviderEntry[], selected:MailProvider|null):MailConfig {
 const entry=entries.find(x=>x.provider===selected && x.active)
 return {...(entry ? entry.config : {...previous,live:false}),emailProviders:entries,emailDefault:entry ? entry.provider : null}
}
export function newEmailDraft(provider:MailProvider):MailConfig {
 const base=defaultMail(); const smtpHost=provider==='gmail'?'smtp.gmail.com':provider==='sendgrid'?'smtp.sendgrid.net':provider==='postmark'?'smtp.postmarkapp.com':''
 return {...base,provider,smtpHost,smtpUser:provider==='sendgrid'?'apikey':'',smtpPass:'',fromEmail:'',emailjsPublicKey:'',emailjsServiceId:'',emailjsTemplateId:'',resendKey:''}
}

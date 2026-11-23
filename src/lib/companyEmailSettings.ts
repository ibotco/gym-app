import { ACTIVE_COMPANY_KEY, DEFAULT_COMPANY_ID } from './companies'

export type CompanyEmailSettings = { replyTo: string; signature: string; footer: string; sendCopy: boolean }
export const emptyEmailSettings = (): CompanyEmailSettings => ({ replyTo: '', signature: '', footer: '', sendCopy: false })
export const validEmail = (value: string) => /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value)
export function currentEmailCompanyId() { return localStorage.getItem(ACTIVE_COMPANY_KEY) || DEFAULT_COMPANY_ID }
const key = (id: string) => `fitpro_email_settings:${id}`
export function loadCompanyEmailSettings(id = currentEmailCompanyId()): CompanyEmailSettings {
  try { const data = JSON.parse(localStorage.getItem(key(id)) || '{}'); return { ...emptyEmailSettings(), ...data } } catch { return emptyEmailSettings() }
}
export function saveCompanyEmailSettings(id: string, settings: CompanyEmailSettings) { localStorage.setItem(key(id), JSON.stringify(settings)) }

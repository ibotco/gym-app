// Developer-managed system settings — version label, release date and notes.
// Editable only by the Super Admin from Settings → System settings; regular
// company admins never see these.

import type { SystemSettings } from '../types'
import { APP_VERSION } from './version'

export const SYSTEM_SETTINGS_KEY = 'fitpro_system_settings'

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  appName: 'FitPro App',
  appVersion: APP_VERSION,
  releaseDate: '2026-08-22',
  releaseNotes: '',
}

export function loadSystemSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY)
    if (!raw) return DEFAULT_SYSTEM_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SystemSettings>
    return { ...DEFAULT_SYSTEM_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SYSTEM_SETTINGS
  }
}

export function saveSystemSettings(s: SystemSettings) {
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(s))
}

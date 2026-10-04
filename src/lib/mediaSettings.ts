// Media Library settings — governs uploads, sharing defaults, storage and
// the look & feel of the Media Library pages (accent, default view, density).

import type { ShareAccess } from './fileSharing'

export type MediaAccent = 'emerald' | 'orange' | 'sky' | 'violet'

export type MediaSettingsState = {
  maxUploadMb: number
  allowedTypes: string[]
  autoRename: boolean
  defaultAccess: ShareAccess
  defaultVisibility: 'public' | 'private'
  defaultExpiryDays: number // 0 = never expires
  defaultAllowDownload: boolean
  defaultRequireSignIn: boolean
  publicLinks: boolean
  quotaGb: number
  usedGb: number
  warnThresholdPct: number
  accent: MediaAccent
  defaultView: 'list' | 'grid'
  compact: boolean
}

export const MEDIA_SETTINGS_KEY = 'fitpro_media_settings'

export const FILE_TYPE_GROUPS = ['Images', 'Documents', 'Spreadsheets', 'Archives', 'Audio', 'Video']

export const defaultMediaSettings = (): MediaSettingsState => ({
  maxUploadMb: 25,
  allowedTypes: ['Images', 'Documents', 'Spreadsheets'],
  autoRename: true,
  defaultAccess: 'view',
  defaultVisibility: 'private',
  defaultExpiryDays: 7,
  defaultAllowDownload: true,
  defaultRequireSignIn: false,
  publicLinks: true,
  quotaGb: 10,
  usedGb: 3.42,
  warnThresholdPct: 80,
  accent: 'emerald',
  defaultView: 'list',
  compact: false,
})

export function loadMediaSettings(): MediaSettingsState {
  const base = defaultMediaSettings()
  try {
    const raw = localStorage.getItem(MEDIA_SETTINGS_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<MediaSettingsState>
    return {
      ...base,
      ...saved,
      allowedTypes: Array.isArray(saved.allowedTypes) ? saved.allowedTypes : base.allowedTypes,
    }
  } catch { /* storage may be unavailable */ }
  return base
}

export function saveMediaSettings(s: MediaSettingsState) {
  try { localStorage.setItem(MEDIA_SETTINGS_KEY, JSON.stringify(s)) } catch { /* storage may be unavailable */ }
}

// Literal Tailwind class bundles per accent so JIT picks them up.
export const ACCENT_UI: Record<MediaAccent, {
  solid: string
  soft: string
  text: string
  ring: string
  swatch: string
  bar: string
}> = {
  emerald: {
    solid: 'bg-emerald-500 text-white hover:bg-emerald-600',
    soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-500',
    ring: 'ring-emerald-500',
    swatch: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  },
  orange: {
    solid: 'bg-orange-500 text-white hover:bg-orange-600',
    soft: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    text: 'text-orange-500',
    ring: 'ring-orange-500',
    swatch: 'bg-orange-500',
    bar: 'bg-orange-500',
  },
  sky: {
    solid: 'bg-sky-500 text-white hover:bg-sky-600',
    soft: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    text: 'text-sky-500',
    ring: 'ring-sky-500',
    swatch: 'bg-sky-500',
    bar: 'bg-sky-500',
  },
  violet: {
    solid: 'bg-violet-500 text-white hover:bg-violet-600',
    soft: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    text: 'text-violet-500',
    ring: 'ring-violet-500',
    swatch: 'bg-violet-500',
    bar: 'bg-violet-500',
  },
}

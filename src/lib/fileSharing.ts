// File Sharing domain — share links over Media Library files.
// Persisted in localStorage so shares survive reloads.

export type ShareAccess = 'view' | 'download' | 'edit'

export type ShareActivity = { at: string; who: string; what: string }

export type ShareRec = {
  id: string
  fileName: string
  ext: string
  sizeKb: number
  hue: number
  glyph: string
  owner: string
  recipients: string[]
  access: ShareAccess
  createdAt: string // ISO yyyy-mm-dd
  expiresAt: string | null // ISO yyyy-mm-dd, null = never
  allowDownload: boolean
  requireSignIn: boolean
  linkCode: string
  /** public = anyone with the link; private = only signed-in recipients */
  visibility: 'public' | 'private'
  active: boolean
  note?: string
  activity: ShareActivity[]
}

export const FILE_SHARING_KEY = 'fitpro_file_sharing'

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const daysFromNow = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export const shareLink = (code: string) => `https://share.fitpro.app/s/${code}`

export const makeLinkCode = () =>
  Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

export type ShareStatus = 'active' | 'expiring' | 'expired' | 'revoked'

export function daysLeft(s: ShareRec, today: string = todayIso()): number | null {
  if (!s.expiresAt) return null
  return Math.round((new Date(s.expiresAt).getTime() - new Date(today).getTime()) / 86400000)
}

export function isExpired(s: ShareRec, today: string = todayIso()): boolean {
  return !!s.expiresAt && s.expiresAt < today
}

export function shareStatus(s: ShareRec, today: string = todayIso()): ShareStatus {
  if (!s.active) return 'revoked'
  const left = daysLeft(s, today)
  if (left !== null && left < 0) return 'expired'
  if (left !== null && left <= 7) return 'expiring'
  return 'active'
}

const act = (daysAgo: number, who: string, what: string): ShareActivity => ({ at: daysFromNow(-daysAgo), who, what })

const SEED: ShareRec[] = [
  {
    id: 'fs01', fileName: 'team_photo_1', ext: 'png', sizeKb: 75.62, hue: 30, glyph: '🧑🤝‍🧑',
    owner: 'Kofi Mensah', recipients: ['Ama Serwaa', 'Efua Baidoo', 'Yaw Boateng'],
    access: 'view', createdAt: daysFromNow(-2), expiresAt: daysFromNow(12), allowDownload: false,
    requireSignIn: false, linkCode: 'tm1photo9qa', visibility: 'private', active: true, note: 'For the newsletter feature.',
    activity: [act(0, 'Ama Serwaa', 'viewed the file'), act(1, 'Efua Baidoo', 'opened the link'), act(2, 'Kofi Mensah', 'created the share')],
  },
  {
    id: 'fs02', fileName: 'poster_summer_promo', ext: 'png', sizeKb: 75.62, hue: 15, glyph: '📢',
    owner: 'Ama Serwaa', recipients: ['Marketing Team'],
    access: 'download', createdAt: daysFromNow(-5), expiresAt: daysFromNow(3), allowDownload: true,
    requireSignIn: false, linkCode: 'sumpr0mo26', visibility: 'public', active: true, note: 'Print-ready artwork.',
    activity: [act(0, 'Marketing Team', 'downloaded the file'), act(3, 'Marketing Team', 'opened the link')],
  },
  {
    id: 'fs03', fileName: 'gym_floor_plan', ext: 'png', sizeKb: 75.62, hue: 90, glyph: '🗺️',
    owner: 'Kofi Mensah', recipients: ['Yaw Boateng'],
    access: 'edit', createdAt: daysFromNow(-9), expiresAt: daysFromNow(21), allowDownload: true,
    requireSignIn: true, linkCode: 'fl00rplan7', visibility: 'private', active: true,
    activity: [act(1, 'Yaw Boateng', 'opened the link'), act(9, 'Kofi Mensah', 'created the share')],
  },
  {
    id: 'fs04', fileName: 'receipt_template', ext: 'png', sizeKb: 75.62, hue: 60, glyph: '🧾',
    owner: 'Efua Baidoo', recipients: ['Accounts Desk'],
    access: 'view', createdAt: daysFromNow(-30), expiresAt: daysFromNow(-4), allowDownload: false,
    requireSignIn: true, linkCode: 'rcpttmpl44', visibility: 'private', active: true,
    activity: [act(12, 'Accounts Desk', 'viewed the file')],
  },
  {
    id: 'fs05', fileName: 'membership_card_front', ext: 'png', sizeKb: 75.62, hue: 250, glyph: '💳',
    owner: 'Kofi Mensah', recipients: ['Naa Adjeley Quaye', 'Print Vendor'],
    access: 'download', createdAt: daysFromNow(-15), expiresAt: null, allowDownload: true,
    requireSignIn: false, linkCode: 'membcard01', visibility: 'public', active: true, note: 'Vendor proof for card printing.',
    activity: [act(2, 'Print Vendor', 'downloaded the file'), act(6, 'Print Vendor', 'opened the link')],
  },
  {
    id: 'fs06', fileName: 'invoice_header', ext: 'png', sizeKb: 75.62, hue: 70, glyph: '📄',
    owner: 'Ama Serwaa', recipients: ['Finance'],
    access: 'view', createdAt: daysFromNow(-40), expiresAt: daysFromNow(60), allowDownload: false,
    requireSignIn: true, linkCode: 'invhead222', visibility: 'private', active: false,
    activity: [act(20, 'Kofi Mensah', 'revoked the link')],
  },
  {
    id: 'fs07', fileName: 'banner_home', ext: 'png', sizeKb: 75.62, hue: 170, glyph: '🖼️',
    owner: 'Yaw Boateng', recipients: ['Web Team', 'Ama Serwaa'],
    access: 'edit', createdAt: daysFromNow(-1), expiresAt: daysFromNow(6), allowDownload: true,
    requireSignIn: false, linkCode: 'h0mebanner', visibility: 'public', active: true, note: 'Refresh hero banner for October promo.',
    activity: [act(0, 'Web Team', 'opened the link'), act(1, 'Yaw Boateng', 'created the share')],
  },
  {
    id: 'fs08', fileName: 'football_image', ext: 'png', sizeKb: 276.83, hue: 16, glyph: '⚽',
    owner: 'Efua Baidoo', recipients: ['Shopfront'],
    access: 'download', createdAt: daysFromNow(-3), expiresAt: daysFromNow(27), allowDownload: true,
    requireSignIn: false, linkCode: 'f00tball88', visibility: 'public', active: true,
    activity: [act(1, 'Shopfront', 'downloaded the file')],
  },
  {
    id: 'fs09', fileName: 'invoice_header', ext: 'png', sizeKb: 75.62, hue: 70, glyph: '📄',
    owner: 'Kofi Mensah', recipients: ['Old Vendor'],
    access: 'view', createdAt: daysFromNow(-80), expiresAt: daysFromNow(-50), allowDownload: false,
    requireSignIn: false, linkCode: '0ldvendor9', visibility: 'private', active: true,
    activity: [act(60, 'Old Vendor', 'opened the link')],
  },
]

export function loadShares(): ShareRec[] {
  try {
    const raw = localStorage.getItem(FILE_SHARING_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ShareRec[]
      if (Array.isArray(parsed)) return parsed.map((x) => ({ ...x, visibility: x.visibility ?? 'private' }))
    }
  } catch { /* storage may be unavailable */ }
  return SEED.map((s) => ({ ...s, recipients: [...s.recipients], activity: [...s.activity] }))
}

export function saveShares(list: ShareRec[]) {
  try { localStorage.setItem(FILE_SHARING_KEY, JSON.stringify(list)) } catch { /* storage may be unavailable */ }
}

export const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`)

// Lightweight catalogue of Media Library files offered when creating a share.
export type LibraryFile = { id: string; fileName: string; ext: string; sizeKb: number; hue: number; glyph: string }
export const LIBRARY_FILES: LibraryFile[] = [
  { id: 'lf01', fileName: 'team_photo_1', ext: 'png', sizeKb: 75.62, hue: 30, glyph: '🧑🤝‍🧑' },
  { id: 'lf02', fileName: 'team_photo_2', ext: 'png', sizeKb: 75.62, hue: 40, glyph: '🤝' },
  { id: 'lf03', fileName: 'poster_summer_promo', ext: 'png', sizeKb: 75.62, hue: 15, glyph: '📢' },
  { id: 'lf04', fileName: 'poster_new_year', ext: 'png', sizeKb: 75.62, hue: 350, glyph: '🎉' },
  { id: 'lf05', fileName: 'gym_floor_plan', ext: 'png', sizeKb: 75.62, hue: 90, glyph: '🗺️' },
  { id: 'lf06', fileName: 'membership_card_front', ext: 'png', sizeKb: 75.62, hue: 250, glyph: '💳' },
  { id: 'lf07', fileName: 'banner_home', ext: 'png', sizeKb: 75.62, hue: 170, glyph: '🖼️' },
  { id: 'lf08', fileName: 'receipt_template', ext: 'png', sizeKb: 75.62, hue: 60, glyph: '🧾' },
  { id: 'lf09', fileName: 'invoice_header', ext: 'png', sizeKb: 75.62, hue: 70, glyph: '📄' },
  { id: 'lf10', fileName: 'football_image', ext: 'png', sizeKb: 276.83, hue: 16, glyph: '⚽' },
  { id: 'lf11', fileName: 'laptop_images_3', ext: 'png', sizeKb: 171.07, hue: 220, glyph: '💻' },
  { id: 'lf12', fileName: 'headphones_image', ext: 'png', sizeKb: 198.75, hue: 280, glyph: '🎧' },
]

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

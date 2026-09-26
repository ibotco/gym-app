/**
 * Imageshop store — named, cropped pictures filed into folders.
 *
 * Pictures are kept as data URLs in localStorage, the same way the rest of the
 * app persists uploaded media, so a shot survives a reload without a backend.
 */

export const IMAGESHOP_KEY = 'fitpro_imageshop_v1'
export const IMAGESHOP_FOLDERS_KEY = 'fitpro_imageshop_folders_v1'
export const MAIN_FOLDER = 'Main Folder'

export interface Shot {
  id: string
  /** Caption shown under the thumbnail — usually a person's name. */
  name: string
  folder: string
  /** Cropped image as a data URL. */
  src: string
  createdAt: string
  /** Set when the picture has been re-framed from the gallery. */
  updatedAt?: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

export const loadShots = (): Shot[] => read<Shot[]>(IMAGESHOP_KEY, [])
export const saveShots = (rows: Shot[]) => localStorage.setItem(IMAGESHOP_KEY, JSON.stringify(rows))

/** Folder list always starts with the built-in Main Folder. */
export function loadFolders(): string[] {
  const saved = read<string[]>(IMAGESHOP_FOLDERS_KEY, [])
  const all = [MAIN_FOLDER, ...saved.filter((f) => f && f !== MAIN_FOLDER)]
  return [...new Set(all)]
}

export const saveFolders = (folders: string[]) =>
  localStorage.setItem(IMAGESHOP_FOLDERS_KEY, JSON.stringify(folders.filter((f) => f !== MAIN_FOLDER)))

export const newShotId = () => `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// ---------------------------------------------------------------------------
// Disk store (dev server): pictures live in `public/cropped_photo`, which IS
// the Main Folder. Every call returns null when the endpoint is unavailable
// (production build, tests) so the caller can fall back to localStorage.
// ---------------------------------------------------------------------------

export const CROPPED_PHOTO_DIR = '/cropped_photo'
const API = '/api/imageshop'

async function call<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    if (typeof fetch !== 'function') return null
    const res = await fetch(url, init)
    if (!res.ok) return null
    const body = await res.json()
    return body?.ok ? (body as T) : null
  } catch {
    return null
  }
}

const post = (path: string, body: unknown) =>
  call<{ ok: true } & Record<string, unknown>>(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** Read the whole store off disk. Null means "no disk store here". */
export const apiList = () => call<{ folders: string[]; shots: Shot[]; root: string }>(`${API}/list`)

export const apiCreateFolder = (name: string) => post('/folder', { name })

/** Write a crop. `from` is the id of the picture being replaced, if any. */
export const apiSave = (shot: { name: string; folder: string; dataUrl: string; from?: string }) =>
  post('/save', shot) as Promise<{ shot: Shot } | null>

export const apiDelete = (id: string) => post('/delete', { name: id })

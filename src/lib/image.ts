// Profile picture helpers — validation and client-side downscaling so uploaded
// images stay small enough to persist with the registration record (localStorage).

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
export const AVATAR_ACCEPT = 'image/jpeg,image/png'
export const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png']
export const AVATAR_MAX_DIM = 512

/** Fallback catalogue image shown for products without an uploaded image. */
export const DEFAULT_PRODUCT_IMAGE = '/images/product-default.svg'

export function isAvatarMime(type: string) {
  return type === 'image/jpeg' || type === 'image/png'
}

/** Returns an error message, or null when the file is acceptable. */
export function validateAvatarFile(file: File): string | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!AVATAR_EXTENSIONS.includes(ext)) return 'Please choose a JPG, JPEG, or PNG image.'
  if (!isAvatarMime(file.type)) return 'Please choose a JPG, JPEG, or PNG image.'
  if (file.size > AVATAR_MAX_BYTES) return 'The image must be 5 MB or smaller.'
  return null
}

/**
 * Reads the file, downscales it to fit AVATAR_MAX_DIM (keeping aspect ratio),
 * and returns a data URL (JPEG for JPG/JPEG, PNG for PNG) ready to store.
 */
export function fileToAvatarDataUrl(file: File, maxDim = AVATAR_MAX_DIM): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load the image.'))
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
          const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale))
          const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas is not supported in this browser.')); return }
          ctx.drawImage(img, 0, 0, w, h)
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          const quality = mime === 'image/jpeg' ? 0.85 : undefined
          resolve(canvas.toDataURL(mime, quality))
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Could not process the image.'))
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}


/* ------------------------------------------------- ID card background art */

export const CARD_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024 // 8 MB
export const CARD_BACKGROUND_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
export const CARD_BACKGROUND_ACCEPT = 'image/jpeg,image/png,image/webp'
/** Printed backgrounds need more pixels than an avatar, but still a hard cap. */
export const CARD_BACKGROUND_MAX_DIM = 1200

export function isCardBackgroundMime(type: string) {
  return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp'
}

/** Returns an error message, or null when the file is acceptable. */
export function validateCardBackgroundFile(file: File): string | null {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!CARD_BACKGROUND_EXTENSIONS.includes(ext)) return 'Please choose a JPG, PNG, or WebP image.'
  if (!isCardBackgroundMime(file.type)) return 'Please choose a JPG, PNG, or WebP image.'
  if (file.size > CARD_BACKGROUND_MAX_BYTES) return 'The image must be 8 MB or smaller.'
  return null
}

/**
 * Reads the file, downscales the long edge to CARD_BACKGROUND_MAX_DIM and
 * returns a compact data URL — big enough to print cleanly at 300 dpi, small
 * enough to sit in the template record without blowing the storage quota.
 */
export function fileToCardBackgroundDataUrl(file: File, maxDim = CARD_BACKGROUND_MAX_DIM): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load the image.'))
      img.onload = () => {
        try {
          const w0 = img.naturalWidth || img.width
          const h0 = img.naturalHeight || img.height
          const scale = Math.min(1, maxDim / Math.max(w0, h0))
          const w = Math.max(1, Math.round(w0 * scale))
          const h = Math.max(1, Math.round(h0 * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('Canvas is not supported in this browser.')); return }
          ctx.drawImage(img, 0, 0, w, h)
          // PNG keeps transparency (watermarks, crests); everything else JPEGs smaller.
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          let out = canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.82 : undefined)
          // Last-resort squeeze so one template can never eat the whole quota.
          if (out.length > 2_000_000) out = canvas.toDataURL('image/jpeg', 0.6)
          resolve(out)
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Could not process the image.'))
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

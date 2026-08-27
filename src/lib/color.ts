const HEX6 = /^#([0-9a-fA-F]{6})$/
const HEX3 = /^#([0-9a-fA-F]{3})$/

export function normalizeHex(value: string, fallback = '#C8F542') {
  const raw = value.trim()
  const full = HEX6.exec(raw)
  if (full) return `#${full[1].toUpperCase()}`
  const short = HEX3.exec(raw)
  if (short) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return fallback
}

export function isHexColor(value: string) {
  const raw = value.trim()
  return HEX6.test(raw) || HEX3.test(raw)
}

function hexToRgb(hex: string) {
  const h = normalizeHex(hex)
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

/** Lighten (positive) or darken (negative) a hex colour. */
export function shade(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex)
  const t = percent / 100
  if (t >= 0) {
    return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
  }
  return rgbToHex(r * (1 + t), g * (1 + t), b * (1 + t))
}

/** A readable text colour to sit on top of the given background. */
export function readableInk(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#132000' : '#FFFFFF'
}

export function applyBrandColor(hex: string) {
  const color = normalizeHex(hex)
  const root = document.documentElement
  root.style.setProperty('--color-lime', color)
  root.style.setProperty('--brand', color)
  root.style.setProperty('--brand-glow', `${color}73`)
  root.style.setProperty('--brand-ink', readableInk(color))
}

/** True when the colour is "dark" (low luminance) — dark text needs light ink. */
export function isDarkColor(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum < 0.55
}

/** Applies custom sidebar/header chrome colours as CSS variables on :root. */
export function applyChromeColors(sidebar?: string, header?: string) {
  const root = document.documentElement
  const set = (name: string, value: string | undefined) => {
    if (value && isHexColor(value)) {
      const c = normalizeHex(value)
      root.style.setProperty(name, c)
    } else {
      root.style.removeProperty(name)
    }
  }
  set('--chrome-sidebar', sidebar)
  set('--chrome-header', header)
}

/** Applies the custom button colour to the CSS variables `.btn-lime` uses. */
export function applyButtonColor(hex: string | undefined) {
  const root = document.documentElement
  if (!hex || !isHexColor(hex)) {
    root.style.removeProperty('--btn')
    root.style.removeProperty('--btn-hover')
    root.style.removeProperty('--btn-ink')
    root.style.removeProperty('--btn-glow')
    return
  }
  const color = normalizeHex(hex)
  root.style.setProperty('--btn', color)
  root.style.setProperty('--btn-hover', shade(color, 8))
  root.style.setProperty('--btn-ink', readableInk(color))
  root.style.setProperty('--btn-glow', `0 0 60px -12px ${color}73`)
}

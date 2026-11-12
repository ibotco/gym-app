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
  // Default table header band follows the selected theme preset: a subtle tint
  // of the header colour (light band for light mode, deep band for dark mode).
  // Custom Table Look settings (--table-head-bg) still take precedence in CSS.
  if (header && isHexColor(header)) {
    const c = normalizeHex(header)
    root.style.setProperty('--table-head-chrome-light', shade(c, 88))
    root.style.setProperty('--table-head-chrome', shade(c, -78))
  } else {
    root.style.removeProperty('--table-head-chrome-light')
    root.style.removeProperty('--table-head-chrome')
  }
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

/** Convert a hex colour to HSL (for the sliding pickers). */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const v = normalizeHex(hex)
  const r = parseInt(v.slice(1, 3), 16) / 255
  const g = parseInt(v.slice(3, 5), 16) / 255
  const b = parseInt(v.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** Convert HSL back to an uppercase hex colour. */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase()
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

/** Apply (or clear) the custom table look CSS variables from company settings. */
export function applyTableTheme(c?: {
  tableHeaderBg?: string
  tableHeaderText?: string
  tableFooterBg?: string
  tableFooterText?: string
} | null) {
  const root = document.documentElement
  const set = (key: string, value: string | undefined, flag: string) => {
    if (value && isHexColor(value)) {
      root.style.setProperty(key, normalizeHex(value))
      root.classList.add(flag)
    } else {
      root.style.removeProperty(key)
      root.classList.remove(flag)
    }
  }
  set('--table-head-bg', c?.tableHeaderBg, 'tbl-head-bg')
  set('--table-head-ink', c?.tableHeaderText, 'tbl-head-ink')
  set('--table-foot-bg', c?.tableFooterBg, 'tbl-foot-bg')
  set('--table-foot-ink', c?.tableFooterText, 'tbl-foot-ink')
}

/** Apply (or clear) the custom card look CSS variables from company settings. */
export function applyCardTheme(c?: {
  cardBg?: string
  cardText?: string
  cardBorder?: string
  cardRadius?: number
  cardRadiusTl?: number
  cardRadiusTr?: number
  cardRadiusBr?: number
  cardRadiusBl?: number
  cardHeadDesign?: 'none' | 'band' | 'accent'
  cardHeadBg?: string
  cardHeadText?: string
  brandPrimary?: string
} | null) {
  const root = document.documentElement
  const setHex = (key: string, value?: string) => {
    if (value && isHexColor(value)) root.style.setProperty(key, normalizeHex(value))
    else root.style.removeProperty(key)
  }
  const setRadius = (key: string, value?: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      root.style.setProperty(key, `${Math.max(0, Math.min(32, value))}px`)
    } else {
      root.style.removeProperty(key)
    }
  }
  setHex('--card-bg', c?.cardBg)
  setHex('--card-ink', c?.cardText)
  setHex('--card-border', c?.cardBorder)
  setRadius('--card-radius', c?.cardRadius)
  setRadius('--card-radius-tl', c?.cardRadiusTl)
  setRadius('--card-radius-tr', c?.cardRadiusTr)
  setRadius('--card-radius-br', c?.cardRadiusBr)
  setRadius('--card-radius-bl', c?.cardRadiusBl)
  // Card header design: filled band / top accent line / plain.
  const headBg = c?.cardHeadBg && isHexColor(c.cardHeadBg) ? normalizeHex(c.cardHeadBg) : undefined
  if (headBg) root.style.setProperty('--card-head-bg', headBg)
  else root.style.removeProperty('--card-head-bg')
  const design = c?.cardHeadDesign === 'band' || c?.cardHeadDesign === 'accent' ? c.cardHeadDesign : 'none'
  if (design !== 'none') {
    const ink = c?.cardHeadText && isHexColor(c.cardHeadText)
      ? normalizeHex(c.cardHeadText)
      : readableInk(headBg || c?.brandPrimary || '#6F42C1')
    root.style.setProperty('--card-head-ink', ink)
  } else {
    root.style.removeProperty('--card-head-ink')
  }
  root.classList.toggle('card-head-band', design === 'band')
  root.classList.toggle('card-head-accent', design === 'accent')
}

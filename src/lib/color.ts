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

export function applyBrandColor(hex: string) {
  const color = normalizeHex(hex)
  const root = document.documentElement
  root.style.setProperty('--color-lime', color)
  root.style.setProperty('--brand', color)
  root.style.setProperty('--brand-glow', `${color}73`)
}

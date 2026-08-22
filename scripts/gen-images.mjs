// Generates cohesive, branded placeholder images for the demo (public/images/*.jpg).
// Pure Node (zlib) — writes valid PNG bytes named as .jpg (browsers sniff content).
// Scene images: diagonal gradient + lime accent circle + vignette.
// Avatars: vertical gradient + a simple person silhouette.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'images')

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function png(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // truecolor + alpha
  const raw = Buffer.alloc(h * (1 + w * 4))
  let off = 0
  for (let y = 0; y < h; y++) {
    raw[off++] = 0
    rgba.copy(raw, off, y * w * 4, (y + 1) * w * 4)
    off += w * 4
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const lerp = (a, b, t) => a + (b - a) * t

function makeBuffer(w, h) {
  const buf = Buffer.alloc(w * h * 4)
  return { w, h, buf }
}
function setPx(img, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return
  const i = (y * img.w + x) * 4
  const srcA = a / 255
  const dstA = img.buf[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) return
  img.buf[i] = Math.round((r * srcA + img.buf[i] * dstA * (1 - srcA)) / outA)
  img.buf[i + 1] = Math.round((g * srcA + img.buf[i + 1] * dstA * (1 - srcA)) / outA)
  img.buf[i + 2] = Math.round((b * srcA + img.buf[i + 2] * dstA * (1 - srcA)) / outA)
  img.buf[i + 3] = Math.round(outA * 255)
}
function fillGradient(img, c1, c2, diagonal = true) {
  const a = hex(c1), b = hex(c2)
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const t = diagonal ? (x / img.w + y / img.h) / 2 : y / img.h
      setPx(img, x, y, lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))
    }
  }
}
function fillCircle(img, cx, cy, r, color, alpha = 255) {
  const [cr, cg, cb] = hex(color)
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r) setPx(img, x, y, cr, cg, cb, alpha)
    }
  }
}
function fillEllipse(img, cx, cy, rx, ry, color, alpha = 255) {
  const [cr, cg, cb] = hex(color)
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d <= 1) setPx(img, x, y, cr, cg, cb, alpha)
    }
  }
}
function vignette(img, strength = 0.35) {
  const cx = img.w / 2, cy = img.h / 2
  const maxD = Math.hypot(cx, cy)
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxD
      const f = Math.max(0, 1 - strength * Math.max(0, d - 0.35) * 2)
      if (f < 1) {
        const i = (y * img.w + x) * 4
        img.buf[i] = Math.round(img.buf[i] * f)
        img.buf[i + 1] = Math.round(img.buf[i + 1] * f)
        img.buf[i + 2] = Math.round(img.buf[i + 2] * f)
      }
    }
  }
}

// --- Scene images: gradient + accent circle + vignette ---
const scenes = {
  'class-spin.jpg': ['#0b1a22', '#0b0b0d', '#C8F542'],
  'class-pilates.jpg': ['#241a2e', '#111113', '#A78BFA'],
  'blog-1.jpg': ['#1a2603', '#0b0b0d', '#C8F542'],
  'blog-2.jpg': ['#33201a', '#111113', '#FF6B2C'],
  'blog-3.jpg': ['#0f1f33', '#0b0b0d', '#38BDF8'],
}

for (const [name, [c1, c2, accent]] of Object.entries(scenes)) {
  const img = makeBuffer(1200, 760)
  fillGradient(img, c1, c2)
  fillCircle(img, 1000, 160, 340, accent, 40)
  fillCircle(img, 120, 680, 260, accent, 22)
  vignette(img, 0.4)
  writeFileSync(join(OUT, name), png(img.w, img.h, img.buf))
  console.log('✓ scene', name)
}

// --- Avatars: gradient + silhouette (head + shoulders) ---
const SIL = '#141419'
const avatars = {
  'member-ava-1.jpg': ['#3a3a40', '#15151a'],
  'member-ava-2.jpg': ['#4a3d1f', '#15151a'],
  'member-ava-3.jpg': ['#1f3d44', '#0d1416'],
  'member-ava-4.jpg': ['#3a213f', '#161118'],
  'member-ava-5.jpg': ['#1f4433', '#0e1512'],
  'member-ava-6.jpg': ['#443023', '#16100e'],
  'trainer-1.jpg': ['#2e3440', '#12151c'],
  'trainer-2.jpg': ['#423422', '#14110d'],
  'trainer-3.jpg': ['#22363e', '#0e1417'],
  'trainer-4.jpg': ['#372a3c', '#131017'],
  'success-1.jpg': ['#3c4a1a', '#141609'],
  'success-2.jpg': ['#2e4428', '#101409'],
  'success-3.jpg': ['#1f3a44', '#0c1316'],
}

for (const [name, [c1, c2]] of Object.entries(avatars)) {
  const img = makeBuffer(512, 512)
  fillGradient(img, c1, c2, false)
  // subtle lime glow behind silhouette
  fillCircle(img, 256, 250, 150, '#C8F542', 26)
  // head
  fillCircle(img, 256, 190, 82, SIL)
  // shoulders (large ellipse clipped at bottom)
  fillEllipse(img, 256, 470, 170, 150, SIL)
  // neck join
  fillEllipse(img, 256, 300, 58, 46, SIL)
  vignette(img, 0.25)
  writeFileSync(join(OUT, name), png(img.w, img.h, img.buf))
  console.log('✓ avatar', name)
}
console.log('Done.')

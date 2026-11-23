// Code 128 (Code Set B) barcode encoder — produces real, scannable barcodes
// with the mandatory checksum and stop/termination bars. No dependencies.

// The canonical Code 128 pattern table: 107 values, each a run of bar/space
// widths (6 elements for values 0-105, 7 for the stop code).
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]

const START_B = 104
const STOP = 106

export interface Code128Result {
  /** Bar rectangles in module units (x = left edge, w = width). */
  bars: { x: number; w: number }[]
  /** Total width in modules (excluding quiet zones). */
  modules: number
}

/**
 * Encode a string as Code 128 Code Set B (ASCII 32-127). Throws if a
 * character is outside that range.
 */
export function code128Encode(text: string): Code128Result {
  const values: number[] = []
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 32
    if (code < 0 || code > 95) {
      throw new Error(`Code 128 B cannot encode character "${ch}".`)
    }
    values.push(code)
  }

  let checksum = START_B
  values.forEach((v, i) => {
    checksum += v * (i + 1)
  })
  checksum %= 103

  const codes = [START_B, ...values, checksum, STOP]

  const bars: { x: number; w: number }[] = []
  let x = 0
  for (const code of codes) {
    const pat = CODE128_PATTERNS[code]
    for (let i = 0; i < pat.length; i++) {
      const w = Number(pat[i])
      if (i % 2 === 0) {
        bars.push({ x, w })
        x += w
      } else {
        x += w
      }
    }
  }
  // Termination bar (2 modules).
  bars.push({ x, w: 2 })
  x += 2

  return { bars, modules: x }
}

import { code128Encode } from '../lib/barcode'

/**
 * Renders a real, scannable Code 128 barcode as an SVG.
 */
export function Barcode({
  value,
  height = 44,
  moduleWidth = 2,
  quietZone = 10,
  className,
  ariaLabel,
}: {
  value: string
  height?: number
  moduleWidth?: number
  quietZone?: number
  className?: string
  ariaLabel?: string
}) {
  let bars: { x: number; w: number }[] = []
  let modules = 0
  try {
    const r = code128Encode(value)
    bars = r.bars
    modules = r.modules
  } catch {
    // Un-encodable text: render nothing (caller handles fallback).
    return null
  }

  const qz = quietZone * moduleWidth
  const width = modules * moduleWidth + qz * 2

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel || `Barcode ${value}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <rect width={width} height={height} fill="#fff" />
      {bars.map((b, i) => (
        <rect
          key={i}
          x={qz + b.x * moduleWidth}
          y={0}
          width={b.w * moduleWidth}
          height={height}
          fill="#111"
        />
      ))}
    </svg>
  )
}

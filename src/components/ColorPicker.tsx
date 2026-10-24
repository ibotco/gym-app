import { useId } from 'react'
import { hexToHsl, hslToHex, isHexColor, normalizeHex } from '../lib/color'
import { cn } from '../lib/utils'

export const BRAND_PRESETS = [
  { hex: '#C8F542', name: 'FitPro lime' },
  { hex: '#D6FF63', name: 'Bright lime' },
  { hex: '#FF6B2C', name: 'Ember' },
  { hex: '#FBBF24', name: 'Gold' },
  { hex: '#38BDF8', name: 'Sky' },
  { hex: '#A78BFA', name: 'Violet' },
  { hex: '#FB7185', name: 'Rose' },
  { hex: '#34D399', name: 'Mint' },
  // Bootstrap 5 theme colours
  { hex: '#0D6EFD', name: 'Bootstrap primary' },
  { hex: '#6C757D', name: 'Bootstrap secondary' },
  { hex: '#198754', name: 'Bootstrap success' },
  { hex: '#DC3545', name: 'Bootstrap danger' },
  { hex: '#FFC107', name: 'Bootstrap warning' },
  { hex: '#0DCAF0', name: 'Bootstrap info' },
  { hex: '#F8F9FA', name: 'Bootstrap light' },
  { hex: '#212529', name: 'Bootstrap dark' },
  // Bootstrap 5.3 extended palette
  { hex: '#6610F2', name: 'Indigo' },
  { hex: '#6F42C1', name: 'Purple' },
  { hex: '#D63384', name: 'Pink' },
  { hex: '#FD7E14', name: 'Orange' },
  { hex: '#20C997', name: 'Teal' },
]

export function ColorPicker({
  value,
  onChange,
  label = 'Colour',
}: {
  value: string
  onChange: (hex: string) => void
  label?: string
}) {
  const id = useId()
  const hex = normalizeHex(value)
  const typedOk = isHexColor(value)
  const hsl = hexToHsl(hex)

  return (
    <div className="color-picker">
      <div className="flex items-center gap-3">
        <label className="color-picker-swatch" htmlFor={id} title="Open colour picker">
          <input
            id={id}
            type="color"
            value={hex}
            aria-label={label}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        </label>
        <div className="min-w-0 flex-1">
          <input
            className={cn('field font-mono uppercase tracking-wider', !typedOk && value.trim() && 'border-ember')}
            value={value}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="#C8F542"
            aria-label={`${label} hex`}
            onChange={(e) => {
              const next = e.target.value
              onChange(next.startsWith('#') || next === '' ? next : `#${next}`)
            }}
            onBlur={() => onChange(normalizeHex(value))}
          />
        </div>
      </div>
      {/* Sliding colour controls: hue, saturation, lightness */}
      <div className="mt-3 space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-semibold text-mist">Hue</span>
          <input
            id={`${id}-h`}
            type="range"
            min={0}
            max={360}
            value={hsl.h}
            className="color-slider"
            aria-label={`${label} hue`}
            style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
            onChange={(e) => onChange(hslToHex(Number(e.target.value), hsl.s, hsl.l))}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-semibold text-mist">Saturation</span>
          <input
            id={`${id}-s`}
            type="range"
            min={0}
            max={100}
            value={hsl.s}
            className="color-slider"
            aria-label={`${label} saturation`}
            style={{ background: `linear-gradient(to right, hsl(${hsl.h} 0% ${hsl.l}%), hsl(${hsl.h} 100% ${hsl.l}%))` }}
            onChange={(e) => onChange(hslToHex(hsl.h, Number(e.target.value), hsl.l))}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-xs font-semibold text-mist">Lightness</span>
          <input
            id={`${id}-l`}
            type="range"
            min={0}
            max={100}
            value={hsl.l}
            className="color-slider"
            aria-label={`${label} lightness`}
            style={{ background: `linear-gradient(to right, hsl(${hsl.h} ${hsl.s}% 0%), hsl(${hsl.h} ${hsl.s}% 50%), hsl(${hsl.h} ${hsl.s}% 100%))` }}
            onChange={(e) => onChange(hslToHex(hsl.h, hsl.s, Number(e.target.value)))}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="list" aria-label="Preset colours">
        {BRAND_PRESETS.map((p) => {
          const on = hex === p.hex
          return (
            <button
              key={p.hex}
              type="button"
              role="listitem"
              title={p.name}
              aria-label={p.name}
              aria-pressed={on}
              className={cn('color-preset', on && 'is-on')}
              style={{ background: p.hex }}
              onClick={() => onChange(p.hex)}
            />
          )
        })}
      </div>
    </div>
  )
}

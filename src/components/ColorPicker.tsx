import { useId } from 'react'
import { isHexColor, normalizeHex } from '../lib/color'
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

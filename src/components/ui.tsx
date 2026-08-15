import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react'

export function Button({
  variant = 'lime',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'lime' | 'ghost' | 'dark' | 'outline' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}) {
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-sm',
    icon: 'size-10 p-0',
  }
  const variants = {
    lime: 'btn-lime',
    ghost: 'hover:bg-white/5 text-mist hover:text-inherit',
    dark: 'bg-zinc-100 text-ink hover:bg-white dark:bg-zinc-100 dark:text-ink',
    outline: 'border border-line hover:border-lime/50 hover:bg-lime/5',
    danger: 'bg-ember text-white hover:brightness-110',
    soft: 'bg-lime/15 text-lime hover:bg-lime/25',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:pointer-events-none',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'password') return <PasswordInput className={className} {...props} />
  return <input type={type} className={cn('field', className)} {...props} />
}

export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false)
  const label = show ? 'Hide password' : 'Show password'
  return (
    <div className="pw-wrap">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('field pw-field', className)}
        autoComplete={props.autoComplete || 'current-password'}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={label}
        aria-pressed={show}
        title={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="size-4" strokeWidth={1.75} aria-hidden /> : <Eye className="size-4" strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  )
}

type SelectOption = { value: string; label: string; disabled?: boolean }

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

function collectOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return
    if (child.type === 'option') {
      const label = nodeText(child.props.children).trim()
      const value = child.props.value !== undefined ? String(child.props.value) : label
      out.push({ value, label, disabled: !!child.props.disabled })
      return
    }
    if (child.props.children) out.push(...collectOptions(child.props.children))
  })
  return out
}

function prettyLabel(label: string) {
  if (!label) return label
  if (label === label.toLowerCase() && /^[a-z0-9 _-]+$/.test(label)) {
    return label.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return label
}

function fireSelectChange(
  onChange: SelectHTMLAttributes<HTMLSelectElement>['onChange'],
  name: string | undefined,
  next: string,
) {
  if (!onChange) return
  onChange({
    target: { value: next, name: name || '' },
    currentTarget: { value: next, name: name || '' },
  } as unknown as ChangeEvent<HTMLSelectElement>)
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  required,
  placeholder,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const options = useMemo(() => collectOptions(children), [children])
  const controlled = value !== undefined
  const [inner, setInner] = useState(String(defaultValue ?? value ?? options[0]?.value ?? ''))
  const selected = controlled ? String(value) : inner
  const selectedLabel = prettyLabel(options.find((o) => o.value === selected)?.label ?? '')
  const emptyText = placeholder || 'Select…'

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 })
  const boxRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listId = id || uid

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!tokens.length) return options
    return options.filter((o) => {
      const hay = `${prettyLabel(o.label)} ${o.label} ${o.value}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [options, query])

  const openMenu = () => {
    if (disabled) return
    setQuery('')
    setOpen(true)
  }

  const closeMenu = () => {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    const idx = filtered.findIndex((o) => o.value === selected)
    setActive(idx >= 0 ? idx : 0)
  }, [filtered, selected, open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const el = boxRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 2
      const want = Math.min(280, Math.max(filtered.length, 1) * 38 + 8)
      const below = window.innerHeight - r.bottom - 8
      const above = r.top - 8
      const openUp = below < 140 && above > below
      const maxHeight = Math.max(120, openUp ? above : below)
      const height = Math.min(want, maxHeight)
      let left = r.left
      const width = r.width
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
      setPos({
        top: openUp ? r.top - height - gap : r.bottom + gap,
        left,
        width,
        maxHeight: height,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, filtered.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = menuRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const pick = (opt: SelectOption) => {
    if (opt.disabled) return
    if (!controlled) setInner(opt.value)
    fireSelectChange(onChange, name, opt.value)
    closeMenu()
  }

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[active]) pick(filtered[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    } else if (e.key === 'Tab') {
      closeMenu()
    }
  }

  return (
    <div ref={boxRef} className={cn('nice-select', open && 'is-open', className)}>
      {open ? (
        <div className={cn('nice-select-control is-open', disabled && 'is-disabled')}>
          <input
            ref={inputRef}
            id={id}
            name={name}
            disabled={disabled}
            required={required}
            role="combobox"
            aria-expanded
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={`${listId}-opt-${active}`}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            placeholder={selectedLabel ? `Search… ${selectedLabel}` : 'Type to search…'}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <Search className="nice-select-icon" strokeWidth={1.75} aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={false}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          className={cn('nice-select-control is-closed', disabled && 'is-disabled')}
          onClick={openMenu}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openMenu()
            }
          }}
        >
          <span className={cn('nice-select-value', !selectedLabel && 'is-placeholder')}>
            {selectedLabel || emptyText}
          </span>
          <ChevronDown className="nice-select-icon" strokeWidth={1.75} aria-hidden />
        </button>
      )}
      {open && createPortal(
        <div
          ref={menuRef}
          id={`${listId}-list`}
          role="listbox"
          className="nice-select-menu"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
        >
          {filtered.length === 0 && <div className="nice-select-empty">No matches</div>}
          {filtered.map((opt, i) => {
            const label = prettyLabel(opt.label)
            const isOn = i === active
            const isSel = opt.value === selected
            return (
              <div
                key={`${opt.value}-${i}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={isSel}
                data-active={isOn || undefined}
                className={cn(
                  'nice-select-option',
                  isOn && 'is-active',
                  isSel && !isOn && 'is-selected',
                  opt.disabled && 'is-disabled',
                )}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  pick(opt)
                }}
              >
                {label}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('field min-h-24 resize-y', className)} {...props} />
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
      {children}
    </label>
  )
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>
        {required && <span className="mr-1 text-[#e00]" aria-hidden>*</span>}
        {label}
      </Label>
      <div id={id}>{children}</div>
    </div>
  )
}

export function Badge({
  children,
  tone = 'zinc',
  className,
}: {
  children: ReactNode
  tone?: 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange'
  className?: string
}) {
  const tones: Record<string, string> = {
    zinc: 'bg-zinc-500/15 text-zinc-300 dark:text-zinc-300 text-zinc-700',
    lime: 'bg-lime/15 text-lime-ink dark:text-lime',
    amber: 'bg-amber-400/15 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    sky: 'bg-sky-400/15 text-sky-800 dark:text-sky-300',
    violet: 'bg-violet-400/15 text-violet-800 dark:text-violet-300',
    orange: 'bg-orange-400/15 text-orange-800 dark:text-orange-300',
  }
  return <span className={cn('chip', tones[tone], className)}>{children}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Parameters<typeof Badge>[0]['tone']; label: string }> = {
    active: { tone: 'lime', label: 'Active' },
    paid: { tone: 'lime', label: 'Paid' },
    booked: { tone: 'lime', label: 'Booked' },
    attended: { tone: 'lime', label: 'Attended' },
    approved: { tone: 'lime', label: 'Approved' },
    converted: { tone: 'lime', label: 'Converted' },
    completed: { tone: 'lime', label: 'Completed' },
    pending: { tone: 'amber', label: 'Pending' },
    unpaid: { tone: 'amber', label: 'Unpaid' },
    waitlist: { tone: 'amber', label: 'Waitlist' },
    trial: { tone: 'amber', label: 'Trial' },
    contacted: { tone: 'sky', label: 'Contacted' },
    new: { tone: 'sky', label: 'New' },
    scheduled: { tone: 'sky', label: 'Scheduled' },
    expired: { tone: 'rose', label: 'Expired' },
    cancelled: { tone: 'rose', label: 'Cancelled' },
    failed: { tone: 'rose', label: 'Failed' },
    overdue: { tone: 'rose', label: 'Overdue' },
    rejected: { tone: 'rose', label: 'Rejected' },
    lost: { tone: 'rose', label: 'Lost' },
    suspended: { tone: 'rose', label: 'Suspended' },
    inactive: { tone: 'zinc', label: 'Inactive' },
    frozen: { tone: 'violet', label: 'Frozen' },
    refunded: { tone: 'violet', label: 'Refunded' },
    'no-show': { tone: 'orange', label: 'No-show' },
    connected: { tone: 'lime', label: 'Connected' },
    disconnected: { tone: 'zinc', label: 'Disconnected' },
    online: { tone: 'lime', label: 'Online' },
    offline: { tone: 'zinc', label: 'Offline' },
    error: { tone: 'rose', label: 'Error' },
    configured: { tone: 'sky', label: 'Configured' },
  }
  const m = map[status] || { tone: 'zinc' as const, label: status }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function Avatar({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dim = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-16 text-lg' }[size]
  const ini = name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return src ? (
    <img src={src} alt={name} className={cn('rounded-full object-cover bg-ink-3', dim)} />
  ) : (
    <div className={cn('grid place-items-center rounded-full bg-lime/20 font-bold text-lime', dim)}>{ini}</div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn('card w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 id="modal-title" className="font-display text-lg font-semibold">
            {title}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-mist hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow?: string
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-lime">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-mist">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
}: {
  label: string
  value: string
  delta?: string
  icon?: ReactNode
  hint?: string
}) {
  const up = delta?.startsWith('+')
  const down = delta?.startsWith('-')
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-mist">{label}</p>
        {icon && <div className="grid size-8 place-items-center rounded-lg bg-lime/10 text-lime">{icon}</div>}
      </div>
      <p className="stat-num mt-2 text-2xl md:text-3xl">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cn('font-semibold', up && 'text-lime', down && 'text-ember', !up && !down && 'text-mist')}>
            {delta}
          </span>
        )}
        {hint && <span className="text-mist">{hint}</span>}
      </div>
    </div>
  )
}

export function Empty({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <p className="font-display text-lg">{title}</p>
      {desc && <p className="mt-1 text-sm text-mist">{desc}</p>}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="max-w-sm"
    />
  )
}

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-ink-2 p-1 dark:bg-ink-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === o.id ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', light && 'text-ink')}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#111' : '#C8F542'} />
        <path d="M8 8h10.2a5.2 5.2 0 0 1 0 10.4H14V24H8V8zm6 3.8v2.8h3.9a1.4 1.4 0 0 0 0-2.8H14z" fill={light ? '#C8F542' : '#132000'} />
      </svg>
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight">
          FitPro<span className="text-lime">.</span>
        </span>
      )}
    </div>
  )
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-line" />
      {label && <span className="text-[11px] font-bold uppercase tracking-widest text-mist">{label}</span>}
      {label && <div className="h-px flex-1 bg-line" />}
    </div>
  )
}

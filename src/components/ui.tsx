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
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Search, X } from 'lucide-react'

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

/** Blue toggle switch (enterprise style). */
export function Switch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-sky-500' : 'bg-zinc-400/40 dark:bg-zinc-600',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
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
  icon,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string; icon?: ReactNode }) {
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
        <div className={cn('nice-select-control is-open', icon && 'has-leading', disabled && 'is-disabled')}>
          {icon && <span className="nice-select-leading">{icon}</span>}
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
          className={cn('nice-select-control is-closed', icon && 'has-leading', disabled && 'is-disabled')}
          onClick={openMenu}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openMenu()
            }
          }}
        >
          {icon && <span className="nice-select-leading">{icon}</span>}
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

export function Field({ label, children, required }: { label: ReactNode; children: ReactNode; required?: boolean }) {
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

export function Avatar({
  src,
  name,
  size = 'md',
  preview = true,
}: {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  preview?: boolean
}) {
  const dim = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-16 text-lg' }[size]
  const ini = name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)

  const showPreview = preview && !!src

  return (
    <span
      ref={wrapRef}
      className="inline-flex shrink-0"
      onMouseEnter={(e) => {
        if (!showPreview) return
        setHover({ x: e.clientX, y: e.clientY })
      }}
      onMouseMove={(e) => {
        if (!showPreview) return
        setHover({ x: e.clientX, y: e.clientY })
      }}
      onMouseLeave={() => setHover(null)}
    >
      {src ? (
        <img src={src} alt={name} className={cn('rounded-full object-cover bg-ink-3', dim)} />
      ) : (
        <div className={cn('grid place-items-center rounded-full bg-lime/20 font-bold text-lime', dim)}>{ini}</div>
      )}
      {showPreview &&
        hover &&
        createPortal(
          <img
            src={src}
            alt={name}
            aria-hidden
            className="pointer-events-none fixed z-[120] size-32 rounded-2xl border border-lime/40 object-cover shadow-2xl ring-1 ring-black/40"
            style={{
              left: Math.min(hover.x + 18, window.innerWidth - 148),
              top: Math.min(hover.y + 18, window.innerHeight - 148),
            }}
          />,
          document.body,
        )}
    </span>
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

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <SearchField value={value} onChange={onChange} placeholder={placeholder} className={cn('max-w-sm', className)} />
}

/**
 * Professional search field — embedded magnifying-glass icon on the left,
 * a clear (×) button when there's text, and a clean light/dark surface.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
  shortcut,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Optional keyboard-shortcut hint shown inside the field (e.g. "⌘K" or "/"). */
  shortcut?: string
  /** Optional ref to the underlying input (for programmatic focus). */
  inputRef?: Ref<HTMLInputElement>
}) {
  return (
    <div className={cn('search-field relative', shortcut && !value && 'has-kbd', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-mist" strokeWidth={2} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        className="field w-full pl-10 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-mist transition hover:bg-black/10 hover:text-inherit dark:hover:bg-white/10"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut && <kbd className="search-kbd">{shortcut}</kbd>
      )}
    </div>
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [options.length])

  // When the active value changes (e.g. a tab is selected via search), scroll
  // the horizontal bar so the active tab is fully visible.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const activeBtn = el.querySelector<HTMLButtonElement>('[data-active="true"]')
    if (!activeBtn) return
    // Wait a frame so layout reflects the (possibly filtered) option list.
    const raf = requestAnimationFrame(() => {
      const elRect = el.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()
      const margin = 12
      if (btnRect.left < elRect.left) {
        el.scrollBy({ left: Math.round(btnRect.left - elRect.left - margin), behavior: 'smooth' })
      } else if (btnRect.right > elRect.right) {
        el.scrollBy({ left: Math.round(btnRect.right - elRect.right + margin), behavior: 'smooth' })
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [value, options.length])

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' })
  }

  const hasOverflow = canLeft || canRight

  return (
    <div
      className={cn(
        'segmented-shell inline-flex max-w-full items-center gap-0.5 rounded-xl border border-line bg-ink-2 p-1 dark:bg-ink-2',
        hasOverflow && 'pr-1 pl-1',
      )}
    >
      {/* Left chevron — ghost, appears only when there's more to the left */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll tabs left"
        tabIndex={canLeft ? 0 : -1}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md text-mist transition-all duration-200 hover:bg-black/10 hover:text-inherit dark:hover:bg-white/10',
          canLeft ? 'opacity-100' : 'pointer-events-none w-0 overflow-hidden opacity-0',
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      <div
        ref={scrollerRef}
        className="segmented-scroll flex flex-1 items-center gap-1 overflow-x-auto"
      >
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            data-active={value === o.id || undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              value === o.id ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Right chevron — ghost, appears only when there's more to the right */}
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Scroll tabs right"
        tabIndex={canRight ? 0 : -1}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-md text-mist transition-all duration-200 hover:bg-black/10 hover:text-inherit dark:hover:bg-white/10',
          canRight ? 'opacity-100' : 'pointer-events-none w-0 overflow-hidden opacity-0',
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export function Logo({ compact, light, text, logoImage }: { compact?: boolean; light?: boolean; text?: string; logoImage?: string }) {
  return (
    <div className={cn('flex items-center gap-2', light && 'text-ink')}>
      {logoImage ? (
        <img src={logoImage} alt="" className="h-7 w-7 rounded-md object-contain" />
      ) : (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect width="32" height="32" rx="8" fill={light ? '#111' : '#C8F542'} />
          <path d="M8 8h10.2a5.2 5.2 0 0 1 0 10.4H14V24H8V8zm6 3.8v2.8h3.9a1.4 1.4 0 0 0 0-2.8H14z" fill={light ? '#C8F542' : '#132000'} />
        </svg>
      )}
      {!compact && (
        <span className="sidebar-logo-text font-display text-[17px] font-bold tracking-tight">
          {text || 'FitPro'}<span className="text-lime">.</span>
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

// ============================================================
//  DatePicker — modern Fluent-style date field with calendar popup
// ============================================================

function pad2(n: number) { return String(n).padStart(2, '0') }

/** Parse a YYYY-MM-DD string into a local Date (or null if invalid). */
function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((iso || '').trim())
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** First day of the week (0 = Sun) for a locale, defaulting to Monday. */
function firstDayOfWeek(locale: string): number {
  try {
    const wd = (new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay?: number } }).weekInfo?.firstDay
    if (typeof wd === 'number') return wd % 7
  } catch { /* ignore */ }
  return 1 // Monday
}

const MONTH_NAME = (locale: string, d: Date) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
const DAY_LABEL = (locale: string, d: Date) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
const WEEKDAY_NARROW = (locale: string, d: Date) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d)

/** Lenient manual-entry parser. Returns a Date, null if empty, undefined if unparsable. */
function parseTextInput(raw: string, locale: string): Date | null | undefined {
  const s = raw.trim()
  if (!s) return null
  const iso = parseIso(s)
  if (iso) return iso

  // Numeric with separators: YYYY-MM-DD / DD-MM-YYYY / MM-DD-YYYY
  const num = s.replace(/[,]+/g, ' ').replace(/[./\s]+/g, '-').split('-').map((p) => p.trim()).filter(Boolean)
  if (num.length === 3 && num.every((p) => /^\d{1,4}$/.test(p))) {
    let y: number; let mo: number; let da: number
    const [a, b, c] = num.map(Number)
    if (a > 1000) { y = a; mo = b; da = c }
    else if (c > 1000 || c > 31) { y = c; mo = b; da = a }
    else if (a > 12) { da = a; mo = b; y = c }
    else if (/^en[-_]US$/i.test(locale)) { mo = a; da = b; y = c }
    else { da = a; mo = b; y = c }
    if (y < 100) y += 2000
    const dt = new Date(y, mo - 1, da)
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === da) return dt
  }

  // Named months, e.g. "18 Aug 2026" / "Aug 18, 2026"
  const t = Date.parse(s)
  if (!Number.isNaN(t)) {
    const dt = new Date(t)
    if (dt.getFullYear() >= 100 && dt.getFullYear() <= 2200) return dt
  }
  return undefined
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Select a date',
  className,
  disabled,
  'aria-label': ariaLabel,
  inputRef,
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  inputRef?: Ref<HTMLInputElement>
}) {
  const locale = typeof navigator !== 'undefined' ? (navigator.languages?.[0] || navigator.language || 'en-GB') : 'en-GB'
  const minDate = min ? parseIso(min) : null
  const maxDate = max ? parseIso(max) : null

  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false })

  const selected = value ? parseIso(value) : null
  const [view, setView] = useState(() => {
    const d = selected || new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [focusDay, setFocusDay] = useState<number | null>(null)

  const fd = firstDayOfWeek(locale)

  // Sync text when the external value changes (and we aren't mid-typing).
  useEffect(() => {
    if (!focused) {
      setText(value ? DAY_LABEL(locale, parseIso(value)!) : '')
      setError('')
    }
  }, [value, focused, locale])

  const inRange = (d: Date) =>
    (!minDate || d >= minDate) && (!maxDate || d <= maxDate)

  const commit = (iso: string) => {
    onChange(iso)
    setError('')
    const d = parseIso(iso)
    if (d) setText(DAY_LABEL(locale, d))
    setOpen(false)
  }

  const commitText = () => {
    if (disabled) return
    const parsed = parseTextInput(text, locale)
    if (parsed === null) {
      // empty
      onChange('')
      setText('')
      setError('')
      return
    }
    if (!parsed) {
      setError('Invalid date. Try "18 Aug 2026" or "18/08/2026".')
      setText(value ? DAY_LABEL(locale, parseIso(value)!) : '')
      return
    }
    if (!inRange(parsed)) {
      setError(minDate && parsed < minDate ? `Date must be on or after ${DAY_LABEL(locale, minDate)}.` : `Date must be on or before ${DAY_LABEL(locale, maxDate!)}.`)
      setText(value ? DAY_LABEL(locale, parseIso(value)!) : '')
      return
    }
    onChange(toIso(parsed))
    setText(DAY_LABEL(locale, parsed))
    setError('')
  }

  const openPopup = () => {
    if (disabled) return
    const d = selected || new Date()
    setView({ year: d.getFullYear(), month: d.getMonth() })
    setFocusDay(selected ? selected.getDate() : new Date().getDate())
    setOpen(true)
  }

  // Position + outside-click + escape.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const popW = 300
      const popH = 340
      const below = window.innerHeight - r.bottom - 8
      const openUp = below < popH && r.top > below
      let left = r.left
      if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8)
      setPos({ top: openUp ? r.top - popH - 6 : r.bottom + 6, left, openUp })
    }
    place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Focus the highlighted day.
  useEffect(() => {
    if (!open || focusDay == null) return
    popRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus()
  }, [open, focusDay, view])

  // Build the 42-cell grid.
  const cells: (number | null)[] = useMemo(() => {
    const first = new Date(view.year, view.month, 1)
    const leading = (first.getDay() - fd + 7) % 7
    const count = new Date(view.year, view.month + 1, 0).getDate()
    const arr: (number | null)[] = []
    for (let i = 0; i < leading; i++) arr.push(null)
    for (let d = 1; d <= count; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [view, fd])

  const moveMonth = (delta: number) => {
    setView((v) => {
      let m = v.month + delta; let y = v.year
      if (m < 0) { m = 11; y-- } else if (m > 11) { m = 0; y++ }
      return { year: y, month: m }
    })
  }

  const canPrev = !minDate || (view.year > minDate.getFullYear() || (view.year === minDate.getFullYear() && view.month > minDate.getMonth()))
  const canNext = !maxDate || (view.year < maxDate.getFullYear() || (view.year === maxDate.getFullYear() && view.month < maxDate.getMonth()))

  const gridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const days = cells.filter((c): c is number => c != null)
    const cur = focusDay ?? (selected && view.year === selected.getFullYear() && view.month === selected.getMonth() ? selected.getDate() : new Date().getDate())
    const idx = days.indexOf(cur)
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = days[(idx - 1 + days.length) % days.length]
    else if (e.key === 'ArrowRight') next = days[(idx + 1) % days.length]
    else if (e.key === 'ArrowUp') next = days[Math.max(0, idx - 7)]
    else if (e.key === 'ArrowDown') next = days[Math.min(days.length - 1, idx + 7)]
    else if (e.key === 'PageUp') { moveMonth(-1); return }
    else if (e.key === 'PageDown') { moveMonth(1); return }
    else if (e.key === 'Home') next = days[0]
    else if (e.key === 'End') next = days[days.length - 1]
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (focusDay) selectDay(focusDay); return }
    else if (e.key === 'Escape') { setOpen(false); return }
    else return
    if (next != null) { e.preventDefault(); setFocusDay(next) }
  }

  const selectDay = (day: number) => {
    const d = new Date(view.year, view.month, day)
    if (!inRange(d)) return
    commit(toIso(d))
    innerRef.current?.focus()
  }

  const shown = focused || open ? text : (text || (value ? DAY_LABEL(locale, parseIso(value)!) : ''))

  return (
    <div ref={wrapRef} className={cn('date-picker relative', className)}>
      <div className={cn('date-field relative', error && 'date-field-error', disabled && 'date-field-disabled')}>
        <input
          ref={(el) => {
            innerRef.current = el
            if (typeof inputRef === 'function') inputRef(el)
            else if (inputRef) (inputRef as { current?: HTMLInputElement | null }).current = el
          }}
          type="text"
          value={shown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? `${uid}-pop` : undefined}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          className="field date-input w-full pr-10"
          onChange={(e) => { setText(e.target.value); setError('') }}
          onFocus={() => { setFocused(true); openPopup() }}
          onBlur={() => { setFocused(false); commitText() }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); openPopup() }
            else if (e.key === 'Enter') { e.preventDefault(); commitText() }
            else if (e.key === 'Escape') { setOpen(false); setText(value ? DAY_LABEL(locale, parseIso(value)!) : '') }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open calendar"
          className="date-cal-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : openPopup())}
        >
          <Calendar className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
      </div>

      {error && (
        <p role="alert" className="date-error mt-1.5 text-xs text-ember">{error}</p>
      )}

      {open && createPortal(
        <div
          ref={popRef}
          id={`${uid}-pop`}
          role="dialog"
          aria-label="Choose date"
          className="date-pop fixed z-[75] w-[300px] rounded-2xl p-3 shadow-2xl"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="mb-1 flex items-center justify-between">
            <button type="button" className="date-nav-btn" aria-label="Previous month" disabled={!canPrev} onMouseDown={(e) => e.preventDefault()} onClick={() => moveMonth(-1)}>
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-display text-sm font-semibold">{MONTH_NAME(locale, new Date(view.year, view.month, 1))}</p>
            <button type="button" className="date-nav-btn" aria-label="Next month" disabled={!canNext} onMouseDown={(e) => e.preventDefault()} onClick={() => moveMonth(1)}>
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center" role="grid" onKeyDown={gridKeyDown}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(2024, 0, 7 + ((fd + i) % 7)) // 7 Jan 2024 is a Sunday
              return (
                <span key={i} className="py-1 text-[10px] font-bold uppercase tracking-wide text-mist" aria-hidden>
                  {WEEKDAY_NARROW(locale, d)}
                </span>
              )
            })}
            {cells.map((day, i) => {
              if (day == null) return <span key={i} />
              const d = new Date(view.year, view.month, day)
              const disabledCell = !inRange(d)
              const isSelected = selected ? sameDay(selected, d) : false
              const isToday = sameDay(new Date(), d)
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  data-day={day}
                  disabled={disabledCell}
                  aria-label={DAY_LABEL(locale, d)}
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectDay(day)}
                  className={cn('date-day', isToday && 'date-day-today', isSelected && 'date-day-selected')}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              className="text-xs font-semibold text-lime hover:underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { const t = new Date(); setView({ year: t.getFullYear(), month: t.getMonth() }); setFocusDay(t.getDate()) }}
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                className="text-xs font-semibold text-mist hover:text-ember"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(''); setText(''); setOpen(false) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

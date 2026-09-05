import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { SearchField } from '../../components/ui'
import { cn } from '../../lib/utils'

/**
 * Settings navigation shell — hybrid layout for the 26 existing settings pages.
 *
 * Navigation-only: this component (and `SETTINGS_CATEGORIES`) only decides HOW
 * users reach the pages. The pages themselves are rendered by `Settings.tsx`
 * from the `tab` prop it passes here; nothing about their markup, styles or
 * logic lives in this file.
 *
 * Layout:
 *  - Top bar    = category tabs (5, one row, never scroll)
 *  - Left panel = vertical sub-menu of the active category's items
 *  - Content    = the selected existing settings page, unchanged
 *  - ≤768px     = a single slide-in drawer holding the category tabs + sub-menu
 */

export interface SettingsNavItem {
  /** The existing tab id used by Settings.tsx's render blocks. */
  id: string
  /** The existing page label, verbatim. */
  label: string
}

export interface SettingsCategory {
  id: string
  label: string
  items: SettingsNavItem[]
}

/**
 * Single source of truth for the settings menu: category → existing page
 * references. All 26 pages, none dropped, merged or renamed — `id` values
 * match the `{tab === '…' && …}` blocks in Settings.tsx exactly.
 */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      { id: 'company', label: 'Company' },
      { id: 'prefixes', label: 'Prefixes' },
      { id: 'invoicescheme', label: 'Invoice scheme' },
      { id: 'taxdiscount', label: 'Tax & Discount' },
      { id: 'costcenters', label: 'Cost Center' },
      { id: 'customfields', label: 'Custom fields' },
      { id: 'payments', label: 'Payments' },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance & Branding',
    items: [
      { id: 'logo', label: 'Logo' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'brand', label: 'Branding' },
      { id: 'printheader', label: 'Print header' },
      { id: 'sidebar', label: 'Sidebar Menu' },
    ],
  },
  {
    id: 'security',
    label: 'Security & Access',
    items: [
      { id: 'captcha', label: 'Captcha' },
      { id: 'filetypes', label: 'File types' },
      { id: 'credentials', label: 'Credentials' },
      { id: 'perms', label: 'Permissions' },
      { id: 'security', label: 'Security' },
      { id: 'backup', label: 'Backup' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { id: 'email', label: 'Email' },
      { id: 'alerts', label: 'Alerts' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'cron', label: 'Cron job' },
      { id: 'maintenance', label: 'Maintenance' },
      { id: 'sysupdate', label: 'System update' },
      { id: 'data', label: 'Data' },
      { id: 'modules', label: 'Modules' },
      { id: 'int', label: 'Integrations' },
    ],
  },
]

/** All 26 existing pages, flattened (category order). */
export const ALL_SETTINGS_ITEMS: SettingsNavItem[] = SETTINGS_CATEGORIES.flatMap((c) => c.items)

const categoryOf = (tabId: string): SettingsCategory =>
  SETTINGS_CATEGORIES.find((c) => c.items.some((i) => i.id === tabId)) || SETTINGS_CATEGORIES[0]

/**
 * Pages whose own content starts flush with the top of the content column.
 * Every other one of the 26 existing pages begins with `mt-4` (16px); the
 * shell cancels that offset (desktop only) so each page's first card lines up
 * exactly with the settings-menu card, on every page, at every scroll
 * position. The pages themselves are never touched.
 */
const NO_TOP_OFFSET_TABS = new Set(['costcenters', 'sidebar', 'modules'])

export function SettingsNavShell({
  tab,
  onSelect,
  children,
}: {
  /** The active settings tab id (existing state from Settings.tsx). */
  tab: string
  /** Switch to an existing settings tab. */
  onSelect: (id: string) => void
  /** The 26 existing settings pages, rendered unchanged. */
  children: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeCategory = categoryOf(tab)

  const select = (id: string) => {
    onSelect(id)
    setDrawerOpen(false)
  }

  /** Category tabs: stay on the current page if it belongs to the category,
      otherwise land on the category's first item. */
  const pickCategory = (category: SettingsCategory) => {
    if (!category.items.some((i) => i.id === tab)) select(category.items[0].id)
  }

  // Search parity with the previous flat tab bar: filter the active category's
  // sub-menu; matches in other categories are listed (with their category) and
  // jump on click.
  const ql = query.trim().toLowerCase()
  const menuItems = useMemo(
    () => (ql ? activeCategory.items.filter((i) => i.label.toLowerCase().includes(ql)) : activeCategory.items),
    [activeCategory, ql],
  )
  const elsewhere = useMemo(() => {
    if (!ql) return []
    return SETTINGS_CATEGORIES
      .filter((c) => c.id !== activeCategory.id)
      .map((c) => ({ category: c, items: c.items.filter((i) => i.label.toLowerCase().includes(ql)) }))
      .filter((r) => r.items.length > 0)
  }, [ql, activeCategory])

  // Drawer: close on Escape, lock body scroll while open.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  /** The vertical item list — shared by the desktop left panel and the drawer. */
  const itemMenu = (
    <nav aria-label="Settings pages" className="space-y-0.5">
      {menuItems.length === 0 && (
        <p className="px-3 py-2 text-xs text-mist">No “{activeCategory.label}” settings match “{query.trim()}”.</p>
      )}
      {menuItems.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => select(i.id)}
          aria-current={tab === i.id ? 'page' : undefined}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition',
            tab === i.id
              ? 'bg-lime/10 font-semibold text-lime'
              : 'text-mist hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]',
          )}
        >
          {i.label}
          {tab === i.id && <span aria-hidden className="ml-2 size-1.5 rounded-full bg-lime" />}
        </button>
      ))}
      {elsewhere.map(({ category, items }) => (
        <div key={category.id}>
          <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-mist/70">{category.label}</p>
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => select(i.id)}
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
            >
              {i.label}
            </button>
          ))}
        </div>
      ))}
      {ql && !menuItems.length && !elsewhere.length && (
        <p className="px-3 py-2 text-xs text-mist">No settings match “{query.trim()}”.</p>
      )}
    </nav>
  )

  /** Category pill row — shared by the desktop top bar and the drawer. */
  const categoryTabs = (
    <nav aria-label="Settings categories" className="flex flex-wrap items-center gap-0.5">
      {SETTINGS_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => pickCategory(c)}
          aria-current={c.id === activeCategory.id ? 'page' : undefined}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            c.id === activeCategory.id ? 'bg-lime text-lime-ink' : 'text-mist hover:text-inherit',
          )}
        >
          {c.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="min-[769px]:grid min-[769px]:grid-cols-[230px_minmax(0,1fr)] min-[769px]:items-start min-[769px]:gap-4">
      {/* ── Top bar: category tabs (desktop) / drawer trigger (≤768px) ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2 min-[769px]:col-span-2 min-[769px]:mb-4">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 py-1.5 text-xs font-semibold text-mist transition hover:text-inherit dark:bg-ink-2 max-[768px]:inline-flex min-[769px]:hidden"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
        >
          <Menu className="size-4" aria-hidden /> Settings menu
        </button>
        <div className="segmented-shell hidden max-w-full items-center gap-0.5 rounded-xl border border-line bg-ink-2 p-1 dark:bg-ink-2 min-[769px]:inline-flex">
          {categoryTabs}
        </div>
      </div>

      {/* ── Left vertical sub-menu (desktop) ──
          Sits at the top edge of the content row; the content column is
          normalised (above) so every page's first card shares this exact
          top edge. No sticky — the two columns scroll together and can
          never drift apart. */}
      <aside className="hidden min-[769px]:block" aria-label={`${activeCategory.label} settings`}>
        <div className="card p-2">
          <div className="px-1 pb-2">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search settings…"
              className="w-full"
            />
          </div>
          {itemMenu}
        </div>
      </aside>

      {/* ── Content: the selected existing settings page, unchanged ──
          23 of the 26 pages wrap themselves in `mt-4`. Cancel that 16px
          (desktop only) so the page's first card starts at the same top
          edge as the settings-menu card. Pages that are already flush
          (NO_TOP_OFFSET_TABS) are left as-is. */}
      <div className={cn('min-w-0', !NO_TOP_OFFSET_TABS.has(tab) && 'min-[769px]:-mt-4')}>
        {children}
      </div>

      {/* ── Mobile (≤768px): single slide-in drawer — category tabs + sub-menu ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 max-[768px]:block min-[769px]:hidden" role="dialog" aria-modal="true" aria-label="Settings menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-ink p-4 text-zinc-100 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-base font-bold">Settings</p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-mist transition hover:bg-black/10 hover:text-inherit dark:hover:bg-white/10"
                aria-label="Close settings menu"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="segmented-shell flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-ink-2 p-1 dark:bg-ink-2">
              {categoryTabs}
            </div>
            <div className="mt-3">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Search settings…"
                className="w-full"
              />
            </div>
            <div className="mt-2">{itemMenu}</div>
          </div>
        </div>
      )}
    </div>
  )
}

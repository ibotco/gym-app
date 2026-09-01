import { useEffect, useMemo, useRef, useState } from 'react'
import { Undo2, Save, Building2, Info, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button, Field, Input, Select, Badge, Switch, Modal } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { BRANCH_OVERRIDABLE_KEYS, branchSettingsFor, DEFAULT_BRANCH_CURRENCIES, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { TIMEZONES } from '../../lib/timezones'
import { CURRENCIES } from '../../lib/currencies'
import { COUNTRIES, regionsFor } from '../../lib/geo'
import { DEFAULT_COMPANY_ID } from '../../lib/companies'
import { userCompanyId } from '../../lib/accessScope'
import { PrintHeaderForm } from '../../components/PrintHeaderForm'
import { effectivePrintHeader } from '../../lib/printHeader'
import type { BranchOverridableKey, BranchSettings, BranchCurrency, BranchTax, PrintHeaderSettings, CompanySettings } from '../../types'

type FieldDef = {
  key: BranchOverridableKey
  label: string
  kind: 'text' | 'select' | 'color' | 'weekends' | 'region'
  options?: { value: string; label: string }[]
  hint?: string
}

const DATE_FORMATS = ['dd-mm-yyyy', 'mm-dd-yyyy', 'yyyy-mm-dd', 'dd/mm/yyyy']
const TIME_FORMATS = ['12 hours', '24 hours']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const CODE_FORMATS = ['qr', 'barcode', 'both']
const LANGS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'tw', label: 'Twi' },
]
const DEFAULT_WEEKENDS = ['Saturday', 'Sunday']

const DEFAULT_SEEDS: Partial<Record<BranchOverridableKey, unknown>> = {
  dateFormat: 'dd-mm-yyyy',
  timeFormat: '12 hours',
  startDayOfWeek: 'Monday',
  cardCodeFormat: 'qr',
  country: 'Ghana',
  stateRegion: 'Greater Accra',
}

const GENERAL_FIELDS: FieldDef[] = [
  { key: 'address', label: 'Branch address', kind: 'text' },
  { key: 'country', label: 'Country', kind: 'select', options: COUNTRIES.map((c) => ({ value: c, label: c })), hint: 'Branches can operate in a different country from the company.' },
  { key: 'stateRegion', label: 'State/Region', kind: 'region' },
  { key: 'location', label: 'Location', kind: 'text', hint: 'City / town, e.g. Agona Bobikuma.' },
  { key: 'phone', label: 'Branch phone', kind: 'text' },
  { key: 'whatsapp', label: 'WhatsApp number', kind: 'text' },
  { key: 'cardCodeFormat', label: 'Member card code', kind: 'select', options: CODE_FORMATS.map((d) => ({ value: d, label: d })) },
  { key: 'sidebarColor', label: 'Sidebar colour', kind: 'color', hint: 'Leave empty to follow the company theme.' },
  { key: 'headerColor', label: 'Header colour', kind: 'color', hint: 'Leave empty to follow the company theme.' },
]

const LOCALIZATION_FIELDS: FieldDef[] = [
  { key: 'dateFormat', label: 'Date format', kind: 'select', options: DATE_FORMATS.map((d) => ({ value: d, label: d })) },
  { key: 'timeFormat', label: 'Time format', kind: 'select', options: TIME_FORMATS.map((d) => ({ value: d, label: d })) },
  { key: 'timezone', label: 'Timezone', kind: 'select', options: TIMEZONES.map((z) => ({ value: z, label: z })) },
  { key: 'startDayOfWeek', label: 'Start day of week', kind: 'select', options: DAYS.map((d) => ({ value: d, label: d })) },
  { key: 'weekends', label: 'Weekends', kind: 'weekends', options: DAYS.map((d) => ({ value: d, label: d })) },
  { key: 'defaultLanguage', label: 'Default language', kind: 'select', options: LANGS },
]

type CurrencyForm = { index: number | null; code: string; symbol: string; name: string; status: 'base' | 'alternate' }
type TaxForm = { index: number | null; name: string; rate: string; status: 'active' | 'inactive' }

export function BranchSettingsPanel() {
  const { branches, activeCompany, branchSettings, company, upsertBranchSettings, resetBranchSettings, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()

  const isBranchAdmin = user?.role === 'branch_admin'
  const companyId = user && (user.role === 'branch_admin' || user.role === 'company_admin' || user.role === 'head_office')
    ? userCompanyId(user, branches)
    : activeCompany?.id || DEFAULT_COMPANY_ID

  const companyBranches = useMemo(
    () => branches.filter((b) => (b.companyId || DEFAULT_COMPANY_ID) === companyId),
    [branches, companyId],
  )

  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<Partial<Pick<CompanySettings, BranchOverridableKey>>>({})
  const [currencies, setCurrencies] = useState<BranchCurrency[]>(DEFAULT_BRANCH_CURRENCIES)
  const [currencyModal, setCurrencyModal] = useState<CurrencyForm | null>(null)
  const [taxRates, setTaxRates] = useState<BranchTax[]>(DEFAULT_BRANCH_TAXES)
  const [taxModal, setTaxModal] = useState<TaxForm | null>(null)
  const [printHeader, setPrintHeader] = useState<PrintHeaderSettings>(() => effectivePrintHeader(company))
  const [printHeaderOverride, setPrintHeaderOverride] = useState(false)

  // Refs always mirror the latest state, so any deferred/async persist call
  // (e.g. the debounced print-header effect) reads fresh values instead of
  // stale closures, and cannot overwrite tax/currency toggles with old data.
  const currenciesRef = useRef<BranchCurrency[]>(currencies)
  const taxRatesRef = useRef<BranchTax[]>(taxRates)
  const printHeaderRef = useRef<PrintHeaderSettings>(printHeader)
  const printHeaderOverrideRef = useRef<boolean>(printHeaderOverride)
  useEffect(() => { currenciesRef.current = currencies }, [currencies])
  useEffect(() => { taxRatesRef.current = taxRates }, [taxRates])
  useEffect(() => { printHeaderRef.current = printHeader }, [printHeader])
  useEffect(() => { printHeaderOverrideRef.current = printHeaderOverride }, [printHeaderOverride])

  // Auto-persist helper for branch-level lists (taxes, currencies, print header).
  // Skips the initial load effect so we don't overwrite saved data with defaults.
  const readyRef = useRef(false)
  const persistBranchLists = (patch: Partial<BranchSettings> & { printHeaderOverride?: boolean }) => {
    if (!selectedId || !readyRef.current) return
    const nextCurrencies = patch.currencies ?? currenciesRef.current
    const nextTaxes = patch.taxRates ?? taxRatesRef.current
    const usePrintOverride = patch.printHeaderOverride !== undefined ? patch.printHeaderOverride : printHeaderOverrideRef.current
    const nextPrintHeader = patch.printHeader ?? printHeaderRef.current
    const record: BranchSettings = {
      branchId: selectedId,
      companyId,
      overrides: currentRef.current?.overrides ?? {},
      currencies: nextCurrencies,
      taxRates: nextTaxes,
      printHeader: usePrintOverride ? nextPrintHeader : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.id,
    }
    upsertBranchSettings(record)
  }

  // Lock branch admins to their own branch; default everyone else to the active branch.
  useEffect(() => {
    if (isBranchAdmin && user?.branchId) setSelectedId(user.branchId)
    else if (!selectedId && companyBranches.length) {
      setSelectedId((id) => id || companyBranches[0].id)
    }
  }, [isBranchAdmin, user?.branchId, companyBranches, selectedId])

  const current = useMemo(() => branchSettingsFor(branchSettings, selectedId), [branchSettings, selectedId])
  const currentRef = useRef(current)
  useEffect(() => { currentRef.current = current }, [current])

  // Load the selected branch's overrides, currencies and tax rates into the draft.
  useEffect(() => {
    readyRef.current = false
    setDraft(current?.overrides ?? {})
    setCurrencies(current?.currencies && current.currencies.length ? current.currencies : DEFAULT_BRANCH_CURRENCIES)
    setTaxRates(current?.taxRates && current.taxRates.length ? current.taxRates : DEFAULT_BRANCH_TAXES)
    setPrintHeader(current?.printHeader ? { ...effectivePrintHeader(company), ...current.printHeader } : effectivePrintHeader(company))
    setPrintHeaderOverride(!!current?.printHeader)
    // Allow auto-persist only after initial hydrate finishes for this branch.
    const t = setTimeout(() => { readyRef.current = true }, 0)
    return () => clearTimeout(t)
  }, [selectedId, current?.overrides, current?.currencies, current?.taxRates, current?.printHeader, company])

  const isOverridden = (key: BranchOverridableKey) => draft[key] !== undefined && draft[key] !== ''

  const toggle = (key: BranchOverridableKey, on: boolean) => {
    setDraft((d) => {
      const next = { ...d }
      if (on) {
        if (key === 'weekends') next[key] = (company.weekends?.length ? company.weekends : DEFAULT_WEEKENDS) as never
        else if (key === 'defaultLanguage') next[key] = (company.defaultLanguage || 'en') as never
        else {
          const cv = company[key] as unknown
          next[key] = ((cv !== undefined && cv !== '' ? cv : DEFAULT_SEEDS[key]) as never)
        }
      } else {
        delete next[key]
      }
      return next
    })
  }

  const toggleWeekendDay = (day: string) => {
    setDraft((d) => {
      const cur = (d.weekends as string[] | undefined) || []
      const next = cur.includes(day) ? cur.filter((x) => x !== day) : [...cur, day]
      return { ...d, weekends: next as never }
    })
  }

  const save = () => {
    if (!selectedId) return
    const overrides: Partial<Pick<CompanySettings, BranchOverridableKey>> = {}
    for (const k of BRANCH_OVERRIDABLE_KEYS) {
      const v = draft[k]
      if (v !== undefined && v !== '') overrides[k] = v as never
    }
    const record: BranchSettings = {
      branchId: selectedId,
      companyId,
      overrides,
      currencies,
      taxRates,
      printHeader: printHeaderOverride ? printHeader : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.id,
    }
    upsertBranchSettings(record)
    log(user?.id || 'system', 'UPDATE', 'BranchSettings', `Updated settings for ${companyBranches.find((b) => b.id === selectedId)?.name || selectedId}`)
    toast.success('Branch settings saved')
  }

  const resetAll = () => {
    if (!selectedId) return
    readyRef.current = false
    resetBranchSettings(selectedId)
    setDraft({})
    setCurrencies(DEFAULT_BRANCH_CURRENCIES)
    setTaxRates(DEFAULT_BRANCH_TAXES)
    setPrintHeader(effectivePrintHeader(company))
    setPrintHeaderOverride(false)
    log(user?.id || 'system', 'UPDATE', 'BranchSettings', `Reset settings for ${companyBranches.find((b) => b.id === selectedId)?.name || selectedId}`)
    toast.success('Branch reverted to company defaults')
    setTimeout(() => { readyRef.current = true }, 0)
  }

  // Auto-persist print header overrides as soon as the user flips the switch
  // or edits the print header form (debounced). Uses refs so a pending save
  // can never clobber a just-toggled tax/currency with stale list data.
  const printSaveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (printSaveTimer.current) { clearTimeout(printSaveTimer.current); printSaveTimer.current = null }
    if (!readyRef.current || !selectedId) return
    if (!printHeaderOverride) {
      persistBranchLists({ printHeaderOverride: false })
      return
    }
    printSaveTimer.current = window.setTimeout(() => {
      printSaveTimer.current = null
      persistBranchLists({ printHeader: printHeaderRef.current, printHeaderOverride: true })
    }, 250)
    return () => { if (printSaveTimer.current) { clearTimeout(printSaveTimer.current); printSaveTimer.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printHeader, printHeaderOverride, selectedId])

  const overriddenCount = BRANCH_OVERRIDABLE_KEYS.filter((k) => isOverridden(k)).length

  // ---- Currency list helpers ----
  const openNewCurrency = () => {
    // New currencies default to "alternate" (only one base is allowed).
    const base = currencies.find((c) => c.status === 'base')
    setCurrencyModal({ index: null, code: '', symbol: '', name: '', status: base ? 'alternate' : 'base' })
  }
  const openEditCurrency = (i: number) => {
    const c = currencies[i]
    setCurrencyModal({ index: i, code: c.code, symbol: c.symbol, name: c.name || '', status: c.status })
  }
  const saveCurrency = () => {
    if (!currencyModal) return
    if (!currencyModal.code.trim()) { toast.error('Select a currency.'); return }
    if (!currencyModal.symbol.trim()) { toast.error('Enter a currency symbol.'); return }
    const entry: BranchCurrency = {
      code: currencyModal.code.trim().toUpperCase(),
      symbol: currencyModal.symbol.trim(),
      name: currencyModal.name.trim() || undefined,
      status: currencyModal.status,
    }
    setCurrencies((list): BranchCurrency[] => {
      const idx = currencyModal.index
      const next = idx === null
        ? (entry.status === 'base' ? [...list.map((c): BranchCurrency => (c.status === 'base' ? { ...c, status: 'alternate' } : c)), entry] : [...list, entry])
        : list.map((c, i): BranchCurrency => {
            if (i === idx) return entry
            if (entry.status === 'base' && c.status === 'base') return { ...c, status: 'alternate' }
            return c
          })
      // Persist inside the updater so refs + localStorage always see the final array.
      currenciesRef.current = next
      persistBranchLists({ currencies: next })
      return next
    })
    setCurrencyModal(null)
  }
  const removeCurrency = (i: number) => {
    setCurrencies((list) => {
      let next = list.filter((_, idx) => idx !== i)
      if (list[i]?.status === 'base' && next.length && !next.some((c) => c.status === 'base')) {
        next = next.map((c, idx) => (idx === 0 ? { ...c, status: 'base' } : c))
      }
      currenciesRef.current = next
      persistBranchLists({ currencies: next })
      return next
    })
  }
  const setBaseCurrency = (i: number) => {
    setCurrencies((list) => {
      const next: BranchCurrency[] = list.map((c, idx) => ({ ...c, status: idx === i ? 'base' : 'alternate' }))
      currenciesRef.current = next
      persistBranchLists({ currencies: next })
      return next
    })
  }

  // ---- Tax rate helpers ----
  const openNewTax = () => setTaxModal({ index: null, name: '', rate: '', status: 'active' })
  const openEditTax = (i: number) => {
    const t = taxRates[i]
    setTaxModal({ index: i, name: t.name, rate: String(t.rate), status: t.status })
  }
  const saveTax = () => {
    if (!taxModal) return
    if (!taxModal.name.trim()) { toast.error('Enter a tax name.'); return }
    const rate = Number(taxModal.rate)
    if (Number.isNaN(rate) || rate < 0) { toast.error('Enter a valid rate (%).'); return }
    const entry: BranchTax = { name: taxModal.name.trim(), rate, status: taxModal.status }
    setTaxRates((list) => {
      const next = taxModal.index === null
        ? [...list, entry]
        : list.map((t, i) => (i === taxModal.index ? entry : t))
      taxRatesRef.current = next
      persistBranchLists({ taxRates: next })
      return next
    })
    setTaxModal(null)
  }
  const removeTax = (i: number) => {
    setTaxRates((list) => {
      const next = list.filter((_, idx) => idx !== i)
      taxRatesRef.current = next
      persistBranchLists({ taxRates: next })
      return next
    })
  }
  const toggleTaxStatus = (i: number) => {
    setTaxRates((list) => {
      const next: BranchTax[] = list.map((t, idx) => (idx === i ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t))
      taxRatesRef.current = next
      persistBranchLists({ taxRates: next })
      return next
    })
  }

  if (!companyBranches.length) {
    return (
      <div className="card mt-4 max-w-2xl p-6 text-sm text-mist">
        No branches exist for this company yet. Create a branch before configuring branch settings.
      </div>
    )
  }

  const renderFieldRow = (f: FieldDef) => {
    const on = isOverridden(f.key)
    // Company (inherited) value shown as plain text while the input is hidden.
    const inherited = f.key === 'weekends'
      ? (company.weekends && company.weekends.length ? company.weekends : DEFAULT_WEEKENDS)
      : company[f.key]
    const inheritedLabel = f.key === 'weekends'
      ? (inherited as string[]).join(', ')
      : f.key === 'defaultLanguage'
        ? (LANGS.find((l) => l.value === inherited)?.label || String(inherited || 'Default'))
        : f.key === 'sidebarColor' || f.key === 'headerColor'
          ? (inherited || 'Default')
          : String(inherited ?? 'Default')
    return (
      <div key={f.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{f.label}</p>
          {on ? (
            <div className="mt-2 max-w-sm">
              {f.kind === 'select' && (
                <Select
                  value={String(draft[f.key] ?? '')}
                  onChange={(e) => {
                    // Changing the country invalidates a previously chosen region.
                    if (f.key === 'country') setDraft({ ...draft, country: e.target.value as never, ...(draft.stateRegion !== undefined ? { stateRegion: '' as never } : {}) })
                    else setDraft({ ...draft, [f.key]: e.target.value as never })
                  }}
                >
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
              {f.kind === 'region' && (() => {
                const effectiveCountry = (draft.country as string | undefined) || company.country || 'Ghana'
                const regions = regionsFor(effectiveCountry)
                return regions ? (
                  <Select value={String(draft[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as never })}>
                    <option value="" disabled>Select region…</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                ) : (
                  <Input value={String(draft[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as never })} placeholder="State / province / region" />
                )
              })()}
              {f.kind === 'text' && (
                <Input value={String(draft[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as never })} />
              )}
              {f.kind === 'color' && (
                <div className="flex items-center gap-2">
                  <input type="color" value={String(draft[f.key] ?? '#C8F542')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as never })} className="h-10 w-14 cursor-pointer rounded border border-line bg-transparent p-1" />
                  <Input value={String(draft[f.key] ?? '')} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value as never })} placeholder="#C8F542" />
                </div>
              )}
              {f.kind === 'weekends' && (
                <div className="flex flex-wrap gap-2">
                  {(f.options || []).map((d) => {
                    const active = ((draft[f.key] as string[] | undefined) || []).includes(d.value)
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleWeekendDay(d.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-lime bg-lime/10 text-lime' : 'border-line text-mist hover:text-zinc-900 dark:hover:text-white'}`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              )}
              {f.hint && <p className="mt-1 text-xs text-mist">{f.hint}</p>}
            </div>
          ) : (
            <p className="mt-1 text-sm text-mist">
              Inherited from company: <span className="font-medium">{inheritedLabel}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-mist">{on ? 'On' : 'Off'}</span>
          <Switch checked={on} onChange={(v) => toggle(f.key, v)} aria-label={`Toggle ${f.label}`} />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <div className="card flex items-start gap-3 p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-sky-500" />
        <p className="text-sm text-mist">
          <span className="font-semibold text-inherit">Company settings</span> are inherited by every branch by default.
          Below you can override only the permitted per-branch configurations. Everything else stays locked at company level.
        </p>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Branch</p>
            <p className="text-xs text-mist">Select the branch whose settings you want to customise.</p>
          </div>
          {isBranchAdmin ? (
            <Badge tone="violet">{companyBranches.find((b) => b.id === user?.branchId)?.name || 'Your branch'}</Badge>
          ) : (
            <div className="w-64">
              <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {companyBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.city}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <Building2 className="size-4 text-mist" />
          <span>
            {overriddenCount === 0
              ? 'Inheriting all company settings'
              : `${overriddenCount} of ${BRANCH_OVERRIDABLE_KEYS.length} settings overridden for this branch`}
          </span>
        </div>
      </div>

      {/* General overrides */}
      <div className="card p-5">
        <p className="font-semibold">General settings</p>
        <p className="mb-2 text-xs text-mist">Contact and appearance overrides for this branch.</p>
        <div className="divide-y divide-line">{GENERAL_FIELDS.map(renderFieldRow)}</div>
      </div>

      {/* Localization */}
      <div className="card p-5">
        <p className="font-semibold">Localization settings</p>
        <p className="mb-2 text-xs text-mist">Date, time, timezone, week and language preferences for this branch.</p>
        <div className="divide-y divide-line">{LOCALIZATION_FIELDS.map(renderFieldRow)}</div>
      </div>

      {/* Currency settings */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Currency settings</p>
            <p className="text-xs text-mist">Currencies enabled for this branch.</p>
          </div>
          <Button onClick={openNewCurrency}><Plus className="size-4" /> New currency</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-mist">
                <th className="py-2 pr-3">Symbol</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c, i) => (
                <tr key={c.code} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-lg bg-black/5 font-semibold dark:bg-white/5">{c.symbol}</span>
                      <div>
                        <p className="font-semibold">{c.code}</p>
                        <p className="text-xs text-mist">{c.name || c.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    {c.status === 'base' ? (
                      <Badge tone="lime">Base currency</Badge>
                    ) : (
                      <Badge tone="zinc">Alternate currency</Badge>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.status !== 'base' && (
                        <button className="rounded-lg px-2 py-1 text-xs font-semibold text-lime hover:bg-lime/10" title="Set as base currency" onClick={() => setBaseCurrency(i)}>
                          Set base
                        </button>
                      )}
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEditCurrency(i)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => removeCurrency(i)}><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!currencies.length && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-sm text-mist">No currencies configured. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax rate settings */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Tax rates</p>
            <p className="text-xs text-mist">Tax rates applied by this branch.</p>
          </div>
          <Button onClick={openNewTax}><Plus className="size-4" /> New tax</Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-mist">
                <th className="w-12 py-2 pr-3">No.</th>
                <th className="py-2 pr-3">Tax name</th>
                <th className="py-2 pr-3">Rate (%)</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {taxRates.map((t, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 text-mist">{i + 1}</td>
                  <td className="py-2.5 pr-3 font-semibold">{t.name}</td>
                  <td className="py-2.5 pr-3 font-mono">{t.rate.toFixed(2)}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={t.status === 'active' ? 'lime' : 'zinc'}>{t.status}</Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Switch checked={t.status === 'active'} onChange={() => toggleTaxStatus(i)} aria-label={`Toggle ${t.name}`} />
                      <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEditTax(i)}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => removeTax(i)}><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!taxRates.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-mist">No tax rates configured. Add one to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">Print header</p>
            <p className="text-xs text-mist">Custom print header/footer for this branch's documents.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-mist">{printHeaderOverride ? 'On' : 'Off'}</span>
            <Switch
              checked={printHeaderOverride}
              onChange={(v) => { setPrintHeaderOverride(v); if (v) setPrintHeader(effectivePrintHeader(company)) }}
              aria-label="Override print header"
            />
          </div>
        </div>
        {printHeaderOverride ? (
          <div className="mt-4"><PrintHeaderForm value={printHeader} onChange={setPrintHeader} company={company} /></div>
        ) : (
          <p className="mt-3 text-sm text-mist">Inheriting the company print header — toggle on to customise for this branch.</p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {overriddenCount > 0 && (
          <Button variant="outline" onClick={resetAll}><Undo2 className="size-4" /> Reset branch to company defaults</Button>
        )}
        <Button onClick={save}><Save className="size-4" /> Save branch settings</Button>
      </div>

      {/* Add / edit currency */}
      <Modal open={!!currencyModal} onClose={() => setCurrencyModal(null)} title={currencyModal?.index === null ? 'Add currency' : 'Edit currency'}>
        {currencyModal && (
          <>
            <div className="grid gap-3">
              <Field label="Currency">
                <Select
                  value={currencyModal.code}
                  onChange={(e) => {
                    const cur = CURRENCIES.find((c) => c.code === e.target.value)
                    setCurrencyModal({ ...currencyModal, code: e.target.value, name: cur?.name || '', symbol: cur?.symbol || currencyModal.symbol })
                  }}
                >
                  <option value="">Select a currency…</option>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </Select>
              </Field>
              <Field label="Symbol"><Input value={currencyModal.symbol} onChange={(e) => setCurrencyModal({ ...currencyModal, symbol: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={currencyModal.status} onChange={(e) => setCurrencyModal({ ...currencyModal, status: e.target.value as 'base' | 'alternate' })}>
                  <option value="base">Base currency</option>
                  <option value="alternate">Alternate currency</option>
                </Select>
              </Field>
              <p className="text-xs text-mist">Only one currency can be the base; all others are alternates.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCurrencyModal(null)}>Cancel</Button>
              <Button onClick={saveCurrency}>{currencyModal.index === null ? 'Add currency' : 'Save changes'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Add / edit tax rate */}
      <Modal open={!!taxModal} onClose={() => setTaxModal(null)} title={taxModal?.index === null ? 'Add tax rate' : 'Edit tax rate'}>
        {taxModal && (
          <>
            <div className="grid gap-3">
              <Field label="Tax name"><Input value={taxModal.name} onChange={(e) => setTaxModal({ ...taxModal, name: e.target.value })} placeholder="e.g. VAT" /></Field>
              <Field label="Rate (%)"><Input type="number" step="0.01" min="0" value={taxModal.rate} onChange={(e) => setTaxModal({ ...taxModal, rate: e.target.value })} placeholder="17.50" /></Field>
              <Field label="Status">
                <Select value={taxModal.status} onChange={(e) => setTaxModal({ ...taxModal, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTaxModal(null)}>Cancel</Button>
              <Button onClick={saveTax}>{taxModal.index === null ? 'Add tax rate' : 'Save changes'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { Upload, X, Building2, Image as ImageIcon } from 'lucide-react'
import { Button, Field, Input, Select } from './ui'
import { RichTextEditor } from './RichTextEditor'
import type { PrintHeaderSettings, PrintHeaderType, CompanySettings } from '../types'

const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'svg']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * Shared print-header form + live preview (used by company and branch settings).
 * Controlled: `value` / `onChange`.
 */
export function PrintHeaderForm({
  value,
  onChange,
  company,
  readOnlyText = false,
}: {
  value: PrintHeaderSettings
  onChange: (v: PrintHeaderSettings) => void
  company: CompanySettings
  /** When true, company info fields are read-only and synced from the company profile. */
  readOnlyText?: boolean
}) {
  const [err, setErr] = useState('')
  const set = (patch: Partial<PrintHeaderSettings>) => onChange({ ...value, ...patch })

  const restoreFromCompany = () => {
    set({
      companyName: company.name,
      companyAddress: company.address,
      companyPhone: company.phone,
      companyEmail: company.email,
      companyWebsite: company.webAddress || '',
      taxId: company.taxId || '',
    })
  }

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) { setErr('Accepted formats: JPG, JPEG, PNG, SVG.'); return }
    if (file.size > MAX_IMAGE_BYTES) { setErr('Image must be 5 MB or smaller.'); return }
    const reader = new FileReader()
    reader.onload = () => { setErr(''); set({ headerImage: String(reader.result) }) }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="space-y-4">
        <Field label="Header type" required>
          <Select value={value.headerType} onChange={(e) => set({ headerType: e.target.value as PrintHeaderType })}>
            <option value="image">Image Header</option>
            <option value="text">Text Header</option>
          </Select>
        </Field>

        {value.headerType === 'image' && (
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Header image</p>
              <span className="text-[11px] text-mist">2230px × 300px · JPG/PNG/SVG · ≤ 5 MB</span>
            </div>
            {value.headerImage ? (
              <div className="mt-3">
                <div className="overflow-hidden rounded-lg border border-line bg-white">
                  <img src={value.headerImage} alt="Header preview" className="max-h-40 w-full object-contain" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">
                    <Upload className="size-4" /> Replace
                    <input type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden" onChange={onImageUpload} />
                  </label>
                  <Button variant="outline" onClick={() => set({ headerImage: undefined })}><X className="size-4" /> Remove</Button>
                </div>
              </div>
            ) : (
              <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-10 text-center text-mist hover:border-lime/50 hover:text-zinc-900 dark:hover:text-white">
                <ImageIcon className="size-6" />
                <span className="text-sm font-semibold">Click to upload header image</span>
                <span className="text-xs">JPG, JPEG, PNG or SVG · up to 5 MB</span>
                <input type="file" accept=".jpg,.jpeg,.png,.svg" className="hidden" onChange={onImageUpload} />
              </label>
            )}
          </div>
        )}

        {value.headerType === 'text' && (
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Header content</p>
              {!readOnlyText && (
                <Button variant="outline" size="sm" onClick={restoreFromCompany}><Building2 className="size-3.5" /> Restore from company profile</Button>
              )}
            </div>
            {readOnlyText && <p className="mt-1 text-xs text-mist">Synced from Company settings — edit these values under the Company tab.</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Company name"><Input value={value.companyName} disabled={readOnlyText} onChange={(e) => set({ companyName: e.target.value })} /></Field>
              <Field label="Address"><Input value={value.companyAddress} disabled={readOnlyText} onChange={(e) => set({ companyAddress: e.target.value })} /></Field>
              <Field label="Phone number"><Input value={value.companyPhone} disabled={readOnlyText} onChange={(e) => set({ companyPhone: e.target.value })} /></Field>
              <Field label="Email address"><Input value={value.companyEmail} disabled={readOnlyText} onChange={(e) => set({ companyEmail: e.target.value })} /></Field>
              <Field label="Website"><Input value={value.companyWebsite} disabled={readOnlyText} onChange={(e) => set({ companyWebsite: e.target.value })} /></Field>
              <Field label="Tax Identification Number (optional)"><Input value={value.taxId || ''} disabled={readOnlyText} onChange={(e) => set({ taxId: e.target.value })} /></Field>
            </div>
          </div>
        )}

        <Field label="Footer content">
          <RichTextEditor value={value.footerContent} onChange={(html) => set({ footerContent: html })} placeholder="e.g. This document is computer generated and does not require a signature." />
        </Field>

        {err && <p className="text-sm text-ember">{err}</p>}
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-mist">Print preview</p>
        <div className="overflow-hidden rounded-lg border border-line bg-white text-zinc-900 shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-5 text-center">
            {value.headerType === 'image' ? (
              value.headerImage ? (
                <img src={value.headerImage} alt="" className="mx-auto max-h-20 w-auto object-contain" />
              ) : (
                <p className="text-sm text-zinc-400">No header image uploaded</p>
              )
            ) : (
              <div className="space-y-0.5">
                <p className="font-display text-lg font-bold uppercase tracking-tight">{value.companyName || 'Company name'}</p>
                {value.companyAddress && <p className="text-xs text-zinc-600">{value.companyAddress}</p>}
                {(value.companyPhone || value.companyEmail || value.companyWebsite) && (
                  <p className="text-xs text-zinc-600">
                    {[value.companyPhone ? `Phone: ${value.companyPhone}` : '', value.companyEmail ? `Email: ${value.companyEmail}` : '', value.companyWebsite ? `Web: ${value.companyWebsite}` : ''].filter(Boolean).join('  ·  ')}
                  </p>
                )}
                {value.taxId && <p className="text-[11px] text-zinc-500">TIN: {value.taxId}</p>}
              </div>
            )}
          </div>
          <div className="space-y-2 px-6 py-8">
            <div className="mx-auto h-3 w-2/3 rounded bg-zinc-100" />
            <div className="mx-auto h-3 w-1/2 rounded bg-zinc-100" />
            <div className="mx-auto h-3 w-3/5 rounded bg-zinc-100" />
            <div className="mx-auto h-3 w-2/5 rounded bg-zinc-100" />
          </div>
          <div
            className="border-t border-zinc-200 px-6 py-4 text-center text-xs text-zinc-600 [&_a]:text-blue-600 [&_ul]:list-disc [&_ol]:list-decimal"
            dangerouslySetInnerHTML={{ __html: value.footerContent }}
          />
        </div>
      </div>
    </div>
  )
}

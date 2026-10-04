import { useMemo, useState } from 'react'
import { FileText, Printer } from 'lucide-react'
import { PageHeader, Button, Field, Select, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { userCompanyId } from '../../../lib/accessScope'
import { loadAccountNotes } from '../../../lib/accounting'
import { loadAccountingPolicies, policiesForYear, POLICY_NOTE_NUMBER } from '../../../lib/accountingPolicies'
import { formatGhsExact } from '../../../lib/utils'
import type { Account, AccountNote } from '../../../types'

/**
 * Financial Statement Package — assembles the notes document at report time.
 *
 *   NOTE 1  — ACCOUNTING POLICIES   (from the separate policy register)
 *   NOTE n  — <existing note title>  (from the untouched Notes to Accounts)
 *
 * Both sources are read only: no account, code, parent/child link, note or
 * posting is modified by generating the package.
 */
export function StatementPackagePage() {
  const app = useApp()
  const { accounts, receipts, paymentVouchers, journals } = app
  const { user } = useAuth()

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(String(thisYear))
  const [showFigures, setShowFigures] = useState(true)
  /**
   * Display-only numbering. The stored Notes to Accounts keep their own
   * numbers; this offset simply prints them further down the document so they
   * never collide with the policy note (the IFRS habit of 1, then 11, 12 …).
   */
  const [withCover, setWithCover] = useState(true)
  const [withContents, setWithContents] = useState(true)
  const [policyNoteNo, setPolicyNoteNo] = useState(String(POLICY_NOTE_NUMBER))
  const [noteOffset, setNoteOffset] = useState('10')
  const shownNoteNo = (no: string) => {
    const off = Number(noteOffset) || 0
    const n = Number(no)
    return Number.isFinite(n) && off ? String(n + off) : no
  }

  const policies = useMemo(
    () => policiesForYear(loadAccountingPolicies(), Number(year) || thisYear),
    [year, thisYear],
  )

  /** Closing balance of one account for the chosen year (opening + movement). */
  const balances = useMemo(() => {
    const upto = `${year}-12-31`
    const map = new Map<string, number>()
    const add = (id: string, delta: number) => map.set(id, (map.get(id) ?? 0) + delta)
    for (const r of receipts) {
      if (r.date > upto) continue
      add(r.depositAccountId, r.amount)
      for (const l of r.lines || []) add(l.accountId, -l.amount)
    }
    for (const p of paymentVouchers) {
      if (p.date > upto) continue
      add(p.paymentAccountId, -p.amount)
      for (const l of p.lines || []) add(l.accountId, l.amount)
    }
    for (const j of journals) {
      if (j.date > upto) continue
      for (const l of j.lines) add(l.accountId, (l.debit || 0) - (l.credit || 0))
    }
    const out = new Map<string, number>()
    for (const a of accounts) {
      const net = map.get(a.id) ?? 0
      const signed = a.type === 'liability' || a.type === 'equity' || a.type === 'income' ? -net : net
      out.set(a.id, (a.primaryBalance ?? 0) + signed)
    }
    return out
  }, [accounts, receipts, paymentVouchers, journals, year])

  /** Section 2 — the existing register, read in note order. */
  const notes = useMemo(() => {
    const register = loadAccountNotes()
      .filter((n) => n.status !== 'inactive')
      .slice()
      .sort((a, b) => String(a.noteNo).localeCompare(String(b.noteNo), undefined, { numeric: true }))
    const nameOf = (id?: string) => accounts.find((a) => a.id === id)?.name
    return register.map((n: AccountNote) => {
      const head = accounts.find((a) => a.id === n.accountId)
      const covered = (n.accountIds || [])
        .map((id) => accounts.find((a) => a.id === id))
        .filter(Boolean) as Account[]
      const lines = covered.map((a) => ({ name: a.name, code: a.code || '', amount: balances.get(a.id) ?? 0 }))
      const total = head ? balances.get(head.id) ?? 0 : lines.reduce((s, l) => s + l.amount, 0)
      return {
        no: String(n.noteNo),
        title: (nameOf(n.accountId) || n.name).toUpperCase(),
        titleRaw: nameOf(n.accountId) || n.name,
        description: n.description || '',
        lines,
        total: lines.length ? lines.reduce((s, l) => s + l.amount, 0) + (head ? balances.get(head.id) ?? 0 : 0) : total,
      }
    })
  }, [accounts, balances])

  const company = app.companies.find((c) => c.id === userCompanyId(user, app.branches)) ?? app.companies[0]

  const years = useMemo(() => {
    const fromPolicies = loadAccountingPolicies().map((p) => p.effectiveYear)
    return Array.from(new Set([...fromPolicies, thisYear, thisYear - 1])).sort((a, b) => b - a)
  }, [thisYear])

  /** Rows handed to Excel/CSV — the same document, flattened. */
  const exportRows = useMemo(() => {
    const rows: Record<string, string | number>[] = []
    rows.push({ Section: `NOTE ${policyNoteNo} — ACCOUNTING POLICIES`, Detail: '', Amount: '' })
    for (const p of policies) rows.push({ Section: `${p.code} ${p.title}`, Detail: p.text, Amount: '' })
    for (const n of notes) {
      rows.push({ Section: `NOTE ${shownNoteNo(n.no)} — ${n.title}`, Detail: n.description, Amount: showFigures ? n.total : '' })
      for (const l of n.lines) rows.push({ Section: '', Detail: `${l.code ? `${l.code} ` : ''}${l.name}`, Amount: showFigures ? l.amount : '' })
    }
    return rows
  }, [policies, notes, showFigures, policyNoteNo, noteOffset])

  const printPackage = () => {
    const esc = (t: string) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    const money = (n: number) => (n < 0 ? `(${formatGhsExact(Math.abs(n)).replace('GH₵', '')})` : formatGhsExact(n).replace('GH₵', ''))
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>NOTES TO THE FINANCIAL STATEMENTS</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; background: #d5d5d5; padding: 20px 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 20px; background: #fff; padding: 15mm; box-shadow: 0 2px 12px rgba(0,0,0,0.25); }
  h1, h2, h3 { text-align: center; margin: 0; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 2px; } h3 { font-size: 15px; margin-top: 6px; }
  h4 { margin: 20px 0 6px; font-size: 14px; border-bottom: 1px solid #333; padding-bottom: 3px; }
  h5 { margin: 12px 0 2px; font-size: 13px; }
  p.narrative { margin: 0 0 8px; text-align: justify; line-height: 1.5; }
  table.note { width: 100%; border-collapse: collapse; margin: 4px 0 6px; }
  table.note td { padding: 3px 0; }
  table.note td.num { text-align: right; white-space: nowrap; width: 130px; }
  table.note tr.total td { border-top: 1px solid #333; border-bottom: 2px double #333; font-weight: bold; }
  .cur { text-align: right; font-weight: bold; margin: 10px 0 2px; }
  .sheet.cover { display: grid; place-items: center; }
  .cover-box { text-align: center; }
  .cover-rule { width: 120px; height: 3px; background: #111; margin: 18px auto; }
  .cover-foot { margin-top: 26px; font-size: 12px; color: #444; }
  table.toc { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.toc td { padding: 5px 0; border-bottom: 1px dotted #999; }
  table.toc td:first-child { width: 90px; font-weight: bold; }
  @media print { .sheet { page-break-after: always; } .sheet:last-of-type { page-break-after: auto; } }
  .actions { text-align: center; margin: 8px 0 24px; }
  .btn { display: inline-block; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; color: #fff; }
  .btn-print { background: #111; } .btn-back { background: #e2542c; }
  @page { size: A4; margin: 15mm; }
  @media print { body { background: #fff; padding: 0; } .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } .actions { display: none; } h4, h5 { page-break-after: avoid; } tr { page-break-inside: avoid; } }
</style></head>
<body>
  ${withCover ? `<div class="sheet cover">
    <div class="cover-box">
      <h1>${esc((company?.name || 'Company').toUpperCase())}</h1>
      ${company?.location ? `<h2>${esc(company.location)}</h2>` : ''}
      <div class="cover-rule"></div>
      <h2>FINANCIAL STATEMENTS</h2>
      <h3>FOR THE YEAR ENDED 31 DECEMBER ${esc(year)}</h3>
      <p class="cover-foot">Prepared ${esc(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }))}</p>
    </div>
  </div>` : ''}
  ${withContents ? `<div class="sheet">
    <h3>CONTENTS</h3>
    <table class="toc">
      <tbody>
        <tr><td>Note ${esc(policyNoteNo)}</td><td>Accounting policies</td></tr>
        ${notes.map((n) => `<tr><td>Note ${esc(shownNoteNo(n.no))}</td><td>${esc(n.titleRaw)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}
  <div class="sheet">
    <h1>${esc((company?.name || 'Company').toUpperCase())}</h1>
    ${company?.location ? `<h2>${esc(company.location)}</h2>` : ''}
    <h3>NOTES TO THE FINANCIAL STATEMENTS</h3>
    <h3>FOR THE YEAR ENDED 31 DECEMBER ${esc(year)}</h3>
    ${showFigures ? '<div class="cur">Amount in Ghana Cedi(s)</div>' : ''}

    <h4>NOTE ${esc(policyNoteNo)} — ACCOUNTING POLICIES</h4>
    ${policies.map((p) => `<h5>${esc(p.code)} ${esc(p.title)}</h5><p class="narrative">${esc(p.text)}</p>`).join('')
      || '<p class="narrative">No active accounting policies for this year.</p>'}

    ${notes.map((n) => `
      <h4>NOTE ${esc(shownNoteNo(n.no))} — ${esc(n.title)}</h4>
      ${n.description ? `<p class="narrative">${esc(n.description)}</p>` : ''}
      ${n.lines.length ? `<table class="note">
        ${n.lines.map((l) => `<tr><td>${esc(l.code ? `${l.code} ` : '')}${esc(l.name)}</td><td class="num">${showFigures ? money(l.amount) : ''}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="num">${showFigures ? money(n.total) : ''}</td></tr>
      </table>` : ''}
    `).join('')}
  </div>
  <div class="actions">
    <button class="btn btn-print" onclick="window.print()">&#128424; Click Here to Print</button>
    <button class="btn btn-back" onclick="window.close()">&#8592; Go Back</button>
  </div>
  <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 400); });</script>
</body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.open(); win.document.write(html); win.document.close() }
  }

  return (
    <div>
      <PageHeader
        title="Financial Statement Package"
        desc="The notes document assembled at report time: NOTE 1 Accounting Policies followed by the existing Notes to Accounts. Reading only — numbering here is for the printed document; the stored notes keep their own numbers."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons filename={`notes-to-the-financial-statements-${year}`} rows={exportRows} compact onPdf={printPackage} />
            <Button onClick={printPackage}><Printer className="size-4" /> Print package</Button>
          </div>
        }
      />

      <div className="card p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-40"><Field label="Financial year">
            <Select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </Select>
          </Field></div>
          <div className="w-36"><Field label="Policy note no.">
            <Select value={policyNoteNo} onChange={(e) => setPolicyNoteNo(e.target.value)}>
              {['1', '2', '3'].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field></div>
          <div className="w-44"><Field label="Account notes start at">
            <Select value={noteOffset} onChange={(e) => setNoteOffset(e.target.value)}>
              <option value="0">Their own numbers</option>
              <option value="1">2, 3, 4 … (+1)</option>
              <option value="10">11, 12, 13 … (+10)</option>
              <option value="20">21, 22, 23 … (+20)</option>
            </Select>
          </Field></div>
          <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            {([
              ['Cover page', withCover, setWithCover],
              ['Contents', withContents, setWithContents],
              ['Show figures', showFigures, setShowFigures],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
              <label key={label} className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                <input type="checkbox" className="size-4 cursor-pointer accent-[#2e75b6]" checked={val} onChange={(e) => set(e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="sky">{policies.length} policies</Badge>
            <Badge tone="lime">{notes.length} notes</Badge>
          </div>
        </div>

        {/* ---------------- on-screen document ---------------- */}
        {withCover && (
          <div className="mb-4 grid place-items-center rounded-lg border border-line bg-white px-6 py-12 text-center dark:bg-transparent">
            <div>
              <h2 className="text-xl font-extrabold uppercase">{company?.name || 'Company'}</h2>
              {company?.location && <p className="text-sm font-semibold">{company.location}</p>}
              <div className="mx-auto my-4 h-[3px] w-28 bg-ink dark:bg-white" />
              <p className="text-lg font-extrabold uppercase">Financial statements</p>
              <p className="text-sm font-bold uppercase">For the year ended 31 December {year}</p>
              <p className="mt-6 text-xs text-mist">
                Prepared {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {withContents && (
          <div className="mb-4 rounded-lg border border-line bg-white p-6 dark:bg-transparent">
            <h3 className="text-center text-sm font-extrabold uppercase">Contents</h3>
            <table className="mt-3 w-full text-xs">
              <tbody>
                <tr className="border-b border-dotted border-line">
                  <td className="w-24 py-1.5 font-bold">Note {policyNoteNo}</td>
                  <td className="py-1.5">Accounting policies</td>
                </tr>
                {notes.map((n) => (
                  <tr key={`toc-${n.no}`} className="border-b border-dotted border-line">
                    <td className="py-1.5 font-bold">Note {shownNoteNo(n.no)}</td>
                    <td className="py-1.5">{n.titleRaw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-lg border border-line bg-white p-6 dark:bg-transparent">
          <h2 className="text-center text-lg font-extrabold uppercase">{company?.name || 'Company'}</h2>
          {company?.location && <p className="text-center text-sm font-semibold">{company.location}</p>}
          <p className="mt-1 text-center text-sm font-bold uppercase">Notes to the financial statements</p>
          <p className="text-center text-sm font-bold uppercase">For the year ended 31 December {year}</p>
          {showFigures && <p className="mt-3 text-right text-xs font-bold">Amount in Ghana Cedi(s)</p>}

          <h3 className="mt-5 border-b border-ink/60 pb-1 text-sm font-extrabold uppercase">
            Note {policyNoteNo} — Accounting policies
          </h3>
          {policies.length ? policies.map((p) => (
            <div key={p.id} className="mt-3">
              <div className="text-sm font-bold">{p.code} {p.title}</div>
              <p className="mt-0.5 whitespace-pre-line text-justify text-xs leading-relaxed">{p.text}</p>
            </div>
          )) : (
            <p className="mt-2 text-xs text-mist">No active accounting policies for {year} — add them under Accounting Policies.</p>
          )}

          {notes.map((n) => (
            <div key={n.no} className="mt-6">
              <h3 className="border-b border-ink/60 pb-1 text-sm font-extrabold uppercase">Note {shownNoteNo(n.no)} — {n.title}</h3>
              {n.description && <p className="mt-1 text-justify text-xs leading-relaxed">{n.description}</p>}
              {n.lines.length > 0 && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {n.lines.map((l) => (
                      <tr key={`${n.no}-${l.name}`}>
                        <td className="py-1">{l.code ? `${l.code} ` : ''}{l.name}</td>
                        <td className="py-1 text-right tabular-nums">{showFigures ? formatGhsExact(l.amount) : ''}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-ink/60 font-bold">
                      <td className="py-1">Total</td>
                      <td className="py-1 text-right tabular-nums">{showFigures ? formatGhsExact(n.total) : ''}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ))}

          {notes.length === 0 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-mist">
              <FileText className="size-4" /> No Notes to Accounts yet — create them under Notes to Accounts; this page only reads them.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

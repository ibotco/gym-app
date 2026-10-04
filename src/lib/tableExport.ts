import type { ExportRow } from './export'

/**
 * Expands a row of cells into flat text values, honouring `colspan`.
 * Headers repeat their label for spanned columns ("Total", "Total (2)");
 * data cells fill spanned columns with "" so sums are not duplicated.
 */
function expand(cells: Element[], repeatLabel: boolean): string[] {
  const out: string[] = []
  for (const c of cells) {
    const span = Math.max(1, parseInt(c.getAttribute('colspan') ?? '1', 10) || 1)
    const text = (c.textContent || '').trim()
    out.push(text)
    for (let i = 1; i < span; i++) out.push(repeatLabel && text ? `${text} (${i + 1})` : '')
  }
  return out
}

/**
 * Reads the first table inside `root` into export rows, using the header
 * cells as column keys. Lets any rendered report table be exported as
 * CSV/Excel exactly as the user sees it. Duplicate header labels get a
 * "(2)", "(3)", … suffix so no column is silently dropped.
 */
export function tableToRows(root: HTMLElement | null): ExportRow[] {
  const table = root?.querySelector('table')
  if (!table) return []
  const heads = expand([...table.querySelectorAll('thead th')], true)
  const used = new Map<string, number>()
  const keys = heads.map((h, i) => {
    const base = h || `Column ${i + 1}`
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    return n === 0 ? base : `${base} (${n + 1})`
  })
  return [...table.querySelectorAll('tbody tr')].map((tr) => {
    const cells = expand([...tr.querySelectorAll('td')], false)
    const row: ExportRow = {}
    keys.forEach((k, i) => {
      row[k] = cells[i] ?? ''
    })
    return row
  })
}

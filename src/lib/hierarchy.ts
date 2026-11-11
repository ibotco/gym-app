/**
 * Parent-first ordering for account-style lists.
 *
 * The chart of accounts and Banking → Bank Accounts are the same table, and both
 * must read as the chart itself: every sub-account sits directly under its
 * parent, indented one level per generation. Sorting orders SIBLINGS — it never
 * tears a child away from the account it belongs to.
 *
 * Rules, shared by every caller:
 *  - the hierarchy is built from the rows that survive filtering, so a row whose
 *    parent was filtered out stands on its own instead of disappearing;
 *  - a broken or circular parent link can neither loop nor drop rows — anything
 *    left over is appended at the top level;
 *  - a row may not be its own parent.
 */
export type HierarchyRow = { id: string }

export interface OrderByParentOptions<T extends HierarchyRow> {
  /** Resolve a row's parent id, or null/undefined for a top-level row. */
  parentIdOf: (row: T) => string | null | undefined
  /** Order siblings. Omit to keep the input order. */
  compare?: (a: T, b: T) => number
}

export interface OrderedHierarchy<T> {
  /** The rows, parents immediately followed by their descendants. */
  rows: T[]
  /** Generation of each row id: 0 for top level, 1 for a child, and so on. */
  depthOf: Map<string, number>
}

export function orderByParent<T extends HierarchyRow>(
  input: T[],
  { parentIdOf, compare }: OrderByParentOptions<T>,
): OrderedHierarchy<T> {
  const present = new Set(input.map((r) => r.id))
  const kids = new Map<string | null, T[]>()
  for (const row of input) {
    const raw = parentIdOf(row)
    const parent = raw && raw !== row.id && present.has(raw) ? raw : null
    const list = kids.get(parent)
    if (list) list.push(row)
    else kids.set(parent, [row])
  }
  if (compare) for (const list of kids.values()) list.sort(compare)

  const rows: T[] = []
  const depthOf = new Map<string, number>()
  const seen = new Set<string>()
  const walk = (parent: string | null, level: number) => {
    for (const row of kids.get(parent) ?? []) {
      if (seen.has(row.id)) continue // a broken parent link must not loop
      seen.add(row.id)
      depthOf.set(row.id, level)
      rows.push(row)
      walk(row.id, level + 1)
    }
  }
  walk(null, 0)
  for (const row of input) {
    if (!seen.has(row.id)) {
      depthOf.set(row.id, 0)
      rows.push(row)
    }
  }
  return { rows, depthOf }
}

/** Left padding, in pixels, for a name cell at `depth` generations deep. */
export const indentFor = (depth = 0) => 12 + depth * 22

/** Validate an untrusted status response before the UI consumes telemetry. */
export function validateDatabaseStats(value: unknown, httpOk: boolean, status: number): void {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : null
  if (!httpOk || !data || data.ok !== true) {
    const detail = typeof data?.error === 'string' && data.error.trim() ? data.error : `Database status request failed (HTTP ${status}).`
    throw new Error(detail)
  }
  const validNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0
  const validModules = Array.isArray(data.modules) && data.modules.every((m: any) => m && typeof m.module === 'string' && validNumber(m.rows) && validNumber(m.tables) && (m.mysqlRows == null || validNumber(m.mysqlRows)) && (m.nosqlRows == null || validNumber(m.nosqlRows)))
  const validTables = Array.isArray(data.tables) && data.tables.every((t: any) => t && typeof t.module === 'string' && typeof t.table === 'string' && (t.menu == null || typeof t.menu === 'string') && validNumber(t.rows) && (t.mysqlRows == null || validNumber(t.mysqlRows)) && (t.nosqlRows == null || validNumber(t.nosqlRows)))
  const validSummary = (summary: any) => summary == null || (typeof summary === 'object' && validNumber(summary.totalRows) && validNumber(summary.totalTables))
  if (!validModules || !validTables || !validNumber(data.totalRows) || !validNumber(data.totalTables) || !validSummary(data.mysqlSummary) || !validSummary(data.nosqlSummary) || (data.version != null && typeof data.version !== 'string')) {
    throw new Error('Database status is unavailable: the server returned an incomplete or invalid response.')
  }
}

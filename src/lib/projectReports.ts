// Project Management — report metrics (pure functions, unit-tested).
// Feeds the Project Reports page: profitability, budget burn, utilisation,
// monthly billing and status breakdowns.

import type { Project, ProjectContract, ProjectTask, TimesheetEntry, ProjectInvoice } from '../types'

export interface ProjectMetrics {
  project: Project
  contractValue: number
  billed: number       // invoices sent or paid
  collected: number    // invoices paid
  outstanding: number  // invoices sent (awaiting payment)
  laborCost: number    // timesheet earnings
  hours: number        // timesheet hours
  taskCount: number
  tasksDone: number
  budget: number       // estimatedValue || 0
  burn: number         // labour cost / budget (0 when no budget)
  timeElapsed: number  // 0–100 across the project window
  profit: number       // billed − labour cost
  margin: number       // profit / billed (0 when nothing billed)
}

/** Whole calendar window elapsed, clamped 0–100. Bad dates → 0. */
export function timeElapsedPct(start: string, end: string, today = new Date().toISOString().slice(0, 10)): number {
  if (!start || !end || end < start) return 0
  if (today <= start) return 0
  if (today >= end) return 100
  const ms = (d: string) => new Date(d).getTime()
  return Math.min(100, Math.max(0, ((ms(today) - ms(start)) / (ms(end) - ms(start))) * 100))
}

/** Per-project rollup across contracts, tasks, timesheets and invoices. */
export function projectMetrics(
  projects: Project[],
  contracts: ProjectContract[],
  tasks: ProjectTask[],
  timesheets: TimesheetEntry[],
  invoices: ProjectInvoice[],
  today = new Date().toISOString().slice(0, 10),
): ProjectMetrics[] {
  return projects.map((project) => {
    const contractValue = contracts
      .filter((c) => c.projectId === project.id && c.status !== 'declined')
      .reduce((s, c) => s + (Number(c.value) || 0), 0)
    const billed = invoices
      .filter((i) => i.projectId === project.id && (i.status === 'sent' || i.status === 'paid'))
      .reduce((s, i) => s + (Number(i.total) || 0), 0)
    const collected = invoices
      .filter((i) => i.projectId === project.id && i.status === 'paid')
      .reduce((s, i) => s + (Number(i.total) || 0), 0)
    const outstanding = invoices
      .filter((i) => i.projectId === project.id && i.status === 'sent')
      .reduce((s, i) => s + (Number(i.total) || 0), 0)
    const mine = timesheets.filter((t) => t.projectId === project.id)
    const laborCost = mine.reduce((s, t) => s + (Number(t.earnings) || 0), 0)
    const hours = Math.round(mine.reduce((s, t) => s + (Number(t.hours) || 0), 0) * 100) / 100
    const myTasks = tasks.filter((t) => t.projectId === project.id)
    const budget = Number(project.estimatedValue) || 0
    const profit = billed - laborCost
    return {
      project,
      contractValue,
      billed,
      collected,
      outstanding,
      laborCost,
      hours,
      taskCount: myTasks.length,
      tasksDone: myTasks.filter((t) => t.status === 'completed').length,
      budget,
      burn: budget > 0 ? laborCost / budget : 0,
      timeElapsed: timeElapsedPct(project.startDate, project.endDate, today),
      profit,
      margin: billed > 0 ? profit / billed : 0,
    }
  })
}

export interface UserUtilisation { userId: string; userName: string; hours: number; earnings: number }

/** Hours + earnings per user, busiest first. */
export function utilisationByUser(timesheets: TimesheetEntry[]): UserUtilisation[] {
  const map = new Map<string, UserUtilisation>()
  for (const t of timesheets) {
    const cur = map.get(t.userId) || { userId: t.userId, userName: t.userName, hours: 0, earnings: 0 }
    cur.hours = Math.round((cur.hours + (Number(t.hours) || 0)) * 100) / 100
    cur.earnings += Number(t.earnings) || 0
    map.set(t.userId, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
}

export interface MonthPoint { month: number; billed: number; collected: number }

/** 12-month billed vs collected series for one year (month = 1–12). */
export function monthlyBillingSeries(invoices: ProjectInvoice[], year: number): MonthPoint[] {
  const out: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, billed: 0, collected: 0 }))
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue
    if (!inv.invoiceDate || !inv.invoiceDate.startsWith(String(year))) continue
    const m = Number(inv.invoiceDate.slice(5, 7)) - 1
    if (m < 0 || m > 11) continue
    out[m].billed += Number(inv.total) || 0
    if (inv.status === 'paid') out[m].collected += Number(inv.total) || 0
  }
  return out
}

export interface StatusCount { status: string; count: number }

/** Count of items per status, preserving the order of `order` then extras. */
export function countByStatus<T>(items: T[], get: (item: T) => string, order: string[]): StatusCount[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const s = get(item)
    counts.set(s, (counts.get(s) || 0) + 1)
  }
  const known = order.filter((s) => counts.has(s)).map((s) => ({ status: s, count: counts.get(s)! }))
  const extras = Array.from(counts.keys()).filter((s) => !order.includes(s)).map((s) => ({ status: s, count: counts.get(s)! }))
  return [...known, ...extras]
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from './AppContext'
import { uid } from '../lib/utils'

import {
  addDays, createActivationCode, daysRemaining, effectiveStatus, expiryWarning, licenseForCompany,
  loadActivationCodes, loadLicenseLogs, loadLicensePayments, loadSubPlans, loadSubscriptions,
  logLicense, renewalBase, saveActivationCodes, saveLicenseLogs, saveLicensePayments, saveSubPlans,
  saveSubscriptions, todayIso, verifyActivationCode,
} from '../lib/license'
import {PACKAGE_MODULES, cycleDays, cyclePrice, downgradeBlockers, effectiveOrgStatus, loadOrgSubs, loadPackageAudit,
  loadPackages, loadSubHistory, loadSubInvoices, moduleForPath, ORG_SUB_ACTIVE, prorationCredit,
  saveOrgSubs, savePackageAudit, savePackages, saveSubHistory, saveSubInvoices, type UsageSnapshot,} from '../lib/packages'
import type {
  ActivationCode, LicenseLog, LicensePayment, OrganizationSubscription, OrgSubStatus, PackageAuditLog,
  Subscription, SubscriptionHistoryEvent, SubscriptionInvoice, SubscriptionPlan, SubscriptionStatus,
  SubscriptionPackage,
} from '../types'

interface LicenseCtx {
  // --- time-based licence (activation codes / online renewal) ---
  plans: SubscriptionPlan[]
  subscriptions: Subscription[]
  codes: ActivationCode[]
  payments: LicensePayment[]
  logs: LicenseLog[]
  license: Subscription | undefined
  licenseActive: boolean
  warning: string | null
  remaining: number
  upsertPlan: (p: SubscriptionPlan) => void
  deletePlan: (id: string) => void
  generateCode: (opts: { companyId: string; days: number; planName: string; singleUse: boolean; sendVia: 'in-app' | 'email' | 'sms' }) => ActivationCode
  revokeCode: (id: string) => void
  redeemCode: (code: string) => { ok: true; expiry: string } | { ok: false; error: string }
  renewOnline: (plan: SubscriptionPlan, gateway: string, reference: string, amount: number) => Subscription
  setSubscriptionStatus: (id: string, status: SubscriptionStatus) => void
  extendSubscription: (id: string, days: number) => void
  syncLogs: () => number
  // --- subscription packages ---
  packages: SubscriptionPackage[]
  orgSubs: OrganizationSubscription[]
  subInvoices: SubscriptionInvoice[]
  subHistory: SubscriptionHistoryEvent[]
  packageAudit: PackageAuditLog[]
  orgSub: OrganizationSubscription | undefined
  currentPackage: SubscriptionPackage | undefined
  pkgStatus: OrgSubStatus | undefined
  pkgActive: boolean
  usage: UsageSnapshot
  canModule: (moduleId: string) => boolean
  packageHiddenNavKeys: Set<string>
  blockedModuleForPath: (path: string) => string | undefined
  upsertPackage: (p: SubscriptionPackage) => void
  deletePackage: (id: string) => void
  subscribeCompany: (companyId: string, packageId: string, cycle: OrganizationSubscription['billingCycle'], trial?: boolean) => void
  renewOrgSub: (companyId: string, cycle: OrganizationSubscription['billingCycle']) => void
  setOrgSubStatus: (companyId: string, status: OrgSubStatus) => void
  changePackage: (companyId: string, packageId: string, cycle: OrganizationSubscription['billingCycle']) => { ok: boolean; blockers: string[] }
  logPackageAudit: (action: string, detail: string) => void
}

const Ctx = createContext<LicenseCtx | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const app = useApp()
  const { activeCompanyId, sessionUser, companies, notify } = app

  // ----- licence stores -----
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => loadSubPlans())
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => loadSubscriptions(app.activeCompanyId))
  const [codes, setCodes] = useState<ActivationCode[]>(() => loadActivationCodes())
  const [payments, setPayments] = useState<LicensePayment[]>(() => loadLicensePayments())
  const [logs, setLogs] = useState<LicenseLog[]>(() => loadLicenseLogs())
  // ----- package stores -----
  const [packages, setPackages] = useState<SubscriptionPackage[]>(() => loadPackages())
  const [orgSubs, setOrgSubs] = useState<OrganizationSubscription[]>(() => loadOrgSubs(app.activeCompanyId))
  const [subInvoices, setSubInvoices] = useState<SubscriptionInvoice[]>(() => loadSubInvoices())
  const [subHistory, setSubHistory] = useState<SubscriptionHistoryEvent[]>(() => loadSubHistory())
  const [packageAudit, setPackageAudit] = useState<PackageAuditLog[]>(() => loadPackageAudit())

  useEffect(() => saveSubPlans(plans), [plans])
  useEffect(() => saveSubscriptions(subscriptions), [subscriptions])
  useEffect(() => saveActivationCodes(codes), [codes])
  useEffect(() => saveLicensePayments(payments), [payments])
  useEffect(() => saveLicenseLogs(logs), [logs])
  useEffect(() => savePackages(packages), [packages])
  useEffect(() => saveOrgSubs(orgSubs), [orgSubs])
  useEffect(() => saveSubInvoices(subInvoices), [subInvoices])
  useEffect(() => saveSubHistory(subHistory), [subHistory])
  useEffect(() => savePackageAudit(packageAudit), [packageAudit])

  const actor = sessionUser?.name || sessionUser?.email || 'system'

  const pushLog = useCallback((action: string, detail: string) => {
    setLogs((l) => logLicense(l, actor, action, detail))
  }, [actor])
  const pushAudit = useCallback((action: string, detail: string) => {
    setPackageAudit((l) => [{ id: uid('pa'), at: new Date().toISOString(), actor, action, detail }, ...l])
  }, [actor])
  const pushHistory = useCallback((companyId: string, action: string, detail: string) => {
    setSubHistory((h) => [{ id: uid('sh'), companyId, at: new Date().toISOString(), actor, action, detail }, ...h])
  }, [actor])

  useEffect(() => {
    const on = () => setLogs((l) => (l.some((x) => !x.synced) ? l.map((x) => ({ ...x, synced: true })) : l))
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])

  // ----- licence derived -----
  const license = useMemo(() => licenseForCompany(subscriptions, activeCompanyId), [subscriptions, activeCompanyId])
  const licenseActive = !!license && effectiveStatus(license) === 'active'
  const warning = license ? expiryWarning(license) : null
  const remaining = license ? daysRemaining(license) : 0

  // ----- usage snapshot (live counts against package limits) -----
  const usage: UsageSnapshot = useMemo(() => {
    const month = todayIso().slice(0, 7)
    const tx = [app.payments, app.sales, app.purchases].reduce(
      (sum, list) => sum + list.filter((x) => (x as { date?: string }).date?.startsWith(month)).length, 0)
    const stored = [app.sales, app.purchases, app.members, app.timesheets].reduce((s, l) => s + l.length, 0)
    return {
      users: app.users.length,
      employees: app.staff.length,
      members: app.members.length,
      branches: app.branches.length,
      projects: app.projects.length,
      inventoryItems: app.inventory.length,
      assets: app.assets.length,
      monthlyTransactions: tx,
      storageMb: Math.round(stored * 0.05 * 100) / 100,
    }
  }, [app.users, app.staff, app.members, app.branches, app.projects, app.inventory, app.assets, app.payments, app.sales, app.purchases, app.timesheets])

  // ----- package derived -----
  const orgSub = useMemo(() => {
    const found = orgSubs.find((s) => s.companyId === activeCompanyId)
    if (found) return found
    const starter = packages.find((p) => p.tier === 'starter') || packages[0]
    const company = companies.find((c) => c.id === activeCompanyId)
    if (!starter) return undefined
    const start = company?.createdAt || todayIso()
    return {
      id: `orgsub_${activeCompanyId}`, companyId: activeCompanyId, packageId: starter.id, packageName: starter.name,
      status: 'trial' as OrgSubStatus, billingCycle: 'monthly' as const, activationDate: start,
      expiryDate: addDays(start, starter.pricing.trialDays), renewalDate: addDays(start, starter.pricing.trialDays),
    }
  }, [orgSubs, activeCompanyId, packages, companies])

  const currentPackage = useMemo(() => packages.find((p) => p.id === orgSub?.packageId), [packages, orgSub])
  const pkgStatus = orgSub && currentPackage ? effectiveOrgStatus(orgSub, currentPackage.pricing.graceDays) : undefined
  const pkgActive = !!pkgStatus && (ORG_SUB_ACTIVE as readonly OrgSubStatus[]).includes(pkgStatus)

  const canModule = useCallback((moduleId: string) => {
    if (sessionUser?.role === 'super_admin') return true
    return pkgActive && !!currentPackage && currentPackage.modules.includes(moduleId)
  }, [sessionUser, pkgActive, currentPackage])

  const packageHiddenNavKeys = useMemo(() => {
    const hidden = new Set<string>()
    if (sessionUser?.role === 'super_admin' || !currentPackage) return hidden
    for (const m of PACKAGE_MODULES) if (!currentPackage.modules.includes(m.id)) m.navKeys.forEach((k) => hidden.add(k))
    return hidden
  }, [sessionUser, currentPackage])

  const blockedModuleForPath = useCallback((path: string) => {
    if (sessionUser?.role === 'super_admin') return undefined
    const mod = moduleForPath(path)
    if (!mod) return undefined
    return pkgActive && currentPackage?.modules.includes(mod) ? undefined : mod
  }, [sessionUser, pkgActive, currentPackage])

  // ----- licence ops -----
  const upsertPlan = (p: SubscriptionPlan) => {
    setPlans((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p]))
    pushLog('PLAN_SAVE', `${p.name} (${p.days}d @ ${p.price} ${p.currency || ''})`)
  }
  const deletePlan = (id: string) => { setPlans((s) => s.filter((p) => p.id !== id)); pushLog('PLAN_DELETE', id) }

  const generateCode: LicenseCtx['generateCode'] = ({ companyId, days, planName, singleUse, sendVia }) => {
    const rec: ActivationCode = createActivationCode({ companyId, days, planName, singleUse, issuedBy: actor })
    setCodes((s) => [rec, ...s])
    pushLog('CODE_ISSUE', `${rec.code} · ${planName} ${days}d for ${companies.find((c) => c.id === companyId)?.name || 'any company'} via ${sendVia}`)
    if (sendVia === 'in-app' && companyId) {
      notify({ userId: sessionUser?.id || '', companyId, title: 'New activation code', message: `A ${planName} activation code was issued: ${rec.code}`, channel: 'in-app' })
    } else if (sendVia !== 'in-app') {
      pushLog('CODE_SEND', `Queued ${sendVia} delivery of code ${rec.code} (${rec.id}) — demo transport.`)
    }
    return rec
  }
  const revokeCode = (id: string) => { setCodes((s) => s.map((c) => (c.id === id ? { ...c, status: 'revoked' } : c))); pushLog('CODE_REVOKE', id) }

  const applyActivation = (companyId: string, days: number, planName: string, source: Subscription['source']): Subscription => {
    const existing = licenseForCompany(subscriptions, companyId)
    const base = renewalBase(existing)
    const expiry = addDays(base, days)
    const next: Subscription = existing
      ? { ...existing, planName, days: existing.days + days, expiryDate: expiry, status: 'active', source, lastActivatedAt: todayIso() }
      : { id: `sub_${companyId}`, companyId, planName, days, startDate: todayIso(), expiryDate: expiry, status: 'active', source, lastActivatedAt: todayIso() }
    setSubscriptions((s) => (s.some((x) => x.id === next.id) ? s.map((x) => (x.id === next.id ? next : x)) : [...s, next]))
    return next
  }

  const redeemCode: LicenseCtx['redeemCode'] = (code) => {
    const v = verifyActivationCode(code, codes, activeCompanyId)
    if (!v.ok) { pushLog('CODE_REJECT', v.error); return { ok: false, error: v.error } }
    const rec = v.rec
    if (rec.status === 'revoked') { pushLog('CODE_REJECT', 'revoked code'); return { ok: false, error: 'This code has been revoked.' } }
    if (rec.singleUse && rec.status === 'used') { pushLog('CODE_REJECT', 'single-use code already redeemed'); return { ok: false, error: 'This single-use code was already redeemed.' } }
    const next = applyActivation(activeCompanyId, rec.planDays, rec.planName, 'offline')
    setCodes((s) => s.map((c) => (c.id === rec.id ? { ...c, status: 'used', usedAt: todayIso(), usedByCompanyId: activeCompanyId } : c)))
    pushLog('CODE_REDEEM', `${rec.code} · ${rec.planName} ${rec.planDays}d → expiry ${next.expiryDate}`)
    notify({ userId: sessionUser?.id || '', companyId: activeCompanyId, title: 'Subscription activated', message: `Activation accepted — your subscription now expires on ${next.expiryDate}.`, channel: 'in-app' })
    return { ok: true, expiry: next.expiryDate }
  }

  const renewOnline: LicenseCtx['renewOnline'] = (plan, gateway, reference, amount) => {
    const next = applyActivation(activeCompanyId, plan.days, plan.name, 'online')
    const pay: LicensePayment = {
      id: uid('lp'), companyId: activeCompanyId, subscriptionId: next.id, planId: plan.id, planName: plan.name,
      amount, currency: plan.currency || 'GHS', gateway, reference, receiptNo: `RCP-${Date.now().toString(36).toUpperCase()}`,
      status: 'paid', date: todayIso(),
    }
    setPayments((s) => [pay, ...s])
    pushLog('ONLINE_RENEW', `${plan.name} via ${gateway} ref ${reference} → expiry ${next.expiryDate}`)
    notify({ userId: sessionUser?.id || '', companyId: activeCompanyId, title: 'Renewal successful', message: `${plan.name} paid via ${gateway}. Receipt ${pay.receiptNo} — new expiry ${next.expiryDate}.`, channel: 'in-app' })
    return next
  }

  const setSubscriptionStatus = (id: string, status: SubscriptionStatus) => {
    setSubscriptions((s) => s.map((x) => (x.id === id ? { ...x, status } : x)))
    pushLog('SUB_STATUS', `${id} → ${status}`)
  }
  const extendSubscription = (id: string, days: number) => {
    setSubscriptions((s) => s.map((x) => (x.id === id ? { ...x, expiryDate: addDays(renewalBase(x), days), days: x.days + days, status: x.status === 'revoked' ? 'revoked' : 'active', lastActivatedAt: todayIso() } : x)))
    pushLog('SUB_EXTEND', `${id} +${days}d`)
  }
  const syncLogs = () => {
    const pending = logs.filter((l) => !l.synced).length
    setLogs((l) => l.map((x) => ({ ...x, synced: true })))
    return pending
  }

  // ----- package ops -----
  const upsertPackage = (p: SubscriptionPackage) => {
    setPackages((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p]))
    pushAudit('PACKAGE_SAVE', `${p.name} (${p.modules.length} modules)`)
  }
  const deletePackage = (id: string) => { setPackages((s) => s.filter((p) => p.id !== id)); pushAudit('PACKAGE_DELETE', id) }

  const issueInvoice = (companyId: string, pkg: SubscriptionPackage, cycle: OrganizationSubscription['billingCycle'], amount: number, setupFee: number, proration?: string) => {
    const inv: SubscriptionInvoice = {
      id: uid('si'), companyId, packageId: pkg.id, packageName: pkg.name, cycle, amount, setupFee, proration,
      receiptNo: `SUB-${Date.now().toString(36).toUpperCase()}`, status: 'paid', date: todayIso(),
    }
    setSubInvoices((s) => [inv, ...s])
    return inv
  }

  const upsertOrgSub = (next: OrganizationSubscription) => {
    setOrgSubs((s) => (s.some((x) => x.companyId === next.companyId) ? s.map((x) => (x.companyId === next.companyId ? next : x)) : [...s, next]))
  }

  const subscribeCompany: LicenseCtx['subscribeCompany'] = (companyId, packageId, cycle, trial = false) => {
    const pkg = packages.find((p) => p.id === packageId)
    if (!pkg) return
    const days = trial ? pkg.pricing.trialDays : cycleDays(cycle)
    const start = todayIso()
    upsertOrgSub({
      id: `orgsub_${companyId}`, companyId, packageId: pkg.id, packageName: pkg.name,
      status: trial ? 'trial' : 'active', billingCycle: cycle, activationDate: start,
      expiryDate: addDays(start, days), renewalDate: addDays(start, days),
    })
    if (!trial) issueInvoice(companyId, pkg, cycle, cyclePrice(pkg, cycle), pkg.pricing.setupFee)
    pushHistory(companyId, trial ? 'TRIAL_STARTED' : 'SUBSCRIBED', `${pkg.name} · ${trial ? `${pkg.pricing.trialDays}d trial` : cycle}`)
    pushAudit('ORG_SUBSCRIBE', `${companies.find((c) => c.id === companyId)?.name || companyId} → ${pkg.name}`)
  }

  const renewOrgSub: LicenseCtx['renewOrgSub'] = (companyId, cycle) => {
    const sub = orgSubs.find((s) => s.companyId === companyId)
    const pkg = packages.find((p) => p.id === sub?.packageId)
    if (!sub || !pkg) return
    const base = sub.expiryDate > todayIso() ? sub.expiryDate : todayIso()
    const expiry = addDays(base, cycleDays(cycle))
    upsertOrgSub({ ...sub, billingCycle: cycle, status: 'active', expiryDate: expiry, renewalDate: expiry })
    issueInvoice(companyId, pkg, cycle, cyclePrice(pkg, cycle), 0)
    pushHistory(companyId, 'RENEWED', `${pkg.name} · ${cycle} → ${expiry}`)
  }

  const setOrgSubStatus = (companyId: string, status: OrgSubStatus) => {
    setOrgSubs((s) => s.map((x) => (x.companyId === companyId ? { ...x, status } : x)))
    pushHistory(companyId, 'STATUS', `→ ${status}`)
    pushAudit('ORG_STATUS', `${companyId} → ${status}`)
  }

  const changePackage: LicenseCtx['changePackage'] = (companyId, packageId, cycle) => {
    const target = packages.find((p) => p.id === packageId)
    const sub = orgSubs.find((s) => s.companyId === companyId)
    const current = packages.find((p) => p.id === sub?.packageId)
    if (!target || !sub) return { ok: false, blockers: ['Subscription not found.'] }
    const blockers = downgradeBlockers(usage, target)
    if (blockers.length) return { ok: false, blockers }
    const daysLeft = Math.max(0, daysRemaining({ ...sub, expiryDate: sub.expiryDate } as unknown as Subscription))
    const credit = current && sub.expiryDate > todayIso() ? prorationCredit(cyclePrice(current, sub.billingCycle), cycleDays(sub.billingCycle), daysLeft) : 0
    const price = Math.max(0, cyclePrice(target, cycle) - credit)
    upsertOrgSub({ ...sub, packageId: target.id, packageName: target.name, previousPackageId: sub.packageId, billingCycle: cycle, status: 'active' })
    issueInvoice(companyId, target, cycle, price, 0, credit > 0 ? `Credit ${credit.toFixed(2)} for unused time on ${current?.name}` : undefined)
    pushHistory(companyId, current && current.pricing.monthly <= target.pricing.monthly ? 'UPGRADED' : 'DOWNGRADED', `${current?.name || '—'} → ${target.name}`)
    pushAudit('PACKAGE_CHANGE', `${companyId}: ${current?.name || '—'} → ${target.name}`)
    return { ok: true, blockers: [] }
  }

  const value: LicenseCtx = {
    plans, subscriptions, codes, payments, logs, license, licenseActive, warning, remaining,
    upsertPlan, deletePlan, generateCode, revokeCode, redeemCode, renewOnline,
    setSubscriptionStatus, extendSubscription, syncLogs,
    packages, orgSubs, subInvoices, subHistory, packageAudit,
    orgSub, currentPackage, pkgStatus, pkgActive, usage,
    canModule, packageHiddenNavKeys, blockedModuleForPath,
    upsertPackage, deletePackage, subscribeCompany, renewOrgSub, setOrgSubStatus, changePackage,
    logPackageAudit: pushAudit,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLicense() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLicense')
  return v
}

export { seedSubscription } from '../lib/license'

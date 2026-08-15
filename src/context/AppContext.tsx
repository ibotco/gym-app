import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Attendance, AuditLog, Booking, Branch, GymClass, Invoice, Lead, LeaveRequest,
  Member, Membership, Message, NotificationItem, Payment, Plan, ProgressLog,
  SessionBooking, StaffRecord, Trainer, User, WorkoutPlan, CompanySettings,
  CredentialEvent, CredentialSettings, CredentialScope, CredentialChannel,
  CredentialDeliveryResult, InitialPasswordMode, GatewayPaymentInput, PaymentMethod,
} from '../types'
import {
  ATTENDANCE, AUDIT, BOOKINGS, BRANCHES, CLASSES, COMPANY, INVOICES, LEADS, LEAVES,
  MEMBERS, MEMBERSHIPS, MESSAGES, NOTIFICATIONS, PAYMENTS, PLANS, PROGRESS,
  SESSIONS, STAFF, TRAINERS, USERS, WORKOUTS,
} from '../data/seed'
import { uid } from '../lib/utils'
import { generateUsername, hashPassword, takenUsernames } from '../lib/password'
import {
  CRED_EVENTS_KEY, USERS_KEY, issueInitialPassword, loadCredentialSettings, loadReveal,
  saveCredentialSettings, saveReveal,
} from '../lib/credentials'
import { applyBrandColor, normalizeHex } from '../lib/color'
import { isPaystackEnabled } from '../lib/paystack'

interface CreateMemberInput {
  name: string
  email: string
  password: string
  phone: string
  planId?: string
  branchId?: string
  gender?: Member['gender']
  dob?: string
  address?: string
  tags?: string[]
  goals?: string[]
  medicalNotes?: string
  emergency?: Member['emergency']
  heightCm?: number
  weightKg?: number
  trainerId?: string
  status?: User['status']
  emailVerified?: boolean
  emailVerifyToken?: string
  emailVerifyExpires?: string
  username?: string
  mustChangePassword?: boolean
}

export interface RegenerateCredentialsInput {
  memberId?: string
  userId?: string
  adminId: string
  adminName: string
  scope: CredentialScope
  channels: CredentialChannel[]
  passwordMode?: InitialPasswordMode
}

export interface RegenerateCredentialsResult {
  ok: boolean
  error?: string
  event?: CredentialEvent
  username?: string
  tempPassword?: string
  passwordChanged?: boolean
  usernameChanged?: boolean
}

interface AppStore {
  users: User[]
  members: Member[]
  trainers: Trainer[]
  staff: StaffRecord[]
  plans: Plan[]
  memberships: Membership[]
  payments: Payment[]
  invoices: Invoice[]
  classes: GymClass[]
  bookings: Booking[]
  attendance: Attendance[]
  workouts: WorkoutPlan[]
  progress: ProgressLog[]
  notifications: NotificationItem[]
  branches: Branch[]
  leads: Lead[]
  messages: Message[]
  audit: AuditLog[]
  leaves: LeaveRequest[]
  sessions: SessionBooking[]
  company: CompanySettings
  setCompany: (c: CompanySettings) => void
  credentialEvents: CredentialEvent[]
  credentialSettings: CredentialSettings
  setCredentialSettings: (s: CredentialSettings) => void
  regenerateMemberCredentials: (input: RegenerateCredentialsInput) => Promise<RegenerateCredentialsResult>
  recordCredentialDelivery: (eventId: string, deliveries: CredentialDeliveryResult[]) => void
  appendCredentialEvent: (event: CredentialEvent) => void
  patchUser: (id: string, patch: Partial<User>) => void
  upsertUser: (u: User) => void
  upsertMember: (m: Member) => void
  deleteMember: (id: string) => void
  upsertStaff: (s: StaffRecord) => void
  upsertTrainer: (t: Trainer) => void
  upsertPlan: (p: Plan) => void
  deletePlan: (id: string) => void
  upsertClass: (c: GymClass) => void
  deleteClass: (id: string) => void
  upsertLead: (l: Lead) => void
  deleteLead: (id: string) => void
  upsertPayment: (p: Payment) => void
  upsertInvoice: (i: Invoice) => void
  upsertMembership: (m: Membership) => void
  bookClass: (classId: string, memberId: string, date: string) => { ok: boolean; status: Booking['status']; message: string }
  cancelBooking: (id: string) => void
  checkIn: (memberId: string, branchId: string) => Attendance
  addProgress: (p: ProgressLog) => void
  upsertWorkout: (w: WorkoutPlan) => void
  sendMessage: (m: Omit<Message, 'id' | 'createdAt' | 'read'>) => void
  markMessagesRead: (ids: string[]) => void
  notify: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void
  markNotifRead: (id: string) => void
  markAllNotifRead: (userId: string) => void
  log: (userId: string, action: string, entity: string, details: string) => void
  upsertLeave: (l: LeaveRequest) => void
  upsertSession: (s: SessionBooking) => void
  createMemberAccount: (input: CreateMemberInput) => { userId: string; memberId: string }
  takeAttendance: (classId: string, memberId: string, present: boolean) => void
  refundPayment: (id: string) => void
  requestMembershipRenewal: (memberId: string) => { ok: boolean; paymentId?: string; invoiceId?: string; error?: string }
  settlePayment: (paymentId: string) => { ok: boolean; error?: string }
  applyGatewayPayment: (input: GatewayPaymentInput) => { ok: boolean; error?: string; settled?: boolean }
  upsertBranch: (b: Branch) => void
  deleteBranch: (id: string) => void
}

const Ctx = createContext<AppStore | null>(null)

function normalizeUser(u: User): User {
  return {
    ...u,
    username: u.username || u.email.split('@')[0].toLowerCase(),
  }
}

function loadPersistedUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return USERS.map(normalizeUser)
    const saved = JSON.parse(raw) as User[]
    const byId = new Map(saved.map((u) => [u.id, u]))
    const merged = USERS.map((seed) => normalizeUser({ ...seed, ...(byId.get(seed.id) || {}) }))
    for (const u of saved) {
      if (!USERS.some((s) => s.id === u.id)) merged.push(normalizeUser(u))
    }
    return merged
  } catch {
    return USERS.map(normalizeUser)
  }
}

function persistUsers(list: User[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

function loadCredentialEvents(): CredentialEvent[] {
  try {
    const raw = localStorage.getItem(CRED_EVENTS_KEY)
    if (raw) return JSON.parse(raw) as CredentialEvent[]
  } catch {
    /* ignore */
  }
  return []
}

function persistCredentialEvents(events: CredentialEvent[]) {
  try {
    localStorage.setItem(CRED_EVENTS_KEY, JSON.stringify(events.slice(0, 500)))
  } catch {
    /* quota */
  }
}

const PAY_KEY = 'fitpro_payments'
const INV_KEY = 'fitpro_invoices'
const MS_KEY = 'fitpro_memberships'

function loadMerged<T extends { id: string }>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return seed
    const saved = JSON.parse(raw) as T[]
    const byId = new Map(saved.map((x) => [x.id, x]))
    const merged = seed.map((s) => ({ ...s, ...(byId.get(s.id) || {}) }))
    for (const x of saved) {
      if (!seed.some((s) => s.id === x.id)) merged.push(x)
    }
    return merged
  } catch {
    return seed
  }
}

function persistJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsersState] = useState<User[]>(loadPersistedUsers)
  const setUsers = useCallback((action: User[] | ((prev: User[]) => User[])) => {
    setUsersState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistUsers(next)
      return next
    })
  }, [])
  const [credentialEvents, setCredentialEventsState] = useState<CredentialEvent[]>(loadCredentialEvents)
  const setCredentialEvents = useCallback((action: CredentialEvent[] | ((prev: CredentialEvent[]) => CredentialEvent[])) => {
    setCredentialEventsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistCredentialEvents(next)
      return next
    })
  }, [])
  const [credentialSettings, setCredentialSettingsState] = useState<CredentialSettings>(() => loadCredentialSettings())
  const setCredentialSettings = useCallback((s: CredentialSettings) => {
    setCredentialSettingsState(s)
    saveCredentialSettings(s)
  }, [])
  const [members, setMembers] = useState(MEMBERS)
  const [trainers, setTrainers] = useState(TRAINERS)
  const [staff, setStaff] = useState(STAFF)
  const [plans, setPlans] = useState(PLANS)
  const [memberships, setMembershipsState] = useState(() => loadMerged(MS_KEY, MEMBERSHIPS))
  const setMemberships = useCallback((action: Membership[] | ((prev: Membership[]) => Membership[])) => {
    setMembershipsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(MS_KEY, next)
      return next
    })
  }, [])
  const [payments, setPaymentsState] = useState(() => loadMerged(PAY_KEY, PAYMENTS))
  const setPayments = useCallback((action: Payment[] | ((prev: Payment[]) => Payment[])) => {
    setPaymentsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(PAY_KEY, next)
      return next
    })
  }, [])
  const [invoices, setInvoicesState] = useState(() => loadMerged(INV_KEY, INVOICES))
  const setInvoices = useCallback((action: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    setInvoicesState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(INV_KEY, next)
      return next
    })
  }, [])
  const [classes, setClasses] = useState(CLASSES)
  const [bookings, setBookings] = useState(BOOKINGS)
  const [attendance, setAttendance] = useState(ATTENDANCE)
  const [workouts, setWorkouts] = useState(WORKOUTS)
  const [progress, setProgress] = useState(PROGRESS)
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [branches, setBranches] = useState(BRANCHES)
  const [leads, setLeads] = useState(LEADS)
  const [messages, setMessages] = useState(MESSAGES)
  const [audit, setAudit] = useState(AUDIT)
  const [leaves, setLeaves] = useState(LEAVES)
  const [sessions, setSessions] = useState(SESSIONS)
  const [company, setCompanyState] = useState<CompanySettings>(() => {
    try {
      const raw = localStorage.getItem('fitpro_company')
      if (raw) return { ...COMPANY, ...JSON.parse(raw) }
    } catch {
      /* keep defaults */
    }
    return COMPANY
  })
  const setCompany = (c: CompanySettings) => {
    const next = { ...c, brandPrimary: normalizeHex(c.brandPrimary || '#C8F542') }
    setCompanyState(next)
    applyBrandColor(next.brandPrimary)
    try {
      localStorage.setItem('fitpro_company', JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
  }

  useEffect(() => {
    applyBrandColor(company.brandPrimary || '#C8F542')
  }, [company.brandPrimary])

  const log = useCallback((userId: string, action: string, entity: string, details: string) => {
    setAudit((a) => [{ id: uid('au'), userId, action, entity, details, createdAt: new Date().toISOString() }, ...a])
  }, [])

  const patchUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((s) => s.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [setUsers])

  const createMemberAccount = useCallback((input: CreateMemberInput) => {
    const userId = uid('u')
    const memberId = uid('mb')
    const membershipId = uid('ms')
    const planId = input.planId || 'pl_month'
    const branchId = input.branchId || 'br_airport'
    const plan = plans.find((p) => p.id === planId) || plans[0]
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + plan.durationDays)
    const user: User = {
      id: userId,
      email: input.email,
      password: input.password,
      name: input.name,
      role: 'member',
      avatar: '/images/member-ava-5.jpg',
      phone: input.phone,
      branchId,
      status: input.status || 'active',
      createdAt: start.toISOString().slice(0, 10),
      emailVerified: input.emailVerified,
      emailVerifyToken: input.emailVerifyToken,
      emailVerifyExpires: input.emailVerifyExpires,
      username: input.username || input.email.split('@')[0].toLowerCase(),
      mustChangePassword: !!input.mustChangePassword,
    }
    const member: Member = {
      id: memberId,
      userId,
      membershipId,
      planId,
      joinDate: start.toISOString().slice(0, 10),
      emergency: input.emergency || { name: '', phone: '', relation: '' },
      medicalNotes: input.medicalNotes || '',
      tags: input.tags?.length ? input.tags : ['New'],
      goals: input.goals || [],
      heightCm: input.heightCm || 170,
      weightKg: input.weightKg || 70,
      dob: input.dob || '1995-01-01',
      gender: input.gender || 'other',
      address: input.address || 'Accra',
      qrCode: `FITPRO-${memberId.toUpperCase()}`,
      trainerId: input.trainerId,
    }
    const ms: Membership = {
      id: membershipId,
      memberId,
      planId,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: 'active',
      autoRenew: true,
      branchId,
    }
    setUsers((s) => [...s, user])
    setMembers((s) => [...s, member])
    setMemberships((s) => [...s, ms])
    setBranches((s) => s.map((b) => (b.id === branchId ? { ...b, members: b.members + 1 } : b)))
    log(userId, 'CREATE', 'Member', `Created ${input.name}`)
    return { userId, memberId }
  }, [plans, log, setUsers])

  const regenerateMemberCredentials = useCallback(async (input: RegenerateCredentialsInput): Promise<RegenerateCredentialsResult> => {
    const member = input.memberId ? members.find((m) => m.id === input.memberId) : members.find((m) => m.userId === input.userId)
    const staffRec = input.userId ? staff.find((s) => s.userId === input.userId) : undefined
    const target = input.userId
      ? users.find((u) => u.id === input.userId)
      : member
        ? users.find((u) => u.id === member.userId)
        : undefined
    if (!target) return { ok: false, error: 'Account not found.' }
    if (target.status === 'suspended') return { ok: false, error: 'Reactivate the account before issuing new login details.' }

    const recordId = member?.id || staffRec?.id || target.id
    const who = target.role === 'member' ? 'member' : 'staff'

    const scope = input.scope
    const changePassword = scope === 'password' || scope === 'both'
    const changeUsername = scope === 'username' || scope === 'both'
    if (!changePassword && !changeUsername) return { ok: false, error: 'Choose what to regenerate.' }

    const policy = credentialSettings.policy
    let nextUsername = target.username || target.email.split('@')[0].toLowerCase()
    let tempPassword: string | undefined
    const patch: Partial<User> = {
      credentialsRegeneratedAt: new Date().toISOString(),
      credentialsRegeneratedBy: input.adminId,
    }

    if (changeUsername) {
      nextUsername = generateUsername(target.name || nextUsername, takenUsernames(users, target.id))
      patch.username = nextUsername
    }
    if (changePassword) {
      const issued = issueInitialPassword(
        input.passwordMode || credentialSettings.initialPasswordMode || 'auto',
        target.phone || '',
        policy,
      )
      if (!issued.ok) return { ok: false, error: issued.error }
      tempPassword = issued.password
      patch.password = await hashPassword(tempPassword)
      patch.mustChangePassword = true
      patch.tempPasswordIssuedAt = new Date().toISOString()
      patch.passwordResetToken = undefined
      patch.passwordResetExpires = undefined
    }

    setUsers((s) => s.map((u) => (u.id === target.id ? { ...u, ...patch } : u)))

    if (tempPassword) saveReveal(target.id, nextUsername, tempPassword)
    else {
      const live = loadReveal(target.id)
      if (live?.password) saveReveal(target.id, nextUsername, live.password)
    }

    const event: CredentialEvent = {
      id: uid('ce'),
      memberId: recordId,
      userId: target.id,
      adminId: input.adminId,
      adminName: input.adminName,
      action: 'regenerate',
      scope,
      usernameAfter: nextUsername,
      passwordChanged: changePassword,
      usernameChanged: changeUsername,
      channels: input.channels,
      deliveries: [],
      createdAt: new Date().toISOString(),
    }
    setCredentialEvents((s) => [event, ...s])
    log(
      input.adminId,
      'REGENERATE',
      'Credentials',
      `${input.adminName} regenerated ${scope} for ${who} ${target.name} (${nextUsername})${changePassword ? ` · password: ${input.passwordMode || credentialSettings.initialPasswordMode || 'auto'}` : ''}`,
    )
    setNotifications((s) => [{
      id: uid('nt'),
      userId: target.id,
      title: 'Login details updated',
      message: changePassword
        ? 'Your club issued a new temporary password. Sign in and choose a new one.'
        : 'Your FitPro username was updated. Use the new username at the next sign-in.',
      channel: 'in-app',
      read: false,
      createdAt: new Date().toISOString(),
    }, ...s])
    return {
      ok: true,
      event,
      username: nextUsername,
      tempPassword,
      passwordChanged: changePassword,
      usernameChanged: changeUsername,
    }
  }, [members, staff, users, credentialSettings.policy, credentialSettings.initialPasswordMode, setUsers, setCredentialEvents, log])

  const recordCredentialDelivery = useCallback((eventId: string, deliveries: CredentialDeliveryResult[]) => {
    setCredentialEvents((s) => s.map((e) => (e.id === eventId ? { ...e, deliveries } : e)))
    const summary = deliveries.map((d) => `${d.channel}:${d.status}`).join(', ')
    log('system', 'DELIVER', 'Credentials', summary || 'No channels')
  }, [setCredentialEvents, log])

  const appendCredentialEvent = useCallback((event: CredentialEvent) => {
    setCredentialEvents((s) => [event, ...s])
  }, [setCredentialEvents])

  const value = useMemo<AppStore>(
    () => ({
      users, members, trainers, staff, plans, memberships, payments, invoices, classes, bookings,
      attendance, workouts, progress, notifications, branches, leads, messages, audit, leaves, sessions, company,
      setCompany,
      credentialEvents,
      credentialSettings,
      setCredentialSettings,
      regenerateMemberCredentials,
      recordCredentialDelivery,
      appendCredentialEvent,
      patchUser,
      upsertUser: (u) => setUsers((s) => (s.some((x) => x.id === u.id) ? s.map((x) => (x.id === u.id ? u : x)) : [...s, u])),
      upsertMember: (m) => setMembers((s) => (s.some((x) => x.id === m.id) ? s.map((x) => (x.id === m.id ? m : x)) : [...s, m])),
      deleteMember: (id) => {
        setMembers((s) => s.filter((m) => m.id !== id))
                const u = members.find((m) => m.id === id)
        if (u) setUsers((s) => s.map((x) => (x.id === u.userId ? { ...x, status: 'inactive' } : x)))
      },
      upsertStaff: (st) => setStaff((s) => (s.some((x) => x.id === st.id) ? s.map((x) => (x.id === st.id ? st : x)) : [...s, st])),
      upsertTrainer: (t) => setTrainers((s) => (s.some((x) => x.id === t.id) ? s.map((x) => (x.id === t.id ? t : x)) : [...s, t])),
      upsertPlan: (p) => setPlans((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p])),
      deletePlan: (id) => setPlans((s) => s.filter((p) => p.id !== id)),
      upsertClass: (c) => setClasses((s) => (s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c])),
      deleteClass: (id) => setClasses((s) => s.filter((c) => c.id !== id)),
      upsertLead: (l) => setLeads((s) => (s.some((x) => x.id === l.id) ? s.map((x) => (x.id === l.id ? l : x)) : [...s, l])),
      deleteLead: (id) => setLeads((s) => s.filter((l) => l.id !== id)),
      upsertPayment: (p) => setPayments((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p])),
      upsertInvoice: (i) => setInvoices((s) => (s.some((x) => x.id === i.id) ? s.map((x) => (x.id === i.id ? i : x)) : [...s, i])),
      upsertMembership: (m) => setMemberships((s) => (s.some((x) => x.id === m.id) ? s.map((x) => (x.id === m.id ? m : x)) : [...s, m])),
      bookClass: (classId, memberId, date) => {
        const cl = classes.find((c) => c.id === classId)
        if (!cl) return { ok: false, status: 'cancelled', message: 'Class not found' }
        const exists = bookings.find((b) => b.classId === classId && b.memberId === memberId && b.date === date && b.status !== 'cancelled')
        if (exists) return { ok: false, status: exists.status, message: 'Already booked' }
        const full = cl.enrolled >= cl.capacity
        const status: Booking['status'] = full ? 'waitlist' : 'booked'
        setBookings((s) => [...s, { id: uid('bk'), classId, memberId, date, status }])
        setClasses((s) => s.map((c) => (c.id === classId ? { ...c, enrolled: full ? c.enrolled : c.enrolled + 1, waitlist: full ? c.waitlist + 1 : c.waitlist } : c)))
        return { ok: true, status, message: full ? 'Added to waitlist' : 'Booked' }
      },
      cancelBooking: (id) => {
        const bk = bookings.find((b) => b.id === id)
        setBookings((s) => s.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
        if (bk && bk.status === 'booked') {
          setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, enrolled: Math.max(0, c.enrolled - 1) } : c)))
        }
        if (bk && bk.status === 'waitlist') {
          setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, waitlist: Math.max(0, c.waitlist - 1) } : c)))
        }
      },
      checkIn: (memberId, branchId) => {
        const rec: Attendance = {
          id: uid('at'),
          memberId,
          type: 'checkin',
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          branchId,
        }
        setAttendance((s) => [rec, ...s])
        return rec
      },
      addProgress: (p) => setProgress((s) => [...s, p]),
      upsertWorkout: (w) => setWorkouts((s) => (s.some((x) => x.id === w.id) ? s.map((x) => (x.id === w.id ? w : x)) : [...s, w])),
      sendMessage: (m) => setMessages((s) => [...s, { ...m, id: uid('msg'), createdAt: new Date().toISOString(), read: false }]),
      markMessagesRead: (ids) => setMessages((s) => s.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m))),
      notify: (n) => setNotifications((s) => [{ ...n, id: uid('nt'), createdAt: new Date().toISOString(), read: false }, ...s]),
      markNotifRead: (id) => setNotifications((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllNotifRead: (userId) => setNotifications((s) => s.map((n) => (n.userId === userId ? { ...n, read: true } : n))),
      log,
      upsertLeave: (l) => setLeaves((s) => (s.some((x) => x.id === l.id) ? s.map((x) => (x.id === l.id ? l : x)) : [...s, l])),
      upsertSession: (s0) => setSessions((s) => (s.some((x) => x.id === s0.id) ? s.map((x) => (x.id === s0.id ? s0 : x)) : [...s, s0])),
      createMemberAccount,
      takeAttendance: (classId, memberId, present) => {
        setBookings((s) => s.map((b) => (b.classId === classId && b.memberId === memberId ? { ...b, status: present ? 'attended' : 'no-show' } : b)))
        if (present) {
          const cl = classes.find((c) => c.id === classId)
          setAttendance((s) => [
            {
              id: uid('at'),
              memberId,
              type: 'class',
              date: new Date().toISOString().slice(0, 10),
              time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              branchId: cl?.branchId || 'br_airport',
              classId,
            },
            ...s,
          ])
        }
      },
      refundPayment: (id) => {
        setPayments((s) => s.map((p) => (p.id === id ? { ...p, status: 'refunded' } : p)))
      },
      requestMembershipRenewal: (memberId) => {
        const member = members.find((x) => x.id === memberId)
        if (!member) return { ok: false, error: 'Member not found' }
        const ms = memberships.find((x) => x.id === member.membershipId)
        const plan = plans.find((p) => p.id === (ms?.planId || member.planId))
        if (!ms || !plan) return { ok: false, error: 'No active plan to renew' }

        const desc = `${plan.name} renewal`
        const existing = payments.find(
          (p) => p.memberId === memberId && p.description === desc && (p.status === 'pending' || p.status === 'failed'),
        )
        if (existing) return { ok: true, paymentId: existing.id, invoiceId: existing.invoiceId }

        const invoiceId = uid('inv')
        const paymentId = uid('pay')
        const today = new Date()
        const due = new Date()
        due.setDate(due.getDate() + 7)
        const number = `FP-${today.getFullYear()}-${String(invoices.length + 3000).padStart(4, '0')}`

        setInvoices((s) => [
          {
            id: invoiceId,
            memberId,
            number,
            items: [{ desc, amount: plan.price }],
            total: plan.price,
            status: 'unpaid',
            issuedAt: today.toISOString().slice(0, 10),
            dueAt: due.toISOString().slice(0, 10),
          },
          ...s,
        ])
        setPayments((s) => [
          {
            id: paymentId,
            memberId,
            amount: plan.price,
            method: isPaystackEnabled() ? 'paystack' : 'momo',
            status: 'pending',
            invoiceId,
            date: today.toISOString().slice(0, 10),
            description: desc,
          },
          ...s,
        ])
        return { ok: true, paymentId, invoiceId }
      },
      applyGatewayPayment: (input) => {
        let target: Payment | undefined
        let alreadyPaid = false
        setPayments((s) => {
          target = s.find((p) => p.id === input.paymentId)
            || (input.reference ? s.find((p) => p.reference === input.reference) : undefined)
          if (target?.status === 'paid') {
            alreadyPaid = true
            return s
          }
          if (target?.status === 'refunded') return s
          if (!target && input.memberId && input.amount) {
            const invoiceId = input.invoiceId || uid('inv')
            const paymentId = input.paymentId || uid('pay')
            target = {
              id: paymentId,
              memberId: input.memberId,
              amount: input.amount,
              method: input.method,
              status: input.autoSettle ? 'paid' : 'pending',
              invoiceId,
              date: new Date().toISOString().slice(0, 10),
              description: input.description || 'Paystack payment',
              reference: input.reference,
              gatewayRef: input.gatewayRef,
              gatewayChannel: input.gatewayChannel,
            }
            return [target, ...s]
          }
          if (!target) return s
          return s.map((p) => (p.id === target!.id ? {
            ...p,
            method: input.method,
            status: input.autoSettle ? 'paid' : (p.status === 'failed' ? 'pending' : p.status),
            reference: input.reference,
            gatewayRef: input.gatewayRef || p.gatewayRef,
            gatewayChannel: input.gatewayChannel || p.gatewayChannel,
          } : p))
        })
        if (!target) return { ok: false, error: 'Payment not found.' }
        if (target.status === 'refunded') return { ok: false, error: 'Refunded payments cannot be settled.' }
        if (alreadyPaid) return { ok: true, settled: true }
        if (input.autoSettle) {
          setInvoices((s) => {
            if (s.some((i) => i.id === target!.invoiceId)) {
              return s.map((i) => (i.id === target!.invoiceId ? { ...i, status: 'paid' } : i))
            }
            if (!input.memberId) return s
            const today = new Date().toISOString().slice(0, 10)
            return [{
              id: target!.invoiceId,
              memberId: input.memberId,
              number: `FP-${new Date().getFullYear()}-PS${String(s.length + 1).padStart(3, '0')}`,
              items: [{ desc: target!.description, amount: target!.amount }],
              total: target!.amount,
              status: 'paid',
              issuedAt: today,
              dueAt: today,
            }, ...s]
          })
          setMemberships((s) => {
            const member = members.find((x) => x.id === target!.memberId)
            const ms = s.find((x) => x.id === member?.membershipId)
            const plan = plans.find((p) => p.id === (ms?.planId || member?.planId))
            if (!ms || !plan || !/renew/i.test(target!.description)) return s
            const end = new Date(ms.endDate)
            const today = new Date()
            const base = end > today ? end : today
            base.setDate(base.getDate() + plan.durationDays)
            return s.map((x) => (x.id === ms.id ? { ...x, endDate: base.toISOString().slice(0, 10), status: 'active' } : x))
          })
          log('system', 'PAYSTACK', 'Payment', `${target.description} · ${input.reference} · ${input.gatewayChannel || 'paystack'}`)
        }
        return { ok: true, settled: input.autoSettle }
      },
      settlePayment: (paymentId) => {
        const payment = payments.find((p) => p.id === paymentId)
        if (!payment) return { ok: false, error: 'Payment not found' }
        if (payment.status === 'paid') return { ok: false, error: 'This payment is already settled' }
        if (payment.status === 'refunded') return { ok: false, error: 'Refunded payments cannot be settled' }

        setPayments((s) => s.map((p) => (p.id === paymentId ? { ...p, status: 'paid' } : p)))
        setInvoices((s) => s.map((i) => (i.id === payment.invoiceId ? { ...i, status: 'paid' } : i)))

        const member = members.find((x) => x.id === payment.memberId)
        const ms = memberships.find((x) => x.id === member?.membershipId)
        const plan = plans.find((p) => p.id === (ms?.planId || member?.planId))
        if (ms && plan && /renewal/i.test(payment.description)) {
          const end = new Date(ms.endDate)
          const today = new Date()
          const base = end > today ? end : today
          base.setDate(base.getDate() + plan.durationDays)
          setMemberships((s) =>
            s.map((x) => (x.id === ms.id ? { ...x, endDate: base.toISOString().slice(0, 10), status: 'active' } : x)),
          )
        }
        return { ok: true }
      },
      upsertBranch: (b) => setBranches((s) => (s.some((x) => x.id === b.id) ? s.map((x) => (x.id === b.id ? b : x)) : [...s, b])),
      deleteBranch: (id) => setBranches((s) => s.filter((b) => b.id !== id)),
    }),
    [
      users, members, trainers, staff, plans, memberships, payments, invoices, classes, bookings,
      attendance, workouts, progress, notifications, branches, leads, messages, audit, leaves, sessions, company,
      credentialEvents, credentialSettings, setCredentialSettings, regenerateMemberCredentials,
      recordCredentialDelivery, appendCredentialEvent, patchUser, log, createMemberAccount,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp')
  return v
}

export function useUserById(id?: string) {
  const { users } = useApp()
  return users.find((u) => u.id === id)
}

export function useMemberProfile(userId?: string) {
  const { members, users, memberships, plans } = useApp()
  const user = users.find((u) => u.id === userId)
  const member = members.find((m) => m.userId === userId)
  const membership = memberships.find((ms) => ms.id === member?.membershipId)
  const plan = plans.find((p) => p.id === (membership?.planId || member?.planId))
  return { user, member, membership, plan }
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role, User } from '../types'
import { useApp } from './AppContext'
import { emailError, isEmail } from '../lib/validate'
import { otp6 } from '../lib/utils'
import { clearReveal } from '../lib/credentials'
import { generateUsername, hashPassword, passwordPolicyError, takenUsernames, verifyPassword } from '../lib/password'

interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => Promise<{
    ok: boolean
    error?: string
    user?: User
    needsVerification?: boolean
    mustChangePassword?: boolean
    email?: string
  }>
  loginOAuth: (provider: 'google' | 'apple') => void
  logout: () => void
  register: (input: { name: string; email: string; password: string; phone: string; planId?: string }) => Promise<{
    ok: boolean
    error?: string
    needsVerification?: boolean
    email?: string
    code?: string
  }>
  verifyEmail: (code: string, email?: string) => { ok: boolean; error?: string }
  resendVerification: (email: string) => { ok: boolean; error?: string; code?: string }
  requestPasswordReset: (email: string) => { ok: boolean; error?: string; code?: string; email?: string }
  resetPassword: (email: string, code: string, password: string) => Promise<{ ok: boolean; error?: string }>
  completePasswordChange: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>
  hasRole: (...roles: Role[]) => boolean
  impersonate: (userId: string) => void
  impersonating: boolean
}

const Ctx = createContext<AuthCtx | null>(null)
const KEY = 'fitpro_session'
const IMPERSONATOR_KEY = 'fitpro_impersonator'

export function AuthProvider({ children }: { children: ReactNode }) {
  const app = useApp()
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(KEY))
  const [impersonatorId, setImpersonatorId] = useState<string | null>(() => localStorage.getItem(IMPERSONATOR_KEY))

  const user = useMemo(() => app.users.find((u) => u.id === userId) ?? null, [app.users, userId])

  const setSession = (id: string | null) => {
    setUserId(id)
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  }

  const validationOn = !!app.company.emailLoginValidation
  const policy = app.credentialSettings.policy

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      impersonating: !!impersonatorId,
      login: async (ident, password) => {
        const key = ident.trim().toLowerCase()
        if (!key) return { ok: false, error: 'Enter your email or username.' }
        if (validationOn && key.includes('@')) {
          const format = emailError(ident)
          if (format) return { ok: false, error: format }
        }
        const found = app.users.find((u) => {
          const email = u.email.toLowerCase()
          const username = (u.username || u.email.split('@')[0]).toLowerCase()
          return email === key || username === key
        })
        if (!found) return { ok: false, error: 'Invalid email or password.' }
        const match = await verifyPassword(found.password, password)
        if (!match) return { ok: false, error: 'Invalid email or password.' }
        if (found.status === 'suspended') return { ok: false, error: 'This account is suspended. Contact the club.' }
        if (found.emailVerified === false) {
          return {
            ok: false,
            needsVerification: true,
            email: found.email,
            error: 'Please verify your email before signing in. Enter the 6-digit code we sent.',
          }
        }
        app.patchUser(found.id, { lastLogin: new Date().toISOString() })
        app.log(found.id, 'LOGIN', 'Auth', found.mustChangePassword ? 'Password login — change required' : 'Password login')
        localStorage.removeItem(IMPERSONATOR_KEY)
        setImpersonatorId(null)
        setSession(found.id)
        return { ok: true, user: found, mustChangePassword: !!found.mustChangePassword }
      },
      loginOAuth: (provider) => {
        const found = app.users.find((u) => u.role === 'member')
        if (!found) return
        app.log(found.id, 'LOGIN', 'Auth', `OAuth ${provider}`)
        localStorage.removeItem(IMPERSONATOR_KEY)
        setImpersonatorId(null)
        setSession(found.id)
      },
      logout: () => {
        localStorage.removeItem(IMPERSONATOR_KEY)
        setImpersonatorId(null)
        setSession(null)
      },
      register: async ({ name, email, password, phone, planId }) => {
        const format = emailError(email)
        if (format) return { ok: false, error: format }
        if (!isEmail(email)) return { ok: false, error: 'Enter a valid email address, like name@example.com.' }
        if (app.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
          return { ok: false, error: 'An account with that email already exists.' }
        }
        if (!name.trim() || name.trim().length < 2) return { ok: false, error: 'Enter your full name.' }
        if (password.trim().length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }

        const needsVerification = true
        const code = otp6()
        const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
        const hashed = await hashPassword(password)
        const username = generateUsername(name.trim() || email.split('@')[0], takenUsernames(app.users))
        const created = app.createMemberAccount({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: hashed,
          phone,
          planId,
          status: 'inactive',
          emailVerified: false,
          emailVerifyToken: code,
          emailVerifyExpires: expires,
          username,
          mustChangePassword: false,
        })
        app.log(created.userId, 'CREATE', 'Auth', 'Registered — pending email code')
        app.notify({
          userId: created.userId,
          title: 'Verify your email',
          message: `We sent a 6-digit code to ${email.trim()}.`,
          channel: 'email',
        })
        return { ok: true, needsVerification, email: email.trim().toLowerCase(), code }
      },
      verifyEmail: (code, email) => {
        const c = code.replace(/\D/g, '')
        if (c.length !== 6) return { ok: false, error: 'Enter the 6-digit code from your email.' }
        const found = app.users.find((u) => {
          if (!u.emailVerifyToken || u.emailVerifyToken !== c) return false
          if (email && u.email.toLowerCase() !== email.trim().toLowerCase()) return false
          return true
        })
        if (!found) return { ok: false, error: 'That code is incorrect or has expired.' }
        if (found.emailVerifyExpires && new Date(found.emailVerifyExpires).getTime() < Date.now()) {
          return { ok: false, error: 'This code has expired. Tap Resend for a new one.' }
        }
        app.patchUser(found.id, { emailVerified: true, status: 'active', emailVerifyToken: undefined, emailVerifyExpires: undefined })
        app.log(found.id, 'VERIFY', 'Auth', 'Email confirmed with code')
        setSession(found.id)
        return { ok: true }
      },
      resendVerification: (email) => {
        const found = app.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!found) return { ok: false, error: 'No account uses that email.' }
        if (found.emailVerified !== false) return { ok: false, error: 'This email is already verified.' }
        const code = otp6()
        app.patchUser(found.id, { emailVerifyToken: code, emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
        app.notify({
          userId: found.id,
          title: 'Verify your email',
          message: `A new 6-digit code was sent to ${found.email}.`,
          channel: 'email',
        })
        return { ok: true, code }
      },
      requestPasswordReset: (email) => {
        const found = app.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!found) return { ok: false, error: 'No account uses that email.' }
        const code = otp6()
        app.patchUser(found.id, {
          passwordResetToken: code,
          passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        app.log(found.id, 'RESET', 'Auth', 'Password reset code issued')
        return { ok: true, code, email: found.email }
      },
      resetPassword: async (email, code, password) => {
        const c = code.replace(/\D/g, '')
        if (c.length !== 6) return { ok: false, error: 'Enter the 6-digit code from your email.' }
        const policyErr = passwordPolicyError(password, policy)
        if (policyErr) return { ok: false, error: policyErr }
        const found = app.users.find((u) => {
          if (!u.passwordResetToken || u.passwordResetToken !== c) return false
          if (email && u.email.toLowerCase() !== email.trim().toLowerCase()) return false
          return true
        })
        if (!found) return { ok: false, error: 'That code is incorrect or has expired.' }
        if (found.passwordResetExpires && new Date(found.passwordResetExpires).getTime() < Date.now()) {
          return { ok: false, error: 'This code has expired. Request a new one.' }
        }
        const hashed = await hashPassword(password)
        app.patchUser(found.id, {
          password: hashed,
          passwordResetToken: undefined,
          passwordResetExpires: undefined,
          mustChangePassword: false,
          passwordChangedAt: new Date().toISOString(),
          tempPasswordIssuedAt: undefined,
        })
        clearReveal(found.id)
        app.log(found.id, 'PASSWORD', 'Auth', 'Password reset with email code')
        return { ok: true }
      },
      completePasswordChange: async (current, next) => {
        if (!user) return { ok: false, error: 'Not signed in.' }
        if (!(await verifyPassword(user.password, current))) return { ok: false, error: 'Current password is incorrect.' }
        if (current === next) return { ok: false, error: 'Choose a new password that is different from the temporary one.' }
        const policyErr = passwordPolicyError(next, policy)
        if (policyErr) return { ok: false, error: policyErr }
        const hashed = await hashPassword(next)
        app.patchUser(user.id, {
          password: hashed,
          mustChangePassword: false,
          passwordChangedAt: new Date().toISOString(),
          tempPasswordIssuedAt: undefined,
        })
        clearReveal(user.id)
        app.log(user.id, 'PASSWORD', 'Auth', 'Temporary password replaced')
        return { ok: true }
      },
      hasRole: (...roles) => !!user && roles.includes(user.role),
      impersonate: (id) => {
        if (user) {
          localStorage.setItem(IMPERSONATOR_KEY, user.id)
          setImpersonatorId(user.id)
          app.log(user.id, 'IMPERSONATE', 'Auth', `Switched into ${id}`)
        }
        setSession(id)
      },
    }),
    [user, app, validationOn, policy, impersonatorId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth')
  return v
}

export function roleHome(role: Role) {
  if (role === 'member') return '/app'
  if (role === 'trainer') return '/coach'
  return '/admin'
}

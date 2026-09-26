// ---------------------------------------------------------------------------
// Company provisioning — the single "Create Company" flow.
//
// Creating a company also provisions its Main Branch and a Company Admin
// account, so a new tenant is usable from day one. Everything here is pure:
// the record builders, the validation rules, and the welcome-email copy.
// Side effects (persisting, hashing, sending mail, auditing) live in
// AppContext's `createCompanyWithAdmin`.
// ---------------------------------------------------------------------------

import type { Branch, Company, PasswordPolicy, User } from '../types'
import { DEFAULT_COMPANY_ID, nextCompanyId } from './companies'
import { emailTaken, normalizeEmail, validateEmailAddress } from './email'
import { generateTempPassword, generateUsername, takenUsernames } from './password'
import { portalLoginUrl } from './credentials'

/** Name given to the branch auto-created alongside every new company. */
export const MAIN_BRANCH_NAME = 'Main Branch'

export type CompanySetupInput = {
  companyName: string
  legalName?: string
  /** Company Admin full name — required. */
  adminName: string
  /** Company Admin email — required, unique system-wide. */
  adminEmail: string
  /** Company contact details (optional but carried onto the company record). */
  companyEmail?: string
  companyPhone?: string
  address?: string
  city?: string
  country?: string
  currency?: string
  currencySymbol?: string
  timezone?: string
  brandPrimary?: string
  /** Super Admin may set the initial password instead of auto-generating one. */
  tempPassword?: string
  passwordPolicy?: PasswordPolicy
  /** Login URL, injectable so tests do not depend on `window`. */
  loginUrl?: string
}

export type CompanySetupErrors = {
  companyName?: string
  adminName?: string
  adminEmail?: string
  tempPassword?: string
}

export type CompanySetupIds = {
  companyId: string
  branchId: string
  userId: string
  username: string
}

/**
 * Requirement 7 — validation rules.
 *
 * Company Admin name and email are required, the email must be well formed and
 * unique across every user in the system, and duplicate company records are
 * rejected on both name and contact email.
 */
export function validateCompanySetup(
  input: CompanySetupInput,
  ctx: { companies: Company[]; users: User[] },
): CompanySetupErrors {
  const errors: CompanySetupErrors = {}

  const companyName = input.companyName.trim()
  if (companyName.length < 2) errors.companyName = 'Company name is required.'

  if (!input.adminName.trim()) errors.adminName = 'Company Admin name is required.'

  const emailCheck = validateEmailAddress(input.adminEmail)
  if (!emailCheck.ok) {
    errors.adminEmail = emailCheck.error
  } else if (emailTaken(emailCheck.email, ctx.users.map((u) => u.email))) {
    errors.adminEmail = 'An account with that email already exists. Use a different address.'
  }

  // Duplicate company guard — name is the configured business rule; the contact
  // email is checked too so the same tenant cannot be registered twice.
  if (companyName.length >= 2) {
    const sameName = ctx.companies.some((c) => c.name.trim().toLowerCase() === companyName.toLowerCase())
    if (sameName) errors.companyName = 'A company with that name already exists.'
  }
  const companyEmail = input.companyEmail?.trim()
  if (companyEmail && validateEmailAddress(companyEmail).ok) {
    const sameEmail = ctx.companies.some(
      (c) => normalizeEmail(c.email || '') === normalizeEmail(companyEmail),
    )
    if (sameEmail && !errors.companyName) errors.companyName = 'A company with that contact email already exists.'
  }

  if (input.tempPassword !== undefined && input.tempPassword.trim() === '') {
    errors.tempPassword = 'Leave blank to auto-generate, or enter a password.'
  }

  return errors
}

/** Pre-allocate every identifier so the three records can reference each other. */
export function allocateCompanySetupIds(
  input: CompanySetupInput,
  users: User[],
): CompanySetupIds {
  const username = generateUsername(input.adminName || input.adminEmail, takenUsernames(users))
  return {
    companyId: nextCompanyId(),
    branchId: `br_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    userId: `u_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    username,
  }
}

export function buildCompany(input: CompanySetupInput, ids: CompanySetupIds, createdAt: string): Company {
  const name = input.companyName.trim()
  return {
    id: ids.companyId,
    name,
    legalName: input.legalName?.trim() || undefined,
    email: input.companyEmail?.trim() || input.adminEmail.trim(),
    phone: input.companyPhone?.trim() || '',
    address: input.address?.trim() || '',
    country: input.country?.trim() || 'Ghana',
    currency: input.currency || 'GHS',
    currencySymbol: input.currencySymbol || '₵',
    timezone: input.timezone || 'Africa/Accra',
    brandPrimary: input.brandPrimary || '#C8F542',
    logoText: name,
    status: 'active',
    createdAt,
  }
}

/** Requirement 2 — the Main Branch, owned by the new company and marked primary. */
export function buildMainBranch(input: CompanySetupInput, ids: CompanySetupIds): Branch {
  return {
    id: ids.branchId,
    companyId: ids.companyId,
    name: MAIN_BRANCH_NAME,
    address: input.address?.trim() || `${input.companyName.trim()} — Main Branch`,
    city: input.city?.trim() || '',
    phone: input.companyPhone?.trim() || '',
    managerId: ids.userId,
    members: 0,
    capacity: 0,
    hours: '05:00 – 23:00',
    status: 'active',
    isPrimary: true,
    code: 'MAIN',
  }
}

/**
 * Requirement 3 — the Company Admin account, linked to the new company and its
 * Main Branch. `password` must already be hashed by the caller.
 */
export function buildCompanyAdminUser(
  input: CompanySetupInput,
  ids: CompanySetupIds,
  hashedPassword: string,
  createdAt: string,
): User {
  return {
    id: ids.userId,
    companyId: ids.companyId,
    branchId: ids.branchId,
    email: input.adminEmail.trim(),
    username: ids.username,
    password: hashedPassword,
    name: input.adminName.trim(),
    role: 'company_admin',
    phone: input.companyPhone?.trim() || '',
    status: 'active',
    createdAt,
    // Requirement 5 — the Company Admin must replace the temporary password.
    mustChangePassword: true,
    tempPasswordIssuedAt: createdAt,
  }
}

/** The initial password: whatever the Super Admin typed, or a generated one. */
export function resolveTempPassword(input: CompanySetupInput): string {
  const supplied = input.tempPassword?.trim()
  return supplied || generateTempPassword(input.passwordPolicy)
}

// ---------------------------------------------------------------------------
// Requirement 4 — welcome email. Deliberately carries NO password: it is shown
// to the Super Admin on screen only, and passed on out of band.
// ---------------------------------------------------------------------------

export function companyAdminWelcomeSubject(companyName: string): string {
  return `Welcome to ${companyName} — your Company Admin account is ready`
}

export function companyAdminWelcomeBody(input: {
  adminName: string
  companyName: string
  username: string
  email: string
  loginUrl?: string
}): string {
  const firstName = input.adminName.trim().split(/\s+/)[0] || 'there'
  return `Hi ${firstName},

Welcome to ${input.companyName}. Your Company Admin account has been created and you are ready to go.

Account details
Company: ${input.companyName}
Username: ${input.username}
Email: ${input.email}
Login: ${input.loginUrl || portalLoginUrl()}

Getting started
1. Open the login link above.
2. Sign in with your username or email address and the temporary password your administrator will share with you separately.
3. You will be asked to choose a new password before you can continue.
4. From the dashboard you can manage your branches, members, staff, inventory and finances.

For security, your password is never sent by email. If you did not receive it, contact the person who set up your account.

— The FitPro team`
}

/** Convenience: the whole payload the mailer needs. */
export function buildCompanyAdminWelcomeEmail(
  input: CompanySetupInput,
  ids: CompanySetupIds,
): { to: string; subject: string; body: string } {
  return {
    to: input.adminEmail.trim(),
    subject: companyAdminWelcomeSubject(input.companyName.trim()),
    body: companyAdminWelcomeBody({
      adminName: input.adminName,
      companyName: input.companyName.trim(),
      username: ids.username,
      email: input.adminEmail.trim(),
      loginUrl: input.loginUrl,
    }),
  }
}

/** Re-exported so callers do not have to import two modules. */
export { DEFAULT_COMPANY_ID }

/** Outcome of the single-step "Create Company" flow. */
export type CompanyProvisionResult =
  | {
      ok: true
      company: Company
      branch: Branch
      admin: User
      /** Shown to the Super Admin once, on screen. Never emailed. */
      tempPassword: string
      username: string
      /** Whether the welcome email actually left the building. */
      email: { attempted: boolean; delivered: boolean; error?: string }
    }
  | { ok: false; error: string; errors?: CompanySetupErrors }

// FitPro shared domain types — reconstructed from the seed data and store usage.

export type Lang = 'en' | 'fr' | 'tw'
export type BuiltinRole = 'super_admin' | 'gym_manager' | 'company_admin' | 'branch_admin' | 'receptionist' | 'head_office' | 'trainer' | 'staff' | 'member' | 'customer' | 'supplier'
// Custom roles are identified by a string id (e.g. "role_receptionist").
export type Role = BuiltinRole | string

export type Status = 'active' | 'inactive' | 'suspended'
export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'frozen'
export type LeadStatus = 'new' | 'contacted' | 'trial' | 'converted' | 'lost'
export type PaymentMethod = 'momo' | 'cash' | 'card' | 'stripe' | 'paypal' | 'paystack' | 'payaza' | 'flutterwave' | 'hubtel'
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded' | 'cancelled'
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue' | 'cancelled'

export interface User {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  email: string
  password: string
  name: string
  role: Role
  avatar?: string
  phone: string
  branchId?: string
  status: Status
  createdAt: string
  lastLogin?: string
  username?: string
  credentialsRegeneratedBy?: string
  credentialsRegeneratedAt?: string
  emailVerified?: boolean
  emailVerifyToken?: string
  emailVerifyExpires?: string
  passwordResetToken?: string
  passwordResetExpires?: string
  mustChangePassword?: boolean
  passwordChangedAt?: string
  tempPasswordIssuedAt?: string
}

export interface EmergencyContact {
  name: string
  phone: string
  relation: string
}

export interface Member {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  userId: string
  membershipId?: string
  planId: string
  joinDate: string
  emergency: EmergencyContact
  medicalNotes: string
  tags: string[]
  goals: string[]
  heightCm: number
  weightKg: number
  dob: string
  gender: 'female' | 'male' | 'other'
  address: string
  qrCode: string
  trainerId?: string
  /** Values for admin-defined custom fields (keyed by custom field id). */
  customFields?: CustomFieldValues
}

export interface Trainer {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  userId: string
  specialties: string[]
  certifications: string[]
  experienceYears: number
  bio: string
  hourlyRate: number
  rating: number
  clientsCount: number
  photo?: string
  /** Whether this trainer is displayed on the public site ("floor staff"). */
  showOnWebsite?: boolean
}

export interface StaffRecord {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  userId: string
  department: string
  salary: number
  hireDate: string
  leaveBalance: number
  title: string
  /** Whether this staff member is displayed on the public site ("floor staff"). */
  showOnWebsite?: boolean
  /** Values for admin-defined custom fields (keyed by custom field id). */
  customFields?: CustomFieldValues
}

export interface Plan {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  type: string
  price: number
  durationDays: number
  popular?: boolean
  active: boolean
  color?: string
  features: string[]
}

export interface Membership {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  memberId: string
  planId: string
  startDate: string
  endDate: string
  status: MembershipStatus
  autoRenew: boolean
  branchId?: string
}

export interface Payment {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  memberId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  invoiceId: string
  date: string
  description: string
  reference?: string
  gatewayRef?: string
  gatewayChannel?: string
  planId?: string
}

export interface InvoiceItem {
  desc: string
  amount: number
  qty?: number
  unitPrice?: number
}

export interface Invoice {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  memberId?: string
  customerName?: string
  saleId?: string
  number: string
  items: InvoiceItem[]
  total: number
  status: InvoiceStatus
  issuedAt: string
  dueAt: string
}

export interface GymClass {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  category: string
  trainerId: string
  branchId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  capacity: number
  enrolled: number
  waitlist: number
  room: string
  level: string
  image?: string
  description: string
}

export type BookingStatus = 'booked' | 'waitlist' | 'attended' | 'cancelled' | 'no-show'

export interface Booking {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  classId: string
  memberId: string
  date: string
  status: BookingStatus
}

export type AttendanceType = 'checkin' | 'class' | 'pt'

export interface Attendance {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  memberId: string
  type: AttendanceType
  date: string
  time: string
  branchId: string
  classId?: string
}

export interface Exercise {
  name: string
  sets: number
  reps: string
  notes?: string
}

export interface WorkoutPlan {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  memberId: string
  trainerId: string
  name: string
  startDate: string
  status: 'draft' | 'active' | 'archived'
  notes?: string
  exercises: Exercise[]
}

export interface ProgressLog {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  memberId: string
  date: string
  weight: number
  bodyFat?: number
  waist?: number
  chest?: number
  hips?: number
  arms?: number
  notes?: string
}

export type NotificationChannel = 'in-app' | 'push' | 'email' | 'sms'

export interface NotificationItem {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  userId: string
  title: string
  message: string
  channel: NotificationChannel
  read: boolean
  createdAt: string
}

export interface Branch {
  id: string
  /** Owning tenant company. Falls back to the default company for legacy data. */
  companyId?: string
  name: string
  address: string
  city: string
  phone: string
  managerId: string
  members: number
  capacity: number
  hours: string
  lat?: number
  lng?: number
  status?: 'active' | 'inactive'
  code?: string
}

/**
 * A tenant company in the multi-company platform. Each company owns isolated
 * branches, users, settings, reports and configurations.
 */
export interface Company {
  id: string
  name: string
  legalName?: string
  email: string
  phone: string
  whatsapp?: string
  address: string
  digitalAddress?: string
  country?: string
  stateRegion?: string
  location?: string
  taxId?: string
  currency: string
  currencySymbol?: string
  timezone: string
  brandPrimary: string
  buttonPrimary?: string
  logoText?: string
  webAddress?: string
  status: 'active' | 'inactive'
  isDefault?: boolean
  createdAt: string
}

/** The active product edition — classic FitPro vs multi-company Advance FitPro. */
export type ProductMode = 'fitpro' | 'advance'

export interface Lead {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  name: string
  email: string
  phone: string
  source: string
  status: LeadStatus
  notes?: string
  createdAt: string
  interest?: string
  /** Values for admin-defined custom fields (keyed by custom field id). */
  customFields?: CustomFieldValues
}

export interface Message {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  fromId: string
  toId: string
  body: string
  createdAt: string
  read: boolean
}

export interface AuditLog {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  userId: string
  action: string
  entity: string
  details: string
  createdAt: string
}

export interface LeaveRequest {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  staffUserId: string
  from: string
  to: string
  type: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
}

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show'

export interface SessionBooking {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  trainerId: string
  memberId: string
  date: string
  time: string
  status: SessionStatus
  notes?: string
}

export interface BlogPost {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  date: string
  image?: string
  readMins?: number
  body: string
}

export interface Testimonial {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  role: string
  quote: string
  rating: number
  avatar?: string
  result?: string
}

/** A document-type number prefix (e.g. invoice → "INV-"). */
export interface NumberPrefix {
  key: string
  label: string
  prefix: string
}

/** Automated (cron) task configuration. */
export interface CronSettings {
  enabled: boolean
  /** Run interval in minutes (1, 5, 15, 30, 60). */
  intervalMinutes: number
  /** Activity-log retention in months (0 = keep forever). */
  activityLogRetentionMonths: number
  /** Notification-log retention in months (0 = keep forever). */
  notificationRetentionMonths: number
  /** Auto-renew memberships that are about to expire. */
  autoRenew: boolean
  /** Send renewal reminders N days before expiry. */
  renewalReminderDays: number
  /** Send overdue payment reminders after N days. */
  overdueReminderDays: number
  /** Send a daily summary report to admins. */
  dailyReport: boolean
}

export type PrintHeaderType = 'image' | 'text'

/** Header/footer that appears on every printed document. */
export interface PrintHeaderSettings {
  headerType: PrintHeaderType
  /** Data URL of the uploaded header image (2230×300 recommended). */
  headerImage?: string
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyWebsite: string
  taxId?: string
  /** Rich-text (HTML) footer content. */
  footerContent: string
  updatedBy?: string
  updatedAt?: string
}

export type CustomFieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date'

/** An admin-defined custom field that appears on a specific module's form. */
export interface CustomField {
  id: string
  name: string
  type: CustomFieldType
  /** Module/entity the field applies to (member, customer, lead, …). */
  module: string
  required: boolean
  /** Comma-separated options for the select type. */
  options?: string[]
}

/** Custom-field values stored on a record, keyed by custom field id. */
export type CustomFieldValues = Record<string, string>

export interface CompanySettings {
  name: string
  legalName?: string
  email: string
  phone: string
  whatsapp?: string
  address: string
  /** GhanaPost-style digital address, e.g. "GP/BBK23089". */
  digitalAddress?: string
  /** Country the company operates from, e.g. "Ghana". */
  country?: string
  /** State or region within the country, e.g. "Greater Accra". */
  stateRegion?: string
  /** City / town location, e.g. "Accra". */
  location?: string
  taxId?: string
  currency: string
  currencySymbol?: string
  timezone: string
  /** Date format, e.g. "dd-mm-yyyy". */
  dateFormat?: string
  /** Time format, e.g. "12 hours". */
  timeFormat?: string
  /** Start day of the week, e.g. "Monday". */
  startDayOfWeek?: string
  /** Days treated as the weekend, e.g. ["Saturday", "Sunday"]. */
  weekends?: string[]
  /** Default UI language for the company. */
  defaultLanguage?: Lang
  /** Session "remember me" duration in minutes. */
  rememberMeMinutes?: number
  /** Company website URL. */
  webAddress?: string
  /** Footer: copyright holder / brand name (defaults to the company name). */
  footerBrand?: string
  /** Footer: URL the footer brand links to (defaults to webAddress). */
  footerUrl?: string
  brandPrimary: string
  buttonPrimary?: string
  logoText?: string
  /** Company logo image (data URL), used in the sidebar / login / documents. */
  logoImage?: string
  languages?: Lang[]
  emailLoginValidation?: boolean
  /** Which scannable code to show on the member card. */
  cardCodeFormat?: 'qr' | 'barcode' | 'both'
  /** true = sidebar is pinned and scrolls independently; false = scrolls with the page. */
  sidebarSticky?: boolean
  /** Custom sidebar background colour (overrides the light/dark default). */
  sidebarColor?: string
  /** Custom top header background colour. */
  headerColor?: string
  /** Show a page preloader on navigation (toggle in Appearance settings). */
  preloaderEnabled?: boolean
  /** Document number prefixes (Prefixes settings). */
  prefixes?: NumberPrefix[]
  /** Google reCAPTCHA settings. */
  captchaEnabled?: boolean
  captchaSiteKey?: string
  captchaSecretKey?: string
  /** Allowed file extensions for uploads (e.g. ".pdf"). */
  allowedFileTypes?: string[]
  /** Automated (cron) task configuration. */
  cron?: CronSettings
  /** Print header/footer configuration for documents. */
  printHeader?: PrintHeaderSettings
  /** Maintenance-mode configuration. */
  maintenanceMode?: boolean
  maintenanceMessage?: string
  /** Public website (frontend CMS) content. */
  frontendCms?: FrontendCmsSettings
}

/** Public website content managed from the admin (frontend CMS). */
export interface FrontendCmsSettings {
  heroHeadline: string
  heroHighlight: string
  heroSubheadline: string
  heroCtaText: string
  heroImage?: string
  aboutTitle: string
  aboutBody: string
  socialFacebook?: string
  socialInstagram?: string
  socialTwitter?: string
  socialYoutube?: string
  seoTitle?: string
  seoDescription?: string
}

/**
 * Configuration keys a branch is permitted to override from the company
 * (global) settings. Everything else is inherited and locked at company level.
 */
export type BranchOverridableKey =
  | 'address'
  | 'country'
  | 'stateRegion'
  | 'location'
  | 'phone'
  | 'whatsapp'
  | 'timezone'
  | 'dateFormat'
  | 'timeFormat'
  | 'startDayOfWeek'
  | 'weekends'
  | 'defaultLanguage'
  | 'cardCodeFormat'
  | 'sidebarColor'
  | 'headerColor'

/**
 * A currency enabled for a specific branch (Symbol / Status / Action list).
 */
export interface BranchCurrency {
  code: string
  symbol: string
  name?: string
  /** Exactly one currency is the base currency; the rest are alternates. */
  status: 'base' | 'alternate'
}

/**
 * A tax rate configured for a specific branch.
 */
export interface BranchTax {
  name: string
  rate: number
  status: 'active' | 'inactive'
}

/**
 * A per-branch settings override record. Only {@link BranchOverridableKey}s
 * may be overridden; all other settings are inherited from the company.
 */
export interface BranchSettings {
  branchId: string
  companyId?: string
  overrides: Partial<Pick<CompanySettings, BranchOverridableKey>>
  /** Branch-local currency list (defaults to the standard set when empty). */
  currencies?: BranchCurrency[]
  /** Branch-local tax rates. */
  taxRates?: BranchTax[]
  /** Branch-local print header (falls back to the company print header). */
  printHeader?: PrintHeaderSettings
  updatedAt?: string
  updatedBy?: string
}

// ---- Credentials / password policy ----

export interface PasswordPolicy {
  minLength: number
  requireUpper: boolean
  requireLower: boolean
  requireNumber: boolean
  requireSpecial: boolean
}

export type InitialPasswordMode = 'auto' | 'phone'

export interface CredentialTemplates {
  emailSubject: string
  emailBody: string
  whatsappBody: string
  smsBody: string
}

export interface MessagingConfig {
  whatsappMode: 'link' | 'cloud' | 'webhook'
  whatsappPhoneNumberId: string
  whatsappToken: string
  whatsappWebhookUrl: string
  smsMode: 'link' | 'hubtel' | 'webhook'
  smsWebhookUrl: string
  hubtelClientId: string
  hubtelClientSecret: string
  hubtelFrom: string
  supportPhone: string
  supportEmail: string
}

export interface CredentialSettings {
  policy: PasswordPolicy
  templates: CredentialTemplates
  messaging: MessagingConfig
  initialPasswordMode: InitialPasswordMode
}

export type CredentialScope = 'password' | 'username' | 'both'
export type CredentialChannel = 'email' | 'whatsapp' | 'sms'

export interface CredentialDeliveryResult {
  channel: CredentialChannel
  status: 'sent' | 'opened' | 'failed'
  at: string
  error?: string
}

export interface CredentialEvent {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  memberId?: string
  userId: string
  adminId: string
  adminName: string
  action: 'regenerate' | 'resend'
  scope: CredentialScope
  usernameAfter: string
  passwordChanged: boolean
  usernameChanged: boolean
  channels: CredentialChannel[]
  deliveries: CredentialDeliveryResult[]
  createdAt: string
}

export interface CredentialVars {
  name: string
  username: string
  password: string
  portalUrl: string
  supportPhone: string
  supportEmail: string
  clubName: string
}

// ---- Payments gateway ----

export interface GatewayPaymentInput {
  paymentId?: string
  reference?: string
  memberId?: string
  amount?: number
  method: PaymentMethod
  autoSettle?: boolean
  invoiceId?: string
  description?: string
  gatewayRef?: string
  gatewayChannel?: string
}

// ---- Integrations ----

export type IntegrationCategory =
  | 'communication'
  | 'payments'
  | 'auth'
  | 'storage'
  | 'analytics'
  | 'social'
  | 'api'

export type IntegrationHealth = 'online' | 'offline' | 'pending' | 'error'

export interface IntegrationConfig {
  apiKey: string
  secretKey: string
  accessToken: string
  webhookUrl: string
  callbackUrl: string
  username: string
  password: string
  environment: 'sandbox' | 'production'
  syncFrequency: string
  retryAttempts: number
  timeoutMs: number
  notifyOnFail: boolean
  extra: Record<string, string>
}

export interface IntegrationRecord {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  provider: string
  description: string
  category: IntegrationCategory
  version?: string
  critical?: boolean
  active: boolean
  connected: boolean
  health: IntegrationHealth
  apiStatus: string
  lastSyncAt?: string
  lastSuccessAt?: string
  lastHealthCheckAt?: string
  lastTestMs?: number
  lastTestResult?: string
  lastFailedAt?: string
  createdAt: string
  updatedAt: string
  config: IntegrationConfig
}

export interface IntegrationLog {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  integrationId: string
  integrationName: string
  adminId: string
  adminName: string
  action: string
  status: 'success' | 'info' | 'error' | 'failed'
  details: string
  createdAt: string
}

// ---- Roles & permissions ----

export interface Permission {
  key: string
  label: string
  group: string
  description?: string
  builtin?: boolean
}

export interface RoleDef {
  id: string
  name: string
  description?: string
  portal: 'admin' | 'coach' | 'member' | 'customer' | 'supplier'
  permissions: string[]
  builtin?: boolean
  color?: string
}

// ---- Payment gateway settings ----

export interface PaymentSettings {
  /** Online gateways the club accepts (subset of the catalogue). */
  enabledGateways: PaymentMethod[]
  /** The gateway pre-selected for new payments. */
  defaultGateway: PaymentMethod
  /** Whether cash / card-at-desk manual collection is enabled. */
  allowManual: boolean
}

// ---- Inventory ----

// Categories are user-managed (admin can add/edit); a plain string id/name.
export type InventoryCategory = string

export interface InventoryItem {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  sku: string
  category: InventoryCategory
  quantity: number
  reorderPoint: number
  unit: string
  costPrice: number
  sellPrice: number
  supplierId?: string
  branchId?: string
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  contact: string
  email: string
  phone: string
  /** Supplier category (managed in Supplier Categories). */
  category?: string
  /** Linked portal user account (when login access is granted). */
  userId?: string
  /** Values for admin-defined custom fields (keyed by custom field id). */
  customFields?: CustomFieldValues
}

export type StockMovementType = 'in' | 'out' | 'adjust'

export interface StockTransaction {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  itemId: string
  type: StockMovementType
  quantity: number // positive = received, negative = issued
  reason: string
  userId: string
  createdAt: string
}

export type PurchaseStatus = 'received' | 'ordered' | 'paid'

export interface PurchaseLine {
  itemId: string
  quantity: number
  unitCost: number
}

export interface Purchase {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  supplierId: string
  lines: PurchaseLine[]
  total: number
  status: PurchaseStatus
  notes?: string
  userId: string
  /** Transaction date (YYYY-MM-DD), selectable by the user. */
  date: string
  createdAt: string
}

export type SaleStatus = 'completed' | 'refunded'

export interface SaleLine {
  itemId: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  memberId?: string
  customerName?: string
  lines: SaleLine[]
  total: number
  method: PaymentMethod
  status: SaleStatus
  userId: string
  /** Transaction date (YYYY-MM-DD), selectable by the user. */
  date: string
  invoiceId?: string
  createdAt: string
}

// ---- Proposals & Estimates (pre-sale quote documents) ----

export type DocStatus = 'draft' | 'sent' | 'accepted' | 'declined'

export interface Proposal {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  memberId?: string
  customerName?: string
  items: InvoiceItem[]
  total: number
  status: DocStatus
  notes?: string
  /** Issue date (YYYY-MM-DD). */
  date: string
  /** Valid-until date (YYYY-MM-DD), optional. */
  validUntil?: string
  createdAt: string
}

export interface Estimate {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  memberId?: string
  customerName?: string
  items: InvoiceItem[]
  total: number
  status: DocStatus
  notes?: string
  date: string
  validUntil?: string
  createdAt: string
}

export type OrderStatus = 'draft' | 'confirmed' | 'fulfilled' | 'invoiced' | 'cancelled'

export interface SalesOrder {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  memberId?: string
  customerName?: string
  items: InvoiceItem[]
  total: number
  status: OrderStatus
  notes?: string
  date: string
  expectedDate?: string
  createdAt: string
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  supplierId: string
  lines: PurchaseLine[]
  total: number
  status: PurchaseOrderStatus
  notes?: string
  /** Order date (YYYY-MM-DD). */
  date: string
  /** Expected delivery date (YYYY-MM-DD), optional. */
  expectedDate?: string
  createdAt: string
}

export type PurchaseReturnStatus = 'draft' | 'returned' | 'refunded' | 'cancelled'

export interface PurchaseReturn {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  supplierId: string
  lines: PurchaseLine[]
  total: number
  status: PurchaseReturnStatus
  reason?: string
  /** Return date (YYYY-MM-DD). */
  date: string
  createdAt: string
}

export type ShipmentStatus = 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled'

export interface Shipment {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  salesOrderId?: string
  memberId?: string
  customerName?: string
  carrier?: string
  trackingNumber?: string
  items: InvoiceItem[]
  total: number
  status: ShipmentStatus
  notes?: string
  /** Ship date (YYYY-MM-DD). */
  date: string
  /** Estimated delivery date (YYYY-MM-DD), optional. */
  deliveryDate?: string
  createdAt: string
}

export type DiscountType = 'percentage' | 'fixed'
export type DiscountStatus = 'active' | 'inactive' | 'expired'

export interface Discount {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  code: string
  name: string
  type: DiscountType
  value: number
  /** Optional minimum spend to qualify. */
  minSpend?: number
  /** Optional maximum discount amount (for percentage). */
  maxDiscount?: number
  /** Optional usage limit; 0 = unlimited. */
  usageLimit?: number
  used: number
  /** Optional per-customer limit. */
  perCustomerLimit?: number
  startsAt?: string
  expiresAt?: string
  status: DiscountStatus
  appliesTo?: 'all' | 'members' | 'plans' | 'products'
  createdAt: string
}

export type SalesReturnStatus = 'draft' | 'returned' | 'refunded' | 'cancelled'

export interface SalesReturn {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  number: string
  saleId?: string
  memberId?: string
  customerName?: string
  lines: SaleLine[]
  total: number
  status: SalesReturnStatus
  reason?: string
  /** Return date (YYYY-MM-DD). */
  date: string
  createdAt: string
}

// ---- Human Resources (HRM) ----

export interface Department {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  headUserId?: string
  description?: string
}

export interface Payslip {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  staffUserId: string
  period: string // YYYY-MM
  basic: number
  allowances: number
  deductions: number
  net: number
  status: 'draft' | 'paid'
  paidAt?: string
}

export type JobType = 'full-time' | 'part-time' | 'contract'

export interface JobPosting {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  title: string
  department: string
  location: string
  type: JobType
  salary: string
  description: string
  status: 'open' | 'closed'
  postedAt: string
}

export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

export interface Candidate {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  email: string
  phone: string
  jobId: string
  stage: CandidateStage
  notes?: string
  appliedAt: string
}

export interface PerformanceReview {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  staffUserId: string
  reviewerId: string
  period: string // YYYY
  rating: number // 1-5
  strengths?: string
  improvements?: string
  goals?: string
  status: 'draft' | 'completed'
  reviewedAt: string
}

export type StaffAttendanceStatus = 'present' | 'late' | 'absent' | 'leave'

export interface StaffAttendance {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  staffUserId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: StaffAttendanceStatus
  branchId?: string
  notes?: string
}

// ---- Assets (fixed assets & equipment) ----
export type AssetStatus = 'in_use' | 'available' | 'maintenance' | 'retired'

export interface Asset {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Owning branch within the company. */
  branchId?: string
  /** Asset tag, e.g. AST-0001. */
  tag: string
  name: string
  category: string
  serialNumber?: string
  status: AssetStatus
  /** Condition label (customisable in Asset setup). */
  condition: string
  /** Location (branch or room). */
  location: string
  /** Custodian / person it is assigned to (optional). */
  assignedTo?: string
  /** Purchase date (YYYY-MM-DD). */
  purchaseDate?: string
  /** Original purchase cost (GHS). */
  purchaseCost?: number
  /** Current (depreciated) value (GHS). */
  currentValue?: number
  /** Warranty expiry (YYYY-MM-DD). */
  warrantyExpiry?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// ---- Asset depreciation entries (manual adjustments / journals) ----
export type DepreciationMethod = 'straight_line' | 'reducing_balance' | 'manual'

export interface DepreciationEntry {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  assetId: string
  amount: number
  /** Depreciation date (YYYY-MM-DD). */
  date: string
  method: DepreciationMethod
  notes?: string
  createdAt: string
}

// ---- Asset transactions (movements & lifecycle events) ----
export type AssetTransactionType = 'acquire' | 'assign' | 'transfer' | 'maintenance' | 'return' | 'dispose'

export interface AssetTransaction {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  assetId: string
  type: AssetTransactionType
  /** Transaction date (YYYY-MM-DD). */
  date: string
  /** From location or custodian (optional). */
  from?: string
  /** To location or custodian (optional). */
  to?: string
  /** Cost / proceeds / maintenance charge (GHS, optional). */
  amount?: number
  /** Who performed / authorised the transaction. */
  performedBy?: string
  notes?: string
  createdAt: string
}

// ---- Asset setup / depreciation policy ----
export interface DepreciationPolicy {
  method: 'straight_line' | 'reducing_balance'
  usefulLifeYears: number
  /** Residual (salvage) value as a percentage of cost, e.g. 20. */
  residualPercent: number
}

// ---- Customer management (walk-in / retail customers) ----
export type CustomerStatus = 'active' | 'inactive' | 'prospect'

export interface Customer {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  email: string
  phone: string
  company?: string
  address?: string
  /** Customer category (managed in Customer Categories). */
  category: string
  status: CustomerStatus
  notes?: string
  /** Lifetime spend (GHS), informational. */
  totalSpent: number
  /** Linked portal user account (when login access is granted). */
  userId?: string
  createdAt: string
  /** Values for admin-defined custom fields (keyed by custom field id). */
  customFields?: CustomFieldValues
}

// ---- Accounting module ----
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'

export interface Account {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  code: string
  name: string
  type: AccountType
  /** Parent account code for nested/tree display. */
  parentCode?: string
  /** Parent account id (authoritative link — codes may repeat). */
  parentId?: string
  /** Account type id from the accounting_account_type table (1–16). */
  accountTypeId?: number
  /** Finer detail type, e.g. "Cash and cash equivalents", "Sales of Product Income". */
  detailType?: string
  /** Primary (book) balance. */
  primaryBalance?: number
  /** Bank balance (for bank/cash accounts). */
  bankBalance?: number
  description?: string
  /** Internal note / reference number. */
  noteNo?: string
  /** Fund this account belongs to (Accounting settings → Funds). */
  fundId?: string
  /** Date the opening balance is stated as of. */
  balanceAsOf?: string
  /* -- Bank columns (only for accounts of type 16 = Bank), Perfex-style -- */
  /** Bank institution name, e.g. "GCB BANK". */
  bank?: string
  /** Bank account number. */
  accountNumber?: string
  bankBranch?: string
  bankAccountType?: 'current' | 'savings' | 'momo'
  routing?: string
  contactNo?: string
  email?: string
  country?: string
  status?: 'active' | 'inactive'
}

/**
 * General ledger row — mirrors Perfex's accounting_account_history table.
 * Every POSTED transaction (journal entry, income, expense, invoice, payment,
 * deposit, banking transfer, …) is stored here as debit/credit row pairs;
 * `relType`/`relId` link back to the source document and `split` holds the
 * counter-account of the double entry.
 */
export interface AccountHistoryEntry {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Ledger account posted to. */
  account: string
  debit: number
  credit: number
  description?: string
  /** Source document id. */
  relId?: string
  /** Source document type: journal_entry | income | expense | invoice | payment | deposit | banking | purchase_order | bill | check … */
  relType: string
  dateCreated: string
  /** User who posted it. */
  addedFrom?: string
  customer?: string
  vendor?: string
  /** Counter account of the double entry (Perfex `split`). */
  split?: string
  item?: string
  paid?: boolean
  /** Transaction date (ISO). */
  date: string
  tax?: number
  payslipType?: string
  itemableId?: string
  reconcile?: boolean
  cleared?: boolean
  subType?: string
  billItem?: number
  /** Document number, e.g. JV-2026-0007. */
  number?: string
  issue?: boolean
  addedFromReconcile?: boolean
  bankReconcile?: boolean
  currencyRate?: number
}

/** One mapping line in Automatic Mapping Setup — e.g. Invoice → Sales payment/deposit. */
export interface AutoMappingLine {
  /** Optional sub-label like "Default for all item" shown under the toggle. */
  hint?: string
  /** Account id chosen for the "Payment account" (left) column. */
  paymentAccountId?: string
  /** Account id chosen for the "Deposit to" (right) column. */
  depositToAccountId?: string
  /** Whether this individual line is enabled (toggle on/off). */
  enabled?: boolean
}

export interface AutoMapping {
  /** Enable/disable this whole section. */
  enabled: boolean
  /** Lines keyed by their semantic id, e.g. 'invoice.default', 'invoice.discount', 'payment.sales', 'payment.expenses', 'creditnote.sales', 'creditnote.refund', 'expense.default', 'tax.sales', 'tax.expenses'. */
  lines: Record<string, AutoMappingLine>
}

export interface AccountingSettings {
  /** First month of the financial year (0-11, Jan = 0). */
  fiscalYearStartMonth: number
  /** First month of the tax year (0-11), or -1 = same as financial year. */
  taxYearStartMonth: number
  accountingMethod: 'accrual' | 'cash'
  enableAccountNumbers: boolean
  showAccountNumbers: boolean
  closeTheBooks: boolean
  defaultCurrency: string
  vatRate: number
  autoPost: boolean
  /** Voucher serial prefixes. */
  rvPrefix: string
  pvPrefix: string
  jvPrefix: string
  /** Enabled payment modes. */
  paymentModes: Record<VoucherMethod, boolean>
  /** Automatic account mapping (General tab under Mapping Setup). */
  autoMapping?: AutoMapping
}

export type VoucherMethod = 'cash' | 'bank' | 'momo' | 'cheque' | 'card'
export type VoucherStatus = 'posted' | 'draft' | 'void'
export type StakeholderClass = 'customer' | 'supplier' | 'employee' | 'branch' | 'shareholder' | 'other' | (string & {})

/** Developer-managed application settings (System settings page). */
export interface SystemSettings {
  /** Application (product) name, e.g. "iGracesoft App" — shown in the footer copyright. */
  appName: string
  /** Application release version shown in the footer, e.g. "7.0". */
  appVersion: string
  /** Release date of the current version (ISO date). */
  releaseDate?: string
  /** Internal release notes. */
  releaseNotes?: string
}

/** A user-defined stakeholder class (e.g. "Ministry" for a church). */
export interface StakeholderClassDef {
  id: string
  name: string
  description?: string
  createdAt: string
}

/** A member of a custom stakeholder class (e.g. "Children Ministry"). */
export interface StakeholderEntity {
  id: string
  classId: string
  name: string
  phone?: string
  email?: string
  status: 'active' | 'inactive'
  createdAt?: string
}

export interface ReceiptLine {
  accountId: string
  narration: string
  amount: number
}

export interface ReceiptVoucher {
  id: string
  number: string
  date: string
  receivedFrom: string
  /** Stakeholder classification of the payer. */
  stakeholderClass?: StakeholderClass
  /** Account the funds are deposited into (bank / cash / momo). */
  depositAccountId: string
  /** Income allocation lines (account / narration / amount). */
  lines: ReceiptLine[]
  /** Total amount received (sum of lines). */
  amount: number
  method: VoucherMethod
  /** External reference / receipt reference number. */
  referenceNo?: string
  currency?: string
  /** Rate to convert 1 unit of `currency` into the branch base currency (only set for non-base currencies). */
  conversionRate?: number
  /** Remarks / memo. */
  description?: string
  /** Legacy single attachment name (kept for backwards compat). */
  attachmentName?: string
  /** Multiple attachments: name + mime + optional data URL preview. */
  attachments?: AttachmentFile[]
  status: VoucherStatus
  /** User id who created the voucher. */
  createdBy?: string
  createdAt: string
}

export interface AttachmentFile {
  name: string
  type?: string
  /** data URL for previews (images/PDFs) — kept out of exports, only for in-app display. */
  dataUrl?: string
  size?: number
}

export interface PaymentVoucher {
  id: string
  number: string
  date: string
  paidTo: string
  /** Stakeholder classification of the payee. */
  stakeholderClass?: StakeholderClass
  /** Account the funds are paid from (bank / cash / momo). */
  paymentAccountId: string
  /** Expense/debit allocation lines (account / narration / amount). */
  lines: ReceiptLine[]
  /** Total amount paid (sum of lines). */
  amount: number
  method: VoucherMethod
  /** External reference / payment reference number. */
  referenceNo?: string
  currency?: string
  /** Rate to convert 1 unit of `currency` into the branch base currency (only set for non-base currencies). */
  conversionRate?: number
  /** Remarks / memo. */
  description?: string
  /** Legacy single attachment name (kept for backwards compat). */
  attachmentName?: string
  /** Multiple attachments. */
  attachments?: AttachmentFile[]
  status: VoucherStatus
  /** User id who created the voucher. */
  createdBy?: string
  createdAt: string
}

export interface JournalLine {
  accountId: string
  debit: number
  credit: number
}

export interface JournalVoucher {
  id: string
  number: string
  date: string
  description: string
  lines: JournalLine[]
  status: VoucherStatus
  /** Currency code from the branch Currency settings table. */
  currency?: string
  /** Rate to convert 1 unit of `currency` into the branch base currency (only set for non-base currencies). */
  conversionRate?: number
  /** Optional stakeholder classification (built-in id or custom class id). */
  stakeholderClass?: StakeholderClass
  /** Optional stakeholder name the journal relates to. */
  stakeholder?: string
  /** Recurring schedule: 'no' | '1'…'12' (every N months) | 'custom'. */
  recurring?: string
  /** Custom schedule: repeat every N…  */
  recurringEvery?: number
  /** …days / weeks / months / years. */
  recurringPeriod?: 'days' | 'weeks' | 'months' | 'years'
  /** Total cycles to generate (0 / undefined = infinite). */
  totalCycles?: number
  /** Cycles generated so far. */
  cyclesDone?: number
  /** Next date an automatic copy should be created. */
  nextRecurringDate?: string
  notes?: string
  /** Multiple attachments. */
  attachments?: AttachmentFile[]
  /** Legacy single attachment name. */
  attachmentName?: string
  /** User id who created the voucher. */
  createdBy?: string
  createdAt: string
}

export interface BankAccount {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  bank: string
  accountNumber: string
  branch?: string
  type: 'savings' | 'current' | 'momo'
  /** Account code prefix, e.g. "2003". */
  code?: string
  /** Parent (header) bank account for tree/nested display. */
  parentId?: string
  /** Detail type, e.g. Checking, Savings, Cash on hand, Mobile money. */
  detailType?: string
  /** Internal note / reference number. */
  noteNo?: string
  /** Fund this account belongs to (Accounting settings → Funds). */
  fundId?: string
  description?: string
  /** Bank routing / sort code. */
  routing?: string
  /** Bank contact phone. */
  contactNo?: string
  /** Bank contact email. */
  email?: string
  /** Country where the account is held. */
  country?: string
  openingBalance: number
  /** Primary (book) balance. */
  balance: number
  status: 'active' | 'inactive'
}

export interface VoucherSerial {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  voucherType: string
  startSerial: number
  numberFormat: string
}

export interface Fund {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  status: 'active' | 'inactive'
}

export interface PaymentModeOption {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  status: 'active' | 'inactive'
}

export interface AccountDetailType {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  /** Parent account type label (Perfex-style, e.g. "Accounts Payable (A/P)"). */
  accountType: string
  /** Statement of cash flows section (e.g. "Cash flows from operating activities"). */
  cashFlowSection?: string
  description?: string
  mandatory?: boolean
}

export interface IncomeStatementMod {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  name: string
  type: string
  active: boolean
}

export interface CurrencyRate {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  from: string
  to: string
  rate: number
  updatedAt: string
}

export interface BankSignatory {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Bank account this signatory is mandated on. */
  bankAccountId?: string
  name: string
  /** Designation, e.g. Director, Treasurer. */
  role: string
  /** Mandate type: sole / class A / class B / joint. */
  signatoryType?: string
  /** Signing order, e.g. 1st, 2nd. */
  signatoryOrder?: string
  phone: string
  email: string
  status: 'active' | 'inactive'
}

export interface BankReconciliation {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  bankAccountId: string
  statementDate: string
  statementBalance: number
  bookBalance: number
  difference: number
  status: 'open' | 'reconciled'
  notes?: string
  createdAt: string
}

export interface Budget {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  year: number
  accountId: string
  /** 12 monthly budget amounts (Jan–Dec). */
  months: number[]
  notes?: string
}

export interface ValueBookEntry {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  date: string
  assetName: string
  openingValue: number
  additions: number
  depreciation: number
  closingValue: number
  notes?: string
}

/** Cheque register entry (issued cheques written out, and cheques received in). */
export type ChequeStatus = 'issued' | 'received' | 'cleared' | 'cancelled' | 'bounced' | 'void'
export type ChequeDirection = 'issued' | 'received'

export interface ChequeEntry {
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** Cheque / check number. */
  number: string
  direction: ChequeDirection
  /** Bank account the cheque is drawn on (for issued) or deposited to (for received). */
  bankAccountId: string
  /** Date written / received. */
  date: string
  /** Date the cheque cleared the bank (optional, until reconciled). */
  clearedDate?: string
  /** Payee (issued) or Payer (received). */
  party: string
  amount: number
  /** Status in the register. */
  status: ChequeStatus
  /** Linked payment / receipt voucher (optional reference). */
  referenceNo?: string
  /** Memo / notes. */
  notes?: string
  /** Attachments. */
  attachments?: AttachmentFile[]
  /** User id who recorded it. */
  createdBy?: string
  createdAt: string
}

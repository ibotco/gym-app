import type {
  CompanyNotificationSetting,
  NotificationDestination,
  NotificationRecipient,
} from '../types'
import { MODULES } from './modules'

const ALL_DESTINATIONS: NotificationDestination[] = ['email', 'sms', 'mobile', 'whatsapp']
const EMAIL_ONLY: NotificationDestination[] = ['email']
const EMAIL_DEFAULT: NotificationDestination[] = ['email']

function eventSetting(
  moduleId: string,
  key: string,
  event: string,
  recipients: NotificationRecipient[],
  sampleMessage: string,
  availableDestinations: NotificationDestination[] = ALL_DESTINATIONS,
  destinations: NotificationDestination[] = EMAIL_DEFAULT,
): CompanyNotificationSetting {
  return {
    id: `${moduleId}:${key}`,
    moduleId,
    event,
    availableDestinations: [...availableDestinations],
    destinations: [...destinations],
    availableRecipients: [...recipients],
    recipients: [...recipients],
    smsTemplateId: '',
    whatsappTemplateId: '',
    sampleMessage,
  }
}

/** Default notification events, organized around the app's system modules. */
const CURATED_MODULE_NOTIFICATION_EVENTS: CompanyNotificationSetting[] = [
  // Organizations
  eventSetting('organizations', 'company-updated', 'Company profile updated', ['admin'], 'The company profile for {{company_name}} was updated by {{updated_by}}.'),
  eventSetting('organizations', 'branch-created', 'Branch created', ['admin', 'manager'], 'A new branch, {{branch_name}}, was added to {{company_name}} by {{created_by}}.'),

  // People
  eventSetting('people', 'member-registered', 'Member registered', ['member', 'staff'], 'Welcome {{member_name}}! Your membership at {{company_name}} is ready. Member ID: {{member_id}}.'),
  eventSetting('people', 'customer-created', 'Customer added', ['customer', 'staff'], 'A new customer, {{customer_name}}, was added by {{created_by}}.'),
  eventSetting('people', 'supplier-created', 'Supplier added', ['supplier', 'staff'], 'A new supplier, {{supplier_name}}, was added to {{company_name}}.'),

  // User Management
  eventSetting('userManagement', 'user-created', 'User account created', ['user', 'admin'], 'Hello {{user_name}}, your {{company_name}} account is ready. Sign in at {{login_url}}.'),
  eventSetting('userManagement', 'password-reset', 'Password reset requested', ['user'], 'A password reset was requested for your account. Reset it using this link: {{reset_link}}.', EMAIL_ONLY),

  // Human Resource
  eventSetting('hrm', 'employee-added', 'Employee added', ['staff', 'admin'], 'A new employee, {{employee_name}}, was added to {{department}}.'),
  eventSetting('hrm', 'attendance-exception', 'Attendance exception recorded', ['staff', 'manager'], '{{employee_name}} has an attendance exception for {{date}}: {{attendance_status}}.'),
  eventSetting('hrm', 'leave-request', 'Leave request submitted', ['manager', 'admin'], '{{employee_name}} submitted a leave request from {{start_date}} to {{end_date}}.'),
  eventSetting('hrm', 'payroll-finalized', 'Payroll finalized', ['staff', 'admin'], 'Payroll for {{period}} has been finalized. Your net pay is {{net_pay}}.'),

  // Accounting
  eventSetting('accounting', 'income-recorded', 'Income recorded', ['staff', 'admin'], 'Income of {{amount}} was recorded for {{account_name}} on {{date}}.'),
  eventSetting('accounting', 'payment-voucher-posted', 'Payment voucher posted', ['staff', 'admin'], 'Payment voucher {{voucher_number}} for {{amount}} was posted by {{created_by}}.'),
  eventSetting('accounting', 'budget-threshold', 'Budget threshold reached', ['admin', 'manager'], '{{account_name}} has used {{percent_used}}% of its {{period}} budget.'),

  // Approvals
  eventSetting('approvals', 'request-submitted', 'Approval request submitted', ['approver'], '{{requester_name}} submitted {{document_type}} {{document_number}} for approval.'),
  eventSetting('approvals', 'request-approved', 'Approval completed', ['staff', 'admin'], '{{document_type}} {{document_number}} was approved by {{approver_name}}.'),
  eventSetting('approvals', 'request-rejected', 'Approval request rejected', ['staff', 'admin'], '{{document_type}} {{document_number}} was rejected by {{approver_name}}. Reason: {{reason}}.'),

  // Inventory
  eventSetting('inventory', 'low-stock', 'Low stock alert', ['staff', 'manager'], '{{item_name}} is low in stock. Current quantity: {{quantity}}; reorder point: {{reorder_point}}.'),
  eventSetting('inventory', 'goods-received', 'Goods received', ['staff', 'supplier'], 'Goods receipt {{receipt_number}} has been recorded for {{supplier_name}}.'),

  // Assets Management
  eventSetting('assets', 'asset-assigned', 'Asset assigned', ['staff', 'admin'], 'Asset {{asset_name}} ({{asset_tag}}) has been assigned to {{employee_name}}.'),
  eventSetting('assets', 'maintenance-due', 'Asset maintenance due', ['staff', 'manager'], 'Maintenance is due for {{asset_name}} ({{asset_tag}}) on {{due_date}}.'),

  // Sales
  eventSetting('sales', 'invoice-issued', 'Invoice issued', ['customer', 'staff'], 'Invoice {{invoice_number}} for {{amount}} was issued to {{customer_name}}.'),
  eventSetting('sales', 'payment-received', 'Payment received', ['customer', 'staff'], 'We received {{amount}} for invoice {{invoice_number}}. Thank you, {{customer_name}}.'),
  eventSetting('sales', 'refund-processed', 'Sale refund processed', ['customer', 'staff'], 'A refund of {{amount}} for transaction {{transaction_number}} has been processed.'),

  // Purchases
  eventSetting('purchases', 'purchase-order', 'Purchase order created', ['supplier', 'staff'], 'Purchase order {{order_number}} for {{supplier_name}} has been created.'),
  eventSetting('purchases', 'supplier-invoice', 'Supplier invoice recorded', ['supplier', 'staff'], 'Supplier invoice {{invoice_number}} for {{amount}} has been recorded.'),

  // Project Management
  eventSetting('projects', 'task-assigned', 'Task assigned', ['staff', 'manager'], 'You have been assigned to {{task_name}} in project {{project_name}}. Due: {{due_date}}.'),
  eventSetting('projects', 'task-due', 'Task deadline approaching', ['staff', 'manager'], 'Task {{task_name}} in {{project_name}} is due on {{due_date}}.'),
  eventSetting('projects', 'timesheet-submitted', 'Timesheet submitted', ['manager', 'staff'], '{{employee_name}} submitted a timesheet for {{period}}.'),

  // Communications
  eventSetting('communications', 'announcement-published', 'Announcement published', ['staff', 'member', 'customer'], '{{announcement_title}} has been published by {{sender_name}}.'),
  eventSetting('communications', 'message-received', 'New message received', ['user'], 'You have a new message from {{sender_name}}: {{message_preview}}'),

  // Gym Management
  eventSetting('programs', 'membership-activated', 'Membership activated', ['member', 'staff'], 'Your {{membership_name}} membership is active from {{start_date}} to {{end_date}}.'),
  eventSetting('programs', 'membership-renewal', 'Membership renewal due', ['member', 'staff'], 'Your {{membership_name}} membership expires on {{end_date}}. Renew to keep training.'),
  eventSetting('programs', 'membership-expired', 'Membership expired', ['member', 'staff'], 'Your {{membership_name}} membership expired on {{end_date}}.'),
  eventSetting('programs', 'class-booking', 'Class booking confirmed', ['member', 'trainer'], 'Your booking for {{class_name}} on {{session_date}} at {{session_time}} is confirmed.'),
  eventSetting('programs', 'class-reminder', 'Class session reminder', ['member', 'trainer'], 'Reminder: {{class_name}} starts at {{session_time}} on {{session_date}}.'),

  // Education Management
  eventSetting('educationManagement', 'student-admitted', 'Student admitted', ['student', 'guardian', 'staff'], '{{student_name}} has been admitted to {{class_name}} for {{session_name}}.'),
  eventSetting('educationManagement', 'fee-payment', 'Fee payment received', ['student', 'guardian', 'staff'], 'A payment of {{amount}} for {{student_name}} was received on {{date}}.'),
  eventSetting('educationManagement', 'attendance-exception', 'Student attendance exception', ['student', 'guardian', 'staff'], '{{student_name}} was marked {{attendance_status}} on {{date}}.'),
  eventSetting('educationManagement', 'exam-result', 'Exam result published', ['student', 'guardian'], 'The result for {{student_name}} in {{exam_name}} is now available.'),

  // Church Management
  eventSetting('churchManagement', 'visitor-registered', 'Visitor registered', ['visitor', 'staff'], 'A new visitor, {{visitor_name}}, was recorded by {{created_by}}.'),
  eventSetting('churchManagement', 'donation-received', 'Donation received', ['donor', 'admin'], 'Thank you, {{donor_name}}, for your donation of {{amount}} to {{fund_name}}.'),
  eventSetting('churchManagement', 'event-reminder', 'Church event reminder', ['member', 'visitor'], 'Reminder: {{event_name}} is scheduled for {{event_date}} at {{event_time}}.'),

  // Media Library
  eventSetting('mediaLibrary', 'file-uploaded', 'File uploaded', ['staff'], '{{file_name}} was uploaded to the {{folder_name}} media folder by {{uploaded_by}}.'),
  eventSetting('mediaLibrary', 'share-created', 'Shared link created', ['user'], 'A share link for {{file_name}} is ready: {{share_url}}.'),

  // Front CMS
  eventSetting('frontCms', 'website-enquiry', 'Website enquiry received', ['staff', 'admin'], 'A new enquiry from {{contact_name}} was received via {{website_name}}.'),
  eventSetting('frontCms', 'page-published', 'Website page published', ['staff'], 'The website page “{{page_title}}” was published by {{published_by}}.'),

  // Settings
  eventSetting('settings', 'company-settings-updated', 'Company settings updated', ['admin'], '{{setting_name}} was updated by {{updated_by}}.'),
]

const registeredModuleIds = new Set(MODULES.map((module) => module.id))
const curatedModuleIds = new Set(CURATED_MODULE_NOTIFICATION_EVENTS.map((row) => row.moduleId))
const registeredCuratedEvents = CURATED_MODULE_NOTIFICATION_EVENTS.filter((row) => registeredModuleIds.has(row.moduleId))

/**
 * If a new top-level module is added to the sidebar/module registry without
 * curated events yet, give it a starter event automatically. Adding detailed
 * events for that module later suppresses this generic row.
 */
const automaticMenuEvents: CompanyNotificationSetting[] = MODULES
  .filter((module) => module.id !== 'overview' && !curatedModuleIds.has(module.id))
  .map((module) => eventSetting(
    module.id,
    'menu-activity',
    `${module.label} activity`,
    ['admin'],
    `A new activity was recorded in ${module.label}. Event: {{event_name}}. Details: {{event_summary}}.`,
  ))

export const DEFAULT_COMPANY_NOTIFICATION_SETTINGS: CompanyNotificationSetting[] = [
  ...registeredCuratedEvents,
  ...automaticMenuEvents,
]

/**
 * Merge saved configuration onto the module-based event catalogue. This also
 * migrates older event lists that do not have a moduleId to the current defaults.
 */
export function loadCompanyNotificationSettings(
  saved?: CompanyNotificationSetting[],
): CompanyNotificationSetting[] {
  const savedRows = Array.isArray(saved) ? saved : []
  const validSavedRows = savedRows.filter((row) => row && typeof row.moduleId === 'string')
  const savedById = new Map(validSavedRows.map((row) => [row.id, row]))
  const defaultIds = new Set(DEFAULT_COMPANY_NOTIFICATION_SETTINGS.map((row) => row.id))

  const mergedDefaults = DEFAULT_COMPANY_NOTIFICATION_SETTINGS.map((base) => {
    const prior = savedById.get(base.id)
    if (!prior) return cloneCompanyNotificationSettings([base])[0]
    return {
      ...base,
      destinations: Array.isArray(prior.destinations)
        ? prior.destinations.filter((value) => base.availableDestinations.includes(value))
        : [...base.destinations],
      recipients: Array.isArray(prior.recipients)
        ? prior.recipients.filter((value) => base.availableRecipients.includes(value))
        : [...base.recipients],
      smsTemplateId: typeof prior.smsTemplateId === 'string' ? prior.smsTemplateId : base.smsTemplateId,
      whatsappTemplateId: typeof prior.whatsappTemplateId === 'string' ? prior.whatsappTemplateId : base.whatsappTemplateId,
      sampleMessage: typeof prior.sampleMessage === 'string' ? prior.sampleMessage : base.sampleMessage,
      availableDestinations: [...base.availableDestinations],
      availableRecipients: [...base.availableRecipients],
    }
  })

  const additionalSavedRows = validSavedRows.filter((row) => !defaultIds.has(row.id))
  return cloneCompanyNotificationSettings([...mergedDefaults, ...additionalSavedRows])
}

/** Return a fully independent copy so drafts never mutate the shared defaults. */
export function cloneCompanyNotificationSettings(
  settings: CompanyNotificationSetting[],
): CompanyNotificationSetting[] {
  return settings.map((setting) => ({
    ...setting,
    availableDestinations: [...setting.availableDestinations],
    destinations: [...setting.destinations],
    availableRecipients: [...setting.availableRecipients],
    recipients: [...setting.recipients],
  }))
}

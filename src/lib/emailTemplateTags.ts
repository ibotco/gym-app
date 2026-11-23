/** Descriptive placeholders only: a future sending workflow must resolve them. */
export type EmailTagGroup = { label: string; tags: string[]; moduleId?: string; packageIds?: string[] }
export const EMAIL_TEMPLATE_TAG_GROUPS: EmailTagGroup[] = [
  { label: 'General', tags: ['{{name}}','{{date}}','{{amount}}','{{phone}}'] },
  { label: 'Company & branch', tags: ['{{clubName}}','{{companyName}}','{{companyEmail}}','{{companyPhone}}','{{companyAddress}}','{{companyWebsite}}','{{branchName}}','{{currency}}'] },
  { label: 'Account', tags: ['{{username}}','{{portalUrl}}'] },
  { label: 'Gym Management', moduleId: 'programs', packageIds: ['plans','classes','checkin'], tags: ['{{plan}}','{{memberName}}','{{membershipNumber}}','{{membershipPlan}}','{{membershipStartDate}}','{{membershipExpiryDate}}','{{classTitle}}','{{classDate}}','{{classTime}}','{{trainerName}}'] },
  { label: 'Education · student & guardian', moduleId: 'educationManagement', tags: ['{{studentName}}','{{studentId}}','{{admissionNumber}}','{{className}}','{{section}}','{{guardianName}}','{{guardianPhone}}','{{guardianEmail}}'] },
  { label: 'Education · academic & fees', moduleId: 'educationManagement', tags: ['{{academicYear}}','{{term}}','{{vacationDate}}','{{nextTermDate}}','{{subjectName}}','{{homeworkDueDate}}','{{invoiceNumber}}','{{feesType}}','{{dueDate}}','{{amountDue}}','{{amountPaid}}','{{balance}}','{{paymentDate}}','{{receiptNumber}}'] },
  { label: 'Church Management', moduleId: 'churchManagement', tags: ['{{congregantName}}','{{ministryName}}','{{serviceName}}','{{serviceDate}}','{{serviceTime}}','{{contributionType}}','{{contributionAmount}}','{{contributionDate}}'] },
  { label: 'Project Management', moduleId: 'projects', packageIds: ['projects'], tags: ['{{projectName}}','{{projectStatus}}','{{projectPriority}}','{{projectStartDate}}','{{projectEndDate}}','{{projectProgress}}','{{clientName}}','{{taskName}}','{{taskDueDate}}','{{projectManager}}'] },
  { label: 'Asset Management', moduleId: 'assets', packageIds: ['assets'], tags: ['{{assetName}}','{{assetTag}}','{{assetCategory}}','{{assetSerialNumber}}','{{assetStatus}}','{{assetCondition}}','{{assetLocation}}','{{assetCustodian}}','{{assetCheckoutDate}}','{{assetReturnDate}}','{{assetRenewalDate}}'] },
  { label: 'Human Resource', moduleId: 'hrm', packageIds: ['hrm','hrmLeave','hrmPayroll'], tags: ['{{employeeName}}','{{employeeId}}','{{department}}','{{jobTitle}}','{{leaveType}}','{{leaveStartDate}}','{{leaveEndDate}}'] },
  { label: 'Sales', moduleId: 'sales', packageIds: ['sales','salesOrders','estimates','proposals'], tags: ['{{customerName}}','{{orderNumber}}','{{invoiceNumber}}','{{invoiceDate}}','{{dueDate}}','{{amountDue}}','{{amountPaid}}','{{balance}}'] },
  { label: 'Inventory', moduleId: 'inventory', packageIds: ['inventory'], tags: ['{{productName}}','{{productCode}}','{{quantity}}','{{stockLevel}}','{{reorderLevel}}'] },
  { label: 'Purchases', moduleId: 'purchases', packageIds: ['procurementOrders','supplierInvoices','supplierPayments'], tags: ['{{supplierName}}','{{purchaseOrderNumber}}','{{purchaseDate}}','{{invoiceNumber}}','{{amountDue}}'] },
  { label: 'Approvals', moduleId: 'approvals', tags: ['{{approverName}}','{{requesterName}}','{{documentNo}}','{{documentType}}','{{workflowName}}','{{approvalLink}}'] },
]

export function availableEmailTagGroups(modules: Record<string, boolean>, packageModules: readonly string[] | undefined, packageActive: boolean): EmailTagGroup[] {
  return EMAIL_TEMPLATE_TAG_GROUPS.filter(group => {
    if (!group.moduleId) return true
    if (modules[group.moduleId] !== true) return false
    if (!group.packageIds) return true // No corresponding package entitlement exists in the current registry.
    return packageActive && !!packageModules && group.packageIds.some(id => packageModules.includes(id))
  })
}

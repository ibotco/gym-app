import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  ArrowRight, BadgeCheck, CalendarClock, Check, CircleDollarSign, ClipboardCheck, Download,
  Eye, FileCheck2, FileText, History, LockKeyhole, Plus, Send, ShieldCheck, Upload, X,
} from 'lucide-react'
import { Badge, Button, DatePicker, Field, Input, Modal, PageHeader, SearchField, Select, StatCard, Textarea } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { StaffListFilters } from '../../../components/StaffListFilters'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, formatGhs, uid } from '../../../lib/utils'
import { emptyStaffListFilters, matchesStaffUserId, type StaffListFilterValues } from '../../../lib/staffListFilters'
import {
  canApprovePromotion, canCreatePromotion, canProcessPromotion,
  calculatePromotionFinancials, EMPLOYEE_PROMOTION_APPROVAL_LEVELS, EMPLOYEE_PROMOTION_TYPES,
  employeePromotionService, loadEmployeePromotions,
  PROMOTION_DOCUMENT_MAX_BYTES, type EmployeePromotionDraftInput, type EmployeePromotionRecord,
  type EmployeePromotionType, type PromotionActor, type PromotionSalaryChangeMode,
  type PromotionDocument, type PromotionDocumentType, type PromotionPayrollTransaction,
  promotionTypeValue, validateEmployeePromotion,
} from '../../../lib/employeePromotions'
import { getPromotionDocument, savePromotionDocument } from '../../../lib/promotionDocuments'
import { employeePromotionApi } from '../../../lib/employeePromotionApi'
import { loadPromotionChanges, loadPromotionGradeSettings, promotionChangeLabel, savePromotionChanges, type PromotionChangeRecord } from '../../../lib/promotions'
import {
  DEFAULT_HR_JOB_TITLES, DEFAULT_HR_PROMOTION_TYPES, loadHrmRows,
  type HrJobTitleSetting, type HrPromotionTypeSetting,
} from '../../../lib/hrmSettings'
import { currentPayrollPeriod, describeSalaryIncrease, formatPayrollPeriod, loadSalaryIncreaseSettings, saveSalaryIncreaseSettings, salaryBasicForPeriod, type ManualSalaryIncrease, type SalaryIncreaseSettings } from '../../../lib/salaryIncreases'
import type { PayrollAdjItem, StaffRecord } from '../../../types'

type FormState = {
  employeeStaffId: string
  employeeUserId: string
  employeeId: string
  employeeName: string
  department: string
  directorateUnit: string
  employmentCategory: string
  currentTitle: string
  currentGrade: string
  currentSalaryLevel: string
  currentSalaryStep: string
  salaryAssignmentIdSnapshot: string
  salaryStructureIdSnapshot: string
  salaryStructureNameSnapshot: string
  newJobTitle: string
  newGrade: string
  newSalaryLevel: string
  newSalaryStep: string
  oldSalary: string
  newSalary: string
  salaryChangeMode: PromotionSalaryChangeMode
  salaryChangeAmount: string
  effectiveDate: string
  processingDate: string
  promotionType: EmployeePromotionType
  promotionBasis: string
  promotionLetterNumber: string
  remarks: string
}

type PendingFiles = {
  promotion_letter: File | null
  approval_letter: File | null
  supporting_document: File[]
}

type PreviewDocument = { url: string; fileName: string; mimeType: string } | null

const today = () => new Date().toISOString().slice(0, 10)
const emptyFiles = (): PendingFiles => ({ promotion_letter: null, approval_letter: null, supporting_document: [] })
const emptyForm = (): FormState => ({
  employeeStaffId: '', employeeUserId: '', employeeId: '', employeeName: '', department: '', directorateUnit: '',
  employmentCategory: '', currentTitle: '', currentGrade: '', currentSalaryLevel: '', currentSalaryStep: '',
  salaryAssignmentIdSnapshot: '', salaryStructureIdSnapshot: '', salaryStructureNameSnapshot: '',
  newJobTitle: '', newGrade: '', newSalaryLevel: '', newSalaryStep: '', oldSalary: '', newSalary: '',
  salaryChangeMode: 'target', salaryChangeAmount: '',
  effectiveDate: today(), processingDate: today(), promotionType: 'promotion', promotionBasis: '',
  promotionLetterNumber: '', remarks: '',
})

function toForm(record: EmployeePromotionRecord): FormState {
  return {
    employeeStaffId: record.employeeStaffId,
    employeeUserId: record.employeeUserId,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    department: record.department,
    directorateUnit: record.directorateUnit,
    employmentCategory: record.employmentCategory,
    currentTitle: record.currentTitle,
    currentGrade: record.currentGrade,
    currentSalaryLevel: record.currentSalaryLevel,
    currentSalaryStep: record.currentSalaryStep,
    salaryAssignmentIdSnapshot: record.salaryAssignmentIdSnapshot || '',
    salaryStructureIdSnapshot: record.salaryStructureIdSnapshot || '',
    salaryStructureNameSnapshot: record.salaryStructureNameSnapshot || '',
    newJobTitle: record.newJobTitle,
    newGrade: record.newGrade,
    newSalaryLevel: record.newSalaryLevel,
    newSalaryStep: record.newSalaryStep,
    oldSalary: String(record.oldSalary),
    newSalary: String(record.newSalary || ''),
    salaryChangeMode: record.salaryChangeMode || 'target',
    salaryChangeAmount: record.salaryChangeAmount ? String(record.salaryChangeAmount) : '',
    effectiveDate: record.effectiveDate,
    processingDate: record.processingDate,
    promotionType: record.promotionType,
    promotionBasis: record.promotionBasis,
    promotionLetterNumber: record.promotionLetterNumber,
    remarks: record.remarks,
  }
}

function statusTone(status: EmployeePromotionRecord['status']): 'lime' | 'amber' | 'rose' | 'zinc' {
  if (status === 'Processed to Payroll' || status === 'Approved') return 'lime'
  if (status === 'Pending Approval') return 'amber'
  if (status === 'Rejected') return 'rose'
  return 'zinc'
}

function approvalTone(status: string): string {
  if (status === 'Approved') return 'text-lime'
  if (status === 'Rejected') return 'text-rose-400'
  if (status === 'Pending') return 'text-amber-500'
  return 'text-mist'
}

function documentTypeLabel(type: PromotionDocumentType): string {
  if (type === 'promotion_letter') return 'Promotion letter'
  if (type === 'approval_letter') return 'Approval letter'
  return 'Supporting document'
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function inferredMimeType(file: File): string {
  if (file.type) return file.type
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'doc') return 'application/msword'
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

function dateForSort(date: string): string {
  return date || '0000-00-00'
}

function salaryFromForm(form: FormState): number {
  const oldSalary = Number(form.oldSalary)
  const amount = Number(form.salaryChangeAmount)
  if (form.salaryChangeMode === 'fixed') return Math.round((oldSalary + amount + Number.EPSILON) * 100) / 100
  if (form.salaryChangeMode === 'percent') return Math.round((oldSalary * (1 + amount / 100) + Number.EPSILON) * 100) / 100
  return Number(form.newSalary)
}

export function EmployeePromotionsPage() {
  const app = useApp()
  const {
    staff, users, salaryStructures, salaryAssignments, payslips,
    upsertStaff, upsertPayrollAdj, log,
  } = app
  const { user } = useAuth()
  const toast = useToast()
  const role = user?.role || ''
  const actor: PromotionActor = { id: user?.id || 'system', name: user?.name || 'System', role }
  const canCreate = canCreatePromotion(role)
  const canProcess = canProcessPromotion(role)
  const [records, setRecords] = useState<EmployeePromotionRecord[]>(() => loadEmployeePromotions(app.activeCompanyId))
  const [legacyChanges, setLegacyChanges] = useState<PromotionChangeRecord[]>(() => loadPromotionChanges())
  const [registerSearch, setRegisterSearch] = useState('')
  const [staffFilters, setStaffFilters] = useState<StaffListFilterValues>(emptyStaffListFilters)
  const [registerTypeFilter, setRegisterTypeFilter] = useState('all')
  const [registerStatusFilter, setRegisterStatusFilter] = useState('all')
  const [registerEffectiveFrom, setRegisterEffectiveFrom] = useState('')
  const [registerEffectiveTo, setRegisterEffectiveTo] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [employeeIdFilter, setEmployeeIdFilter] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFiles>(emptyFiles)
  const [approvalComment, setApprovalComment] = useState('')
  const [formError, setFormError] = useState('')
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument>(null)
  const [promotionFormOpen, setPromotionFormOpen] = useState(false)
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [apiMode, setApiMode] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [salaryIncreaseSettings, setSalaryIncreaseSettings] = useState<SalaryIncreaseSettings>(() => loadSalaryIncreaseSettings())
  // Source promotion grades from the active company's Promotion Grades setting in HR Admin.
  // Read directly so a render picks up the latest settings saved by the Grade Settings page.
  const promotionGrades = loadPromotionGradeSettingsSafe(app.activeCompanyId)

  useEffect(() => {
    let alive = true
    const localRecords = loadEmployeePromotions(app.activeCompanyId)
    setRecords(localRecords)
    setRegisterSearch('')
    setStaffFilters(emptyStaffListFilters())
    setRegisterTypeFilter('all')
    setRegisterStatusFilter('all')
    setRegisterEffectiveFrom('')
    setRegisterEffectiveTo('')
    setSelectedId('')
    setForm(emptyForm())
    setEmployeeIdFilter('')
    setPendingFiles(emptyFiles())
    setPromotionFormOpen(false)
    setApiMode(false)
    setApiReady(false)
    employeePromotionApi.setContext({
      companyId: app.activeCompanyId || 'co_fitpro',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
    })
    void employeePromotionApi.listAll().then((serverRecords) => {
      if (!alive) return
      setApiReady(true)
      if (serverRecords.length) {
        setRecords(serverRecords)
        employeePromotionService.save(serverRecords, app.activeCompanyId)
        setApiMode(true)
      } else {
        // Prefer existing browser records rather than hiding them if the local API store is new.
        setApiMode(localRecords.length === 0)
      }
    }).catch(() => {
      if (alive) { setApiMode(false); setApiReady(true) }
    })
    return () => { alive = false }
  }, [app.activeCompanyId, actor.id, actor.name, actor.role])

  useEffect(() => {
    return () => {
      if (previewDocument?.url) URL.revokeObjectURL(previewDocument.url)
    }
  }, [previewDocument])

  const activeStaff = useMemo(() => staff
    .filter((record) => users.some((person) => person.id === record.userId && person.status === 'active'))
    .sort((a, b) => employeeName(a).localeCompare(employeeName(b))), [staff, users])
  const departmentOptions = useMemo(() => {
    const byKey = new Map<string, string>()
    activeStaff.forEach((record) => {
      const department = String(record.department || '').trim()
      const key = department.toLocaleLowerCase()
      if (department && !byKey.has(key)) byKey.set(key, department)
    })
    return [...byKey.values()].sort((a, b) => a.localeCompare(b))
  }, [activeStaff])
  const selectedRecord = records.find((record) => record.id === selectedId)
  const employeesInSelectedDepartment = useMemo(() => {
    const departmentKey = form.department.trim().toLocaleLowerCase()
    const matches = departmentKey
      ? activeStaff.filter((record) => String(record.department || '').trim().toLocaleLowerCase() === departmentKey)
      : []
    if (selectedRecord && form.employeeStaffId && !matches.some((record) => record.id === form.employeeStaffId)) {
      const linkedEmployee = staff.find((record) => record.id === form.employeeStaffId)
      if (linkedEmployee) matches.push(linkedEmployee)
    }
    return matches
  }, [activeStaff, form.department, form.employeeStaffId, selectedRecord?.id, staff])
  const employeeIdMatches = useMemo(() => {
    const query = employeeIdFilter.trim().toLocaleLowerCase()
    if (!query) return employeesInSelectedDepartment
    return employeesInSelectedDepartment.filter((record) =>
      [record.employeeNumber, record.id, record.userId]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query)),
    )
  }, [employeeIdFilter, employeesInSelectedDepartment])
  const employeeSelectOptions = useMemo(() => {
    if (!form.employeeStaffId) return employeeIdMatches
    const selectedEmployee = employeesInSelectedDepartment.find((record) => record.id === form.employeeStaffId)
    if (!selectedEmployee || employeeIdMatches.some((record) => record.id === selectedEmployee.id)) return employeeIdMatches
    return [...employeeIdMatches, selectedEmployee]
  }, [employeeIdMatches, employeesInSelectedDepartment, form.employeeStaffId])
  const isLocked = !!selectedRecord && selectedRecord.status !== 'Draft' && selectedRecord.status !== 'Rejected'
  const currentApproval = selectedRecord?.approvals.find((approval) => approval.status === 'Pending')
  const mayApprove = !!selectedRecord && selectedRecord.status === 'Pending Approval' && !!currentApproval && canApprovePromotion(role, currentApproval.level)
  const currentGradeIndex = promotionGrades.indexOf(form.currentGrade)
  const proposedGradeOptions = currentGradeIndex >= 0 ? promotionGrades.slice(0, currentGradeIndex) : promotionGrades
  const financials = calculatePromotionFinancials(Number(form.oldSalary), salaryFromForm(form), form.effectiveDate, form.processingDate)
  const jobTitleOptions = useMemo(() => {
    const rows = loadHrmRows<HrJobTitleSetting>(app.activeCompanyId, 'job-title', DEFAULT_HR_JOB_TITLES)
    const names: string[] = []
    const seen = new Set<string>()
    rows.forEach((row) => {
      if (!row || row.status === 'Inactive' || typeof row.name !== 'string') return
      const title = row.name.trim()
      const key = title.toLocaleLowerCase()
      if (title && !seen.has(key)) { seen.add(key); names.push(title) }
    })
    return names
  }, [app.activeCompanyId])
  const promotionTypeSettings = useMemo(() => {
    const rows = loadHrmRows<HrPromotionTypeSetting>(app.activeCompanyId, 'promotion-type', DEFAULT_HR_PROMOTION_TYPES)
    const options: Array<{ value: EmployeePromotionType; label: string; status: 'Active' | 'Inactive' }> = []
    const seen = new Set<string>()
    rows.forEach((row) => {
      if (!row || typeof row.name !== 'string' || (row.status !== 'Active' && row.status !== 'Inactive')) return
      const label = row.name.trim()
      const value = promotionTypeValue(label)
      if (!label || !value || seen.has(value)) return
      seen.add(value)
      options.push({ value, label, status: row.status })
    })
    return options
  }, [app.activeCompanyId])
  const activePromotionTypeOptions = useMemo(
    () => promotionTypeSettings.filter((option) => option.status === 'Active'),
    [promotionTypeSettings],
  )
  const selectablePromotionTypeOptions = useMemo(() => {
    if (!selectedRecord || !form.promotionType || activePromotionTypeOptions.some((option) => option.value === form.promotionType)) {
      return activePromotionTypeOptions
    }
    const configured = promotionTypeSettings.find((option) => option.value === form.promotionType)
    const fallback = EMPLOYEE_PROMOTION_TYPES.find((option) => option.value === form.promotionType)?.label
      || String(form.promotionType).replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    return [...activePromotionTypeOptions, {
      value: form.promotionType,
      label: `${configured?.label || fallback} (inactive/legacy)`,
      status: 'Inactive' as const,
    }]
  }, [activePromotionTypeOptions, promotionTypeSettings, selectedRecord?.id, form.promotionType])
  const promotionTypeLabel = (value: string) => promotionTypeSettings.find((option) => option.value === value)?.label
    || EMPLOYEE_PROMOTION_TYPES.find((option) => option.value === value)?.label
    || value.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
  const companyLegacyChanges = useMemo(() => {
    const companyStaffUserIds = new Set(staff.map((record) => record.userId))
    return legacyChanges.filter((record) => companyStaffUserIds.has(record.staffUserId))
  }, [legacyChanges, staff])
  const filteredLegacyChanges = useMemo(() => companyLegacyChanges.filter((record) =>
    matchesStaffUserId(record.staffUserId, staff, users, staffFilters),
  ), [companyLegacyChanges, staff, users, staffFilters])
  const legacyEffectiveMonths = useMemo(() => companyLegacyChanges.map((record) => ({ employeeUserId: record.staffUserId, period: record.effectivePeriod })), [companyLegacyChanges])

  useEffect(() => {
    if (selectedRecord) return
    setForm((current) => {
      if (activePromotionTypeOptions.some((option) => option.value === current.promotionType)) return current
      return { ...current, promotionType: activePromotionTypeOptions[0]?.value || '' }
    })
  }, [selectedRecord?.id, activePromotionTypeOptions])

  function employeeName(record: StaffRecord): string {
    return users.find((person) => person.id === record.userId)?.name || record.employeeNumber || record.userId
  }

  function currentBasicForEmployee(record: StaffRecord): number {
    const assignment = salaryAssignments.find((item) => item.staffUserId === record.userId)
    const structure = salaryStructures.find((item) => item.id === assignment?.structureId)
    const person = users.find((item) => item.id === record.userId)
    const baseBasic = assignment?.basicOverride ?? structure?.basic ?? record.salary
    return salaryBasicForPeriod({
      baseBasic,
      staffUserId: record.userId,
      period: currentPayrollPeriod(),
      hireDate: record.hireDate,
      department: record.department,
      salaryStructureId: assignment?.structureId,
      active: person?.status === 'active',
      settings: salaryIncreaseSettings,
    })
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFormError('')
  }

  function beginNew() {
    setSelectedId('')
    setForm(emptyForm())
    setEmployeeIdFilter('')
    setPendingFiles(emptyFiles())
    setApprovalComment('')
    setFormError('')
    setPromotionFormOpen(true)
  }

  function selectDepartment(department: string) {
    if (form.department.trim().toLocaleLowerCase() === department.trim().toLocaleLowerCase()) return
    setForm((current) => ({
      ...emptyForm(),
      effectiveDate: current.effectiveDate,
      processingDate: current.processingDate,
      promotionType: current.promotionType,
      department,
    }))
    setEmployeeIdFilter('')
    setPendingFiles(emptyFiles())
    setApprovalComment('')
    setFormError('')
  }

  function openRecord(record: EmployeePromotionRecord) {
    setSelectedId(record.id)
    setForm(toForm(record))
    setEmployeeIdFilter(record.employeeId || record.employeeStaffId)
    setPendingFiles(emptyFiles())
    setApprovalComment('')
    setFormError('')
    setPromotionFormOpen(true)
  }

  function selectEmployee(staffId: string) {
    if (isLocked) {
      toast.error('The employee cannot be changed after the approval or payroll workflow has started.')
      return
    }
    const employee = activeStaff.find((record) => record.id === staffId)
    if (!employee) {
      setForm((current) => ({
        ...emptyForm(),
        effectiveDate: current.effectiveDate,
        processingDate: current.processingDate,
        promotionType: current.promotionType,
        department: current.department,
      }))
      setPendingFiles(emptyFiles())
      setFormError('')
      return
    }
    const latestProcessed = records
      .filter((record) => record.employeeStaffId === employee.id && record.status === 'Processed to Payroll')
      .sort((a, b) => dateForSort(b.effectiveDate).localeCompare(dateForSort(a.effectiveDate)))[0]
    const person = users.find((item) => item.id === employee.userId)
    const assignment = salaryAssignments.find((item) => item.staffUserId === employee.userId)
    const assignedStructure = salaryStructures.find((item) => item.id === assignment?.structureId)
    setForm((current) => ({
      ...emptyForm(),
      effectiveDate: current.effectiveDate,
      processingDate: current.processingDate,
      promotionType: current.promotionType,
      employeeStaffId: employee.id,
      employeeUserId: employee.userId,
      employeeId: employee.employeeNumber || employee.userId,
      employeeName: person?.name || employee.employeeNumber || employee.userId,
      department: employee.department,
      directorateUnit: employee.directorateUnit || '',
      employmentCategory: employee.employmentCategory || employee.staffCategory || '',
      currentTitle: employee.title || '',
      currentGrade: employee.currentGrade || latestProcessed?.newGrade || '',
      currentSalaryLevel: employee.salaryLevel || latestProcessed?.newSalaryLevel || '',
      currentSalaryStep: employee.salaryStep || latestProcessed?.newSalaryStep || '',
      newSalaryLevel: employee.salaryLevel || latestProcessed?.newSalaryLevel || '',
      newSalaryStep: employee.salaryStep || latestProcessed?.newSalaryStep || '',
      salaryAssignmentIdSnapshot: assignment?.id || '',
      salaryStructureIdSnapshot: assignedStructure?.id || '',
      salaryStructureNameSnapshot: assignedStructure?.name || '',
      oldSalary: String(currentBasicForEmployee(employee)),
    }))
    setPendingFiles(emptyFiles())
    setFormError('')
  }

  function inputFromForm(): EmployeePromotionDraftInput {
    return {
      employeeStaffId: form.employeeStaffId,
      employeeUserId: form.employeeUserId,
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      department: form.department,
      directorateUnit: form.directorateUnit,
      employmentCategory: form.employmentCategory,
      currentTitle: form.currentTitle,
      currentGrade: form.currentGrade,
      currentSalaryLevel: form.currentSalaryLevel,
      currentSalaryStep: form.currentSalaryStep,
      salaryAssignmentIdSnapshot: form.salaryAssignmentIdSnapshot,
      salaryStructureIdSnapshot: form.salaryStructureIdSnapshot,
      salaryStructureNameSnapshot: form.salaryStructureNameSnapshot,
      newJobTitle: form.newJobTitle,
      newGrade: form.newGrade,
      newSalaryLevel: form.newSalaryLevel,
      newSalaryStep: form.newSalaryStep,
      oldSalary: Number(form.oldSalary),
      newSalary: salaryFromForm(form),
      salaryChangeMode: form.salaryChangeMode,
      salaryChangeAmount: Number(form.salaryChangeAmount || 0),
      effectiveDate: form.effectiveDate,
      processingDate: form.processingDate,
      promotionType: form.promotionType,
      promotionBasis: form.promotionBasis,
      promotionLetterNumber: form.promotionLetterNumber,
      remarks: form.remarks,
    }
  }

  function validationContext(input: EmployeePromotionDraftInput) {
    const employee = staff.find((record) => record.id === input.employeeStaffId)
    const person = users.find((record) => record.id === input.employeeUserId)
    return {
      employeeActive: !!employee && person?.status === 'active',
      gradeOptions: promotionGrades,
      jobTitleOptions,
      promotionTypeOptions: selectablePromotionTypeOptions.map((option) => option.value),
      existingRecords: records,
      editingRecordId: selectedRecord?.id,
      legacyEffectiveMonths,
    }
  }

  function apiValidationContext(input: EmployeePromotionDraftInput) {
    const context = validationContext(input)
    return {
      employeeActive: context.employeeActive,
      gradeOptions: context.gradeOptions,
      jobTitleOptions: context.jobTitleOptions,
      promotionTypeOptions: context.promotionTypeOptions,
      legacyEffectiveMonths: context.legacyEffectiveMonths,
    }
  }

  function saveRecordToState(record: EmployeePromotionRecord) {
    const next = [record, ...records.filter((item) => item.id !== record.id)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    employeePromotionService.save(next, app.activeCompanyId)
    setRecords(next)
    setSelectedId(record.id)
    setForm(toForm(record))
    return next
  }

  function fileError(type: PromotionDocumentType, file: File): string {
    if (file.size > PROMOTION_DOCUMENT_MAX_BYTES) return `${file.name} is larger than 10 MB.`
    if ((type === 'promotion_letter' || type === 'approval_letter') && !isPdf(file)) {
      return `${documentTypeLabel(type)} must be a PDF file.`
    }
    if (type === 'supporting_document' && !/\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.name)) {
      return 'Supporting files must be PDF, DOC/DOCX, JPG or PNG.'
    }
    return ''
  }

  function chooseFiles(type: PromotionDocumentType, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const invalid = files.map((file) => fileError(type, file)).find(Boolean)
    if (invalid) { toast.error(invalid); return }
    setPendingFiles((current) => type === 'supporting_document'
      ? { ...current, supporting_document: [...current.supporting_document, ...files] }
      : { ...current, [type]: files[0] || null })
  }

  function removePendingFile(type: PromotionDocumentType, index?: number) {
    setPendingFiles((current) => {
      if (type === 'supporting_document') return { ...current, supporting_document: current.supporting_document.filter((_, i) => i !== index) }
      return { ...current, [type]: null }
    })
  }

  async function persistPendingFiles(record: EmployeePromotionRecord): Promise<EmployeePromotionRecord> {
    const selections: Array<{ type: PromotionDocumentType; file: File }> = []
    if (pendingFiles.promotion_letter) selections.push({ type: 'promotion_letter', file: pendingFiles.promotion_letter })
    if (pendingFiles.approval_letter) selections.push({ type: 'approval_letter', file: pendingFiles.approval_letter })
    pendingFiles.supporting_document.forEach((file) => selections.push({ type: 'supporting_document', file }))
    if (!selections.length) return record
    const metadata: PromotionDocument[] = []
    for (const selection of selections) {
      const storageKey = `${app.activeCompanyId || 'default'}/${record.id}/${uid('doc')}`
      await savePromotionDocument(storageKey, selection.file)
      metadata.push({
        id: uid('pdoc'),
        type: selection.type,
        fileName: selection.file.name,
        mimeType: inferredMimeType(selection.file),
        sizeBytes: selection.file.size,
        storageKey,
        uploadedAt: new Date().toISOString(),
        uploadedBy: actor.id,
        uploadedByName: actor.name,
      })
    }
    return employeePromotionService.attachDocuments(record, metadata, actor)
  }

  async function uploadPendingFilesApi(record: EmployeePromotionRecord): Promise<EmployeePromotionRecord> {
    const formData = new FormData()
    if (pendingFiles.promotion_letter) formData.append('promotion_letter', pendingFiles.promotion_letter)
    if (pendingFiles.approval_letter) formData.append('approval_letter', pendingFiles.approval_letter)
    pendingFiles.supporting_document.forEach((file) => formData.append('supporting_document', file))
    if (!formData.has('promotion_letter') && !formData.has('approval_letter') && !formData.has('supporting_document')) return record
    await employeePromotionApi.uploadDocuments(record.id, formData)
    return employeePromotionApi.get(record.id)
  }

  async function saveDraft(submitForApproval = false) {
    if (!canCreate) { toast.error('You do not have permission to create or submit promotions.'); return }
    if (!apiReady) { toast.info('Please wait', 'Checking the promotion service before saving.'); return }
    if (busy) return
    const input = inputFromForm()
    const mode = submitForApproval ? 'submit' : 'draft'
    const validation = validateEmployeePromotion(input, validationContext(input), mode)
    if (!validation.valid) {
      setFormError(validation.errors.join(' '))
      toast.error(submitForApproval ? 'Complete the required promotion details.' : 'Select an active employee before saving the draft.', validation.errors[0])
      return
    }
    if (selectedRecord && selectedRecord.status !== 'Draft' && selectedRecord.status !== 'Rejected') {
      toast.error('This promotion is locked because its approval workflow has started.')
      return
    }
    setBusy(true)
    try {
      let record: EmployeePromotionRecord
      const serverContext = apiValidationContext(input)
      if (apiMode) {
        record = selectedRecord
          ? await employeePromotionApi.update(selectedRecord.id, input, serverContext)
          : await employeePromotionApi.create(input, serverContext)
        record = await uploadPendingFilesApi(record)
        if (submitForApproval) record = await employeePromotionApi.submit(record.id, serverContext)
      } else {
        record = selectedRecord
          ? employeePromotionService.updateDraft(selectedRecord, input, actor)
          : employeePromotionService.createDraft(input, actor, app.activeCompanyId, records)
        record = await persistPendingFiles(record)
        if (submitForApproval) record = employeePromotionService.submit(record, actor)
      }
      saveRecordToState(record)
      setPendingFiles(emptyFiles())
      setFormError('')
      setApprovalComment('')
      if (submitForApproval) {
        log(actor.id, 'SUBMIT', 'Employee Promotion', `Submitted ${record.promotionReferenceNumber} for approval`)
        toast.success('Promotion submitted', 'Approval will begin with the HR Officer.')
      } else {
        log(actor.id, selectedRecord ? 'UPDATE' : 'CREATE', 'Employee Promotion', `${selectedRecord ? 'Saved' : 'Created'} ${record.promotionReferenceNumber}`)
        toast.success('Promotion draft saved', 'Open the promotion register to review the request.')
      }
    } catch (error) {
      toast.error('Unable to save promotion', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function decideApproval(action: 'approve' | 'reject') {
    if (!selectedRecord || !mayApprove || busy) return
    setBusy(true)
    try {
      const next = apiMode
        ? await employeePromotionApi.decide(selectedRecord.id, { decision: action, comments: approvalComment })
        : action === 'approve'
          ? employeePromotionService.approve(selectedRecord, actor, approvalComment)
          : employeePromotionService.reject(selectedRecord, actor, approvalComment)
      saveRecordToState(next)
      log(actor.id, action === 'approve' ? 'APPROVE' : 'REJECT', 'Employee Promotion', `${action === 'approve' ? 'Approved' : 'Rejected'} ${selectedRecord.promotionReferenceNumber} at ${currentApproval?.level}`)
      setApprovalComment('')
      toast.success(action === 'approve' ? 'Approval recorded' : 'Promotion rejected', next.status === 'Approved' ? 'All four approval levels are complete.' : undefined)
    } catch (error) {
      toast.error('Approval action failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function requestPayrollProcessing() {
    if (!selectedRecord || selectedRecord.status !== 'Approved') return
    if (!canProcess) { toast.error('Only a Payroll Administrator or an authorized company/HR manager can process promotions to payroll.'); return }
    const employee = staff.find((record) => record.id === selectedRecord.employeeStaffId)
    const employeeUser = users.find((record) => record.id === selectedRecord.employeeUserId)
    if (!employee || employeeUser?.status !== 'active') { toast.error('The employee must still be active to process this promotion.'); return }
    const assignment = salaryAssignments.find((item) => item.staffUserId === selectedRecord.employeeUserId)
    const structure = salaryStructures.find((item) => item.id === assignment?.structureId)
    if (!assignment || !structure) {
      toast.error('Assign this employee to a valid salary structure before processing.', 'The existing structure assignment will be preserved; promotion processing will not replace it.')
      return
    }
    const payrollPeriod = selectedRecord.processingDate.slice(0, 7)
    const paidSlip = payslips.find((item) => item.staffUserId === selectedRecord.employeeUserId && item.period === payrollPeriod && item.status === 'paid')
    if (paidSlip) {
      toast.error('This payroll period is already paid.', 'Set the processing date to the next open payroll period before processing the arrears.')
      return
    }
    setProcessConfirmOpen(true)
  }

  async function processToPayroll() {
    if (!selectedRecord || selectedRecord.status !== 'Approved' || !canProcess || busy) return
    const employee = staff.find((record) => record.id === selectedRecord.employeeStaffId)
    const employeeUser = users.find((record) => record.id === selectedRecord.employeeUserId)
    const assignment = salaryAssignments.find((item) => item.staffUserId === selectedRecord.employeeUserId)
    const structure = salaryStructures.find((item) => item.id === assignment?.structureId)
    if (!employee || employeeUser?.status !== 'active' || !assignment || !structure) {
      toast.error('Employee or payroll assignment is no longer valid. Refresh and check the employee master.')
      setProcessConfirmOpen(false)
      return
    }
    const paidInPeriod = payslips.some((item) => item.staffUserId === selectedRecord.employeeUserId && item.period === selectedRecord.processingDate.slice(0, 7) && item.status === 'paid')
    if (paidInPeriod) {
      toast.error('This payroll period has been paid since the confirmation opened.', 'Select the next open processing period and review arrears before retrying.')
      setProcessConfirmOpen(false)
      return
    }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const latestSettings = loadSalaryIncreaseSettings()
      const payrollPeriod = selectedRecord.processingDate.slice(0, 7)
      const payrollBase = assignment.basicOverride ?? structure.basic
      const payrollInput = {
        baseBasic: payrollBase,
        staffUserId: selectedRecord.employeeUserId,
        period: payrollPeriod,
        hireDate: employee.hireDate,
        department: employee.department,
        salaryStructureId: assignment.structureId,
        active: employeeUser.status === 'active',
      }
      const baselineAtProcessing = salaryBasicForPeriod({ ...payrollInput, settings: latestSettings })
      if (selectedRecord.newSalary < baselineAtProcessing) {
        toast.error('New salary is below the basic already scheduled for the processing period.', `Current projected payroll basic is ${formatGhs(baselineAtProcessing)} for ${payrollPeriod}.`)
        setProcessConfirmOpen(false)
        return
      }
      const salaryIncreaseId = selectedRecord.newSalary > baselineAtProcessing ? uid('sir') : undefined
      const payrollAdjustmentId = selectedRecord.totalArrearsPayable > 0 ? uid('pa') : undefined
      let scheduledIncreaseAmount = 0
      let scheduledIncreaseType: ManualSalaryIncrease['amountType'] = 'fixed'
      if (salaryIncreaseId) {
        const projectedWith = (amount: number, amountType: ManualSalaryIncrease['amountType'] = 'fixed') => {
          const candidate: ManualSalaryIncrease = {
            id: salaryIncreaseId,
            amountType,
            amount,
            effectivePeriod: payrollPeriod,
            staffUserIds: [selectedRecord.employeeUserId],
            target: { scope: 'individual', values: [selectedRecord.employeeUserId] },
            note: `IPPD promotion ${selectedRecord.promotionReferenceNumber}`,
            createdAt: now,
          }
          return salaryBasicForPeriod({
            ...payrollInput,
            settings: { ...latestSettings, manualIncreases: [...latestSettings.manualIncreases, candidate] },
          })
        }
        let matchesRequestedMethod = false
        if (selectedRecord.salaryChangeMode === 'fixed' || selectedRecord.salaryChangeMode === 'percent') {
          const requestedAmount = selectedRecord.salaryChangeAmount || 0
          if (projectedWith(requestedAmount, selectedRecord.salaryChangeMode) === selectedRecord.newSalary) {
            scheduledIncreaseType = selectedRecord.salaryChangeMode
            scheduledIncreaseAmount = requestedAmount
            matchesRequestedMethod = true
          }
        }
        if (!matchesRequestedMethod) {
          let low = 0
          let high = Math.max(1, selectedRecord.newSalary - baselineAtProcessing)
          while (projectedWith(high) < selectedRecord.newSalary && high < selectedRecord.newSalary * 10) high *= 2
          for (let i = 0; i < 48; i += 1) {
            const mid = (low + high) / 2
            if (projectedWith(mid) < selectedRecord.newSalary) low = mid
            else high = mid
          }
          const centerCents = Math.round(high * 100)
          const candidates = Array.from({ length: 21 }, (_, index) => Math.max(0, centerCents + index - 10) / 100)
          const exactAmount = candidates.find((amount) => projectedWith(amount) === selectedRecord.newSalary)
          if (exactAmount === undefined) throw new Error('Existing salary increase policies prevent the promotion basic from matching the approved amount in this payroll period.')
          scheduledIncreaseAmount = exactAmount
          scheduledIncreaseType = 'fixed'
        }
      }
      const transactions: PromotionPayrollTransaction[] = [
        {
          id: uid('ptrans'),
          type: 'salary_adjustment',
          amount: selectedRecord.salaryDifference,
          period: payrollPeriod,
          effectiveDate: selectedRecord.effectiveDate,
          salaryIncreaseId,
          createdAt: now,
        },
        {
          id: uid('ptrans'),
          type: 'promotion_arrears',
          amount: selectedRecord.totalArrearsPayable,
          period: payrollPeriod,
          effectiveDate: selectedRecord.effectiveDate,
          payrollAdjustmentId,
          createdAt: now,
        },
      ]
      const processedRecord = apiMode
        ? await employeePromotionApi.processToPayroll(selectedRecord.id, {
          salaryIncreaseId, payrollAdjustmentId,
          employeeActive: employeeUser.status === 'active',
          salaryAssignmentExists: !!assignment && !!structure,
          payrollPeriodPaid: paidInPeriod,
        })
        : employeePromotionService.markProcessed(selectedRecord, actor, transactions)
      if (salaryIncreaseId) {
        const requestedChange = selectedRecord.salaryChangeMode === 'target'
          ? 'approved target basic'
          : `requested ${selectedRecord.salaryChangeMode === 'percent' ? `${selectedRecord.salaryChangeAmount}%` : formatGhs(selectedRecord.salaryChangeAmount || 0)} increase`
        const actualChange = `${scheduledIncreaseType === 'percent' ? `${scheduledIncreaseAmount}%` : formatGhs(scheduledIncreaseAmount)} scheduled`
        const manualIncrease: ManualSalaryIncrease = {
          id: salaryIncreaseId,
          amountType: scheduledIncreaseType,
          amount: scheduledIncreaseAmount,
          effectivePeriod: payrollPeriod,
          staffUserIds: [selectedRecord.employeeUserId],
          target: { scope: 'individual', values: [selectedRecord.employeeUserId] },
          note: `IPPD promotion ${selectedRecord.promotionReferenceNumber}${selectedRecord.newJobTitle ? ` · ${selectedRecord.newJobTitle}` : ''} (${requestedChange}; ${actualChange}; formal effective date ${selectedRecord.effectiveDate})`,
          createdAt: now,
        }
        const nextSettings: SalaryIncreaseSettings = { ...latestSettings, manualIncreases: [manualIncrease, ...latestSettings.manualIncreases] }
        saveSalaryIncreaseSettings(nextSettings)
        setSalaryIncreaseSettings(nextSettings)
      }
      upsertStaff({
        ...employee,
        title: selectedRecord.newJobTitle || employee.title,
        salary: selectedRecord.newSalary,
        currentGrade: selectedRecord.newGrade,
        salaryLevel: selectedRecord.newSalaryLevel,
        salaryStep: selectedRecord.newSalaryStep,
        directorateUnit: selectedRecord.directorateUnit || employee.directorateUnit,
        employmentCategory: selectedRecord.employmentCategory || employee.employmentCategory,
      })
      if (payrollAdjustmentId) {
        const arrearsAdjustment: PayrollAdjItem = {
          id: payrollAdjustmentId,
          staffUserId: selectedRecord.employeeUserId,
          kind: 'bonus',
          amount: selectedRecord.totalArrearsPayable,
          period: payrollPeriod,
          note: `Promotion arrears · ${selectedRecord.promotionReferenceNumber} · effective ${selectedRecord.effectiveDate}`,
        }
        upsertPayrollAdj(arrearsAdjustment)
      }
      saveRecordToState(processedRecord)
      log(actor.id, 'PROCESS', 'Employee Promotion', `Processed ${selectedRecord.promotionReferenceNumber} to payroll; preserved salary structure ${structure.name}`)
      toast.success('Promotion processed to payroll', selectedRecord.totalArrearsPayable > 0
        ? `${formatGhs(selectedRecord.totalArrearsPayable)} arrears added to ${payrollPeriod}. Regenerate draft payroll for the change to appear on the payslip.`
        : `Basic salary change is applied from ${payrollPeriod}; the formal effective date is ${selectedRecord.effectiveDate}. Regenerate draft payroll for the change to appear on the payslip.`)
    } catch (error) {
      toast.error('Payroll processing failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
      setProcessConfirmOpen(false)
    }
  }

  function cancelLegacyScheduled(record: PromotionChangeRecord) {
    if (!canCreate && !canProcess) { toast.error('You do not have permission to cancel a scheduled payroll change.'); return }
    if (record.effectivePeriod <= currentPayrollPeriod()) { toast.error('An effective payroll change cannot be cancelled here.'); return }
    const latestSettings = loadSalaryIncreaseSettings()
    const nextRecords = legacyChanges.filter((item) => item.id !== record.id)
    const nextSettings: SalaryIncreaseSettings = {
      ...latestSettings,
      manualIncreases: latestSettings.manualIncreases.filter((item) => item.id !== record.salaryIncreaseId),
    }
    savePromotionChanges(nextRecords)
    saveSalaryIncreaseSettings(nextSettings)
    setLegacyChanges(nextRecords)
    setSalaryIncreaseSettings(nextSettings)
    log(actor.id, 'DELETE', 'Payroll', `Cancelled legacy scheduled ${promotionChangeLabel(record.changeKind).toLowerCase()} for ${users.find((person) => person.id === record.staffUserId)?.name || record.staffUserId} (${record.effectivePeriod})`)
    toast.success('Scheduled change cancelled', 'New promotions and grade changes must be submitted through the approval workflow.')
  }

  async function documentBlob(document: PromotionDocument): Promise<Blob | undefined> {
    if (apiMode && selectedRecord) return employeePromotionApi.documentBlob(selectedRecord.id, document.id)
    return (await getPromotionDocument(document.storageKey))?.blob
  }

  async function downloadDocument(document: PromotionDocument) {
    try {
      const blob = await documentBlob(document)
      if (!blob) { toast.error('Document file is missing.'); return }
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.fileName
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      toast.error('Unable to download document', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  async function viewDocument(document: PromotionDocument) {
    try {
      const blob = await documentBlob(document)
      if (!blob) { toast.error('Document file is missing.'); return }
      const url = URL.createObjectURL(blob)
      setPreviewDocument({ url, fileName: document.fileName, mimeType: document.mimeType })
    } catch (error) {
      toast.error('Unable to open document', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const rows = useMemo(() => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [records])
  const registerTypeOptions = [...new Set(rows.map((record) => record.promotionType))]
    .sort((a, b) => promotionTypeLabel(a).localeCompare(promotionTypeLabel(b)))
  const registerStatuses: EmployeePromotionRecord['status'][] = [
    'Draft', 'Pending Approval', 'Approved', 'Rejected', 'Processed to Payroll',
  ]
  const promotionWorkflowFor = (record: EmployeePromotionRecord) =>
    record.approvals.find((item) => item.status === 'Pending')?.level
      || (record.status === 'Approved' ? 'Ready for payroll' : record.status === 'Processed to Payroll' ? 'Complete' : '—')
  const searchTokens = registerSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filteredRows = rows.filter((record) => {
    const effectiveDay = String(record.effectiveDate || '').slice(0, 10)
    const employeeUserId = record.employeeUserId || staff.find((item) => item.id === record.employeeStaffId)?.userId || ''
    if (!matchesStaffUserId(employeeUserId, staff, users, staffFilters)) return false
    if (registerTypeFilter !== 'all' && record.promotionType !== registerTypeFilter) return false
    if (registerStatusFilter !== 'all' && record.status !== registerStatusFilter) return false
    if (registerEffectiveFrom && effectiveDay < registerEffectiveFrom) return false
    if (registerEffectiveTo && effectiveDay > registerEffectiveTo) return false
    if (!searchTokens.length) return true
    const searchableText = [
      record.promotionReferenceNumber, record.employeeName, record.employeeId, record.employeeStaffId, record.department,
      record.promotionType, promotionTypeLabel(record.promotionType), record.currentTitle, record.currentGrade,
      record.newJobTitle, record.newGrade, record.newSalaryLevel, record.newSalaryStep,
      record.effectiveDate, record.processingDate, record.status, promotionWorkflowFor(record),
      record.approvals.map((approval) => approval.level).join(' '), record.oldSalary, record.newSalary,
      record.salaryChangeAmount, record.totalArrearsPayable, record.createdAt, record.updatedAt,
    ].map((value) => String(value ?? '')).join(' ').toLocaleLowerCase()
    return searchTokens.every((token) => searchableText.includes(token))
  })
  const registerExportRows = filteredRows.map((record) => ({
    'Promotion reference': record.promotionReferenceNumber,
    Employee: record.employeeName,
    'Employee no.': record.employeeId,
    Department: record.department,
    Type: promotionTypeLabel(record.promotionType),
    'Current title': record.currentTitle,
    'Proposed title': record.newJobTitle,
    'Current grade': record.currentGrade,
    'Proposed grade': record.newGrade,
    'Proposed salary level': record.newSalaryLevel,
    'Proposed salary step': record.newSalaryStep,
    'Current basic': record.oldSalary,
    'Proposed basic': record.newSalary,
    'Pay change': record.salaryChangeMode === 'fixed' || record.salaryChangeMode === 'percent'
      ? describeSalaryIncrease(record.salaryChangeMode, record.salaryChangeAmount || 0)
      : 'Target basic',
    'Effective date': record.effectiveDate,
    Arrears: record.totalArrearsPayable,
    Status: record.status,
    Workflow: promotionWorkflowFor(record),
  }))
  const dashboardArrears = records
    .filter((record) => record.status === 'Pending Approval' || record.status === 'Approved' || record.status === 'Processed to Payroll')
    .reduce((total, record) => total + record.totalArrearsPayable, 0)
  const totals = {
    promotions: records.length,
    pending: records.filter((record) => record.status === 'Pending Approval').length,
    approved: records.filter((record) => record.status === 'Approved').length,
    processed: records.filter((record) => record.status === 'Processed to Payroll').length,
  }
  const columns: Column<EmployeePromotionRecord>[] = [
    { key: 'ref', header: 'Promotion reference', sortValue: (record) => record.promotionReferenceNumber, render: (record) => <button className="text-left font-bold text-lime hover:underline" onClick={() => openRecord(record)}>{record.promotionReferenceNumber}</button> },
    { key: 'employee', header: 'Employee', sortValue: (record) => record.employeeName, render: (record) => <div><p className="font-semibold">{record.employeeName}</p><p className="text-xs text-mist">{record.employeeId} · {record.department}</p></div> },
    { key: 'type', header: 'Type', sortValue: (record) => promotionTypeLabel(record.promotionType), render: (record) => promotionTypeLabel(record.promotionType) },
    { key: 'effective', header: 'Effective', sortValue: (record) => record.effectiveDate, render: (record) => formatDate(record.effectiveDate) },
    { key: 'grade', header: 'Proposed grade', sortValue: (record) => record.newGrade, render: (record) => <div><p className="font-semibold">{record.newGrade || '—'}</p><p className="text-xs text-mist">{record.newSalaryLevel}{record.newSalaryStep ? ` · ${record.newSalaryStep}` : ''}</p></div> },
    { key: 'salary', header: 'Proposed basic / pay change', sortValue: (record) => record.newSalary, render: (record) => <div><p className="font-semibold">{formatGhs(record.newSalary)}</p><p className="text-xs text-mist">{record.salaryChangeMode === 'fixed' || record.salaryChangeMode === 'percent' ? describeSalaryIncrease(record.salaryChangeMode, record.salaryChangeAmount || 0) : 'Target basic'}</p></div> },
    { key: 'arrears', header: 'Arrears', sortValue: (record) => record.totalArrearsPayable, render: (record) => formatGhs(record.totalArrearsPayable) },
    { key: 'status', header: 'Status', sortValue: (record) => record.status, render: (record) => <Badge tone={statusTone(record.status)}>{record.status}</Badge> },
    { key: 'approval', header: 'Workflow', sortValue: (record) => record.approvals.find((item) => item.status === 'Pending')?.level || '', render: (record) => record.approvals.find((item) => item.status === 'Pending')?.level || (record.status === 'Approved' ? 'Ready for payroll' : record.status === 'Processed to Payroll' ? 'Complete' : '—') },
    { key: 'actions', header: 'Action', render: (record) => <Button size="sm" variant="outline" onClick={() => openRecord(record)}>Open</Button> },
  ]

  const processPeriod = selectedRecord?.processingDate.slice(0, 7) || ''
  const documentCount = (selectedRecord?.documents.length || 0)
    + Number(!!pendingFiles.promotion_letter)
    + Number(!!pendingFiles.approval_letter)
    + pendingFiles.supporting_document.length
  const salaryStructure = selectedRecord ? salaryStructures.find((item) => item.id === salaryAssignments.find((a) => a.staffUserId === selectedRecord.employeeUserId)?.structureId) : undefined

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Promotions &amp; Change of Grade</span>
      </div>
      <PageHeader
        title="Promotions & Change of Grade"
        desc="Manage promotions, annual increments, upgrading, regrading and grade changes in one auditable request and approval workflow."
        actions={canCreate ? <Button variant="outline" onClick={beginNew}><Plus className="size-4" /> New promotion</Button> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Promotions" value={String(totals.promotions)} icon={<FileText className="size-4" />} />
        <StatCard label="Pending approval" value={String(totals.pending)} icon={<CalendarClock className="size-4" />} />
        <StatCard label="Approved" value={String(totals.approved)} icon={<BadgeCheck className="size-4" />} />
        <StatCard label="Processed to payroll" value={String(totals.processed)} icon={<ClipboardCheck className="size-4" />} />
        <StatCard label="Promotion arrears" value={formatGhs(dashboardArrears)} icon={<CircleDollarSign className="size-4" />} hint="Pending, approved and processed forms" />
      </div>

      <Modal
        open={promotionFormOpen}
        onClose={() => setPromotionFormOpen(false)}
        title={selectedRecord ? 'Review promotion request' : 'New promotion request'}
        xl
      >
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Promotion request</p>
              <p className="mt-1 text-xs text-mist">Enter the proposed appointment and pay details, then submit for approval.</p>
            </div>
            <Badge tone={selectedRecord ? statusTone(selectedRecord.status) : 'zinc'}>{selectedRecord?.status || 'Not saved'}</Badge>
          </div>

          {formError && <div role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-500">{formError}</div>}
          {isLocked && <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><span>This form is locked while the approval or payroll workflow is active. Use the workflow controls below to continue.</span></div>}

          <div className="grid gap-4">
            <section className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-lime/15 text-lime"><FileText className="size-4" /></span><h3 className="font-bold">Employee and request</h3></div>
              <div className="grid max-w-5xl gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field label="Department" hint={selectedRecord && isLocked ? 'Department is locked after the approval workflow starts.' : 'Choose a department to filter the employee list.'} required>
                  <Select value={form.department} disabled={isLocked} onChange={(event) => selectDepartment(event.target.value)} placeholder="Select department…">
                    <option value="">Select department…</option>
                    {form.department && !departmentOptions.includes(form.department) && <option value={form.department}>{form.department} (legacy)</option>}
                    {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                  </Select>
                </Field>
                <Field label="Employee no. / Staff ID" hint={isLocked ? 'Employee identification is locked after the approval workflow starts.' : form.department ? 'Search employee number, staff record ID, or user ID.' : 'Select a department first.'}>
                  <Input value={employeeIdFilter} disabled={isLocked || !form.department} onChange={(event) => setEmployeeIdFilter(event.target.value)} placeholder="Search employee no. or staff ID…" />
                </Field>
                <Field label="Employee name" hint={isLocked ? 'Employee is locked after the approval workflow starts.' : form.department ? 'Choose an active employee in the selected department.' : 'Select a department first.'} required>
                  <Select value={form.employeeStaffId} disabled={isLocked || !form.department} onChange={(event) => selectEmployee(event.target.value)} placeholder={form.department ? 'Select employee…' : 'Select department first…'}>
                    <option value="">{employeeIdFilter.trim() && !employeeIdMatches.length ? 'No employees match this ID.' : form.department ? 'Select employee…' : 'Select department first…'}</option>
                    {employeeSelectOptions.map((record) => {
                      const isActive = users.some((person) => person.id === record.userId && person.status === 'active')
                      const name = selectedRecord?.employeeStaffId === record.id ? form.employeeName : employeeName(record)
                      return <option key={record.id} value={record.id}>{name}{record.employeeNumber || record.id ? ` — ${record.employeeNumber || record.id}` : ''}{!isActive ? ' (inactive/legacy)' : ''}</option>
                    })}
                  </Select>
                </Field>
              </div>
              {form.employeeStaffId && <div className="mt-3 grid gap-2 rounded-xl border border-line px-3 py-2 sm:grid-cols-3">
                <div><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Employee</span><p className="text-sm font-semibold">{form.employeeName}</p></div>
                <div><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Employee ID</span><p className="text-sm font-semibold">{form.employeeId}</p></div>
                <div><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Department</span><p className="text-sm font-semibold">{form.department || '—'}</p></div>
              </div>}
            </section>

            <section className="rounded-2xl border border-line p-4">
              <div className="mb-4 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-lime/15 text-lime"><ArrowRight className="size-4" /></span><div><h3 className="font-bold">Promotion / grade-change particulars</h3><p className="text-xs text-mist">Record the employee’s current appointment and the proposed change together.</p></div></div>
              {(!promotionGrades.length || !jobTitleOptions.length || !activePromotionTypeOptions.length) && <div className="mb-4 space-y-1 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                {!promotionGrades.length && <p>Configure <strong>Promotion Grades</strong> in HR Admin → Job Settings → Grades before submitting.</p>}
                {!jobTitleOptions.length && <p>Configure <strong>Job Title</strong> in HR Admin → Job Settings before submitting.</p>}
                {!activePromotionTypeOptions.length && <p>Configure at least one active <strong>Promotion Type</strong> in HR Admin → Job Settings before submitting.</p>}
              </div>}

              <div>
                <div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-md bg-sky-500/10 text-sky-500"><CircleDollarSign className="size-3.5" /></span><h4 className="text-sm font-bold">Current appointment and pay</h4></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Current grade" hint="Auto-filled from the employee master; verify legacy data before submission." required>
                    <Select value={form.currentGrade} disabled={isLocked} onChange={(event) => { setField('currentGrade', event.target.value); setField('newGrade', '') }} placeholder="Select current grade…">
                      <option value="">Select current grade…</option>
                      {form.currentGrade && !promotionGrades.includes(form.currentGrade) && <option value={form.currentGrade}>{form.currentGrade} (legacy)</option>}
                      {promotionGrades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                    </Select>
                  </Field>
                  <div className="rounded-xl border border-line px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Current job title</span><p className="mt-1 text-sm font-semibold">{form.currentTitle || '—'}</p></div>
                  <div className="rounded-xl border border-line bg-lime/5 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Current basic salary</span><p className="mt-1 text-sm font-bold">{form.employeeStaffId ? formatGhs(Number(form.oldSalary)) : '—'}</p></div>
                </div>
                {form.employeeStaffId && (!form.newSalaryLevel.trim() || !form.newSalaryStep.trim()) && <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">The employee’s salary level or step is missing from the employee record. Complete the employee record before submitting this promotion.</p>}
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center rounded-md bg-lime/15 text-lime"><ArrowRight className="size-3.5" /></span><h4 className="text-sm font-bold">Proposed appointment and pay</h4></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Promotion type" required>
                    <Select value={form.promotionType} disabled={isLocked} onChange={(event) => setField('promotionType', event.target.value as EmployeePromotionType)} placeholder="Select promotion type…">
                      <option value="">Select promotion type…</option>
                      {selectablePromotionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Proposed job title" hint="Select from HR Admin → Job Settings → Job Title." required={form.promotionType === 'promotion'}>
                    <Select value={form.newJobTitle} disabled={isLocked} onChange={(event) => setField('newJobTitle', event.target.value)} placeholder="Select job title…">
                      <option value="">Select job title…</option>
                      {form.newJobTitle && !jobTitleOptions.includes(form.newJobTitle) && <option value={form.newJobTitle}>{form.newJobTitle} (inactive/legacy)</option>}
                      {jobTitleOptions.map((title) => <option key={title} value={title}>{title}</option>)}
                    </Select>
                  </Field>
                  <Field label="Proposed grade" hint="Choose from Promotion Grades in HR Admin → Job Settings → Grades; only higher-ranked grades are shown." required>
                    <Select value={form.newGrade} disabled={isLocked || !promotionGrades.length} onChange={(event) => setField('newGrade', event.target.value)} placeholder="Select proposed grade…">
                      <option value="">Select proposed grade…</option>
                      {form.newGrade && !proposedGradeOptions.includes(form.newGrade) && <option value={form.newGrade}>{form.newGrade} (legacy)</option>}
                      {proposedGradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-line p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mist">Pay adjustment</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Method" required>
                        <Select value={form.salaryChangeMode} disabled={isLocked} onChange={(event) => setField('salaryChangeMode', event.target.value as PromotionSalaryChangeMode)}>
                          <option value="target">Enter proposed basic</option>
                          <option value="fixed">Fixed increase (GHS)</option>
                          <option value="percent">Percentage increase</option>
                        </Select>
                      </Field>
                      {form.salaryChangeMode === 'target'
                        ? <Field label="Proposed basic salary (GHS)" required><Input type="number" min="0.01" step="0.01" value={form.newSalary} disabled={isLocked} onChange={(event) => setField('newSalary', event.target.value)} placeholder="Enter approved basic" /></Field>
                        : <Field label={form.salaryChangeMode === 'percent' ? 'Increase (%)' : 'Increase amount (GHS)'} required><Input type="number" min="0.01" max={form.salaryChangeMode === 'percent' ? 100 : undefined} step="0.01" value={form.salaryChangeAmount} disabled={isLocked} onChange={(event) => setField('salaryChangeAmount', event.target.value)} placeholder={form.salaryChangeMode === 'percent' ? 'e.g. 10' : 'e.g. 500'} /></Field>}
                      <Field label="Effective date" hint="The payroll effective month is derived from this date; retroactive months become arrears." required><Input type="date" value={form.effectiveDate} disabled={isLocked} onChange={(event) => setField('effectiveDate', event.target.value)} /></Field>
                    </div>
                    {form.salaryChangeMode !== 'target' && form.salaryChangeAmount && <p className="mt-2 text-xs text-mist">Calculated proposed basic: <strong className="text-ink">{formatGhs(salaryFromForm(form))}</strong></p>}
                  </div>

                  <Field label="Basis / reason for change" required className="sm:col-span-2 lg:col-span-3"><Textarea value={form.promotionBasis} disabled={isLocked} onChange={(event) => setField('promotionBasis', event.target.value)} placeholder="e.g. performance review, approved regrading, upgrading" /></Field>
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-line px-3 py-2">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  <span>Additional request details</span>
                  <span className="text-xs font-normal text-mist">Processing date {form.processingDate || 'not set'} · letter reference · remarks</span>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
                  <Field label="Processing date" hint="Defaults to today; used for arrears and payroll processing." required><Input type="date" value={form.processingDate} disabled={isLocked} onChange={(event) => setField('processingDate', event.target.value)} /></Field>
                  <Field label="Promotion letter reference no."><Input value={form.promotionLetterNumber} disabled={isLocked} onChange={(event) => setField('promotionLetterNumber', event.target.value)} placeholder="Enter letter reference" /></Field>
                  <Field label="HR remarks" className="sm:col-span-2"><Textarea value={form.remarks} disabled={isLocked} onChange={(event) => setField('remarks', event.target.value)} placeholder="Additional HR / payroll notes" /></Field>
                  <div className="rounded-xl border border-line px-3 py-2 sm:col-span-2"><span className="text-[10px] font-bold uppercase tracking-wider text-mist">Current salary structure reference</span><p className="mt-1 text-sm font-semibold">{form.salaryStructureNameSnapshot || 'No existing assignment recorded'}</p><p className="mt-1 text-xs text-mist">Reference only. Processing will not create or replace the employee’s salary assignment.</p></div>
                </div>
              </details>
              <div className="mt-3 text-xs text-mist">Grades are ordered highest-to-lowest in HR Admin → Job Settings → Grades; job titles come from HR Admin → Job Settings → Job Title.</div>
            </section>

            <section className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-500"><CircleDollarSign className="size-4" /></span><h3 className="font-bold">Salary comparison and arrears</h3><Badge tone="zinc">Automatically calculated · read-only</Badge></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Monthly salary difference" value={formatGhs(financials.salaryDifference)} />
                <Metric label="Months outstanding" value={String(financials.monthsOutstanding)} />
                <Metric label="Promotion arrears payable" value={formatGhs(financials.totalArrearsPayable)} emphasis />
              </div>
              <p className="mt-3 text-xs text-mist">Arrears = (proposed − current basic) × whole payroll months from the effective month to processing. Paid as a one-off adjustment in the processing payroll.</p>
            </section>

            <details className="rounded-2xl border border-line p-4" open={documentCount > 0}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-sky-500/10 text-sky-500"><Upload className="size-4" /></span><div><h3 className="font-bold">Letters and supporting documents</h3><p className="text-xs text-mist">Promotion letter, approval letter and supporting evidence</p></div></div>
                <Badge tone="zinc">{documentCount ? `${documentCount} attached` : 'Optional · 10 MB max per file'}</Badge>
              </summary>
              <div className="mt-4 border-t border-line pt-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <FilePicker label="Promotion letter (PDF)" accept="application/pdf,.pdf" disabled={isLocked} file={pendingFiles.promotion_letter} onChange={(event) => chooseFiles('promotion_letter', event)} onRemove={() => removePendingFile('promotion_letter')} />
                  <FilePicker label="Approval letter (PDF)" accept="application/pdf,.pdf" disabled={isLocked} file={pendingFiles.approval_letter} onChange={(event) => chooseFiles('approval_letter', event)} onRemove={() => removePendingFile('approval_letter')} />
                  <FilePicker label="Supporting documents" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" disabled={isLocked} multiple files={pendingFiles.supporting_document} onChange={(event) => chooseFiles('supporting_document', event)} onRemove={(index) => removePendingFile('supporting_document', index)} />
                </div>
                <div className="mt-4 space-y-2">
                  {(selectedRecord?.documents || []).length === 0 && !pendingFiles.promotion_letter && !pendingFiles.approval_letter && pendingFiles.supporting_document.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-sm text-mist">No documents attached yet.</p>}
                  {(selectedRecord?.documents || []).map((document) => <DocumentRow key={document.id} document={document} onView={() => viewDocument(document)} onDownload={() => downloadDocument(document)} />)}
                </div>
              </div>
            </details>

            <section className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-lime/15 text-lime"><ShieldCheck className="size-4" /></span><h3 className="font-bold">Approval workflow and audit trail</h3></div>
                <Badge tone={selectedRecord ? statusTone(selectedRecord.status) : 'zinc'}>{selectedRecord?.status || 'Draft not yet saved'}</Badge>
              </div>
              {selectedRecord ? <>
                <div className="grid gap-2 md:grid-cols-4">
                  {EMPLOYEE_PROMOTION_APPROVAL_LEVELS.map((level, index) => {
                    const approval = selectedRecord.approvals.find((item) => item.level === level)
                    const stepStatus = approval?.status || (selectedRecord.status === 'Draft' ? 'Waiting' : 'Waiting')
                    return <div key={level} className="relative rounded-xl border border-line p-3">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-current text-[11px] font-bold ${approvalTone(stepStatus)}`}>{approval?.status === 'Approved' ? <Check className="size-3.5" /> : index + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold">{level}</p>
                          <p className={`mt-0.5 text-[11px] font-semibold ${approvalTone(stepStatus)}`}>{stepStatus}</p>
                          {approval?.approvedByName && <p className="mt-1 text-[11px] text-mist">{approval.approvedByName} · {approval.approvedAt ? formatDate(approval.approvedAt.slice(0, 10)) : ''}</p>}
                          {approval?.comments && <p className="mt-1 text-[11px] text-mist">“{approval.comments}”</p>}
                        </div>
                      </div>
                    </div>
                  })}
                </div>
                {mayApprove && <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                  <p className="mb-2 text-sm font-semibold">Your approval is required · {currentApproval?.level}</p>
                  <Field label="Approval comments / rejection reason"><Textarea value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} placeholder="Add a decision note; a rejection reason is required." /></Field>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => decideApproval('reject')}><X className="size-4" /> Reject</Button>
                    <Button onClick={() => decideApproval('approve')}><Check className="size-4" /> Approve & route to next level</Button>
                  </div>
                </div>}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <AuditValue label="Created by" value={`${selectedRecord.createdByName} · ${formatDate(selectedRecord.createdAt.slice(0, 10))}`} />
                  <AuditValue label="Last modified by" value={`${selectedRecord.modifiedByName} · ${formatDate(selectedRecord.updatedAt.slice(0, 10))}`} />
                  {selectedRecord.approvedByName && <AuditValue label="Final approval" value={`${selectedRecord.approvedByName} · ${selectedRecord.approvedAt ? formatDate(selectedRecord.approvedAt.slice(0, 10)) : ''}`} />}
                  {selectedRecord.payrollProcessedByName && <AuditValue label="Payroll processed by" value={`${selectedRecord.payrollProcessedByName} · ${selectedRecord.payrollProcessedAt ? formatDate(selectedRecord.payrollProcessedAt.slice(0, 10)) : ''}`} />}
                </div>
                <div className="mt-4 rounded-xl border border-line p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="size-4 text-mist" /> Activity history</p>
                  {selectedRecord.auditTrail.length ? <ol className="space-y-2">
                    {[...selectedRecord.auditTrail].reverse().map((event) => <li key={event.id} className="flex gap-3 text-xs">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-lime" />
                      <span><strong>{event.action}</strong> · {event.actorName} ({event.actorRole}) · {new Date(event.at).toLocaleString()}{event.details ? ` · ${event.details}` : ''}</span>
                    </li>)}
                  </ol> : <p className="text-xs text-mist">No activity yet.</p>}
                </div>
                {!!selectedRecord.payrollTransactions.length && <div className="mt-3 rounded-xl border border-line p-3">
                  <p className="mb-2 text-sm font-bold">Payroll transactions</p>
                  <div className="space-y-2">
                    {selectedRecord.payrollTransactions.map((transaction) => <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>{transaction.type === 'salary_adjustment' ? 'Basic salary adjustment' : 'Promotion arrears'} · effective {transaction.effectiveDate} · period {transaction.period}</span>
                      <span className="font-bold">{formatGhs(transaction.amount)}</span>
                    </div>)}
                  </div>
                </div>}
              </> : <div className="rounded-xl border border-dashed border-line p-4 text-sm text-mist">Save a draft and submit it to begin the mandatory HR Officer → HR Manager → Finance Officer → Payroll Administrator approval route.</div>}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="max-w-2xl text-xs leading-relaxed text-mist">Payroll structure assignment is history-safe: processing applies the approved basic salary from the processing payroll month, records the formal effective date, and pays the effective-to-processing difference as arrears. The assigned salary structure is not replaced.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setPromotionFormOpen(false)}>Close</Button>
                {selectedRecord?.status === 'Approved' && canProcess && <Button onClick={requestPayrollProcessing}><FileCheck2 className="size-4" /> Process to payroll</Button>}
                {canCreate && !isLocked && <>
                  <Button variant="outline" disabled={busy || !apiReady} onClick={() => saveDraft(false)}>{busy ? 'Saving…' : !apiReady ? 'Connecting…' : 'Save draft'}</Button>
                  <Button disabled={busy || !apiReady} onClick={() => saveDraft(true)}><Send className="size-4" /> {busy ? 'Submitting…' : !apiReady ? 'Connecting…' : 'Submit for approval'}</Button>
                </>}
                {selectedRecord?.status === 'Processed to Payroll' && <Badge tone="lime"><Check className="mr-1 size-3.5" /> Payroll processed</Badge>}
              </div>
            </div>
          </div>
        </>
      </Modal>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="text-lg font-bold">Promotion &amp; grade-change register</h2><p className="text-sm text-mist">All unified requests and their approval/payroll state.</p></div>
          <Badge tone="zinc">{filteredRows.length === records.length ? `${records.length} record(s)` : `${filteredRows.length} of ${records.length} record(s)`}</Badge>
        </div>
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <SearchField
              value={registerSearch}
              onChange={setRegisterSearch}
              placeholder="Search reference, employee, grade…"
              className="w-full sm:w-64"
            />
            <Select value={registerTypeFilter} onChange={(event) => setRegisterTypeFilter(event.target.value)} className="w-full sm:w-48" aria-label="Filter by change type">
              <option value="all">All change types</option>
              {registerTypeOptions.map((type) => <option key={type} value={type}>{promotionTypeLabel(type)}</option>)}
            </Select>
            <Select value={registerStatusFilter} onChange={(event) => setRegisterStatusFilter(event.target.value)} className="w-full sm:w-48" aria-label="Filter by status">
              <option value="all">All statuses</option>
              {registerStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
            <div className="grid w-full grid-cols-1 gap-2 sm:w-[340px] sm:grid-cols-2">
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-semibold text-mist">Effective from</label>
                <DatePicker
                  value={registerEffectiveFrom}
                  onChange={setRegisterEffectiveFrom}
                  max={registerEffectiveTo || undefined}
                  aria-label="Effective date from"
                />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-semibold text-mist">Effective to</label>
                <DatePicker
                  value={registerEffectiveTo}
                  onChange={setRegisterEffectiveTo}
                  min={registerEffectiveFrom || undefined}
                  aria-label="Effective date to"
                />
              </div>
            </div>
            {(registerSearch.trim() || registerTypeFilter !== 'all' || registerStatusFilter !== 'all' || registerEffectiveFrom || registerEffectiveTo || staffFilters.department || staffFilters.staffId || staffFilters.status) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => {
                  setRegisterSearch('')
                  setStaffFilters(emptyStaffListFilters())
                  setRegisterTypeFilter('all')
                  setRegisterStatusFilter('all')
                  setRegisterEffectiveFrom('')
                  setRegisterEffectiveTo('')
                }}
              >
                <X className="size-3.5" /> Clear filters
              </Button>
            )}
            <span className="text-xs text-mist sm:ml-auto">{filteredRows.length} matching</span>
            {!!filteredRows.length && <ExportButtons
              filename="promotions-grade-change-register"
              rows={registerExportRows}
              className="w-full sm:ml-2 sm:w-auto"
              onDone={(label, ok) => (ok ? toast.success(`${label} export started`) : toast.error('Export blocked'))}
            />}
          </div>
          <div className="border-b border-line p-3">
            <StaffListFilters staff={staff} value={staffFilters} onChange={setStaffFilters} />
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            rowKey={(record) => record.id}
            pageSize={10}
            emptyTitle={records.length ? 'No matching promotion requests' : 'No promotion or grade-change requests'}
            emptyDesc={records.length ? 'Change the search or filters to see other requests.' : 'Create a request above to start the required approval and payroll workflow.'}
          />
        </div>
      </section>

      {!!companyLegacyChanges.length && <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Existing scheduled-change history</h2>
            <p className="text-sm text-mist">Earlier records are retained for audit. New promotion and grade-change requests must use the unified approval workflow above.</p>
          </div>
          <Badge tone="zinc">{filteredLegacyChanges.length}{filteredLegacyChanges.length !== companyLegacyChanges.length ? ` of ${companyLegacyChanges.length}` : ''} legacy record(s)</Badge>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-sm">
            <thead><tr className="border-b border-line bg-black/[0.02] text-left text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
              <th className="px-3 py-3">Employee</th><th className="px-3 py-3">Change</th><th className="px-3 py-3">New title / grade</th><th className="px-3 py-3">Structure reference</th><th className="px-3 py-3">Increase</th><th className="px-3 py-3">Effective month</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th>
            </tr></thead>
            <tbody>
              {[...filteredLegacyChanges].sort((a, b) => b.effectivePeriod.localeCompare(a.effectivePeriod) || b.createdAt.localeCompare(a.createdAt)).map((record) => {
                const scheduled = record.effectivePeriod > currentPayrollPeriod()
                const hasAdjustment = salaryIncreaseSettings.manualIncreases.some((increase) => increase.id === record.salaryIncreaseId)
                const status = !hasAdjustment ? 'Pay adjustment removed' : scheduled ? 'Scheduled · legacy' : 'Effective · legacy'
                const employee = staff.find((item) => item.userId === record.staffUserId)
                const personName = users.find((person) => person.id === record.staffUserId)?.name || employee?.employeeNumber || record.staffUserId
                return <tr key={record.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 font-semibold">{personName}</td>
                  <td className="px-3 py-2.5">{promotionChangeLabel(record.changeKind)}</td>
                  <td className="px-3 py-2.5">{record.newTitle || '—'}{record.gradeLabel ? ` · ${record.gradeLabel}` : ''}</td>
                  <td className="px-3 py-2.5 text-mist">{record.salaryStructureName || '—'}</td>
                  <td className="px-3 py-2.5">{describeSalaryIncrease(record.amountType, record.amount)}</td>
                  <td className="px-3 py-2.5 text-mist">{formatPayrollPeriod(record.effectivePeriod)}</td>
                  <td className="px-3 py-2.5"><Badge tone={!hasAdjustment ? 'zinc' : scheduled ? 'amber' : 'lime'}>{status}</Badge></td>
                  <td className="px-3 py-2.5 text-right">{scheduled && (canCreate || canProcess)
                    ? <button type="button" className="rounded-lg p-2 text-mist hover:text-ember" aria-label="Cancel legacy scheduled change" title="Cancel scheduled change" onClick={() => cancelLegacyScheduled(record)}><X className="size-4" /></button>
                    : <span className="text-mist">—</span>}</td>
                </tr>
              })}
              {!filteredLegacyChanges.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-mist">No legacy changes match the employee filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      <Modal open={!!previewDocument} onClose={() => setPreviewDocument(null)} title={previewDocument?.fileName || 'Document preview'} xl>
        {previewDocument && (previewDocument.mimeType.startsWith('image/')
          ? <div className="flex max-h-[75vh] justify-center overflow-auto"><img src={previewDocument.url} alt={previewDocument.fileName} className="max-h-[72vh] max-w-full rounded-xl object-contain" /></div>
          : <iframe title={previewDocument.fileName} src={previewDocument.url} className="h-[72vh] w-full rounded-xl border border-line bg-white" />)}
      </Modal>

      <Modal open={processConfirmOpen} onClose={() => setProcessConfirmOpen(false)} title="Confirm payroll processing" size="md">
        {selectedRecord && <div>
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-bold">{selectedRecord.employeeName}</p>
            <p className="mt-1 text-sm text-mist">Current basic {formatGhs(selectedRecord.oldSalary)} → proposed basic {formatGhs(selectedRecord.newSalary)}, effective {selectedRecord.effectiveDate}.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-mist">Arrears months</p><p className="font-bold">{selectedRecord.monthsOutstanding}</p></div>
              <div><p className="text-xs text-mist">Arrears to post</p><p className="font-bold text-lime">{formatGhs(selectedRecord.totalArrearsPayable)}</p></div>
              <div className="col-span-2"><p className="text-xs text-mist">Payroll period / salary structure</p><p className="font-semibold">{processPeriod} · {salaryStructure?.name || 'Not assigned'}</p></div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300"><ShieldCheck className="mt-0.5 size-4 shrink-0" />All four approval levels are complete. Processing will update the employee master, apply the approved basic salary from the processing payroll month, and post effective-to-processing arrears without changing the assigned salary structure.</div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setProcessConfirmOpen(false)}>Cancel</Button><Button disabled={busy} onClick={processToPayroll}><FileCheck2 className="size-4" /> {busy ? 'Processing…' : 'Confirm process'}</Button></div>
        </div>}
      </Modal>
    </div>
  )
}

function loadPromotionGradeSettingsSafe(companyId?: string): string[] {
  try {
    // Kept behind this tiny wrapper so the page can survive malformed legacy storage.
    return loadPromotionGradeSettings(companyId).grades
  } catch {
    return []
  }
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-xl border border-line p-3 ${emphasis ? 'bg-lime/5' : ''}`}>
    <p className="text-[11px] font-semibold text-mist">{label}</p>
    <p className={`mt-1 font-display text-lg font-bold ${emphasis ? 'text-lime' : ''}`}>{value}</p>
  </div>
}

function AuditValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-mist">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>
}

function FilePicker({
  label, accept, disabled, file, files = [], multiple, onChange, onRemove,
}: {
  label: string
  accept: string
  disabled?: boolean
  file?: File | null
  files?: File[]
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRemove: (index?: number) => void
}) {
  const selected = file ? [file] : files
  return <div className="rounded-xl border border-line p-3">
    <p className="mb-2 text-xs font-bold">{label}</p>
    <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-3 text-xs font-semibold text-mist hover:border-lime hover:text-lime ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <Upload className="size-4" /> Choose file
      <input className="sr-only" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={onChange} />
    </label>
    {selected.length > 0 && <ul className="mt-2 space-y-1">
      {selected.map((item, index) => <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-mist">{item.name}</span>
        <button type="button" onClick={() => onRemove(index)} disabled={disabled} className="rounded p-1 text-mist hover:text-rose-400 disabled:opacity-40" aria-label={`Remove ${item.name}`}><X className="size-3.5" /></button>
      </li>)}
    </ul>}
  </div>
}

function DocumentRow({ document, onView, onDownload }: { document: PromotionDocument; onView: () => void; onDownload: () => void }) {
  const viewable = document.mimeType === 'application/pdf' || document.mimeType.startsWith('image/') || document.fileName.toLowerCase().endsWith('.pdf')
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.03] text-mist dark:bg-white/[0.05]"><FileText className="size-4" /></span>
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{document.fileName}</p><p className="text-[11px] text-mist">{documentTypeLabel(document.type)} · {(document.sizeBytes / 1024).toFixed(0)} KB · uploaded by {document.uploadedByName}</p></div>
    </div>
    <div className="flex gap-1">
      {viewable && <Button size="sm" variant="outline" onClick={onView}><Eye className="size-3.5" /> View</Button>}
      <Button size="sm" variant="outline" onClick={onDownload}><Download className="size-3.5" /> Download</Button>
    </div>
  </div>
}

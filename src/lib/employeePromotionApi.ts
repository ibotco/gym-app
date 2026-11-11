import type { EmployeePromotionDraftInput, EmployeePromotionRecord, PromotionDocument } from './employeePromotions'

export interface EmployeePromotionListQuery {
  status?: EmployeePromotionRecord['status']
  employeeId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface EmployeePromotionSummary {
  totalPromotions: number
  pendingApproval: number
  approved: number
  processedToPayroll: number
  promotionArrears: number
  currency: 'GHS'
}

export interface PromotionDecisionRequest {
  decision: 'approve' | 'reject'
  comments?: string
}

/** Context used by the local preview adapter. A production API must resolve these values from its authenticated database/session. */
export interface EmployeePromotionApiContext {
  companyId: string
  actorId: string
  actorName: string
  actorRole: string
}

export interface PromotionApiValidationContext {
  employeeActive: boolean
  gradeOptions: string[]
  jobTitleOptions: string[]
  promotionTypeOptions?: string[]
  legacyEffectiveMonths?: Array<{ employeeUserId: string; period: string }>
}

export interface PromotionProcessReferences {
  salaryIncreaseId?: string
  payrollAdjustmentId?: string
  employeeActive: boolean
  salaryAssignmentExists: boolean
  payrollPeriodPaid: boolean
}

/** Typed HTTP adapter for the REST contract in docs/employee-promotion-api.md. */
export class EmployeePromotionApiClient {
  private context: EmployeePromotionApiContext = {
    companyId: 'co_fitpro', actorId: '', actorName: '', actorRole: '',
  }

  constructor(private readonly basePath = '/api/hr/payroll/promotions') {}

  setContext(context: Partial<EmployeePromotionApiContext>): void {
    this.context = { ...this.context, ...context }
  }

  private headers(extra?: HeadersInit, multipart = false): Headers {
    const headers = new Headers(extra)
    if (!multipart && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    headers.set('X-Company-Id', this.context.companyId)
    if (this.context.actorId) headers.set('X-Actor-Id', this.context.actorId)
    if (this.context.actorName) headers.set('X-Actor-Name', this.context.actorName)
    if (this.context.actorRole) headers.set('X-Actor-Role', this.context.actorRole)
    return headers
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const isMultipart = typeof FormData !== 'undefined' && init?.body instanceof FormData
    const response = await fetch(`${this.basePath}${path}`, {
      credentials: 'include',
      ...init,
      headers: this.headers(init?.headers, isMultipart),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string; error?: string } | null
      throw new Error(body?.message || body?.error || `Promotion API request failed (${response.status}).`)
    }
    if (response.status === 204) return undefined as T
    const payload = await response.json()
    return (payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload) as T
  }

  list(query: EmployeePromotionListQuery = {}): Promise<{ items: EmployeePromotionRecord[]; total: number }> {
    const search = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)) })
    const suffix = search.size ? `?${search.toString()}` : ''
    return this.request(suffix)
  }

  async listAll(): Promise<EmployeePromotionRecord[]> {
    const first = await this.list({ page: 1, pageSize: 200 })
    const pages = Math.ceil(first.total / 200)
    if (pages <= 1) return first.items
    const remainder = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => this.list({ page: index + 2, pageSize: 200 })))
    return [...first.items, ...remainder.flatMap((page) => page.items)]
  }

  summary(): Promise<EmployeePromotionSummary> {
    return this.request('/summary')
  }

  get(id: string): Promise<EmployeePromotionRecord> {
    return this.request(`/${encodeURIComponent(id)}`)
  }

  create(input: EmployeePromotionDraftInput, validationContext?: PromotionApiValidationContext): Promise<EmployeePromotionRecord> {
    return this.request('', { method: 'POST', body: JSON.stringify({ input, validationContext }) })
  }

  update(id: string, input: Partial<EmployeePromotionDraftInput>, validationContext?: PromotionApiValidationContext): Promise<EmployeePromotionRecord> {
    return this.request(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ input, validationContext }) })
  }

  submit(id: string, validationContext?: PromotionApiValidationContext): Promise<EmployeePromotionRecord> {
    return this.request(`/${encodeURIComponent(id)}/submit`, { method: 'POST', body: JSON.stringify({ validationContext }) })
  }

  decide(id: string, request: PromotionDecisionRequest): Promise<EmployeePromotionRecord> {
    return this.request(`/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify(request) })
  }

  processToPayroll(id: string, references: PromotionProcessReferences): Promise<EmployeePromotionRecord> {
    return this.request(`/${encodeURIComponent(id)}/process-to-payroll`, { method: 'POST', body: JSON.stringify(references) })
  }

  uploadDocuments(id: string, formData: FormData): Promise<PromotionDocument[]> {
    return this.request(`/${encodeURIComponent(id)}/documents`, { method: 'POST', body: formData })
  }

  async documentBlob(id: string, documentId: string): Promise<Blob> {
    const response = await fetch(this.documentUrl(id, documentId), {
      credentials: 'include',
      headers: this.headers(undefined, true),
    })
    if (!response.ok) throw new Error(`Promotion document request failed (${response.status}).`)
    return response.blob()
  }

  documentUrl(id: string, documentId: string): string {
    return `${this.basePath}/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`
  }

  deleteDocument(id: string, documentId: string): Promise<void> {
    return this.request(`/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' })
  }
}

export const employeePromotionApi = new EmployeePromotionApiClient()

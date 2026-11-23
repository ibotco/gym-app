import { amountInWords } from '../../../lib/amountInWords'
import { allFeePaymentNumberRecords, nextFeePaymentNumbers } from '../../../lib/feePaymentNumber'
import { makeFeeInvoicePrintData } from '../../../lib/feeInvoicePrintData'
import { consistentScholarshipAward, isNonDeductingSample } from '../../../lib/scholarshipBalanceApply'
import { prefixValue } from '../../../lib/companyPrefixes'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Mail, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, MultiSelect, PageHeader, Select, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useLicense } from '../../../context/LicenseContext'
import { readFeeDefaultAccount, readFeeIntegrationEnabled, resolveFeeDefaultAccount } from '../../../lib/feeIntegrationSettings'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated, flushEducationBeforeNotification, apiUrl } from '../../../lib/mysqlBridge'
import { activeSmsGateway, currentSmsSettings, smsProviderCredentials, smsProviderReady } from '../../../lib/smsGateway'
import { paymentGuardianCandidates, paymentGuardianPhone, paymentConfirmationText } from '../../../lib/guardianPaymentSms'
import { uid } from '../../../lib/utils'
import { makeFeeInvoicePrintHtml } from '../../../lib/feeInvoicePrint'
import { makeStudentBillsHtml, printStudentBills } from '../../../lib/feesBillPrint'
import { makeFeeReminderDraft } from '../../../lib/feeReminderDraft'
import { generateFeeVoucherNumber, normalizeFeeVoucherNumber } from '../../../lib/feeVoucherNumber'
import { feeMappedAccount } from '../../../lib/feeMappedAccount'
import { feeManualJournal } from '../../../lib/feeManualJournal'
import { planFeeReceipt } from '../../../lib/feeCashReceipt'
import { useAuth } from '../../../context/AuthContext'
import { fullInvoicePlan } from '../../../lib/fullInvoicePayment'
import { isCashOrBankAccount, accountLabel } from '../accounting/common'
import Swal from 'sweetalert2'

const key = (v: unknown) => String(v ?? '').trim().toLowerCase()
function cents(value: unknown): number | null { const s = String(value ?? '').trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null; const [a, b = ''] = s.split('.'); const n = Number(a) * 100 + Number(b.padEnd(2, '0')); return Number.isSafeInteger(n) ? n : null }
const money = (n: number) => (n / 100).toFixed(2)
function remaining(b: EduRow): number | null {
  const total = cents(b.amount)
  if (total === null) return null
  const status = key(b.status)
  if (String(b.amountPaid ?? '').trim() !== '') { const paid = cents(b.amountPaid); if (paid === null || paid > total || (status === 'paid' && paid !== total)) return null; return total - paid }
  if (status === 'paid') return 0
  if (status === 'partial' || status === 'partly paid') return null
  if (status && status !== 'unpaid') return null
  return total
}
function classInfo(s: EduRow, classes: EduRow[]) {
  const raw = String(s.className ?? '').trim()
  const name = classes.map(c => String(c.name ?? '').trim()).filter(Boolean).sort((a,b) => b.length-a.length).find(n => key(raw) === key(n) || key(raw).startsWith(key(n)+' ')) ?? raw
  return { name, section: (raw.slice(name.length).trim() || String(s.section ?? '').trim()).replace(/^section\s+/i, '') }
}
type Invoice = { id: string; student: EduRow; bills: EduRow[] }
type PaymentRow = { billId: string; owed: number; date: string; amount: string; method: string; account: string; remarks: string; voucher: string }
export function FeesInvoicePage({ dueOnly = false }: { dueOnly?: boolean }) {
  const { activeBranchId, branches, accounts, activeCompany, activeCompanyId, company, modules, accountingSettings, receipts, upsertReceipt } = useApp()
  const { user } = useAuth()
  const paymentAccounts = accounts.filter(isCashOrBankAccount)
  const {canModule}=useLicense()
  const accountingAvailable=modules.accounting === true && canModule('accounting')
  const activePaymentAccounts=paymentAccounts.filter(a=>a.status!=='inactive')
  const defaultAccount=()=>accountingAvailable ? resolveFeeDefaultAccount(readFeeDefaultAccount(activeCompanyId),activePaymentAccounts.map(a=>a.id)) : ''
  const branchName = branches.find(b => b.id === activeBranchId)?.name ?? ''
  const { toast } = useToast()
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  const [className, setClassName] = useState('')
  const [section, setSection] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [terms, setTerms] = useState<string[]>([])
  const [groupId, setGroupId] = useState('')
  const [feeType, setFeeType] = useState('')
  const [appliedFeeType, setAppliedFeeType] = useState('')
  const [filter, setFilter] = useState<{ className: string; section: string; academicYear: string; terms: string[]; groupId: string }>({ className: '', section: '', academicYear: '', terms: [], groupId: '' })
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [invoiceId, setInvoiceId] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [manualJournalPayment, setManualJournalPayment] = useState<EduRow | null>(null)
  const [invoiceTab, setInvoiceTab] = useState<'invoice' | 'history' | 'collect' | 'paid'>('invoice')
  const [checkedBills, setCheckedBills] = useState<string[]>([])
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])
  const [fullDate, setFullDate] = useState('')
  const [fullMethod, setFullMethod] = useState('Cash')
  const [fullAccount, setFullAccount] = useState('')
  const [fullRemarks, setFullRemarks] = useState('')
  const [fullVoucher, setFullVoucher] = useState('')
  const [batchVoucher, setBatchVoucher] = useState('')
  const [singleBillId, setSingleBillId] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [singleAmount, setSingleAmount] = useState('')
  const [singleMethod, setSingleMethod] = useState('Cash')
  const [singleAccount, setSingleAccount] = useState('')
  const [singleRemarks, setSingleRemarks] = useState('')
  const [singleVoucher, setSingleVoucher] = useState('')
  const [guardianSms, setGuardianSms] = useState(false)
  const [guardianId, setGuardianId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const collectLock = useRef(false)
  useEffect(() => { const refresh = () => setRecords(loadEduRecords(activeBranchId, branchName)); refresh(); setClassName(''); setSection(''); setAcademicYear(''); setTerms([]); setGroupId(''); setFeeType(''); setAppliedFeeType(''); setFilter({ className:'', section:'', academicYear:'', terms:[], groupId:'' }); setInvoiceId(''); setSelectedIds([]); setError(''); const un = subscribeDbHydrated(refresh); window.addEventListener('focus',refresh); return () => { un(); window.removeEventListener('focus',refresh) } }, [activeBranchId, branchName])
  const students = records.studentList ?? []
  const classes = records.classList ?? []
  const classNames = [...new Set([...classes.map(c => String(c.name ?? '').trim()), ...students.map(s => classInfo(s,classes).name)].filter(Boolean))].sort()
  const sections = [...new Set([...classes.filter(c => key(c.name) === key(className)).map(c => String(c.section ?? '').trim().replace(/^section\s+/i,'')), ...students.map(s => classInfo(s,classes)).filter(c => key(c.name) === key(className)).map(c => c.section)].filter(Boolean))].sort()
  const years = [...new Set((records.academicYear ?? []).map(y => String(y.name ?? '').trim()).filter(Boolean))].sort()
  const termOptions = [...new Set((records.termSemester ?? []).filter(t => key(t.academicYear) === key(academicYear)).map(t => String(t.name ?? '').trim()).filter(Boolean))].sort()
  const groups = records.feeGroups ?? []
  const invoices = useMemo(() => {
    const result = new Map<string, Invoice>()
    for (const b of records.studentBilling ?? []) {
      // Invoice list contains fee-group allocations only; retain other charges in billing records.
      if (!String(b.feeGroupId ?? '').trim() && !String(b.feeGroupName ?? '').trim()) continue
      if (dueOnly && remaining(b) === 0) continue
      if (dueOnly && appliedFeeType) {
        const type = (records.feeTypes ?? []).find(t => t.id === appliedFeeType)
        if (b.feeTypeId ? b.feeTypeId !== appliedFeeType : !type || key(b.feeType) !== key(type.name) || (records.feeTypes ?? []).filter(t => key(t.name) === key(type.name)).length !== 1) continue
      }
      if (filter.academicYear && key(b.academicYear) !== key(filter.academicYear)) continue
      if (filter.terms.length && !filter.terms.some(t => key(t) === key(b.term))) continue
      if (filter.groupId && String(b.feeGroupId ?? '') !== filter.groupId) continue
      let s = students.find(x => x.id === b.studentId)
      if (!s && b.admissionNo) { const matches = students.filter(x => key(x.admissionNo) === key(b.admissionNo)); if (matches.length === 1) s = matches[0] }
      if (!s && b.student && !b.studentId && !b.admissionNo) { const matches = students.filter(x => key(x.name) === key(b.student)); if (matches.length === 1) s = matches[0] }
      const id = s?.id ?? `unmatched:${b.id}`
      if (!result.has(id)) result.set(id, { id, student: s ?? { id, name: String(b.student ?? 'Unknown student'), className: String(b.className ?? '') }, bills: [] })
      result.get(id)!.bills.push(b)
    }
    return [...result.values()]
  }, [records.studentBilling, records.feeTypes, students, filter, dueOnly, appliedFeeType])
  const visible = invoices.filter(inv => { const c = classInfo(inv.student,classes); return (!filter.className || key(c.name) === key(filter.className)) && (!filter.section || filter.section === '__all__' || key(c.section) === key(filter.section)) && `${inv.student.name} ${inv.student.admissionNo ?? ''} ${inv.bills.map(b=>b.feeGroupName ?? b.feeType ?? '').join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()) })
  const current = invoices.find(x => x.id === invoiceId)
  const printSelected = () => {
    if (dueOnly && feeType !== appliedFeeType) { toast('Apply the selected fees type before printing', 'info'); return }
    const selected = invoices.filter(i => selectedIds.includes(i.id))
    if (!selected.length) { toast('Select at least one invoice to print', 'info'); return }
    const branch = branches.find(b => b.id === activeBranchId)
    const html = makeStudentBillsHtml(selected, { schoolName: activeCompany?.name || company.name || branchName, branchName, address: branch?.address || activeCompany?.address || '', phone: branch?.phone || activeCompany?.phone || '', email: activeCompany?.email || '', logo: company.logoImage, currency: activeCompany?.currency || 'GHS', classes, scholarships: dueOnly && appliedFeeType ? [] : (records.scholarships ?? []).filter(a => !isNonDeductingSample(a) && !consistentScholarshipAward(a,records.studentBilling ?? [],records.scholarshipPostings ?? [],records.scholarshipAllocations ?? [])), printNotice: dueOnly && appliedFeeType ? `Filtered to fees type: ${(records.feeTypes ?? []).find(t => t.id === appliedFeeType)?.name || 'Selected fee type'}. Applied scholarship credits are included in net fee amounts; unapplied awards are excluded. Consult the full student bill.` : '', paymentAccounts: records.paymentAccounts ?? [], studentTermDates: records.studentTermDates ?? [], carryForwards: records.feesCarryForward ?? [] })
    if (!printStudentBills(html)) toast('Could not open the print document', 'info')
  }
  const invoiceEmail = (inv: Invoice) => {
    const due = inv.bills.filter(b => (remaining(b) ?? 0) > 0)
    if (!due.length) { toast(inv.bills.some(b => remaining(b) === null) ? 'No verified outstanding items; review the invoice first' : 'There are no outstanding fees to remind this student about', 'info'); return }
    const admission = key(inv.student.admissionNo)
    const matches = admission ? (records.studentRegistration ?? []).filter(r => key(r.admissionNo) === admission) : []
    const recipient = String(inv.student.email || (matches.length === 1 ? matches[0].email : '') || '').trim()
    if (!recipient) { toast('No student email is recorded; add an email address before preparing a reminder', 'info'); return }
    const {subject,body} = makeFeeReminderDraft(inv.student, due, branchName)
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }
  const deleteUnpaid = async (inv: Invoice) => {
    const eligible = (data: EduRecords) => (data.studentBilling ?? []).filter(b => inv.bills.some(x => x.id === b.id) && key(b.status) === 'unpaid' && remaining(b) !== null && (cents(b.amountPaid || '0') === 0) && !b.carryForwardId && !b.scholarshipPostingId && !(data.feesInvoicePayments ?? []).some(p => p.billingId === b.id))
    const first = loadEduRecords(activeBranchId, branchName)
    const candidates = eligible(first)
    if (!candidates.length) { toast('No unpaid items without payments can be deleted', 'info'); return }
    const kept = inv.bills.length - candidates.length
    const result = await Swal.fire({ title: 'Delete unpaid fee items?', text: `Delete ${candidates.length} unpaid item(s) for ${inv.student.name}? ${kept ? `${kept} paid, partial, or otherwise protected item(s) will remain.` : 'This removes the unpaid billing entries.'}`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete unpaid items', confirmButtonColor: '#dc2626' })
    if (!result.isConfirmed) return
    const latest = loadEduRecords(activeBranchId, branchName)
    const allowedIds = new Set(eligible(latest).map(b => b.id))
    if (candidates.some(b => !allowedIds.has(b.id))) { setRecords(latest); toast('Billing changed; review before deleting', 'info'); return }
    const deletedIds = new Set(candidates.map(b => b.id))
    const next = { ...latest, studentBilling: (latest.studentBilling ?? []).filter(b => !deletedIds.has(b.id)) }
    saveEduRecords(activeBranchId, next); setRecords(next); setSelectedIds(prev => prev.filter(id => id !== inv.id)); toast(`${candidates.length} unpaid item(s) deleted`, 'info')
  }
  const openCollect = (inv: Invoice) => { const d=new Date(); setFullDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); setFullMethod('Cash'); setFullAccount(defaultAccount()); setFullRemarks(''); setFullVoucher(generateFeeVoucherNumber(globalThis.crypto, prefixValue(company.prefixes,'feeVoucher','FV-'))); setBatchVoucher(''); setSingleVoucher(generateFeeVoucherNumber(globalThis.crypto, prefixValue(company.prefixes,'feeVoucher','FV-'))); setSingleDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`); setSingleBillId(''); setSingleAmount(''); setSingleMethod('Cash'); setSingleAccount(defaultAccount()); setSingleRemarks(''); setGuardianSms(false); setGuardianId(''); setInvoiceId(inv.id); setPaymentOpen(false); setInvoiceTab('invoice'); setCheckedBills([]); setPaymentRows([]); setError('') }
  const close = () => { if (!saving) { setPaymentOpen(false); setError('') } }
  const collect = async (rows: PaymentRow[] = paymentRows, full = false, single = false) => {
    if (saving || collectLock.current || !current || !rows.length) { setError('Select at least one outstanding fee item.'); return }
    if (rows.some(row=>!normalizeFeeVoucherNumber(row.voucher))) {setError('Enter 1 to 12 digits, optionally preceded by up to 12 letters and a hyphen or slash (for example FV-123).');return}
    const invalid = rows.some(row => { const value = cents(row.amount); return !row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || value === null || value <= 0 || value > row.owed || !row.method || (!!row.account && !paymentAccounts.some(a => a.id === row.account)) })
    if (invalid) { setError('Enter a valid date, payment method, available account (if selected), and an amount greater than zero and no more than the outstanding balance for every item.'); return }
    const sum = rows.reduce((n, row) => n + cents(row.amount)!, 0)
    const wantsSms = (single || full) && guardianSms
    const smsConfig = currentSmsSettings()
    const guardianMatches = wantsSms ? paymentGuardianCandidates(current.student, records.studentList ?? [], records.parents ?? []).filter(p=>p.id===guardianId) : []
    const selectedGuardian = guardianMatches.length === 1 ? guardianMatches[0] : undefined
    const phone = selectedGuardian ? paymentGuardianPhone(selectedGuardian.phone) : null
    if (wantsSms && !activeSmsGateway()) { setError('Enable the SMS gateway in Company Settings → Communication → SMS gateway.'); return }
    if (wantsSms && !smsProviderReady(smsConfig)) { setError('Configure a supported SMS provider or HTTPS webhook in Company Settings → Communication → SMS gateway.'); return }
    if (wantsSms && (!selectedGuardian || !phone)) { setError('Select a linked guardian with an international phone number, for example +233…'); return }
    collectLock.current = true
    setSaving(true)
    try {
      const confirm = await Swal.fire({ title: 'Record payments?', text: `Record ${money(sum)} across ${rows.length} fee item(s) for ${current.student.name}? Eligible payments may request an accounting receipt if Fee Integration is enabled. Payment and accounting saves are separate; verify Account History. No bank transfer is made.${wantsSms ? ` A payment confirmation will be requested from the SMS gateway for ${selectedGuardian?.name} at +${phone}.` : ''}`, icon: 'question', showCancelButton: true, confirmButtonText: 'Record payments' })
      if (!confirm.isConfirmed) return
      const latest = loadEduRecords(activeBranchId, branchName)
      if (wantsSms) {
        const currentStudent=(latest.studentList ?? []).find(s=>s.id===current.student.id)
        const matching=currentStudent ? paymentGuardianCandidates(currentStudent,latest.studentList ?? [],latest.parents ?? []).filter(p=>p.id===guardianId) : []
        const matched=matching.length===1 ? matching[0] : undefined
        if(!matched || paymentGuardianPhone(matched.phone)!==phone || matched.name!==selectedGuardian?.name) {setRecords(latest);setError('Guardian details changed. Review them before recording payment.');return}
      }
      if (full) {
        const actualBills = current.bills.map(b => (latest.studentBilling ?? []).find(x => x.id === b.id))
        if (actualBills.some((b,i) => !b || JSON.stringify(b) !== JSON.stringify(current.bills[i]))) { setError('Invoice items changed. Review them before collecting.'); setRecords(latest); return }
        const check = fullInvoicePlan(actualBills as EduRow[], current.student.id, latest.scholarships ?? [],latest.studentBilling ?? [],latest.scholarshipPostings ?? [],latest.scholarshipAllocations ?? [])
        if (check.error || check.total !== sum || check.rows.length !== rows.length || check.rows.some(item => !rows.some(row => row.billId === item.billId && row.owed === item.owed))) { setError(check.error || 'The invoice balance changed. Review before collecting.'); setRecords(latest); return }
      }
      if (single) {
        const actualBill = (latest.studentBilling ?? []).find(b => b.id === rows[0].billId)
        const check = actualBill ? fullInvoicePlan([actualBill], current.student.id, latest.scholarships ?? [],latest.studentBilling ?? [],latest.scholarshipPostings ?? [],latest.scholarshipAllocations ?? []) : null
        if (!check || check.error || check.rows.length !== 1 || check.rows[0].owed !== rows[0].owed) { setError(check?.error || 'The selected fee changed. Review it before collecting.'); setRecords(latest); return }
      }
      const batchId = full ? uid() : ''
      const actualRows = rows.map(row => ({ row, bill: (latest.studentBilling ?? []).find(b => b.id === row.billId) }))
      if (actualRows.some(({ row, bill }) => !bill || remaining(bill) !== row.owed)) { setError('A selected balance changed. Close and reopen the collection form before trying again.'); setRecords(latest); return }
      // A batch payment must respect the same scholarship and adjustment guard
      // as single/full payment. Otherwise an affected item could be overcharged.
      if (current.id.startsWith('unmatched:')) { setError('The student is not uniquely linked. Review the invoice before collecting fees.'); return }
      for (const {bill} of actualRows) {
        const check=fullInvoicePlan([bill!],current.student.id,latest.scholarships ?? [],latest.studentBilling ?? [],latest.scholarshipPostings ?? [],latest.scholarshipAllocations ?? [])
        if (check.error) { setError(check.error); setRecords(latest); return }
      }
      const updates = new Map<string, EduRow>()
      let paymentNumbers:string[]
      try { paymentNumbers=nextFeePaymentNumbers(allFeePaymentNumberRecords(localStorage.getItem('fitpro_edu_records_v1'),latest.feesInvoicePayments ?? []),actualRows.length) } catch { setError('Could not generate payment numbers. Review existing numbers before collecting.'); return }
      const payments: EduRow[] = actualRows.map(({ row, bill: maybeBill }, index) => {
        const actual = maybeBill!, value = cents(row.amount)!, total = cents(actual.amount)!, paid = total - row.owed + value
        updates.set(actual.id, { ...actual, amountPaid: money(paid), status: paid === total ? 'Paid' : 'Partial' })
        return { id: uid(), paymentNumber:paymentNumbers[index], ...(batchId ? { paymentBatchId: batchId } : {}), studentId: String(actual.studentId || (invoiceId.startsWith('unmatched:') ? '' : invoiceId)), student: String(actual.student ?? ''), admissionNo: String(actual.admissionNo ?? ''), billingId: actual.id, feeGroupId: String(actual.feeGroupId ?? ''), feeType: String(actual.feeType ?? ''), feeGroupName: String(actual.feeGroupName ?? ''), academicYear: String(actual.academicYear ?? ''), term: String(actual.term ?? ''), className: String(current.student.className ?? ''), studentName: String(current.student.name ?? ''), amount: money(value), paymentMethod: row.method, reference: normalizeFeeVoucherNumber(row.voucher) || '', voucherNumber: normalizeFeeVoucherNumber(row.voucher) || '', accountId: row.account, account: paymentAccounts.find(a => a.id === row.account)?.name ?? '', remarks: row.remarks.trim(), paidAt: `${row.date}T12:00:00`, recordedAt: new Date().toISOString() }
      })
      const postingPlans = payments.map((payment, index) => planFeeReceipt({payment,bill:actualRows[index].bill!,feeTypes:latest.feeTypes ?? [],accounts,cashAccountIds:activePaymentAccounts.map(a=>a.id),receipts,settings:accountingSettings,enabled:readFeeIntegrationEnabled(activeCompanyId),accountingAvailable,companyId:activeCompanyId,branchId:activeBranchId,payer:String(current.student.name ?? ''),actorId:user?.id || '',currency:activeCompany?.currency || 'GHS'}))
      const next = { ...latest, studentBilling: (latest.studentBilling ?? []).map(b => updates.get(b.id) ?? b), feesInvoicePayments: [...payments, ...(latest.feesInvoicePayments ?? [])] }
      saveEduRecords(activeBranchId,next); setRecords(next); setPaymentOpen(false); setPaymentRows([]); setCheckedBills([]); setSingleBillId(''); setSingleAmount(''); setSingleRemarks(''); setSingleVoucher(generateFeeVoucherNumber(globalThis.crypto, prefixValue(company.prefixes,'feeVoucher','FV-'))); setFullVoucher(generateFeeVoucherNumber(globalThis.crypto, prefixValue(company.prefixes,'feeVoucher','FV-'))); setBatchVoucher(''); setGuardianSms(false); setGuardianId(''); setError('')
      // Like sales, receipt/history and education saves are separate browser operations.
      postingPlans.forEach(plan => { if (plan.receipt) upsertReceipt(plan.receipt) })
      // Never report a database-confirmed payment (or send SMS) before its
      // queued education write has been acknowledged by the server.
      const saved=loadEduRecords(activeBranchId,branchName)
      const persistedLocally=payments.every(p=>(saved.feesInvoicePayments ?? []).some(x=>x.id===p.id))
      const synced=persistedLocally && await flushEducationBeforeNotification()
      if (!synced) { await Swal.fire({title:'Payment saved locally; database save not confirmed',text:`Do not record the payment again. Review Payment History and database sync first.${wantsSms ? ' The confirmation SMS was not sent.' : ''} Accounting receipt and history sync status is also uncertain; verify both before retrying.`,icon:'warning'}); return }
      const skipped = postingPlans.map((plan,index)=>plan.error ? `${payments[index].feeType || 'Fee'} (${payments[index].id}): ${plan.error}` : '').filter(Boolean)
      if (skipped.length) await Swal.fire({title:'Some fee payments have no accounting receipt',text:`${skipped.join(' ')} Review these payments before posting manually. Other receipt requests are not atomic; verify Account History and database sync.`,icon:'warning'})
      else await Swal.fire({title:'Accounting receipts requested',text:'Payment, receipts and Account History are saved separately and can become inconsistent. Verify database sync and Account History before retrying. No bank transfer was made.',icon:'info'})
      if (wantsSms) {
        const text=paymentConfirmationText(String(current.student.name??''),money(sum),activeCompany?.currency||'GHS',branchName)
        try {
          const useAdapter=['mnotify','wigal','twilio','clickatell','msg91','africastalking','textlocal','smscountry'].includes(smsConfig.smsMode)
          const response=await fetch(apiUrl(useAdapter ? '/api/sms-provider' : '/api/notify'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(useAdapter ? {provider:smsConfig.smsMode,credentials:smsProviderCredentials(smsConfig),to:phone,message:text} : {channel:'sms',mode:smsConfig.smsMode,to:phone,message:text,webhookUrl:smsConfig.smsWebhookUrl,hubtelClientId:smsConfig.hubtelClientId,hubtelClientSecret:smsConfig.hubtelClientSecret,hubtelFrom:smsConfig.hubtelFrom})})
          const result=await response.json().catch(()=>null)
          if (!response.ok || !result?.ok) {await Swal.fire({title:'Payment recorded; SMS not confirmed',text:'The SMS request was not confirmed. Check the provider and payment history; do not record the payment again.',icon:'warning'});return}
          toast('Payment recorded; SMS request submitted (delivery not verified)', 'success')
        } catch { await Swal.fire({title:'Payment recorded; SMS status unknown',text:'The request could not be confirmed. Check the provider before retrying; do not record the payment again.',icon:'warning'}) }
      } else toast(full ? `Full payment allocated to ${payments.length} fee item(s)` : `${payments.length} payment(s) recorded`, 'success')
    } finally { collectLock.current = false; setSaving(false) }
  }
  const mappedAccount = (bill:EduRow|undefined) => feeMappedAccount(bill,records.feeTypes ?? [],accounts)
  const cell = 'border-b border-line px-3 py-2 text-left'
  const updatePaymentRow = (id: string, patch: Partial<PaymentRow>) => setPaymentRows(rows => rows.map(r => r.billId === id ? { ...r, ...patch } : r))
  const batchAccount = paymentRows.length && paymentRows.every(r=>r.account===paymentRows[0].account) ? paymentRows[0].account : ''
  const payToAccount = (value:string, onChange:(v:string)=>void) => <Field label="Pay to Account"><Select value={value} onChange={e=>onChange(e.target.value)}><option value="">Select bank or cash account (optional)</option>{paymentAccounts.map(a=><option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</Select><p className="mt-1 text-xs text-mist">Used for the debit on eligible payments when Fee Integration is enabled. No bank transfer is made.</p></Field>
  const paymentModal = (<Modal open={paymentOpen} onClose={close} title="Collect Fees" maxWidth="7xl"><div className="space-y-4"><p className="text-sm text-mist">Record full or partial payments for the selected items. Discount and fine are not applied; Pay to Account is an optional cash or bank account. Mapped Account shows the current Fees Type mapping. Eligible payments request accounting receipts if Fee Integration is enabled; saves are not atomic.</p><div className="grid grid-cols-1 gap-4 sm:grid-cols-12">{accountingAvailable && <div className="min-w-0 sm:col-span-8">{payToAccount(batchAccount,account=>setPaymentRows(rows=>rows.map(row=>({...row,account}))))}</div>}<div className={accountingAvailable ? "min-w-0 sm:col-span-4" : "min-w-0 sm:col-span-12"}><Field label="Voucher number"><Input value={batchVoucher} maxLength={25} onChange={e=>{const voucher=e.target.value;setBatchVoucher(voucher);setPaymentRows(rows=>rows.map(row=>({...row,voucher})))}} placeholder="Enter voucher number" /><p className="mt-1 text-xs text-mist">Generated automatically; you may enter up to 12 digits with an optional letter prefix (e.g. FV-123). Applied as a reference to every item; each eligible payment requests a separate receipt.</p></Field></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted"><tr>{['Fees Type','Mapped Account','Date','Amount','Discount','Fine','Payment Method','Account','Remarks'].map(h => <th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{paymentRows.map(row => { const b = current?.bills.find(x => x.id === row.billId); return <tr key={row.billId}><td className={cell}><strong>{b?.feeType || 'Fee'}</strong><div className="text-xs text-mist">{b?.feeGroupName} · {b?.academicYear} / {b?.term}</div><div className="text-xs text-mist">Due {money(row.owed)}</div></td><td className={cell}>{mappedAccount(b)}</td><td className={cell}><Input aria-label={`Date ${b?.feeType}`} type="date" value={row.date} onChange={e => updatePaymentRow(row.billId,{ date:e.target.value })} /></td><td className={cell}><Input aria-label={`Amount ${b?.feeType}`} type="number" min="0.01" step="0.01" max={money(row.owed)} value={row.amount} onChange={e => updatePaymentRow(row.billId,{ amount:e.target.value })} /></td><td className={cell}>0.00</td><td className={cell}>0.00</td><td className={cell}><Select aria-label={`Payment method ${b?.feeType}`} value={row.method} onChange={e => updatePaymentRow(row.billId,{ method:e.target.value })}><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Other</option></Select></td><td className={cell}><Select aria-label={`Account ${b?.feeType}`} value={row.account} onChange={e => updatePaymentRow(row.billId,{ account:e.target.value })}><option value="">Select account (optional)</option>{paymentAccounts.map(a => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</Select></td><td className={cell}><Input aria-label={`Remarks ${b?.feeType}`} placeholder="Remarks" value={row.remarks} onChange={e => updatePaymentRow(row.billId,{ remarks:e.target.value })} /></td></tr> })}</tbody></table></div>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button onClick={() => void collect()} disabled={saving}>Fee Payment</Button></div></div></Modal>)
  if (current) {
    const balances = current.bills.map(remaining)
    const uncertain = balances.some(v => v === null)
    const total = current.bills.reduce((n, b) => n + (cents(b.amount) ?? 0), 0)
    const balance = balances.reduce<number>((n, v) => n + (v ?? 0), 0)
    const paid = current.bills.reduce((n, b) => { const amount = cents(b.amount); const left = remaining(b); return n + (amount !== null && left !== null ? amount - left : 0) }, 0)
    const status = uncertain ? 'Review balance' : balance === 0 ? 'Fully Paid' : paid > 0 ? 'Partly Paid' : 'Unpaid'
    const payments = (records.feesInvoicePayments ?? []).filter(p => current.bills.some(b => b.id === p.billingId))
    const manualPlan = manualJournalPayment ? feeManualJournal(manualJournalPayment, records.studentBilling ?? [], records.feeTypes ?? [], accounts, paymentAccounts.map(a=>a.id)) : null
    const shown = current.bills.filter(b => invoiceTab === 'collect' ? (remaining(b) ?? 0) > 0 : true)
    const fullPlan = fullInvoicePlan(current.bills,current.student.id,records.scholarships ?? [],records.studentBilling ?? [],records.scholarshipPostings ?? [],records.scholarshipAllocations ?? [])
    const singleBill=current.bills.find(b=>b.id===singleBillId)
    const singlePlan=singleBill ? fullInvoicePlan([singleBill],current.student.id,records.scholarships ?? [],records.studentBilling ?? [],records.scholarshipPostings ?? [],records.scholarshipAllocations ?? []) : null
    const singleDue=singleBill ? remaining(singleBill) : null
    const inputAmount=cents(singleAmount)
    const guardianSmsControls = <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={guardianSms} onChange={e=>{setGuardianSms(e.target.checked);setGuardianId('');setError('')}} /> Guardian Confirmation SMS</label>{guardianSms && <div className="space-y-2"><Field label="Guardian" required><Select value={guardianId} onChange={e=>setGuardianId(e.target.value)}><option value="">Select guardian</option>{paymentGuardianCandidates(current.student,records.studentList ?? [],records.parents ?? []).map(g=><option key={g.id} value={g.id}>{g.name} · {g.phone||'No phone recorded'}</option>)}</Select></Field><p className="text-xs text-mist">Requires a supported SMS provider or HTTPS webhook configured in Company Settings → Communication → SMS gateway and a guardian number in international format (e.g. +233). The provider may charge for SMS; acceptance does not guarantee delivery.</p></div>}</>
    const grouped = new Map<string, EduRow[]>()
    for (const b of shown) { const name = String(b.feeGroupName || groups.find(g => g.id === b.feeGroupId)?.name || 'Fee group unavailable'); grouped.set(name, [...(grouped.get(name) ?? []), b]) }
    const eligible = shown.filter(b => (remaining(b) ?? 0) > 0)
    const printFeeInvoice = () => {
      const printData=makeFeeInvoicePrintData(current.student,current.bills,classes,groups,records.feeTypes ?? [],accounts,branchName,payments)
      const html=makeFeeInvoicePrintHtml({...printData,paidWords:amountInWords(printData.paid,activeCompany?.currency || company.currency || 'GHS'),accountantName:user?.name || ''})
      if (!printStudentBills(html)) setError('Could not open the print document. Please try again.')
    }
    const beginPayment = () => {
      const chosen = current.bills.filter(b => checkedBills.includes(b.id))
      if (!chosen.length || chosen.length !== checkedBills.length || chosen.some(b => remaining(b) === null || remaining(b) === 0)) { setError('Select at least one outstanding fee item.'); return }
      const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const voucher=generateFeeVoucherNumber(globalThis.crypto, prefixValue(company.prefixes,'feeVoucher','FV-'))
      setPaymentRows(chosen.map(b => ({ billId: b.id, owed: remaining(b)!, date, amount: money(remaining(b)!), method: 'Cash', account: defaultAccount(), remarks: '', voucher })))
      setBatchVoucher(voucher); setError(''); setPaymentOpen(true)
    }
    return <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><PageHeader title="Fees Invoice" desc="Review allocated fees and record payments" /><Button variant="outline" onClick={() => { setInvoiceId(''); setCheckedBills([]); setError('') }}>Back to Invoice List</Button></div>
      <div className="flex flex-wrap gap-2 border-b border-line print:hidden">{([['invoice','Invoice'],['history','Payment History'],['collect','Collect Fees'],['paid','Fully Paid']] as const).map(([id,label]) => <button key={id} type="button" className={`px-4 py-2 text-sm ${invoiceTab === id ? 'border-b-2 border-lime-500 font-semibold' : 'text-mist'}`} onClick={() => { setInvoiceTab(id); setCheckedBills([]); setGuardianSms(false); setGuardianId(''); setError('') }}>{label}</button>)}</div>
      <section className="rounded-xl border border-line bg-surface p-4 space-y-5">
        <div className="flex flex-wrap justify-between gap-4 border-b border-line pb-4"><div><h2 className="text-lg font-bold">{branchName || 'School'}</h2><p className="text-sm text-mist">Fees Invoice</p></div><div className="text-right text-sm"><div><strong>Student:</strong> {current.student.name}</div><div><strong>Status:</strong> {status}</div></div></div>
        <div className="flex flex-wrap justify-between gap-4 text-sm"><div><div><strong>Invoice To:</strong> {current.student.name}</div><div>Register No: {current.student.admissionNo || '—'}</div><div>Class: {classInfo(current.student, classes).name || '—'} {classInfo(current.student, classes).section}</div><div>Phone: {current.student.phone || '—'}</div></div><div className="text-right"><strong>Academic Period</strong><div>{[...new Set(current.bills.map(b => `${b.academicYear || 'Year unspecified'} · ${b.term || 'Term unspecified'}`))].map(x => <div key={x}>{x}</div>)}</div></div></div>
        {invoiceTab === 'collect' ? <div className="max-w-2xl space-y-4"><Field label="Fees Type" required><Select value={singleBillId} onChange={e=>{const id=e.target.value;setSingleBillId(id);const item=current.bills.find(b=>b.id===id);const due=item ? remaining(item) : null;setSingleAmount(due!==null&&due>0?money(due):'');setError('')}}><option value="">Select a fee item</option>{current.bills.filter(b=>(remaining(b)??0)>0).map(b=><option key={b.id} value={b.id}>{b.feeType||'Fee'} · {b.feeGroupName||'Fee group'} · {b.academicYear||'—'} / {b.term||'—'} · Due {money(remaining(b)!)}</option>)}</Select></Field><Field label="Mapped Account"><Input readOnly value={mappedAccount(singleBill)} /><p className="mt-1 text-xs text-mist">Current Fees Type mapping; verify the receipt after payment.</p></Field><div className="grid grid-cols-1 gap-4 sm:grid-cols-12">{accountingAvailable && <div className="min-w-0 sm:col-span-8">{payToAccount(singleAccount,setSingleAccount)}</div>}<div className={accountingAvailable ? "min-w-0 sm:col-span-4" : "min-w-0 sm:col-span-12"}><Field label="Voucher number"><Input value={singleVoucher} maxLength={25} onChange={e=>setSingleVoucher(e.target.value)} placeholder="Enter voucher number" /><p className="mt-1 text-xs text-mist">Generated automatically; you may enter up to 12 digits with an optional letter prefix (e.g. FV-123). Used as the receipt reference for eligible payments.</p></Field></div></div><Field label="Date" required><Input type="date" value={singleDate} onChange={e=>setSingleDate(e.target.value)} /></Field><Field label="Amount" required><Input type="number" min="0.01" step="0.01" max={singleDue!==null?money(singleDue):undefined} value={singleAmount} onChange={e=>setSingleAmount(e.target.value)} /></Field><Field label="Discount"><Input value="0.00" readOnly /></Field><Field label="Fine"><Input value="0.00" readOnly /></Field><div className="rounded-lg border border-line p-4"><h3 className="mb-3 font-semibold">Fee Details</h3><div className="space-y-2 text-sm"><div className="flex justify-between border-b border-line pb-2"><span>Fee Amount</span><strong>{inputAmount===null?'—':money(inputAmount)}</strong></div><div className="flex justify-between border-b border-line pb-2"><span>Fine Amount</span><span>0.00</span></div><div className="flex justify-between border-b border-line pb-2"><span>Discount (−)</span><span>0.00</span></div><div className="flex justify-between font-semibold"><span>Amount To Pay</span><span>{inputAmount===null?'—':money(inputAmount)}</span></div></div><p className="mt-3 text-xs text-mist">Fee Amount is the payment entered above. {singleDue!==null?`Selected item outstanding: ${money(singleDue)}.`:''}</p></div><Field label="Payment Method" required><Select value={singleMethod} onChange={e=>setSingleMethod(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Other</option></Select></Field>{!accountingAvailable && <Field label="Account (optional)"><Select value={singleAccount} onChange={e=>setSingleAccount(e.target.value)}><option value="">Select account (optional)</option>{paymentAccounts.map(a=><option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</Select></Field>}<Field label="Remarks"><Textarea rows={2} value={singleRemarks} onChange={e=>setSingleRemarks(e.target.value)} placeholder="Write your remarks" /></Field>{guardianSmsControls}{singlePlan?.error && <p role="alert" className="text-sm text-amber-700">{singlePlan.error}</p>}<p className="text-xs text-mist">Discounts and fines are not applied. No bank transfer is made; accounting saves are separate.</p><Button disabled={saving || !singleBill || !!singlePlan?.error || singleDue===null} onClick={()=>{if(singleBill && singleDue!==null)void collect([{billId:singleBill.id,owed:singleDue,date:singleDate,amount:singleAmount,method:singleMethod,account:singleAccount,remarks:singleRemarks,voucher:singleVoucher}],false,true)}}>Fee Payment</Button></div> : invoiceTab === 'paid' ? <div className="max-w-2xl space-y-4"><p className="text-sm text-mist">One payment is allocated across every outstanding fee item in this filtered invoice. Other periods or groups excluded by the list filters are not included.</p>{fullPlan.error && <p role="alert" className="text-sm text-amber-700">{fullPlan.error}</p>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-12">{accountingAvailable && <div className="min-w-0 sm:col-span-8">{payToAccount(fullAccount,setFullAccount)}</div>}<div className={accountingAvailable ? "min-w-0 sm:col-span-4" : "min-w-0 sm:col-span-12"}><Field label="Voucher number"><Input value={fullVoucher} maxLength={25} onChange={e=>setFullVoucher(e.target.value)} placeholder="Enter voucher number" /><p className="mt-1 text-xs text-mist">Generated automatically; you may enter up to 12 digits with an optional letter prefix (e.g. FV-123). Applied as a reference to each item’s receipt.</p></Field></div></div><Field label="Date" required><Input type="date" value={fullDate} onChange={e=>setFullDate(e.target.value)} /></Field><Field label="Amount"><Input value={fullPlan.error ? 'Review required' : money(fullPlan.total)} readOnly /></Field><Field label="Fine"><Input value="0.00" readOnly /></Field><Field label="Payment Method" required><Select value={fullMethod} onChange={e=>setFullMethod(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Other</option></Select></Field>{!accountingAvailable && <Field label="Account (optional)"><Select value={fullAccount} onChange={e=>setFullAccount(e.target.value)}><option value="">Select account (optional)</option>{paymentAccounts.map(a=><option key={a.id} value={a.id}>{accountLabel(a)}</option>)}</Select></Field>}<Field label="Remarks"><Input value={fullRemarks} onChange={e=>setFullRemarks(e.target.value)} placeholder="Write your remarks" /></Field>{guardianSmsControls}<p className="text-xs text-mist">Discount and fine are not applied. Payments are recorded as item allocations. No bank transfer is made; accounting saves are separate.</p><Button disabled={saving || !!fullPlan.error} onClick={()=>void collect(fullPlan.rows.map(r=>({billId:r.billId,owed:r.owed,date:fullDate,amount:money(r.owed),method:fullMethod,account:fullAccount,remarks:fullRemarks,voucher:fullVoucher})),true)}>Fee Payment</Button></div> : invoiceTab === 'history' ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{['Date','Fee Type','Amount','Method','Account','Remarks','Voucher number',...(accountingAvailable?['Accounting']:[])].map(h => <th className={cell} key={h}>{h}</th>)}</tr></thead><tbody>{payments.map(p => <tr key={p.id}><td className={cell}>{String(p.paidAt ?? '').slice(0,10)}</td><td className={cell}>{p.feeType}</td><td className={cell}>{p.amount}</td><td className={cell}>{p.paymentMethod}</td><td className={cell}>{p.account || '—'}</td><td className={cell}>{p.remarks || '—'}</td><td className={cell}>{p.voucherNumber || p.reference || '—'}</td>{accountingAvailable && <td className={cell}><div className="space-y-1"><div>{receipts.some(r=>r.sourceFeePaymentId===p.id) ? "Receipt present — verify Account History and sync" : "No linked receipt — review before posting"}</div><Button size="sm" variant="outline" onClick={()=>setManualJournalPayment(p)}>Manual journal guide</Button></div></td>}</tr>)}</tbody></table>{!payments.length && <p className="p-4 text-sm text-mist">No payments recorded.</p>}</div> : <>
          <div className="flex flex-wrap items-center gap-3 print:hidden"><Button size="sm" variant="outline" onClick={beginPayment}>Selected Fees Collect</Button><span className="text-xs text-mist">Select one or more outstanding fee items.</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className={`${cell} print:hidden`}><input type="checkbox" aria-label="Select all outstanding fee items" checked={eligible.length > 0 && eligible.every(b => checkedBills.includes(b.id))} onChange={e => setCheckedBills(e.target.checked ? eligible.map(b => b.id) : [])} /></th>{['Fee Type','Mapped Account','Period','Due Date','Status','Amount','Discount','Fine','Paid','Balance'].map(h => <th className={cell} key={h}>{h}</th>)}</tr></thead><tbody>{[...grouped.entries()].map(([name, bills]) => <Fragment key={name}><tr className="bg-muted"><th colSpan={11} className={cell}>{name}</th></tr>{bills.map(b => { const due = remaining(b); const amount = cents(b.amount); return <tr key={b.id}><td className={`${cell} print:hidden`}><input type="checkbox" aria-label={`Select ${b.feeType} ${b.term || ''}`} disabled={due === null || due === 0} checked={checkedBills.includes(b.id)} onChange={e => setCheckedBills(prev => e.target.checked ? [...prev,b.id] : prev.filter(id => id !== b.id))} /></td><td className={cell}>{b.feeType || 'Fee'}</td><td className={cell}>{mappedAccount(b)}</td><td className={cell}>{b.academicYear || '—'} / {b.term || '—'}</td><td className={cell}>{b.dueDate || '—'}</td><td className={cell}>{due === null ? 'Review' : due === 0 ? 'Paid' : key(b.status) === 'partial' ? 'Partly Paid' : 'Unpaid'}</td><td className={cell}>{amount === null ? 'Review' : money(amount)}{b.scholarshipAppliedAmount && <div className="text-xs text-mist">Net after scholarship {b.scholarshipAppliedAmount}; original {b.scholarshipOriginalAmount}</div>}</td><td className={cell}>{b.scholarshipAppliedAmount || '—'}</td><td className={cell}>—</td><td className={cell}>{amount === null || due === null ? 'Review' : money(amount-due)}</td><td className={cell}>{due === null ? 'Review' : money(due)}</td></tr> })}</Fragment>)}</tbody></table>{!shown.length && <p className="p-4 text-sm text-mist">No fee items in this view.</p>}</div>
          <div className="ml-auto max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Grand Total</span><strong>{money(total)}</strong></div><div className="flex justify-between"><span>Paid</span><strong>{uncertain ? 'Review' : money(paid)}</strong></div><div className="flex justify-between border-t border-line pt-2"><span>Balance</span><strong>{uncertain ? 'Review' : money(balance)}</strong></div></div>
          <p className="text-xs text-mist">Discounts and fines are not automatically applied. A dash indicates no recorded value shown. Totals cover the filtered invoice items. Mapped accounts reflect current settings. Fee payments are not posted automatically; use Payment History → Manual journal guide to prepare an accounting entry.</p>
        </>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end print:hidden"><Button variant="outline" onClick={() => invoiceTab === 'invoice' || invoiceTab === 'paid' ? printFeeInvoice() : window.print()}>Print / PDF</Button></div>
      </section>{paymentModal}
      <Modal open={!!manualJournalPayment} onClose={()=>setManualJournalPayment(null)} title="Manual accounting journal guide" maxWidth="2xl"><div className="space-y-4 text-sm"><p>This is a suggested entry only. It does not create or post a journal and is not a link to accounting.</p><p className="text-amber-700">Before entering anything, check Accounting → Journal Voucher for an existing entry for this payment to avoid posting twice. Confirm the accounts and amount with your accountant. The fee credit account is today’s mapping; it may differ from the mapping when the payment was made.</p>{manualPlan?.error ? <p role="alert" className="text-red-600">{manualPlan.error}</p> : manualPlan && <><div className="space-y-1"><div><strong>Payment ID:</strong> {manualJournalPayment?.id}</div><div><strong>Voucher reference:</strong> {manualJournalPayment?.voucherNumber || manualJournalPayment?.reference || '—'}</div><div><strong>Payment date:</strong> {String(manualJournalPayment?.paidAt || '').slice(0,10) || '—'}</div><div><strong>Student:</strong> {manualJournalPayment?.studentName || manualJournalPayment?.student || '—'}</div></div><table className="w-full text-sm"><thead><tr><th className={cell}>Account</th><th className={cell}>Debit</th><th className={cell}>Credit</th></tr></thead><tbody><tr><td className={cell}>{manualPlan.debit}</td><td className={cell}>{manualPlan.amount}</td><td className={cell}>—</td></tr><tr><td className={cell}>{manualPlan.credit}</td><td className={cell}>—</td><td className={cell}>{manualPlan.amount}</td></tr></tbody></table><p>To record it, open Accounting → Journal Voucher and enter the verified lines and payment ID as a reference. Follow your normal approval and posting process.</p></>}<div className="flex justify-end"><Button variant="outline" onClick={()=>setManualJournalPayment(null)}>Close</Button></div></div></Modal>
    </div>
  }
  if (dueOnly) return <div className="space-y-4">
    <PageHeader title="Due Fees Invoice" desc="Review outstanding student fee items" />
    <section className="rounded-xl border border-line bg-surface p-4"><h2 className="mb-3 font-semibold">Select Ground</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Branch"><div className="field flex items-center">{branchName || 'Current branch'}</div></Field><Field label="Class"><Select value={className} onChange={e => {setClassName(e.target.value);setSection('')}}><option value="">All classes</option>{classNames.map(c => <option key={c}>{c}</option>)}</Select></Field><Field label="Section"><Select value={section} disabled={!className} onChange={e=>setSection(e.target.value)}><option value="">All sections</option>{sections.map(c=><option key={c}>{c}</option>)}</Select></Field><Field label="Fees Type"><Select value={feeType} onChange={e=>{setFeeType(e.target.value);setAppliedFeeType(e.target.value);setSelectedIds([])}}><option value="">All fees types</option>{(records.feeTypes ?? []).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field></div><div className="mt-3 flex justify-end"><Button onClick={()=>{setFilter({className,section,academicYear:'',terms:[],groupId:''});setAppliedFeeType(feeType);setSelectedIds([])}}>Filter</Button></div></section>
    <section className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Due Invoice List</h2><div className="flex gap-2"><Input aria-label="Search due invoices" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} /><Button variant="outline" onClick={printSelected}>Generate / Print</Button></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className={cell}><input type="checkbox" aria-label="Select all visible due invoices" checked={visible.length>0 && visible.every(i=>selectedIds.includes(i.id))} onChange={e=>setSelectedIds(prev=>e.target.checked?[...new Set([...prev,...visible.map(i=>i.id)])]:prev.filter(id=>!visible.some(i=>i.id===id)))} /></th>{['Student','Register No','Roll','Mobile No','Fee Group / Item','Due Date','Amount','Paid','Discount','Balance','Action'].map(h=><th key={h} className={cell}>{h}</th>)}</tr></thead><tbody>{visible.map(inv=>{const amounts=inv.bills.map(b=>({total:cents(b.amount),due:remaining(b)}));const unknown=amounts.some(x=>x.total===null||x.due===null);const total=amounts.reduce((n,x)=>n+(x.total??0),0);const balance=amounts.reduce((n,x)=>n+(x.due??0),0);const adjustments=inv.bills.some(b=>['discount','discountAmount','scholarshipDiscount','fine','fineAmount'].some(k=>String(b[k]??'').trim()!=='' && cents(b[k])!==0));return <tr key={inv.id}><td className={cell}><input type="checkbox" aria-label={`Select ${inv.student.name}`} checked={selectedIds.includes(inv.id)} onChange={e=>setSelectedIds(prev=>e.target.checked?[...prev,inv.id]:prev.filter(id=>id!==inv.id))} /></td><td className={cell}>{inv.student.name}</td><td className={cell}>{inv.student.admissionNo||'—'}</td><td className={cell}>{inv.student.rollNo||'—'}</td><td className={cell}>{inv.student.phone||'—'}</td><td className={cell}>{inv.bills.map(b=><div key={b.id}>{b.feeGroupName||'Fee group'} — {b.feeType||'Fee'} <span className="text-xs text-mist">({b.academicYear||'—'} / {b.term||'—'})</span></div>)}</td><td className={cell}>{[...new Set(inv.bills.map(b=>b.dueDate||'—'))].map(d=><div key={d}>{d}</div>)}</td><td className={cell}>{unknown?'Review':money(total)}</td><td className={cell}>{unknown?'Review':money(total-balance)}</td><td className={cell}>{adjustments?'Review':'—'}</td><td className={cell}>{unknown||adjustments?'Review':money(balance)}</td><td className={cell}><div className="flex gap-1"><Button size="sm" variant="outline" onClick={()=>openCollect(inv)}>Collect</Button><button type="button" aria-label={`Delete unpaid items for ${inv.student.name}`} title="Delete unpaid items" onClick={()=>void deleteUnpaid(inv)} className="rounded p-2 text-red-600 hover:bg-red-500/10"><Trash2 className="size-4" /></button></div></td></tr>})}</tbody></table>{!visible.length && <p className="p-4 text-sm text-mist">No outstanding fee items match the filter.</p>}</div><p className="mt-3 text-xs text-mist">Shows unpaid and partly paid fee-group allocations, including future due dates; unknown balances are marked Review. Generate / Print creates student bills for selected rows and the selected fees type. Filtered prints include applied scholarships in net fee amounts but exclude unapplied awards; consult the full student bill. Collect opens the matching invoice. Delete removes only unpaid items without payments; carried-forward items are protected. Balances reflect applied scholarship deductions; unapplied awards require review.</p></section>
  </div>
  return <div className="space-y-4">
    <PageHeader title="Fees Pay / Invoice" desc="View student billing and record payments" />
    <section className="rounded-xl border border-line bg-surface p-4 print:hidden"><h2 className="mb-3 font-semibold">Select Group</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"><Field label="Branch"><div className="field flex items-center">{branchName || 'Current branch'}</div></Field><Field label="Academic Year"><Select value={academicYear} onChange={e => { setAcademicYear(e.target.value); setTerms([]) }}><option value="">All academic years</option>{years.map(y => <option key={y}>{y}</option>)}</Select></Field><Field label="Term / Semester"><MultiSelect aria-label="Term / Semester" values={terms} options={termOptions.map(t => ({ value: t, label: t }))} disabled={!academicYear} placeholder="All terms / semesters" onChange={setTerms} /></Field><Field label="Class"><Select value={className} onChange={e => { setClassName(e.target.value); setSection('') }}><option value="">All classes</option>{classNames.map(c=><option key={c}>{c}</option>)}</Select></Field><Field label="Section"><Select value={section} disabled={!className} onChange={e=>setSection(e.target.value)}><option value="">All sections</option>{sections.map(s=><option key={s}>{s}</option>)}</Select></Field><Field label="Fee Group"><Select value={groupId} onChange={e => setGroupId(e.target.value)}><option value="">All fee groups</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field></div><div className="mt-3 flex justify-end"><Button onClick={() => { setFilter({className,section,academicYear,terms:[...terms],groupId}); setSelectedIds([]); setInvoiceId('') }}>Filter</Button></div></section>
    <section className="rounded-xl border border-line bg-surface p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Invoice List</h2><div className="flex min-w-0 items-center gap-2 print:hidden"><Input aria-label="Search invoices" placeholder="Search invoices" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0" /><Button variant="outline" onClick={printSelected}>Print / PDF</Button></div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className={`${cell} print:hidden`}><input type="checkbox" aria-label="Select all visible invoices" checked={visible.length > 0 && visible.every(i => selectedIds.includes(i.id))} onChange={e => setSelectedIds(prev => e.target.checked ? [...new Set([...prev, ...visible.map(i => i.id)])] : prev.filter(id => !visible.some(i => i.id === id)))} /></th>{['Action','Student','Class','Section','Register No','Roll','Mobile No','Fee Group','Status','Outstanding'].map(c=><th key={c} className={`${cell} ${c === 'Action' ? 'print:hidden' : ''}`}>{c}</th>)}</tr></thead><tbody>{visible.map(inv => { const c = classInfo(inv.student,classes); const values = inv.bills.map(remaining); const unknown = values.some(v=>v===null); const total = values.reduce<number>((sum,v)=>sum+(v ?? 0),0); const hasPayments = inv.bills.some(b=> key(b.status)==='paid' || key(b.status)==='partial' || (cents(b.amountPaid) ?? 0)>0); const status = unknown ? 'Review balance' : total===0 ? 'Paid' : hasPayments ? 'Partly Paid' : 'Unpaid'; return <tr key={inv.id}><td className={`${cell} print:hidden`}><input type="checkbox" aria-label={`Select invoice for ${inv.student.name}`} checked={selectedIds.includes(inv.id)} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, inv.id] : prev.filter(id => id !== inv.id))} /></td><td className={`${cell} print:hidden`}><div className="flex items-center gap-1"><button type="button" aria-label={`Email reminder for ${inv.student.name}`} title="Open fee reminder email draft" onClick={() => invoiceEmail(inv)} className="rounded p-2 hover:bg-muted"><Mail className="size-4" /></button><Button size="sm" variant="outline" onClick={()=>openCollect(inv)}>Collect</Button><button type="button" aria-label={`Delete unpaid items for ${inv.student.name}`} title="Delete unpaid items" onClick={() => void deleteUnpaid(inv)} className="rounded p-2 text-red-600 hover:bg-red-500/10"><Trash2 className="size-4" /></button></div></td><td className={cell}>{inv.student.name}</td><td className={cell}>{c.name || '—'}</td><td className={cell}>{c.section || '—'}</td><td className={cell}>{inv.student.admissionNo || '—'}</td><td className={cell}>{inv.student.rollNo || '—'}</td><td className={cell}>{inv.student.phone || '—'}</td><td className={cell}>{[...new Set(inv.bills.map(b => String(b.feeGroupName ?? '').trim() || String(groups.find(g => g.id === b.feeGroupId)?.name ?? '').trim() || 'Fee group unavailable'))].map(g => <div key={g}>{g}</div>)}</td><td className={cell}>{status}</td><td className={cell}>{unknown ? 'Review' : money(total)}</td></tr> })}</tbody></table>{!visible.length && <p className="p-4 text-sm text-mist">No billing entries match the filter.</p>}</div>
      <p className="mt-3 text-xs text-mist print:hidden">The invoice list shows fee-group billing entries, including allocations saved in Student Billing. Other billing entries are preserved but not shown here. Filters apply to the listed billing items; items with no period appear only when the period filter is not selected. Actions affect the filtered items shown. Print / PDF prints the selected student bills, including selected rows hidden by search, in the browser’s print dialog. Email opens a reminder draft for verified outstanding items; it is not sent automatically. Delete removes only unpaid items without recorded payments. Existing partial bills without a recorded paid amount require review before collection.</p>
    </section>

  </div>
}

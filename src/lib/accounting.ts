import type {
  Account, AccountingSettings, BankAccount, BankReconciliation, BankSignatory, Budget,
  JournalVoucher, PaymentVoucher, ReceiptVoucher, ValueBookEntry, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate, AccountType, ReceiptLine,
} from '../types'

// ---- Keys ----
export const ACCOUNTS_KEY = 'fitpro_accounts'
export const ACCT_SETTINGS_KEY = 'fitpro_accounting_settings'
export const RECEIPTS_KEY = 'fitpro_receipt_vouchers'
export const PAYMENTS_KEY = 'fitpro_payment_vouchers'
export const JOURNALS_KEY = 'fitpro_journal_vouchers'
export const BANKS_KEY = 'fitpro_bank_accounts'
export const RECON_KEY = 'fitpro_bank_reconciliations'
export const BUDGETS_KEY = 'fitpro_budgets'
export const VALUEBOOK_KEY = 'fitpro_value_book'
export const SIGNATORIES_KEY = 'fitpro_bank_signatories'
export const SERIALS_KEY = 'fitpro_voucher_serials'
export const FUNDS_KEY = 'fitpro_funds'
export const PAYMENT_MODES_KEY = 'fitpro_payment_modes'
export const DETAIL_TYPES_KEY = 'fitpro_account_detail_types'
export const INCOME_MODS_KEY = 'fitpro_income_statement_mods'
export const CURRENCY_RATES_KEY = 'fitpro_currency_rates'

export const ACCOUNT_TYPE_LABELS = [
  'Assets',
  'Liabilities',
  'Equity',
  'Income',
  'Expenses',
  'Accounts Receivable (A/R)',
  'Accounts Payable (A/P)',
  'Current Assets',
  'Fixed Assets',
  'Current Liabilities',
  'Long-Term Liabilities',
  'Cost of Sales',
  'Operating Expenses',
  'Other Income',
  'Other Expense',
]

export const CASH_FLOW_SECTIONS = [
  'Cash flows from operating activities',
  'Cash flows from investing activities',
  'Cash flows from financing activities',
]

export const VOUCHER_TYPES = [
  'Receipt', 'Payment', 'Journal', 'Fixed Asset Depreciation', 'Fixed Asset Transaction', 'Barcode',
]

export const NUMBER_FORMATS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
]

export const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'asset', label: 'Asset' },
  { id: 'liability', label: 'Liability' },
  { id: 'equity', label: 'Equity' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
]

export const VOUCHER_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'momo', label: 'Mobile money' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'card', label: 'Card' },
] as const

export const STAKEHOLDER_CLASSES: { id: string; label: string }[] = [
  { id: 'customer', label: 'Customer' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'employee', label: 'Employee' },
  { id: 'shareholder', label: 'Shareholder' },
  { id: 'other', label: 'Other Stakeholders' },
]

export const SEARCH_TYPES: { id: string; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'this_year', label: 'This Year' },
  { id: 'last_year', label: 'Last Year' },
  { id: 'custom', label: 'Custom Date Range' },
]

export const DEFAULT_ACCOUNTING_SETTINGS: AccountingSettings = {
  fiscalYearStartMonth: 0, // January
  taxYearStartMonth: -1, // Same as financial year
  accountingMethod: 'accrual',
  enableAccountNumbers: true,
  showAccountNumbers: true,
  closeTheBooks: false,
  defaultCurrency: 'GHS',
  vatRate: 15,
  autoPost: true,
  rvPrefix: 'RV',
  pvPrefix: 'PV',
  jvPrefix: 'JV',
  paymentModes: { cash: true, bank: true, momo: true, cheque: true, card: true },
}

export function loadAccountingSettings(): AccountingSettings {
  const base = { ...DEFAULT_ACCOUNTING_SETTINGS }
  const saved = load(ACCT_SETTINGS_KEY, {}) as Partial<AccountingSettings> & { fiscalYearStart?: string }
  // Migrate legacy MM-DD fiscalYearStart string to fiscalYearStartMonth.
  if (typeof saved.fiscalYearStart === 'string' && /^\d{2}-\d{2}$/.test(saved.fiscalYearStart)) {
    base.fiscalYearStartMonth = Math.min(11, Math.max(0, Number(saved.fiscalYearStart.slice(0, 2)) - 1))
    delete (saved as Record<string, unknown>).fiscalYearStart
  }
  return { ...base, ...saved, paymentModes: { ...base.paymentModes, ...(saved.paymentModes || {}) } }
}

// ---- Seeds ----
export const ACCOUNTS: Account[] = [
  { id: 'ac_1000', code: '1000', name: 'Available for sale assets (short-term)', type: 'asset', detailType: 'Current assets', primaryBalance: 0 },
  { id: 'ac_1100', code: '1100', name: 'Cash Account', type: 'asset', detailType: 'Cash and cash equivalents', primaryBalance: 4033.12, bankBalance: 4033.12 },
  { id: 'ac_1200', code: '1200', name: 'Bank — Stanbic (Cedi)', type: 'asset', parentCode: '1100', detailType: 'Cash and cash equivalents', primaryBalance: 52600, bankBalance: 52600 },
  { id: 'ac_1300', code: '1300', name: 'Accounts Receivable', type: 'asset', detailType: 'Current assets', primaryBalance: 0 },
  { id: 'ac_1400', code: '1400', name: 'Inventory', type: 'asset', detailType: 'Current assets', primaryBalance: 0 },
  { id: 'ac_1500', code: '1500', name: 'Equipment & Fixtures', type: 'asset', detailType: 'Fixed assets', description: 'Fixed assets at cost', primaryBalance: 0 },
  { id: 'ac_2000', code: '2000', name: 'Accounts Payable', type: 'liability', detailType: 'Current liabilities', primaryBalance: 0 },
  { id: 'ac_2100', code: '2100', name: 'VAT Payable', type: 'liability', detailType: 'Current liabilities', primaryBalance: 0 },
  { id: 'ac_2200', code: '2200', name: 'Loans Payable', type: 'liability', detailType: 'Long-term liabilities', primaryBalance: 0 },
  { id: 'ac_3000', code: '3000', name: 'Owner\u2019s Equity', type: 'equity', detailType: 'Equity', primaryBalance: 0 },
  { id: 'ac_4000', code: '4000', name: 'Membership Revenue', type: 'income', detailType: 'Sales of Product Income', primaryBalance: 0 },
  { id: 'ac_4100', code: '4100', name: 'Class & PT Revenue', type: 'income', detailType: 'Sales of Product Income', primaryBalance: 0 },
  { id: 'ac_4200', code: '4200', name: 'Retail & Supplement Sales', type: 'income', detailType: 'Sales of Product Income', primaryBalance: 0 },
  { id: 'ac_4900', code: '4900', name: 'Cost of sales', type: 'expense', detailType: 'Cost of sales', primaryBalance: 0 },
  { id: 'ac_5000', code: '5000', name: 'Salaries & Wages', type: 'expense', detailType: 'Cost of labour - COS', primaryBalance: 0 },
  { id: 'ac_5100', code: '5100', name: 'Rent & Utilities', type: 'expense', detailType: 'Facilities and administration', primaryBalance: 0 },
  { id: 'ac_5200', code: '5200', name: 'Marketing & Advertising', type: 'expense', detailType: 'Marketing', primaryBalance: 0 },
  { id: 'ac_5300', code: '5300', name: 'Bank charges', type: 'expense', detailType: 'Bank charges', primaryBalance: 0 },
  { id: 'ac_5400', code: '5400', name: 'Commissions and fees', type: 'expense', detailType: 'Commissions and fees', primaryBalance: 0 },
  { id: 'ac_5500', code: '5500', name: 'Equipment Maintenance', type: 'expense', detailType: 'Facilities and administration', primaryBalance: 0 },
]

export const RECEIPTS: ReceiptVoucher[] = [
  { id: 'rv_1', number: 'RV-0001', date: '2026-08-01', receivedFrom: 'Ama Boateng', stakeholderClass: 'customer', depositAccountId: 'ac_1000', lines: [{ accountId: 'ac_4000', narration: 'Monthly membership', amount: 450 }], amount: 450, method: 'momo', referenceNo: 'REF-100201', currency: 'GHS', description: 'Monthly membership', status: 'posted', createdBy: 'u_accountant', createdAt: '2026-08-01T09:00:00' },
  { id: 'rv_2', number: 'RV-0002', date: '2026-08-03', receivedFrom: 'Kofi Asante', stakeholderClass: 'customer', depositAccountId: 'ac_1000', lines: [{ accountId: 'ac_4100', narration: 'Personal training session', amount: 150 }], amount: 150, method: 'cash', referenceNo: 'REF-100202', currency: 'GHS', description: 'Personal training session', status: 'posted', createdBy: 'u_accountant', createdAt: '2026-08-03T10:00:00' },
  { id: 'rv_3', number: 'RV-0003', date: '2026-08-05', receivedFrom: 'Retail counter', stakeholderClass: 'customer', depositAccountId: 'ac_1100', lines: [{ accountId: 'ac_4200', narration: 'Supplements sale', amount: 320 }], amount: 320, method: 'card', referenceNo: 'REF-100203', currency: 'GHS', description: 'Supplements sale', status: 'posted', createdBy: 'u_admin', createdAt: '2026-08-05T14:00:00' },
  { id: 'rv_4', number: 'RV-0004', date: '2026-08-08', receivedFrom: 'GhanaFit Distributors', stakeholderClass: 'supplier', depositAccountId: 'ac_1100', lines: [{ accountId: 'ac_1200', narration: 'Supplier rebate', amount: 900 }], amount: 900, method: 'bank', referenceNo: 'REF-100204', currency: 'GHS', description: 'Supplier rebate', status: 'draft', createdBy: 'u_accountant', createdAt: '2026-08-08T11:00:00' },
  { id: 'rv_5', number: 'RV-0005', date: '2026-08-12', receivedFrom: 'Kwabena Osei', stakeholderClass: 'customer', depositAccountId: 'ac_1000', lines: [{ accountId: 'ac_4000', narration: 'Quarterly membership', amount: 600 }], amount: 600, method: 'momo', referenceNo: 'REF-100205', currency: 'GHS', description: 'Quarterly membership', status: 'posted', createdBy: 'u_admin', createdAt: '2026-08-12T09:30:00' },
]

export const PAYMENTS: PaymentVoucher[] = [
  { id: 'pv_1', number: 'PV-0001', date: '2026-08-02', paidTo: 'GhanaFit Distributors', stakeholderClass: 'supplier', paymentAccountId: 'ac_1100', lines: [{ accountId: 'ac_1300', narration: 'Supplement restock', amount: 2400 }], amount: 2400, method: 'bank', referenceNo: 'REF-200001', currency: 'GHS', description: 'Supplement restock', status: 'posted', createdBy: 'u_accountant', createdAt: '2026-08-02T11:00:00' },
  { id: 'pv_2', number: 'PV-0002', date: '2026-08-06', paidTo: 'ECG (Electricity)', stakeholderClass: 'supplier', paymentAccountId: 'ac_1100', lines: [{ accountId: 'ac_5100', narration: 'August utility bill', amount: 980 }], amount: 980, method: 'momo', referenceNo: 'REF-200002', currency: 'GHS', description: 'August utility bill', status: 'posted', createdBy: 'u_admin', createdAt: '2026-08-06T09:00:00' },
  { id: 'pv_3', number: 'PV-0003', date: '2026-08-10', paidTo: 'Staff payroll', stakeholderClass: 'employee', paymentAccountId: 'ac_1000', lines: [{ accountId: 'ac_5000', narration: 'July salaries', amount: 8500 }], amount: 8500, method: 'bank', referenceNo: 'REF-200003', currency: 'GHS', description: 'July payroll run', status: 'draft', createdBy: 'u_accountant', createdAt: '2026-08-10T15:00:00' },
]

export const JOURNALS: JournalVoucher[] = [
  {
    id: 'jv_1', number: 'JV-0001', date: '2026-08-04', description: 'Depreciation — equipment',
    lines: [
      { accountId: 'ac_5300', debit: 620, credit: 0 },
      { accountId: 'ac_1400', debit: 0, credit: 620 },
    ],
    status: 'posted', notes: 'Monthly straight-line depreciation', createdAt: '2026-08-04T09:00:00',
  },
]

export const BANKS: BankAccount[] = [
  { id: 'bk_1', name: 'The COP-GCB Bank', bank: 'GCB Bank', accountNumber: '1012345678901', branch: 'Adum', type: 'current', code: '2003', detailType: 'Checking', openingBalance: 70000, balance: 70000, status: 'active' },
  { id: 'bk_2', name: 'National Investment Bank', bank: 'NIB', accountNumber: '9040001234567', branch: 'Airport City', type: 'current', code: '2008', parentId: 'bk_1', detailType: 'Checking', openingBalance: 45000, balance: 52600, status: 'active' },
  { id: 'bk_3', name: 'MTN MoMo Merchant', bank: 'MTN Mobile Money', accountNumber: '+233 24 555 0100', type: 'momo', code: '2009', detailType: 'Mobile money', openingBalance: 8000, balance: 12400, status: 'active' },
]

export const BANK_DETAIL_TYPES = ['Checking', 'Savings', 'Cash on hand', 'Money market', 'Mobile money']

export const SIGNATORIES: BankSignatory[] = [
  { id: 'sg_1', name: 'Naa Adjeley Quaye', role: 'Director', phone: '+233 24 111 0001', email: 'superadmin@fitpro.gym', status: 'active' },
  { id: 'sg_2', name: 'Kwesi Ampofo', role: 'Manager', phone: '+233 24 111 0002', email: 'manager@fitpro.gym', status: 'active' },
]

export const SERIALS: VoucherSerial[] = [
  { id: 'vs_1', voucherType: 'Receipt', startSerial: 2, numberFormat: '3' },
  { id: 'vs_2', voucherType: 'Payment', startSerial: 4, numberFormat: '7' },
  { id: 'vs_3', voucherType: 'Fixed Asset Depreciation', startSerial: 0, numberFormat: '1' },
  { id: 'vs_4', voucherType: 'Fixed Asset Transaction', startSerial: 0, numberFormat: '6' },
  { id: 'vs_5', voucherType: 'Barcode', startSerial: 0, numberFormat: '1' },
]

export const RECONCILIATIONS: BankReconciliation[] = [
  { id: 'rc_1', bankAccountId: 'bk_1', statementDate: '2026-07-31', statementBalance: 52300, bookBalance: 52600, difference: -300, status: 'reconciled', notes: 'Outstanding cheque', createdAt: '2026-08-01T08:00:00' },
]

export const BUDGETS: Budget[] = [
  { id: 'bd_1', year: 2026, accountId: 'ac_1000', months: [3000, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250, 250] },
  { id: 'bd_2', year: 2026, accountId: 'ac_4000', months: [40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000], notes: 'Membership revenue target' },
  { id: 'bd_3', year: 2026, accountId: 'ac_5000', months: [40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000, 40000], notes: 'Annual payroll budget' },
  { id: 'bd_4', year: 2026, accountId: 'ac_5100', months: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000] },
  { id: 'bd_5', year: 2026, accountId: 'ac_5200', months: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
]

export function budgetTotal(b: Budget): number {
  return (b.months || []).reduce((s, m) => s + (Number(m) || 0), 0)
}

export const VALUE_BOOK: ValueBookEntry[] = [
  { id: 'vb_1', date: '2026-01-01', assetName: 'Treadmills (4)', openingValue: 112000, additions: 0, depreciation: 14000, closingValue: 98000 },
  { id: 'vb_2', date: '2026-01-01', assetName: 'Strength equipment', openingValue: 48000, additions: 0, depreciation: 4800, closingValue: 43200 },
  { id: 'vb_3', date: '2026-01-01', assetName: 'Furniture & fixtures', openingValue: 26000, additions: 4000, depreciation: 3000, closingValue: 27000 },
]

// ---- Loaders / savers ----
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export const loadAccounts = () => load(ACCOUNTS_KEY, ACCOUNTS)
export const saveAccounts = (v: Account[]) => save(ACCOUNTS_KEY, v)
export const saveAccountingSettings = (v: AccountingSettings) => save(ACCT_SETTINGS_KEY, v)
export const loadReceipts = (): ReceiptVoucher[] => {
  const list = load<ReceiptVoucher[]>(RECEIPTS_KEY, RECEIPTS)
  // Normalize legacy records (single accountId) into deposit + line structure.
  return list.map((r) => {
    const legacy = r as ReceiptVoucher & { accountId?: string }
    if (legacy.accountId && !r.depositAccountId) {
      return {
        ...r,
        depositAccountId: legacy.accountId,
        lines: r.lines?.length ? r.lines : [{ accountId: legacy.accountId, narration: r.description || '', amount: r.amount }],
      }
    }
    return r
  })
}
export const saveReceipts = (v: ReceiptVoucher[]) => save(RECEIPTS_KEY, v)
export const loadPayments = (): PaymentVoucher[] => {
  const list = load<PaymentVoucher[]>(PAYMENTS_KEY, PAYMENTS)
  return list.map((p) => {
    const legacy = p as PaymentVoucher & { accountId?: string }
    if (legacy.accountId && !p.paymentAccountId) {
      return {
        ...p,
        paymentAccountId: legacy.accountId,
        lines: p.lines?.length ? p.lines : [{ accountId: legacy.accountId, narration: p.description || '', amount: p.amount }],
      }
    }
    return p
  })
}
export const savePayments = (v: PaymentVoucher[]) => save(PAYMENTS_KEY, v)
export const loadJournals = () => load(JOURNALS_KEY, JOURNALS)
export const saveJournals = (v: JournalVoucher[]) => save(JOURNALS_KEY, v)
export const loadBanks = () => load(BANKS_KEY, BANKS)
export const saveBanks = (v: BankAccount[]) => save(BANKS_KEY, v)
export const loadReconciliations = () => load(RECON_KEY, RECONCILIATIONS)
export const saveReconciliations = (v: BankReconciliation[]) => save(RECON_KEY, v)
export const loadBudgets = (): Budget[] => {
  const list = load<Budget[]>(BUDGETS_KEY, BUDGETS)
  return list.map((b) => {
    const legacy = b as Budget & { budgeted?: number }
    if (legacy.budgeted != null && !Array.isArray(b.months)) {
      const per = Math.round(legacy.budgeted / 12)
      const months = Array(12).fill(per)
      months[11] = legacy.budgeted - per * 11
      return { ...b, months }
    }
    return b
  })
}
export const saveBudgets = (v: Budget[]) => save(BUDGETS_KEY, v)
export const loadValueBook = () => load(VALUEBOOK_KEY, VALUE_BOOK)
export const saveValueBook = (v: ValueBookEntry[]) => save(VALUEBOOK_KEY, v)
export const loadSignatories = () => load(SIGNATORIES_KEY, SIGNATORIES)
export const saveSignatories = (v: BankSignatory[]) => save(SIGNATORIES_KEY, v)
export const loadSerials = () => load(SERIALS_KEY, SERIALS)
export const saveSerials = (v: VoucherSerial[]) => save(SERIALS_KEY, v)

export const FUNDS: Fund[] = [
  { id: 'fd_1', name: 'DISTRICT FUND', status: 'active' },
  { id: 'fd_2', name: 'MINISTRY FUND', status: 'active' },
  { id: 'fd_3', name: 'DESIGNATED FUND', status: 'active' },
]
export const loadFunds = () => load(FUNDS_KEY, FUNDS)
export const saveFunds = (v: Fund[]) => save(FUNDS_KEY, v)

export const PAYMENT_MODES: PaymentModeOption[] = [
  { id: 'pm_1', name: 'Cash', status: 'active' },
  { id: 'pm_2', name: 'Bank', status: 'active' },
  { id: 'pm_3', name: 'Mobile money', status: 'active' },
  { id: 'pm_4', name: 'Cheque', status: 'active' },
  { id: 'pm_5', name: 'Card', status: 'active' },
]
export const loadPaymentModes = () => load(PAYMENT_MODES_KEY, PAYMENT_MODES)
export const savePaymentModes = (v: PaymentModeOption[]) => save(PAYMENT_MODES_KEY, v)

export const DETAIL_TYPES: AccountDetailType[] = [
  { id: 'dt_1', name: 'Tithes', accountType: 'Accounts Payable (A/P)', cashFlowSection: 'Cash flows from operating activities', description: 'Tithes received from members', mandatory: true },
  { id: 'dt_2', name: 'Missions Offering', accountType: 'Accounts Payable (A/P)', cashFlowSection: 'Cash flows from operating activities' },
]
export const loadDetailTypes = () => load(DETAIL_TYPES_KEY, DETAIL_TYPES)
export const saveDetailTypes = (v: AccountDetailType[]) => save(DETAIL_TYPES_KEY, v)

export const INCOME_MODS: IncomeStatementMod[] = [
  { id: 'im_1', name: 'Uncategorised Income', type: 'Income', active: true },
  { id: 'im_2', name: 'Unapplied Cash Payment Income', type: 'Income', active: true },
  { id: 'im_3', name: 'Sales of Product Income', type: 'Income', active: true },
  { id: 'im_4', name: 'Sales - wholesale', type: 'Income', active: true },
  { id: 'im_5', name: 'Sales - retail', type: 'Income', active: true },
  { id: 'im_6', name: 'Sales', type: 'Income', active: true },
]
export const loadIncomeMods = () => load(INCOME_MODS_KEY, INCOME_MODS)
export const saveIncomeMods = (v: IncomeStatementMod[]) => save(INCOME_MODS_KEY, v)

export const CURRENCIES = ['USD', 'EUR', 'GHS', 'GBP', 'NGN', 'ZAR']

export const CURRENCY_RATES: CurrencyRate[] = [
  { id: 'cr_1', from: 'USD', to: 'EUR', rate: 0.8729, updatedAt: '2026-03-30T14:30:07' },
  { id: 'cr_2', from: 'EUR', to: 'USD', rate: 1.1457, updatedAt: '2026-03-30T14:30:09' },
  { id: 'cr_3', from: 'USD', to: 'GHS', rate: 0, updatedAt: '2026-04-08T00:43:10' },
  { id: 'cr_4', from: 'EUR', to: 'GHS', rate: 0, updatedAt: '2026-04-08T00:43:10' },
  { id: 'cr_5', from: 'GHS', to: 'USD', rate: 0, updatedAt: '2026-04-08T00:43:10' },
  { id: 'cr_6', from: 'GHS', to: 'EUR', rate: 0, updatedAt: '2026-04-08T00:43:10' },
]
export const loadCurrencyRates = () => load(CURRENCY_RATES_KEY, CURRENCY_RATES)
export const saveCurrencyRates = (v: CurrencyRate[]) => save(CURRENCY_RATES_KEY, v)

// ---- Helpers ----
export function accountName(accounts: Account[], id: string): string {
  return accounts.find((a) => a.id === id)?.name || id
}

export function nextNumber(prefix: string, list: { number: string }[]): string {
  let max = 0
  for (const r of list) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(r.number || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}

export function voucherTotal(j: { lines: { debit: number; credit: number }[] }): number {
  return j.lines.reduce((s, l) => s + l.debit, 0)
}

import { CHART_OF_ACCOUNTS, CHART_BANK_ACCOUNTS } from '../data/chartOfAccounts'
import type {
  AccountHistoryEntry,
  Account, AccountingSettings, BankAccount, BankReconciliation, BankSignatory, Budget,
  ChequeEntry,
  JournalVoucher, PaymentVoucher, ReceiptVoucher, ValueBookEntry, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate, AccountType, ReceiptLine,
} from '../types'

// ---- Keys ----
export const ACCOUNTS_KEY = 'fitpro_accounts_v4'
export const ACCT_SETTINGS_KEY = 'fitpro_accounting_settings'
export const RECEIPTS_KEY = 'fitpro_receipt_vouchers'
export const PAYMENTS_KEY = 'fitpro_payment_vouchers'
export const JOURNALS_KEY = 'fitpro_journal_vouchers'
export const BANKS_KEY = 'fitpro_bank_accounts_v3'
export const RECON_KEY = 'fitpro_bank_reconciliations'
export const BUDGETS_KEY = 'fitpro_budgets'
export const VALUEBOOK_KEY = 'fitpro_value_book'
export const CHECKS_KEY = 'fitpro_cheques'
export const SIGNATORIES_KEY = 'fitpro_bank_signatories'
export const SERIALS_KEY = 'fitpro_voucher_serials'
export const FUNDS_KEY = 'fitpro_funds'
export const PAYMENT_MODES_KEY = 'fitpro_payment_modes'
export const DETAIL_TYPES_KEY = 'fitpro_account_detail_types_v2'
export const INCOME_MODS_KEY = 'fitpro_income_statement_mods'
export const CURRENCY_RATES_KEY = 'fitpro_currency_rates'

/**
 * Account types — mirrors the accounting_account_type table from the source
 * system: type → subclass → class, with the normal (trial) balance side.
 */
export type AccountTypeDef = {
  id: number
  name: string
  subclass: string
  classLabel: string
  class: import('../types').AccountType
  normalBalance: 'DEBIT' | 'CREDIT'
}

export const ACCOUNT_TYPE_DEFS: AccountTypeDef[] = [
  { id: 1,  name: 'Accounts Receivable (A/R)', subclass: 'CURRENT ASSETS',          classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
  { id: 2,  name: 'Current Assets',            subclass: 'CURRENT ASSETS',          classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
  { id: 3,  name: 'Cash and Cash Equivalents', subclass: 'CURRENT ASSETS',          classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
  { id: 4,  name: 'Fixed Assets',              subclass: 'NON-CURRENT ASSETS',      classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
  { id: 5,  name: 'Non-Current Assets',        subclass: 'NON-CURRENT ASSETS',      classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
  { id: 6,  name: 'Accounts Payable (A/P)',    subclass: 'CURRENT LIABILITIES',     classLabel: 'LIABILITIES', class: 'liability', normalBalance: 'CREDIT' },
  { id: 7,  name: 'Credit Card',               subclass: 'CURRENT LIABILITIES',     classLabel: 'LIABILITIES', class: 'liability', normalBalance: 'CREDIT' },
  { id: 8,  name: 'Current Liabilities',       subclass: 'CURRENT LIABILITIES',     classLabel: 'LIABILITIES', class: 'liability', normalBalance: 'CREDIT' },
  { id: 9,  name: 'Non-Current Liabilities',   subclass: 'NON-CURRENT LIABILITIES', classLabel: 'LIABILITIES', class: 'liability', normalBalance: 'CREDIT' },
  { id: 10, name: 'Equity',                    subclass: 'EQUITY',                  classLabel: 'EQUITY',      class: 'equity',    normalBalance: 'CREDIT' },
  { id: 11, name: 'Income',                    subclass: 'INCOME',                  classLabel: 'INCOME',      class: 'income',    normalBalance: 'CREDIT' },
  { id: 12, name: 'Other Income',              subclass: 'INCOME',                  classLabel: 'INCOME',      class: 'income',    normalBalance: 'CREDIT' },
  { id: 13, name: 'Cost of Sales',             subclass: 'EXPENDITURE',             classLabel: 'EXPENSES',    class: 'expense',   normalBalance: 'DEBIT' },
  { id: 14, name: 'Expenses',                  subclass: 'EXPENDITURE',             classLabel: 'EXPENSES',    class: 'expense',   normalBalance: 'DEBIT' },
  { id: 15, name: 'Other Expenses',            subclass: 'EXPENDITURE',             classLabel: 'EXPENSES',    class: 'expense',   normalBalance: 'DEBIT' },
  { id: 16, name: 'Bank',                      subclass: 'CURRENT ASSETS',          classLabel: 'ASSETS',      class: 'asset',     normalBalance: 'DEBIT' },
]

export const accountTypeName = (id?: number): string | undefined =>
  ACCOUNT_TYPE_DEFS.find((t) => t.id === id)?.name

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
  { id: 'branch', label: 'Branch' },
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

export const DEFAULT_AUTO_MAPPING_LINES: Record<string, {
  hint?: string
  paymentAccountId: string
  depositToAccountId: string
  enabled: boolean
}> = {
  'invoice.default': {
    hint: 'Default for all item',
    paymentAccountId: 'ac_66', // Sales
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'invoice.discount': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_19', // Discounts given - COS
    enabled: true,
  },
  'payment.sales': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_13', // Cash Account (Cash and Cash Equivalents)
    enabled: true,
  },
  'payment.expenses': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'creditnote.sales': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_13', // Cash and Cash Equivalents
    enabled: true,
  },
  'creditnote.refund': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_13', // Cash and Cash Equivalents
    enabled: true,
  },
  'expense.default': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_80', // Uncategorised Expense
    enabled: true,
  },
  'tax.sales': {
    paymentAccountId: 'ac_29', // Income tax payable
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'tax.expenses': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_29', // Income tax payable
    enabled: true,
  },
  // Payslips
  'payslip.insurance': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_32', // Insurance - Liability
    enabled: true,
  },
  'payslip.tax': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_28', // Income tax expense
    enabled: true,
  },
  'payslip.netpay': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_56', // Payroll Expenses
    enabled: true,
  },
  // Purchase
  'purchase.order': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_80', // Uncategorised Expense
    enabled: true,
  },
  'purchase.invoice': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_80', // Uncategorised Expense
    enabled: true,
  },
  'purchase.payment': {
    paymentAccountId: 'ac_16', // Cost of sales
    depositToAccountId: 'ac_37', // Inventory Asset
    enabled: true,
  },
  'purchase.return': {
    paymentAccountId: 'ac_80', // Uncategorised Expense
    depositToAccountId: 'ac_13', // Cash and Cash Equivalents
    enabled: true,
  },
  'purchase.refund': {
    paymentAccountId: 'ac_37', // Inventory Asset
    depositToAccountId: 'ac_16', // Cost of sales
    enabled: true,
  },
  'purchase.tax': {
    paymentAccountId: 'ac_13', // Cash and Cash Equivalents
    depositToAccountId: 'ac_29', // Income tax payable
    enabled: true,
  },
  // Inventory
  'inventory.receiving': {
    paymentAccountId: 'ac_87', // Accounts Payable (A/P)
    depositToAccountId: 'ac_36', // Inventory
    enabled: true,
  },
  'inventory.return': {
    paymentAccountId: 'ac_1', // Accounts Receivable (A/R)
    depositToAccountId: 'ac_36', // Inventory
    enabled: true,
  },
  'inventory.delivery': {
    paymentAccountId: 'ac_89', // Opening balance equity
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'inventory.profit': {
    paymentAccountId: 'ac_66', // Sales
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'inventory.increase': {
    paymentAccountId: 'ac_87', // Accounts Payable (A/P)
    depositToAccountId: 'ac_89', // Opening balance equity
    enabled: true,
  },
  'inventory.decrease': {
    paymentAccountId: 'ac_89', // Opening balance equity
    depositToAccountId: 'ac_1', // Accounts Receivable (A/R)
    enabled: true,
  },
  'inventory.openingstock': {
    paymentAccountId: 'ac_98', // THE COP BOBIKUMA-GCB
    depositToAccountId: 'ac_89', // Opening balance equity
    enabled: true,
  },
  // Manufacturing
  'mfg.material': {
    paymentAccountId: 'ac_13', // Cash and cash equivalents
    depositToAccountId: 'ac_45', // Materials - COS
    enabled: true,
  },
  'mfg.labour': {
    paymentAccountId: 'ac_13', // Cash and cash equivalents
    depositToAccountId: 'ac_18', // Direct labour - COS
    enabled: true,
  },
}

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
  autoMapping: {
    enabled: true,
    lines: JSON.parse(JSON.stringify(DEFAULT_AUTO_MAPPING_LINES)),
  },
}

export function loadAccountingSettings(): AccountingSettings {
  const base = { ...DEFAULT_ACCOUNTING_SETTINGS }
  const saved = load(ACCT_SETTINGS_KEY, {}) as Partial<AccountingSettings> & { fiscalYearStart?: string }
  // Migrate legacy MM-DD fiscalYearStart string to fiscalYearStartMonth.
  if (typeof saved.fiscalYearStart === 'string' && /^\d{2}-\d{2}$/.test(saved.fiscalYearStart)) {
    base.fiscalYearStartMonth = Math.min(11, Math.max(0, Number(saved.fiscalYearStart.slice(0, 2)) - 1))
    delete (saved as Record<string, unknown>).fiscalYearStart
  }
  // Ensure autoMapping exists (backfill defaults) when older save is loaded.
  const autoMapping = saved.autoMapping ?? base.autoMapping
  const mergedLines: Record<string, { hint?: string; paymentAccountId: string; depositToAccountId: string; enabled: boolean }> = { ...DEFAULT_AUTO_MAPPING_LINES }
  if (autoMapping?.lines) {
    const savedLines = autoMapping.lines as Record<string, { paymentAccountId?: string; depositToAccountId?: string; enabled?: boolean; hint?: string }>
    for (const [key, def] of Object.entries(DEFAULT_AUTO_MAPPING_LINES)) {
      const savedLine = savedLines[key]
      if (savedLine) {
        mergedLines[key] = {
          ...def,
          ...savedLine,
          hint: def.hint,
        }
      }
    }
  }
  return {
    ...base,
    ...saved,
    paymentModes: { ...base.paymentModes, ...(saved.paymentModes || {}) },
    autoMapping: {
      enabled: autoMapping?.enabled ?? base.autoMapping!.enabled,
      lines: mergedLines,
    },
  }
}

// ---- Seeds ----
/**
 * Unified chart — ONE table for everything, Perfex-style: bank accounts are
 * chart accounts of type 16 (Bank) carrying their bank columns inline.
 */
export const ACCOUNTS: Account[] = CHART_OF_ACCOUNTS.map((a) => {
  const b = CHART_BANK_ACCOUNTS.find((x) => x.id === `bk_${a.id.slice(3)}`)
  return b
    ? {
        ...a,
        bank: b.bank, accountNumber: b.accountNumber, bankBranch: b.branch,
        bankAccountType: b.type, routing: b.routing, country: b.country,
        bankBalance: b.balance,
      }
    : a
})

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

export const BANKS: BankAccount[] = CHART_BANK_ACCOUNTS

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

export const CHEQUES: ChequeEntry[] = [
  { id: 'chq_1', number: '001245', direction: 'issued', bankAccountId: 'bk_1', date: '2026-08-07', clearedDate: '2026-08-12', party: 'GhanaFit Distributors', amount: 2400, status: 'cleared', referenceNo: 'PV-0001', notes: 'Supplement restock', createdAt: '2026-08-07T10:00:00' },
  { id: 'chq_2', number: '001246', direction: 'issued', bankAccountId: 'bk_1', date: '2026-08-15', party: 'ECG (Electricity)', amount: 980, status: 'issued', referenceNo: '', notes: 'August utility', createdAt: '2026-08-15T09:00:00' },
  { id: 'chq_3', number: '452201', direction: 'received', bankAccountId: 'bk_1', date: '2026-08-18', party: 'Kwabena Osei', amount: 600, status: 'received', referenceNo: 'RV-0005', notes: 'Quarterly membership cheque', createdAt: '2026-08-18T11:00:00' },
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

export function loadAccounts(): Account[] {
  const saved = load<Account[]>(ACCOUNTS_KEY, ACCOUNTS)
  // Merge seed accounts into saved store — new seed accounts are added, and
  // renamed/corrected display fields (name, type, detailType, status) on existing
  // seeds are updated in place so dropdown labels stay in sync with the reference UI.
  const byId = new Map(saved.map((a) => [a.id, a]))
  let changed = false
  for (const seed of ACCOUNTS) {
    const existing = byId.get(seed.id)
    if (!existing) {
      byId.set(seed.id, seed)
      changed = true
    } else {
      const merged: Account = { ...existing }
      let rowChanged = false
      const fieldsToSync: (keyof Account)[] = ['name', 'type', 'detailType', 'status', 'code', 'accountTypeId']
      for (const f of fieldsToSync) {
        const seedVal = (seed as unknown as Record<string, unknown>)[f]
        const existVal = (existing as unknown as Record<string, unknown>)[f]
        if (seedVal !== undefined && existVal !== seedVal) {
          ;(merged as unknown as Record<string, unknown>)[f] = seedVal
          rowChanged = true
        }
      }
      if (rowChanged) { byId.set(seed.id, merged); changed = true }
    }
  }
  const merged = Array.from(byId.values())
  if (changed) saveAccounts(merged)
  return merged
}
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
/** Advance an ISO date by a recurring interval. */
export function addRecurringInterval(dateIso: string, every: number, period: 'days' | 'weeks' | 'months' | 'years'): string {
  const d = new Date(dateIso + 'T00:00:00')
  if (period === 'days') d.setDate(d.getDate() + every)
  else if (period === 'weeks') d.setDate(d.getDate() + every * 7)
  else if (period === 'months') d.setMonth(d.getMonth() + every)
  else d.setFullYear(d.getFullYear() + every)
  return d.toISOString().slice(0, 10)
}

export const ACCOUNT_HISTORY_KEY = 'fitpro_account_history'

/**
 * Ledger rows for a posted Income (receipt) voucher:
 *   Dr deposit account (money in) / Cr each income line.
 */
export function historyRowsForReceipt(r: ReceiptVoucher): AccountHistoryEntry[] {
  if (r.status !== 'posted') return []
  const now = new Date().toISOString()
  const rows: AccountHistoryEntry[] = [{
    id: `ah_income_${r.id}_0`, companyId: r.companyId, branchId: r.branchId, account: r.depositAccountId, debit: r.amount, credit: 0,
    description: r.description || undefined, relId: r.id, relType: 'income', dateCreated: r.createdAt || now,
    addedFrom: r.createdBy, customer: r.receivedFrom || undefined, split: r.lines?.[0]?.accountId,
    date: r.date, number: r.number, currencyRate: r.conversionRate,
  }]
  ;(r.lines || []).forEach((l, i) => {
    if (!l.accountId) return
    rows.push({
      id: `ah_income_${r.id}_${i + 1}`, companyId: r.companyId, branchId: r.branchId, account: l.accountId, debit: 0, credit: l.amount,
      description: l.narration || r.description || undefined, relId: r.id, relType: 'income', dateCreated: r.createdAt || now,
      addedFrom: r.createdBy, customer: r.receivedFrom || undefined, split: r.depositAccountId,
      date: r.date, number: r.number, currencyRate: r.conversionRate,
    })
  })
  return rows
}

/**
 * Ledger rows for a posted Expense (payment) voucher:
 *   Cr payment account (money out) / Dr each expense line.
 */
export function historyRowsForPayment(pv: PaymentVoucher): AccountHistoryEntry[] {
  if (pv.status !== 'posted') return []
  const now = new Date().toISOString()
  const rows: AccountHistoryEntry[] = [{
    id: `ah_expense_${pv.id}_0`, companyId: pv.companyId, branchId: pv.branchId, account: pv.paymentAccountId, debit: 0, credit: pv.amount,
    description: pv.description || undefined, relId: pv.id, relType: 'expense', dateCreated: pv.createdAt || now,
    addedFrom: pv.createdBy, vendor: pv.paidTo || undefined, split: pv.lines?.[0]?.accountId,
    date: pv.date, number: pv.number, currencyRate: pv.conversionRate,
  }]
  ;(pv.lines || []).forEach((l, i) => {
    if (!l.accountId) return
    rows.push({
      id: `ah_expense_${pv.id}_${i + 1}`, companyId: pv.companyId, branchId: pv.branchId, account: l.accountId, debit: l.amount, credit: 0,
      description: l.narration || pv.description || undefined, relId: pv.id, relType: 'expense', dateCreated: pv.createdAt || now,
      addedFrom: pv.createdBy, vendor: pv.paidTo || undefined, split: pv.paymentAccountId,
      date: pv.date, number: pv.number, currencyRate: pv.conversionRate,
    })
  })
  return rows
}

/** Ledger rows for a posted Journal Entry — lines post as authored. */
export function historyRowsForJournal(j: JournalVoucher): AccountHistoryEntry[] {
  if (j.status !== 'posted') return []
  const now = new Date().toISOString()
  return j.lines
    .filter((l) => l.accountId)
    .map((l, i) => {
      const other = j.lines.find((x) => x.accountId && x.accountId !== l.accountId)
      return {
        id: `ah_journal_${j.id}_${i}`, companyId: j.companyId, branchId: j.branchId, account: l.accountId, debit: l.debit || 0, credit: l.credit || 0,
        description: j.description || undefined, relId: j.id, relType: 'journal_entry', dateCreated: j.createdAt || now,
        customer: j.stakeholder || undefined, split: other?.accountId,
        date: j.date, number: j.number, currencyRate: j.conversionRate,
      }
    })
}

/** Rebuild the whole history from the current voucher stores. */
export function buildAccountHistory(receipts: ReceiptVoucher[], pvs: PaymentVoucher[], jvs: JournalVoucher[]): AccountHistoryEntry[] {
  return [
    ...receipts.flatMap(historyRowsForReceipt),
    ...pvs.flatMap(historyRowsForPayment),
    ...jvs.flatMap(historyRowsForJournal),
  ]
}

export const loadAccountHistory = (): AccountHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(ACCOUNT_HISTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AccountHistoryEntry[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* fall through */ }
  // First run: derive the opening history from the existing posted vouchers.
  return buildAccountHistory(loadReceipts(), loadPayments(), loadJournals())
}
export const saveAccountHistory = (v: AccountHistoryEntry[]) => save(ACCOUNT_HISTORY_KEY, v)

export const loadJournals = () => load(JOURNALS_KEY, JOURNALS)
export const saveJournals = (v: JournalVoucher[]) => save(JOURNALS_KEY, v)
export function loadBanks(): BankAccount[] {
  const saved = load<BankAccount[]>(BANKS_KEY, BANKS)
  const byId = new Map(saved.map((b) => [b.id, b]))
  let changed = false
  for (const seed of BANKS) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, seed)
      changed = true
    }
  }
  const merged = Array.from(byId.values())
  if (changed) saveBanks(merged)
  return merged
}
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
export const loadCheques = () => load(CHECKS_KEY, CHEQUES)
export const saveCheques = (v: ChequeEntry[]) => save(CHECKS_KEY, v)
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
  { id: 'dt_1', name: 'Accounts Receivable (A/R)', accountType: 'Accounts Receivable (A/R)' },
  { id: 'dt_2', name: 'Allowance for Bad Debts', accountType: 'Current Assets' },
  { id: 'dt_3', name: 'Assets Available for Sale', accountType: 'Current Assets' },
  { id: 'dt_4', name: 'Development Costs', accountType: 'Current Assets' },
  { id: 'dt_5', name: 'Inventory', accountType: 'Current Assets' },
  { id: 'dt_6', name: 'Investments - Other', accountType: 'Current Assets' },
  { id: 'dt_7', name: 'Loans to Officers', accountType: 'Current Assets' },
  { id: 'dt_8', name: 'Loans to Others', accountType: 'Current Assets' },
  { id: 'dt_9', name: 'Loans to Shareholders', accountType: 'Current Assets' },
  { id: 'dt_10', name: 'Other Current Assets', accountType: 'Current Assets' },
  { id: 'dt_11', name: 'Prepaid Expenses', accountType: 'Current Assets' },
  { id: 'dt_12', name: 'Retainage', accountType: 'Current Assets' },
  { id: 'dt_13', name: 'Undeposited Funds', accountType: 'Current Assets' },
  { id: 'dt_141', name: 'Employee Cash Advances', accountType: 'Current Assets' },
  { id: 'dt_15', name: 'Cash and Cash Equivalents', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_16', name: 'Cash on Hand', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_17', name: 'Client Trust Account', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_18', name: 'Money Market', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_19', name: 'Rents Held in Trust', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_20', name: 'Savings', accountType: 'Cash and Cash Equivalents' },
  { id: 'dt_21', name: 'Accumulated Depletion', accountType: 'Fixed Assets' },
  { id: 'dt_22', name: 'Accumulated Depreciation on Property Plant and Equipment', accountType: 'Fixed Assets' },
  { id: 'dt_23', name: 'Buildings', accountType: 'Fixed Assets' },
  { id: 'dt_24', name: 'Depletable Assets', accountType: 'Fixed Assets' },
  { id: 'dt_25', name: 'Furniture and Fixtures', accountType: 'Fixed Assets' },
  { id: 'dt_26', name: 'Land', accountType: 'Fixed Assets' },
  { id: 'dt_27', name: 'Leasehold Improvements', accountType: 'Fixed Assets' },
  { id: 'dt_28', name: 'Machinery and Equipment', accountType: 'Fixed Assets' },
  { id: 'dt_29', name: 'Other Fixed Assets', accountType: 'Fixed Assets' },
  { id: 'dt_30', name: 'Vehicles', accountType: 'Fixed Assets' },
  { id: 'dt_31', name: 'Accumulated Amortisation of Non Current Assets', accountType: 'Non-Current Assets' },
  { id: 'dt_32', name: 'Assets Held for Sale', accountType: 'Non-Current Assets' },
  { id: 'dt_33', name: 'Deferred Tax', accountType: 'Non-Current Assets' },
  { id: 'dt_34', name: 'Goodwill', accountType: 'Non-Current Assets' },
  { id: 'dt_35', name: 'Intangible Assets', accountType: 'Non-Current Assets' },
  { id: 'dt_36', name: 'Lease Buyout', accountType: 'Non-Current Assets' },
  { id: 'dt_37', name: 'Licences', accountType: 'Non-Current Assets' },
  { id: 'dt_38', name: 'Long Term Investments', accountType: 'Non-Current Assets' },
  { id: 'dt_39', name: 'Organisational Costs', accountType: 'Non-Current Assets' },
  { id: 'dt_40', name: 'Other Non Current Assets', accountType: 'Non-Current Assets' },
  { id: 'dt_41', name: 'Security Deposits', accountType: 'Non-Current Assets' },
  { id: 'dt_42', name: 'Accounts Payable (A/P)', accountType: 'Accounts Payable (A/P)' },
  { id: 'dt_43', name: 'Credit Card', accountType: 'Credit Card' },
  { id: 'dt_44', name: 'Accrued Liabilities', accountType: 'Current Liabilities' },
  { id: 'dt_45', name: 'Client Trust Accounts - Liabilities', accountType: 'Current Liabilities' },
  { id: 'dt_46', name: 'Current Tax Liability', accountType: 'Current Liabilities' },
  { id: 'dt_47', name: 'Current Portion of Obligations Under Finance Leases', accountType: 'Current Liabilities' },
  { id: 'dt_48', name: 'Dividends Payable', accountType: 'Current Liabilities' },
  { id: 'dt_50', name: 'Income Tax Payable', accountType: 'Current Liabilities' },
  { id: 'dt_51', name: 'Insurance Payable', accountType: 'Current Liabilities' },
  { id: 'dt_52', name: 'Line of Credit', accountType: 'Current Liabilities' },
  { id: 'dt_53', name: 'Loan Payable', accountType: 'Current Liabilities' },
  { id: 'dt_54', name: 'Other Current Liabilities', accountType: 'Current Liabilities' },
  { id: 'dt_55', name: 'Payroll Clearing', accountType: 'Current Liabilities' },
  { id: 'dt_56', name: 'Payroll Liabilities', accountType: 'Current Liabilities' },
  { id: 'dt_58', name: 'Prepaid Expenses Payable', accountType: 'Current Liabilities' },
  { id: 'dt_59', name: 'Rents in Trust Liability', accountType: 'Current Liabilities' },
  { id: 'dt_60', name: 'Sales and Service Tax Payable', accountType: 'Current Liabilities' },
  { id: 'dt_61', name: 'Accrued Holiday Payable', accountType: 'Non-Current Liabilities' },
  { id: 'dt_62', name: 'Accrued Non Current Liabilities', accountType: 'Non-Current Liabilities' },
  { id: 'dt_63', name: 'Liabilities Related to Assets Held for Sale', accountType: 'Non-Current Liabilities' },
  { id: 'dt_64', name: 'Long Term Debt', accountType: 'Non-Current Liabilities' },
  { id: 'dt_65', name: 'Notes Payable', accountType: 'Non-Current Liabilities' },
  { id: 'dt_66', name: 'Other Non Current Liabilities', accountType: 'Non-Current Liabilities' },
  { id: 'dt_67', name: 'Shareholder Notes Payable', accountType: 'Non-Current Liabilities' },
  { id: 'dt_68', name: 'Accumulated Adjustment', accountType: 'Equity' },
  { id: 'dt_69', name: 'Dividend Disbursed', accountType: 'Equity' },
  { id: 'dt_70', name: 'Equity in Earnings of Subsidiaries', accountType: 'Equity' },
  { id: 'dt_71', name: 'Opening Balance Equity', accountType: 'Equity' },
  { id: 'dt_72', name: 'Ordinary Shares', accountType: 'Equity' },
  { id: 'dt_73', name: 'Other Comprehensive Income', accountType: 'Equity' },
  { id: 'dt_74', name: 'Owner Equity', accountType: 'Equity' },
  { id: 'dt_75', name: 'Paid in Capital or Surplus', accountType: 'Equity' },
  { id: 'dt_76', name: 'Partner Contributions', accountType: 'Equity' },
  { id: 'dt_77', name: 'Partner Distributions', accountType: 'Equity' },
  { id: 'dt_78', name: 'Partner Equity', accountType: 'Equity' },
  { id: 'dt_79', name: 'Preferred Shares', accountType: 'Equity' },
  { id: 'dt_80', name: 'Retained Earnings', accountType: 'Equity' },
  { id: 'dt_81', name: 'Share Capital', accountType: 'Equity' },
  { id: 'dt_82', name: 'Treasury Shares', accountType: 'Equity' },
  { id: 'dt_83', name: 'Discounts/Refunds Given', accountType: 'Income' },
  { id: 'dt_84', name: 'Non Profit Income', accountType: 'Income' },
  { id: 'dt_85', name: 'Other Primary Income', accountType: 'Income' },
  { id: 'dt_86', name: 'Revenue - General', accountType: 'Income' },
  { id: 'dt_87', name: 'Sales - Retail', accountType: 'Income' },
  { id: 'dt_88', name: 'Sales - Wholesale', accountType: 'Income' },
  { id: 'dt_89', name: 'Sales of Product Income', accountType: 'Income' },
  { id: 'dt_90', name: 'Service Fee Income', accountType: 'Income' },
  { id: 'dt_91', name: 'Unapplied Cash Payment Income', accountType: 'Income' },
  { id: 'dt_92', name: 'Dividend Income', accountType: 'Other Income' },
  { id: 'dt_93', name: 'Interest Earned', accountType: 'Other Income' },
  { id: 'dt_94', name: 'Loss on Disposal of Assets', accountType: 'Other Income' },
  { id: 'dt_95', name: 'Other Investment Income', accountType: 'Other Income' },
  { id: 'dt_96', name: 'Other Miscellaneous Income', accountType: 'Other Income' },
  { id: 'dt_97', name: 'Other Operating Income', accountType: 'Other Income' },
  { id: 'dt_98', name: 'Tax Exempt Interest', accountType: 'Other Income' },
  { id: 'dt_99', name: 'Unrealised Loss on Securities, Net of Tax', accountType: 'Other Income' },
  { id: 'dt_100', name: 'Cost of Labour - COS', accountType: 'Cost of Sales' },
  { id: 'dt_101', name: 'Equipment Rental - COS', accountType: 'Cost of Sales' },
  { id: 'dt_102', name: 'Shipping, Freight and Delivery - COS', accountType: 'Cost of Sales' },
  { id: 'dt_103', name: 'Cost of Sales', accountType: 'Cost of Sales' },
  { id: 'dt_103', name: 'Other Costs of Sales - COS', accountType: 'Cost of Sales' },
  { id: 'dt_104', name: 'Supplies and Materials - COS', accountType: 'Cost of Sales' },
  { id: 'dt_105', name: 'Advertising/Promotional', accountType: 'Expenses' },
  { id: 'dt_106', name: 'Amortisation Expense', accountType: 'Expenses' },
  { id: 'dt_107', name: 'Auto', accountType: 'Expenses' },
  { id: 'dt_108', name: 'Bad Debts', accountType: 'Expenses' },
  { id: 'dt_109', name: 'Bank Charges', accountType: 'Expenses' },
  { id: 'dt_110', name: 'Charitable Contributions', accountType: 'Expenses' },
  { id: 'dt_111', name: 'Commissions and Fees', accountType: 'Expenses' },
  { id: 'dt_112', name: 'Cost of Labour', accountType: 'Expenses' },
  { id: 'dt_113', name: 'Dues and Subscriptions', accountType: 'Expenses' },
  { id: 'dt_114', name: 'Equipment Rental', accountType: 'Expenses' },
  { id: 'dt_115', name: 'Finance Costs', accountType: 'Expenses' },
  { id: 'dt_116', name: 'Income Tax Expense', accountType: 'Expenses' },
  { id: 'dt_117', name: 'Insurance', accountType: 'Expenses' },
  { id: 'dt_118', name: 'Interest Paid', accountType: 'Expenses' },
  { id: 'dt_119', name: 'Legal and Professional Fees', accountType: 'Expenses' },
  { id: 'dt_120', name: 'Loss on Discontinued Operations, Net of Tax', accountType: 'Expenses' },
  { id: 'dt_121', name: 'Management Compensation', accountType: 'Expenses' },
  { id: 'dt_122', name: 'Meals and Entertainment', accountType: 'Expenses' },
  { id: 'dt_123', name: 'Office/General Administrative Expenses', accountType: 'Expenses' },
  { id: 'dt_124', name: 'Other Miscellaneous Service Cost', accountType: 'Expenses' },
  { id: 'dt_125', name: 'Other Selling Expenses', accountType: 'Expenses' },
  { id: 'dt_126', name: 'Payroll Expenses', accountType: 'Expenses' },
  { id: 'dt_127', name: 'Rent or Lease of Buildings', accountType: 'Expenses' },
  { id: 'dt_128', name: 'Repair and Maintenance', accountType: 'Expenses' },
  { id: 'dt_129', name: 'Shipping and Delivery Expense', accountType: 'Expenses' },
  { id: 'dt_130', name: 'Supplies and Materials', accountType: 'Expenses' },
  { id: 'dt_131', name: 'Taxes Paid', accountType: 'Expenses' },
  { id: 'dt_132', name: 'Travel Expenses - General and Admin Expenses', accountType: 'Expenses' },
  { id: 'dt_133', name: 'Travel Expenses - Selling Expense', accountType: 'Expenses' },
  { id: 'dt_134', name: 'Unapplied Cash Bill Payment Expense', accountType: 'Expenses' },
  { id: 'dt_135', name: 'Utilities', accountType: 'Expenses' },
  { id: 'dt_136', name: 'Amortisation', accountType: 'Other Expenses' },
  { id: 'dt_137', name: 'Depreciation', accountType: 'Other Expenses' },
  { id: 'dt_138', name: 'Exchange Gain or Loss', accountType: 'Other Expenses' },
  { id: 'dt_139', name: 'Other Expense', accountType: 'Other Expenses' },
  { id: 'dt_140', name: 'Penalties and Settlements', accountType: 'Other Expenses' },
  { id: 'dt_14', name: 'Bank', accountType: 'Bank' },
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

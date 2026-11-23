export type OrgType = 'for-profit' | 'non-profit'

export const ORG_TYPE_OPTIONS: { value: OrgType; label: string }[] = [
  { value: 'for-profit', label: 'For-Profit' },
  { value: 'non-profit', label: 'Non-Profit' },
]

/**
 * Financial reporting terminology per organization type.
 * The accounting structure and logic never change — only titles,
 * labels and report headings follow the selected category.
 * Defaults to For-Profit when a company has no explicit choice.
 */
export function finTerms(t: OrgType | undefined) {
  const fp = (t ?? 'for-profit') === 'for-profit'
  return {
    orgType: (fp ? 'for-profit' : 'non-profit') as OrgType,
    balanceSheet: fp ? 'Balance Sheet' : 'Statement of Financial Position',
    balanceSheetComparison: fp ? 'Balance Sheet Comparison' : 'Comparative Statement of Financial Position',
    balanceSheetSummary: fp ? 'Balance Sheet Summary' : 'Statement of Financial Position Summary',
    profitLoss: fp ? 'Profit & Loss' : 'Income & Expenditure Statement',
    profitLossTitle: fp ? 'Profit and Loss' : 'Income & Expenditure Statement',
    profitLossComparison: fp ? 'Profit and Loss Comparison' : 'Income & Expenditure Comparison',
    equityChanges: fp ? 'Statement of Changes in Equity' : 'Statement of Changes in Net Assets/Funds',
    ieShort: fp ? 'Profit & Loss' : 'Income & Expenditure',
    equitySection: fp ? 'EQUITY' : 'NET ASSETS/FUNDS',
    incomeSection: fp ? 'REVENUE' : 'INCOME',
    expenseSection: fp ? 'EXPENSES' : 'EXPENDITURE',
    equityTotal: fp ? 'Total Equity' : 'Total Net Assets/Funds',
    surplusLabel: fp ? 'Net income (profit or loss)' : 'Surplus/(Deficit) for the period',
  }
}

export type FinTerms = ReturnType<typeof finTerms>

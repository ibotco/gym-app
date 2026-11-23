import type { EduRecords, EduRow } from './eduRecords'

/** One-time branch migration; preserve edited or referenced previous samples. */
export function refreshFeeSamples(records: EduRecords): EduRecords {
  const marker = 'fee-sample-refresh-v1'
  if ((records.feeSampleMigrations ?? []).some(r => r.id === marker)) return records
  const oldGroupNames: Record<string,string> = { 'seed-fg-1': 'Tuition', 'seed-fg-2': 'Auxiliary' }
  const oldTypeNames: Record<string,string> = { 'seed-ft-1': 'Term Fee', 'seed-ft-2': 'ICT Levy' }
  const referenced = (id: string, collections: string[]) => collections.some(key => (records[key] ?? []).some(row => JSON.stringify(row).includes(id)))
  const groups = (records.feeGroups ?? []).filter(r => !(oldGroupNames[r.id] === r.name && r.description === (r.id === 'seed-fg-1' ? 'Core school fees' : 'PTA, excursion, ICT levies') && !r.itemsJson && !referenced(r.id, ['studentBilling', 'fineSetup', 'feesDiscount'])))
  const types = (records.feeTypes ?? []).filter(r => !(oldTypeNames[r.id] === r.name && String(r.defaultAmount ?? '') === (r.id === 'seed-ft-1' ? '850' : '60') && String(r.feeGroup ?? '') === (r.id === 'seed-ft-1' ? 'Tuition' : 'Auxiliary') && !r.description && (!r.status || r.status === 'Active') && !referenced(r.id, ['feeGroups', 'studentBilling', 'fineSetup'])))
  const definitions: Array<[string,string]> = [
    ['Tuition Fee','850.00'], ['Registration Fee','100.00'], ['ICT Fee','60.00'], ['Library Fee','45.00'], ['Examination Fee','120.00'], ['Sports Fee','50.00'], ['Laboratory Fee','80.00'], ['Activity Fee','70.00'], ['Transport Fee','250.00'], ['Development Levy','100.00'],
  ]
  const sampleTypes: EduRow[] = definitions.map(([name, amount], i) => ({ id: `sample-fee-type-v1-${i+1}`, name: `Sample — ${name}`, defaultAmount: amount, description: 'Illustrative sample; review before use.', status: 'Active' }))
  const sampleGroups: EduRow[] = [
    { id: 'sample-fee-group-v1-1', name: 'Sample — Basic Term Fees', indices: [0,2,3,4] },
    { id: 'sample-fee-group-v1-2', name: 'Sample — New Student Fees', indices: [0,1,9] },
    { id: 'sample-fee-group-v1-3', name: 'Sample — Activities and Resources', indices: [3,5,6,7] },
    { id: 'sample-fee-group-v1-4', name: 'Sample — Transport and Tuition', indices: [0,8] },
  ].map(({ id, name, indices }) => ({ id, name, description: 'Illustrative sample; review amounts and due dates before use.', itemsJson: JSON.stringify(indices.map(i => ({ feeTypeId: sampleTypes[i].id, name: sampleTypes[i].name, dueDate: '2027-01-31', amount: sampleTypes[i].defaultAmount }))) }))
  return { ...records, feeTypes: [...types, ...sampleTypes.filter(x => !types.some(r => r.id === x.id))], feeGroups: [...groups, ...sampleGroups.filter(x => !groups.some(r => r.id === x.id))], feeSampleMigrations: [...(records.feeSampleMigrations ?? []), { id: marker }] }
}

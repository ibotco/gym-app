export type ReminderFrequency = 'before' | 'after'
export const reminderFrequencyOptions: { value: ReminderFrequency; label: string }[] = [
  { value: 'before', label: 'Before' }, { value: 'after', label: 'After' },
]
export function readReminderFrequency(row?: {frequency?: string; frequencyCode?: string} | null): ReminderFrequency | '' {
  if (!row) return ''
  if (row.frequencyCode === 'before' || row.frequencyCode === 'after') return row.frequencyCode
  const label = String(row.frequency ?? '').trim().toLowerCase()
  return label === 'before' || label === 'after' ? label : ''
}
/** Days represent the offset from the fee due date, not a repeat interval. */
export function reminderFrequencyConfig(frequency: ReminderFrequency | '', days: string): {frequency: string; frequencyCode: ReminderFrequency; days: string; intervalUnit: string} | null {
  const choice = reminderFrequencyOptions.find(o => o.value === frequency)
  if (!choice || !/^\d+$/.test(days) || !Number.isSafeInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650) return null
  return {frequency: choice.label, frequencyCode: choice.value, days: String(Number(days)), intervalUnit: 'offset_days'}
}

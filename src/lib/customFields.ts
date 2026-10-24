// Admin-defined custom fields — appear on module forms (members, customers,
// leads, …) and their values are stored per record.

import type { CustomField, CustomFieldType } from '../types'

export const CUSTOM_FIELDS_KEY = 'fitpro_custom_fields'

export const CUSTOM_FIELD_MODULES: { value: string; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'lead', label: 'Lead' },
  { value: 'staff', label: 'Employee' },
  { value: 'asset', label: 'Asset' },
  { value: 'inventory', label: 'Inventory item' },
]

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text input' },
  { value: 'textarea', label: 'Text area' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select / dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
]

export function loadCustomFields(): CustomField[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FIELDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomField[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomFields(list: CustomField[]) {
  try {
    localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function moduleLabel(module: string): string {
  return CUSTOM_FIELD_MODULES.find((m) => m.value === module)?.label || module
}

export function nextCustomFieldId(): string {
  return `cf_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

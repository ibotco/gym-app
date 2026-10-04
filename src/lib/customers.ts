import type { Customer, CustomerStatus } from '../types'

export const CUSTOMERS_KEY = 'fitpro_customers'

export const CUSTOMER_STATUSES: { id: CustomerStatus; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'prospect', label: 'Prospect' },
]

export const CUSTOMERS: Customer[] = [
  {
    id: 'cus_1', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Adjoa Biney', email: 'adjoa.biney@mail.com', phone: '+233 24 200 1001',
    company: 'Biney Fitness Ltd', address: 'Airport City, Accra', category: 'Corporate', status: 'active',
    notes: 'Corporate wellness partner — bulk day passes.', totalSpent: 12400, userId: 'u_customer', createdAt: '2024-03-11T09:00:00',
  },
  {
    id: 'cus_2', companyId: 'co_fitpro', branchId: 'br_tema', name: 'Kwabena Osei', email: 'kwabena.osei@mail.com', phone: '+233 24 200 1002',
    status: 'active', address: 'Tema, Community 9', category: 'Walk-in', totalSpent: 3850, createdAt: '2024-06-22T10:00:00',
  },
  {
    id: 'cus_3', companyId: 'co_fitpro', branchId: 'br_osu', name: 'Efua Nyarko', email: 'efua.nyarko@mail.com', phone: '+233 24 200 1003',
    company: 'Nyarko Sports', category: 'Prospect', status: 'prospect', notes: 'Interested in quarterly PT packages.',
    totalSpent: 0, createdAt: '2026-07-05T11:00:00',
  },
  {
    id: 'cus_4', companyId: 'co_fitpro', branchId: 'br_legon', name: 'Nana Yaw Owusu', email: 'nana.owusu@mail.com', phone: '+233 24 200 1004',
    status: 'inactive', address: 'Kumasi, Adum', category: 'Personal training', totalSpent: 2150, createdAt: '2023-11-18T12:00:00',
  },
]

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Customer[]
      const byId = new Map(saved.map((customer) => [customer.id, customer]))
      const merged = CUSTOMERS.map((customer) => ({ ...customer, ...(byId.get(customer.id) || {}) }))
      for (const customer of saved) {
        if (!CUSTOMERS.some((seed) => seed.id === customer.id)) merged.push(customer)
      }
      return merged
    }
  } catch { /* ignore */ }
  return CUSTOMERS
}

export function saveCustomers(list: Customer[]) {
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

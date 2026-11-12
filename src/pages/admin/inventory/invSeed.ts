// Shared inventory seed data + types so the Products & Services filters
// and the Settings CRUD pages always use the same option lists.

export type InvCategory = {
  id: number
  name: string
  code: string
  description: string
  status: 'Active' | 'Inactive'
  parentId: number | null
}

export type InvBrand = {
  id: number
  name: string
  description: string
  status: 'Active' | 'Inactive'
}

export type InvUnit = {
  id: number
  name: string
  shortName: string
  allowDecimal: 'YES' | 'NO' | ''
  status: 'Active' | 'Inactive'
  baseUnitId: number | null
  multiplier: number | null
}

export type InvWarranty = {
  id: number
  name: string
  description: string
  duration: number | null
  durationType: 'days' | 'months' | 'years' | ''
  status: 'Active' | 'Inactive'
}

export const SEED_INV_CATEGORIES: InvCategory[] = [
  { id: 1, name: 'Alkline',                  code: 'ALK', description: 'Goods Management',    status: 'Active', parentId: null },
  { id: 2, name: 'Alkline - Bobikuma Water', code: 'BOW', description: '',                     status: 'Active', parentId: 1    },
  { id: 3, name: 'Clothing',                 code: 'CLT', description: '',                     status: 'Active', parentId: null },
  { id: 4, name: 'Clothing - New Clothing',  code: 'NEC', description: '',                     status: 'Active', parentId: 3    },
  { id: 5, name: 'Clothing - Used Cloths',   code: 'UDC', description: '',                     status: 'Active', parentId: 3    },
  { id: 6, name: 'Literature',               code: 'CL',  description: 'Christains Literature', status: 'Active', parentId: null },
  { id: 7, name: 'Printers',                 code: 'PRT', description: 'Goods Management',    status: 'Active', parentId: null },
]

export const SEED_INV_BRANDS: InvBrand[] = [
  { id: 1, name: 'Epson',    description: '', status: 'Active' },
  { id: 2, name: 'GOODNEWS', description: '', status: 'Active' },
  { id: 3, name: 'HP',       description: '', status: 'Active' },
  { id: 4, name: 'USED',     description: '', status: 'Active' },
  { id: 5, name: 'Golden',   description: '', status: 'Active' },
]

export const SEED_INV_UNITS: InvUnit[] = [
  { id: 1, name: 'Bucket',                shortName: 'Bu',    allowDecimal: 'YES', status: 'Active', baseUnitId: null, multiplier: null },
  { id: 2, name: 'Bundle',                shortName: 'Bd',    allowDecimal: 'YES', status: 'Active', baseUnitId: null, multiplier: null },
  { id: 3, name: 'Pack',                  shortName: 'Pk',    allowDecimal: 'NO',  status: 'Active', baseUnitId: null, multiplier: null },
  { id: 4, name: 'Pieces',                shortName: 'Pc(s)', allowDecimal: 'NO',  status: 'Active', baseUnitId: null, multiplier: null },
  { id: 5, name: 'Water Dozen (30Pc(s))', shortName: 'WD',    allowDecimal: 'YES', status: 'Active', baseUnitId: 4,    multiplier: 30   },
]

export const SEED_INV_WARRANTIES: InvWarranty[] = [
  { id: 1, name: 'Purchase Warrant', description: '', duration: 6,  durationType: 'months', status: 'Active' },
  { id: 2, name: 'Safe Mode',        description: '', duration: 16, durationType: 'days',   status: 'Active' },
  { id: 3, name: 'Strong Mode',      description: '', duration: 2,  durationType: 'years',  status: 'Active' },
]

// Helpers: label for parent/child indented category lists
export function categoryLabel(cat: InvCategory, all: InvCategory[]): string {
  if (!cat.parentId) return cat.name
  const parent = all.find((c) => c.id === cat.parentId)
  if (!parent) return cat.name
  return `${parent.name} - ${cat.name.replace(new RegExp(`^${parent.name}\\s*-\\s*`), '')}`
}

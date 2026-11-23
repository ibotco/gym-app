import type { ProjectFile } from '../types'

export const PROJECT_FILES_KEY = 'fitpro_project_files'

export const PROJECT_FILES: ProjectFile[] = [
  {
    id: 'pf_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    filename: 'Floor-plan-rev3.pdf', fileType: 'PDF', size: 482301, visibleToCustomer: true,
    uploadedByName: 'Kwesi Ampofo', dateUploaded: '2026-06-03T09:24:00', lastActivity: '2026-08-14T15:02:00', comments: 2,
  },
  {
    id: 'pf_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    filename: 'Bill-of-quantities.xlsx', fileType: 'XLSX', size: 96114, visibleToCustomer: false,
    uploadedByName: 'Ekow Asante', dateUploaded: '2026-06-10T11:47:00', lastActivity: '2026-06-10T11:47:00', comments: 0,
  },
  {
    id: 'pf_3', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    filename: 'Site-survey-photos.zip', fileType: 'ZIP', size: 8412009, visibleToCustomer: true,
    uploadedByName: 'Ekow Asante', dateUploaded: '2026-05-21T16:05:00', lastActivity: '2026-07-02T10:12:00', comments: 1,
  },
]

export function loadProjectFiles(): ProjectFile[] {
  try {
    const raw = localStorage.getItem(PROJECT_FILES_KEY)
    if (raw) return JSON.parse(raw) as ProjectFile[]
  } catch { /* ignore */ }
  return PROJECT_FILES
}

export function saveProjectFiles(list: ProjectFile[]) {
  try { localStorage.setItem(PROJECT_FILES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

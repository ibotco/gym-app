// Project Management — Tasks Template data layer (Task/Process + Work Stage).

import type { TaskTemplate, WorkStage } from '../types'

export const PROJECT_TYPES = [
  'Building Construction',
  'Renovation & Fit-Out',
  'Electrical',
  'Plumbing',
  'HVAC',
]

export const TEMPLATE_STATUSES = ['ACTIVE', 'INACTIVE'] as const

export const WORK_STAGES_KEY = 'fitpro_work_stages_v1'
export const TASK_TEMPLATES_KEY = 'fitpro_task_templates_v1'

export const SEED_WORK_STAGES: WorkStage[] = [
  { id: 'ws_1', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Preliminaries', description: 'Mobilisation, permits and site setup', sort: 1, status: 'ACTIVE' },
  { id: 'ws_2', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Substructure', description: 'Excavation, footings and ground slab', sort: 2, status: 'ACTIVE' },
  { id: 'ws_3', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Superstructure', description: 'Frame, walls and structural works', sort: 3, status: 'ACTIVE' },
  { id: 'ws_7', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Roof', description: 'Roof structure and covering', sort: 4, status: 'ACTIVE' },
  { id: 'ws_8', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Services', description: 'Mechanical and electrical services', sort: 5, status: 'ACTIVE' },
  { id: 'ws_9', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'Finishes', description: 'Internal finishes and snagging', sort: 6, status: 'ACTIVE' },
  { id: 'ws_10', companyId: 'co_fitpro', projectType: 'Building Construction', name: 'External Works', description: 'Drainage, paving and landscaping', sort: 7, status: 'ACTIVE' },
  { id: 'ws_4', companyId: 'co_fitpro', projectType: 'Renovation & Fit-Out', name: 'Demolition', description: 'Strip-out and demolition works', sort: 1, status: 'ACTIVE' },
  { id: 'ws_5', companyId: 'co_fitpro', projectType: 'Renovation & Fit-Out', name: 'Finishes', description: 'Final finishes and snagging', sort: 2, status: 'ACTIVE' },
  { id: 'ws_6', companyId: 'co_fitpro', projectType: 'Electrical', name: 'Rough-In', description: 'First-fix and second-fix wiring', sort: 1, status: 'ACTIVE' },
]

export const SEED_TASK_TEMPLATES: TaskTemplate[] = [
  { id: 'tt_1', companyId: 'co_fitpro', projectType: 'Building Construction', workStageId: 'ws_1', workStage: 'Preliminaries', description: 'Site survey and setting-out', sort: 1, status: 'ACTIVE' },
  { id: 'tt_2', companyId: 'co_fitpro', projectType: 'Building Construction', workStageId: 'ws_1', workStage: 'Preliminaries', description: 'Obtain permits and approvals', sort: 2, status: 'ACTIVE' },
  { id: 'tt_3', companyId: 'co_fitpro', projectType: 'Building Construction', workStageId: 'ws_2', workStage: 'Substructure', description: 'Excavate and pour footings', sort: 1, status: 'ACTIVE' },
  { id: 'tt_4', companyId: 'co_fitpro', projectType: 'Renovation & Fit-Out', workStageId: 'ws_4', workStage: 'Demolition', description: 'Strip existing finishes', sort: 1, status: 'ACTIVE' },
  { id: 'tt_5', companyId: 'co_fitpro', projectType: 'Renovation & Fit-Out', workStageId: 'ws_5', workStage: 'Finishes', description: 'Install gym flooring', sort: 2, status: 'ACTIVE' },
]

export function loadWorkStages(): WorkStage[] {
  try {
    const raw = localStorage.getItem(WORK_STAGES_KEY)
    // Backfill `sort` for records persisted before ordering existed.
    if (raw) return (JSON.parse(raw) as WorkStage[]).map((w, i) => ({ ...w, sort: typeof w.sort === 'number' ? w.sort : i + 1 }))
  } catch { /* ignore */ }
  return SEED_WORK_STAGES.map((w) => ({ ...w }))
}
export function saveWorkStages(list: WorkStage[]) {
  try { localStorage.setItem(WORK_STAGES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadTaskTemplates(): TaskTemplate[] {
  try {
    const raw = localStorage.getItem(TASK_TEMPLATES_KEY)
    if (raw) return JSON.parse(raw) as TaskTemplate[]
  } catch { /* ignore */ }
  return SEED_TASK_TEMPLATES.map((t) => ({ ...t }))
}
export function saveTaskTemplates(list: TaskTemplate[]) {
  try { localStorage.setItem(TASK_TEMPLATES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

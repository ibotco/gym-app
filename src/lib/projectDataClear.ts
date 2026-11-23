export const PROJECT_DATA_MENUS=[
 {id:'projects',label:'Projects',desc:'Project records and project-detail milestones, files, notes, discussions, tickets and purchases. Contracts, tasks, timesheets and invoices are separate.'},
 {id:'contracts',label:'Contracts',desc:'Project contract records only; linked projects and other records remain.'},
 {id:'tasks',label:'Tasks Assign',desc:'Assigned project tasks only; templates, timesheets and projects remain.'},
 {id:'templates',label:'Tasks Template',desc:'Task templates and work stages. Existing assigned tasks and timesheets remain.'},
 {id:'timesheets',label:'Timesheet',desc:'Timesheet records only; does not repair task progress or other linked data.'},
 {id:'invoices',label:'Project Invoice',desc:'Project invoice records only; sales invoices, payments and accounting are not reversed.'},
 {id:'reports',label:'Project Reports',desc:'Calculated from project records; no independently stored report collection.'},
 {id:'settings',label:'Project Settings',desc:'Project types, contract types, statuses, priorities and categories. Existing project references are not repaired.'},
] as const
export const PROJECT_DATA_KEYS:Record<string,string[]>={projects:['fitpro_projects_v1','fitpro_milestones','fitpro_project_files','fitpro_project_notes','fitpro_project_discussions','fitpro_project_tickets','fitpro_project_purchases'],contracts:['fitpro_contracts_v1'],tasks:['fitpro_tasks_v1'],templates:['fitpro_work_stages_v1','fitpro_task_templates_v1'],timesheets:['fitpro_timesheets_v1'],invoices:['fitpro_project_invoices_v1'],settings:['fitpro_project_types_v1','fitpro_contract_types_v1','fitpro_project_statuses_v1','fitpro_project_priorities_v1','fitpro_project_categories_v1']}
export function planProjectDataClear(stores:Record<string,string>,fallbacks:Record<string,unknown>,ids:readonly string[]){const selected=new Set(ids),changes:Record<string,string>={},counts:Record<string,number>={reports:0};for(const [id,keys] of Object.entries(PROJECT_DATA_KEYS)){counts[id]=0;for(const key of keys){let value:unknown;try{value=key in stores?JSON.parse(stores[key]):fallbacks[key]}catch{throw new Error(`Cannot inspect ${key}.`)}if(!Array.isArray(value))throw new Error(`Invalid project data in ${key}.`);counts[id]+=value.length;if(selected.has(id))changes[key]='[]'}}return {changes,counts}}

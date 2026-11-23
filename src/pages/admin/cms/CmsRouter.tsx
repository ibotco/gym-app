import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useApp } from '../../../context/AppContext'
import { WEBSITE_TYPES, resolveWebsiteType, type WebsiteType } from '../../../lib/websiteType'
import { EducationCms } from './EducationCms'
import { WebsiteCmsProvider } from './WebsiteCmsContext'
import { CmsSection } from './CmsSection'
import { EventsApp } from './EventsApp'
import { CmsSettingsPage } from './CmsSettings'
import { CmsSeoPage } from './CmsSeo'
import { CMS_SECTIONS } from '../../../lib/cms'

const educationSections={settings:'settings',menus:'menus',pages:'pages',sliders:'slides',news:'news',testimonials:'testimonials',gallery:'gallery',events:'events'} as const
export function CmsRouter() {
 const {section}=useParams(),{company}=useApp(),active=resolveWebsiteType(company.websiteType);const [type,setType]=useState<WebsiteType>(active)
 useEffect(()=>setType(active),[active])
 if(section==='education-website')return <Navigate to="/admin/cms/settings" replace />
 const educationSection=section?educationSections[section as keyof typeof educationSections]:undefined
 let content
 if(type==='education'&&section==='services')content=<div className="space-y-6"><CmsSection key="education-services" sectionKey="services"/><EducationCms key="education-extras" initialTab="courses" tabs={['courses','staff','achievements']}/></div>
 else if(type==='education'&&educationSection)content=<EducationCms key={`${type}-${section}`} initialTab={educationSection} single/>
 else if(section==='events')content=<EventsApp key={type}/>
 else if(section==='settings')content=<CmsSettingsPage key={type}/>
 else if(section==='seo')content=<CmsSeoPage key={type}/>
 else if(section&&CMS_SECTIONS[section])content=<CmsSection key={`${type}-${section}`} sectionKey={section}/>
 else return <Navigate to="/admin/cms/settings" replace />
 return <WebsiteCmsProvider type={type}><div><div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"><label htmlFor="cms-website-type" className="text-sm font-semibold">Website Type</label><select id="cms-website-type" value={type} onChange={e=>setType(e.target.value as WebsiteType)} className="rounded-lg border border-line bg-transparent px-3 py-2 text-sm">{WEBSITE_TYPES.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}</select><span className="text-xs text-mist">Default: {WEBSITE_TYPES.find(w=>w.id===active)?.label}. Content is separate for each type.</span></div>{content}</div></WebsiteCmsProvider>
}

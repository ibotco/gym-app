import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { CMS_KEY, loadCms, type CmsData } from '../../../lib/cms'
import { readWebsiteCms, writeWebsiteCms } from '../../../lib/websiteCmsStorage'
import type { WebsiteType } from '../../../lib/websiteType'
const TypeContext=createContext<WebsiteType>('gym')
export function WebsiteCmsProvider({type,children}:{type:WebsiteType;children:ReactNode}){return <TypeContext.Provider value={type}>{children}</TypeContext.Provider>}
export function useWebsiteCms(){
 const app=useApp(),type=useContext(TypeContext),toast=useToast();const scoped=useMemo(()=>({...readWebsiteCms(app.cms,type),educationSite:app.cms.educationSite,websiteContent:app.cms.websiteContent}),[app.cms,type])
 const setCms=(next:CmsData)=>{try{const latest=loadCms();if(JSON.stringify(readWebsiteCms(latest,type))!==JSON.stringify(readWebsiteCms(app.cms,type))){toast.error('CMS content changed','Refresh before saving to avoid overwriting newer changes.');return false}const {educationSite:_education,websiteContent:_all,...content}=next;const updated=writeWebsiteCms(latest,type,content);const encoded=JSON.stringify(updated);localStorage.setItem(CMS_KEY,encoded);if(localStorage.getItem(CMS_KEY)!==encoded)throw Error('Storage did not confirm the save');app.setCms(updated);return true}catch{toast.error('Unable to save CMS content');return false}}
 return {...app,cms:scoped,setCms,websiteType:type}
}

import { DEFAULT_CMS_DATA, type CmsData } from './cms'
import { resolveWebsiteType, type WebsiteType } from './websiteType'

/** A website-scoped CMS record excludes container metadata and Education's
 * existing independently-managed site. Gym's legacy root is never migrated or
 * modified implicitly. Non-gym sites start empty, not with Gym demo content. */
export type WebsiteCmsData = Omit<CmsData,'educationSite'|'websiteContent'>
type Container = CmsData & {websiteContent?:Partial<Record<Exclude<WebsiteType,'gym'>,WebsiteCmsData>>}
const collections=['menus','pages','sections','sliders','events','news','services','features','testimonials','faqs','galleryCategories','galleries','media','banners'] as const
function emptySite():WebsiteCmsData {
 const settings={...DEFAULT_CMS_DATA.settings,websiteName:'',contactInfo:'',address:'',email:'',phone:'',socialLinks:{},footerText:'',metaKeywords:'',metaDescription:'',logoImage:undefined,faviconImage:undefined,googleMapsUrl:undefined}
 const seo={...DEFAULT_CMS_DATA.seo,metaTitle:'',metaDescription:'',metaKeywords:'',canonicalUrl:'',googleAnalyticsId:'',ogImage:''}
 return {...Object.fromEntries(collections.map(key=>[key,[]])),settings,seo} as WebsiteCmsData
}
export function readWebsiteCms(container:Container,rawType:unknown):WebsiteCmsData {
 const type=resolveWebsiteType(rawType)
 if(type==='gym'){const {educationSite:_education,websiteContent:_sites,...legacy}=container;return legacy}
 const saved=container.websiteContent?.[type];if(!saved)return emptySite()
 const empty=emptySite();return {...empty,...saved,settings:{...empty.settings,...saved.settings},seo:{...empty.seo,...saved.seo}}
}
/** Pure update of a single namespace. The legacy educationSite remains intact. */
export function writeWebsiteCms(container:Container,rawType:unknown,site:WebsiteCmsData):Container {
 const type=resolveWebsiteType(rawType)
 if(type==='gym')return {...container,...site,educationSite:container.educationSite,websiteContent:container.websiteContent}
 return {...container,websiteContent:{...container.websiteContent,[type]:site}}
}

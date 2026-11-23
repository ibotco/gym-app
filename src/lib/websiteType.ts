export const WEBSITE_TYPES = [
 {id:'gym',label:'Gym Management Site',headline:'Strength for every day',subheading:'A place to move, grow and connect.'},
 {id:'education',label:'Education Management Site',headline:'Learning opens doors',subheading:'A welcoming home for your school community.'},
 {id:'church',label:'Church Management Site',headline:'A community of faith and belonging',subheading:'Connect, grow and serve together.'},
 {id:'ngo',label:'NGO Site',headline:'Together, we can make a difference',subheading:'A place to share your mission and connect your community.'},
 {id:'business',label:'Business / Corporate Website',headline:'Moving forward, together',subheading:'Introduce your organisation and connect with your audience.'},
 {id:'ecommerce',label:'E-commerce Website',headline:'Discover what matters to you',subheading:'A starting point for your online storefront.'},
] as const
export type WebsiteType=(typeof WEBSITE_TYPES)[number]['id']
export function resolveWebsiteType(value:unknown):WebsiteType{return WEBSITE_TYPES.some(x=>x.id===value)?value as WebsiteType:'gym'}
export function websiteTypeInfo(value:unknown){const id=resolveWebsiteType(value);return WEBSITE_TYPES.find(x=>x.id===id)!}

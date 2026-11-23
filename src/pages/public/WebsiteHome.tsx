import { WebsiteCmsHome } from './WebsiteCmsContent'
import { EducationWebsite } from './EducationWebsite'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, HeartHandshake, Church, Building2, ShoppingBag } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { resolveWebsiteType, websiteTypeInfo } from '../../lib/websiteType'
import { Home } from './Home'
const details={education:{icon:BookOpen,features:['Learning','Community','Growth'],description:'Bring your school community together in one place.'},church:{icon:Church,features:['Faith','Fellowship','Service'],description:'Share your mission and connect with your congregation.'},ngo:{icon:HeartHandshake,features:['Purpose','People','Impact'],description:'Bring people together around the work that matters.'},business:{icon:Building2,features:['Vision','Partnership','Progress'],description:'A clear introduction to your organisation and its work.'},ecommerce:{icon:ShoppingBag,features:['Discover','Explore','Connect'],description:'Introduce your business and prepare your online presence.'}} as const
export function WebsiteHome(){const {company}=useApp();const type=resolveWebsiteType(company.websiteType);if(type==='gym')return <Home/>;if(type==='education')return <EducationWebsite/>;return <WebsiteCmsHome/>}

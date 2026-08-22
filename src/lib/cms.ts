// Front CMS — public website content management (admin module).
// Data is persisted in a single localStorage store (`fitpro_cms`).

export const CMS_KEY = 'fitpro_cms'

// ---- Types ----
export interface CmsSettings {
  websiteName: string
  logoImage?: string
  faviconImage?: string
  contactInfo: string
  address: string
  email: string
  phone: string
  socialLinks: { facebook?: string; instagram?: string; twitter?: string; youtube?: string; linkedin?: string }
  footerText: string
  googleMapsUrl?: string
  websiteEnabled: boolean
  maintenanceMode: boolean
  defaultLanguage: string
  metaKeywords: string
  metaDescription: string
}

export interface CmsMenu {
  id: string
  title: string
  url: string
  type: 'internal' | 'external'
  parentId?: string
  position: 'header' | 'footer'
  target: '_self' | '_blank'
  status: 'active' | 'inactive'
  order: number
}

export interface CmsPage {
  id: string
  title: string
  slug: string
  featuredImage?: string
  content: string
  seoTitle?: string
  metaDescription?: string
  metaKeywords?: string
  status: 'draft' | 'published'
}

export interface CmsSection {
  id: string
  key: string
  title: string
  content: string
  image?: string
  videoUrl?: string
  enabled: boolean
  order: number
}

export interface CmsSlider {
  id: string
  heading: string
  subheading: string
  buttonText?: string
  buttonLink?: string
  desktopImage?: string
  mobileImage?: string
  videoUrl?: string
  order: number
  status: 'active' | 'inactive'
}

export interface CmsEvent {
  id: string
  title: string
  date: string
  time: string
  location: string
  organizer: string
  description: string
  featuredImage?: string
  registrationLink?: string
  status: 'upcoming' | 'past'
}

export interface CmsNews {
  id: string
  title: string
  featuredImage?: string
  category: string
  content: string
  publishDate: string
  author: string
  featured: boolean
  trending: boolean
}

export interface CmsService {
  id: string
  title: string
  icon?: string
  image?: string
  description: string
  order: number
}

export interface CmsFeature {
  id: string
  title: string
  icon?: string
  description: string
}

export interface CmsTestimonial {
  id: string
  name: string
  position: string
  organization?: string
  photo?: string
  text: string
  rating: number
  featured: boolean
}

export interface CmsFaq {
  id: string
  question: string
  answer: string
  category: string
  order: number
}

export interface CmsGalleryCategory {
  id: string
  name: string
}

export interface CmsGallery {
  id: string
  title: string
  categoryId?: string
  description: string
  mediaFile?: string
  type: 'image' | 'video'
}

export interface CmsMedia {
  id: string
  name: string
  type: 'image' | 'video' | 'pdf' | 'document'
  url?: string
  folder?: string
  uploadedAt: string
}

export interface CmsBanner {
  id: string
  title: string
  backgroundImage?: string
  page: string
  status: 'active' | 'inactive'
}

export interface CmsSeoSettings {
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  ogImage?: string
  canonicalUrl?: string
  googleAnalyticsId?: string
}

export interface CmsData {
  settings: CmsSettings
  menus: CmsMenu[]
  pages: CmsPage[]
  sections: CmsSection[]
  sliders: CmsSlider[]
  events: CmsEvent[]
  news: CmsNews[]
  services: CmsService[]
  features: CmsFeature[]
  testimonials: CmsTestimonial[]
  faqs: CmsFaq[]
  galleryCategories: CmsGalleryCategory[]
  galleries: CmsGallery[]
  media: CmsMedia[]
  banners: CmsBanner[]
  seo: CmsSeoSettings
}

// ---- Defaults ----
export const DEFAULT_CMS_DATA: CmsData = {
  settings: {
    websiteName: 'FitPro',
    contactInfo: '+233 30 396 4400',
    address: 'Airport City, Accra, Ghana',
    email: 'hello@fitpro.gym',
    phone: '+233 30 396 4400',
    socialLinks: { instagram: 'https://instagram.com/fitpro', twitter: 'https://x.com/fitpro' },
    footerText: '© FitPro Gym Management Ltd. All rights reserved.',
    googleMapsUrl: '',
    websiteEnabled: true,
    maintenanceMode: false,
    defaultLanguage: 'English',
    metaKeywords: 'gym, fitness, accra, personal training',
    metaDescription: 'FitPro — premium gyms in Accra with world-class coaching and classes.',
  },
  menus: [
    { id: 'menu_home', title: 'Home', url: '/', type: 'internal', position: 'header', target: '_self', status: 'active', order: 1 },
    { id: 'menu_about', title: 'About', url: '/about', type: 'internal', position: 'header', target: '_self', status: 'active', order: 2 },
    { id: 'menu_services', title: 'Services', url: '/services', type: 'internal', position: 'header', target: '_self', status: 'active', order: 3 },
    { id: 'menu_membership', title: 'Membership', url: '/membership', type: 'internal', position: 'header', target: '_self', status: 'active', order: 4 },
    { id: 'menu_trainers', title: 'Trainers', url: '/trainers', type: 'internal', position: 'header', target: '_self', status: 'active', order: 5 },
    { id: 'menu_schedule', title: 'Schedule', url: '/schedule', type: 'internal', position: 'header', target: '_self', status: 'active', order: 6 },
    { id: 'menu_blog', title: 'Journal', url: '/blog', type: 'internal', position: 'header', target: '_self', status: 'active', order: 7 },
    { id: 'menu_contact', title: 'Contact', url: '/contact', type: 'internal', position: 'header', target: '_self', status: 'active', order: 8 },
  ],
  pages: [],
  sections: [
    { id: 'sec_hero', key: 'hero', title: 'Hero Section', content: '<p>Train harder. Live better.</p>', enabled: true, order: 1 },
    { id: 'sec_about', key: 'about', title: 'About Us', content: '<p>Your fitness home in Accra.</p>', enabled: true, order: 2 },
  ],
  sliders: [],
  events: [],
  news: [],
  services: [
    { id: 'svc_1', title: 'Personal Training', icon: 'dumbbell', image: '/images/program-pt.jpg', description: '1:1 programming with strength and physique specialists.', order: 1 },
    { id: 'svc_2', title: 'Group Classes', icon: 'users', image: '/images/program-hiit.jpg', description: 'HIIT, Volt Ride, Ringcraft, Reformer — booked to the minute.', order: 2 },
    { id: 'svc_3', title: 'Nutrition Coaching', icon: 'salad', image: '/images/program-nutrition.jpg', description: 'Accra-realist macros. No imported-powder religion.', order: 3 },
    { id: 'svc_4', title: 'Strength & Conditioning', icon: 'barbell', image: '/images/program-strength.jpg', description: 'Barbell literacy for operators, not just athletes.', order: 4 },
  ],
  features: [
    { id: 'feat_1', title: 'Modern Facilities', icon: 'building', description: 'State-of-the-art equipment across four clubs.' },
  ],
  testimonials: [
    { id: 'test_1', name: 'Ama Boateng', position: 'Member', photo: '/images/success-1.jpg', text: 'FitPro changed my routine completely. The coaches are amazing!', rating: 5, featured: true, organization: 'Lost 12kg in 16 weeks' },
    { id: 'test_2', name: 'Kofi Asante', position: 'Member', photo: '/images/success-2.jpg', text: 'The strength floor is world-class. Best gym in Accra.', rating: 5, featured: false, organization: 'Deadlift PR 200kg' },
    { id: 'test_3', name: 'Efua Adjei', position: 'Member', photo: '/images/success-3.jpg', text: 'Community first, results second to none.', rating: 5, featured: false, organization: 'First 5K completed' },
  ],
  faqs: [
    { id: 'faq_1', question: 'What are your opening hours?', answer: 'Most clubs are open 05:00 – 23:00 daily.', category: 'General', order: 1 },
  ],
  galleryCategories: [{ id: 'gcat_1', name: 'Facilities' }, { id: 'gcat_2', name: 'Events' }],
  galleries: [],
  media: [],
  banners: [],
  seo: {
    metaTitle: 'FitPro — Premium Gyms in Accra',
    metaDescription: 'Join FitPro, Accra\u2019s premium gym network.',
    metaKeywords: 'gym, fitness, accra',
    canonicalUrl: 'https://fitpro.gym',
    googleAnalyticsId: '',
  },
}

export function loadCms(): CmsData {
  try {
    const raw = localStorage.getItem(CMS_KEY)
    if (!raw) return DEFAULT_CMS_DATA
    const parsed = JSON.parse(raw) as Partial<CmsData>
    // Merge menus so newly seeded menu items (e.g. Membership) appear for users
    // who already saved a CMS store, while keeping their custom edits.
    const savedMenus = parsed.menus || []
    const mergedMenus = [...DEFAULT_CMS_DATA.menus]
    for (const m of savedMenus) {
      if (!mergedMenus.some((d) => d.id === m.id)) mergedMenus.push(m)
    }
    return {
      ...DEFAULT_CMS_DATA,
      ...parsed,
      menus: mergedMenus,
      settings: { ...DEFAULT_CMS_DATA.settings, ...(parsed.settings || {}) },
      seo: { ...DEFAULT_CMS_DATA.seo, ...(parsed.seo || {}) },
    }
  } catch {
    return DEFAULT_CMS_DATA
  }
}

export function saveCms(data: CmsData) {
  try {
    localStorage.setItem(CMS_KEY, JSON.stringify(data))
  } catch {
    /* quota */
  }
}

export function nextCmsId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}

// ---- Field / column config for the generic CRUD engine ----
export type CmsFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'image' | 'richtext' | 'checkbox'

export interface CmsField {
  key: string
  label: string
  type: CmsFieldType
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
}

export interface CmsColumn {
  key: string
  label: string
}

export interface CmsSectionConfig {
  collection: Exclude<keyof CmsData, 'settings' | 'seo'>
  title: string
  description?: string
  rowTitle: (row: Record<string, unknown>) => string
  fields: CmsField[]
  columns: CmsColumn[]
}

const POSITION = [{ value: 'header', label: 'Header' }, { value: 'footer', label: 'Footer' }]
const TARGET = [{ value: '_self', label: 'Same tab' }, { value: '_blank', label: 'New tab' }]
const STATUS = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]

export const CMS_SECTIONS: Record<string, CmsSectionConfig> = {
  menus: {
    collection: 'menus', title: 'Menu management', description: 'Build and reorder the website navigation.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Menu title', type: 'text', required: true },
      { key: 'url', label: 'URL', type: 'text', placeholder: '/about or https://…' },
      { key: 'type', label: 'Menu type', type: 'select', options: [{ value: 'internal', label: 'Internal' }, { value: 'external', label: 'External URL' }] },
      { key: 'parentId', label: 'Parent menu', type: 'select' },
      { key: 'position', label: 'Menu position', type: 'select', options: POSITION },
      { key: 'target', label: 'Open in', type: 'select', options: TARGET },
      { key: 'status', label: 'Status', type: 'select', options: STATUS },
      { key: 'order', label: 'Order', type: 'number' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'url', label: 'URL' }, { key: 'position', label: 'Position' }, { key: 'status', label: 'Status' }],
  },
  sections: {
    collection: 'sections', title: 'Page sections', description: 'Reusable, orderable website sections.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'key', label: 'Key', type: 'text', required: true, placeholder: 'hero, about, mission…' },
      { key: 'title', label: 'Section title', type: 'text', required: true },
      { key: 'content', label: 'Content', type: 'richtext' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'videoUrl', label: 'Video URL', type: 'text' },
      { key: 'enabled', label: 'Enabled', type: 'checkbox' },
      { key: 'order', label: 'Order', type: 'number' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'key', label: 'Key' }, { key: 'enabled', label: 'Enabled' }, { key: 'order', label: 'Order' }],
  },
  pages: {
    collection: 'pages', title: 'Manage pages', description: 'Create unlimited website pages.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Page title', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true, placeholder: 'about-us' },
      { key: 'featuredImage', label: 'Featured image', type: 'image' },
      { key: 'content', label: 'Page content', type: 'richtext' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'metaDescription', label: 'Meta description', type: 'textarea' },
      { key: 'metaKeywords', label: 'Meta keywords', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status' }],
  },
  sliders: {
    collection: 'sliders', title: 'Slider / banners', description: 'Homepage slider banners.',
    rowTitle: (r) => String(r.heading || ''),
    fields: [
      { key: 'heading', label: 'Heading', type: 'text', required: true },
      { key: 'subheading', label: 'Subheading', type: 'textarea' },
      { key: 'buttonText', label: 'Button text', type: 'text' },
      { key: 'buttonLink', label: 'Button link', type: 'text' },
      { key: 'desktopImage', label: 'Desktop banner', type: 'image' },
      { key: 'mobileImage', label: 'Mobile banner', type: 'image' },
      { key: 'videoUrl', label: 'Video background', type: 'text' },
      { key: 'order', label: 'Order', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS },
    ],
    columns: [{ key: 'heading', label: 'Heading' }, { key: 'order', label: 'Order' }, { key: 'status', label: 'Status' }],
  },
  events: {
    collection: 'events', title: 'Events', description: 'Upcoming and past events.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Event title', type: 'text', required: true },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'organizer', label: 'Organizer', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'featuredImage', label: 'Featured image', type: 'image' },
      { key: 'registrationLink', label: 'Registration link', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }] },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'date', label: 'Date' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }],
  },
  news: {
    collection: 'news', title: 'News', description: 'News articles and announcements.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'News title', type: 'text', required: true },
      { key: 'featuredImage', label: 'Featured image', type: 'image' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'content', label: 'Content', type: 'richtext' },
      { key: 'publishDate', label: 'Publish date', type: 'date' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'featured', label: 'Featured', type: 'checkbox' },
      { key: 'trending', label: 'Trending', type: 'checkbox' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'publishDate', label: 'Date' }, { key: 'author', label: 'Author' }],
  },
  services: {
    collection: 'services', title: 'Services', description: 'Services offered to members.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Service title', type: 'text', required: true },
      { key: 'icon', label: 'Icon (name)', type: 'text' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'order', label: 'Display order', type: 'number' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'order', label: 'Order' }],
  },
  features: {
    collection: 'features', title: 'Features', description: 'Highlights and selling points.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Feature title', type: 'text', required: true },
      { key: 'icon', label: 'Icon (name)', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    columns: [{ key: 'title', label: 'Title' }],
  },
  testimonials: {
    collection: 'testimonials', title: 'Testimonials', description: 'Member reviews and quotes.',
    rowTitle: (r) => String(r.name || ''),
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'position', label: 'Position', type: 'text' },
      { key: 'organization', label: 'Organization', type: 'text' },
      { key: 'photo', label: 'Photo', type: 'image' },
      { key: 'text', label: 'Testimonial text', type: 'textarea' },
      { key: 'rating', label: 'Rating (1–5)', type: 'number' },
      { key: 'featured', label: 'Featured', type: 'checkbox' },
    ],
    columns: [{ key: 'name', label: 'Name' }, { key: 'position', label: 'Position' }, { key: 'rating', label: 'Rating' }],
  },
  faqs: {
    collection: 'faqs', title: 'FAQs', description: 'Frequently asked questions.',
    rowTitle: (r) => String(r.question || ''),
    fields: [
      { key: 'question', label: 'Question', type: 'text', required: true },
      { key: 'answer', label: 'Answer', type: 'textarea' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'order', label: 'Sort order', type: 'number' },
    ],
    columns: [{ key: 'question', label: 'Question' }, { key: 'category', label: 'Category' }, { key: 'order', label: 'Order' }],
  },
  galleryCategories: {
    collection: 'galleryCategories', title: 'Gallery categories', description: 'Organise the gallery into categories.',
    rowTitle: (r) => String(r.name || ''),
    fields: [{ key: 'name', label: 'Category name', type: 'text', required: true }],
    columns: [{ key: 'name', label: 'Name' }],
  },
  gallery: {
    collection: 'galleries', title: 'Gallery', description: 'Photos and videos.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }] },
      { key: 'categoryId', label: 'Category', type: 'select' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'mediaFile', label: 'Media file', type: 'image' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }],
  },
  media: {
    collection: 'media', title: 'Media manager', description: 'Central repository for all media.',
    rowTitle: (r) => String(r.name || ''),
    fields: [
      { key: 'name', label: 'File name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }, { value: 'pdf', label: 'PDF' }, { value: 'document', label: 'Document' }] },
      { key: 'folder', label: 'Folder', type: 'text' },
      { key: 'uploadedAt', label: 'Uploaded at', type: 'date' },
      { key: 'url', label: 'File (image)', type: 'image' },
    ],
    columns: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'folder', label: 'Folder' }, { key: 'uploadedAt', label: 'Uploaded' }],
  },
  banners: {
    collection: 'banners', title: 'Banner images', description: 'Page-specific banner images.',
    rowTitle: (r) => String(r.title || ''),
    fields: [
      { key: 'title', label: 'Banner title', type: 'text', required: true },
      { key: 'backgroundImage', label: 'Background image', type: 'image' },
      { key: 'page', label: 'Page assignment', type: 'text', placeholder: 'about, news, gallery…' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'page', label: 'Page' }, { key: 'status', label: 'Status' }],
  },
}

import type { EduRow } from '../../../../lib/eduRecords'

export type SchoolLevelId = 'kg' | 'basic' | 'jhs' | 'shs'

export type SubjectCategoryId =
  | 'all'
  | 'core'
  | 'science'
  | 'business'
  | 'arts'
  | 'languages'
  | 'tvet'

export type CurriculumFrameworkId =
  | 'universal-africa'
  | 'waec-wassce'
  | 'ghana-nacca'
  | 'nigeria-nerdc'
  | 'east-africa'
  | 'southern-africa'
  | 'francophone-africa'

export interface CurriculumFrameworkOption {
  id: CurriculumFrameworkId
  label: string
  shortLabel: string
  referencePrefix: string
}

export const CURRICULUM_FRAMEWORKS: CurriculumFrameworkOption[] = [
  {
    id: 'universal-africa',
    label: 'Universal Africa — Pan-African Competency & Senior Secondary Syllabus',
    shortLabel: 'Universal Africa',
    referencePrefix: 'Pan-African Competency & National Curriculum',
  },
  {
    id: 'waec-wassce',
    label: 'West Africa — WAEC / WASSCE & Senior High Syllabus',
    shortLabel: 'WAEC / WASSCE (West Africa)',
    referencePrefix: 'WAEC / WASSCE & West African Senior Secondary Syllabus',
  },
  {
    id: 'ghana-nacca',
    label: 'Ghana — NaCCA & WASSCE Curriculum',
    shortLabel: 'NaCCA / WASSCE (Ghana)',
    referencePrefix: 'NaCCA & WAEC Curriculum',
  },
  {
    id: 'nigeria-nerdc',
    label: 'Nigeria — NERDC & WAEC / NECO Curriculum',
    shortLabel: 'NERDC / WAEC (Nigeria)',
    referencePrefix: 'NERDC & WAEC Senior/Basic Curriculum',
  },
  {
    id: 'east-africa',
    label: 'East Africa — KICD CBC / NECTA / NCDC / REB',
    shortLabel: 'East Africa (KICD / NECTA / NCDC)',
    referencePrefix: 'East African Competency-Based & Secondary Syllabus',
  },
  {
    id: 'southern-africa',
    label: 'Southern Africa — CAPS / ZIMSEC / ECZ / BGCSE',
    shortLabel: 'Southern Africa (CAPS / ZIMSEC)',
    referencePrefix: 'Southern African National Curriculum Statement (CAPS / ZIMSEC)',
  },
  {
    id: 'francophone-africa',
    label: 'Francophone & North Africa — APC / Baccalauréat',
    shortLabel: 'APC / Baccalauréat',
    referencePrefix: 'Approche Par Compétences (APC) & Programme Officiel',
  },
]

export interface SchoolLevelOption {
  id: SchoolLevelId
  name: string
  subtitle: string
  defaultClasses: string[]
  codePrefix: string
}

export interface DailyLessonEntry {
  day: string
  lessonNumber: number
  indicatorCode: string
  indicatorText: string
  performanceIndicator: string
  coreCompetencies: string
  references: string
  keywords: string
  starterDuration: string
  starterActivities: string
  mainDuration: string
  mainActivities: string
  reflectionDuration: string
  reflectionActivities: string
  resources: string
}

export interface ParsedLessonNote {
  id: string
  schoolName: string
  teacher: string
  level: string
  className: string
  subject: string
  strand: string
  subStrand: string
  contentStandard: string
  indicators: string[]
  term: string
  week: string
  weekEnding: string
  duration: string
  classSize: string
  aiModel: 'free' | 'pro'
  curriculumFramework?: CurriculumFrameworkId
  days: string[]
  dailyLessons: DailyLessonEntry[]
  status: 'Draft' | 'Pending' | 'Approved' | 'Returned'
  submittedOn: string
  reviewerComment: string
  reviewedBy: string
  createdAt: string
}

export const SCHOOL_LEVELS: SchoolLevelOption[] = [
  {
    id: 'kg',
    name: 'Early Childhood / Kindergarten',
    subtitle: 'Nursery, KG 1–2 / PP1–PP2 / Reception',
    defaultClasses: ['Nursery 1', 'Nursery 2', 'KG 1 / PP1', 'KG 2 / PP2'],
    codePrefix: 'KG',
  },
  {
    id: 'basic',
    name: 'Primary / Basic School',
    subtitle: 'Primary 1–6 / Basic 1–6 / Grade 1–6',
    defaultClasses: [
      'Basic 1 / Primary 1',
      'Basic 2 / Primary 2',
      'Basic 3 / Primary 3',
      'Basic 4 / Primary 4',
      'Basic 5 / Primary 5',
      'Basic 6 / Primary 6',
    ],
    codePrefix: 'B',
  },
  {
    id: 'jhs',
    name: 'Junior Secondary / JHS',
    subtitle: 'JHS 1–3 / JSS 1–3 / Grade 7–9 / Form 1–2',
    defaultClasses: [
      'JHS 1 / JSS 1 (Grade 7)',
      'JHS 2 / JSS 2 (Grade 8)',
      'JHS 3 / JSS 3 (Grade 9)',
    ],
    codePrefix: 'JSS',
  },
  {
    id: 'shs',
    name: 'Senior High / Senior Secondary (SHS / SSS)',
    subtitle: 'SHS 1–3 / SS 1–3 / Grade 10–12 / Form 4–6',
    defaultClasses: [
      'SHS 1 / SS 1 (Grade 10)',
      'SHS 2 / SS 2 (Grade 11)',
      'SHS 3 / SS 3 (Grade 12)',
      'SHS 1 Science',
      'SHS 1 Business',
      'SHS 1 General Arts',
      'SHS 2 Science',
      'SHS 2 Business',
      'SHS 2 General Arts',
      'Lower Sixth / Form 5',
      'Upper Sixth / Form 6',
    ],
    codePrefix: 'SHS',
  },
]

export const TEACHING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

export interface SubjectCategoryMeta {
  id: SubjectCategoryId
  label: string
}

export const SUBJECT_CATEGORIES: SubjectCategoryMeta[] = [
  { id: 'all', label: 'All Subjects' },
  { id: 'core', label: 'Core / Compulsory' },
  { id: 'science', label: 'Science & STEM' },
  { id: 'business', label: 'Business & Commercial' },
  { id: 'arts', label: 'Arts & Humanities' },
  { id: 'languages', label: 'Languages' },
  { id: 'tvet', label: 'Visual Arts, Home Econ & TVET' },
]

export interface SubjectDefinition {
  name: string
  category: Exclude<SubjectCategoryId, 'all'>
  levels: SchoolLevelId[]
  badge?: string
}

/**
 * Comprehensive West African (WAEC / WASSCE — Ghana SHS, Nigeria SSS, Sierra Leone,
 * The Gambia, Liberia) + Universal Pan-African (East, Southern, Central & Francophone Africa)
 * subject catalogue across Early Childhood, Primary, Junior Secondary, and Senior High/Secondary.
 */
export const SUBJECT_CATALOGUE: SubjectDefinition[] = [
  // ================= CORE / COMPULSORY =================
  {
    name: 'Language & Literacy',
    category: 'core',
    levels: ['kg'],
    badge: 'Early Years Core',
  },
  {
    name: 'Numeracy',
    category: 'core',
    levels: ['kg'],
    badge: 'Early Years Core',
  },
  {
    name: 'Phonics, Reading & Storytelling',
    category: 'core',
    levels: ['kg'],
    badge: 'Early Years Core',
  },
  {
    name: 'Our World & Environmental Studies',
    category: 'core',
    levels: ['kg', 'basic'],
    badge: 'Core',
  },
  {
    name: 'English Language',
    category: 'core',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Core',
  },
  {
    name: 'Mathematics',
    category: 'core',
    levels: ['basic', 'jhs'],
    badge: 'Core',
  },
  {
    name: 'Core Mathematics (General Mathematics)',
    category: 'core',
    levels: ['shs'],
    badge: 'SHS / WASSCE Core',
  },
  {
    name: 'Basic Science & Technology',
    category: 'core',
    levels: ['basic'],
    badge: 'Primary Core',
  },
  {
    name: 'Integrated Science',
    category: 'core',
    levels: ['jhs', 'shs'],
    badge: 'Core',
  },
  {
    name: 'Social Studies',
    category: 'core',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Core',
  },
  {
    name: 'Civic Education & Citizenship',
    category: 'core',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'WAEC & Pan-African Core',
  },
  {
    name: 'Computing',
    category: 'core',
    levels: ['basic', 'jhs'],
    badge: 'Core Digital',
  },
  {
    name: 'Information & Communication Technology (ICT)',
    category: 'core',
    levels: ['shs'],
    badge: 'SHS Core',
  },
  {
    name: 'Physical Education & Health',
    category: 'core',
    levels: ['kg', 'basic', 'jhs', 'shs'],
    badge: 'Core Wellness',
  },
  {
    name: 'Life Orientation / Life Skills',
    category: 'core',
    levels: ['jhs', 'shs'],
    badge: 'Pan-African Core',
  },

  // ================= SCIENCE & STEM (SHS GENERAL SCIENCE + AFRICA STEM) =================
  {
    name: 'Physics',
    category: 'science',
    levels: ['shs'],
    badge: 'SHS Science',
  },
  {
    name: 'Chemistry',
    category: 'science',
    levels: ['shs'],
    badge: 'SHS Science',
  },
  {
    name: 'Biology',
    category: 'science',
    levels: ['shs'],
    badge: 'SHS Science',
  },
  {
    name: 'Elective Mathematics (Further Mathematics)',
    category: 'science',
    levels: ['shs'],
    badge: 'WASSCE Science / STEM',
  },
  {
    name: 'Computer Science',
    category: 'science',
    levels: ['shs'],
    badge: 'SHS STEM',
  },
  {
    name: 'Data Processing',
    category: 'science',
    levels: ['shs'],
    badge: 'WAEC ICT / STEM',
  },
  {
    name: 'Agricultural Science (General Agriculture)',
    category: 'science',
    levels: ['jhs', 'shs'],
    badge: 'SHS Agric / Science',
  },
  {
    name: 'Animal Husbandry & Fisheries',
    category: 'science',
    levels: ['shs'],
    badge: 'WASSCE Agric',
  },
  {
    name: 'Crop Husbandry & Horticulture',
    category: 'science',
    levels: ['shs'],
    badge: 'WASSCE Agric',
  },
  {
    name: 'Physical Sciences',
    category: 'science',
    levels: ['shs'],
    badge: 'Southern & East Africa',
  },
  {
    name: 'Life Sciences',
    category: 'science',
    levels: ['shs'],
    badge: 'Southern & East Africa',
  },
  {
    name: 'Health Science',
    category: 'science',
    levels: ['shs'],
    badge: 'SHS Science',
  },

  // ================= BUSINESS & COMMERCIAL (SHS BUSINESS + AFRICA COMMERCE) =================
  {
    name: 'Economics',
    category: 'business',
    levels: ['shs'],
    badge: 'SHS Business / Arts',
  },
  {
    name: 'Financial Accounting',
    category: 'business',
    levels: ['shs'],
    badge: 'WASSCE Business',
  },
  {
    name: 'Cost Accounting',
    category: 'business',
    levels: ['shs'],
    badge: 'WASSCE Business',
  },
  {
    name: 'Business Management',
    category: 'business',
    levels: ['shs'],
    badge: 'WASSCE Business',
  },
  {
    name: 'Commerce',
    category: 'business',
    levels: ['shs'],
    badge: 'WAEC Commercial',
  },
  {
    name: 'Business Studies',
    category: 'business',
    levels: ['jhs', 'shs'],
    badge: 'Pan-African Business',
  },
  {
    name: 'Entrepreneurship',
    category: 'business',
    levels: ['jhs', 'shs'],
    badge: 'Pan-African Business',
  },
  {
    name: 'Office Practice & Clerical Duties',
    category: 'business',
    levels: ['shs'],
    badge: 'WASSCE Business',
  },
  {
    name: 'Marketing & Insurance',
    category: 'business',
    levels: ['shs'],
    badge: 'WAEC Commercial',
  },
  {
    name: 'Tourism & Hospitality',
    category: 'business',
    levels: ['shs'],
    badge: 'Pan-African Applied',
  },

  // ================= GENERAL ARTS & HUMANITIES =================
  {
    name: 'Literature-in-English',
    category: 'arts',
    levels: ['jhs', 'shs'],
    badge: 'SHS General Arts',
  },
  {
    name: 'Government',
    category: 'arts',
    levels: ['shs'],
    badge: 'WASSCE General Arts',
  },
  {
    name: 'History (African & World History)',
    category: 'arts',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'General Arts',
  },
  {
    name: 'Geography',
    category: 'arts',
    levels: ['jhs', 'shs'],
    badge: 'SHS Arts / Science',
  },
  {
    name: 'Christian Religious Studies (CRS / CRE)',
    category: 'arts',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Humanities',
  },
  {
    name: 'Islamic Religious Studies (IRS / IRE)',
    category: 'arts',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Humanities',
  },
  {
    name: 'Religious & Moral Education',
    category: 'arts',
    levels: ['basic', 'jhs'],
    badge: 'Moral & Religious',
  },
  {
    name: 'Philosophy',
    category: 'arts',
    levels: ['shs'],
    badge: 'Continental / Bac',
  },
  {
    name: 'Music',
    category: 'arts',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Performing Arts',
  },

  // ================= LANGUAGES (AFRICAN & GLOBAL) =================
  {
    name: 'French',
    category: 'languages',
    levels: ['kg', 'basic', 'jhs', 'shs'],
    badge: 'ECOWAS / AU Language',
  },
  {
    name: 'Arabic',
    category: 'languages',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'AU Official Language',
  },
  {
    name: 'Kiswahili',
    category: 'languages',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'AU / East & Central Africa',
  },
  {
    name: 'Portuguese',
    category: 'languages',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'AU / Lusophone Africa',
  },
  {
    name: 'African & Indigenous Languages',
    category: 'languages',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Twi · Yoruba · Hausa · Igbo · Zulu · Amharic',
  },

  // ================= VISUAL ARTS, HOME ECONOMICS & TVET =================
  {
    name: 'Creative Arts & Design',
    category: 'tvet',
    levels: ['kg', 'basic', 'jhs'],
    badge: 'Creative Arts',
  },
  {
    name: 'Career & Pre-Technical Studies',
    category: 'tvet',
    levels: ['jhs'],
    badge: 'Career Tech',
  },
  {
    name: 'General Knowledge in Art (Visual Arts)',
    category: 'tvet',
    levels: ['shs'],
    badge: 'WASSCE Visual Arts',
  },
  {
    name: 'Graphic Design & Picture Making',
    category: 'tvet',
    levels: ['shs'],
    badge: 'WASSCE Visual Arts',
  },
  {
    name: 'Management-in-Living',
    category: 'tvet',
    levels: ['shs'],
    badge: 'WASSCE Home Economics',
  },
  {
    name: 'Food & Nutrition',
    category: 'tvet',
    levels: ['shs'],
    badge: 'WASSCE Home Economics',
  },
  {
    name: 'Clothing & Textiles',
    category: 'tvet',
    levels: ['shs'],
    badge: 'WASSCE Home Economics',
  },
  {
    name: 'Home Economics',
    category: 'tvet',
    levels: ['basic', 'jhs', 'shs'],
    badge: 'Vocational',
  },
  {
    name: 'Technical Drawing / Engineering Graphics',
    category: 'tvet',
    levels: ['shs'],
    badge: 'SHS Technical / TVET',
  },
  {
    name: 'Applied Electricity & Electronics',
    category: 'tvet',
    levels: ['shs'],
    badge: 'SHS Technical / TVET',
  },
  {
    name: 'Building Construction, Woodwork & Metalwork',
    category: 'tvet',
    levels: ['shs'],
    badge: 'SHS Technical / TVET',
  },
  {
    name: 'Auto Mechanics',
    category: 'tvet',
    levels: ['shs'],
    badge: 'SHS Technical / TVET',
  },
]

export const DEFAULT_SUBJECTS = SUBJECT_CATALOGUE.map((s) => s.name)

/**
 * All SHS Programmes (programmes / tracks) offered at Senior High / Senior Secondary
 * level across Ghana and West Africa (WAEC / WASSCE), plus Universal Pan-African equivalents.
 *
 * Ghana SHS Programmes: General Science, General Arts, Business, Visual Arts, Home Economics,
 * Agriculture, Technical / TVET, ICT / Computer Science, Music, Physical Education, Languages.
 * West Africa (Nigeria SSS, Sierra Leone, The Gambia, Liberia): Science, Arts, Commercial,
 * Technical, Home Economics, ICT, Languages.
 */
export interface ShsProgrammeOption {
  id: ShsProgrammeId
  label: string
  shortLabel: string
  /** Subject names (matching SUBJECT_CATALOGUE entries) that belong to this programme. */
  subjects: string[]
  /** Icon key for the UI. */
  icon: string
}

export type ShsProgrammeId =
  | 'all-programmes'
  | 'general-science'
  | 'general-arts'
  | 'business'
  | 'visual-arts'
  | 'home-economics'
  | 'agriculture'
  | 'technical-tvet'
  | 'ict-computer-science'
  | 'music'
  | 'physical-education'
  | 'languages'

export const SHS_PROGRAMMES: ShsProgrammeOption[] = [
  {
    id: 'all-programmes',
    label: 'All Programmes',
    shortLabel: 'All Programmes',
    subjects: [],
    icon: 'grid',
  },
  {
    id: 'general-science',
    label: 'General Science',
    shortLabel: 'Science',
    subjects: [
      'Physics',
      'Chemistry',
      'Biology',
      'Elective Mathematics (Further Mathematics)',
      'Core Mathematics (General Mathematics)',
      'Computer Science',
      'Data Processing',
      'Agricultural Science (General Agriculture)',
      'Health Science',
      'Physical Sciences',
      'Life Sciences',
      'Information & Communication Technology (ICT)',
    ],
    icon: 'atom',
  },
  {
    id: 'general-arts',
    label: 'General Arts',
    shortLabel: 'Arts',
    subjects: [
      'Literature-in-English',
      'Government',
      'History (African & World History)',
      'Geography',
      'Christian Religious Studies (CRS / CRE)',
      'Islamic Religious Studies (IRS / IRE)',
      'Economics',
      'French',
      'Arabic',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'Philosophy',
      'Music',
    ],
    icon: 'palette',
  },
  {
    id: 'business',
    label: 'Business',
    shortLabel: 'Business',
    subjects: [
      'Economics',
      'Financial Accounting',
      'Cost Accounting',
      'Business Management',
      'Commerce',
      'Office Practice & Clerical Duties',
      'Marketing & Insurance',
      'Entrepreneurship',
      'Business Studies',
      'Tourism & Hospitality',
      'Core Mathematics (General Mathematics)',
      'English Language',
    ],
    icon: 'briefcase',
  },
  {
    id: 'visual-arts',
    label: 'Visual Arts',
    shortLabel: 'Visual Arts',
    subjects: [
      'General Knowledge in Art (Visual Arts)',
      'Graphic Design & Picture Making',
      'Management-in-Living',
      'Creative Arts & Design',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'French',
      'Social Studies',
      'Physical Education & Health',
    ],
    icon: 'image',
  },
  {
    id: 'home-economics',
    label: 'Home Economics',
    shortLabel: 'Home Econ',
    subjects: [
      'Food & Nutrition',
      'Clothing & Textiles',
      'Management-in-Living',
      'Home Economics',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'Social Studies',
      'Physical Education & Health',
    ],
    icon: 'kitchen',
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    shortLabel: 'Agric',
    subjects: [
      'Agricultural Science (General Agriculture)',
      'Animal Husbandry & Fisheries',
      'Crop Husbandry & Horticulture',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'Biology',
      'Chemistry',
      'Physical Education & Health',
    ],
    icon: 'sprout',
  },
  {
    id: 'technical-tvet',
    label: 'Technical / TVET',
    shortLabel: 'Technical',
    subjects: [
      'Technical Drawing / Engineering Graphics',
      'Applied Electricity & Electronics',
      'Building Construction, Woodwork & Metalwork',
      'Auto Mechanics',
      'Information & Communication Technology (ICT)',
      'Core Mathematics (General Mathematics)',
      'Physics',
      'English Language',
    ],
    icon: 'cog',
  },
  {
    id: 'ict-computer-science',
    label: 'ICT / Computer Science',
    shortLabel: 'ICT',
    subjects: [
      'Computer Science',
      'Data Processing',
      'Information & Communication Technology (ICT)',
      'Core Mathematics (General Mathematics)',
      'Elective Mathematics (Further Mathematics)',
      'English Language',
      'Business Management',
      'Economics',
    ],
    icon: 'monitor',
  },
  {
    id: 'music',
    label: 'Music',
    shortLabel: 'Music',
    subjects: [
      'Music',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'French',
      'Social Studies',
      'History (African & World History)',
      'Physical Education & Health',
    ],
    icon: 'music',
  },
  {
    id: 'physical-education',
    label: 'Physical Education & Health',
    shortLabel: 'PE',
    subjects: [
      'Physical Education & Health',
      'Biology',
      'English Language',
      'Core Mathematics (General Mathematics)',
      'Social Studies',
      'Civic Education & Citizenship',
    ],
    icon: 'activity',
  },
  {
    id: 'languages',
    label: 'Languages',
    shortLabel: 'Languages',
    subjects: [
      'French',
      'Arabic',
      'Kiswahili',
      'Portuguese',
      'African & Indigenous Languages',
      'English Language',
      'Literature-in-English',
      'Social Studies',
    ],
    icon: 'globe',
  },
]

/** Returns subject names for a given SHS programme (or all level subjects if 'all-programmes'). */
export function getSubjectsForProgramme(
  programmeId: ShsProgrammeId,
  levelId: SchoolLevelId,
): string[] {
  if (programmeId === 'all-programmes') {
    return getSubjectsForLevel(levelId).map((s) => s.name)
  }
  const prog = SHS_PROGRAMMES.find((p) => p.id === programmeId)
  if (!prog || prog.subjects.length === 0) return []
  const levelSubjects = getSubjectsForLevel(levelId).map((s) => s.name)
  return prog.subjects.filter((s) => levelSubjects.includes(s))
}

/** Returns the SHS programme metadata (label, icon, etc.) for a given id. */
export function getProgrammeOption(programmeId: ShsProgrammeId): ShsProgrammeOption | undefined {
  return SHS_PROGRAMMES.find((p) => p.id === programmeId)
}

export function getSubjectsForLevel(levelId: SchoolLevelId): SubjectDefinition[] {
  return SUBJECT_CATALOGUE.filter((s) => s.levels.includes(levelId))
}

export function getSubjectDefinition(subjectName: string): SubjectDefinition | undefined {
  const lower = String(subjectName || '').trim().toLowerCase()
  return SUBJECT_CATALOGUE.find((s) => s.name.toLowerCase() === lower)
}

export function inferSubjectCategory(subjectName: string): Exclude<SubjectCategoryId, 'all'> {
  const exact = getSubjectDefinition(subjectName)
  if (exact) return exact.category
  const lower = String(subjectName || '').toLowerCase()
  if (
    lower.includes('physics') ||
    lower.includes('chem') ||
    lower.includes('biolog') ||
    lower.includes('further math') ||
    lower.includes('elective math') ||
    lower.includes('agric') ||
    lower.includes('husbandry') ||
    lower.includes('computer science') ||
    lower.includes('data processing')
  ) {
    return 'science'
  }
  if (
    lower.includes('account') ||
    lower.includes('econom') ||
    lower.includes('business') ||
    lower.includes('commerce') ||
    lower.includes('entrepreneur') ||
    lower.includes('marketing') ||
    lower.includes('tourism') ||
    lower.includes('office')
  ) {
    return 'business'
  }
  if (
    lower.includes('french') ||
    lower.includes('arabic') ||
    lower.includes('swahili') ||
    lower.includes('portuguese') ||
    lower.includes('language') && !lower.includes('english')
  ) {
    return 'languages'
  }
  if (
    lower.includes('literature') ||
    lower.includes('government') ||
    lower.includes('history') ||
    lower.includes('geograph') ||
    lower.includes('religio') ||
    lower.includes('crs') ||
    lower.includes('irs') ||
    lower.includes('philosoph') ||
    lower.includes('music')
  ) {
    return 'arts'
  }
  if (
    lower.includes('art') ||
    lower.includes('design') ||
    lower.includes('food') ||
    lower.includes('nutrition') ||
    lower.includes('clothing') ||
    lower.includes('textile') ||
    lower.includes('living') ||
    lower.includes('home econ') ||
    lower.includes('technical') ||
    lower.includes('electric') ||
    lower.includes('building') ||
    lower.includes('mechanic') ||
    lower.includes('career')
  ) {
    return 'tvet'
  }
  return 'core'
}

export interface SubStrandTemplate {
  name: string
  standardSuffix: string
  standardTitle: string
  indicators: string[]
  keywords: string[]
  tlms: string[]
}

export interface StrandTemplate {
  strandNumber: number
  name: string
  subStrands: SubStrandTemplate[]
}

export function classCodeToken(className: string, levelId?: SchoolLevelId): string {
  const raw = String(className || '').trim()
  const kgMatch = /(?:kg|pp|nursery)\s*(\d)/i.exec(raw)
  if (kgMatch) return `KG${kgMatch[1]}`
  const shsMatch = /(?:shs|sss|ss)\s*(\d)/i.exec(raw)
  if (shsMatch) return `SHS${shsMatch[1]}`
  const gradeMatch = /grade\s*(\d+)/i.exec(raw)
  if (gradeMatch) {
    const g = Number(gradeMatch[1])
    if (g >= 10) return `SHS${g - 9}`
    return `G${g}`
  }
  const formMatch = /form\s*(\d)/i.exec(raw)
  if (formMatch) return `F${formMatch[1]}`
  if (/lower\s*sixth/i.test(raw)) return 'L6'
  if (/upper\s*sixth/i.test(raw)) return 'U6'
  const jhsMatch = /(?:jhs|jss)\s*(\d)/i.exec(raw)
  if (jhsMatch) return `B${Number(jhsMatch[1]) + 6}`
  const basicMatch = /(?:basic|primary)\s*(\d+)/i.exec(raw)
  if (basicMatch) return `B${basicMatch[1]}`
  const numMatch = /(\d+)/.exec(raw)
  if (numMatch) {
    if (levelId === 'kg') return `KG${numMatch[1]}`
    if (levelId === 'shs') return `SHS${numMatch[1]}`
    return `B${numMatch[1]}`
  }
  return levelId === 'kg' ? 'KG1' : levelId === 'shs' ? 'SHS1' : levelId === 'jhs' ? 'B8' : 'B4'
}

export function inferLevelFromClassName(className: string): SchoolLevelId {
  const lower = String(className || '').toLowerCase()
  if (
    lower.includes('kg') ||
    lower.includes('kinder') ||
    lower.includes('nursery') ||
    lower.includes('creche') ||
    lower.includes('reception') ||
    /\bpp\s*[12]\b/.test(lower)
  ) {
    return 'kg'
  }
  if (
    lower.includes('shs') ||
    /\bsss?\s*[123]\b/.test(lower) ||
    lower.includes('senior') ||
    lower.includes('sixth') ||
    lower.includes('seconde') ||
    lower.includes('premi') ||
    lower.includes('terminale') ||
    /\bgrade\s*(10|11|12)\b/.test(lower) ||
    /\bform\s*[456]\b/.test(lower)
  ) {
    return 'shs'
  }
  if (
    lower.includes('jhs') ||
    lower.includes('jss') ||
    lower.includes('junior') ||
    /\bbasic\s*[789]\b/.test(lower) ||
    /\bb[789]\b/.test(lower) ||
    /\bgrade\s*[789]\b/.test(lower) ||
    /\bform\s*[123]\b/.test(lower)
  ) {
    return 'jhs'
  }
  return 'basic'
}

const CURRICULUM_BANK: Record<string, StrandTemplate[]> = {
  computing: [
    {
      strandNumber: 1,
      name: 'Computer Systems, Architecture & Data Representation',
      subStrands: [
        {
          name: 'Hardware, Software & Operating Systems',
          standardSuffix: '1.1.1',
          standardTitle: 'Analyze computer hardware architecture, peripherals, and system software',
          indicators: [
            'Examine the internal components of a computer system (CPU, ALU, Control Unit, RAM, ROM, Storage)',
            'Compare input, output, and secondary storage devices across desktop, mobile, and embedded systems',
            'Convert data accurately between binary, octal, decimal, and hexadecimal number systems',
            'Distinguish system software, utility programs, and application software with practical examples',
            'Demonstrate preventive maintenance, ergonomic safety, and basic hardware troubleshooting',
          ],
          keywords: ['CPU', 'Memory', 'Binary', 'Operating System', 'Peripherals'],
          tlms: ['Computer Lab / Laptops', 'Motherboard & RAM components', 'Projector', 'ICT / Computing Textbook'],
        },
        {
          name: 'Networks, Internet & Cybersecurity',
          standardSuffix: '1.2.1',
          standardTitle: 'Demonstrate understanding of computer networks, cloud services, and digital safety',
          indicators: [
            'Differentiate LAN, MAN, WAN, and wireless network topologies (Star, Bus, Ring, Mesh)',
            'Explain functions of networking hardware (Router, Switch, Modem, Access Point, NIC)',
            'Analyze common cyber threats (phishing, malware, social engineering) and mitigation controls',
            'Demonstrate responsible digital citizenship, data privacy, and ethical ICT usage',
            'Configure basic IP addressing, shared resources, and cloud collaboration workflows',
          ],
          keywords: ['Topology', 'Router', 'Protocols', 'Cybersecurity', 'Cloud Computing'],
          tlms: ['Router/Switch & Ethernet cables', 'Network topology charts', 'Projector / Smartboard'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Productivity Software & Database Management',
      subStrands: [
        {
          name: 'Introduction to Desktop Publishing',
          standardSuffix: '2.3.1',
          standardTitle: 'Demonstrate how to design publications using Desktop Publishing software',
          indicators: [
            'Explain the importance of desktop publishing software in education and business',
            'Create and save a new publication from a blank or predesigned template',
            'Demonstrate the use of commands in Desktop Publishing ribbons (Home, Page Design, Mailings, Review, View)',
            'Change page orientation, margins, columns, and master page layout guides',
            'Add, crop, and format graphics, pictures, and typography for print-ready output',
          ],
          keywords: ['Desktop Publishing', 'Layout', 'Template', 'Orientation', 'Margins', 'Typography'],
          tlms: ['Computers with MS-Publisher / Canva / Scribus', 'Sample brochures & flyers', 'Projector'],
        },
        {
          name: 'Spreadsheets & Relational Databases',
          standardSuffix: '2.4.1',
          standardTitle: 'Use electronic spreadsheets and database systems to process and analyze data',
          indicators: [
            'Construct spreadsheet models using formulas, cell references, and built-in functions (SUM, AVERAGE, IF, VLOOKUP)',
            'Visualize quantitative datasets using column, line, and pie charts',
            'Explain relational database concepts: tables, fields, records, primary keys, and foreign keys',
            'Design data entry forms and run basic queries/filters to retrieve information',
            'Generate structured summary reports from a school or business dataset',
          ],
          keywords: ['Spreadsheet', 'Formulas', 'Primary Key', 'Query', 'Data Visualization'],
          tlms: ['Computer Lab (Excel / LibreOffice Calc / MS Access)', 'Sample student & sales datasets', 'Projector'],
        },
      ],
    },
    {
      strandNumber: 3,
      name: 'Algorithms, Programming & Web Technologies',
      subStrands: [
        {
          name: 'Problem Solving, Flowcharts & Coding',
          standardSuffix: '3.1.1',
          standardTitle: 'Design algorithms and write structured programs to solve real-world problems',
          indicators: [
            'Decompose real-life problems and represent solutions using pseudocode and standard flowcharts',
            'Apply variables, data types, operators, and conditional statements in Python / JavaScript / Scratch',
            'Implement iteration constructs (for and while loops) to automate repetitive tasks',
            'Build and style semantic web pages using HTML5 structure and CSS layout rules',
            'Test, trace, and debug logic and syntax errors systematically',
          ],
          keywords: ['Algorithm', 'Flowchart', 'Pseudocode', 'Variables', 'Loops', 'Debugging'],
          tlms: ['Computers with Code Editor / Browser', 'Flowchart stencil cards', 'Projector'],
        },
      ],
    },
  ],

  mathematics: [
    {
      strandNumber: 1,
      name: 'Number, Numeration, Sets & Surds',
      subStrands: [
        {
          name: 'Sets, Venn Diagrams, Number Bases & Modular Arithmetic',
          standardSuffix: '1.1.1',
          standardTitle: 'Apply set operations, number bases, indices, logarithms, and surds in problem solving',
          indicators: [
            'Solve two-set and three-set word problems using Venn diagrams and set notation',
            'Perform conversions and arithmetic operations across number bases and modular arithmetic',
            'Simplify expressions involving laws of indices, logarithms, and rationalization of surds',
            'Apply ratios, rates, percentages, simple/compound interest, and depreciation to financial tasks',
            'Evaluate approximations, significant figures, standard form, and percentage error',
          ],
          keywords: ['Venn Diagram', 'Indices', 'Logarithms', 'Surds', 'Modular Arithmetic'],
          tlms: ['Mathematical set & scientific calculators', 'Venn diagram wall charts', 'Approved Maths Textbook'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Algebra, Functions & Relations',
      subStrands: [
        {
          name: 'Linear, Simultaneous & Quadratic Equations',
          standardSuffix: '2.1.1',
          standardTitle: 'Formulate and solve algebraic equations, inequalities, and sequences',
          indicators: [
            'Factorize algebraic expressions and quadratic trinomials accurately',
            'Solve linear inequalities and simultaneous equations algebraically and graphically',
            'Solve quadratic equations by factorization, completing the square, and the quadratic formula',
            'Construct tables of values and plot quadratic and linear graphs to read roots and gradients',
            'Determine nth terms and sums of Arithmetic Progressions (AP) and Geometric Progressions (GP)',
          ],
          keywords: ['Quadratic', 'Factorization', 'Simultaneous', 'Gradient', 'Progression'],
          tlms: ['Graph board & graph sheets', 'Scientific calculators', 'Algebraic tiles / charts'],
        },
      ],
    },
    {
      strandNumber: 3,
      name: 'Geometry, Trigonometry, Mensuration & Statistics',
      subStrands: [
        {
          name: 'Circle Theorems, Trigonometry & Data Analysis',
          standardSuffix: '3.1.1',
          standardTitle: 'Apply geometric theorems, trigonometric ratios, bearings, and statistical measures',
          indicators: [
            'Prove and apply circle theorems and polygon angle properties to find unknown angles',
            'Apply sine, cosine, and tangent ratios to angles of elevation, depression, and 3-figure bearings',
            'Calculate surface area and volume of prisms, cylinders, cones, pyramids, and spheres',
            'Compute mean, median, mode, quartiles, variance, and standard deviation for grouped data',
            'Calculate probabilities of mutually exclusive and independent combined events',
          ],
          keywords: ['Circle Theorems', 'Bearings', 'Trigonometry', 'Standard Deviation', 'Probability'],
          tlms: ['Chalkboard geometrical instruments', 'Clinometer model', 'Graph paper & statistical tables'],
        },
      ],
    },
  ],

  further_math: [
    {
      strandNumber: 1,
      name: 'Pure Mathematics — Calculus, Polynomials & Matrices',
      subStrands: [
        {
          name: 'Differentiation & Integration with Applications',
          standardSuffix: '1.1.1',
          standardTitle: 'Apply differential and integral calculus to rates of change, tangents, kinematics, and area',
          indicators: [
            'Evaluate limits of functions and differentiate polynomials from first principles',
            'Apply product, quotient, and chain rules to algebraic and trigonometric functions',
            'Determine equations of tangents/normals, stationary points, maxima, and minima',
            'Evaluate indefinite and definite integrals and compute areas bounded by curves',
            'Solve matrix operations, determinants, and 2x2 / 3x3 linear systems using inverse matrices and Cramer’s rule',
          ],
          keywords: ['Derivative', 'Chain Rule', 'Stationary Points', 'Definite Integral', 'Determinant'],
          tlms: ['Graphing grid board', 'Scientific calculators', 'Elective / Further Mathematics Syllabus & Past Questions'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Vectors, Mechanics & Probability Distributions',
      subStrands: [
        {
          name: 'Vectors in 2D/3D, Statics, Dynamics & Combinatorics',
          standardSuffix: '2.1.1',
          standardTitle: 'Solve problems in vector geometry, Newtonian mechanics, permutations, and distributions',
          indicators: [
            'Compute magnitude, direction, scalar (dot) product, and angle between two vectors',
            'Resolve coplanar forces in equilibrium and apply Newton’s laws of motion to connected particles',
            'Analyze projectile motion for time of flight, maximum height, and horizontal range',
            'Apply permutations, combinations, and the Binomial theorem to counting and expansion problems',
            'Model discrete random variables using Binomial and Poisson probability distributions',
          ],
          keywords: ['Dot Product', 'Equilibrium', 'Projectiles', 'Permutations', 'Binomial Distribution'],
          tlms: ['Force board & pulley kit', 'Mathematical tables', 'Further Mathematics Textbook'],
        },
      ],
    },
  ],

  physics: [
    {
      strandNumber: 1,
      name: 'Mechanics, Matter & Thermal Physics',
      subStrands: [
        {
          name: 'Measurement, Kinematics, Newton’s Laws & Work-Energy-Power',
          standardSuffix: '1.1.1',
          standardTitle: 'Analyze motion, forces, momentum, mechanical energy, and properties of matter',
          indicators: [
            'Measure physical quantities accurately using Vernier calipers, micrometer screw gauge, and balances',
            'Derive and apply equations of uniformly accelerated linear and projectile motion',
            'Verify Newton’s laws of motion, conservation of linear momentum, and Hooke’s law experimentally',
            'Calculate work done, kinetic/potential energy, power, and mechanical efficiency of machines',
            'Determine specific heat capacity and specific latent heat using the method of mixtures and electrical methods',
          ],
          keywords: ['Kinematics', 'Momentum', 'Mechanical Energy', 'Hooke’s Law', 'Specific Heat Capacity'],
          tlms: ['Vernier calipers & micrometer screw gauge', 'Spiral springs & slotted masses', 'Calorimeter & thermometers'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Waves, Optics, Electricity, Magnetism & Atomic Physics',
      subStrands: [
        {
          name: 'Wave Phenomena, Electric Circuits & Electromagnetism',
          standardSuffix: '2.1.1',
          standardTitle: 'Investigate wave optics, DC/AC circuits, electromagnetic induction, and radioactivity',
          indicators: [
            'Apply wave equations, reflection, Snell’s law of refraction, and thin lens formulas experimentally',
            'Verify Ohm’s law and analyze series/parallel resistor networks, EMF, internal resistance, and Kirchhoff’s laws',
            'Explain electromagnetic induction, Faraday’s & Lenz’s laws, and step-up/step-down transformer action',
            'Describe photoelectric effect, atomic energy levels, and properties of alpha, beta, and gamma radiation',
            'Solve half-life decay problems and discuss peaceful applications and safety precautions of nuclear energy',
          ],
          keywords: ['Refraction', 'Ohm’s Law', 'Internal Resistance', 'Electromagnetic Induction', 'Half-Life'],
          tlms: ['Ray box, glass prism & converging lenses', 'Ammeter, voltmeter, rheostat & cells', 'Physics Lab Manual'],
        },
      ],
    },
  ],

  chemistry: [
    {
      strandNumber: 1,
      name: 'Atomic Structure, Chemical Bonding & Stoichiometry',
      subStrands: [
        {
          name: 'Periodic Table, Bonding & Quantitative Mole Concept',
          standardSuffix: '1.1.1',
          standardTitle: 'Relate electronic configuration to periodicity, chemical bonding, and stoichiometric calculations',
          indicators: [
            'Write electronic configurations (s, p, d orbitals) and explain periodic trends (ionization energy, atomic radius, electronegativity)',
            'Compare ionic, covalent, dative, metallic, and intermolecular bonding and resulting physical properties',
            'Apply Avogadro’s constant, molar mass, molar gas volume, and gas laws (Boyle’s, Charles’, Ideal Gas)',
            'Determine empirical and molecular formulas and balance stoichiometric and redox equations',
            'Perform acid-base volumetric titrations accurately to determine unknown molar concentrations',
          ],
          keywords: ['Periodicity', 'Covalent Bonding', 'Mole Concept', 'Titration', 'Molarity'],
          tlms: ['Periodic Table wall chart', 'Burette, pipette, conical flasks & indicators', 'Molecular model kit'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Chemical Kinetics, Equilibria, Electrochemistry & Organic Chemistry',
      subStrands: [
        {
          name: 'Rates of Reaction, Electrolysis & Functional Group Chemistry',
          standardSuffix: '2.1.1',
          standardTitle: 'Investigate reaction rates, Le Chatelier’s principle, electrolysis, and hydrocarbons',
          indicators: [
            'Measure factors affecting reaction rates (concentration, temperature, surface area, catalyst) using collision theory',
            'Predict shifts in dynamic chemical equilibrium using Le Chatelier’s principle',
            'Explain preferential discharge of ions during electrolysis and apply Faraday’s laws quantitatively',
            'Name and classify alkanes, alkenes, alkynes, alkanols, alkanoic acids, and esters using IUPAC nomenclature',
            'Carry out qualitative tests for cations, anions, and unsaturated/functional organic groups safely',
          ],
          keywords: ['Collision Theory', 'Equilibrium', 'Electrolysis', 'IUPAC Nomenclature', 'Hydrocarbons'],
          tlms: ['Electrolysis cell & electrodes', 'Test tubes & qualitative analysis reagents', 'Organic molecular models'],
        },
      ],
    },
  ],

  biology: [
    {
      strandNumber: 1,
      name: 'Cell Biology, Diversity of Living Organisms & Physiology',
      subStrands: [
        {
          name: 'Cell Ultrastructure, Transport, Nutrition & Mammalian Systems',
          standardSuffix: '1.1.1',
          standardTitle: 'Examine cell structure, osmosis/diffusion, photosynthesis, and transport/respiration in organisms',
          indicators: [
            'Prepare and observe temporary wet mounts of plant and animal cells under a light microscope',
            'Demonstrate diffusion, osmosis, and plasmolysis experimentally in living tissues',
            'Test food substances for starch, reducing sugars, non-reducing sugars, proteins, and lipids',
            'Explain photosynthesis, enzymatic action, cellular respiration, and gaseous exchange mechanisms',
            'Describe structure and homeostatic functions of mammalian circulatory, excretory, and nervous systems',
          ],
          keywords: ['Organelles', 'Osmosis', 'Photosynthesis', 'Enzymes', 'Homeostasis'],
          tlms: ['Light microscopes & prepared slides', 'Benedict’s, Biuret & Iodine reagents', 'Anatomical charts & models'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Genetics, Variation, Evolution & Ecology',
      subStrands: [
        {
          name: 'Heredity, Mendelian Crosses & Ecosystem Dynamics',
          standardSuffix: '2.1.1',
          standardTitle: 'Analyze DNA replication, Mendelian inheritance, ecological sampling, and public health',
          indicators: [
            'Compare mitosis and meiosis and relate chromosome behavior to genetic variation',
            'Solve monohybrid, sex-linked, ABO blood group, and sickle-cell inheritance problems using Punnett squares',
            'Use quadrats and line transects to estimate population density and construct food webs and ecological pyramids',
            'Analyze nutrient cycles (carbon, nitrogen, water) and conservation of African biodiversity',
            'Evaluate transmission, lifecycle, prevention, and control of malaria, cholera, tuberculosis, and HIV',
          ],
          keywords: ['Mitosis & Meiosis', 'Punnett Square', 'Genotype', 'Quadrat', 'Food Web', 'Biodiversity'],
          tlms: ['Quadrats & sweep nets', 'Genetic cross charts', 'Microscope slides of mitosis', 'Biology Practical Manual'],
        },
      ],
    },
  ],

  science: [
    {
      strandNumber: 1,
      name: 'Diversity of Matter, Cycles & Energy',
      subStrands: [
        {
          name: 'Elements, Mixtures, Force, Energy & Electricity',
          standardSuffix: '1.1.1',
          standardTitle: 'Investigate properties of matter, separation mixtures, energy transformations, and basic circuits',
          indicators: [
            'Classify elements, compounds, and mixtures and demonstrate filtration, evaporation, and distillation',
            'Construct simple series and parallel electrical circuits using cells, switches, resistors, and LEDs',
            'Compare renewable (solar, hydro, wind, geothermal) and non-renewable energy sources across Africa',
            'Explain acids, bases, salts, and pH indicators using everyday household and laboratory substances',
            'Demonstrate safe laboratory rules, hazard symbol identification, and scientific measurement',
          ],
          keywords: ['Mixtures', 'pH Scale', 'Series & Parallel', 'Renewable Energy', 'Scientific Method'],
          tlms: ['Beakers, funnels, litmus paper', 'Dry cells, bulbs, wires & switches', 'Periodic Table & hazard chart'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Life Processes, Agriculture & Environmental Sustainability',
      subStrands: [
        {
          name: 'Human Body Systems, Crop/Soil Science & Climate Resilience',
          standardSuffix: '2.1.1',
          standardTitle: 'Examine human organ systems, soil fertility, pest management, and environmental conservation',
          indicators: [
            'Describe digestion, blood circulation, respiration, and reproduction in humans and flowering plants',
            'Compare sandy, clayey, and loamy soils for water retention, capillarity, and crop suitability',
            'Design sustainable waste management, reforestation, and climate adaptation initiatives for the school/community',
            'Analyze balanced diet, food hygiene, water purification, and prevention of common communicable diseases',
            'Record observations, plot graphs, and write structured scientific investigation reports',
          ],
          keywords: ['Digestion', 'Soil Profile', 'Photosynthesis', 'Sanitation', 'Climate Action'],
          tlms: ['Human torso model', 'Soil samples & measuring cylinders', 'Hand lenses & science charts'],
        },
      ],
    },
  ],

  english: [
    {
      strandNumber: 1,
      name: 'Oral English, Reading Comprehension & Summary Writing',
      subStrands: [
        {
          name: 'Vowel/Consonant Sounds, Stress, Comprehension & Summary',
          standardSuffix: '1.1.1',
          standardTitle: 'Demonstrate articulate speech, critical reading comprehension, and concise summary skills',
          indicators: [
            'Articulate pure vowels, diphthongs, consonant clusters, word stress, and emphatic intonation accurately',
            'Answer literal, inferential, vocabulary-in-context, and grammatical-name/function comprehension questions',
            'Identify topic sentences and synthesize key arguments into clear, word-economical summary sentences',
            'Distinguish facts, opinions, tone, mood, and figurative expressions in unseen passages',
            'Build academic and register-specific vocabulary across science, commerce, governance, and media',
          ],
          keywords: ['Phonetics', 'Stress & Intonation', 'Inference', 'Grammatical Function', 'Summary'],
          tlms: ['Pronunciation chart', 'Comprehension & summary passages', 'English Dictionary', 'Audio clips'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Grammar, Lexis & Structure and Continuous Writing',
      subStrands: [
        {
          name: 'Concord, Clauses, Register & Essay / Letter Composition',
          standardSuffix: '2.1.1',
          standardTitle: 'Apply standard grammatical structures and compose well-organized essays, letters, and speeches',
          indicators: [
            'Apply rules of subject-verb concord, tense sequence, active/passive voice, and direct/indirect speech',
            'Identify noun, adjectival, and adverbial clauses/phrases and state their grammatical functions',
            'Write formal and informal letters with accurate layout, salutation, tone, and paragraph cohesion',
            'Compose persuasive speeches, articles for publication, reports, and narrative/expository essays',
            'Edit and proofread drafts for punctuation, spelling, idioms, phrasal verbs, and stylistic clarity',
          ],
          keywords: ['Concord', 'Subordinate Clauses', 'Register', 'Formal Letter', 'Cohesion'],
          tlms: ['Model essay & letter templates', 'Grammar & lexis task cards', 'Approved English Textbook'],
        },
      ],
    },
  ],

  literature: [
    {
      strandNumber: 1,
      name: 'Literary Appreciation — African & Non-African Prose and Drama',
      subStrands: [
        {
          name: 'Plot, Characterization, Themes, Setting & Dramatic Techniques',
          standardSuffix: '1.1.1',
          standardTitle: 'Critically analyze prescribed African and non-African novels and plays',
          indicators: [
            'Trace plot development, conflict resolution, flashbacks, and foreshadowing in prescribed prose texts',
            'Evaluate major and minor characters, their motivations, relationships, and moral dilemmas',
            'Examine central themes (tradition vs modernity, governance, gender, identity, justice) in African literature',
            'Analyze dramatic devices: soliloquy, aside, dramatic irony, stage directions, dialogue, and tragic/comic elements',
            'Write well-substantiated literary essays supported with accurate textual references',
          ],
          keywords: ['Characterization', 'Protagonist', 'Dramatic Irony', 'Soliloquy', 'Theme'],
          tlms: ['Prescribed African & World novels/plays', 'Character map charts', 'Role-play scripts'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Poetry Appreciation & Unseen Literary Criticism',
      subStrands: [
        {
          name: 'Poetic Devices, Imagery, Structure, Tone & Unseen Extracts',
          standardSuffix: '2.1.1',
          standardTitle: 'Interpret African and non-African poetry and respond critically to unseen prose/verse',
          indicators: [
            'Identify figurative and sound devices (metaphor, simile, personification, imagery, alliteration, assonance, oxymoron)',
            'Analyze persona, tone, mood, stanzaic form, rhythm, and rhyme scheme in prescribed poems',
            'Relate socio-historical and cultural contexts of African poets to thematic meaning',
            'Perform expressive choral/solo recitations highlighting cadence and emotional resonance',
            'Write structured critical appreciations of unseen prose passages and poems under timed conditions',
          ],
          keywords: ['Persona', 'Imagery', 'Diction', 'Tone & Mood', 'Enjambment'],
          tlms: ['Anthology of African & World Poetry', 'Poetic devices reference sheet', 'Unseen practice extracts'],
        },
      ],
    },
  ],

  economics: [
    {
      strandNumber: 1,
      name: 'Microeconomics — Scarcity, Demand, Supply & Production',
      subStrands: [
        {
          name: 'Basic Economic Problems, Price Mechanism, Elasticity & Cost Theory',
          standardSuffix: '1.1.1',
          standardTitle: 'Analyze scarcity, opportunity cost, market equilibrium, elasticity, and theory of production',
          indicators: [
            'Illustrate scarcity, choice, scale of preference, and opportunity cost using Production Possibility Curves (PPC)',
            'Plot demand and supply schedules/curves and determine equilibrium price and quantity',
            'Calculate and interpret price, income, and cross elasticities of demand and supply',
            'Distinguish short-run and long-run production costs (TC, FC, VC, AC, MC) and law of diminishing returns',
            'Compare perfect competition, monopoly, monopolistic competition, and oligopoly market structures',
          ],
          keywords: ['Opportunity Cost', 'Equilibrium Price', 'Elasticity', 'Marginal Cost', 'Market Structure'],
          tlms: ['Demand & supply graph boards', 'Calculators', 'Market price survey sheets', 'Economics Textbook'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Macroeconomics — Money, National Income, Trade & African Development',
      subStrands: [
        {
          name: 'National Income, Inflation, Public Finance & Regional Economic Integration',
          standardSuffix: '2.1.1',
          standardTitle: 'Evaluate national income accounting, monetary/fiscal policy, international trade, and development in Africa',
          indicators: [
            'Compute GDP, GNP, and NNP using income, output, and expenditure approaches and discuss measurement challenges',
            'Analyze functions of central and commercial banks, inflation causes/remedies, and monetary policy tools',
            'Examine government budgets, direct/indirect taxation principles, public debt, and fiscal policy',
            'Evaluate comparative advantage, balance of payments, exchange rates, and AfCFTA / ECOWAS / EAC / SADC trade',
            'Propose sustainable strategies for industrialization, youth employment, and agricultural transformation in Africa',
          ],
          keywords: ['GDP', 'Monetary Policy', 'Fiscal Policy', 'Balance of Payments', 'AfCFTA'],
          tlms: ['Central Bank statistical bulletins', 'National budget summary charts', 'Economics Past Questions'],
        },
      ],
    },
  ],

  accounting: [
    {
      strandNumber: 1,
      name: 'Principles of Double-Entry, Books of Original Entry & Trial Balance',
      subStrands: [
        {
          name: 'Source Documents, Cash Book, Bank Reconciliation & Control Accounts',
          standardSuffix: '1.1.1',
          standardTitle: 'Apply accounting concepts to record transactions, balance ledgers, and reconcile accounts',
          indicators: [
            'Explain fundamental accounting concepts (entity, going concern, accrual, prudence, consistency, materiality)',
            'Record source documents into Sales, Purchases, Returns Journals, Petty Cash Book, and Three-Column Cash Book',
            'Post entries to general and subsidiary ledgers and extract an accurate Trial Balance',
            'Identify errors not affecting and affecting the Trial Balance and prepare Suspense Account corrections',
            'Prepare Bank Reconciliation Statements and Sales/Purchases Ledger Control Accounts',
          ],
          keywords: ['Double Entry', 'Cash Book', 'Trial Balance', 'Suspense Account', 'Bank Reconciliation'],
          tlms: ['Ledger & Cash Book ruling sheets', 'Sample invoices, receipts & payment vouchers', 'Calculators'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Financial Statements, Partnerships, Companies & Cost Accounting',
      subStrands: [
        {
          name: 'Final Accounts, Depreciation, Non-Profit Organizations & Costing',
          standardSuffix: '2.1.1',
          standardTitle: 'Prepare final accounts with adjustments and compute manufacturing/job/process costs',
          indicators: [
            'Account for accruals, prepayments, bad debts, provision for doubtful debts, and straight-line/reducing-balance depreciation',
            'Prepare Income Statement (Trading, Profit & Loss) and Statement of Financial Position (Balance Sheet) of a sole trader',
            'Prepare Receipts & Payments and Income & Expenditure accounts for clubs and non-profit organizations',
            'Prepare Partnership Appropriation Accounts and Manufacturing Accounts separating prime cost and factory overheads',
            'Classify direct/indirect costs, value inventory (FIFO, LIFO, Weighted Average), and compute break-even point',
          ],
          keywords: ['Income Statement', 'Balance Sheet', 'Depreciation', 'Prime Cost', 'Break-Even'],
          tlms: ['Accounting columnar pads', 'Financial statement templates', 'Calculators', 'Accounting Syllabus'],
        },
      ],
    },
  ],

  business: [
    {
      strandNumber: 1,
      name: 'Business Organizations, Management & Entrepreneurship',
      subStrands: [
        {
          name: 'Forms of Business Ownership, Management Functions & Business Plans',
          standardSuffix: '1.1.1',
          standardTitle: 'Analyze business ownership structures, management principles, and entrepreneurial venture creation',
          indicators: [
            'Compare sole proprietorships, partnerships, limited liability companies, cooperatives, and public corporations',
            'Explain core management functions: planning, organizing, staffing, directing/leading, and controlling',
            'Identify market opportunities and develop a structured Business Plan (value proposition, operations, cash flow)',
            'Analyze organizational structures, delegation, span of control, motivation theories, and workplace communication',
            'Evaluate corporate social responsibility (CSR), business ethics, and consumer protection laws',
          ],
          keywords: ['Entrepreneurship', 'Planning & Controlling', 'Limited Liability', 'Business Plan', 'CSR'],
          tlms: ['Organizational chart posters', 'Business plan canvas worksheets', 'Case studies of African enterprises'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Trade, Marketing, Finance, Insurance & E-Commerce',
      subStrands: [
        {
          name: 'Domestic/International Trade, Marketing Mix & Financial Services',
          standardSuffix: '2.1.1',
          standardTitle: 'Examine channels of distribution, the 4Ps of marketing, banking/mobile money, and business law',
          indicators: [
            'Differentiate home trade (wholesale/retail) and international trade documents (Bill of Lading, Letter of Credit, Invoice)',
            'Apply the marketing mix (Product, Price, Place, Promotion) and market segmentation to real products',
            'Evaluate sources of short-term and long-term business finance, capital markets, and digital/mobile payments in Africa',
            'Explain principles of insurance (indemnity, insurable interest, utmost good faith, subrogation, proximate cause)',
            'Outline elements of a valid business contract, agency relationships, and labour relations',
          ],
          keywords: ['Marketing Mix', 'Bill of Lading', 'Indemnity', 'Capital Market', 'Mobile Money'],
          tlms: ['Sample trade & shipping documents', 'Product packaging samples', 'Business Management / Commerce Textbook'],
        },
      ],
    },
  ],

  government: [
    {
      strandNumber: 1,
      name: 'Political Concepts, Constitutions & Organs of Government',
      subStrands: [
        {
          name: 'State, Sovereignty, Rule of Law, Separation of Powers & Electoral Systems',
          standardSuffix: '1.1.1',
          standardTitle: 'Analyze foundational political concepts, constitutionalism, governance systems, and elections',
          indicators: [
            'Distinguish State, Nation, Government, Sovereignty, Power, Authority, and Legitimacy',
            'Examine Rule of Law, Fundamental Human Rights, Separation of Powers, and Checks and Balances',
            'Compare unitary, federal, confederal, presidential, and parliamentary systems of government',
            'Evaluate functions of the Legislature, Executive, Judiciary, Electoral Commission, and Public Service',
            'Analyze political parties, pressure groups, public opinion, and free, fair, and transparent elections',
          ],
          keywords: ['Sovereignty', 'Rule of Law', 'Separation of Powers', 'Constitutionalism', 'Suffrage'],
          tlms: ['National Constitution copies', 'Arms of government chart', 'Mock parliament/election role-play kit'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'African Governance, Regional Integration & International Organizations',
      subStrands: [
        {
          name: 'Pre-Colonial/Post-Independence Governance, AU, Regional Blocs & UN',
          standardSuffix: '2.1.1',
          standardTitle: 'Evaluate political evolution in Africa, local government, foreign policy, and regional/global institutions',
          indicators: [
            'Compare indigenous African political institutions with colonial administration and nationalist movements',
            'Assess structure, financing, and developmental roles of Local Government and Traditional Authorities',
            'Examine objectives, organs, achievements, and challenges of the African Union (AU) and regional blocs (ECOWAS, EAC, SADC)',
            'Analyze determinants of foreign policy and Africa’s participation in the UN and Commonwealth',
            'Propose civic solutions for accountability, peacebuilding, and democratic consolidation across Africa',
          ],
          keywords: ['Decentralization', 'Nationalism', 'African Union (AU)', 'ECOWAS', 'Foreign Policy'],
          tlms: ['Political map of Africa', 'AU & Regional Economic Communities chart', 'Government Textbook'],
        },
      ],
    },
  ],

  geography: [
    {
      strandNumber: 1,
      name: 'Physical Geography, Map Reading & Geographic Information Systems',
      subStrands: [
        {
          name: 'Earth Processes, Weather/Climate, Topographical Maps & GIS',
          standardSuffix: '1.1.1',
          standardTitle: 'Interpret landforms, climatic elements, topographical contour maps, and spatial data',
          indicators: [
            'Classify igneous, sedimentary, and metamorphic rocks and landforms produced by folding, faulting, vulcanicity, and rivers',
            'Measure weather elements using standard Stevenson screen instruments and interpret climate graphs across Africa',
            'Measure map distances, bearings, gradients, cross-sections, and intervisibility on topographical sheets',
            'Explain major African vegetation belts (equatorial rainforest, savanna, desert, Mediterranean, montane)',
            'Introduce satellite imagery, GPS coordinates, and GIS layers in environmental monitoring',
          ],
          keywords: ['Contour Interval', 'Gradient', 'Denudation', 'Savanna', 'GIS'],
          tlms: ['Topographical map sheets', 'Prismatic compass, rain gauge & thermometer', 'Physical map of Africa'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Human, Economic & Regional Geography of Africa',
      subStrands: [
        {
          name: 'Population, Urbanization, Agriculture, Mining, Transport & Trade in Africa',
          standardSuffix: '2.1.1',
          standardTitle: 'Analyze population dynamics, settlement patterns, resource utilization, and sustainable development in Africa',
          indicators: [
            'Analyze population distribution, migration push-pull factors, age-sex pyramids, and rapid urbanization in Africa',
            'Examine plantation, irrigation, pastoral, and smallholder agriculture across major African river basins',
            'Assess mineral/energy resources, hydroelectric schemes, and manufacturing industries in Africa',
            'Compare road, rail, inland waterway, maritime, and air transport corridors supporting intra-African trade',
            'Evaluate environmental hazards (desertification, flooding, soil erosion, coastal erosion) and mitigation measures',
          ],
          keywords: ['Urbanization', 'Population Pyramid', 'Irrigation', 'Hydroelectric Power', 'Desertification'],
          tlms: ['Atlas & Wall Map of Africa', 'Demographic data charts', 'Rock & mineral specimen box'],
        },
      ],
    },
  ],

  history: [
    {
      strandNumber: 1,
      name: 'Pre-Colonial African Civilizations, States & Trans-Regional Trade',
      subStrands: [
        {
          name: 'Sources of African History, Indigenous Empires & Socio-Economic Institutions',
          standardSuffix: '1.1.1',
          standardTitle: 'Investigate historical sources and achievements of major pre-colonial African states and civilizations',
          indicators: [
            'Evaluate archaeological, oral tradition, linguistic, ethnographic, and written sources of African history',
            'Examine iron technology, agriculture, craft industries, and trans-Saharan / Indian Ocean / regional trade networks',
            'Analyze political organization and achievements of major African states and empires (Ghana, Mali, Songhai, Asante, Oyo, Benin, Kanem-Bornu, Aksum, Swahili city-states, Great Zimbabwe, Zulu)',
            'Assess the impact of the trans-Atlantic slave trade and abolition movements on African societies',
            'Construct accurate historical timelines and corroborate primary and secondary evidence',
          ],
          keywords: ['Historiography', 'Oral Tradition', 'Trans-Saharan Trade', 'State Formation', 'Primary Sources'],
          tlms: ['Historical maps of Africa', 'Timeline charts', 'Excerpts from primary historical chronicles'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Colonial Rule, Pan-Africanism, Independence & Contemporary Africa',
      subStrands: [
        {
          name: 'Scramble for Africa, African Resistance, Decolonization & Post-Independence Development',
          standardSuffix: '2.1.1',
          standardTitle: 'Analyze European colonization, African resistance, nationalist movements, and post-1960 nation-building',
          indicators: [
            'Examine the Berlin Conference (1884–1885), partition of Africa, and African diplomatic/military resistance',
            'Compare British Indirect Rule, French Assimilation/Association, and settler colonial administrations',
            'Evaluate Pan-Africanism, World War II impacts, nationalist parties, and pathways to African independence',
            'Assess post-independence socio-economic development: education, infrastructure, health, and industrialization',
            'Analyze the transition from OAU (1963) to the African Union (AU) and Africa’s role in global affairs',
          ],
          keywords: ['Partition', 'Indirect Rule', 'Pan-Africanism', 'Decolonization', 'Nation-Building'],
          tlms: ['Map of Africa (1885 vs Post-1960)', 'Speeches of African independence leaders', 'History Textbook'],
        },
      ],
    },
  ],

  agriculture: [
    {
      strandNumber: 1,
      name: 'Soil Science, Crop Husbandry, Forestry & Mechanization',
      subStrands: [
        {
          name: 'Soil Fertility, Agronomy of Tropical Crops & Farm Power',
          standardSuffix: '1.1.1',
          standardTitle: 'Apply scientific principles to soil conservation, crop production, pest control, and farm machinery',
          indicators: [
            'Analyze soil formation, profile horizons, soil pH, macro/micronutrients, and organic/inorganic fertilizer application',
            'Demonstrate nursery preparation, planting, cultural practices, harvesting, and storage of major African food and cash crops',
            'Identify major crop pests, weeds, and diseases and apply Integrated Pest Management (IPM) safely',
            'Explain operation and maintenance of farm tools, tractors, tillage implements, and drip/sprinkler irrigation',
            'Design school farm plots practicing crop rotation, mulching, agroforestry, and soil conservation',
          ],
          keywords: ['Soil Fertility', 'Crop Rotation', 'Integrated Pest Management', 'Irrigation', 'Agroforestry'],
          tlms: ['School garden / farm tools', 'Soil testing kit & fertilizer samples', 'Crop seed specimens'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Animal Husbandry, Fisheries & Agribusiness Management',
      subStrands: [
        {
          name: 'Livestock Production, Rations, Animal Health & Farm Records',
          standardSuffix: '2.1.1',
          standardTitle: 'Manage poultry, ruminant, non-ruminant, and aquaculture enterprises profitably',
          indicators: [
            'Identify breeds and housing systems for poultry, cattle, sheep, goats, pigs, rabbits, and fish farming',
            'Formulate balanced starter, grower, layer, and finisher rations using locally available feed ingredients',
            'Recognize symptoms, vaccination schedules, and biosecurity measures for major livestock parasites and diseases',
            'Maintain accurate farm inventory, production, input, and profit-and-loss agribusiness records',
            'Evaluate agricultural value chains, cooperative marketing, extension services, and food security in Africa',
          ],
          keywords: ['Ration Formulation', 'Biosecurity', 'Aquaculture', 'Farm Records', 'Value Chain'],
          tlms: ['Feed ingredient samples', 'Livestock breed & anatomy charts', 'Farm record ledger templates'],
        },
      ],
    },
  ],

  religious: [
    {
      strandNumber: 1,
      name: 'Sacred Scriptures, Creation, Leadership & Moral Teachings',
      subStrands: [
        {
          name: 'Scriptural Foundations, Exemplary Leaders & Ethical Decision-Making',
          standardSuffix: '1.1.1',
          standardTitle: 'Examine sacred teachings on creation, stewardship, moral leadership, and human dignity',
          indicators: [
            'Explain accounts of creation, human responsibility, and environmental stewardship across religious traditions',
            'Analyze leadership qualities of key scriptural and historical figures (integrity, courage, humility, justice, service)',
            'Apply core moral precepts and teachings on honesty, diligence, forgiveness, and respect for human life',
            'Compare rites of passage and positive moral values in indigenous African heritage and world religions',
            'Evaluate contemporary moral dilemmas faced by youth using ethical reasoning',
          ],
          keywords: ['Stewardship', 'Integrity', 'Moral Values', 'Leadership', 'Human Dignity'],
          tlms: ['Approved Sacred Texts & Commentaries', 'Moral case study cards', 'Values reflection journals'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Family Life, Civic Responsibility & Peaceful Coexistence',
      subStrands: [
        {
          name: 'Interfaith Harmony, Social Justice, Work Ethics & Youth Civic Duty',
          standardSuffix: '2.1.1',
          standardTitle: 'Promote responsible family life, inter-religious tolerance, dignity of labour, and civic peace',
          indicators: [
            'Examine rights and responsibilities of parents, children, and extended family networks in African society',
            'Promote religious tolerance, interfaith dialogue, and peaceful conflict resolution in pluralistic communities',
            'Analyze teachings on dignity of work, wealth creation, charity, and avoidance of corruption and substance abuse',
            'Design a student-led community service or peer mentorship project',
            'Reflect on civic virtues that strengthen national unity and social justice',
          ],
          keywords: ['Interfaith Harmony', 'Social Justice', 'Dignity of Labour', 'Peacebuilding', 'Civic Duty'],
          tlms: ['Case study scenarios', 'Discussion prompt cards', 'CRS / IRS / RME Syllabus & Learner’s Book'],
        },
      ],
    },
  ],

  languages: [
    {
      strandNumber: 1,
      name: 'Oral Proficiency, Phonology & Listening Comprehension',
      subStrands: [
        {
          name: 'Pronunciation, Everyday Dialogues & Situational Communication',
          standardSuffix: '1.1.1',
          standardTitle: 'Communicate fluently and accurately in everyday academic, social, and travel situations',
          indicators: [
            'Pronounce distinctive vowels, consonants, nasal/tonal patterns, and intonation contours accurately',
            'Engage in structured dialogues covering greetings, family, school life, markets, health, and travel',
            'Extract main ideas and specific details from spoken announcements, dialogues, and short broadcasts',
            'Use polite registers, idioms, proverbs, and culturally appropriate expressions in context',
            'Deliver short oral presentations describing community events, professions, and aspirations',
          ],
          keywords: ['Pronunciation', 'Dialogue', 'Listening', 'Register', 'Oral Fluency'],
          tlms: ['Audio dialogues / flashcards', 'Phonetic & tonal charts', 'Role-play cue cards'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Grammar, Reading Comprehension, Translation & Cultural Literature',
      subStrands: [
        {
          name: 'Sentence Structure, Verb Conjugation, Composition & Cultural Heritage',
          standardSuffix: '2.1.1',
          standardTitle: 'Apply grammatical rules in reading, translation, composition, and cultural appreciation',
          indicators: [
            'Conjugate regular and irregular verbs across present, past, future, and conditional tenses accurately',
            'Apply noun classes/gender, agreement, pronouns, prepositions, and negation in complex sentences',
            'Read unseen passages and answer comprehension and vocabulary questions accurately',
            'Translate short passages accurately while preserving idiomatic meaning and grammatical structure',
            'Compose guided letters, narratives, and essays celebrating African oral/written literature and culture',
          ],
          keywords: ['Conjugation', 'Agreement', 'Translation', 'Proverbs', 'Composition'],
          tlms: ['Bilingual dictionary', 'Verb conjugation tables', 'Approved Language Reader & Workbook'],
        },
      ],
    },
  ],

  tvet: [
    {
      strandNumber: 1,
      name: 'Design Principles, Materials, Tools & Workshop/Studio Safety',
      subStrands: [
        {
          name: 'Occupational Health & Safety, Technical Drawing / Design Process & Materials',
          standardSuffix: '1.1.1',
          standardTitle: 'Apply workshop/studio safety standards, design thinking, and material properties',
          indicators: [
            'Demonstrate Personal Protective Equipment (PPE) usage, hazard prevention, and first-aid procedures in studios/workshops',
            'Apply elements and principles of design or orthographic/isometric projection to prepare working drawings',
            'Classify properties, selection criteria, and sustainable sourcing of materials/ingredients/fabrics/components',
            'Identify, calibrate, use, and maintain hand tools, measuring instruments, and studio/workshop equipment',
            'Prepare accurate bills of quantities, cutting lists, or recipe/production cost estimates',
          ],
          keywords: ['Workshop Safety', 'Design Brief', 'Orthographic Projection', 'Materials', 'Costing'],
          tlms: ['Drawing instruments / studio kit', 'PPE safety chart', 'Material & fabric/component samples'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Practical Production, Quality Control & Creative Entrepreneurship',
      subStrands: [
        {
          name: 'Step-by-Step Fabrication / Production, Finishing, Packaging & Exhibition',
          standardSuffix: '2.1.1',
          standardTitle: 'Execute practical projects to industry standards, evaluate quality, and package for market',
          indicators: [
            'Follow sequential production processes from layout/preparation through assembly, cooking, sewing, or circuit/structural build',
            'Apply appropriate surface finishing, decoration, nutritional preservation, or circuit testing techniques',
            'Inspect completed artifacts/products against functional, aesthetic, and safety quality standards',
            'Design eco-friendly packaging, labelling, branding, and pricing for exhibition or micro-enterprise sale',
            'Document the full project portfolio with sketches, process notes, cost sheets, and self-evaluation',
          ],
          keywords: ['Fabrication', 'Quality Control', 'Finishing', 'Packaging', 'Portfolio'],
          tlms: ['Workshop / Home Econ / Visual Art studio tools', 'Project rubric & costing sheet', 'Sample finished artifacts'],
        },
      ],
    },
  ],

  social: [
    {
      strandNumber: 1,
      name: 'Environment, Culture, Identity & Sustainable Development',
      subStrands: [
        {
          name: 'Physical Environment, Cultural Heritage, Socialization & Population',
          standardSuffix: '1.1.1',
          standardTitle: 'Examine environmental stewardship, cultural diversity, family institutions, and sustainable development',
          indicators: [
            'Analyze relationships between human activities, natural resources, sanitation, and environmental conservation',
            'Appreciate shared values across diverse African ethnic groups, national symbols, and cultural heritage',
            'Examine roles of family, school, peer groups, and media in youth socialization and character formation',
            'Evaluate population growth, youth empowerment, reproductive health, and community development',
            'Design practical school/community action plans addressing waste, water, or environmental challenges',
          ],
          keywords: ['Stewardship', 'Cultural Heritage', 'Socialization', 'Demography', 'Sustainability'],
          tlms: ['Map of Africa & local community', 'National & AU symbols chart', 'Case study cards'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: 'Citizenship, Governance, Human Rights & Regional Cooperation',
      subStrands: [
        {
          name: 'Constitutional Rights, Peacebuilding, Civic Duties & Africa in the World',
          standardSuffix: '2.1.1',
          standardTitle: 'Demonstrate active citizenship, respect for human rights, peacebuilding, and African cooperation',
          indicators: [
            'Explain fundamental human rights and corresponding civic responsibilities of citizens under the Constitution',
            'Demonstrate non-violent conflict resolution, peer mediation, tolerance, and democratic leadership in school',
            'Examine financial literacy, personal budgeting, savings culture, and dignified entrepreneurship',
            'Explain how regional and continental bodies (ECOWAS, EAC, SADC, AU) foster peace, mobility, and trade',
            'Evaluate effects of science, technology, and globalization on contemporary African societies',
          ],
          keywords: ['Citizenship', 'Human Rights', 'Peacebuilding', 'Financial Literacy', 'Regional Integration'],
          tlms: ['Civic Constitution handbook', 'Role-play debate cards', 'Social Studies / Civic Education Textbook'],
        },
      ],
    },
  ],

  early_years: [
    {
      strandNumber: 1,
      name: 'Foundational Literacy, Phonics, Numeracy & Discovery Play',
      subStrands: [
        {
          name: 'Sounds, Counting, Shapes, Colours & Everyday Exploration',
          standardSuffix: '1.1.1',
          standardTitle: 'Develop early oral communication, phonological awareness, number sense, and curiosity through play',
          indicators: [
            'Identify letter sounds, blend simple CVC words, and respond to picture storybooks through songs and rhymes',
            'Count, sort, match, and compare concrete objects (1–20) by size, shape, pattern, and colour',
            'Identify parts of the body, healthy hygiene habits (handwashing, brushing teeth), and safe play rules',
            'Express creativity through drawing, colouring, clay modelling, music, and movement games',
            'Demonstrate turn-taking, polite greetings, empathy, and teamwork during learning-centre activities',
          ],
          keywords: ['Phonics', 'Counting', 'Sorting', 'Storytelling', 'Play-Based Learning'],
          tlms: ['Alphabet & number flashcards', 'Counting beads/blocks', 'Picture storybooks & crayons'],
        },
      ],
    },
  ],
}

export function getCurriculumForSubject(
  subjectName: string,
  levelId?: SchoolLevelId,
): StrandTemplate[] {
  const lower = String(subjectName || '').toLowerCase()

  if (levelId === 'kg' && (lower.includes('literacy') || lower.includes('numeracy') || lower.includes('phonics') || lower.includes('world'))) {
    return CURRICULUM_BANK.early_years
  }
  if (lower.includes('further math') || lower.includes('elective math')) {
    return CURRICULUM_BANK.further_math
  }
  if (lower.includes('comput') || lower.includes('ict') || lower.includes('information') || lower.includes('data processing')) {
    return CURRICULUM_BANK.computing
  }
  if (lower.includes('math') || lower.includes('numeracy')) {
    return CURRICULUM_BANK.mathematics
  }
  if (lower.includes('physics') || lower.includes('physical science')) {
    return CURRICULUM_BANK.physics
  }
  if (lower.includes('chemistry')) {
    return CURRICULUM_BANK.chemistry
  }
  if (lower.includes('biology') || lower.includes('life science') || lower.includes('health science')) {
    return CURRICULUM_BANK.biology
  }
  if (lower.includes('agric') || lower.includes('husbandry') || lower.includes('horticulture') || lower.includes('fisheries')) {
    return CURRICULUM_BANK.agriculture
  }
  if (lower.includes('science')) {
    return CURRICULUM_BANK.science
  }
  if (lower.includes('literature')) {
    return CURRICULUM_BANK.literature
  }
  if (lower.includes('english') || lower.includes('literacy') || lower.includes('phonics')) {
    return CURRICULUM_BANK.english
  }
  if (lower.includes('econom') && !lower.includes('home')) {
    return CURRICULUM_BANK.economics
  }
  if (lower.includes('account') || lower.includes('costing')) {
    return CURRICULUM_BANK.accounting
  }
  if (
    lower.includes('business') ||
    lower.includes('commerce') ||
    lower.includes('entrepreneur') ||
    lower.includes('office') ||
    lower.includes('marketing') ||
    lower.includes('tourism')
  ) {
    return CURRICULUM_BANK.business
  }
  if (lower.includes('government')) {
    return CURRICULUM_BANK.government
  }
  if (lower.includes('geograph')) {
    return CURRICULUM_BANK.geography
  }
  if (lower.includes('history')) {
    return CURRICULUM_BANK.history
  }
  if (
    lower.includes('religio') ||
    lower.includes('crs') ||
    lower.includes('cre') ||
    lower.includes('irs') ||
    lower.includes('ire') ||
    lower.includes('moral')
  ) {
    return CURRICULUM_BANK.religious
  }
  if (
    lower.includes('french') ||
    lower.includes('arabic') ||
    lower.includes('swahili') ||
    lower.includes('portuguese') ||
    lower.includes('language')
  ) {
    return CURRICULUM_BANK.languages
  }
  if (
    lower.includes('art') ||
    lower.includes('design') ||
    lower.includes('food') ||
    lower.includes('nutrition') ||
    lower.includes('clothing') ||
    lower.includes('textile') ||
    lower.includes('living') ||
    lower.includes('home econ') ||
    lower.includes('technical') ||
    lower.includes('electric') ||
    lower.includes('building') ||
    lower.includes('mechanic') ||
    lower.includes('career') ||
    lower.includes('woodwork') ||
    lower.includes('metalwork')
  ) {
    return CURRICULUM_BANK.tvet
  }
  if (
    lower.includes('social') ||
    lower.includes('civic') ||
    lower.includes('life orientation') ||
    lower.includes('life skills') ||
    lower.includes('world') ||
    lower.includes('philosoph')
  ) {
    return CURRICULUM_BANK.social
  }

  const cleanTitle = String(subjectName || 'Subject').trim() || 'Subject'
  return [
    {
      strandNumber: 1,
      name: `Foundations & Core Concepts in ${cleanTitle}`,
      subStrands: [
        {
          name: `Principles, Terminology & Best Practices in ${cleanTitle}`,
          standardSuffix: '1.1.1',
          standardTitle: `Demonstrate foundational knowledge, terminology, and analytical skills in ${cleanTitle}`,
          indicators: [
            `Explain key concepts, terminology, and real-world relevance of ${cleanTitle}`,
            `Identify essential materials, instruments, and safety/quality standards in ${cleanTitle}`,
            `Classify core methods and principles applied in ${cleanTitle}`,
            `Demonstrate step-by-step foundational skills in ${cleanTitle} through guided tasks`,
            `Evaluate peer solutions using standard assessment criteria in ${cleanTitle}`,
          ],
          keywords: [cleanTitle, 'Foundations', 'Methodology', 'Practice', 'Assessment'],
          tlms: [`Approved ${cleanTitle} Syllabus & Textbook`, 'Visual charts & realia', 'Structured activity worksheets'],
        },
      ],
    },
    {
      strandNumber: 2,
      name: `Applied Skills, Problem Solving & Projects in ${cleanTitle}`,
      subStrands: [
        {
          name: `Practical Application & Collaborative Inquiry in ${cleanTitle}`,
          standardSuffix: '2.1.1',
          standardTitle: `Plan, execute, and evaluate practical tasks and real-world applications in ${cleanTitle}`,
          indicators: [
            `Analyze a practical scenario and design an appropriate ${cleanTitle} solution`,
            `Select suitable tools/data and apply structured procedures accurately`,
            `Collaborate in teams to complete an applied ${cleanTitle} investigation or project`,
            `Present findings clearly using appropriate technical register`,
            `Reflect on improvements and real-world African & global applications`,
          ],
          keywords: ['Application', 'Problem Solving', 'Collaboration', 'Presentation', 'Evaluation'],
          tlms: [`${cleanTitle} resource pack`, 'Assessment rubric sheet', 'Project display / presentation board'],
        },
      ],
    },
  ]
}

export function splitDurationPhases(durationText: string): {
  starter: string
  main: string
  reflection: string
} {
  const numMatch = /(\d+)/.exec(String(durationText || ''))
  const totalMins = numMatch ? Math.max(20, Number(numMatch[1])) : 55
  const starterMins = Math.max(5, Math.round((totalMins * 0.18) / 5) * 5)
  const reflectionMins = Math.max(5, Math.round((totalMins * 0.18) / 5) * 5)
  const mainMins = Math.max(10, totalMins - starterMins - reflectionMins)
  return {
    starter: `${starterMins} mins`,
    main: `${mainMins} mins`,
    reflection: `${reflectionMins} mins`,
  }
}

export function resolveFrameworkReference(
  frameworkId: CurriculumFrameworkId | undefined,
  levelId: SchoolLevelId,
): string {
  const effectiveId =
    frameworkId ?? (levelId === 'shs' ? 'waec-wassce' : 'universal-africa')
  const found = CURRICULUM_FRAMEWORKS.find((f) => f.id === effectiveId)
  return found?.referencePrefix ?? 'Pan-African Competency & National Curriculum'
}

export function generateWeeklyLessonNotes(params: {
  className: string
  levelId: SchoolLevelId
  subject: string
  strand: string
  subStrand: string
  contentStandard: string
  indicators: string[]
  duration: string
  days: string[]
  aiModel: 'free' | 'pro'
  curriculumFramework?: CurriculumFrameworkId
}): DailyLessonEntry[] {
  const {
    className,
    levelId,
    subject,
    strand,
    subStrand,
    contentStandard,
    indicators,
    duration,
    days,
    aiModel,
    curriculumFramework,
  } = params

  const activeDays = days.length > 0 ? days : ['Monday']
  const phases = splitDurationPhases(duration)
  const codePrefix = classCodeToken(className, levelId)
  const frameworkRef = resolveFrameworkReference(curriculumFramework, levelId)

  const strandBank = getCurriculumForSubject(subject, levelId)
  const matchedStrand = strandBank.find((s) => s.name === strand) ?? strandBank[0]
  const matchedSub =
    matchedStrand?.subStrands.find((ss) => ss.name === subStrand) ?? matchedStrand?.subStrands[0]

  const keywordsList = matchedSub?.keywords?.length
    ? matchedSub.keywords.join(', ')
    : `${subStrand}, ${strand}, ${subject}, Concept, Practice`
  const resourcesList = matchedSub?.tlms?.length
    ? matchedSub.tlms.join('; ')
    : `Approved ${subject} Syllabus & Textbook, Chart/Projector, Task Cards, Whiteboard`

  const chosenIndicators =
    indicators.length > 0
      ? indicators
      : [`${codePrefix}.1.1.1.1 Demonstrate understanding of ${subStrand}`]

  return activeDays.map((day, idx) => {
    const rawInd = chosenIndicators[idx % chosenIndicators.length]
    const codeMatch = /^([A-Z]+\d*(?:\.\d+)+)\s*(.*)$/i.exec(rawInd.trim())
    const indicatorCode = codeMatch ? codeMatch[1] : `${codePrefix}.1.1.1.${idx + 1}`
    const indicatorBody = codeMatch && codeMatch[2] ? codeMatch[2] : rawInd.trim()
    const cleanLower = indicatorBody.charAt(0).toLowerCase() + indicatorBody.slice(1)

    const performanceIndicator =
      aiModel === 'pro'
        ? `Learners can accurately ${cleanLower.replace(/\.$/, '')} and apply the concept independently to examination and real-world tasks with at least 80% mastery.`
        : `Learners can ${cleanLower.replace(/\.$/, '')} using appropriate examples.`

    const coreCompetencies =
      aiModel === 'pro'
        ? 'Critical Thinking & Problem Solving, Analytical & Scientific Inquiry, Communication & Collaboration, Digital Literacy, Global & Pan-African Citizenship'
        : 'Critical Thinking & Problem Solving, Communication & Collaboration, Digital Literacy'

    const references = `${frameworkRef} — ${subject} (${className}, ${contentStandard.split(' ')[0] || codePrefix}), Approved Textbook & Teacher's Guide`

    const starterActivities =
      aiModel === 'pro'
        ? `• Engage learners with a 3-minute "Think–Pair–Share" prompt connecting everyday African & global contexts to ${subStrand}.\n• Display real-life samples/diagrams and ask targeted diagnostic questions to activate relevant prior knowledge.\n• Present today's learning indicator (${indicatorCode}) and success criteria clearly on the board.`
        : `• Review learners' relevant previous knowledge on ${strand} through short oral questions and answers.\n• Show a visual aid/sample related to ${subStrand} and introduce today's lesson focus.`

    const mainActivities =
      aiModel === 'pro'
        ? `1. Concept Modelling & Guided Explanation:\n• Guide learners to explore "${indicatorBody}" step-by-step using structured demonstrations, worked examples, and realia.\n• Unpack key technical vocabulary (${keywordsList}) in context.\n\n2. Collaborative Group / Practical Activity:\n• Organize learners into mixed-ability groups of 4–5 to complete an applied problem-solving or practical task on ${subStrand}.\n• Provide scaffolded prompts for emerging learners and a higher-order extension question (WASSCE / Senior Secondary standard) for fast finishers.\n\n3. Formative Assessment Check:\n• Q1: Define and explain two core principles covered under "${indicatorBody}".\n• Q2: Solve/demonstrate an applied task connecting ${subStrand} to a real-life school, industry, or community scenario.\n• Q3: Complete the structured individual classwork exercise.`
        : `1. Teacher/Learner Demonstration:\n• Brainstorm with learners to explain "${indicatorBody}" under ${subStrand}.\n• Demonstrate the key steps clearly while learners observe, take notes, and ask questions.\n\n2. Group & Individual Practice:\n• Put learners in small groups to practice the concept and share findings with the class.\n\n3. Assessment:\n• Learners answer 3 structured written/practical questions on "${indicatorBody}".`

    const reflectionActivities =
      aiModel === 'pro'
        ? `• Conduct a "3-2-1 Exit Ticket": learners share 3 key takeaways, 2 real-life applications, and 1 question.\n• Review solutions against the performance indicator and address common examination/practical misconceptions.\n• Assign a targeted follow-up exercise preparing learners for the next lesson.`
        : `• Ask learners to summarize the main points learned in today's lesson in their own words.\n• Review classwork feedback and assign a short take-home practice activity.`

    return {
      day,
      lessonNumber: idx + 1,
      indicatorCode,
      indicatorText: `${indicatorCode} ${indicatorBody}`.trim(),
      performanceIndicator,
      coreCompetencies,
      references,
      keywords: keywordsList,
      starterDuration: phases.starter,
      starterActivities,
      mainDuration: phases.main,
      mainActivities,
      reflectionDuration: phases.reflection,
      reflectionActivities,
      resources: resourcesList,
    }
  })
}

export function serializeLessonNoteToRow(note: ParsedLessonNote): EduRow {
  return {
    id: note.id,
    schoolName: note.schoolName,
    teacher: note.teacher,
    level: note.level,
    className: note.className,
    subject: note.subject,
    strand: note.strand,
    subStrand: note.subStrand,
    contentStandard: note.contentStandard,
    indicators: JSON.stringify(note.indicators),
    term: note.term,
    week: note.week,
    weekEnding: note.weekEnding,
    duration: note.duration,
    classSize: note.classSize,
    aiModel: note.aiModel,
    curriculumFramework: note.curriculumFramework ?? 'universal-africa',
    days: JSON.stringify(note.days),
    dailyLessons: JSON.stringify(note.dailyLessons),
    status: note.status,
    submittedOn: note.submittedOn,
    reviewerComment: note.reviewerComment,
    reviewedBy: note.reviewedBy,
    createdAt: note.createdAt,
  }
}

export function parseLessonNoteRow(row: EduRow): ParsedLessonNote {
  const parseList = (raw?: string): string[] => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  let dailyLessons: DailyLessonEntry[] = []
  try {
    const parsed = JSON.parse(String(row.dailyLessons || '[]'))
    if (Array.isArray(parsed)) dailyLessons = parsed
  } catch {
    dailyLessons = []
  }

  const className = String(row.className || 'Basic 8 A')
  const levelId = inferLevelFromClassName(className)
  const level = String(
    row.level ||
      SCHOOL_LEVELS.find((l) => l.id === levelId)?.name ||
      'Junior Secondary / JHS',
  )
  const subject = String(row.subject || 'Computing')
  const strand = String(row.strand || 'Productivity Software & Database Management')
  const subStrand = String(row.subStrand || 'Introduction to Desktop Publishing')
  const contentStandard = String(
    row.contentStandard || 'B8.2.3.1 Demonstrate how to design publications using Desktop Publishing software',
  )
  const indicators = parseList(row.indicators)
  const days = parseList(row.days)
  const curriculumFramework = (row.curriculumFramework as CurriculumFrameworkId | undefined) ??
    (levelId === 'shs' ? 'waec-wassce' : 'universal-africa')

  if (dailyLessons.length === 0) {
    dailyLessons = generateWeeklyLessonNotes({
      className,
      levelId,
      subject,
      strand,
      subStrand,
      contentStandard,
      indicators,
      duration: String(row.duration || '55 minutes'),
      days: days.length ? days : ['Monday'],
      aiModel: row.aiModel === 'pro' ? 'pro' : 'free',
      curriculumFramework,
    })
  }

  const rawStatus = String(row.status || 'Draft')
  const status: ParsedLessonNote['status'] =
    rawStatus === 'Approved' || rawStatus === 'Pending' || rawStatus === 'Returned'
      ? rawStatus
      : 'Draft'

  return {
    id: String(row.id),
    schoolName: String(row.schoolName || 'Airport City Flagship'),
    teacher: String(row.teacher || ''),
    level,
    className,
    subject,
    strand,
    subStrand,
    contentStandard,
    indicators: indicators.length ? indicators : dailyLessons.map((d) => d.indicatorText),
    term: String(row.term || 'Term 1'),
    week: String(row.week || 'Week 5'),
    weekEnding: String(row.weekEnding || '2026-10-30'),
    duration: String(row.duration || '55 minutes'),
    classSize: String(row.classSize || '30'),
    aiModel: row.aiModel === 'pro' ? 'pro' : 'free',
    curriculumFramework,
    days: days.length ? days : dailyLessons.map((d) => d.day),
    dailyLessons,
    status,
    submittedOn: String(row.submittedOn || ''),
    reviewerComment: String(row.reviewerComment || ''),
    reviewedBy: String(row.reviewedBy || ''),
    createdAt: String(row.createdAt || '2026-10-29'),
  }
}

/**
 * Lesson Plan Curriculum Engine
 * Re-exports the shared African curriculum engine from lessonNoteCurriculum
 * and adds lesson-plan-specific generators (single lesson, not weekly).
 */
export {
  CURRICULUM_FRAMEWORKS,
  SCHOOL_LEVELS,
  SHS_PROGRAMMES,
  SUBJECT_CATEGORIES,
  SUBJECT_CATALOGUE,
  TEACHING_DAYS,
  DEFAULT_SUBJECTS,
  getSubjectsForLevel,
  getSubjectsForProgramme,
  getSubjectDefinition,
  getProgrammeOption,
  inferSubjectCategory,
  inferLevelFromClassName,
  classCodeToken,
  getCurriculumForSubject,
  type SchoolLevelId,
  type SubjectCategoryId,
  type ShsProgrammeId,
  type CurriculumFrameworkId,
  type SubjectDefinition,
  type ShsProgrammeOption,
  type SchoolLevelOption,
  type CurriculumFrameworkOption,
  type StrandTemplate,
  type SubStrandTemplate,
} from '../lesson-note/lessonNoteCurriculum'

import type { EduRow } from '../../../../lib/eduRecords'
import {
  SCHOOL_LEVELS,
  getCurriculumForSubject,
  classCodeToken,
} from '../lesson-note/lessonNoteCurriculum'

export interface LessonPlanObjective {
  id: string
  text: string
  /** Bloom's taxonomy level for the objective. */
  domain: 'Knowledge' | 'Comprehension' | 'Application' | 'Analysis' | 'Synthesis' | 'Evaluation'
}

export interface LessonPlanSection {
  title: string
  duration: string
  content: string
  teacherActivity: string
  studentActivity: string
  resources: string
}

export interface ParsedLessonPlan {
  id: string
  schoolName: string
  teacher: string
  level: string
  className: string
  subject: string
  strand: string
  subStrand: string
  contentStandard: string
  objectives: LessonPlanObjective[]
  /** The main lesson topic / title. */
  topic: string
  /** Structured lesson plan sections (Introduction, Development, Assessment, Conclusion). */
  sections: LessonPlanSection[]
  /** Homework / assignment text. */
  homework: string
  /** Reference materials. */
  references: string
  /** Keywords / vocabulary. */
  keywords: string
  duration: string
  classSize: string
  term: string
  week: string
  weekEnding: string
  aiModel: 'free' | 'pro'
  curriculumFramework: string
  status: 'Draft' | 'Pending' | 'Approved' | 'Returned'
  submittedOn: string
  reviewerComment: string
  reviewedBy: string
  createdAt: string
}

export interface LessonPlanRow extends EduRow {}

/**
 * Generate a structured lesson plan (single lesson, not weekly) from the
 * selected curriculum strand / sub-strand and learning indicators.
 */
export function generateLessonPlan(params: {
  schoolName: string
  teacher: string
  className: string
  levelId: string
  subject: string
  strand: string
  subStrand: string
  contentStandard: string
  indicators: string[]
  topic: string
  duration: string
  classSize: string
  term: string
  week: string
  weekEnding: string
  aiModel: 'free' | 'pro'
  curriculumFramework: string
}): ParsedLessonPlan {
  const {
    schoolName,
    teacher,
    className,
    levelId,
    subject,
    strand,
    subStrand,
    contentStandard,
    indicators,
    topic,
    duration,
    classSize,
    term,
    week,
    weekEnding,
    aiModel,
    curriculumFramework,
  } = params

  const levelLabel =
    SCHOOL_LEVELS.find((l) => l.id === levelId)?.name ||
    'Senior High / Senior Secondary (SHS / SSS)'

  const codePrefix = classCodeToken(className, levelId as never)

  // Derive objectives from indicators (up to 4)
  const objectives: LessonPlanObjective[] = indicators.slice(0, 4).map((ind, idx) => ({
    id: `obj-${idx + 1}`,
    text: ind,
    domain:
      idx === 0
        ? 'Knowledge'
        : idx === 1
          ? 'Comprehension'
          : idx === 2
            ? 'Application'
            : 'Analysis',
  }))

  // Split duration into phases
  const mins = parseInt(duration) || 55
  const introMins = Math.round(mins * 0.15)
  const devMins = Math.round(mins * 0.55)
  const assessMins = Math.round(mins * 0.15)
  const concMins = Math.round(mins * 0.15)

  const sections: LessonPlanSection[] = [
    {
      title: 'Introduction / Starter',
      duration: `${introMins} min`,
      content: `Set the stage for ${subject} — ${subStrand}. Activate prior knowledge and hook students with a relatable scenario.`,
      teacherActivity: `Introduce the topic "${topic}". Ask diagnostic questions about ${subStrand.toLowerCase()}. Share the lesson objectives and success criteria.`,
      studentActivity: 'Respond to warm-up questions. Share prior knowledge. Listen to the lesson objectives.',
      resources: `${subStrand} concept chart, ${subject} textbook, whiteboard/marker`,
    },
    {
      title: 'Main Activity / Development',
      duration: `${devMins} min`,
      content: `Core teaching and learning for ${subStrand}. ${indicators.slice(0, 3).join('. ')}`,
      teacherActivity: `Explain key concepts. Model step-by-step. Facilitate group work and guided practice. circulate to provide feedback.`,
      studentActivity: 'Take notes. Work in pairs/groups on guided tasks. Complete practice exercises. Ask questions.',
      resources: `${subject} learner's book, worksheets, group task cards, textbook pages on ${subStrand}`,
    },
    {
      title: 'Assessment / Checking',
      duration: `${assessMins} min`,
      content: `Formative assessment to check understanding of ${subStrand}. Verify that indicators have been met.`,
      teacherActivity: `Administer a quick quiz / oral questioning. Mark responses. Provide immediate feedback. Identify students needing reinforcement.`,
      studentActivity: 'Complete a short quiz or answer oral questions. Self-assess against success criteria.',
      resources: `Quick quiz worksheet, exit ticket, answer key`,
    },
    {
      title: 'Conclusion / Reflection',
      duration: `${concMins} min`,
      content: `Wrap up the lesson. Reinforce key takeaways. Set up homework.`,
      teacherActivity: `Summarize key points. Restate the content standard. Assign homework. Ask "what did we learn today?"`,
      studentActivity: 'Recap key points. Note homework. Reflect on own understanding.',
      resources: 'Summary board, homework assignment sheet',
    },
  ]

  // Homework derived from last indicator
  const lastInd = indicators[indicators.length - 1] || `Demonstrate mastery of ${subStrand}`
  const homework = `Complete the assigned practice exercise on ${subStrand}: ${lastInd}. Submit at the start of the next lesson.`

  // References
  const references = `${curriculumFramework} Syllabus · ${subject} Learner's Book & Teacher's Guide · ${subStrand} chapter`

  // Keywords
  const keywords = `${subStrand}, ${strand}, ${indicators[0]?.split(' ').slice(0, 3).join(', ') || 'Key concepts'}`

  return {
    id: '', // set by caller
    schoolName,
    teacher,
    level: levelLabel,
    className,
    subject,
    strand,
    subStrand,
    contentStandard,
    objectives,
    topic,
    sections,
    homework,
    references,
    keywords,
    duration,
    classSize,
    term,
    week,
    weekEnding,
    aiModel,
    curriculumFramework,
    status: 'Draft',
    submittedOn: '',
    reviewerComment: '',
    reviewedBy: '',
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

/** Serialize a ParsedLessonPlan to an EduRow for persistence. */
export function serializeLessonPlanToRow(plan: ParsedLessonPlan): LessonPlanRow {
  return {
    id: plan.id,
    teacher: plan.teacher,
    subject: plan.subject,
    className: plan.className,
    week: plan.week,
    weekEnding: plan.weekEnding,
    topic: plan.topic,
    strand: plan.strand,
    subStrand: plan.subStrand,
    contentStandard: plan.contentStandard,
    objectives: JSON.stringify(plan.objectives),
    sections: JSON.stringify(plan.sections),
    homework: plan.homework,
    references: plan.references,
    keywords: plan.keywords,
    duration: plan.duration,
    classSize: plan.classSize,
    term: plan.term,
    level: plan.level,
    aiModel: plan.aiModel,
    curriculumFramework: plan.curriculumFramework,
    status: plan.status,
    submittedOn: plan.submittedOn,
    reviewerComment: plan.reviewerComment,
    reviewedBy: plan.reviewedBy,
    createdAt: plan.createdAt,
    schoolName: plan.schoolName,
  } as LessonPlanRow
}

/** Parse an EduRow back into a ParsedLessonPlan. */
export function parseLessonPlanRow(row: LessonPlanRow): ParsedLessonPlan {
  let objectives: LessonPlanObjective[] = []
  let sections: LessonPlanSection[] = []
  try {
    objectives = JSON.parse(String(row.objectives ?? '[]'))
  } catch {
    objectives = []
  }
  try {
    sections = JSON.parse(String(row.sections ?? '[]'))
  } catch {
    sections = []
  }

  return {
    id: String(row.id ?? ''),
    schoolName: String(row.schoolName ?? ''),
    teacher: String(row.teacher ?? ''),
    level: String(row.level ?? ''),
    className: String(row.className ?? ''),
    subject: String(row.subject ?? ''),
    strand: String(row.strand ?? ''),
    subStrand: String(row.subStrand ?? ''),
    contentStandard: String(row.contentStandard ?? ''),
    objectives,
    topic: String(row.topic ?? ''),
    sections,
    homework: String(row.homework ?? ''),
    references: String(row.references ?? ''),
    keywords: String(row.keywords ?? ''),
    duration: String(row.duration ?? ''),
    classSize: String(row.classSize ?? ''),
    term: String(row.term ?? ''),
    week: String(row.week ?? ''),
    weekEnding: String(row.weekEnding ?? ''),
    aiModel: (row.aiModel as 'free' | 'pro') || 'pro',
    curriculumFramework: String(row.curriculumFramework ?? ''),
    status: (row.status as ParsedLessonPlan['status']) || 'Draft',
    submittedOn: String(row.submittedOn ?? ''),
    reviewerComment: String(row.reviewerComment ?? ''),
    reviewedBy: String(row.reviewedBy ?? ''),
    createdAt: String(row.createdAt ?? ''),
  }
}

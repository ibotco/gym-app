import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  BookText,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  GraduationCap,
  Library,
  School,
  Users,
} from 'lucide-react'
import { Badge, PageHeader, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { loadEduRecords, type EduRecords } from '../../../lib/eduRecords'
import { useTeacherAccess } from '../../../lib/eduTeacherAccess'

const todayIso = () => new Date().toISOString().slice(0, 10)

export function TeacherWorkspaceOverview() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId))
  }, [activeBranchId])

  const scope = useTeacherAccess(records)

  const activeYear = useMemo(() => {
    const years = records.academicYear ?? []
    const found = years.find((y) => String(y.status ?? '').toLowerCase() === 'active') ?? years[0]
    return String(found?.name ?? '2026/2027')
  }, [records.academicYear])

  const activeTerm = useMemo(() => {
    const terms = records.termSemester ?? []
    const found = terms.find((t) => String(t.status ?? '').toLowerCase() === 'active') ?? terms[0]
    return String(found?.name ?? 'Term 1')
  }, [records.termSemester])

  const myStudents = useMemo(
    () =>
      scope
        .filterLeafRows('studentList', records.studentList ?? [])
        .filter((s) => (s.status || 'Active') === 'Active'),
    [scope, records.studentList],
  )

  const myAttendance = useMemo(
    () => scope.filterLeafRows('studentAttendance', records.studentAttendance ?? []),
    [scope, records.studentAttendance],
  )

  const presentToday = useMemo(
    () => myAttendance.filter((a) => a.date === todayIso() && a.status !== 'Absent').length,
    [myAttendance],
  )

  const myLessonPlans = useMemo(
    () => scope.filterLeafRows('lessonPlans', records.lessonPlans ?? []),
    [scope, records.lessonPlans],
  )

  const myLessonNotes = useMemo(
    () => scope.filterLeafRows('lessonNotes', records.lessonNotes ?? []),
    [scope, records.lessonNotes],
  )

  const myAssessments = useMemo(
    () => scope.filterLeafRows('continuousAssessment', records.continuousAssessments ?? []),
    [scope, records.continuousAssessments],
  )

  const classAssignmentRows = useMemo(() => {
    return scope.assignedPairs.map((pair) => {
      const classRow = (records.classList ?? []).find(
        (c) =>
          String(c.name ?? '').trim().toLowerCase() === pair.baseClass.toLowerCase() &&
          (!pair.section ||
            String(c.section ?? '').trim().toLowerCase() === pair.section.toLowerCase()),
      )
      const room = String(classRow?.room ?? '').trim()
      const isHomeroom = scope.matchesHomeroomClassSection(pair.baseClass, pair.section)
      const subjects = scope.subjectsForClassSection(pair.baseClass, pair.section)
      const studentsCount = myStudents.filter((s) =>
        scope.matchesClassSection(pair.baseClass, pair.section)
          ? String(s.className ?? '').trim().toLowerCase() === pair.fullLabel.toLowerCase() ||
            (String(s.className ?? '').trim().toLowerCase() === pair.baseClass.toLowerCase() &&
              String(s.section ?? '').replace(/^section\s+/i, '').trim().toLowerCase() ===
                pair.section.toLowerCase())
          : false,
      ).length
      return {
        ...pair,
        room,
        isHomeroom,
        subjects,
        studentsCount,
      }
    })
  }, [scope, records.classList, myStudents])

  const quickModules = [
    {
      to: '/admin/education-management/examinations/continuous-assessment',
      icon: ClipboardCheck,
      title: 'Continuous Assessment',
      desc: 'Create & score SBA activities and Class Assessment Sheets for your assigned classes and subjects.',
      stat: `${myAssessments.length} assessment${myAssessments.length === 1 ? '' : 's'}`,
    },
    {
      to: '/admin/education-management/examinations/mark-entries',
      icon: FileSpreadsheet,
      title: 'Mark Entries',
      desc: 'Enter Class Score and Examination marks synced with Continuous Assessment for your subjects.',
      stat: scope.assignedSubjects.join(', ') || 'Assigned subjects',
    },
    {
      to: '/admin/education-management/lesson-plan/lesson-plans',
      icon: BookOpen,
      title: 'Lesson Plans',
      desc: 'Prepare weekly topics, submit lesson plans for approval, and track approval status.',
      stat: `${myLessonPlans.length} plan${myLessonPlans.length === 1 ? '' : 's'}`,
    },
    {
      to: '/admin/education-management/lesson-note/generate',
      icon: BookText,
      title: 'Lesson Notes',
      desc: 'Generate structured weekly lesson notes (WAEC / WASSCE & Pan-African curricula), customize activities, and export PDF or DOCX.',
      stat: `${myLessonNotes.length} note${myLessonNotes.length === 1 ? '' : 's'}`,
    },
    {
      to: '/admin/education-management/timetable/teacher-timetable',
      icon: CalendarDays,
      title: 'My Timetable',
      desc: 'View and print your weekly teaching periods, assigned classrooms, and class timetables.',
      stat: `${scope.assignedClassLabels.length} class${scope.assignedClassLabels.length === 1 ? '' : 'es'}`,
    },
    {
      to: '/admin/education-management/attendance/student-attendance',
      icon: CalendarCheck,
      title: 'Student Attendance',
      desc: 'Mark daily class registers (Present, Late, Absent, Excused) and review class attendance logs.',
      stat: `${presentToday} marked today`,
    },
    {
      to: '/admin/education-management/online-examinations/homework',
      icon: ClipboardList,
      title: 'Homework & Online Exams',
      desc: 'Publish class homework, manage question banks, and schedule online quizzes for your subjects.',
      stat: 'Assignments & quizzes',
    },
    {
      to: '/admin/education-management/students/student-list',
      icon: Users,
      title: 'My Students & Parents',
      desc: 'Access student roll lists, guardian contacts, and class prefects for your assigned classes.',
      stat: `${myStudents.length} active student${myStudents.length === 1 ? '' : 's'}`,
    },
    {
      to: '/admin/education-management/examinations/exam-schedule',
      icon: FileCheck2,
      title: 'Exam Schedule & Results',
      desc: 'Check examination timetables, grading scales, and terminal results for your classes.',
      stat: `${activeTerm} · ${activeYear}`,
    },
    {
      to: '/admin/education-management/library/books',
      icon: Library,
      title: 'Library & Resources',
      desc: 'Browse the school book catalogue and submit textbook or reference requests.',
      stat: `${(records.books ?? []).length} title${(records.books ?? []).length === 1 ? '' : 's'}`,
    },
  ]

  return (
    <div className="fade-up space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-mist">
          <span>Teacher Workspace</span>
          <span>/</span>
          <span className="font-semibold text-inherit">Overview</span>
        </div>
        <PageHeader
          title={`Welcome, ${scope.teacherName || 'Teacher'}`}
          desc={`${scope.designation || 'Teacher'}${scope.employeeNumber ? ` (${scope.employeeNumber})` : ''} · ${branchName ?? 'Branch'} · ${activeYear} — ${activeTerm}`}
        />
      </div>

      {/* Teacher Scope Summary Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 dark:bg-emerald-500/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Your Assigned Teaching Scope
              </p>
              <p className="text-xs text-mist">
                All menus, registers, assessments, and mark sheets are automatically scoped to your assigned classes and subjects.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scope.homeroomClassLabels.length > 0 && (
              <Badge tone="lime">
                Class Teacher: {scope.homeroomClassLabels.join(', ')}
              </Badge>
            )}
            <Badge tone="sky">
              Classes: {scope.assignedClassLabels.length ? scope.assignedClassLabels.join(', ') : 'None assigned yet'}
            </Badge>
            <Badge tone="amber">
              Subjects: {scope.assignedSubjects.length ? scope.assignedSubjects.join(', ') : 'Class Subjects'}
            </Badge>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<School className="size-4" />}
          label="Assigned Classes"
          value={String(scope.assignedClassLabels.length)}
          hint={scope.assignedClassLabels.join(', ') || 'No classes assigned'}
        />
        <StatCard
          icon={<BookOpen className="size-4" />}
          label="Assigned Subjects"
          value={String(scope.assignedSubjects.length)}
          hint={scope.assignedSubjects.join(', ') || 'Homeroom subjects'}
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="My Students"
          value={String(myStudents.length)}
          hint="Active students across your classes"
        />
        <StatCard
          icon={<CalendarCheck className="size-4" />}
          label="Marked Present Today"
          value={String(presentToday)}
          hint={`${myLessonPlans.length} lesson plan${myLessonPlans.length === 1 ? '' : 's'} on file`}
        />
      </div>

      {/* Assigned Classes & Subjects Matrix */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-extrabold">My Assigned Classes &amp; Subjects</h2>
            <p className="text-xs text-mist">
              Quick-launch Continuous Assessment, Mark Entries, Attendance, Timetable, or Lesson Plans for any assigned class.
            </p>
          </div>
          <Link
            to="/admin/education-management/timetable/teacher-timetable"
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-lime hover:text-lime-ink dark:hover:text-lime"
          >
            Open My Timetable →
          </Link>
        </div>

        {classAssignmentRows.length === 0 ? (
          <div className="p-6 text-center text-sm text-mist">
            No classes or subjects have been assigned to <strong>{scope.teacherName}</strong> yet. Ask the school administrator to assign your classes under <em>Assign Class Teacher</em> or <em>Assign Subject Teacher</em>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-4 py-2.5">Class &amp; Section</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Assigned Subject(s)</th>
                  <th className="px-4 py-2.5">Room</th>
                  <th className="px-4 py-2.5 text-center">Students</th>
                  <th className="px-4 py-2.5 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {classAssignmentRows.map((row) => (
                  <tr
                    key={row.fullLabel}
                    className="border-b border-line/60 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {row.fullLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.isHomeroom && <Badge tone="lime">Class Teacher</Badge>}
                        {row.subjects.length > 0 && <Badge tone="sky">Subject Teacher</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.subjects.map((sub) => (
                            <span
                              key={sub}
                              className="rounded-md border border-line bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold dark:bg-white/[0.06]"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-mist">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-mist">{row.room || '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold">{row.studentsCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link
                          to="/admin/education-management/examinations/continuous-assessment"
                          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          CA
                        </Link>
                        <Link
                          to="/admin/education-management/examinations/mark-entries"
                          className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
                        >
                          Marks
                        </Link>
                        <Link
                          to="/admin/education-management/attendance/student-attendance"
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
                        >
                          Attendance
                        </Link>
                        <Link
                          to="/admin/education-management/lesson-plan/lesson-plans"
                          className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold transition hover:border-lime"
                        >
                          Lesson Plan
                        </Link>
                        <Link
                          to="/admin/education-management/lesson-note/generate"
                          className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-500/20 dark:text-indigo-300"
                        >
                          Lesson Note
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Teacher Quick Access Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickModules.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="card group flex flex-col justify-between p-4 transition hover:border-lime/60"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 transition group-hover:scale-105 dark:text-lime">
                  <m.icon className="size-5" />
                </span>
                <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-mist dark:bg-white/[0.06]">
                  {m.stat}
                </span>
              </div>
              <p className="mt-3 font-extrabold group-hover:text-green-700 dark:group-hover:text-lime">
                {m.title}
              </p>
              <p className="mt-1 text-[12px] text-mist">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

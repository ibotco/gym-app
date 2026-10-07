import { useEffect, useState } from 'react'
import { GraduationCap, School, BookOpen, Users, ContactRound, CalendarCheck, Wallet } from 'lucide-react'
import { PageHeader, StatCard } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { loadEduRecords, type EduRecords } from '../../lib/eduRecords'

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Education Management — Overview.
 * Stats are computed live from this branch's submenu records (Student List,
 * Staff, Attendance, Outstanding Fees), so the dashboard always matches what
 * the menus show.
 */
export function EducationManagement() {
  const { activeBranchId, branches } = useApp()
  const branchName = branches.find((b) => b.id === activeBranchId)?.name
  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId))

  // Branch-related: overview follows the active branch.
  useEffect(() => { setRecords(loadEduRecords(activeBranchId)) }, [activeBranchId])

  const students = records['studentList'] ?? []
  const staff = records['staffList'] ?? []
  const attendance = records['studentAttendance'] ?? []
  const outstanding = records['outstandingFees'] ?? []

  const activeStudents = students.filter((s) => (s.status || 'Active') === 'Active').length
  const teachers = staff.filter(
    (s) => (s.designation ?? '').toLowerCase().includes('teacher') && (s.status || 'Active') === 'Active',
  ).length
  const presentToday = attendance.filter((a) => a.date === todayIso() && a.status !== 'Absent').length
  const unpaidTotal = outstanding.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span className="font-semibold text-inherit">Education Management</span>
        <span>/</span><span className="font-semibold text-inherit">Overview</span>
      </div>
      <PageHeader title="Education Management" desc={`${branchName ?? 'Branch'} · Manage schools, colleges and learning programs from one place.`} />

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users className="size-4" />} label="Active Students" value={String(activeStudents)} hint={`${students.length} on roll`} />
          <StatCard icon={<ContactRound className="size-4" />} label="Teachers" value={String(teachers)} hint={`${staff.length} staff total`} />
          <StatCard icon={<CalendarCheck className="size-4" />} label="Marked Present Today" value={String(presentToday)} />
          <StatCard icon={<Wallet className="size-4" />} label="Outstanding Fees" value={unpaidTotal.toLocaleString()} hint={`${outstanding.length} unpaid invoice${outstanding.length === 1 ? '' : 's'}`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { icon: School, title: 'School Management', desc: 'Students, classes, timetable, fees, report cards and parent communication.' },
            { icon: GraduationCap, title: 'College Management', desc: 'Faculties, courses & credits, admissions, semester billing and transcripts.' },
            { icon: BookOpen, title: 'Learning & Library', desc: 'Courses, e-learning content, library catalogue and issue tracking.' },
          ].map((a) => (
            <div key={a.title} className="card flex flex-col p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime"><a.icon className="size-5" /></span>
              <p className="mt-3 font-extrabold">{a.title}</p>
              <p className="mt-1 flex-1 text-[12px] text-mist">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

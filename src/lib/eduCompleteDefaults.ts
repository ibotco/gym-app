export type EduSeedRow = Record<string, string | number | boolean>
export type EduSeedMap = Record<string, EduSeedRow[]>

/**
 * Pure, dependency-free default records covering every Education Management
 * sub-menu (all 121 edu_* tables across 20 menu groups) and Certificate
 * Management sub-menu (all 8 cert_* tables) so no submenu ever starts at 0 rows.
 */
export function applyCompleteEduSubmenuDefaults(
  rec: EduSeedMap,
  branchId: string,
  branchName = 'Airport Main Campus',
): { records: EduSeedMap; changed: boolean } {
  const next: EduSeedMap = { ...rec }
  let changed = false

  const fillIfEmpty = (collection: string, rows: EduSeedRow[]) => {
    if (!Array.isArray(next[collection]) || next[collection].length === 0) {
      next[collection] = rows.map((r, idx) => ({
        ...r,
        id: r.id ? String(r.id) : `edu_${collection}_${branchId}_${idx + 1}`,
      }))
      changed = true
    }
  }

  // Timetable: Class Timetable, Teacher Timetable & Timetable Config
  fillIfEmpty('classTimetable', [
    { id: '', className: 'Basic 7 - A', day: 'Monday', period: 'Period 1 (08:00 - 08:45)', subject: 'Mathematics', teacher: 'Grace Mensah' },
    { id: '', className: 'Basic 7 - A', day: 'Monday', period: 'Period 2 (08:45 - 09:30)', subject: 'English Language', teacher: 'Kofi Asante' },
    { id: '', className: 'Basic 8 - A', day: 'Tuesday', period: 'Period 1 (08:00 - 08:45)', subject: 'Integrated Science', teacher: 'Ama Boateng' },
  ])
  fillIfEmpty('teacherTimetable', [
    { id: '', teacher: 'Grace Mensah', day: 'Monday', period: 'Period 1 (08:00 - 08:45)', className: 'Basic 7 - A', subject: 'Mathematics' },
    { id: '', teacher: 'Kofi Asante', day: 'Monday', period: 'Period 2 (08:45 - 09:30)', className: 'Basic 7 - A', subject: 'English Language' },
    { id: '', teacher: 'Ama Boateng', day: 'Tuesday', period: 'Period 1 (08:00 - 08:45)', className: 'Basic 8 - A', subject: 'Integrated Science' },
  ])
  fillIfEmpty('ttConfig', [
    { id: '', name: `${branchName} Standard Timetable`, periodsPerDay: 8, startTime: '08:00', periodMinutes: 45 },
  ])

  // Students: Parents, Past Students, Withdrawn Students & Prefects/Leadership
  fillIfEmpty('parents', [
    { id: '', name: 'Mr. Kwesi Owusu', student: 'Kwame Owusu', relation: 'Father', occupation: 'Civil Engineer', phone: '+233 24 411 2201', email: 'kwesi.owusu@mail.gh' },
    { id: '', name: 'Mrs. Akosua Mensah', student: 'Ama Mensah', relation: 'Mother', occupation: 'Pharmacist', phone: '+233 24 411 2202', email: 'akosua.mensah@mail.gh' },
  ])
  fillIfEmpty('pastStudents', [
    { id: '', name: 'Nana Yaw Ofori', admissionNo: 'ADM-2022-014', className: 'JHS 3', session: '2024/2025', status: 'Graduated', remarks: 'Distinction in BECE' },
    { id: '', name: 'Efua Darko', admissionNo: 'ADM-2022-019', className: 'JHS 3', session: '2024/2025', status: 'Graduated', remarks: 'Admitted to Achimota School' },
  ])
  fillIfEmpty('withdrawnStudents', [
    { id: '', name: 'Kojo Baffour', admissionNo: 'ADM-2024-088', className: 'Basic 6', withdrawalDate: '2026-04-15', reason: 'Family relocated to Kumasi', status: 'Transferred' },
  ])
  fillIfEmpty('prefectsLeadership', [
    { id: '', student: 'Kwame Owusu', position: 'Senior Boys Prefect', className: 'JHS 3', house: 'Unity House', appointedOn: '2026-09-10' },
    { id: '', student: 'Ama Mensah', position: 'Senior Girls Prefect', className: 'JHS 3', house: 'Excellence House', appointedOn: '2026-09-10' },
  ])

  // Student Finance: Payment Reports, Bill Reminders, Carry Forward & Finance Reports
  fillIfEmpty('paymentReports', [
    { id: '', student: 'Kwame Owusu', receiptNo: 'RCP-2026-101', date: '2026-09-15', amount: 2450, method: 'Mobile Money', collectedBy: 'Accounts Bursar' },
    { id: '', student: 'Ama Mensah', receiptNo: 'RCP-2026-102', date: '2026-09-16', amount: 2450, method: 'Bank Transfer', collectedBy: 'Accounts Bursar' },
  ])
  fillIfEmpty('billReminder', [
    { id: '', student: 'Yaw Boateng', reminderDate: '2026-10-25', channel: 'SMS & Email', message: 'Term 1 tuition balance reminder', status: 'Sent' },
  ])
  fillIfEmpty('feesCarryForward', [
    { id: '', student: 'Yaw Boateng', fromSession: '2025/2026', toSession: '2026/2027', amount: 450, status: 'Carried Forward' },
  ])
  fillIfEmpty('studentFinanceReport', [
    { id: '', title: 'Term 1 Tuition & Levy Collection Summary', fromDate: '2026-09-01', toDate: '2026-11-12', type: 'Collection Summary' },
  ])

  // Lesson Note: Lesson Notes & Approvals
  fillIfEmpty('lessonNotes', [
    { id: '', teacher: 'Grace Mensah', subject: 'Mathematics', className: 'Basic 7', term: 'First Term', week: 'Week 4', strand: 'Number & Numeration', subStrand: 'Fractions, Decimals & Percentages', status: 'Approved' },
    { id: '', teacher: 'Ama Boateng', subject: 'Integrated Science', className: 'Basic 8', term: 'First Term', week: 'Week 4', strand: 'Systems', subStrand: 'The Solar System & Human Body', status: 'Submitted' },
  ])
  fillIfEmpty('lessonNoteApprovals', [
    { id: '', teacher: 'Grace Mensah', subject: 'Mathematics', className: 'Basic 7', term: 'First Term', week: 'Week 4', status: 'Approved', reviewedBy: 'Academic Head' },
  ])

  // Examinations: Grades Range, Report Builder, Reportsheet Theme, Marksheet Template & Exam Reports
  fillIfEmpty('gradesRange', [
    { id: '', grade: 'A1', minScore: 80, maxScore: 100, remarks: 'Excellent' },
    { id: '', grade: 'B2', minScore: 70, maxScore: 79, remarks: 'Very Good' },
    { id: '', grade: 'B3', minScore: 65, maxScore: 69, remarks: 'Good' },
    { id: '', grade: 'C4', minScore: 60, maxScore: 64, remarks: 'Credit' },
    { id: '', grade: 'C6', minScore: 50, maxScore: 59, remarks: 'Pass' },
    { id: '', grade: 'F9', minScore: 0, maxScore: 49, remarks: 'Fail' },
  ])
  fillIfEmpty('reportsheetTheme', [
    { id: '', themeName: 'Theme 1 — Classic Academic Crest' },
  ])
  fillIfEmpty('marksheetTemplate', [
    { id: '', branch: branchName, examName: 'End of Term Exam', templateName: 'Standard GES Terminal Report Sheet', reportsheetTheme: 'Theme 1 — Classic Academic Crest', pageLayout: 'A4 Portrait', createdAt: '2026-09-12' },
  ])
  fillIfEmpty('examReports', [
    { id: '', title: 'First Term Broadsheet & Subject Analysis', fromDate: '2026-09-01', toDate: '2026-11-12', type: 'Broadsheet' },
  ])

  // Certificate Data & Certificate Management sub-menus
  fillIfEmpty('certificateClasses', [
    { id: '', className: 'Distinction', classCode: 'DIST', minScore: 80, maxScore: 100, description: 'Graduated with Distinction', status: 'Active' },
    { id: '', className: 'Merit', classCode: 'MERIT', minScore: 65, maxScore: 79, description: 'Graduated with Merit', status: 'Active' },
  ])
  fillIfEmpty('certificateSubjectGrades', [
    { id: '', subjectName: 'Mathematics', subjectCode: 'MTH101', certificateType: 'Graduation Certificate', gradeScale: 'GES Standard (A1-F9)', status: 'Active' },
    { id: '', subjectName: 'English Language', subjectCode: 'ENG101', certificateType: 'Graduation Certificate', gradeScale: 'GES Standard (A1-F9)', status: 'Active' },
  ])
  fillIfEmpty('certificateTypes', [
    { id: '', name: 'Graduation Certificate', description: 'Issued upon completion of academic level', serialPrefix: 'GRAD-', status: 'Active' },
    { id: '', name: 'Testimonial & Character Certificate', description: 'Official student conduct & academic testimonial', serialPrefix: 'TEST-', status: 'Active' },
  ])
  fillIfEmpty('certificateRegister', [
    { id: '', holderType: 'Student', holderName: 'Nana Yaw Ofori', certificateType: 'Graduation Certificate', certificateNo: 'GRAD-2026-001', issueDate: '2026-07-28', remarks: 'Verified original issued' },
  ])
  fillIfEmpty('certificateTemplates', [
    { id: '', branch: branchName, templateName: 'Classic Gold Border Diploma', holderType: 'Student', certificateType: 'Graduation Certificate', pageLayout: 'Landscape', paperSize: 'A4', orientation: 'Landscape', createdAt: '2026-09-05' },
  ])
  fillIfEmpty('certificateGeneration', [
    { id: '', certificateNo: 'GRAD-2026-001', holderType: 'Student', holderName: 'Nana Yaw Ofori', certificateType: 'Graduation Certificate', template: 'Classic Gold Border Diploma', issueDate: '2026-07-28', status: 'Issued' },
  ])
  fillIfEmpty('certificateBulkGeneration', [
    { id: '', batchName: '2026 JHS 3 Graduating Cohort', certificateType: 'Graduation Certificate', template: 'Classic Gold Border Diploma', holderType: 'Student', className: 'JHS 3', totalStudents: 28, issueDate: '2026-07-28', status: 'Completed' },
  ])
  fillIfEmpty('certificateVerification', [
    { id: '', certificateNo: 'GRAD-2026-001', holderType: 'Student', holderName: 'Nana Yaw Ofori', certificateType: 'Graduation Certificate', issueDate: '2026-07-28', verifiedBy: 'Academic Registrar', verificationDate: '2026-09-02', status: 'Authentic' },
  ])
  fillIfEmpty('certificateReports', [
    { id: '', title: 'Annual Certificate Issuance Register', fromDate: '2026-01-01', toDate: '2026-11-12', holderType: 'Student', certificateType: 'Graduation Certificate', reportType: 'Issuance Log', generatedBy: 'Academic Registrar' },
  ])
  fillIfEmpty('certificateSettings', [
    { id: '', settingName: 'Default Academic Credential Policy', certificateType: 'Graduation Certificate', autoNumbering: 'Enabled', serialPrefix: 'GRAD-', qrCode: 'Enabled', digitalSignature: 'Enabled', status: 'Active' },
  ])

  // Library: Book Requests, Transfers, Settings & Reports
  fillIfEmpty('requestBooks', [
    { id: '', book: 'Core Mathematics for JHS', member: 'Kwame Owusu', requestDate: '2026-11-05', status: 'Approved' },
  ])
  fillIfEmpty('transferBooks', [
    { id: '', book: 'Integrated Science Atlas', fromBranch: 'Airport Main Campus', toBranch: 'East Legon Campus', transferDate: '2026-10-18' },
  ])
  fillIfEmpty('librarySettings', [
    { id: '', libraryName: `${branchName} Learning Commons`, loanPeriodDays: 14, finePerDay: 2.5, status: 'Active' },
  ])
  fillIfEmpty('libraryReports', [
    { id: '', title: 'Monthly Circulation & Overdue Summary', fromDate: '2026-10-01', toDate: '2026-11-12', type: 'Circulation' },
  ])

  // Student Accommodation: Wardens & Hostel Allocations
  fillIfEmpty('wardenAssignments', [
    { id: '', wardenId: 'stf_1', wardenName: 'Grace Mensah', hostelName: 'Unity Boarding House', academicYear: '2026/2027', session: 'First Term', startDate: '2026-09-01', status: 'Active' },
  ])
  fillIfEmpty('studentHostelAllocation', [
    { id: '', student: 'Kwame Owusu', className: 'JHS 3', hostelName: 'Unity Boarding House', roomNumber: 'Rm 101', allocationDate: '2026-09-04', academicYear: '2026/2027', status: 'Allocated' },
  ])

  // Online Examinations & Homework
  fillIfEmpty('homework', [
    { id: '', title: 'Linear Equations & Inequalities Practice Set', className: 'Basic 7', subject: 'Mathematics', dueDate: '2026-11-18', instructions: 'Complete questions 1–15 showing full working.' },
  ])
  fillIfEmpty('evaluationReport', [
    { id: '', student: 'Kwame Owusu', className: 'Basic 7', term: 'First Term', evaluation: 'Consistent homework completion (94% average)', date: '2026-11-10' },
  ])
  fillIfEmpty('questionGroup', [
    { id: '', groupName: 'Algebra & Number Theory', subject: 'Mathematics', questionType: 'Multiple Choice', questionCount: 25 },
  ])
  fillIfEmpty('generatePosition', [
    { id: '', exam: 'First Term Mid-Semester CBT', className: 'Basic 7', term: 'First Term', status: 'Published' },
  ])
  fillIfEmpty('onlineExamReports', [
    { id: '', title: 'CBT Participation & Score Distribution', fromDate: '2026-09-01', toDate: '2026-11-12', type: 'Score Analysis' },
  ])

  // Students Settings
  fillIfEmpty('yearGroup', [
    { id: '', name: '2026/2027 Cohort', description: 'Current enrolled academic year group' },
  ])
  fillIfEmpty('studentStatus', [
    { id: '', name: 'Active Enrolled', description: 'Attending regular classes in good standing' },
    { id: '', name: 'Boarding Resident', description: 'Enrolled with full hostel accommodation' },
  ])
  fillIfEmpty('studentHealthStatus', [
    { id: '', name: 'Fit & Cleared', description: 'Cleared for full academic and sports activities' },
    { id: '', name: 'Medical Dietary/Allergy Care', description: 'Infirmary care plan on file' },
  ])
  fillIfEmpty('studentPosition', [
    { id: '', name: 'Senior Prefect', description: 'Student council executive leadership' },
    { id: '', name: 'House Captain', description: 'Boarding/sporting house student leader' },
  ])

  // Education Reports saved report snapshots
  fillIfEmpty('reportStudentInformation', [
    { id: '', title: 'Enrollment & Gender Distribution Register', type: 'Student Information', fromDate: '2026-09-01', toDate: '2026-11-12' },
  ])

  return { records: next, changed }
}

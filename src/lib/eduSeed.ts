import type { EduRecords } from './eduRecords'

/**
 * Sample data for every Education Management submenu.
 * Seeded once per branch the first time that branch's records are read, so all
 * menus open with realistic examples (Ghanaian names, GHS amounts, 2026 dates).
 */
export const EDU_SEED: EduRecords = {
  enquiries: [
    { id: 'seed-enq-1', name: 'Comfort Adjei', source: 'Walk-in', phone: '024 555 0101', date: '2026-09-07', status: 'Converted' },
    { id: 'seed-enq-2', name: 'Samuel Koranteng', source: 'Phone', phone: '020 555 0102', date: '2026-09-09', status: 'Pending' },
    { id: 'seed-enq-3', name: 'Mariam Yusuf', source: 'Website', phone: '055 555 0103', date: '2026-09-11', status: 'Pending' },
  ],
  visitors: [
    { id: 'seed-vis-1', name: 'Rev. K. Osei', purpose: 'PTA meeting', meetWith: 'Headteacher', date: '2026-09-08', badgeNo: 'V-014' },
    { id: 'seed-vis-2', name: 'GES Officer', purpose: 'Inspection', meetWith: 'Headteacher', date: '2026-09-10', badgeNo: 'V-015' },
  ],
  phoneCalls: [
    { id: 'seed-ph-1', caller: 'Adoma S.', phone: '024 111 2233', date: '2026-09-11', message: 'Asked about Basic 7 admission', status: 'Returned' },
    { id: 'seed-ph-2', caller: 'Supplier — EdBooks Ltd', phone: '030 222 4455', date: '2026-09-12', message: 'Delivery of textbooks on Friday', status: 'Pending' },
  ],
  postalMail: [
    { id: 'seed-pm-1', direction: 'Receipt', reference: 'GES/ASH/114', details: 'Circular on term reopening', date: '2026-09-01', handledBy: 'Front Desk' },
    { id: 'seed-pm-2', direction: 'Dispatch', reference: 'SCH/2026/091', details: 'Fee reminder letters to parents', date: '2026-09-09', handledBy: 'Admin Office' },
  ],
  programme: [
    { id: 'seed-prg-1', name: 'Basic Education', code: 'PRG-BE', description: 'Basic 7 to Basic 9 (JHS)' },
    { id: 'seed-prg-2', name: 'Senior High', code: 'PRG-SHS', description: 'SHS 1 to SHS 3' },
  ],
  academicYear: [
    { id: 'seed-ay-1', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', status: 'Active' },
    { id: 'seed-ay-2', name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31', status: 'Closed' },
  ],
  level: [
    { id: 'seed-lv-1', name: 'Basic 7', programme: 'Basic Education', description: 'First year of JHS' },
    { id: 'seed-lv-2', name: 'Basic 8', programme: 'Basic Education', description: 'Second year of JHS' },
    { id: 'seed-lv-3', name: 'Basic 9', programme: 'Basic Education', description: 'BECE year' },
  ],
  termSemester: [
    { id: 'seed-tm-1', name: 'Term 1', academicYear: '2026/2027', startDate: '2026-09-01', endDate: '2026-12-11', status: 'Active' },
    { id: 'seed-tm-2', name: 'Term 2', academicYear: '2026/2027', startDate: '2027-01-05', endDate: '2027-04-02', status: 'Closed' },
  ],
  classList: [
    { id: 'seed-cl-1', name: 'Basic 7', level: 'Basic 7', section: 'A', classTeacher: 'Grace Mensah', room: 'Room 1' },
    { id: 'seed-cl-2', name: 'Basic 8', level: 'Basic 8', section: 'A', classTeacher: 'Daniel Tetteh', room: 'Room 2' },
    { id: 'seed-cl-3', name: 'Basic 9', level: 'Basic 9', section: 'B', classTeacher: 'Akosua Boateng', room: 'Room 3' },
  ],
  academicSections: [
    { id: 'seed-sec-1', name: 'Section A', capacity: '40' },
    { id: 'seed-sec-2', name: 'Section B', capacity: '40' },
  ],
  assignClassTeacher: [
    { id: 'seed-act-1', className: 'Basic 7 A', teacher: 'Grace Mensah', session: '2026/2027' },
    { id: 'seed-act-2', className: 'Basic 8 A', teacher: 'Daniel Tetteh', session: '2026/2027' },
  ],
  subjectList: [
    { id: 'seed-sub-1', name: 'Mathematics', code: 'MATH', teacher: 'Grace Mensah' },
    { id: 'seed-sub-2', name: 'English', code: 'ENG', teacher: 'Daniel Tetteh' },
    { id: 'seed-sub-3', name: 'Integrated Science', code: 'SCI', teacher: 'Akosua Boateng' },
  ],
  subjectGroup: [
    { id: 'seed-sg-1', name: 'Core Subjects', code: 'CORE', description: 'Maths, English, Science, Social Studies' },
    { id: 'seed-sg-2', name: 'Electives', code: 'ELEC', description: 'Creative arts, computing' },
  ],
  assignSubjectTeacher: [
    { id: 'seed-ast-1', subject: 'Mathematics', teacher: 'Grace Mensah', className: 'Basic 7 A' },
    { id: 'seed-ast-2', subject: 'English', teacher: 'Daniel Tetteh', className: 'Basic 8 A' },
  ],
  classTimetable: [
    { id: 'seed-tt-1', className: 'Basic 7 A', day: 'Monday', period: 'Period 1', subject: 'Mathematics', teacher: 'Grace Mensah' },
    { id: 'seed-tt-2', className: 'Basic 7 A', day: 'Monday', period: 'Period 2', subject: 'English', teacher: 'Daniel Tetteh' },
    { id: 'seed-tt-3', className: 'Basic 7 A', day: 'Tuesday', period: 'Period 1', subject: 'Integrated Science', teacher: 'Akosua Boateng' },
    { id: 'seed-tt-4', className: 'Basic 8 A', day: 'Monday', period: 'Period 3', subject: 'Mathematics', teacher: 'Grace Mensah' },
    { id: 'seed-tt-5', className: 'Basic 8 A', day: 'Wednesday', period: 'Period 2', subject: 'English', teacher: 'Daniel Tetteh' },
    { id: 'seed-tt-6', className: 'Basic 9 B', day: 'Thursday', period: 'Period 4', subject: 'Integrated Science', teacher: 'Akosua Boateng' },
  ],
  classRules: [
    { id: 'seed-cr-1', className: 'Basic 7 A', maxPerDay: '6', maxPerWeek: '30' },
    { id: 'seed-cr-2', className: 'Basic 8 A', maxPerDay: '6', maxPerWeek: '30' },
  ],
  teacherRules: [
    { id: 'seed-tr-1', teacher: 'Grace Mensah', maxPerDay: '6', maxPerWeek: '25', unavailableDay: 'Any', unavailablePeriod: 'Any' },
    { id: 'seed-tr-2', teacher: 'Akosua Boateng', maxPerDay: '5', maxPerWeek: '20', unavailableDay: 'Friday', unavailablePeriod: 'Any' },
  ],
  timeOff: [
    { id: 'seed-to-1', whoType: 'Teacher', name: 'Daniel Tetteh', blocked: 'Wednesday|Period 1; Wednesday|Period 2', conditional: '' },
    { id: 'seed-to-2', whoType: 'Class', name: 'Basic 9 B', blocked: 'Friday|Period 7; Friday|Period 8', conditional: 'Thursday|Period 8' },
  ],
  constraints: [
    { id: 'seed-cn-1', kind: 'teacherConsec', target: '', value: '4' },
    { id: 'seed-cn-2', kind: 'classSubjectOnce', target: 'Basic 7 A', value: '' },
  ],
  rooms: [
    { id: 'seed-rm-1', name: 'Room 1', short: 'R1', homeClassroom: 'Yes', homeClass: 'Basic 7 A', shared: '', capacity: '30', location: 'Main Block' },
    { id: 'seed-rm-2', name: 'Room 2', short: 'R2', homeClassroom: 'Yes', homeClass: 'Basic 8 A', shared: '', capacity: '28', location: 'Main Block' },
    { id: 'seed-rm-3', name: 'Room 3', short: 'R3', homeClassroom: 'Yes', homeClass: 'Basic 9 B', shared: '', capacity: '32', location: 'Annex' },
    { id: 'seed-rm-4', name: 'Science Lab', short: 'LAB', homeClassroom: '', homeClass: '', shared: 'Yes', capacity: '24', location: 'Science Block' },
    { id: 'seed-rm-5', name: 'ICT Lab', short: 'ICT', homeClassroom: '', homeClass: '', shared: 'Yes', capacity: '25', location: 'ICT Block' },
    { id: 'seed-rm-6', name: 'Library', short: 'LIB', homeClassroom: '', homeClass: '', shared: 'Yes', capacity: '60', location: 'Main Block' },
    { id: 'seed-rm-7', name: 'Assembly Hall', short: 'HALL', homeClassroom: '', homeClass: '', shared: 'Yes', capacity: '120', location: 'Main Block' },
  ],
  roomAllocation: [
    { id: 'seed-ra-1', room: 'Room 1', day: 'Monday', period: 'Period 1', className: 'Basic 7 A', subject: 'Mathematics', teacher: 'Grace Mensah' },
    { id: 'seed-ra-2', room: 'Room 1', day: 'Monday', period: 'Period 2', className: 'Basic 7 A', subject: 'English', teacher: 'Daniel Tetteh' },
    { id: 'seed-ra-3', room: 'Science Lab', day: 'Tuesday', period: 'Period 1', className: 'Basic 7 A', subject: 'Integrated Science', teacher: 'Akosua Boateng' },
    { id: 'seed-ra-4', room: 'Room 2', day: 'Monday', period: 'Period 3', className: 'Basic 8 A', subject: 'Mathematics', teacher: 'Grace Mensah' },
    { id: 'seed-ra-5', room: 'Room 2', day: 'Wednesday', period: 'Period 2', className: 'Basic 8 A', subject: 'English', teacher: 'Daniel Tetteh' },
    { id: 'seed-ra-6', room: 'Science Lab', day: 'Thursday', period: 'Period 4', className: 'Basic 9 B', subject: 'Integrated Science', teacher: 'Akosua Boateng' },
  ],
  studentAttendance: [
    { id: 'seed-sa-1', date: '2026-09-11', className: 'Basic 7 A', student: 'Ama Owusu', status: 'Present' },
    { id: 'seed-sa-2', date: '2026-09-11', className: 'Basic 7 A', student: 'Kwame Asante', status: 'Late' },
    { id: 'seed-sa-3', date: '2026-09-11', className: 'Basic 7 A', student: 'Efua Dadzie', status: 'Present' },
  ],
  teacherAttendance: [
    { id: 'seed-ta-1', date: '2026-09-11', teacher: 'Grace Mensah', status: 'Present' },
    { id: 'seed-ta-2', date: '2026-09-11', teacher: 'Daniel Tetteh', status: 'Present' },
    { id: 'seed-ta-3', date: '2026-09-11', teacher: 'Akosua Boateng', status: 'On Leave' },
  ],
  attendanceReports: [
    { id: 'seed-ar-1', period: '2026-09', className: 'Basic 7 A', present: '18', absent: '2', late: '1' },
    { id: 'seed-ar-2', period: '2026-09', className: 'Basic 8 A', present: '20', absent: '1', late: '0' },
  ],
  studentList: [
    { id: 'seed-st-1', admissionNo: 'ADM-001', name: 'Ama Owusu', className: 'Basic 7 A', rollNo: '1', guardian: 'Kofi Owusu', phone: '020 111 0001', status: 'Active' },
    { id: 'seed-st-2', admissionNo: 'ADM-002', name: 'Kwame Asante', className: 'Basic 7 A', rollNo: '2', guardian: 'Abena Asante', phone: '020 111 0002', status: 'Active' },
    { id: 'seed-st-3', admissionNo: 'ADM-003', name: 'Efua Dadzie', className: 'Basic 8 A', rollNo: '1', guardian: 'Yaw Dadzie', phone: '020 111 0003', status: 'Active' },
    { id: 'seed-st-4', admissionNo: 'ADM-004', name: 'Kojo Antwi', className: 'Basic 9 B', rollNo: '1', guardian: 'Esi Antwi', phone: '020 111 0004', status: 'Active' },
  ],
  studentPromotion: [
    { id: 'seed-sp-1', student: 'Efua Dadzie', fromClass: 'Basic 7 A', toClass: 'Basic 8 A', session: '2026/2027', outcome: 'Promoted' },
    { id: 'seed-sp-2', student: 'Kojo Antwi', fromClass: 'Basic 8 A', toClass: 'Basic 9 B', session: '2026/2027', outcome: 'Promoted' },
  ],
  studentTransfers: [
    { id: 'seed-str-1', student: 'Yaw Darko', date: '2026-09-04', reason: 'Parent relocated to Accra', status: 'Approved' },
    { id: 'seed-str-2', student: 'Abena Mensah', date: '2026-09-10', reason: 'Transfer from sister school', status: 'Pending' },
  ],
  idCards: [
    { id: 'seed-id-1', student: 'Ama Owusu', className: 'Basic 7 A', issueDate: '2026-09-07', issued: 'Yes' },
    { id: 'seed-id-2', student: 'Kwame Asante', className: 'Basic 7 A', issueDate: '2026-09-07', issued: 'No' },
  ],
  feeCollection: [
    { id: 'seed-fc-1', receiptNo: 'RCP-1001', student: 'Ama Owusu', amount: '850', method: 'Mobile Money', date: '2026-09-03' },
    { id: 'seed-fc-2', receiptNo: 'RCP-1002', student: 'Efua Dadzie', amount: '850', method: 'Cash', date: '2026-09-05' },
  ],
  outstandingFees: [
    { id: 'seed-of-1', student: 'Kwame Asante', feeType: 'Term Fee', amount: '850', dueDate: '2026-09-30', status: 'Unpaid' },
    { id: 'seed-of-2', student: 'Kojo Antwi', feeType: 'Term Fee', amount: '850', dueDate: '2026-08-31', status: 'Overdue' },
  ],
  scholarships: [
    { id: 'seed-sch-1', student: 'Ama Owusu', type: 'Merit Scholarship', amount: '400', session: '2026/2027' },
    { id: 'seed-sch-2', student: 'Efua Dadzie', type: 'PTA Support', amount: '200', session: '2026/2027' },
  ],
  staffList: [
    { id: 'seed-sf-1', staffNo: 'T-001', name: 'Grace Mensah', designation: 'Mathematics Teacher', department: 'Core Subjects', phone: '024 000 1111', email: 'grace.mensah@school.edu.gh', status: 'Active' },
    { id: 'seed-sf-2', staffNo: 'T-002', name: 'Daniel Tetteh', designation: 'English Teacher', department: 'Core Subjects', phone: '024 000 2222', email: 'daniel.tetteh@school.edu.gh', status: 'Active' },
    { id: 'seed-sf-3', staffNo: 'T-003', name: 'Akosua Boateng', designation: 'Science Teacher', department: 'Core Subjects', phone: '024 000 3333', email: 'akosua.boateng@school.edu.gh', status: 'Active' },
    { id: 'seed-sf-4', staffNo: 'A-001', name: 'Kwabena Osei', designation: 'Accountant', department: 'Administration', phone: '024 000 4444', email: 'kwabena.osei@school.edu.gh', status: 'Active' },
  ],
  departments: [
    { id: 'seed-dep-1', name: 'Core Subjects', head: 'Grace Mensah', description: 'Maths, English, Science' },
    { id: 'seed-dep-2', name: 'Administration', head: 'Kwabena Osei', description: 'Front desk, accounts, records' },
  ],
  designations: [
    { id: 'seed-des-1', name: 'Headteacher', department: 'Administration', grade: 'H1' },
    { id: 'seed-des-2', name: 'Teacher', department: 'Core Subjects', grade: 'T3' },
  ],
  staffLeave: [
    { id: 'seed-sl-1', staff: 'Akosua Boateng', type: 'Sick', from: '2026-09-11', to: '2026-09-12', status: 'Approved' },
    { id: 'seed-sl-2', staff: 'Daniel Tetteh', type: 'Casual', from: '2026-09-18', to: '2026-09-18', status: 'Pending' },
  ],
  staffCategories: [
    { id: 'seed-sc-1', name: 'Teaching', description: 'Classroom and subject teachers' },
    { id: 'seed-sc-2', name: 'Non-teaching', description: 'Admin, accounts, support staff' },
  ],
  lessonPlans: [
    { id: 'seed-lp-1', teacher: 'Grace Mensah', subject: 'Mathematics', className: 'Basic 7 A', week: '2026-09-07', topic: 'Integers and number line', status: 'Approved' },
    { id: 'seed-lp-2', teacher: 'Daniel Tetteh', subject: 'English', className: 'Basic 8 A', week: '2026-09-07', topic: 'Summary writing', status: 'Draft' },
  ],
  lessonPlanApprovals: [
    { id: 'seed-la-1', teacher: 'Daniel Tetteh', topic: 'Summary writing', submittedOn: '2026-09-08', status: 'Pending' },
    { id: 'seed-la-2', teacher: 'Grace Mensah', topic: 'Integers and number line', submittedOn: '2026-09-04', status: 'Approved' },
  ],
  examSchedule: [
    { id: 'seed-es-1', exam: 'Mid-Term Examination', className: 'Basic 7 A', subject: 'Mathematics', date: '2026-10-13' },
    { id: 'seed-es-2', exam: 'Mid-Term Examination', className: 'Basic 8 A', subject: 'English', date: '2026-10-14' },
  ],
  marksEntry: [
    { id: 'seed-me-1', exam: 'Mid-Term Examination', student: 'Ama Owusu', subject: 'Mathematics', marks: '78', maxMarks: '100' },
    { id: 'seed-me-2', exam: 'Mid-Term Examination', student: 'Kwame Asante', subject: 'Mathematics', marks: '64', maxMarks: '100' },
  ],
  reportCards: [
    { id: 'seed-rc-1', student: 'Ama Owusu', className: 'Basic 7 A', term: 'Term 1', total: '86', grade: 'A' },
    { id: 'seed-rc-2', student: 'Kwame Asante', className: 'Basic 7 A', term: 'Term 1', total: '71', grade: 'B' },
  ],
  examResults: [
    { id: 'seed-er-1', exam: 'Mid-Term Examination', className: 'Basic 7 A', published: 'Published' },
    { id: 'seed-er-2', exam: 'Mid-Term Examination', className: 'Basic 8 A', published: 'Draft' },
  ],
  books: [
    { id: 'seed-bk-1', title: 'Aki-o and the Kite', author: 'E. Quartey', isbn: '978-9964-001', category: 'Literature', copies: '12' },
    { id: 'seed-bk-2', title: 'New Basic Maths 7', author: 'K. Anokye', isbn: '978-9964-002', category: 'Mathematics', copies: '40' },
  ],
  bookIssueReturn: [
    { id: 'seed-bi-1', book: 'New Basic Maths 7', member: 'Ama Owusu', issueDate: '2026-09-02', dueDate: '2026-09-16', status: 'Issued' },
    { id: 'seed-bi-2', book: 'Aki-o and the Kite', member: 'Efua Dadzie', issueDate: '2026-08-20', dueDate: '2026-09-03', status: 'Overdue' },
  ],
  libraryMembers: [
    { id: 'seed-lm-1', name: 'Ama Owusu', memberType: 'Student', memberNo: 'LIB-001' },
    { id: 'seed-lm-2', name: 'Grace Mensah', memberType: 'Teacher', memberNo: 'LIB-002' },
  ],
  onlineExams: [
    { id: 'seed-oe-1', title: 'Maths Quiz 1', className: 'Basic 7 A', subject: 'Mathematics', date: '2026-09-15', duration: '30' },
    { id: 'seed-oe-2', title: 'English Grammar Check', className: 'Basic 8 A', subject: 'English', date: '2026-09-17', duration: '45' },
  ],
  questionBank: [
    { id: 'seed-qb-1', subject: 'Mathematics', question: 'What is 7 × 8?', answer: '56', marks: '2' },
    { id: 'seed-qb-2', subject: 'English', question: 'Choose the correct plural of "child".', answer: 'Children', marks: '2' },
  ],
  examAttempts: [
    { id: 'seed-ea-1', student: 'Ama Owusu', exam: 'Maths Quiz 1', score: '9', date: '2026-09-08', outcome: 'Passed' },
    { id: 'seed-ea-2', student: 'Kwame Asante', exam: 'Maths Quiz 1', score: '4', date: '2026-09-08', outcome: 'Failed' },
  ],
  studentCategories: [
    { id: 'seed-scat-1', name: 'Day Student', description: 'Lives at home' },
    { id: 'seed-scat-2', name: 'Boarder', description: 'Lives in school hostel' },
  ],
  houses: [
    { id: 'seed-ho-1', name: 'Aggrey House', color: 'Red' },
    { id: 'seed-ho-2', name: 'Gyan House', color: 'Blue' },
  ],
  academicSessions: [
    { id: 'seed-as-1', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', status: 'Active' },
    { id: 'seed-as-2', name: '2025/2026', startDate: '2025-09-01', endDate: '2026-07-31', status: 'Closed' },
  ],
  feeGroups: [
    { id: 'seed-fg-1', name: 'Tuition', description: 'Core school fees' },
    { id: 'seed-fg-2', name: 'Auxiliary', description: 'PTA, excursion, ICT levies' },
  ],
  feeTypes: [
    { id: 'seed-ft-1', name: 'Term Fee', feeGroup: 'Tuition', defaultAmount: '850' },
    { id: 'seed-ft-2', name: 'ICT Levy', feeGroup: 'Auxiliary', defaultAmount: '60' },
  ],
  paymentMethods: [
    { id: 'seed-pm2-1', name: 'Mobile Money', provider: 'MTN / Telecel', status: 'Active' },
    { id: 'seed-pm2-2', name: 'Bank Transfer', provider: 'GCB Bank', status: 'Active' },
  ],
  lateFeeRules: [
    { id: 'seed-lf-1', name: 'Standard Late Fee', graceDays: '7', chargePerDay: '5' },
  ],
}

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
    { id: 'seed-act-3', className: 'Basic 9 B', teacher: 'Akosua Boateng', session: '2026/2027' },
  ],
  subjectList: [
    { id: 'seed-sub-1', name: 'Mathematics', short: 'MATH', teacher: 'Grace Mensah' },
    { id: 'seed-sub-2', name: 'English', short: 'ENG', teacher: 'Daniel Tetteh' },
    { id: 'seed-sub-3', name: 'Integrated Science', short: 'SCI', teacher: 'Akosua Boateng' },
  ],
  subjectGroup: [
    { id: 'seed-sg-1', name: 'Core Subjects', code: 'CORE', description: 'Maths, English, Science, Social Studies' },
    { id: 'seed-sg-2', name: 'Electives', code: 'ELEC', description: 'Creative arts, computing' },
  ],
  assignSubjectTeacher: [
    { id: 'seed-ast-1', subject: 'Mathematics', teacher: 'Grace Mensah', className: 'Basic 7 A', periodsPerWeek: '5' },
    { id: 'seed-ast-3', subject: 'Mathematics', teacher: 'Grace Mensah', className: 'Basic 8 A', periodsPerWeek: '5' },
    { id: 'seed-ast-4', subject: 'Mathematics', teacher: 'Grace Mensah', className: 'Basic 9 B', periodsPerWeek: '5' },
    { id: 'seed-ast-5', subject: 'English', teacher: 'Daniel Tetteh', className: 'Basic 7 A', periodsPerWeek: '5' },
    { id: 'seed-ast-2', subject: 'English', teacher: 'Daniel Tetteh', className: 'Basic 8 A', periodsPerWeek: '5' },
    { id: 'seed-ast-6', subject: 'English', teacher: 'Daniel Tetteh', className: 'Basic 9 B', periodsPerWeek: '5' },
    { id: 'seed-ast-7', subject: 'Integrated Science', teacher: 'Akosua Boateng', className: 'Basic 7 A', periodsPerWeek: '4' },
    { id: 'seed-ast-8', subject: 'Integrated Science', teacher: 'Akosua Boateng', className: 'Basic 8 A', periodsPerWeek: '4' },
    { id: 'seed-ast-9', subject: 'Integrated Science', teacher: 'Akosua Boateng', className: 'Basic 9 B', periodsPerWeek: '4' },
  ],
  assignClassSubjects: [
    { id: 'seed-acs-1', className: 'Basic 7', sections: '["A"]', subjects: '["Mathematics","English","Integrated Science"]' },
    { id: 'seed-acs-2', className: 'Basic 8', sections: '["A"]', subjects: '["Mathematics","English","Integrated Science"]' },
    { id: 'seed-acs-3', className: 'Basic 9', sections: '["B"]', subjects: '["Mathematics","English","Integrated Science"]' },
  ],
  // Class and teacher timetable views share this lesson list; leave it empty by default.
  classTimetable: [],
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
    { id: 'seed-st-5', admissionNo: 'ADM-005', name: 'Adwoa Serwaa', className: 'Basic 8 A', rollNo: '2', guardian: 'Kofi Owusu', phone: '020 111 0005', status: 'Active' },
    { id: 'seed-st-6', admissionNo: 'ADM-006', name: 'Akosua Frimpong', className: 'Basic 7 B', rollNo: '1', guardian: 'Yaa Frimpong', phone: '020 111 0006', status: 'Active' },
    { id: 'seed-st-7', admissionNo: 'ADM-007', name: 'Yaw Boateng', className: 'Basic 7 B', rollNo: '2', guardian: 'Kwaku Boateng', phone: '020 111 0007', status: 'Active' },
    { id: 'seed-st-8', admissionNo: 'ADM-008', name: 'Akua Donkor', className: 'Basic 8 B', rollNo: '1', guardian: 'Abena Donkor', phone: '020 111 0008', status: 'Active' },
    { id: 'seed-st-9', admissionNo: 'ADM-009', name: 'Kwabena Osei', className: 'Basic 9 A', rollNo: '1', guardian: 'Kofi Osei', phone: '020 111 0009', status: 'Active' },
    { id: 'seed-st-10', admissionNo: 'ADM-010', name: 'Yaa Ansah', className: 'Basic 9 A', rollNo: '2', guardian: 'Efua Ansah', phone: '020 111 0010', status: 'Active' },
  ],
  studentPromotion: [
    { id: 'seed-sp-1', student: 'Efua Dadzie', fromClass: 'Basic 7 A', toClass: 'Basic 8 A', session: '2026/2027', outcome: 'Promoted' },
    { id: 'seed-sp-2', student: 'Kojo Antwi', fromClass: 'Basic 8 A', toClass: 'Basic 9 B', session: '2026/2027', outcome: 'Promoted' },
  ],
  studentTransfers: [
    { id: 'seed-str-1', student: 'Yaw Darko', date: '2026-09-04', reason: 'Parent relocated to Accra', status: 'Approved' },
    { id: 'seed-str-2', student: 'Abena Mensah', date: '2026-09-10', reason: 'Transfer from sister school', status: 'Pending' },
  ],
  studentRegistration: [
    { id: 'seed-sreg-1', admissionNo: 'ADM-001', name: 'Ama Owusu', className: 'Basic 7 A', rollNo: '1', section: 'Section A', house: 'Aggrey House', dateOfBirth: '2013-04-12', gender: 'Female', guardian: 'Kofi Owusu', phone: '020 111 0001', admissionDate: '2024-09-02', status: 'Active', photo: '/images/students/ama-owusu.jpg' },
    { id: 'seed-sreg-2', admissionNo: 'ADM-002', name: 'Kwame Asante', className: 'Basic 7 A', rollNo: '2', section: 'Section A', house: 'Gyan House', dateOfBirth: '2013-07-30', gender: 'Male', guardian: 'Abena Asante', phone: '020 111 0002', admissionDate: '2024-09-02', status: 'Active', photo: '/images/students/kwame-asante.jpg' },
    { id: 'seed-sreg-3', admissionNo: 'ADM-003', name: 'Efua Dadzie', className: 'Basic 8 A', rollNo: '1', section: 'Section B', house: 'Aggrey House', dateOfBirth: '2012-11-05', gender: 'Female', guardian: 'Yaw Dadzie', phone: '020 111 0003', admissionDate: '2023-09-04', status: 'Active', photo: '/images/students/efua-dadzie.jpg' },
    { id: 'seed-sreg-4', admissionNo: 'ADM-004', name: 'Kojo Antwi', className: 'Basic 9 B', rollNo: '1', section: 'Section A', house: 'Gyan House', dateOfBirth: '2011-02-18', gender: 'Male', guardian: 'Esi Antwi', phone: '020 111 0004', admissionDate: '2022-09-05', status: 'Active', photo: '/images/students/kojo-antwi.jpg' },
    { id: 'seed-sreg-5', admissionNo: 'ADM-005', name: 'Adwoa Serwaa', className: 'Basic 8 A', rollNo: '2', section: 'Section B', house: 'Aggrey House', dateOfBirth: '2012-06-21', gender: 'Female', guardian: 'Kofi Owusu', phone: '020 111 0005', admissionDate: '2023-09-04', status: 'Active', photo: '/images/students/adwoa-serwaa.jpg' },
    { id: 'seed-sreg-6', admissionNo: 'ADM-006', name: 'Akosua Frimpong', className: 'Basic 7 B', rollNo: '1', section: 'Section B', house: 'Gyan House', dateOfBirth: '2013-01-22', gender: 'Female', guardian: 'Yaa Frimpong', phone: '020 111 0006', admissionDate: '2024-09-02', status: 'Active', photo: '/images/students/akosua-frimpong.jpg' },
    { id: 'seed-sreg-7', admissionNo: 'ADM-007', name: 'Yaw Boateng', className: 'Basic 7 B', rollNo: '2', section: 'Section B', house: 'Aggrey House', dateOfBirth: '2013-09-14', gender: 'Male', guardian: 'Kwaku Boateng', phone: '020 111 0007', admissionDate: '2024-09-02', status: 'Active', photo: '/images/students/yaw-boateng.jpg' },
    { id: 'seed-sreg-8', admissionNo: 'ADM-008', name: 'Akua Donkor', className: 'Basic 8 B', rollNo: '1', section: 'Section B', house: 'Gyan House', dateOfBirth: '2012-03-08', gender: 'Female', guardian: 'Abena Donkor', phone: '020 111 0008', admissionDate: '2023-09-04', status: 'Active', photo: '/images/students/akua-donkor.jpg' },
    { id: 'seed-sreg-9', admissionNo: 'ADM-009', name: 'Kwabena Osei', className: 'Basic 9 A', rollNo: '1', section: 'Section A', house: 'Aggrey House', dateOfBirth: '2011-06-30', gender: 'Male', guardian: 'Kofi Osei', phone: '020 111 0009', admissionDate: '2022-09-05', status: 'Active', photo: '/images/students/kwabena-osei.jpg' },
    { id: 'seed-sreg-10', admissionNo: 'ADM-010', name: 'Yaa Ansah', className: 'Basic 9 A', rollNo: '2', section: 'Section A', house: 'Gyan House', dateOfBirth: '2011-12-02', gender: 'Female', guardian: 'Efua Ansah', phone: '020 111 0010', admissionDate: '2022-09-05', status: 'Active', photo: '/images/students/yaa-ansah.jpg' },
  ],
  idCardTemplates: [
    {
      id: 'seed-idctpl-1', name: 'Basic School Card 2026/27', status: 'Active', orientation: 'Landscape',
      widthMm: '85.6', heightMm: '54', backgroundColor: '#ffffff', headerColor: '#1d4ed8',
      textColor: '#0f172a', accentColor: '#f59e0b', showLogo: 'Yes', schoolName: '', address: '', contact: '',
      motto: 'Knowledge, Truth and Service',
      frontFields: '["admissionNo","studentName","className","section","house","gender","dateOfBirth","academicYear","cardNo"]',
      backFields: '["schoolAddress","schoolContact","motto","validity","returnNote","signature","qr","barcode"]',
      showPhoto: 'Yes', photoPosition: 'Left', photoStyle: 'Square', showQr: 'Yes', qrPosition: 'Bottom right', showBarcode: 'Yes', showSignature: 'Yes',
      signatureName: 'Mrs. Grace Mensah', signatureTitle: 'Headteacher',
      backNote: 'If found, please return to the school address above. This card remains school property.',
      cardNoPrefix: 'IDC', validityMonths: '12', printLayout: 'A4 Sheet', cardsPerRow: '2',
      sizePreset: 'CR80 PVC (85.6 × 54 mm)',
      fontFamily: 'sans', fontScale: '1', labelCase: 'Sentence case',
    },
    {
      id: 'seed-idctpl-2', name: 'Portrait Prefect Badge', status: 'Inactive', orientation: 'Portrait',
      widthMm: '54', heightMm: '85.6', backgroundColor: '#ffffff', headerColor: '#7c3aed',
      textColor: '#0f172a', accentColor: '#f59e0b', showLogo: 'Yes', schoolName: '', address: '', contact: '',
      motto: 'Service with Honour',
      frontFields: '["studentName","className","house","academicYear","cardNo"]',
      backFields: '["motto","validity","returnNote","qr"]',
      showPhoto: 'Yes', photoPosition: 'Top', photoStyle: 'Circle', showQr: 'Yes', qrPosition: 'Bottom right', showBarcode: 'No', showSignature: 'Yes',
      fontFamily: 'serif', fontScale: '1.1', labelCase: 'UPPERCASE',
      signatureName: 'Mrs. Grace Mensah', signatureTitle: 'Headteacher',
      backNote: 'Prefect badge — return at the end of the academic year.',
      cardNoPrefix: 'PREF', validityMonths: '12', printLayout: 'PVC Card', cardsPerRow: '2',
    },
  ],
  idCards: [
    { id: 'seed-idcard-1', cardNo: 'IDC-2026-0001', studentId: 'seed-st-1', student: 'Ama Owusu', admissionNo: 'ADM-001', className: 'Basic 7 A', section: 'Section A', house: 'Aggrey House', gender: 'Female', dateOfBirth: '2013-04-12', academicYear: '2026/2027', rollNo: '1', guardian: 'Kofi Owusu', phone: '020 111 0001', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Issued', issueDate: '2026-09-15', expiryDate: '2027-09-15', issuedBy: 'Reception — Ama Serwaa', printCount: '1', lastPrintedAt: '2026-09-14', previousCardNo: '', replacementReason: '', replacementDate: '', remarks: '', photo: '/images/students/ama-owusu.jpg' },
    { id: 'seed-idcard-2', cardNo: 'IDC-2026-0002', studentId: 'seed-st-2', student: 'Kwame Asante', admissionNo: 'ADM-002', className: 'Basic 7 A', section: 'Section A', house: 'Gyan House', gender: 'Male', dateOfBirth: '2013-07-30', academicYear: '2026/2027', rollNo: '2', guardian: 'Abena Asante', phone: '020 111 0002', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Printed', issueDate: '', expiryDate: '2027-09-14', issuedBy: '', printCount: '1', lastPrintedAt: '2026-09-14', previousCardNo: '', replacementReason: '', replacementDate: '', remarks: 'Awaiting collection by guardian.', photo: '/images/students/kwame-asante.jpg' },
    { id: 'seed-idcard-3', cardNo: 'IDC-2026-0003', studentId: 'seed-st-3', student: 'Efua Dadzie', admissionNo: 'ADM-003', className: 'Basic 8 A', section: 'Section B', house: 'Aggrey House', gender: 'Female', dateOfBirth: '2012-11-05', academicYear: '2026/2027', rollNo: '1', guardian: 'Yaw Dadzie', phone: '020 111 0003', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Active', issueDate: '2026-09-16', expiryDate: '2027-09-16', issuedBy: 'Reception — Ama Serwaa', printCount: '1', lastPrintedAt: '2026-09-15', previousCardNo: '', replacementReason: '', replacementDate: '', remarks: '', photo: '/images/students/efua-dadzie.jpg' },
    { id: 'seed-idcard-4', cardNo: 'IDC-2026-0004', studentId: 'seed-st-4', student: 'Kojo Antwi', admissionNo: 'ADM-004', className: 'Basic 9 B', section: 'Section A', house: 'Gyan House', gender: 'Male', dateOfBirth: '2011-02-18', academicYear: '2026/2027', rollNo: '1', guardian: 'Esi Antwi', phone: '020 111 0004', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Lost', issueDate: '2026-09-15', expiryDate: '2027-09-15', issuedBy: 'Reception — Ama Serwaa', printCount: '1', lastPrintedAt: '2026-09-14', previousCardNo: '', replacementReason: 'Lost — reported by guardian', replacementDate: '2026-10-02', remarks: 'Replaced by IDC-2026-0005 on 2026-10-02', photo: '/images/students/kojo-antwi.jpg' },
    { id: 'seed-idcard-5', cardNo: 'IDC-2026-0005', studentId: 'seed-st-4', student: 'Kojo Antwi', admissionNo: 'ADM-004', className: 'Basic 9 B', section: 'Section A', house: 'Gyan House', gender: 'Male', dateOfBirth: '2011-02-18', academicYear: '2026/2027', rollNo: '1', guardian: 'Esi Antwi', phone: '020 111 0004', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Active', issueDate: '2026-10-02', expiryDate: '2027-10-02', issuedBy: 'Reception — Ama Serwaa', printCount: '1', lastPrintedAt: '2026-10-01', previousCardNo: 'IDC-2026-0004', replacementReason: '', replacementDate: '', remarks: 'Replacement for IDC-2026-0004 · Lost — reported by guardian', photo: '/images/students/kojo-antwi.jpg' },
    { id: 'seed-idcard-6', cardNo: 'IDC-2026-0006', studentId: 'seed-st-5', student: 'Adwoa Serwaa', admissionNo: 'ADM-005', className: 'Basic 8 A', section: 'Section B', house: 'Aggrey House', gender: 'Female', dateOfBirth: '2012-06-21', academicYear: '2026/2027', rollNo: '2', guardian: 'Kofi Owusu', phone: '020 111 0005', templateId: 'seed-idctpl-1', templateName: 'Basic School Card 2026/27', status: 'Generated', issueDate: '', expiryDate: '2027-09-14', issuedBy: '', printCount: '0', lastPrintedAt: '', previousCardNo: '', replacementReason: '', replacementDate: '', remarks: '', photo: '/images/students/adwoa-serwaa.jpg' },
  ],
  idCardHistory: [
    { id: 'seed-idch-1', date: '2026-09-14', time: '09:12', cardNo: 'IDC-2026-0001', student: 'Ama Owusu', action: 'Generated', fromStatus: '', toStatus: 'Generated', officer: 'Admin', reason: 'Bulk generation · Basic School Card 2026/27' },
    { id: 'seed-idch-2', date: '2026-09-14', time: '15:40', cardNo: 'IDC-2026-0001', student: 'Ama Owusu', action: 'Printed', fromStatus: 'Generated', toStatus: 'Printed', officer: 'Admin', reason: 'Print run recorded' },
    { id: 'seed-idch-3', date: '2026-09-15', time: '08:05', cardNo: 'IDC-2026-0001', student: 'Ama Owusu', action: 'Issued', fromStatus: 'Printed', toStatus: 'Issued', officer: 'Reception — Ama Serwaa', reason: 'Issued by Reception — Ama Serwaa' },
    { id: 'seed-idch-4', date: '2026-09-15', time: '15:30', cardNo: 'IDC-2026-0003', student: 'Efua Dadzie', action: 'Activated', fromStatus: 'Issued', toStatus: 'Active', officer: 'Admin', reason: 'Activated for the term' },
    { id: 'seed-idch-5', date: '2026-10-02', time: '10:20', cardNo: 'IDC-2026-0004', student: 'Kojo Antwi', action: 'Marked Lost', fromStatus: 'Issued', toStatus: 'Lost', officer: 'Reception — Ama Serwaa', reason: 'Reported lost' },
    { id: 'seed-idch-6', date: '2026-10-02', time: '10:25', cardNo: 'IDC-2026-0004', student: 'Kojo Antwi', action: 'Replaced', fromStatus: 'Lost', toStatus: 'Replaced', officer: 'Reception — Ama Serwaa', reason: 'Lost — reported by guardian' },
    { id: 'seed-idch-7', date: '2026-10-02', time: '10:25', cardNo: 'IDC-2026-0005', student: 'Kojo Antwi', action: 'Generated', fromStatus: '', toStatus: 'Generated', officer: 'Reception — Ama Serwaa', reason: 'Replacement card for IDC-2026-0004 · Lost — reported by guardian' },
    { id: 'seed-idch-8', date: '2026-10-02', time: '11:00', cardNo: 'IDC-2026-0005', student: 'Kojo Antwi', action: 'Issued', fromStatus: 'Printed', toStatus: 'Issued', officer: 'Reception — Ama Serwaa', reason: 'Issued by Reception — Ama Serwaa' },
    { id: 'seed-idch-9', date: '2026-10-16', time: '09:45', cardNo: 'IDC-2026-0003', student: 'Efua Dadzie', action: 'Verified', fromStatus: 'Active', toStatus: 'Active', officer: 'Admin', reason: 'Verification lookup' },
  ],
  idCardSettings: [
    {
      id: 'seed-idcset-1',
      defaultTemplateId: 'seed-idctpl-1',
      perm_configure: '["super_admin","company_admin","branch_admin","gym_manager"]',
      perm_generate: '["super_admin","company_admin","branch_admin","gym_manager","receptionist"]',
      perm_print: '["super_admin","company_admin","branch_admin","gym_manager","receptionist"]',
      perm_issue: '["super_admin","company_admin","branch_admin","gym_manager","receptionist"]',
      perm_replace: '["super_admin","company_admin","branch_admin","gym_manager"]',
      perm_verify: '["super_admin","company_admin","branch_admin","gym_manager","receptionist","staff","head_office"]',
      perm_reports: '["super_admin","company_admin","branch_admin","gym_manager","receptionist","head_office"]',
    },
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
  // The components an exam's total is split into. Order matters — sortOrder
  // drives the order they are listed and entered.
  examSetup: [
    { id: 'seed-es-1', examName: 'First Term Examination', examType: 'Marks', term: 'Term 1', markDistribution: '["Class Work", "Home Work", "Exams"]', publish: 'Yes', publishResult: 'Yes', remarks: 'End-of-term examination for all Basic and SHS classes.' },
    { id: 'seed-es-2', examName: 'Mid-Term Assessment', examType: 'Marks', term: 'Term 1', markDistribution: '["Class Work", "Exams"]', publish: 'No', publishResult: 'No', remarks: 'Short assessment held in week six; does not count toward the term total.' },
    { id: 'seed-es-3', examName: 'End of Term Examination', examType: 'Marks And Grade', term: 'Term 1', markDistribution: '["SBA (50%)", "EXAMS (50%)"]', publish: 'No', publishResult: 'No', remarks: 'SBA and end-of-term papers are weighted equally.' },
    { id: 'seed-es-4', examName: 'Second Term Examination', examType: 'Grade (GPA)', term: 'Term 2', markDistribution: '["Exams"]', publish: 'No', publishResult: 'No', remarks: 'Graded on the GPA scale; no raw marks are released to parents.' },
  ],
  marksheetTemplate: [
    { id: 'seed-mst-1', branch: 'Airport City Flagship', examName: 'First Term Examination', templateName: 'Sample(A4 Portrait) 1', pageLayout: 'Portrait', photoStyle: 'Square - 320', topSpace: '20', bottomSpace: '20', rightSpace: '15', leftSpace: '15', leftSignature: '', middleSignature: '', rightSignature: '', logoImage: '', backgroundImage: '', headerContent: '{logo}\n{institute_name}\n{institute_address} · {institute_phone_no} · {institute_email}\n{exam_name}', footerContent: '{left_signature}\nClass Teacher\n\n{middle_signature}\nHead of School\n\n{right_signature}\nPrincipal\n\nPrinted {print_date}', reportOptions: '["Attendance Percentage", "Grading Scale", "Position", "Class Average", "Subject Position", "Remark"]', createdAt: '2024-05-15' },
    { id: 'seed-mst-2', branch: 'Airport City Flagship', examName: 'Mid-Term Assessment', templateName: 'Sample(A4 Portrait) 2', pageLayout: 'Portrait', photoStyle: 'Square - 240', topSpace: '15', bottomSpace: '15', rightSpace: '12', leftSpace: '12', leftSignature: '', middleSignature: '', rightSignature: '', logoImage: '', backgroundImage: '', headerContent: '{institute_name}\n{exam_name}\n{academic_session} · {class}{section} · {student_photo}', footerContent: '{teacher_comments}\n{principal_comments}\n\n{left_signature}   {middle_signature}   {right_signature}\nPrinted {print_date}', reportOptions: '["Attendance Percentage", "Grading Scale", "Position", "Cumulative Average", "Class Average", "Subject Position", "Remark", "Result"]', createdAt: '2024-05-15' },
    { id: 'seed-mst-3', branch: 'Airport City Flagship', examName: 'End of Term Examination', templateName: 'Sample(A4 Landscape) 3', pageLayout: 'Landscape', photoStyle: 'Square - 320', topSpace: '18', bottomSpace: '18', rightSpace: '14', leftSpace: '14', leftSignature: '', middleSignature: '', rightSignature: '', logoImage: '', backgroundImage: '', headerContent: '{logo}\n{institute_name}\n{institute_address} · {institute_phone_no} · {institute_email}\n{exam_name}', footerContent: '{left_signature}\nClass Teacher\n\n{middle_signature}\nHead of School\n\n{right_signature}\nPrincipal\n\nPrinted {print_date}', reportOptions: '["Attendance Percentage", "Position", "Cumulative Average", "Remark"]', createdAt: '2024-05-15' },
  ],
  markDistribution: [
    { id: 'seed-md-1', name: 'Class Work', maxMarks: '20', sortOrder: '1' },
    { id: 'seed-md-2', name: 'Home Work', maxMarks: '20', sortOrder: '2' },
    { id: 'seed-md-3', name: 'Exams', maxMarks: '60', sortOrder: '3' },
    { id: 'seed-md-4', name: 'SBA (50%)', maxMarks: '50', sortOrder: '4' },
    { id: 'seed-md-5', name: 'EXAMS (50%)', maxMarks: '50', sortOrder: '5' },
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
  classBreaks: [
    { id: 'seed-break-1', className: 'Basic 7 A', classNames: '["Basic 7 A","Basic 8 A","Basic 9 B"]', applyToAll: 'Yes', name: 'Opening Assembly', short: 'OA', printText: '', printTextCustom: '', printFontSize: '12', beforePeriodIndex: '0', startTime: '07:45', endTime: '08:00', timeEdited: 'Yes' },
    { id: 'seed-break-2', className: 'Basic 7 A', classNames: '["Basic 7 A","Basic 8 A","Basic 9 B"]', applyToAll: 'Yes', name: 'Mid-Morning Break', short: 'MMB', printText: '', printTextCustom: '', printFontSize: '12', beforePeriodIndex: '4', startTime: '11:00', endTime: '11:15', timeEdited: '' },
  ],
  transportRoutes: [
    { id: 'seed-troute-1', routeName: 'Accra Central Route', startPlace: 'Kaneshie', stopPlace: 'Accra Central', routeStops: '[{"stoppageName": "Kaneshie Market", "stopTime": "06:30", "distance": "0", "routeFare": "250", "latitude": "5.5724", "longitude": "-0.2269"}, {"stoppageName": "Circle Overpass", "stopTime": "06:55", "distance": "6", "routeFare": "250", "latitude": "5.5735", "longitude": "-0.2074"}]', pickupPoints: 'Kaneshie Market, Circle Overpass', departureTime: '06:30', returnTime: '15:30', fare: '250', status: 'Active' },
    { id: 'seed-troute-2', routeName: 'East Legon Route', startPlace: 'Madina', stopPlace: 'East Legon', routeStops: '[{"stoppageName": "Madina Market", "stopTime": "06:15", "distance": "0", "routeFare": "300", "latitude": "5.6830", "longitude": "-0.1660"}, {"stoppageName": "Legon Campus Gate", "stopTime": "06:45", "distance": "8", "routeFare": "300", "latitude": "5.6500", "longitude": "-0.1870"}]', pickupPoints: 'Madina Market, Legon Campus Gate', departureTime: '06:15', returnTime: '15:15', fare: '300', status: 'Active' },
    { id: 'seed-troute-3', routeName: 'Tema Community Route', startPlace: 'Tema Community 1', stopPlace: 'Tema', routeStops: '[{"stoppageName": "Community 1", "stopTime": "05:50", "distance": "0", "routeFare": "350", "latitude": "5.6698", "longitude": "0.0166"}, {"stoppageName": "Community 22", "stopTime": "06:30", "distance": "11", "routeFare": "350", "latitude": "5.6900", "longitude": "-0.0100"}]', pickupPoints: 'Community 1', departureTime: '05:50', returnTime: '15:45', fare: '350', status: 'Active' },
    { id: 'seed-troute-4', routeName: 'Madina-Adenta Route', startPlace: 'Adenta', stopPlace: 'Madina', routeStops: '[{"stoppageName": "Adenta Barrier", "stopTime": "06:00", "distance": "0", "routeFare": "280", "latitude": "5.7167", "longitude": "-0.1361"}, {"stoppageName": "Madina Zongo Junction", "stopTime": "06:25", "distance": "5", "routeFare": "280", "latitude": "5.6890", "longitude": "-0.1700"}]', pickupPoints: 'Adenta Barrier', departureTime: '06:00', returnTime: '15:30', fare: '280', status: 'Active' },
    { id: 'seed-troute-5', routeName: 'Kasoa-Kaneshie Route', startPlace: 'Kasoa', stopPlace: 'Kaneshie', routeStops: '[{"stoppageName": "Kasoa New Market", "stopTime": "05:40", "distance": "0", "routeFare": "320", "latitude": "5.5333", "longitude": "-0.4833"}, {"stoppageName": "Kaneshie First Light", "stopTime": "06:40", "distance": "18", "routeFare": "320", "latitude": "5.5700", "longitude": "-0.2300"}]', pickupPoints: 'Kasoa New Market', departureTime: '05:40', returnTime: '15:50', fare: '320', status: 'Active' },
  ],
  transportVehicles: [
    { id: 'seed-tvehicle-1', vehicleNo: 'GT 4582-25', vehicleType: 'Toyota Hiace', vehicleCategory: 'Minibus', yearMade: '2022', registrationNo: 'GE 4582-25', chassisNo: 'JTFSS22P0N0123456', capacity: '18', driverName: 'Kwesi Owusu', driverLicence: 'GHA-DRV-20415', driverPhone: '024 555 0201', status: 'Active' },
    { id: 'seed-tvehicle-2', vehicleNo: 'GN 3174-24', vehicleType: 'Nissan Urvan', vehicleCategory: 'Minibus', yearMade: '2021', registrationNo: 'GN 3174-24', chassisNo: 'JN1TC2E26M0013579', capacity: '15', driverName: 'Kofi Mensah', driverLicence: 'GHA-DRV-19872', driverPhone: '020 555 0202', status: 'Active' },
    { id: 'seed-tvehicle-3', vehicleNo: 'GS 9021-25', vehicleType: 'Hyundai County', vehicleCategory: 'Bus', yearMade: '2023', registrationNo: 'GS 9021-25', chassisNo: 'KMJHG17HPPC004321', capacity: '30', driverName: 'Akua Ofori', driverLicence: 'GHA-DRV-21763', driverPhone: '055 555 0203', status: 'Active' },
  ],
  transportStoppage: [
    { id: 'seed-tstop-1', stoppageName: 'Kaneshie Market', routeName: 'Accra Central Route', routeFare: '250', location: 'Kaneshie Station entrance', pickupTime: '06:30', stopOrder: '1', status: 'Active' },
    { id: 'seed-tstop-2', stoppageName: 'Circle Overpass', routeName: 'Accra Central Route', routeFare: '250', location: 'Circle Overpass, near the station', pickupTime: '06:45', stopOrder: '2', status: 'Active' },
    { id: 'seed-tstop-3', stoppageName: 'Madina Market', routeName: 'East Legon Route', routeFare: '300', location: 'Madina Market taxi rank', pickupTime: '06:15', stopOrder: '1', status: 'Active' },
    { id: 'seed-tstop-4', stoppageName: 'Legon Campus Gate', routeName: 'East Legon Route', routeFare: '300', location: 'University main gate', pickupTime: '06:35', stopOrder: '2', status: 'Active' },
    { id: 'seed-tstop-5', stoppageName: 'Community 1', routeName: 'Tema Community Route', routeFare: '350', location: 'Community 1 taxi rank', pickupTime: '05:50', stopOrder: '1', status: 'Active' },
    { id: 'seed-tstop-6', stoppageName: 'Kasoa New Market', routeName: 'Kasoa-Kaneshie Route', routeFare: '320', location: 'Kasoa New Market entrance', pickupTime: '05:40', stopOrder: '1', status: 'Active' },
  ],
  transportVehicleAssignments: [
    { id: 'seed-tva-1', routeName: 'Accra Central Route', vehicleNo: 'GT 4582-25', status: 'Active', remarks: 'Primary morning shuttle for Accra Central' },
    { id: 'seed-tva-2', routeName: 'East Legon Route', vehicleNo: 'GN 3174-24', status: 'Active', remarks: 'Daily service for East Legon corridor' },
    { id: 'seed-tva-3', routeName: 'Tema Community Route', vehicleNo: 'GS 9021-25', status: 'Active', remarks: 'Long-distance Community 1 shuttle' },
    { id: 'seed-tva-4', routeName: 'Madina-Adenta Route', vehicleNo: 'GN 3174-24', status: 'Active', remarks: 'Afternoon backup vehicle for Madina-Adenta' },
    { id: 'seed-tva-5', routeName: 'Kasoa-Kaneshie Route', vehicleNo: 'GS 9021-25', status: 'Active', remarks: 'High-capacity service for Kasoa route' },
  ],
  transportPersonnel: [
    { id: 'seed-tp-1', role: 'Driver', employeeId: 'EMP-TR-001', fullName: 'Kofi Mensah', phoneNumber: '024 411 2233', email: 'kofi.mensah@school.edu.gh', licenseNumber: 'DL-882314', licenseExpiryDate: '2026-11-10', address: '12 Spintex Road, Accra', emergencyContact: 'Akosua Mensah · 024 900 1122', assignedRoute: 'Accra Central Route', assignedVehicle: 'GT 4582-25', employmentStatus: 'Active' },
    { id: 'seed-tp-2', role: 'Driver', employeeId: 'EMP-TR-002', fullName: 'Yaw Boateng', phoneNumber: '020 733 8890', email: 'yaw.boateng@school.edu.gh', licenseNumber: 'DL-771902', licenseExpiryDate: '2026-09-30', address: 'House 8, Madina Estates', emergencyContact: 'Adjoa Boateng · 055 221 7788', assignedRoute: 'Madina-Adenta Route', assignedVehicle: 'GN 3174-24', employmentStatus: 'Active' },
    { id: 'seed-tp-3', role: 'Driver', employeeId: 'EMP-TR-003', fullName: 'Samuel Adjei', phoneNumber: '027 655 4411', email: 'samuel.adjei@school.edu.gh', licenseNumber: 'DL-654120', licenseExpiryDate: '2027-06-30', address: 'Community 22, Tema', emergencyContact: 'Grace Adjei · 024 118 9900', assignedRoute: 'Tema Community Route', assignedVehicle: 'GS 9021-25', employmentStatus: 'Active' },
    { id: 'seed-tp-4', role: 'Attendant', employeeId: 'EMP-TR-004', fullName: 'Abena Serwah', phoneNumber: '024 300 5566', email: 'abena.serwah@school.edu.gh', licenseNumber: 'ID-448201', licenseExpiryDate: '2027-03-31', address: 'East Legon Hills, Accra', emergencyContact: 'Nana Serwah · 020 887 4455', assignedRoute: 'East Legon Route', assignedVehicle: 'GN 3174-24', employmentStatus: 'Active' },
    { id: 'seed-tp-5', role: 'Attendant', employeeId: 'EMP-TR-005', fullName: 'Fatima Issah', phoneNumber: '055 122 3344', email: 'fatima.issah@school.edu.gh', licenseNumber: '', licenseExpiryDate: '', address: 'Kasoa New Market, Central Region', emergencyContact: 'Issah Musah · 027 445 6677', assignedRoute: 'Kasoa-Kaneshie Route', assignedVehicle: 'GS 9021-25', employmentStatus: 'On Leave' },
  ],
  transportPersonnelHistory: [
    { id: 'seed-tph-1', date: '2026-08-03', personnelName: 'Kofi Mensah', employeeId: 'EMP-TR-001', role: 'Driver', previousRoute: '', previousVehicle: '', assignedRoute: 'Accra Central Route', assignedVehicle: 'GT 4582-25', action: 'Assigned', remarks: 'Kofi Mensah added to Drivers & Attendants' },
    { id: 'seed-tph-2', date: '2026-08-03', personnelName: 'Yaw Boateng', employeeId: 'EMP-TR-002', role: 'Driver', previousRoute: '', previousVehicle: '', assignedRoute: 'Madina-Adenta Route', assignedVehicle: 'GN 3174-24', action: 'Assigned', remarks: 'Yaw Boateng added to Drivers & Attendants' },
    { id: 'seed-tph-3', date: '2026-09-14', personnelName: 'Abena Serwah', employeeId: 'EMP-TR-004', role: 'Attendant', previousRoute: 'Accra Central Route', previousVehicle: 'GT 4582-25', assignedRoute: 'East Legon Route', assignedVehicle: 'GN 3174-24', action: 'Reassigned', remarks: 'Moved to East Legon to cover increased morning demand' },
    { id: 'seed-tph-4', date: '2026-10-05', personnelName: 'Fatima Issah', employeeId: 'EMP-TR-005', role: 'Attendant', previousRoute: 'Kasoa-Kaneshie Route', previousVehicle: 'GS 9021-25', assignedRoute: '', assignedVehicle: '', action: 'Unassigned', remarks: 'Granted leave pending license renewal' },
  ],
  transportFees: [
    { id: 'seed-tfee-1', academicYear: '2026/2027', term: '["Term 1"]', routeName: 'Accra Central Route', pickupPoint: '', vehicleCategory: '', feeStructure: 'Termly', amount: '250', discountPercent: '', siblingSecondPercent: '10', siblingThirdPercent: '20', effectiveDate: '2026-09-01', status: 'Approved', remarks: 'Standard termly charge for the Accra Central corridor' },
    { id: 'seed-tfee-2', academicYear: '2026/2027', term: '["Term 1"]', routeName: 'East Legon Route', pickupPoint: '', vehicleCategory: '', feeStructure: 'Termly', amount: '300', discountPercent: '5', siblingSecondPercent: '10', siblingThirdPercent: '25', effectiveDate: '2026-09-01', status: 'Approved', remarks: 'Includes the 5% early-payment discount' },
    { id: 'seed-tfee-3', academicYear: '2026/2027', term: '["Term 1"]', routeName: 'Tema Community Route', pickupPoint: '', vehicleCategory: 'Bus', feeStructure: 'Monthly', amount: '120', discountPercent: '', siblingSecondPercent: '10', siblingThirdPercent: '15', effectiveDate: '2026-09-01', status: 'Approved', remarks: 'Charged per month for the length of the term' },
    { id: 'seed-tfee-4', academicYear: '2026/2027', term: '[]', routeName: 'Kasoa-Kaneshie Route', pickupPoint: '', vehicleCategory: '', feeStructure: 'Annual', amount: '900', discountPercent: '', siblingSecondPercent: '10', siblingThirdPercent: '20', effectiveDate: '2026-09-01', status: 'Approved', remarks: 'One annual charge covering every term' },
    { id: 'seed-tfee-5', academicYear: '2026/2027', term: '["Term 1"]', routeName: 'Madina-Adenta Route', pickupPoint: '', vehicleCategory: '', feeStructure: 'Termly', amount: '280', discountPercent: '', siblingSecondPercent: '', siblingThirdPercent: '', effectiveDate: '2026-09-01', status: 'Draft', remarks: 'Awaiting finance approval' },
  ],
  transportFeeAdjustments: [
    { id: 'seed-tfa-1', date: '2026-09-20', student: 'Kojo Antwi', academicYear: '2026/2027', term: 'Term 1', adjustmentType: 'Discount %', value: '15', reason: 'Staff child concession', status: 'Approved', remarks: 'Applies when the Term 1 transport charge is posted.' },
    { id: 'seed-tfa-2', date: '2026-10-02', student: 'Efua Dadzie', academicYear: '2026/2027', term: 'Term 1', adjustmentType: 'Sibling Concession', value: '10', reason: 'Second child uses the school bus', status: 'Pending', remarks: 'Awaiting bursar approval.' },
  ],
  transportFeeHistory: [
    { id: 'seed-tfh-1', date: '2026-08-20', feeRef: 'Accra Central Route · Termly', action: 'Created', fieldChanged: '', previousValue: '', newValue: '250', amountBefore: '', amountAfter: '250', changedBy: 'Transport Officer', remarks: 'Termly rate card created' },
    { id: 'seed-tfh-2', date: '2026-08-25', feeRef: 'Accra Central Route · Termly', action: 'Approved', fieldChanged: 'Status', previousValue: 'Pending Approval', newValue: 'Approved', amountBefore: '', amountAfter: '250', changedBy: 'Bursar', remarks: 'Termly · GHS 250.00' },
    { id: 'seed-tfh-3', date: '2026-09-05', feeRef: 'East Legon Route · Termly', action: 'Posted to Billing', fieldChanged: '', previousValue: '', newValue: '2 student bill(s)', amountBefore: '', amountAfter: '570.00', changedBy: 'Bursar', remarks: '2026/2027 · Term 1' },
  ],
  studentTransportAssignments: [
    { id: 'seed-tsa-1', student: 'Ama Owusu', studentId: 'seed-st-1', className: 'Basic 7 A', routeName: 'Accra Central Route', vehicleNo: 'GT 4582-25', pickupPoint: 'Kaneshie Market', fee: '250', status: 'Active' },
    { id: 'seed-tsa-2', student: 'Kwame Asante', studentId: 'seed-st-2', className: 'Basic 7 A', routeName: 'Accra Central Route', vehicleNo: 'GT 4582-25', pickupPoint: 'Circle Overpass', fee: '250', status: 'Active' },
    { id: 'seed-tsa-3', student: 'Efua Dadzie', studentId: 'seed-st-3', className: 'Basic 8 A', routeName: 'East Legon Route', vehicleNo: 'GN 3174-24', pickupPoint: 'Madina Market', fee: '300', status: 'Active' },
    { id: 'seed-tsa-4', student: 'Kojo Antwi', studentId: 'seed-st-4', className: 'Basic 9 B', routeName: 'Tema Community Route', vehicleNo: 'GS 9021-25', pickupPoint: 'Community 1', fee: '350', status: 'Active' },
    { id: 'seed-tsa-5', student: 'Adwoa Serwaa', studentId: 'seed-st-5', className: 'Basic 8 A', routeName: 'Kasoa-Kaneshie Route', vehicleNo: 'GS 9021-25', pickupPoint: 'Kasoa New Market', fee: '320', status: 'Active' },
  ],
  transportGpsSettings: [
    { id: 'seed-gps-set-1', demoMode: 'Yes', recordPings: 'Yes', mapStyle: 'Street', pollSeconds: '15', speedLimitKmh: '60', deviationMeters: '250', geofenceRadiusMeters: '150', shareLiveLocation: 'Yes', shareEta: 'Yes', notifyParentsOnDelay: 'Yes', delayThresholdMinutes: '10' },
  ],
  transportGeofences: [
    { id: 'seed-geofence-1', name: 'School Campus', type: 'School', routeName: '', latitude: '5.6037', longitude: '-0.1870', radiusMeters: '250', active: 'Yes' },
    { id: 'seed-geofence-2', name: 'Kaneshie Market', type: 'Stop', routeName: 'Accra Central Route', latitude: '5.5724', longitude: '-0.2269', radiusMeters: '150', active: 'Yes' },
    { id: 'seed-geofence-3', name: 'Vehicle Depot', type: 'Depot', routeName: '', latitude: '5.5900', longitude: '-0.2100', radiusMeters: '200', active: 'Yes' },
    { id: 'seed-geofence-4', name: 'Adenta Highway Works', type: 'Hazard', routeName: 'Madina-Adenta Route', latitude: '5.7167', longitude: '-0.1361', radiusMeters: '300', active: 'Yes' },
  ],
  transportGpsAlerts: [
    { id: 'seed-gpsalert-1', date: '2026-10-19', time: '07:12', type: 'Overspeed', severity: 'Warning', vehicleNo: 'GS 9021-25', routeName: 'Tema Community Route', message: 'GS 9021-25 reached 74 km/h (limit 60 km/h) on the Tema motorway stretch.', latitude: '5.6800', longitude: '-0.0030', status: 'Open', acknowledgedBy: '', remarks: '' },
    { id: 'seed-gpsalert-2', date: '2026-10-19', time: '06:48', type: 'Route Deviation', severity: 'Warning', vehicleNo: 'GN 3174-24', routeName: 'East Legon Route', message: 'GN 3174-24 was 420 m off the East Legon Route path near Madina Market.', latitude: '5.6900', longitude: '-0.1580', status: 'Acknowledged', acknowledgedBy: 'Transport Officer', remarks: 'Driver diverted for a road closure.' },
  ],
  transportGpsParentAccess: [
    { id: 'seed-gpsaccess-1', student: 'Ama Owusu', studentId: 'seed-st-1', className: 'Basic 7 A', routeName: 'Accra Central Route', visibility: 'Live location + ETA', notifyOnDelay: 'Yes' },
    { id: 'seed-gpsaccess-2', student: 'Efua Dadzie', studentId: 'seed-st-3', className: 'Basic 8 A', routeName: 'East Legon Route', visibility: 'ETA only', notifyOnDelay: 'Yes' },
    { id: 'seed-gpsaccess-3', student: 'Kojo Antwi', studentId: 'seed-st-4', className: 'Basic 9 B', routeName: 'Tema Community Route', visibility: 'No tracking', notifyOnDelay: 'No' },
  ],
  transportGpsLogs: [
    { id: 'seed-gpslog-1', date: '2026-10-19', time: '06:30', vehicleNo: 'GT 4582-25', routeName: 'Accra Central Route', trip: 'Morning Pickup', event: 'At stop', latitude: '5.5724', longitude: '-0.2269', speedKmh: '0', stopName: 'Kaneshie Market', progressPct: '0', etaMinutes: '25', geofences: '["Kaneshie Market"]', source: 'Simulated', remarks: '' },
    { id: 'seed-gpslog-2', date: '2026-10-19', time: '06:41', vehicleNo: 'GT 4582-25', routeName: 'Accra Central Route', trip: 'Morning Pickup', event: 'En route', latitude: '5.5730', longitude: '-0.2170', speedKmh: '26', stopName: '', progressPct: '38', etaMinutes: '14', geofences: '[]', source: 'Simulated', remarks: '' },
    { id: 'seed-gpslog-3', date: '2026-10-19', time: '06:55', vehicleNo: 'GT 4582-25', routeName: 'Accra Central Route', trip: 'Morning Pickup', event: 'At stop', latitude: '5.5735', longitude: '-0.2074', speedKmh: '0', stopName: 'Circle Overpass', progressPct: '75', etaMinutes: '6', geofences: '[]', source: 'Simulated', remarks: '' },
    { id: 'seed-gpslog-4', date: '2026-10-19', time: '07:05', vehicleNo: 'GT 4582-25', routeName: 'Accra Central Route', trip: 'Morning Pickup', event: 'En route', latitude: '5.5870', longitude: '-0.1950', speedKmh: '31', stopName: '', progressPct: '92', etaMinutes: '2', geofences: '["School Campus"]', source: 'Simulated', remarks: 'Approaching campus' },
  ],
  transportVehicleMaintenance: [
    { id: 'seed-maint-1', date: '2026-09-05', vehicleNo: 'GT 4582-25', serviceType: 'Routine Service', description: 'Engine oil, oil filter and air filter change; full safety inspection', garage: 'Accra Fleet Care', odometerKm: '48210', cost: '860.00', downtimeDays: '1', performedBy: 'Accra Fleet Care', nextServiceDate: '2026-12-05', status: 'Completed', remarks: '' },
    { id: 'seed-maint-2', date: '2026-09-18', vehicleNo: 'GS 9021-25', serviceType: 'Brakes', description: 'Front brake pads and discs replaced, brake fluid flushed', garage: 'Tema Auto Works', odometerKm: '62140', cost: '1450.00', downtimeDays: '2', performedBy: 'Kwame Mensah', nextServiceDate: '2027-01-18', status: 'Completed', remarks: 'Pads were below the wear limit at inspection.' },
    { id: 'seed-maint-3', date: '2026-10-02', vehicleNo: 'GN 3174-24', serviceType: 'Tyres', description: 'Two new rear tyres fitted and wheel balancing', garage: 'Madina Tyre Bay', odometerKm: '39880', cost: '1120.00', downtimeDays: '1', performedBy: 'Madina Tyre Bay', nextServiceDate: '2026-12-20', status: 'Completed', remarks: '' },
    { id: 'seed-maint-4', date: '2026-10-12', vehicleNo: 'GT 4582-25', serviceType: 'Breakdown Repair', description: 'Alternator failed on the morning run — replaced and battery tested', garage: 'Accra Fleet Care', odometerKm: '49120', cost: '690.00', downtimeDays: '2', performedBy: 'Accra Fleet Care', nextServiceDate: '2026-12-05', status: 'Completed', remarks: 'Vehicle off the road for two days; route covered by GS 9021-25.' },
    { id: 'seed-maint-5', date: '2026-10-16', vehicleNo: 'GS 9021-25', serviceType: 'Roadworthiness Inspection', description: 'Annual roadworthiness inspection and insurance valuation', garage: 'DVLA Inspection Bay', odometerKm: '62700', cost: '320.00', downtimeDays: '1', performedBy: 'Driver — Kojo Antwi', nextServiceDate: '2026-10-30', status: 'In Progress', remarks: 'Awaiting certificate collection.' },
    { id: 'seed-maint-6', date: '2026-10-22', vehicleNo: 'GN 3174-24', serviceType: 'Oil & Filter Change', description: 'Interim oil and filter change before the end-of-term run', garage: 'Madina Tyre Bay', odometerKm: '40100', cost: '480.00', downtimeDays: '0', performedBy: 'Madina Tyre Bay', nextServiceDate: '2027-01-22', status: 'Scheduled', remarks: '' },
  ],
  studentBilling: [
    { id: 'seed-bill-1', student: 'Ama Owusu', className: 'Basic 7 A', billingDate: '2026-09-08', amount: '250.00', status: 'Paid', feeType: 'Transport', academicYear: '2026/2027', term: 'Term 1', reference: 'TF:seed-fee-1:seed-st-1:Term 1', remarks: 'Accra Central Route · Bus' },
    { id: 'seed-bill-2', student: 'Kwame Asante', className: 'Basic 5 B', billingDate: '2026-09-08', amount: '250.00', status: 'Partial', feeType: 'Transport', academicYear: '2026/2027', term: 'Term 1', reference: 'TF:seed-fee-1:seed-st-2:Term 1', remarks: 'Accra Central Route · Bus' },
    { id: 'seed-bill-3', student: 'Efua Dadzie', className: 'Basic 8 A', billingDate: '2026-09-08', amount: '300.00', status: 'Paid', feeType: 'Transport', academicYear: '2026/2027', term: 'Term 1', reference: 'TF:seed-fee-2:seed-st-3:Term 1', remarks: 'East Legon Route · Minibus' },
    { id: 'seed-bill-4', student: 'Kojo Antwi', className: 'Basic 9 B', billingDate: '2026-09-08', amount: '408.00', status: 'Unpaid', feeType: 'Transport', academicYear: '2026/2027', term: 'Term 1', reference: 'TF:seed-fee-3:seed-st-4:Term 1', remarks: 'Tema Community Route · Bus' },
    { id: 'seed-bill-5', student: 'Adwoa Serwaa', className: 'Basic 6 A', billingDate: '2026-09-08', amount: '225.00', status: 'Paid', feeType: 'Transport', academicYear: '2026/2027', term: 'Term 1', reference: 'TF:seed-fee-1:seed-st-5:Term 1', remarks: 'Accra Central Route · Bus · sibling #2 −10%' },
    { id: 'seed-bill-6', student: 'Kojo Antwi', className: 'Basic 9 B', billingDate: '2026-08-04', amount: '408.00', status: 'Unpaid', feeType: 'Transport', academicYear: '2025/2026', term: 'Term 3', reference: 'TF:seed-fee-3:seed-st-4:Term 3', remarks: 'Tema Community Route · Bus · carried forward' },
    { id: 'seed-bill-7', student: 'Kwame Asante', className: 'Basic 5 B', billingDate: '2026-08-04', amount: '250.00', status: 'Unpaid', feeType: 'Transport', academicYear: '2025/2026', term: 'Term 3', reference: 'TF:seed-fee-1:seed-st-2:Term 3', remarks: 'Accra Central Route · Bus · carried forward' },
  ],
  transportAttendance: [
    { id: 'seed-tat-1', date: '2026-10-19', student: 'Ama Owusu', studentId: 'seed-st-1', className: 'Basic 7 A', routeName: 'Accra Central Route', vehicleNo: 'GT 4582-25', pickupPoint: 'Kaneshie Market', trip: 'Morning Pickup', status: 'Picked Up', time: '06:35', remarks: '' },
    { id: 'seed-tat-2', date: '2026-10-19', student: 'Kwame Asante', studentId: 'seed-st-2', className: 'Basic 7 A', routeName: 'Accra Central Route', vehicleNo: 'GT 4582-25', pickupPoint: 'Circle Overpass', trip: 'Morning Pickup', status: 'Picked Up', time: '06:41', remarks: '' },
    { id: 'seed-tat-3', date: '2026-10-19', student: 'Efua Dadzie', studentId: 'seed-st-3', className: 'Basic 8 A', routeName: 'East Legon Route', vehicleNo: 'GN 3174-24', pickupPoint: 'Madina Market', trip: 'Morning Pickup', status: 'Late Pickup', time: '07:05', remarks: 'Arrived 20 minutes late at the pickup point' },
    { id: 'seed-tat-4', date: '2026-10-19', student: 'Kojo Antwi', studentId: 'seed-st-4', className: 'Basic 9 B', routeName: 'Tema Community Route', vehicleNo: 'GS 9021-25', pickupPoint: 'Community 1', trip: 'Morning Pickup', status: 'Absent', time: '', remarks: 'Guardian reported sickness' },
    { id: 'seed-tat-5', date: '2026-10-19', student: 'Adwoa Serwaa', studentId: 'seed-st-5', className: 'Basic 8 A', routeName: 'Kasoa-Kaneshie Route', vehicleNo: 'GS 9021-25', pickupPoint: 'Kasoa New Market', trip: 'Afternoon Drop-off', status: 'Dropped Off', time: '15:20', remarks: '' },
  ],
  lateFeeRules: [
    { id: 'seed-lf-1', name: 'Standard Late Fee', graceDays: '7', chargePerDay: '5' },
  ],
}

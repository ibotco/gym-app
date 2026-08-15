import type {
  User, Member, Trainer, StaffRecord, Plan, Membership, Payment, Invoice,
  GymClass, Booking, Attendance, WorkoutPlan, ProgressLog, NotificationItem,
  Branch, Lead, Message, AuditLog, LeaveRequest, SessionBooking, BlogPost,
  Testimonial, CompanySettings,
} from '../types'

export const COMPANY: CompanySettings = {
  name: 'FitPro',
  legalName: 'FitPro Gym Management Ltd.',
  email: 'hello@fitpro.gym',
  phone: '+233 30 396 4400',
  whatsapp: '233244889900',
  address: 'Airport City, Accra, Ghana',
  taxId: 'C0067843210',
  currency: 'GHS',
  timezone: 'Africa/Accra',
  brandPrimary: '#C8F542',
  logoText: 'FitPro',
  languages: ['en', 'fr', 'tw'],
  emailLoginValidation: true,
}

export const BRANCHES: Branch[] = [
  { id: 'br_airport', name: 'Airport City Flagship', address: 'One Airport Square, Airport City', city: 'Accra', phone: '+233 30 396 4401', managerId: 'u_manager', members: 842, capacity: 1200, hours: '05:00 – 23:00', lat: 5.605, lng: -0.175 },
  { id: 'br_osu', name: 'Osu Oxford', address: 'Oxford Street, Osu', city: 'Accra', phone: '+233 30 277 1102', managerId: 'u_manager', members: 614, capacity: 800, hours: '05:30 – 22:30', lat: 5.556, lng: -0.183 },
  { id: 'br_legon', name: 'East Legon', address: 'American House, East Legon', city: 'Accra', phone: '+233 30 254 8803', managerId: 'u_manager', members: 531, capacity: 700, hours: '06:00 – 22:00', lat: 5.636, lng: -0.151 },
  { id: 'br_tema', name: 'Tema Community 4', address: 'Community 4 Commercial, Tema', city: 'Tema', phone: '+233 30 320 9904', managerId: 'u_manager', members: 388, capacity: 550, hours: '05:30 – 22:00', lat: 5.669, lng: 0.017 },
]

export const USERS: User[] = [
  { id: 'u_admin', email: 'superadmin@fitpro.gym', password: 'demo123', name: 'Naa Adjeley Quaye', role: 'super_admin', avatar: '/images/member-ava-5.jpg', phone: '+233 24 111 0001', status: 'active', createdAt: '2023-01-08', lastLogin: '2026-08-13T07:10:00' },
  { id: 'u_manager', email: 'manager@fitpro.gym', password: 'demo123', name: 'Kwesi Ampofo', role: 'gym_manager', avatar: '/images/member-ava-2.jpg', phone: '+233 24 111 0002', branchId: 'br_airport', status: 'active', createdAt: '2023-02-14', lastLogin: '2026-08-13T06:40:00' },
  { id: 'u_trainer', email: 'trainer@fitpro.gym', password: 'demo123', name: 'Kojo Mensah', role: 'trainer', avatar: '/images/trainer-1.jpg', phone: '+233 24 111 0003', branchId: 'br_airport', status: 'active', createdAt: '2023-03-01' },
  { id: 'u_trainer2', email: 'amara@fitpro.gym', password: 'demo123', name: 'Amara Cole', role: 'trainer', avatar: '/images/trainer-2.jpg', phone: '+233 24 111 0004', branchId: 'br_osu', status: 'active', createdAt: '2023-04-12' },
  { id: 'u_trainer3', email: 'erik@fitpro.gym', password: 'demo123', name: 'Erik Holm', role: 'trainer', avatar: '/images/trainer-3.jpg', phone: '+233 24 111 0005', branchId: 'br_legon', status: 'active', createdAt: '2023-05-20' },
  { id: 'u_trainer4', email: 'priya@fitpro.gym', password: 'demo123', name: 'Priya Nair', role: 'trainer', avatar: '/images/trainer-4.jpg', phone: '+233 24 111 0006', branchId: 'br_airport', status: 'active', createdAt: '2023-06-02' },
  { id: 'u_staff', email: 'staff@fitpro.gym', password: 'demo123', name: 'Abena Sarpong', role: 'staff', avatar: '/images/member-ava-3.jpg', phone: '+233 24 111 0007', branchId: 'br_airport', status: 'active', createdAt: '2023-07-18' },
  { id: 'u_staff2', email: 'front@fitpro.gym', password: 'demo123', name: 'Yaw Boateng', role: 'staff', avatar: '/images/member-ava-6.jpg', phone: '+233 24 111 0008', branchId: 'br_osu', status: 'active', createdAt: '2024-01-09' },
  { id: 'u_member', email: 'member@fitpro.gym', password: 'demo123', name: 'Ama Boateng', role: 'member', avatar: '/images/success-1.jpg', phone: '+233 24 555 0101', branchId: 'br_airport', status: 'active', createdAt: '2024-03-11' },
  { id: 'u_m2', email: 'kofi.asante@mail.com', password: 'demo123', name: 'Kofi Asante', role: 'member', avatar: '/images/success-2.jpg', phone: '+233 24 555 0102', branchId: 'br_airport', status: 'active', createdAt: '2024-01-20' },
  { id: 'u_m3', email: 'efua.adjei@mail.com', password: 'demo123', name: 'Efua Adjei', role: 'member', avatar: '/images/success-3.jpg', phone: '+233 24 555 0103', branchId: 'br_osu', status: 'active', createdAt: '2024-05-02' },
  { id: 'u_m4', email: 'nii.armah@mail.com', password: 'demo123', name: 'Nii Armah', role: 'member', avatar: '/images/member-ava-4.jpg', phone: '+233 24 555 0104', branchId: 'br_legon', status: 'active', createdAt: '2023-11-15' },
  { id: 'u_m5', email: 'akosua.darko@mail.com', password: 'demo123', name: 'Akosua Darko', role: 'member', avatar: '/images/member-ava-5.jpg', phone: '+233 24 555 0105', branchId: 'br_tema', status: 'active', createdAt: '2025-02-08' },
  { id: 'u_m6', email: 'joseph.owusu@mail.com', password: 'demo123', name: 'Joseph Owusu', role: 'member', avatar: '/images/member-ava-2.jpg', phone: '+233 24 555 0106', branchId: 'br_airport', status: 'inactive', createdAt: '2023-08-22' },
  { id: 'u_m7', email: 'adwoa.mensah@mail.com', password: 'demo123', name: 'Adwoa Mensah', role: 'member', avatar: '/images/member-ava-3.jpg', phone: '+233 24 555 0107', branchId: 'br_osu', status: 'active', createdAt: '2025-06-19' },
  { id: 'u_m8', email: 'samuel.tetteh@mail.com', password: 'demo123', name: 'Samuel Tetteh', role: 'member', avatar: '/images/member-ava-6.jpg', phone: '+233 24 555 0108', branchId: 'br_legon', status: 'suspended', createdAt: '2024-09-01' },
  { id: 'u_m9', email: 'maame.serwaa@mail.com', password: 'demo123', name: 'Maame Serwaa', role: 'member', avatar: '/images/member-ava-1.jpg', phone: '+233 24 555 0109', branchId: 'br_airport', status: 'active', createdAt: '2025-11-03' },
  { id: 'u_m10', email: 'daniel.kumi@mail.com', password: 'demo123', name: 'Daniel Kumi', role: 'member', avatar: '/images/member-ava-4.jpg', phone: '+233 24 555 0110', branchId: 'br_tema', status: 'active', createdAt: '2024-07-14' },
]

export const PLANS: Plan[] = [
  { id: 'pl_month', name: 'Studio Monthly', type: 'monthly', price: 280, durationDays: 30, popular: false, active: true, color: '#a1a1aa', features: ['All group classes', 'Open gym access', '1 guest pass / month', 'FitPro app', 'Locker access'] },
  { id: 'pl_quarter', name: 'Performance Quarterly', type: 'quarterly', price: 720, durationDays: 90, popular: true, active: true, color: '#c8f542', features: ['Everything in Monthly', '2 PT sessions / quarter', 'Nutrition starter plan', 'Priority class booking', 'Sauna & recovery'] },
  { id: 'pl_annual', name: 'Athlete Annual', type: 'annual', price: 2400, durationDays: 365, popular: false, active: true, color: '#60a5fa', features: ['Everything in Quarterly', '8 PT sessions / year', 'Body composition scans', 'Bring-a-friend Fridays', 'Merchandise credit GHS 200'] },
  { id: 'pl_vip', name: 'Black Card VIP', type: 'vip', price: 4800, durationDays: 365, popular: false, active: true, color: '#fbbf24', features: ['All-club access (4 branches)', 'Unlimited guest privileges', 'Weekly PT included', 'Private locker + laundry', 'Concierge booking', 'Recovery suite'] },
  { id: 'pl_day', name: 'Day Pass', type: 'day-pass', price: 60, durationDays: 1, active: true, color: '#fb923c', features: ['Single-day open gym', 'One group class', 'No commitment'] },
]

export const MEMBERS: Member[] = [
  { id: 'mb_1', userId: 'u_member', membershipId: 'ms_1', planId: 'pl_quarter', joinDate: '2024-03-11', emergency: { name: 'Kwabena Boateng', phone: '+233 24 900 1111', relation: 'Spouse' }, medicalNotes: 'Mild asthma — keep inhaler on person.', tags: ['VIP prospect', 'AM regular'], goals: ['Fat loss', '5K run'], heightCm: 168, weightKg: 64.2, dob: '1994-06-18', gender: 'female', address: 'Cantonments, Accra', qrCode: 'FITPRO-MB1-AMA', trainerId: 'tr_1' },
  { id: 'mb_2', userId: 'u_m2', membershipId: 'ms_2', planId: 'pl_vip', joinDate: '2024-01-20', emergency: { name: 'Aba Asante', phone: '+233 24 900 2222', relation: 'Sister' }, medicalNotes: 'Previous ACL reconstruction (2021).', tags: ['Black Card', 'Strength'], goals: ['Hypertrophy', 'Deadlift 200kg'], heightCm: 182, weightKg: 86.4, dob: '1986-02-03', gender: 'male', address: 'Airport Residential', qrCode: 'FITPRO-MB2-KOFI', trainerId: 'tr_3' },
  { id: 'mb_3', userId: 'u_m3', membershipId: 'ms_3', planId: 'pl_annual', joinDate: '2024-05-02', emergency: { name: 'Kweku Adjei', phone: '+233 24 900 3333', relation: 'Brother' }, medicalNotes: '', tags: ['Yoga', 'Wellness'], goals: ['Mobility', 'Stress'], heightCm: 162, weightKg: 58.1, dob: '1998-11-21', gender: 'female', address: 'Labone', qrCode: 'FITPRO-MB3-EFUA', trainerId: 'tr_4' },
  { id: 'mb_4', userId: 'u_m4', membershipId: 'ms_4', planId: 'pl_month', joinDate: '2023-11-15', emergency: { name: 'Akwele Armah', phone: '+233 24 900 4444', relation: 'Mother' }, medicalNotes: 'Hypertension — monitored.', tags: ['Renewal due'], goals: ['Weight loss'], heightCm: 175, weightKg: 92.0, dob: '1979-09-09', gender: 'male', address: 'East Legon Hills', qrCode: 'FITPRO-MB4-NII', trainerId: 'tr_1' },
  { id: 'mb_5', userId: 'u_m5', membershipId: 'ms_5', planId: 'pl_quarter', joinDate: '2025-02-08', emergency: { name: 'Yaw Darko', phone: '+233 24 900 5555', relation: 'Father' }, medicalNotes: '', tags: ['New', 'Corporate'], goals: ['Tone', 'Consistency'], heightCm: 170, weightKg: 71.5, dob: '1996-04-12', gender: 'female', address: 'Tema Comm. 25', qrCode: 'FITPRO-MB5-AKOSUA', trainerId: 'tr_2' },
  { id: 'mb_6', userId: 'u_m6', membershipId: 'ms_6', planId: 'pl_month', joinDate: '2023-08-22', emergency: { name: 'Esi Owusu', phone: '+233 24 900 6666', relation: 'Wife' }, medicalNotes: '', tags: ['Churn risk'], goals: ['General fitness'], heightCm: 178, weightKg: 80.0, dob: '1990-01-30', gender: 'male', address: 'Dzorwulu', qrCode: 'FITPRO-MB6-JOE' },
  { id: 'mb_7', userId: 'u_m7', membershipId: 'ms_7', planId: 'pl_annual', joinDate: '2025-06-19', emergency: { name: 'Kojo Mensah', phone: '+233 24 900 7777', relation: 'Spouse' }, medicalNotes: 'Pregnancy — cleared for prenatal yoga.', tags: ['Prenatal'], goals: ['Strength', 'Birth prep'], heightCm: 165, weightKg: 68.8, dob: '1992-08-08', gender: 'female', address: 'Osu RE', qrCode: 'FITPRO-MB7-ADWOA', trainerId: 'tr_4' },
  { id: 'mb_8', userId: 'u_m8', membershipId: 'ms_8', planId: 'pl_month', joinDate: '2024-09-01', emergency: { name: 'Ama Tetteh', phone: '+233 24 900 8888', relation: 'Sister' }, medicalNotes: '', tags: ['Payment overdue'], goals: ['Boxing'], heightCm: 180, weightKg: 77.2, dob: '1995-12-02', gender: 'male', address: 'Madina', qrCode: 'FITPRO-MB8-SAM' },
  { id: 'mb_9', userId: 'u_m9', membershipId: 'ms_9', planId: 'pl_vip', joinDate: '2025-11-03', emergency: { name: 'Kwame Serwaa', phone: '+233 24 900 9999', relation: 'Father' }, medicalNotes: '', tags: ['Black Card', 'Influencer'], goals: ['Hypertrophy', 'Content'], heightCm: 171, weightKg: 62.4, dob: '1999-03-27', gender: 'female', address: 'Trasacco Valley', qrCode: 'FITPRO-MB9-MAAME', trainerId: 'tr_2' },
  { id: 'mb_10', userId: 'u_m10', membershipId: 'ms_10', planId: 'pl_quarter', joinDate: '2024-07-14', emergency: { name: 'Abena Kumi', phone: '+233 24 900 1010', relation: 'Wife' }, medicalNotes: 'Type 2 diabetes — light monitoring.', tags: ['Corporate wellness'], goals: ['Metabolic health'], heightCm: 176, weightKg: 88.6, dob: '1984-07-19', gender: 'male', address: 'Tema Comm. 10', qrCode: 'FITPRO-MB10-DAN', trainerId: 'tr_1' },
]

export const MEMBERSHIPS: Membership[] = [
  { id: 'ms_1', memberId: 'mb_1', planId: 'pl_quarter', startDate: '2026-06-11', endDate: '2026-09-09', status: 'active', autoRenew: true, branchId: 'br_airport' },
  { id: 'ms_2', memberId: 'mb_2', planId: 'pl_vip', startDate: '2026-01-20', endDate: '2027-01-20', status: 'active', autoRenew: true, branchId: 'br_airport' },
  { id: 'ms_3', memberId: 'mb_3', planId: 'pl_annual', startDate: '2026-05-02', endDate: '2027-05-02', status: 'active', autoRenew: false, branchId: 'br_osu' },
  { id: 'ms_4', memberId: 'mb_4', planId: 'pl_month', startDate: '2026-07-15', endDate: '2026-08-14', status: 'active', autoRenew: true, branchId: 'br_legon' },
  { id: 'ms_5', memberId: 'mb_5', planId: 'pl_quarter', startDate: '2026-05-08', endDate: '2026-08-06', status: 'expired', autoRenew: false, branchId: 'br_tema' },
  { id: 'ms_6', memberId: 'mb_6', planId: 'pl_month', startDate: '2026-04-01', endDate: '2026-05-01', status: 'cancelled', autoRenew: false, branchId: 'br_airport' },
  { id: 'ms_7', memberId: 'mb_7', planId: 'pl_annual', startDate: '2025-06-19', endDate: '2026-06-19', status: 'expired', autoRenew: true, branchId: 'br_osu' },
  { id: 'ms_8', memberId: 'mb_8', planId: 'pl_month', startDate: '2026-07-01', endDate: '2026-08-01', status: 'frozen', autoRenew: false, branchId: 'br_legon' },
  { id: 'ms_9', memberId: 'mb_9', planId: 'pl_vip', startDate: '2025-11-03', endDate: '2026-11-03', status: 'active', autoRenew: true, branchId: 'br_airport' },
  { id: 'ms_10', memberId: 'mb_10', planId: 'pl_quarter', startDate: '2026-07-14', endDate: '2026-10-12', status: 'active', autoRenew: true, branchId: 'br_tema' },
]

export const TRAINERS: Trainer[] = [
  { id: 'tr_1', userId: 'u_trainer', specialties: ['Strength', 'Fat loss', 'Athletic performance'], certifications: ['NASM-CPT', 'CSCS', 'First Aid'], experienceYears: 9, bio: 'Former national-level sprinter. Builds resilient, powerful athletes with a no-drama programming style.', hourlyRate: 180, rating: 4.9, clientsCount: 34, photo: '/images/trainer-1.jpg' },
  { id: 'tr_2', userId: 'u_trainer2', specialties: ['HIIT', 'Group fitness', 'Women’s coaching'], certifications: ['ACE-CPT', 'Les Mills', 'Pre/Postnatal'], experienceYears: 7, bio: 'High-energy coach who makes hard work feel like a celebration. Specialises in sustainable fat-loss phases.', hourlyRate: 160, rating: 4.8, clientsCount: 41, photo: '/images/trainer-2.jpg' },
  { id: 'tr_3', userId: 'u_trainer3', specialties: ['Powerlifting', 'Olympic lifting', 'Rehab'], certifications: ['USAW L2', 'FMS', 'Precision Nutrition L1'], experienceYears: 12, bio: 'Quiet intensity. Twenty years under the bar. If you want a bigger squat, you want Erik.', hourlyRate: 220, rating: 5.0, clientsCount: 18, photo: '/images/trainer-3.jpg' },
  { id: 'tr_4', userId: 'u_trainer4', specialties: ['Yoga', 'Mobility', 'Breathwork'], certifications: ['RYT-500', 'FRC', 'Wim Hof L1'], experienceYears: 10, bio: 'Brings nervous-system literacy to high performers. Recovery is a skill — she teaches it.', hourlyRate: 150, rating: 4.9, clientsCount: 27, photo: '/images/trainer-4.jpg' },
]

export const STAFF: StaffRecord[] = [
  { id: 'st_1', userId: 'u_staff', department: 'Front of House', salary: 4200, hireDate: '2023-07-18', leaveBalance: 12, title: 'Membership Concierge' },
  { id: 'st_2', userId: 'u_staff2', department: 'Front of House', salary: 3800, hireDate: '2024-01-09', leaveBalance: 8, title: 'Reception Lead' },
  { id: 'st_3', userId: 'u_manager', department: 'Operations', salary: 9800, hireDate: '2023-02-14', leaveBalance: 16, title: 'General Manager' },
  { id: 'st_4', userId: 'u_trainer', department: 'Coaching', salary: 7200, hireDate: '2023-03-01', leaveBalance: 10, title: 'Head Strength Coach' },
]

export const CLASSES: GymClass[] = [
  { id: 'cl_hiit_am', name: 'Ignite HIIT', category: 'HIIT', trainerId: 'tr_2', branchId: 'br_airport', dayOfWeek: 1, startTime: '06:15', endTime: '07:00', capacity: 24, enrolled: 22, waitlist: 3, room: 'Studio A', level: 'All', image: '/images/program-hiit.jpg', description: 'Metabolic finishers, bike sprints, and floor work. 45 minutes. No passengers.' },
  { id: 'cl_hiit_pm', name: 'Ignite HIIT', category: 'HIIT', trainerId: 'tr_2', branchId: 'br_osu', dayOfWeek: 3, startTime: '18:30', endTime: '19:15', capacity: 20, enrolled: 20, waitlist: 6, room: 'Studio 1', level: 'All', image: '/images/program-hiit.jpg', description: 'After-work ignition. Same energy, Osu edition.' },
  { id: 'cl_str', name: 'Iron Hour', category: 'Strength', trainerId: 'tr_3', branchId: 'br_airport', dayOfWeek: 2, startTime: '17:30', endTime: '18:30', capacity: 16, enrolled: 14, waitlist: 1, room: 'Strength Hall', level: 'Intermediate', image: '/images/program-strength.jpg', description: 'Barbell complexes and accessory work. Bring chalk and intent.' },
  { id: 'cl_str2', name: 'Iron Hour', category: 'Strength', trainerId: 'tr_1', branchId: 'br_legon', dayOfWeek: 4, startTime: '06:00', endTime: '07:00', capacity: 14, enrolled: 11, waitlist: 0, room: 'Platforms', level: 'Intermediate', image: '/images/program-strength.jpg', description: 'Morning barbell club. Squat, hinge, press.' },
  { id: 'cl_yoga', name: 'Rise & Restore', category: 'Yoga', trainerId: 'tr_4', branchId: 'br_airport', dayOfWeek: 1, startTime: '07:15', endTime: '08:15', capacity: 22, enrolled: 18, waitlist: 0, room: 'Wellness', level: 'All', image: '/images/program-yoga.jpg', description: 'Sun salutations into deep hip openers. Perfect after HIIT.' },
  { id: 'cl_yoga2', name: 'Candlelight Yin', category: 'Yoga', trainerId: 'tr_4', branchId: 'br_osu', dayOfWeek: 5, startTime: '19:30', endTime: '20:30', capacity: 18, enrolled: 16, waitlist: 2, room: 'Wellness', level: 'Beginner', image: '/images/program-yoga.jpg', description: 'Long holds, low lights, nervous system downshift.' },
  { id: 'cl_spin', name: 'Volt Ride', category: 'Cycling', trainerId: 'tr_2', branchId: 'br_airport', dayOfWeek: 2, startTime: '06:00', endTime: '06:45', capacity: 28, enrolled: 27, waitlist: 4, room: 'Watt Room', level: 'All', image: '/images/class-spin.jpg', description: 'Hills, sprints, and a soundtrack that does not quit.' },
  { id: 'cl_spin2', name: 'Volt Ride', category: 'Cycling', trainerId: 'tr_2', branchId: 'br_tema', dayOfWeek: 6, startTime: '09:00', endTime: '09:45', capacity: 20, enrolled: 12, waitlist: 0, room: 'Watt Room', level: 'All', image: '/images/class-spin.jpg', description: 'Saturday morning ride. Coffee after.' },
  { id: 'cl_box', name: 'Ringcraft', category: 'Boxing', trainerId: 'tr_1', branchId: 'br_osu', dayOfWeek: 3, startTime: '07:00', endTime: '07:50', capacity: 16, enrolled: 15, waitlist: 2, room: 'Combat', level: 'All', image: '/images/gym-floor.jpg', description: 'Pads, footwork, and conditioning. Gloves provided.' },
  { id: 'cl_pil', name: 'Core Reform', category: 'Pilates', trainerId: 'tr_4', branchId: 'br_legon', dayOfWeek: 4, startTime: '18:00', endTime: '18:50', capacity: 14, enrolled: 13, waitlist: 1, room: 'Reformer', level: 'Beginner', image: '/images/class-pilates.jpg', description: 'Reformer pilates for posture, core, and long lines.' },
  { id: 'cl_cond', name: 'Engine Room', category: 'Conditioning', trainerId: 'tr_1', branchId: 'br_airport', dayOfWeek: 5, startTime: '06:15', endTime: '07:00', capacity: 20, enrolled: 17, waitlist: 0, room: 'Turf', level: 'Advanced', image: '/images/program-pt.jpg', description: 'Sleds, carries, and aerobic capacity. Bring grit.' },
  { id: 'cl_sun', name: 'Sunday Reset', category: 'Mobility', trainerId: 'tr_4', branchId: 'br_airport', dayOfWeek: 0, startTime: '10:00', endTime: '11:00', capacity: 30, enrolled: 21, waitlist: 0, room: 'Wellness', level: 'All', image: '/images/program-yoga.jpg', description: 'A full-body mobility flow to start the week loose.' },
]

export const BOOKINGS: Booking[] = [
  { id: 'bk_1', classId: 'cl_hiit_am', memberId: 'mb_1', date: '2026-08-17', status: 'booked' },
  { id: 'bk_2', classId: 'cl_yoga', memberId: 'mb_1', date: '2026-08-17', status: 'booked' },
  { id: 'bk_3', classId: 'cl_spin', memberId: 'mb_2', date: '2026-08-18', status: 'booked' },
  { id: 'bk_4', classId: 'cl_str', memberId: 'mb_2', date: '2026-08-18', status: 'booked' },
  { id: 'bk_5', classId: 'cl_hiit_pm', memberId: 'mb_3', date: '2026-08-19', status: 'waitlist' },
  { id: 'bk_6', classId: 'cl_yoga2', memberId: 'mb_3', date: '2026-08-21', status: 'booked' },
  { id: 'bk_7', classId: 'cl_cond', memberId: 'mb_1', date: '2026-08-14', status: 'attended' },
  { id: 'bk_8', classId: 'cl_hiit_am', memberId: 'mb_9', date: '2026-08-17', status: 'booked' },
]

export const PAYMENTS: Payment[] = [
  { id: 'pay_1', memberId: 'mb_1', amount: 720, method: 'momo', status: 'paid', invoiceId: 'inv_1', date: '2026-06-11', description: 'Performance Quarterly renewal' },
  { id: 'pay_2', memberId: 'mb_2', amount: 4800, method: 'stripe', status: 'paid', invoiceId: 'inv_2', date: '2026-01-20', description: 'Black Card VIP annual' },
  { id: 'pay_3', memberId: 'mb_3', amount: 2400, method: 'card', status: 'paid', invoiceId: 'inv_3', date: '2026-05-02', description: 'Athlete Annual' },
  { id: 'pay_4', memberId: 'mb_4', amount: 280, method: 'momo', status: 'pending', invoiceId: 'inv_4', date: '2026-08-12', description: 'Studio Monthly auto-renew' },
  { id: 'pay_5', memberId: 'mb_8', amount: 280, method: 'card', status: 'failed', invoiceId: 'inv_5', date: '2026-08-01', description: 'Studio Monthly' },
  { id: 'pay_6', memberId: 'mb_9', amount: 4800, method: 'paypal', status: 'paid', invoiceId: 'inv_6', date: '2025-11-03', description: 'Black Card VIP' },
  { id: 'pay_7', memberId: 'mb_10', amount: 720, method: 'momo', status: 'paid', invoiceId: 'inv_7', date: '2026-07-14', description: 'Performance Quarterly' },
  { id: 'pay_8', memberId: 'mb_1', amount: 180, method: 'cash', status: 'paid', invoiceId: 'inv_8', date: '2026-08-04', description: 'PT session — Kojo Mensah' },
  { id: 'pay_9', memberId: 'mb_5', amount: 720, method: 'stripe', status: 'refunded', invoiceId: 'inv_9', date: '2026-05-08', description: 'Quarterly (partial refund)' },
  { id: 'pay_10', memberId: 'mb_2', amount: 220, method: 'card', status: 'paid', invoiceId: 'inv_10', date: '2026-08-09', description: 'PT session — Erik Holm' },
  { id: 'pay_11', memberId: 'mb_1', amount: 720, method: 'paystack', status: 'paid', invoiceId: 'inv_11', date: '2026-03-11', description: 'Performance Quarterly (Paystack)', reference: 'FPSEEDPAY11ACC', gatewayChannel: 'mobile_money' },
]

export const INVOICES: Invoice[] = [
  { id: 'inv_1', memberId: 'mb_1', number: 'FP-2026-1841', items: [{ desc: 'Performance Quarterly', amount: 720 }], total: 720, status: 'paid', issuedAt: '2026-06-11', dueAt: '2026-06-11' },
  { id: 'inv_2', memberId: 'mb_2', number: 'FP-2026-0201', items: [{ desc: 'Black Card VIP', amount: 4800 }], total: 4800, status: 'paid', issuedAt: '2026-01-20', dueAt: '2026-01-20' },
  { id: 'inv_3', memberId: 'mb_3', number: 'FP-2026-1402', items: [{ desc: 'Athlete Annual', amount: 2400 }], total: 2400, status: 'paid', issuedAt: '2026-05-02', dueAt: '2026-05-02' },
  { id: 'inv_4', memberId: 'mb_4', number: 'FP-2026-2210', items: [{ desc: 'Studio Monthly', amount: 280 }], total: 280, status: 'unpaid', issuedAt: '2026-08-12', dueAt: '2026-08-16' },
  { id: 'inv_5', memberId: 'mb_8', number: 'FP-2026-2099', items: [{ desc: 'Studio Monthly', amount: 280 }], total: 280, status: 'overdue', issuedAt: '2026-08-01', dueAt: '2026-08-05' },
  { id: 'inv_6', memberId: 'mb_9', number: 'FP-2025-8801', items: [{ desc: 'Black Card VIP', amount: 4800 }], total: 4800, status: 'paid', issuedAt: '2025-11-03', dueAt: '2025-11-03' },
  { id: 'inv_7', memberId: 'mb_10', number: 'FP-2026-1994', items: [{ desc: 'Performance Quarterly', amount: 720 }], total: 720, status: 'paid', issuedAt: '2026-07-14', dueAt: '2026-07-14' },
  { id: 'inv_8', memberId: 'mb_1', number: 'FP-2026-2188', items: [{ desc: 'PT — Kojo Mensah 60m', amount: 180 }], total: 180, status: 'paid', issuedAt: '2026-08-04', dueAt: '2026-08-04' },
]

function daysBack(n: number) {
  const d = new Date('2026-08-13')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const ATTENDANCE: Attendance[] = Array.from({ length: 48 }).map((_, i) => {
  const members = ['mb_1', 'mb_2', 'mb_3', 'mb_4', 'mb_9', 'mb_10', 'mb_5', 'mb_7']
  const branches = ['br_airport', 'br_osu', 'br_legon', 'br_tema']
  return {
    id: `at_${i}`,
    memberId: members[i % members.length],
    type: (['checkin', 'class', 'pt'] as const)[i % 3],
    date: daysBack(i % 21),
    time: `${6 + (i % 14)}:${i % 2 === 0 ? '05' : '32'}`,
    branchId: branches[i % 4],
    classId: i % 3 === 1 ? 'cl_hiit_am' : undefined,
  }
})

export const WORKOUTS: WorkoutPlan[] = [
  {
    id: 'wo_1', memberId: 'mb_1', trainerId: 'tr_1', name: 'Fat-loss Engine · Block 3', startDate: '2026-08-01', status: 'active', notes: 'Keep RPE 7. Sleep 7h+.',
    exercises: [
      { name: 'Trap-bar deadlift', sets: 4, reps: '6', notes: '2 min rest' },
      { name: 'DB bench press', sets: 3, reps: '8–10', notes: 'Controlled eccentric' },
      { name: 'Walking lunge', sets: 3, reps: '12/leg', notes: '' },
      { name: 'Cable row', sets: 3, reps: '10', notes: 'Pause 1s' },
      { name: 'Bike intervals', sets: 8, reps: '30s on / 30s off', notes: 'Finish' },
    ],
  },
  {
    id: 'wo_2', memberId: 'mb_2', trainerId: 'tr_3', name: 'Meet Prep · Peaking', startDate: '2026-07-20', status: 'active', notes: 'Singles at 90% this week.',
    exercises: [
      { name: 'Back squat', sets: 5, reps: '3 @ 85%', notes: 'Belt on' },
      { name: 'Paused bench', sets: 4, reps: '2', notes: '2-count pause' },
      { name: 'Conventional deadlift', sets: 3, reps: '2', notes: 'Video each set' },
      { name: 'Chin-up', sets: 3, reps: 'AMRAP', notes: '' },
    ],
  },
  {
    id: 'wo_3', memberId: 'mb_3', trainerId: 'tr_4', name: 'Mobility + Strength Base', startDate: '2026-07-01', status: 'active', notes: 'Breath first, load second.',
    exercises: [
      { name: '90/90 hip flow', sets: 2, reps: '8/side', notes: '' },
      { name: 'Goblet squat', sets: 3, reps: '10', notes: '' },
      { name: 'Single-arm press', sets: 3, reps: '8', notes: '' },
      { name: 'Dead bug', sets: 3, reps: '8/side', notes: 'Exhale fully' },
    ],
  },
]

export const PROGRESS: ProgressLog[] = [
  { id: 'pr_1', memberId: 'mb_1', date: '2026-03-11', weight: 72.4, bodyFat: 31, waist: 82, chest: 92, hips: 104, arms: 28, notes: 'Baseline.' },
  { id: 'pr_2', memberId: 'mb_1', date: '2026-05-02', weight: 68.1, bodyFat: 28, waist: 78, chest: 91, hips: 101, arms: 28.5, notes: 'Clothes looser.' },
  { id: 'pr_3', memberId: 'mb_1', date: '2026-06-20', weight: 66.0, bodyFat: 26, waist: 75, chest: 91, hips: 99, arms: 29, notes: 'Energy up.' },
  { id: 'pr_4', memberId: 'mb_1', date: '2026-08-06', weight: 64.2, bodyFat: 24.5, waist: 73, chest: 92, hips: 98, arms: 29.4, notes: 'PR on trap-bar.' },
  { id: 'pr_5', memberId: 'mb_2', date: '2026-01-20', weight: 91.0, bodyFat: 18, waist: 88, chest: 112, arms: 39, notes: 'Off-season.' },
  { id: 'pr_6', memberId: 'mb_2', date: '2026-08-01', weight: 86.4, bodyFat: 13.5, waist: 82, chest: 114, arms: 40, notes: 'Cut landing well.' },
]

export const NOTIFICATIONS: NotificationItem[] = [
  { id: 'nt_1', userId: 'u_member', title: 'Membership renewal', message: 'Your Performance Quarterly renews on 9 Sep. Auto-renew is on.', channel: 'in-app', read: false, createdAt: '2026-08-12T08:00:00' },
  { id: 'nt_2', userId: 'u_member', title: 'Class reminder', message: 'Ignite HIIT tomorrow 06:15 at Airport City. Arrive 10 min early.', channel: 'push', read: false, createdAt: '2026-08-12T18:00:00' },
  { id: 'nt_3', userId: 'u_member', title: 'New workout posted', message: 'Kojo updated Fat-loss Engine · Block 3.', channel: 'in-app', read: true, createdAt: '2026-08-01T09:12:00' },
  { id: 'nt_4', userId: 'u_admin', title: 'Failed payment', message: 'Samuel Tetteh — Studio Monthly card declined.', channel: 'email', read: false, createdAt: '2026-08-01T10:02:00' },
  { id: 'nt_5', userId: 'u_admin', title: 'Churn risk', message: 'AI flagged Joseph Owusu — 42 days since last check-in.', channel: 'in-app', read: false, createdAt: '2026-08-11T07:40:00' },
  { id: 'nt_6', userId: 'u_trainer', title: 'New client assigned', message: 'Ama Boateng booked a PT consult for Friday 07:00.', channel: 'sms', read: true, createdAt: '2026-08-10T14:20:00' },
  { id: 'nt_7', userId: 'u_manager', title: 'Capacity alert', message: 'Ignite HIIT (Osu) is 100% booked with 6 on waitlist.', channel: 'in-app', read: false, createdAt: '2026-08-13T06:01:00' },
]

export const LEADS: Lead[] = [
  { id: 'ld_1', name: 'Rita Appiah', email: 'rita.appiah@mail.com', phone: '+233 24 700 1001', source: 'Website', status: 'new', notes: 'Asked about Black Card.', createdAt: '2026-08-12', interest: 'VIP' },
  { id: 'ld_2', name: 'Michael Addo', email: 'm.addo@zenithbank.com', phone: '+233 24 700 1002', source: 'Corporate', status: 'trial', notes: 'Zenith Bank wellness — 40 seats.', createdAt: '2026-08-08', interest: 'Corporate Wellness' },
  { id: 'ld_3', name: 'Sandra Ofori', email: 'sandrao@mail.com', phone: '+233 24 700 1003', source: 'Instagram', status: 'contacted', notes: 'Wants prenatal yoga.', createdAt: '2026-08-10', interest: 'Yoga' },
  { id: 'ld_4', name: 'Papa Nkrumah', email: 'papa.n@mail.com', phone: '+233 24 700 1004', source: 'Walk-in', status: 'converted', notes: 'Joined Monthly at Osu.', createdAt: '2026-08-02', interest: 'Monthly' },
  { id: 'ld_5', name: 'Lydia Boateng', email: 'lydia.b@mail.com', phone: '+233 24 700 1005', source: 'Referral', status: 'lost', notes: 'Chose competitor closer to home.', createdAt: '2026-07-28', interest: 'Quarterly' },
  { id: 'ld_6', name: 'Isaac Quartey', email: 'isaacq@mtn.com', phone: '+233 24 700 1006', source: 'Website', status: 'new', notes: 'Booked free consultation.', createdAt: '2026-08-13', interest: 'PT + Annual' },
]

export const MESSAGES: Message[] = [
  { id: 'msg_1', fromId: 'u_trainer', toId: 'u_member', body: 'Ama — great session today. Sleep and 140g protein. See you Friday.', createdAt: '2026-08-11T08:40:00', read: true },
  { id: 'msg_2', fromId: 'u_member', toId: 'u_trainer', body: 'Thanks Kojo! Trap-bar felt strong. Should I add a fourth set?', createdAt: '2026-08-11T09:05:00', read: true },
  { id: 'msg_3', fromId: 'u_trainer', toId: 'u_member', body: 'Not yet — quality over volume this block. We’ll add it next week.', createdAt: '2026-08-11T09:12:00', read: false },
  { id: 'msg_4', fromId: 'u_manager', toId: 'u_trainer', body: 'Can you cover Iron Hour Thursday if Erik is on leave?', createdAt: '2026-08-12T16:02:00', read: false },
  { id: 'msg_5', fromId: 'u_staff', toId: 'u_manager', body: 'Front desk fridge is out. Vendor coming at 14:00.', createdAt: '2026-08-13T07:18:00', read: false },
]

export const AUDIT: AuditLog[] = [
  { id: 'au_1', userId: 'u_admin', action: 'UPDATE', entity: 'Plan', details: 'Updated Athlete Annual price 2200 → 2400', createdAt: '2026-08-01T11:04:00' },
  { id: 'au_2', userId: 'u_manager', action: 'CREATE', entity: 'Class', details: 'Created Sunday Reset at Airport City', createdAt: '2026-08-03T09:22:00' },
  { id: 'au_3', userId: 'u_staff', action: 'CHECKIN', entity: 'Attendance', details: 'QR check-in Ama Boateng — Airport City', createdAt: '2026-08-13T06:08:00' },
  { id: 'au_4', userId: 'u_admin', action: 'REFUND', entity: 'Payment', details: 'Partial refund pay_9 Akosua Darko GHS 240', createdAt: '2026-08-09T15:41:00' },
  { id: 'au_5', userId: 'u_manager', action: 'SUSPEND', entity: 'Member', details: 'Suspended Samuel Tetteh — failed payments', createdAt: '2026-08-06T10:10:00' },
  { id: 'au_6', userId: 'u_admin', action: 'LOGIN', entity: 'Auth', details: 'OAuth Google login from Accra', createdAt: '2026-08-13T07:10:00' },
]

export const LEAVES: LeaveRequest[] = [
  { id: 'lv_1', staffUserId: 'u_trainer3', from: '2026-08-20', to: '2026-08-22', type: 'Annual', status: 'pending', reason: 'Family in Cape Coast' },
  { id: 'lv_2', staffUserId: 'u_staff', from: '2026-08-25', to: '2026-08-26', type: 'Sick', status: 'approved', reason: 'Dental surgery' },
  { id: 'lv_3', staffUserId: 'u_staff2', from: '2026-09-01', to: '2026-09-05', type: 'Annual', status: 'rejected', reason: 'Overlap with inventory week' },
]

export const SESSIONS: SessionBooking[] = [
  { id: 'ss_1', trainerId: 'tr_1', memberId: 'mb_1', date: '2026-08-15', time: '07:00', status: 'scheduled', notes: 'Consult + movement screen' },
  { id: 'ss_2', trainerId: 'tr_1', memberId: 'mb_4', date: '2026-08-13', time: '17:30', status: 'scheduled', notes: 'Conditioning + walk test' },
  { id: 'ss_3', trainerId: 'tr_1', memberId: 'mb_10', date: '2026-08-14', time: '06:30', status: 'scheduled', notes: 'Metabolic block 2' },
  { id: 'ss_4', trainerId: 'tr_3', memberId: 'mb_2', date: '2026-08-13', time: '12:00', status: 'scheduled', notes: 'Heavy squat day' },
  { id: 'ss_5', trainerId: 'tr_2', memberId: 'mb_9', date: '2026-08-16', time: '09:00', status: 'scheduled', notes: 'Content shoot + session' },
  { id: 'ss_6', trainerId: 'tr_1', memberId: 'mb_1', date: '2026-08-11', time: '07:00', status: 'completed', notes: 'Great energy. Increased TBDL.' },
]

export const TESTIMONIALS: Testimonial[] = [
  { id: 't1', name: 'Ama Boateng', role: 'Product lead, Hubtel', quote: 'I stopped bargaining with myself. FitPro made training the easiest appointment on my calendar — and I dropped 8kg without losing my strength.', rating: 5, avatar: '/images/success-1.jpg', result: '−8.2 kg · 5 months' },
  { id: 't2', name: 'Kofi Asante', role: 'Partner, Bentsi-Enchill', quote: 'Erik’s programming is the most precise I’ve used since college athletics. The Black Card is the only membership I don’t resent paying for.', rating: 5, avatar: '/images/success-2.jpg', result: 'Deadlift 200 kg' },
  { id: 't3', name: 'Efua Adjei', role: 'Founder, Studio Form', quote: 'Priya rebuilt my back after two desk-bound years. I sleep. I lift. I actually look forward to Sunday Reset.', rating: 5, avatar: '/images/success-3.jpg', result: 'Pain-free · +mobility' },
]

export const BLOG: BlogPost[] = [
  {
    id: 'bp_1', slug: 'accra-heat-training', title: 'Training in Accra heat without cooking your nervous system',
    excerpt: 'Humidity is a training variable. Here’s how we programme around harmattan and rainy-season humidity.',
    category: 'Training', author: 'Kojo Mensah', date: '2026-08-04', image: '/images/blog-1.jpg', readMins: 6,
    body: `Accra does not do “dry heat”. Between March and June, outdoor conditioning is a different sport.

We treat wet-bulb temperature as seriously as bar speed. If the gym floor is 29°C with 80% humidity, long Zone-2 on the turf is a bad idea — we move it to the Watt Room, drop the work:rest, and push electrolytes.

Three rules we give every member:

1. Pre-load sodium. 500–700mg in the 60 minutes before a hard session.
2. Indoor engine work when the afternoon storm is brewing. Lightning and sleds do not mix.
3. Deload the week harmattan dust peaks if you have any respiratory notes on file.

Your programme should respect the city you train in. That’s not softness. That’s professionalism.`,
  },
  {
    id: 'bp_2', slug: 'protein-accra-guide', title: 'A realist’s protein guide for Accra kitchens',
    excerpt: 'Tilapia, waakye, grilled chicken from the good spot on Oxford Street — how to hit 1.6g/kg without a meal-prep cult.',
    category: 'Nutrition', author: 'Priya Nair', date: '2026-07-22', image: '/images/blog-2.jpg', readMins: 8,
    body: `You do not need imported whey to get lean in Accra. You need a plan that survives traffic, power cuts, and Friday banku.

Anchor meals we actually recommend:

- Breakfast: eggs + leftover jollof + fruit. 30–40g protein.
- Lunch: grilled tilapia or chicken, extra rice if you’re fuelling legs day, extra salad if you’re in a cut.
- Dinner: beans-based stew, beef, or eggs again. Yes, again.

Supplement only what your bloodwork asks for. Most of our members are short on sleep and fibre, not exotic powders.

If you want the full macro calculator we use with PT clients, book a nutrition consult — it’s included on Quarterly and above.`,
  },
  {
    id: 'bp_3', slug: 'first-90-days', title: 'The first 90 days: what actually predicts you’ll still be here in a year',
    excerpt: 'We looked at 18 months of check-in data. The pattern is almost boring — and that’s the point.',
    category: 'Mindset', author: 'Amara Cole', date: '2026-07-02', image: '/images/blog-3.jpg', readMins: 5,
    body: `Retention is not a mystery at FitPro. Members who hit 12 check-ins in their first 30 days have a 4.1× chance of still being active at month 12.

Not 12 heroic sessions. Twelve show-ups.

What we do with that:

- New members get a 20-minute onboarding and a standing class hold for week one.
- Trainers get an alert if a new client ghosts for 6 days.
- Front of house texts once, never three times. Dignity matters.

If you just joined: pick three weekly slots and treat them like board meetings. The body follows the calendar.`,
  },
  {
    id: 'bp_4', slug: 'strength-after-40', title: 'Strength after 40 — the East Legon notes',
    excerpt: 'Most of our East Legon members are operators, not influencers. The programming should look like it.',
    category: 'Training', author: 'Erik Holm', date: '2026-06-18', image: '/images/program-strength.jpg', readMins: 7,
    body: `After 40, we do not chase novelty. We chase recoverable tension.

A week that works for a 46-year-old counsel who sits for ten hours:

- 2 full-body strength sessions (squat / hinge / press / pull)
- 1 Zone-2 ride
- 1 mobility class
- Daily 8k steps. Non-negotiable.

We drop max-effort singles unless you’re actually peaking for something. Ego is expensive when sleep is short and court starts at 9.

If your joints argue, we listen. Then we load around them — not through them.`,
  },
]

export const REVENUE_SERIES = [
  { month: 'Mar', revenue: 186400, members: 1980, visits: 14220 },
  { month: 'Apr', revenue: 192100, members: 2044, visits: 15010 },
  { month: 'May', revenue: 201850, members: 2112, visits: 15880 },
  { month: 'Jun', revenue: 208420, members: 2188, visits: 16140 },
  { month: 'Jul', revenue: 221300, members: 2264, visits: 17420 },
  { month: 'Aug', revenue: 168900, members: 2375, visits: 9800 },
]

export const ATTENDANCE_WEEK = [
  { day: 'Mon', checkins: 412, classes: 186 },
  { day: 'Tue', checkins: 458, classes: 210 },
  { day: 'Wed', checkins: 471, classes: 224 },
  { day: 'Thu', checkins: 439, classes: 198 },
  { day: 'Fri', checkins: 388, classes: 172 },
  { day: 'Sat', checkins: 352, classes: 140 },
  { day: 'Sun', checkins: 214, classes: 86 },
]

export const RETENTION = [
  { month: 'Mar', rate: 91 },
  { month: 'Apr', rate: 90 },
  { month: 'May', rate: 92 },
  { month: 'Jun', rate: 93 },
  { month: 'Jul', rate: 92 },
  { month: 'Aug', rate: 94 },
]

export const CLASS_UTIL = [
  { name: 'HIIT', util: 94 },
  { name: 'Cycling', util: 88 },
  { name: 'Strength', util: 81 },
  { name: 'Yoga', util: 76 },
  { name: 'Boxing', util: 93 },
  { name: 'Pilates', util: 90 },
]

export const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'superadmin@fitpro.gym', password: 'demo123', hint: 'Full platform control' },
  { role: 'Gym Manager', email: 'manager@fitpro.gym', password: 'demo123', hint: 'Operations & analytics' },
  { role: 'Trainer', email: 'trainer@fitpro.gym', password: 'demo123', hint: 'Kojo Mensah — coaching portal' },
  { role: 'Staff', email: 'staff@fitpro.gym', password: 'demo123', hint: 'Front desk & check-in' },
  { role: 'Member', email: 'member@fitpro.gym', password: 'demo123', hint: 'Ama Boateng — member app' },
]

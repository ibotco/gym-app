# FitPro Gym Management

A premium, role-based gym operating system for a four-club Accra network — marketing site, admin console, coach portal, and member app in one React SPA.

## Demo seats

Password for every account: **`demo123`**

| Role | Email | Lands on |
|---|---|---|
| Super Admin | `superadmin@fitpro.gym` | `/admin` |
| Gym Manager | `manager@fitpro.gym` | `/admin` |
| Trainer (Kojo Mensah) | `trainer@fitpro.gym` | `/coach` |
| Staff | `staff@fitpro.gym` | `/admin` (front desk + check-in) |
| Member (Ama Boateng) | `member@fitpro.gym` | `/app` |

OAuth buttons on the login page open the member seat (demo).

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS 4
- React Router 7
- Recharts, Framer Motion, Lucide
- In-memory store with realistic Accra sample data (`src/data/seed.ts`)
- Production Postgres schema in `SCHEMA.sql`

## Run

```bash
npm install
npm run dev
```

## What is wired

**Public** — home, about, services, memberships, trainers + booking, weekly timetable + waitlists, journal, contact / consultation (creates a CRM lead), newsletter, WhatsApp, Google Maps.

**Admin** — analytics, members (CRUD, tags, medical, renewals), staff & leave & payroll, branches, plans, classes, payments / invoices / refunds, reports (CSV + print-to-PDF), leads CRM, notifications + expiry batch, QR check-in, audit log, **integrations** (configure / test / health / activity log), settings (brand, RBAC matrix, security, backup).

**Coach** — today’s book, assigned members, workout publisher, measurements, class attendance, messaging.

**Member** — status & renewals, class booking, PT booking, progress + BMI, AI recommendations, invoices, digital QR card, GDPR export.

Theme (dark / light) and language (EN / FR / Twi) persist locally. Alerts default to the **top-right**. Change them in **Settings → Alerts** or **My profile**. Super Admin can impersonate any seat from the avatar menu.

This demo simulates JWT sessions and OAuth. **Paystack** can run live: add `pk_test_` / `sk_test_` keys in **Integrations → Paystack** (see `HOW-TO-PAYSTACK.md`). Hook `SCHEMA.sql` and a real API when you take the rest to production.

## Member login credentials

Admins can regenerate a member’s username and/or temporary password from the member profile, then send it by **email**, **WhatsApp**, and **SMS** (any combination). The old temporary password stops working immediately. The member must set a new password at the next sign-in.

Templates, password rules, and gateways live in **Settings → Credentials**. See `HOW-TO-CREDENTIALS.md`.

Login accepts **email or username**. Demo seats still use `demo123` until you regenerate them.

## Updates

Every release is packaged as **`fitpro.update.zip`**. Unzip it over your existing `fitpro` folder and replace files.

## Email login validation

Admins can turn **Enable Email Login Validation** on or off in **Settings → Security**.

When it is on:

- Sign-up and login require a valid email format
- Duplicate emails are rejected
- New accounts stay inactive until the member enters the 6-digit email code
- Demo accounts are pre-verified and can still sign in

Turn on **live inbox delivery** in **Settings → Email** (Gmail App Password is the usual path). See `HOW-TO-EMAIL.md`. When live send works, the verify screen does not show the code.

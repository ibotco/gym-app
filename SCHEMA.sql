-- FitPro Gym Management — production schema (PostgreSQL)
-- Mirrors the in-app models. JWT auth sits in front of users.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('super_admin','gym_manager','staff','trainer','member');
CREATE TYPE user_status AS ENUM ('active','inactive','suspended');
CREATE TYPE membership_status AS ENUM ('active','expired','cancelled','pending','frozen');
CREATE TYPE payment_status AS ENUM ('paid','pending','failed','refunded');
CREATE TYPE payment_method AS ENUM ('stripe','paypal','momo','cash','card','paystack');
CREATE TYPE invoice_status AS ENUM ('paid','unpaid','overdue');
CREATE TYPE booking_status AS ENUM ('booked','waitlist','cancelled','attended','no-show');
CREATE TYPE lead_status AS ENUM ('new','contacted','trial','converted','lost');

CREATE TABLE branches (
  id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(8), 'hex'),
  name          TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  manager_id    TEXT,
  members       INT NOT NULL DEFAULT 0,
  capacity      INT NOT NULL,
  hours         TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION
);

CREATE TABLE users (
  id                         TEXT PRIMARY KEY,
  email                      TEXT UNIQUE NOT NULL,
  username                   TEXT UNIQUE,
  password_hash              TEXT NOT NULL,
  name                       TEXT NOT NULL,
  role                       user_role NOT NULL,
  avatar                     TEXT,
  phone                      TEXT,
  branch_id                  TEXT REFERENCES branches(id),
  status                     user_status NOT NULL DEFAULT 'active',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login                 TIMESTAMPTZ,
  must_change_password       BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at        TIMESTAMPTZ,
  credentials_regenerated_at TIMESTAMPTZ,
  credentials_regenerated_by TEXT
);

CREATE TABLE members (
  id              TEXT PRIMARY KEY,
  user_id         TEXT UNIQUE NOT NULL REFERENCES users(id),
  membership_id   TEXT,
  plan_id         TEXT,
  join_date       DATE NOT NULL,
  emergency_name  TEXT,
  emergency_phone TEXT,
  emergency_rel   TEXT,
  medical_notes   TEXT,
  tags            TEXT[] DEFAULT '{}',
  goals           TEXT[] DEFAULT '{}',
  height_cm       NUMERIC,
  weight_kg       NUMERIC,
  dob             DATE,
  gender          TEXT,
  address         TEXT,
  qr_code         TEXT UNIQUE NOT NULL,
  trainer_id      TEXT
);

CREATE TABLE trainers (
  id                TEXT PRIMARY KEY,
  user_id           TEXT UNIQUE NOT NULL REFERENCES users(id),
  specialties       TEXT[] NOT NULL,
  certifications    TEXT[] NOT NULL,
  experience_years  INT NOT NULL,
  bio               TEXT,
  hourly_rate       NUMERIC NOT NULL,
  rating            NUMERIC(2,1),
  clients_count     INT DEFAULT 0,
  photo             TEXT
);

CREATE TABLE staff (
  id            TEXT PRIMARY KEY,
  user_id       TEXT UNIQUE NOT NULL REFERENCES users(id),
  department    TEXT NOT NULL,
  title         TEXT NOT NULL,
  salary        NUMERIC NOT NULL,
  hire_date     DATE NOT NULL,
  leave_balance INT NOT NULL DEFAULT 15
);

CREATE TABLE plans (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL,
  price          NUMERIC NOT NULL,
  duration_days  INT NOT NULL,
  features       TEXT[] NOT NULL,
  popular        BOOLEAN DEFAULT FALSE,
  active         BOOLEAN DEFAULT TRUE,
  color          TEXT
);

CREATE TABLE memberships (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  plan_id     TEXT NOT NULL REFERENCES plans(id),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      membership_status NOT NULL,
  auto_renew  BOOLEAN NOT NULL DEFAULT TRUE,
  branch_id   TEXT REFERENCES branches(id)
);

CREATE TABLE invoices (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  number      TEXT UNIQUE NOT NULL,
  items       JSONB NOT NULL,
  total       NUMERIC NOT NULL,
  status      invoice_status NOT NULL,
  issued_at   DATE NOT NULL,
  due_at      DATE NOT NULL
);

CREATE TABLE payments (
  id              TEXT PRIMARY KEY,
  member_id       TEXT NOT NULL REFERENCES members(id),
  amount          NUMERIC NOT NULL,
  method          payment_method NOT NULL,
  status          payment_status NOT NULL,
  invoice_id      TEXT REFERENCES invoices(id),
  date            DATE NOT NULL,
  description     TEXT,
  reference       TEXT,
  gateway_ref     TEXT,
  gateway_channel TEXT
);

CREATE UNIQUE INDEX idx_payments_reference ON payments(reference) WHERE reference IS NOT NULL;

CREATE TABLE classes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  trainer_id  TEXT REFERENCES trainers(id),
  branch_id   TEXT REFERENCES branches(id),
  day_of_week SMALLINT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  capacity    INT NOT NULL,
  enrolled    INT NOT NULL DEFAULT 0,
  waitlist    INT NOT NULL DEFAULT 0,
  room        TEXT,
  level       TEXT,
  image       TEXT,
  description TEXT
);

CREATE TABLE bookings (
  id         TEXT PRIMARY KEY,
  class_id   TEXT NOT NULL REFERENCES classes(id),
  member_id  TEXT NOT NULL REFERENCES members(id),
  date       DATE NOT NULL,
  status     booking_status NOT NULL,
  UNIQUE (class_id, member_id, date)
);

CREATE TABLE attendance (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES members(id),
  type       TEXT NOT NULL,
  date       DATE NOT NULL,
  time       TEXT NOT NULL,
  branch_id  TEXT REFERENCES branches(id),
  class_id   TEXT
);

CREATE TABLE workout_plans (
  id          TEXT PRIMARY KEY,
  member_id   TEXT NOT NULL REFERENCES members(id),
  trainer_id  TEXT NOT NULL REFERENCES trainers(id),
  name        TEXT NOT NULL,
  exercises   JSONB NOT NULL,
  start_date  DATE NOT NULL,
  status      TEXT NOT NULL,
  notes       TEXT
);

CREATE TABLE progress_logs (
  id         TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL REFERENCES members(id),
  date       DATE NOT NULL,
  weight     NUMERIC,
  body_fat   NUMERIC,
  chest      NUMERIC,
  waist      NUMERIC,
  hips       NUMERIC,
  arms       NUMERIC,
  notes      TEXT
);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  channel    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  source     TEXT,
  status     lead_status NOT NULL,
  notes      TEXT,
  interest   TEXT,
  created_at DATE NOT NULL
);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES users(id),
  to_id      TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  details    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leave_requests (
  id            TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL REFERENCES users(id),
  "from"        DATE NOT NULL,
  "to"          DATE NOT NULL,
  type          TEXT NOT NULL,
  status        TEXT NOT NULL,
  reason        TEXT
);

CREATE TABLE session_bookings (
  id         TEXT PRIMARY KEY,
  trainer_id TEXT NOT NULL REFERENCES trainers(id),
  member_id  TEXT NOT NULL REFERENCES members(id),
  date       DATE NOT NULL,
  time       TIME NOT NULL,
  status     TEXT NOT NULL,
  notes      TEXT
);

CREATE INDEX idx_members_user ON members(user_id);
CREATE INDEX idx_memberships_status ON memberships(status);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_bookings_class_date ON bookings(class_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_credential_events_member ON credential_events(member_id, created_at DESC);

CREATE TABLE integrations (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  provider             TEXT NOT NULL,
  category             TEXT NOT NULL,
  version              TEXT,
  critical             BOOLEAN NOT NULL DEFAULT FALSE,
  active               BOOLEAN NOT NULL DEFAULT FALSE,
  connected            BOOLEAN NOT NULL DEFAULT FALSE,
  health               TEXT NOT NULL,
  api_status           TEXT,
  config_encrypted     JSONB NOT NULL DEFAULT '{}',
  last_sync_at         TIMESTAMPTZ,
  last_success_at      TIMESTAMPTZ,
  last_failed_at       TIMESTAMPTZ,
  last_health_check_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_logs (
  id               TEXT PRIMARY KEY,
  integration_id   TEXT NOT NULL REFERENCES integrations(id),
  integration_name TEXT NOT NULL,
  admin_id         TEXT NOT NULL,
  admin_name       TEXT NOT NULL,
  action           TEXT NOT NULL,
  status           TEXT NOT NULL,
  details          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_logs ON integration_logs(integration_id, created_at DESC);

# Email login validation

**Release package:** `fitpro.update.zip`

All future updates ship as **`fitpro.update.zip`**.

## Admin setting

**Settings → Security → Enable Email Login Validation**

When **on**:

- Signup and login require a valid email format (client + server policy).
- Duplicate emails are rejected.
- New self-registrations stay **inactive / unverified** until the confirmation link is opened.
- Login is blocked until `emailVerified` is true.
- A demo verification email is written to the in-app outbox (no real SMTP).

When **off**:

- Duplicate emails are still rejected.
- Basic format hints still appear on signup.
- New accounts activate immediately (no verification step).

## How to test

1. Sign in as `superadmin@fitpro.gym` / `demo123`.
2. Turn **Enable Email Login Validation** on and save.
3. Sign out and open **Join Now**.
4. Type a bad address (`foo`, `a@b`) — live error appears; submit is blocked.
5. Type an existing address (`member@fitpro.gym`) — duplicate error.
6. Register a new valid email. You see the demo inbox and a verification link.
7. Open the link (`/verify-email?token=…`). Account activates.
8. Sign in with that email.

Existing demo seats are pre-verified so they still work when the setting is on.

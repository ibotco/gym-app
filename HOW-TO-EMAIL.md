# Live email verification (Gmail)

After you copy this update, **Stop FitPro** then **Start FitPro** so the mail server reloads. You do **not** need nodemailer.

FitPro can send the 6-digit code to a real inbox. Configure this once as Super Admin.

## 1. Create a Gmail App Password

1. Open https://myaccount.google.com/security while signed into the Gmail you want to send from.
2. Turn on **2-Step Verification**.
3. Open https://myaccount.google.com/apppasswords
4. App: **Mail**. Device: **Windows Computer**. Create.
5. Copy the **16-character** password. Do not use your normal Gmail password.

## 2. Save it in FitPro

1. Sign in as `superadmin@fitpro.gym` / `demo123`.
2. Open **Settings → Email**.
3. Leave **Send real emails** on.
4. Provider: **Gmail**.
5. Gmail address: your address (example `you@gmail.com`).
6. Gmail app password: paste the 16 characters.
7. Click **Save email settings**.
8. Enter your inbox under **Send a test code to** → **Send test email**.
9. Check inbox and spam for “482915 is your FitPro verification code”.

## 3. Sign up as a member

Join Now with a real email. The code arrives in that inbox. Type it on the verify screen.

If send fails, FitPro shows the error and (only then) shows the code on screen so you are not locked out.

## Other providers

- **Custom SMTP** — host, port 587, username, password.
- **EmailJS** — public key, service id, template with `to_email`, `to_name`, `code`.
- **Resend** — API key `re_…` and a verified from-address.

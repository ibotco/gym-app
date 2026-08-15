# Member login credentials

Administrators can issue a new username and/or temporary password for any existing member, then send it by email, WhatsApp, SMS, or all three.

## On your PC after this update

1. Double-click **Stop FitPro.bat**.
2. Unzip **`fitpro.update.zip`** over `C:\reactapp\fitpro` and choose **Replace**.
3. Double-click **Start FitPro.bat**.
4. Open http://127.0.0.1:5173 and press **Ctrl+Shift+R**.

Stop then Start is required so the WhatsApp / SMS helper (`/api/notify`) reloads.

## Who can do this

Super Admin, Gym Manager, and Staff. Trainers and members cannot regenerate logins.

## Issue new credentials

1. Sign in as `superadmin@fitpro.gym` / `demo123`.
2. Open **Members** → a member profile (try Ama Boateng).
3. Scroll to **Login credentials**, or tap **Credentials**.
4. Choose:
   - **Regenerate login credentials** — pick password only, username only, or both, then pick channels.
   - **Regenerate and send** — new password, send on every channel that has a contact.
   - **Resend existing credentials** — only while the 15-minute one-time reveal is still available.
5. Tick the confirmation box. The old temporary password stops working immediately.
6. Copy the one-time reveal if a channel fails. FitPro does not keep the plain-text password after that.

The member must change the temporary password at the next sign-in (`/change-password`). After they save a new password, the temporary one is dead.

## Delivery

| Channel | Default | Live option |
|---|---|---|
| Email | Uses **Settings → Email** (Gmail App Password) | Same as verification mail |
| WhatsApp | Opens WhatsApp with the message filled in | Meta Cloud API or a webhook in **Settings → Credentials** |
| SMS | Opens the PC / phone SMS app | Hubtel or a webhook in **Settings → Credentials** |

You can select more than one channel. Each attempt is written to the member audit trail and to **Audit logs**.

## Initial password

**Settings → Credentials → Initial login password**

- **Auto-generate** — a random temporary password that matches the policy.
- **Member phone number** — the password is the local digits, e.g. `+233 24 555 0101` becomes `0245550101`.

This applies when you add a **member or staff** record and when you regenerate credentials. You can still pick either option on the regenerate screen for that one send. They must change the temporary password at first sign-in.

Staff use the same panel as members: **Staff → open a person → Credentials**. Super Admin and Gym Manager can regenerate staff logins. Front-desk staff can regenerate **member** logins only.

If phone mode is on and the member has no phone, FitPro will not issue credentials until you add a number or switch to auto-generate.

## Templates and password rules

**Settings → Credentials**

- Initial password: auto-generate or member phone number
- Password length and complexity for generated passwords and member changes
- Email, WhatsApp, and SMS templates
- Support phone / email printed on the messages
- WhatsApp and SMS gateways

Placeholders: `{{name}}` `{{username}}` `{{password}}` `{{portalUrl}}` `{{supportPhone}}` `{{supportEmail}}` `{{clubName}}`

## Security

- Only staff roles above can regenerate.
- New passwords are stored as `sha256$salt$hash`. Demo seats stay on `demo123` until you regenerate them.
- The one-time reveal lives in this browser tab for 15 minutes, then it is gone.
- Login accepts **email or username**.
- Regenerated accounts stay active. Suspended members must be reactivated first.

## Try it on a demo member

Use **Kofi Asante** (`kofi.asante@mail.com`) rather than `member@fitpro.gym` if you still want the Ama demo seat unchanged.

1. Regenerate password only → Email + WhatsApp.
2. Sign out.
3. Sign in with username `kofi.asante` and the temporary password from the reveal.
4. You are forced to set a new password before the member app opens.

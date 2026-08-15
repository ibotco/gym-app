# Live email verification (Windows)

FitPro can send a real 6-digit code to the member’s inbox.

## 1. Connect Gmail (easiest)

1. Start FitPro and sign in as **superadmin@fitpro.gym** / **demo123**.
2. Open **Settings → Integrations**.
3. On your phone or another tab, open Google Account → **Security**.
4. Turn on **2-Step Verification**.
5. Open **App passwords** (search for it in the Google Account search box).
6. Create an app password named **FitPro**. Google shows 16 letters.
7. In FitPro, choose **Gmail**, enter your Gmail address, paste the 16-letter password (spaces are fine).
8. Click **Save & go live**.
9. Enter your own email under **Send a test to** and click **Send test email**.
10. Open that inbox (and spam). You should see a FitPro message.

## 2. Try a new member

1. Sign out.
2. Click **Join Now**.
3. Use a real email you can open.
4. The code arrives in that inbox. Type it on the verify screen.

## Outlook / Yahoo / other

Use the **Provider** list. For a custom host, pick **Custom SMTP** and fill host + port.

## If the test fails

- Gmail will reject your normal password. It must be an **App password**.
- “Invalid login” almost always means 2-Step Verification is off, or the app password was copied wrong.
- Restart FitPro after saving if the first test still says not connected.
- The mailbox must be allowed to send SMTP. Some school/work accounts block it.

The password is stored only on this PC in `email.config.json`. Do not email that file to anyone.

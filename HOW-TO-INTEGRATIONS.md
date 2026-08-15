# Integration management

FitPro now has a full integration centre. Super Admin and Gym Manager can configure, test, and audit every connected service without changing code.

## Open it

1. Sign in as `superadmin@fitpro.gym` / `demo123`.
2. Open **Integrations** in the left menu, or **Settings → Integrations**.

## What you can do

- Filter by category (communication, payments, auth, storage, analytics, social, APIs).
- Search by name.
- Filter active / inactive, connected / disconnected, or errors only.
- Toggle a provider **on** or **off**. Saved keys stay on this PC.
- Critical services (email, SMS, Stripe, Mobile Money, **Paystack**) ask for confirmation before they turn off.
- **Paystack** is the Ghana checkout (GHS, card + MoMo). Open the card to paste `pk_` / `sk_` keys, pick channels, and test the live API. See `HOW-TO-PAYSTACK.md`.
- Open a card to edit API keys, secrets, tokens, webhooks, callbacks, sandbox vs production, sync frequency, retries, and timeout.
- **Validate configuration** checks required fields.
- **Test connection** and **Run health check** report:
  - Authentication Successful
  - Invalid API Key
  - Expired Token
  - Connection Timeout
  - Service Unavailable
  - Configuration Error  
  plus response time in milliseconds.
- Every action is written to the **activity log** and to **Audit logs**.

## Secrets

Keys and tokens are encrypted on this computer (`enc$…` in local storage). The form shows a mask such as `••••••••abcd`. Leave a field blank when saving to keep the stored value.

To force a failed test, save a key that contains `invalid`, `expired`, `timeout`, or `down`.

## Who can manage

Super Admin and Gym Manager only. Staff, trainers, and members cannot open the page.

## Install this pack

1. Double-click **Stop FitPro.bat**.
2. Unzip **`fitpro.update.zip`** over `C:\reactapp\fitpro` and choose **Replace**.
3. Double-click **Start FitPro.bat**.
4. Open http://127.0.0.1:5173 and press **Ctrl+Shift+R**.

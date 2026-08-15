# Paystack (Ghana)

FitPro can collect membership money through **Paystack** — Visa / Mastercard and MTN, Telecel, or AirtelTigo Mobile Money, in **GHS**.

Cash and desk MoMo still need a staff **Confirm payment**. A **verified Paystack charge** marks the invoice paid (unless you turn auto-settle off).

## 1. Turn it on

1. Sign in as `superadmin@fitpro.gym` / `demo123`.
2. Open **Integrations** (left menu) or **Settings → Integrations**.
3. Open the **Paystack** card.
4. Leave **Sandbox** selected while you test.
5. Paste your keys from [Paystack API settings](https://dashboard.paystack.com/#/settings/developer):
   - **Public key** starts with `pk_test_`
   - **Secret key** starts with `sk_test_`
6. Confirm currency is **GHS** and Mobile Money is ticked.
7. Click **Save configuration**, then **Test connection**.
8. Double-click **Stop FitPro.bat**, then **Start FitPro.bat**, so the Paystack helper reloads.

Ghana businesses: in the Paystack dashboard also enable **Mobile Money**.

Live keys (`pk_live_` / `sk_live_`) only after you switch the environment to **Production**.

## 2. What members see

1. Sign in as `member@fitpro.gym` / `demo123`.
2. Open **Payments**.
3. Click **Renew membership** (creates an unpaid invoice).
4. Click **Pay with Paystack**.

With real keys, Paystack’s checkout opens (card or MoMo). After a successful charge FitPro verifies the reference and marks the invoice paid.

With no keys yet, a **demo checkout** runs so you can walk the floor through the flow. No money moves.

## 3. What staff see

On **Payments** or a member profile:

- **Collect Paystack** — open checkout at the desk
- **Copy Paystack link** — hosted Paystack URL (needs live/test keys)
- **Confirm payment** — still used for cash / desk MoMo
- **Refund** — records a local refund and, if keys are live, asks Paystack to refund too

## 4. Test cards (Paystack sandbox)

- Card: `4084084084084081`
- Any future expiry, CVV `408`, PIN `0000`, OTP `123456`

## 5. If Test connection fails

- Stop then Start FitPro so `/api/paystack` is loaded.
- The secret must be  the **sk_** key, not the public key.
- Use a  **test** pair in sandbox and a **live** pair in production.
- A key that contains `invalid`, `expired`, `timeout`, or `down` is forced to fail (for rehearsals).

Webhook URL is stored for later. On this PC Paystack cannot reach `127.0.0.1`, so FitPro **verifies the reference** when checkout returns. That is enough for club use.

## 6. Install this pack

1. Double-click **Stop FitPro.bat**.
2. Unzip **`fitpro.update.zip`** over `C:\reactapp\fitpro` and choose **Replace**.
3. Double-click **Start FitPro.bat**.
4. Open http://127.0.0.1:5173 and press **Ctrl+Shift+R**.

# How to get Arena updates onto your PC

This Arena workspace and your computer are **two different copies**.
Changing the app here does **not** change your PC until you copy the new files across.

## Each time the app is updated here

### On Arena (this chat)
1. Ask: **“Pack an update for my PC.”**
2. Download **`fitpro.update.zip`** from the workspace.

### On your PC
1. Double-click **`Stop FitPro.bat`** (or close the black server window).
2. Unzip `fitpro.update.zip`.
3. Copy everything **into** your existing `fitpro` folder.
4. When Windows asks to replace files, choose **Replace**.
5. Do **not** delete your whole `fitpro` folder — only overwrite files.
6. Double-click **`Update FitPro.bat`**.

That runs `npm install` (only needed if packages changed) and starts the app again.

Open: http://127.0.0.1:5173

## What to copy / what to skip

| Copy these | Do not copy |
|---|---|
| `src/` | `node_modules/` |
| `public/` | `dist/` |
| `*.bat`, `*.vbs`, `package.json` | `fitpro-server.log` |
| `index.html`, `vite.config.ts`, tsconfig files | |

Your PC keeps its own `node_modules`. That is correct.

All releases use the filename **fitpro.update.zip**.

## Integrations

**Integrations** in the left menu (or **Settings → Integrations**) is the full provider centre: categories, toggles, encrypted keys, test connection, health, and an activity log. Super Admin and Gym Manager only. See `HOW-TO-INTEGRATIONS.md`.

**Paystack** lives there. Paste test or live keys, then members can pay invoices with card or Mobile Money. Full steps: `HOW-TO-PAYSTACK.md`. After this pack, **Stop** then **Start** FitPro so the Paystack helper (`/api/paystack`) reloads.

## Member login credentials

Admins can regenerate and resend a member’s login from the member profile. After this pack, **Stop** then **Start** FitPro so the WhatsApp / SMS helper reloads. Full steps: `HOW-TO-CREDENTIALS.md`.

## Password fields

Every password box has an eye icon to show or hide what you typed. Passwords stay hidden until you tap the icon. That choice is not saved.

## Alerts

Popups default to the **top-right**. Change position, duration, animation, or turn them off in **Settings → Alerts** (admin) or **My profile**.

## If the browser is blank after an update

1. Stop the app (`Stop FitPro.bat`).
2. Replace **all** files from this zip — especially `src/pages/public/Home.tsx`, `src/App.tsx`, and `src/main.tsx`.
3. Start again (`Start FitPro.bat`).
4. Hard-refresh the browser: **Ctrl+Shift+R**.
5. Open **http://127.0.0.1:5173** — not a saved old tab.

A blank page was caused by the home screen calling the language helper before it was started. That is fixed in this pack. If something else fails, you will now see an error card instead of an empty page.

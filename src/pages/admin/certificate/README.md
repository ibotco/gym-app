# Certificate Management — Dedicated Module

> **Rule:** *Any menu that is promoted to a higher-level (top-level) menu must own its folder in `src/pages/admin/` and contain its needed files.*
> Certificate was promoted from `Education Management > Certificate` (generic `EduModulePage`) to a top-level group `Certificate Management`. It now owns this folder.

## Structure
```
src/pages/admin/certificate/
├── CertificateShared.tsx            # Branch-aware context (records, permissions, helpers) — mirrors IdCardShared
├── CertificateTypesPage.tsx         # CRUD: name, description, serialPrefix, status (Active/Inactive)
├── CertificateRegisterPage.tsx      # Master ledger: holderType, holderName, certificateType, certificateNo, issueDate, remarks
├── CertificateTemplatesPage.tsx     # Template designer: pageLayout, paperSize, orientation, margin, border, pattern, background, certificateData
├── CertificateGenerationPage.tsx    # Single issuance: certificateNo (auto), holder, type, template, issue/expiry, status Draft/Issued/Revoked
├── CertificateBulkGenerationPage.tsx# Batch issuance: batchName, type, template, holderType, class/group, total, issueDate
├── CertificateVerificationPage.tsx  # Verify by number — logs to verification history, shows Valid/Invalid/Revoked
├── CertificateReportsPage.tsx       # Saved reports + live stats (Issued/Draft/Revoked/Verifications)
└── CertificateSettingsPage.tsx      # Per-type settings: autoNumbering, serialPrefix, qrCode, digitalSignature
```

Engine logic lives in `src/lib/certificates.ts` (types, storage helpers, permissions) — same pattern as `src/lib/eduIdCards.ts` + `src/lib/cardHolders.ts` for Card Management.

Storage: all collections are kept per-branch in `localStorage` via `src/lib/eduRecords.ts` (`certificateTypes`, `certificateTemplates`, `certificateGeneration`/`certificateRegister`, `certificateBulkGeneration`, `certificateVerification`, `certificateReports`, `certificateSettings`). This keeps branch data isolated and preserves the existing seed/migration flow.

## Navigation
Top-level group in `src/components/layout/DashboardLayout.tsx`:
```
nav.eduCertificate
 ├─ /admin/certificate/types            (nav.eduCertificateTypes)
 ├─ /admin/certificate/register         (nav.eduCertificateRegister)
 ├─ /admin/certificate/templates        (nav.eduCertificateTemplates)
 ├─ /admin/certificate/generation       (nav.eduCertificateGeneration)
 ├─ /admin/certificate/bulk-generation  (nav.eduCertificateBulkGeneration)
 ├─ /admin/certificate/verification    (nav.eduCertificateVerification)
 ├─ /admin/certificate/reports          (nav.eduCertificateReports)
 └─ /admin/certificate/settings         (nav.eduCertificateSettings)
```
Legacy paths ` /admin/education-management/certificate/*` redirect to the new dedicated routes.

## Adding future promoted modules
1. Create `src/pages/admin/<module>/` with a `*Shared.tsx` context + one file per leaf.
2. Add its nav group to `DashboardLayout.tsx` (explicit children, not `EDU_NAV_SUBGROUPS`).
3. Add `MODULES` entry in `src/lib/modules.ts` (if new top-level) and sidebar ordering.
4. Add lazy imports + routes in `src/App.tsx` + legacy redirects if migrated from Education.

# Certificate Builder — Maintainable Structure

Original `CertificateBuilder.tsx` was **1737 lines** with duplicated logic for `CertificateBuilderModal` (780 lines) and `CertificateTemplateForm` (735 lines), plus types, palette, and helpers all in one file. This made manual maintenance error-prone.

## New Structure (builder/)
```
builder/
├── types.ts                     # 49 lines — CertElementType, CertElement, CustomDbVar, PaperSize etc.
├── constants.ts                 # 68 lines — GOOGLE_FONTS, CERT_PALETTE, CERT_GROUPS, DB_VARIABLE_SOURCES, isDatabaseElement
├── defaults.ts                  # 122 lines — getDefaultCertificateElements (default layout)
├── hooks/
│   └── useCertificateBuilder.ts # 381 lines — shared state, effects, helpers (drag/resize/pan/guides, addElement, save, print, DB vars)
├── components/
│   ├── ElementsPanel.tsx        # 120 lines — left panel: grouped cards (Database/Textbase/Media/Shapes), search, + Add Variable, double-click remove with confirm
│   ├── CanvasPreview.tsx        # 177 lines — center canvas: paper, border, guides, element rendering, resize handles, zoom
│   ├── PropertiesPanel.tsx      # 50 lines — right panel: Content, Font, Color, Align, B/I, Background Image (dark for images)
│   └── AddVariableModal.tsx     # 60 lines — dark modal matching screenshot: Source → Variable Name → Key → Placeholder
├── CertificateBuilderModal.tsx  # 65 lines — modal wrapper (uses hook + 3 panels + modal)
├── CertificateTemplateForm.tsx  # 64 lines — form wrapper (same hook + panels, different header/footer)
├── index.ts                     # barrel — re-exports all
└── README.md                    # this file

CertificateBuilder.tsx (root)    # 3 lines — re-export `export * from './builder'` for backward compat
```

## Why this is maintainable
- **Single source of truth**: palette, types, and default layout live in one place (`types.ts`/`constants.ts`/`defaults.ts`).
- **No duplication**: `useCertificateBuilder` holds all state/handlers once; both Modal and Form reuse it. Fix a bug in one place.
- **Small files**: each component <200 lines, focused on one responsibility — easy to locate and edit manually.
- **Explicit boundaries**: left/right panels and canvas are isolated; changing element grouping or property controls doesn’t require touching canvas code.
- **Backward compatible**: `import { CertificateBuilderModal } from './CertificateBuilder'` still works via re-export.

## Manual maintenance guide
1. **Add a new element type**: edit `types.ts` (add to `CertElementType`), `constants.ts` (add to `CERT_PALETTE` with `group`), `defaults.ts` if needed for default layout, and `CanvasPreview.tsx` for rendering.
2. **Change grouping**: edit `CERT_GROUPS` and `CERT_PALETTE[].group` in `constants.ts`; `ElementsPanel.tsx` will automatically reflect it.
3. **Adjust styling or controls**: edit the relevant panel (`ElementsPanel`, `PropertiesPanel`, `CanvasPreview`, or `AddVariableModal`) without touching the hook.
4. **Fix interaction bugs**: edit `hooks/useCertificateBuilder.ts` once — both Modal and Form benefit.

Same pattern can be applied to other large .tsx files in the app (e.g., `EduModulePage.tsx`, `Dashboard`).

# MediaLibrary — Maintainable Module

## Structure (every admin module follows this)
```
media-library/
├── types.ts          # interfaces, enums, row types for this module
├── constants.ts      # static options, permissions, status lists, palette
├── hooks/            # custom hooks (data fetching, form state, table logic)
│   └── useMediaLibraryState.ts
├── components/       # shared UI for this module (cards, modals, forms)
│   └── MediaLibraryCard.tsx
├── pages/            # one file per route/page (thin wrappers)
│   └── MediaLibraryListPage.tsx
├── index.ts          # barrel — re-exports public API
└── README.md         # this file
```

## Rules
- **One responsibility per file**: < 400 lines. If a file exceeds that, extract.
- **No duplication**: shared logic → `hooks/`, shared UI → `components/`
- **Barrel exports**: `index.ts` is the public API; other modules import from it
- **Manual edit guide**: to add a field, edit `types.ts` + `constants.ts` + relevant `components/`; to add a page, add `pages/NewPage.tsx` + route in `index.ts`

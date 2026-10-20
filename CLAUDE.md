# CLAUDE.md
@AGENTS.md

- Read PLAN.md before starting any task; follow its phase order and specs.
- TypeScript strict. No `any`. Validate user input with zod.
- Firebase **client SDK only**. Never add `firebase-admin`, API routes or server actions.
- All Firestore/Storage access goes through `src/lib/services/*` (incl. `listen.ts` for realtime listeners) — no ad-hoc Firebase calls scattered in UI code.
- Phone uses `firebase/firestore/lite`; screens and dashboard use full `firebase/firestore`. The phone landing step must not import Firebase.
- `firestore.rules` and `storage.rules` are the security boundary. Any rules change needs a matching rules test in `tests/rules/`.
- Images are resized on the phone (spot 800px JPEG, tile 128px JPEG, lqip 16px data URL). Screens never load anything larger.
- All config values (stage size, colours, timings, questions, event ids, operators) come from `src/config/*`. Never hard-code them in components.
- Display screens render with canvas 2D in a single rAF loop. Never create a DOM element per tile or per word.
- Keep pure logic (grid, queue, layout, aggregate, mask, mosaic, export rows) free of React/DOM so it is unit-testable; add vitest tests for it in `tests/unit/`.
- Animate only transform/opacity in DOM UI. No per-frame image decoding, filters or large shadowBlur on canvas.
- Phone UI: mobile-first, tap targets ≥ 48px, dark brand theme, friendly error messages.
- Next.js 16 with Cache Components: dynamic route pages await `params` inside `<Suspense>`; read browser-only values with `useClientValue` (no setState in effects).
- After each phase: run `npm run build`, `npm run test`, `npm run lint`, tick PLAN.md checkboxes, commit with message `phase-N: <summary>`.

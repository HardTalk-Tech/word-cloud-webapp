# Event Selfie Wall + Live Word Cloud

George Steuart live event app: attendees scan a QR code, add a selfie and name, answer 5 questions.
Screen 1 welcomes each person and builds a photo wall; Screen 2 shows a live word cloud shaped like the crown.
Operators run everything from a dashboard. See [PLAN.md](PLAN.md) for the full spec.

## Setup
```bash
npm install
cp .env.example .env      # Firebase web config (public values)
npm run dev
```

| Route | Purpose |
|---|---|
| `/e/<event>` | Phone flow (QR target) |
| `/screen/<event>/welcome` | Screen 1 — welcome + photo wall (`?debug=1` for stats) |
| `/screen/<event>/cloud` | Screen 2 — crown word cloud |
| `/control/login`, `/control/<event>` | Operator login + dashboard |

Event ids are allow-listed in `src/config/events.ts`: `main` (the real event) and `dev` (testing and rehearsals).

## Scripts
| Command | |
|---|---|
| `npm run test` | Unit tests (grid, queue, cloud layout, mask, export, validation) |
| `npm run e2e` | Phone smoke test (Playwright, writes to the `dev` event) |
| `npm run seed -- --event dev --count 1000` | Fake attendees + responses |
| `npm run load-test -- --event dev --mode burst` | Simulated phones, p50/p95 |
| `npm run brand` | Rebuild crown / wordmark / logo / crown silhouette images and the favicons from `public/brand/GS-Logo.png` |
| `npm run deploy:rules` | Deploy Firestore + Storage rules (Firebase CLI) |

Config lives in `src/config/*` (stage size, brand, questions, timings, operators).
Event-day docs: [docs/KIOSK_SETUP.md](docs/KIOSK_SETUP.md), [docs/RUNBOOK.md](docs/RUNBOOK.md).

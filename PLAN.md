# Event Selfie Wall + Live Word Cloud — Development Plan

> **How to use this file with Claude Code**
> - Keep this file at the repo root. Start each Claude Code session with: *"Read PLAN.md. We are working on Phase N. Do the tasks in order and stop when the Phase N 'Done when' checks pass."*
> - Work **one phase per session**, commit at the end of each phase, and tick the checkboxes as tasks finish.
> - Values marked **`TBD`** are not decided yet. Use the placeholder given and keep it in a config file, never hard-coded in components.
> - Section 14 is a short `CLAUDE.md` to copy into the repo so conventions are applied in every session.

---

## 1. Product overview

A web app for a **2-hour live corporate event** (~700+ attendees, brand: George Steuart).

1. Attendee scans a **QR code** → opens the registration page on their phone.
2. Enters **name** and adds a **selfie** (take with camera or choose from gallery) → submits.
3. **Screen 1 (main LED wall)** shows a big **welcome spotlight** card for the new attendee, then the card **flies into the photo wall** where all registered attendees are shown. The screen loops between wall and welcome as people arrive.
4. After registering, the phone shows a **questionnaire**: 5 questions, multiple selection.
5. **Screen 2 (second LED wall)** shows a **live word cloud shaped like the George Steuart crown logo**, filled with everyone's answers, sized by how often each was chosen.
6. An **operator dashboard** (login URL with a username/password) shows **all attendees and their answers**, **exports** everything to Excel/CSV, hides photos, controls both screens (pause welcome, **final crown view** for the closing), and can **reset** the event (delete all attendee data and images; operator accounts are kept).

### Priorities (in order)
1. **Smooth experience** — 60fps on the walls, fast phone flow, nobody missed in the welcome loop.
2. **Attractiveness** — brand-consistent, designed for giant LED walls.
3. **User friendliness** — one-thumb phone flow, no account, no app install.
4. **Simple implementation** — Firebase client SDK only, no custom backend. Security kept to simple rules (section 9).

### Out of scope
- Attendee accounts, multi-tenant event management, long-term data retention, analytics dashboards, server-side image processing.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest stable), App Router, TypeScript (strict) | All data pages are client components |
| Hosting | Vercel | **Hosts the app only.** No API routes, no server actions. Use **Pro** plan if this is paid client work (Hobby is non-commercial only). |
| Database | Cloud Firestore | Location `asia-south1` (Mumbai) |
| File storage | Cloud Storage for Firebase | Same location. Project must be on **Blaze** plan. Set a budget alert. |
| Firebase SDK | `firebase` **client SDK only** (modular) | Phone: `firebase/firestore/lite` + `firebase/storage` (small, no realtime needed). Screens + dashboard: full `firebase/firestore`. Dashboard: `firebase/auth`. **No `firebase-admin`.** |
| Operator auth | Firebase Authentication (Email/Password) | Accounts created in the Firebase console; email allow-list in rules |
| Image resizing | Browser canvas on the phone | Spot, tile and placeholder made before upload |
| Export | `exceljs` (browser, dynamic import) | .xlsx; CSV built by hand |
| Dashboard table | `@tanstack/react-virtual` | Smooth scrolling for 1000+ rows |
| Photo ZIP (optional) | `jszip` (browser) | |
| Styling | Tailwind CSS | Phone + dashboard UI |
| Phone animation | `motion` (Framer Motion) | Phone UI only |
| Display rendering | HTML `<canvas>` 2D | Wall + word cloud. No DOM-per-tile. |
| Crop | Automatic square crop on the phone (no crop UI) | Portrait photos crop slightly above centre |
| Validation | `zod` | |
| Seeded random | `seedrandom` | Stable layouts |
| Confetti | `canvas-confetti` | Spotlight moment |
| Tests | `vitest` (logic), `@firebase/rules-unit-testing` + emulator (rules), `@playwright/test` (phone smoke test) | |
| Scripts | `tsx`; `sharp` as a **dev dependency only** (to generate fake test photos) | Seed, load test, brand assets |

---

## 3. Architecture

```
Attendee phone ──client SDK──▶ Cloud Storage   (upload resized spot + tile JPEGs)
      │         └─client SDK──▶ Cloud Firestore (create attendee doc, create response doc)
      │
Operator dashboard ──client SDK (signed in)──▶ Firestore + Storage (hide/restore, screen control, reset)
      └─ export built in the browser from data already loaded

Screen 1 (main)  ◀── Firestore onSnapshot (attendees, control) + image URLs from Storage
Screen 2 (cloud) ◀── Firestore onSnapshot (responses, control)

Vercel: serves the Next.js pages only.
```

### Key decisions
- **Client SDK only.** Every read and write goes straight from the browser to Firebase. No Admin SDK, no service account, no API routes or server actions.
- **Images are resized on the phone before upload** so screens only ever download small files:
  - spot: 800×800 JPEG (~80–150 KB) for the welcome card
  - tile: 128×128 JPEG (~5–8 KB) for the wall
  - lqip: 16×16 JPEG data URL (~0.5 KB) stored in the Firestore doc as an instant placeholder
  - JPEG, not WebP, because iPhone Safari may not encode WebP from canvas.
- **Simple rules, not open rules.** Firebase config is public in every page, so fully open rules would let anyone wipe the wall from a browser console. Rules stay short: public read; public **create only** for attendees, responses and images (with basic size checks); updates, deletes and screen control only for operator accounts. See section 9.
- **Attendees don't sign in** (no anonymous auth). Doc id = device UUID; a second create on the same id is denied by the rules, which also prevents duplicates.
- **Operators** are Firebase Auth email/password users created in the console, allowed by an email allow-list in the rules. A reset never touches them (they aren't in Firestore).
- **Phone stays light:** the landing page loads no Firebase code; `firestore/lite` + `storage` are dynamically imported when the attendee taps "Join".
- **Word cloud counts are computed on Screen 2** from the `responses` collection (≈700 small docs). No counter documents.
- **Event ID in the URL path** so testing and rehearsals use a separate event (`dev`) and event day uses `main` with no redeploy.
- **Reset bumps an `epoch` number** in `control/state`, so phones and screens notice the reset and clear their local state automatically.

---

## 4. Display hardware facts (design constraints)

- Two LED walls, each **16 ft × 15 ft** (nearly square, ~16:15 aspect — **not 16:9**).
- Driven from **one Windows laptop** (extended desktop, two outputs: HDMI + USB-C/Thunderbolt→HDMI). A second laptop is the preferred fallback (one per wall).
- **Stage resolution: `TBD`** — depends on LED pixel pitch and LED processor input. Placeholder: **1248 × 1170** (typical P3.9). Must live in `src/config/stage.ts`.
- LED design rules:
  - **Dark background** (near-black/charcoal). Never large white areas.
  - **Bold typography only**, minimum 16px on stage. No hairlines/thin strokes (shimmer on LED).
  - Avoid fine repeating patterns (moiré on camera).
  - High contrast; brand red + white + light grey.

---

## 5. Brand

- Primary red: **`#AC1F2D`** (sampled from `GS-Logo.png`). Logo wordmark grey `#64666A` (lightened to `#B3B5B8` on dark backgrounds).
- Grey (wordmark): placeholder `#8A8A8D`.
- Background: `#0B0B0D`; surface `#16161A`.
- Display font: a heavy sans (placeholder **Montserrat 800**) for names/words; a serif close to the logo for occasional headings (placeholder **Cormorant Garamond 600**). Self-host via `next/font`.
- Assets to place in `public/brand/` (provided by client):
  - `GS-Logo.png` — original logo (provided). `npm run brand` (`scripts/make-brand-assets.ts`) builds from it:
    - `crown.png` (red crown only), `wordmark.png` (wordmark only, lightened), `logo-dark.png` (both, for dark UI);
    - `crown-mask.png` — **solid silhouette** of the crown (dotted outline joined, holes filled), white on transparent. Used as the shape mask for the word cloud and final photo mosaic; same crop box as `crown.png` so the faint crown drawn behind them lines up.
  - An SVG or higher-resolution PNG of the logo would make the large faint crowns sharper; re-run `npm run brand` after replacing `GS-Logo.png`.
- All brand values in `src/config/brand.ts`.
- **Event:** *George Steuart Health Achievers Night 2026* (`EVENT` in `src/config/brand.ts`). The wordmark is the
  George Steuart **Health** lock-up (`GS-Health-Logo.png`: grey name + teal `#11B9A8` "HEALTH"), shown with the crown
  on the phone, dashboard and both screens; the event title appears on the phone landing page, the login page, page
  titles and export file names. **The LED screens do not show the event title** (client feedback): Screen 1 shows the
  stacked logo (`logo-dark.png`, crown above the wordmark) centred in its header; Screen 2 shows the crown cloud with a
  large wordmark under it.
- **LED background** (both screens): animated dark-red glow, soft stage-light beams and glowing bokeh dots, drawn on its own
  canvas behind the screen canvas (`components/stage/BackgroundRenderer.ts`, settings in `src/config/background.ts`).
  Pre-rendered sprites, ~30 fps, never forces the wall/cloud to redraw. The cloud variant is calmer and darkens the area
  behind the crown so red words stay readable. Set `enabled: false` (solid colour) or `animate: false` (still frame) if
  the event laptop struggles.

---

## 6. Routes

| Route | Who | Purpose |
|---|---|---|
| `/e/[eventId]` | Attendee phone | Landing → register → questionnaire → thanks |
| `/screen/[eventId]/welcome` | Screen 1 laptop window | Welcome spotlight + photo wall loop, final view |
| `/screen/[eventId]/cloud` | Screen 2 laptop window | Crown word cloud, final view |
| `/control/login` | Operator | Username + password login |
| `/control/[eventId]` | Operator (signed in) | Dashboard: stats, attendees + answers, results, export, screen controls, reset |

No API routes. `eventId` must be in the allow-list `src/config/events.ts` (`['main', 'dev']`: `dev` covers testing and rehearsals). Unknown IDs → 404.

QR code encodes: `https://<domain>/e/main`.

---

## 7. Folder structure

```
src/
  app/
    e/[eventId]/page.tsx                 # phone flow (client component steps)
    screen/[eventId]/welcome/page.tsx
    screen/[eventId]/cloud/page.tsx
    control/login/page.tsx               # username + password form
    control/[eventId]/page.tsx           # wrapped in <AuthGate>
    layout.tsx, globals.css
  components/
    phone/   Landing.tsx  PhotoStep.tsx  CropStep.tsx  NameStep.tsx  Submitting.tsx
             Success.tsx  Questionnaire.tsx  QuestionCard.tsx  Thanks.tsx
    stage/   Stage.tsx                   # fixed-resolution scaler
    main/    MainScreen.tsx  WallRenderer.ts  SpotlightRenderer.ts  FinalMosaic.ts
    cloud/   CloudScreen.tsx  CloudRenderer.ts
    control/ AuthGate.tsx  Dashboard.tsx  StatsBar.tsx  ScreenControls.tsx  AttendeeTable.tsx
             AttendeeDrawer.tsx  ResultsPanel.tsx  ExportMenu.tsx  ResetDialog.tsx
  lib/
    firebase/app.ts                      # initializeApp singleton
    firebase/db-lite.ts                  # firestore/lite (phone)
    firebase/db.ts                       # full Firestore + persistentLocalCache (screens, dashboard)
    firebase/storage.ts
    firebase/auth.ts                     # operator sign-in only
    services/register.ts                 # resize → upload → create attendee (phone)
    services/responses.ts                # create response doc (phone)
    services/control.ts                  # hide/restore, screen toggles, init control doc (dashboard)
    services/reset.ts                    # delete docs + images, bump epoch (dashboard)
    image/resize.ts                      # crop + spot/tile/lqip JPEGs in the browser
    device-id.ts                         # localStorage UUID + flow state + epoch
    profanity.ts
    images/cache.ts                      # preload + decode + Map cache (screens)
    wall/slots.ts                        # photo wall: newest-25 window, 5×5 grid, stable spots (pure)
    wall/queue.ts                        # spotlight queue state machine (pure)
    mask/mask.ts                         # PNG → occupancy grid
    cloud/aggregate.ts                   # responses → counts (pure)
    cloud/layout.ts                      # masked word cloud layout (pure)
    cloud/layout.worker.ts               # runs layout.ts in a Web Worker
    cloud/tween.ts                       # interpolate between layouts
    export/build.ts                      # rows, workbook and CSV builders (pure, tested)
    export/download.ts                   # Blob → file download
    auth/username.ts                     # username ↔ internal email mapping
  config/
    stage.ts  brand.ts  events.ts  questions.ts  timings.ts  profanity-words.ts  operators.ts
  types/
    models.ts
tests/
  rules/firestore.rules.test.ts  rules/storage.rules.test.ts
scripts/
  seed.ts  load-test.ts  make-brand-assets.ts
firestore.rules  storage.rules  firebase.json  .firebaserc
docs/
  KIOSK_SETUP.md  RUNBOOK.md
```

---

## 8. Data model

### Firestore
```
events/{eventId}/attendees/{id}
events/{eventId}/responses/{id}
events/{eventId}/control/state
```

Operator accounts are **Firebase Authentication users**, not Firestore documents: email `<username>@operators.local`. Nothing in Firestore needs to survive a reset.

```ts
// src/types/models.ts
export type Attendee = {
  id: string;            // UUID from the phone (same as doc id)
  name: string;          // trimmed, 1..30 chars, profanity-checked on the phone
  department: string;    // trimmed, 1..40 chars, profanity-checked on the phone
  spotUrl: string;       // 800px JPEG download URL
  tileUrl: string;       // 128px JPEG download URL
  lqip: string;          // data:image/jpeg;base64 16x16 placeholder
  hidden: boolean;       // operator hide (false on create)
  createdAt: Timestamp;  // serverTimestamp()
};

export type ResponseDoc = {
  id: string;            // same UUID as attendee
  answers: Record<string, string[]>; // { q1: ['a','c'], ... } option ids
  createdAt: Timestamp;
};

export type ControlState = {
  mode: 'live' | 'final';
  welcomePaused: boolean;           // main screen shows wall only
  spotlightQuestion: string | null; // cloud: highlight one question, or null = all
  autoRotateQuestions: boolean;     // cloud: cycle spotlight question every 30s
  epoch: number;                    // starts at 1, +1 on every reset
  updatedAt: Timestamp;
};
```
Screens and phones must handle a missing `control/state` doc by using defaults (`mode: 'live'`, `epoch: 1`, …). The dashboard creates it on first load if it doesn't exist.

### Storage
```
events/{eventId}/spot/{id}.jpg    (800x800)
events/{eventId}/tile/{id}.jpg    (128x128)
```
Upload metadata: `contentType: 'image/jpeg'`, `cacheControl: 'public, max-age=31536000, immutable'`. Store `getDownloadURL()` results in the attendee doc.

### Questions config (`src/config/questions.ts`)
Questions are **final** (client-approved): 5 questions × 10 options, up to 3 picks each. With 50 options the cloud shows
the 30 most-chosen as big words (`maxHeroes` in `lib/cloud/layout.ts`); every other option still appears as filler. Shape:
```ts
export type Question = {
  id: string;            // 'q1'..'q5'
  text: string;
  maxSelect: number;     // e.g. 3
  options: { id: string; label: string }[]; // label = word shown in cloud (keep 1–2 words)
};
```
Option labels must be short (1–2 words) because they become cloud words.

---

## 9. Security rules (simple)

The rules are the only security layer. Keep them exactly this simple, and keep the operator email list in sync with `src/config/operators.ts`.

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOperator() {
      return request.auth != null
        && request.auth.token.email in ['admin@operators.local'];   // TBD: add operators
    }

    match /events/{eventId} {
      match /attendees/{id} {
        allow read: if true;
        allow create: if request.resource.data.name is string
                      && request.resource.data.name.size() <= 30
                      && request.resource.data.hidden == false;
        allow update, delete: if isOperator();
      }
      match /responses/{id} {
        allow read: if true;
        allow create: if request.resource.data.answers is map;
        allow delete: if isOperator();
      }
      match /control/{doc} {
        allow read: if true;
        allow write: if isOperator();
      }
    }
  }
}
```
- `create` only fires for new docs; writing the same id again is an update → denied. This is the duplicate protection.

### `storage.rules`
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isOperator() {
      return request.auth != null
        && request.auth.token.email in ['admin@operators.local'];   // TBD: add operators
    }

    match /events/{eventId}/{kind}/{file} {
      allow read: if true;
      allow create, update: if kind in ['spot', 'tile']
                            && request.resource.size < 1 * 1024 * 1024
                            && request.resource.contentType == 'image/jpeg';
      allow delete: if isOperator();
    }
  }
}
```
- `update` is allowed on images so an upload retry for the same path doesn't fail.

### Other basics
- Name validation and profanity check happen on the phone (bypassable, acceptable for this event).
- Operator **hide** button is the safety net for bad photos.
- Turn off public sign-up for Firebase Auth in the console if the option is available; the email allow-list protects data either way.
- Accepted trade-off: anyone who knows the paths can read names, photos and answers (needed so screens work without login).

---

## 10. Environment variables

```
# All public (Firebase web config is not secret; the rules protect the data)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
Provide `.env.example`. Set the same values in the Vercel project. No server secrets exist in this project.

---

## 11. Detailed specs

### 11.1 Stage component (both screens)
- `<Stage width={STAGE.width} height={STAGE.height}>` renders a fixed-size box and scales it with `transform: scale()` to fit the window while preserving aspect, centred, black letterbox.
- All display drawing uses stage coordinates. Canvas backing size = stage size × `devicePixelRatio` (cap at 2).
- `cursor: none`, no scrollbars, `user-select: none`.
- Dev helper: `?debug=1` shows FPS counter, queue length, attendee count, stage size.

### 11.2 Phone flow (`/e/[eventId]`)
Single page, step state machine, mobile-first, dark brand theme, large tap targets (≥ 48px), one primary action per screen.

1. **Landing**: logo, headline (`TBD` copy, e.g. "Join the wall"), one button **"Join Event"**. **No Firebase code on this step.** Tapping it starts `import('@/lib/services/register')` in the background.
2. **Register** (one page, in this order):
   - **Name**: max 30, live char counter, profanity check.
   - **Department**: free text, max 40, profanity check.
   - **Selfie**: one tap target → `<input type="file" accept="image/*">` (no `capture`, so the phone offers camera or gallery). No crop step: the photo is cropped to a square automatically (portrait photos slightly above centre); a circular preview shows "This is how you'll appear on screen" with a "Change photo" button.
   - Consent line ("Your photo and name will be shown on the event screens") + **Submit**. All three fields required; errors shown inline.
3. **Submitting**: progress ring (combined `uploadBytesResumable` progress of spot + tile), auto-retry up to 3× with backoff (1s, 2s, 4s). Friendly error with "Try again" / "Edit details".
4. **Success**: animated tick, "Look at the big screen!", auto-continue to questionnaire after 2.5s (or button).
5. **Questionnaire**: all 5 questions on **one scrolling page** (one card each), chips (tap to toggle), max-selection hint and enforcement. Sticky bottom bar with "N of 5 answered" and **Submit answers**; submitting with gaps scrolls to the first unanswered question and highlights it.
6. **Thanks**: "Your answers are on the second screen".

**Image pipeline** (`lib/image/resize.ts`) — the key to smooth screens:
1. `createImageBitmap(file, { imageOrientation: 'from-image' })` (fixes EXIF rotation; iOS Safari also decodes HEIC here).
2. Apply crop rectangle → draw to an 800×800 canvas (`imageSmoothingQuality = 'high'`) → `toBlob('image/jpeg', 0.82)` = **spot**. If > 250 KB, re-encode at 0.72.
3. Step down 800 → 256 → 128 (better quality than one big jump) → `toBlob('image/jpeg', 0.8)` = **tile**.
4. Draw 16×16 → `toDataURL('image/jpeg', 0.5)` = **lqip**.
5. Release bitmaps/canvases after use (low-memory phones).
Unit-test the size maths; manually test on an iPhone and a low-end Android.

**Device state** (`lib/device-id.ts`), in `localStorage` per event:
- `deviceId` (UUID v4, created on first visit), `registered`, `answered`, `epoch`.
- On load (after Join), read `control/state.epoch` with `firestore/lite` `getDoc`; if it differs from the stored epoch, clear local state and start fresh (the event was reset).
- Rescan behaviour: registered & not answered → go to questionnaire; answered → Thanks.

### 11.3 Register service (`lib/services/register.ts`, runs on the phone)
1. Validate name (zod, 1–30 chars after trim) and profanity.
2. `getDoc(attendees/{id})` — if it exists → success (already registered).
3. Upload spot and tile **in parallel** with `uploadBytesResumable` to `events/{eventId}/spot/{id}.jpg` and `/tile/{id}.jpg` with the metadata from section 8; report combined progress.
4. `getDownloadURL` for both.
5. `setDoc(attendees/{id}, { id, name, spotUrl, tileUrl, lqip, hidden: false, createdAt: serverTimestamp() })`.
6. If `setDoc` fails with `permission-denied`, re-check with `getDoc`; if the doc exists → success (an earlier retry already created it).
- Target: total submit time < 3 s on 4G.

### 11.4 Responses service (`lib/services/responses.ts`)
- Validate every question id, option id and `maxSelect` against `questions.ts` on the phone.
- `setDoc(responses/{id}, { id, answers, createdAt: serverTimestamp() })`. `permission-denied` → treat as already answered → success.

### 11.5 Screen 1 — main (welcome + wall loop)

**Data**: `onSnapshot` on `attendees` ordered by `createdAt` (filter `hidden` on the client — avoids a composite index) + `onSnapshot` on `control/state`. Full Firestore with `persistentLocalCache` so reloads are instant and survive network blips.

**Image cache** (`lib/images/cache.ts`): for every attendee, load `tileUrl` → `await img.decode()` → store. Spotlight loads `spotUrl` the same way **before** the spotlight starts. Draw `lqip` until the tile is decoded.

**Photo wall** (`lib/wall/slots.ts`, pure + unit tested; config `WALL_GRID` / `RING_PATTERN` in `config/stage.ts`):
- Header band (top ~16% of stage): the stacked George Steuart Health logo, centred. No event title.
- Only the **newest 25** attendees are on the wall, as equal round photos on a fixed **5 × 5 grid**. The first 25 fill it in registration order (left → right, top → bottom). **Photos never move**: from the 26th arrival on, the newcomer takes the spot of the oldest person on the wall (who shrinks away in sparks). With 700 attendees the wall always shows the latest 25.
- A hidden attendee fades out and the next-oldest person returns in that spot. Empty spots (< 25 arrivals) are dim glass circles.
- Background pattern: faint concentric rings centred on the grid (outer ones run past it) with light pulses travelling round. Only the pattern moves.
- Name badge on every circle (pre-rendered sprite, cached): first name in white, a short red divider, department in small spaced capitals (brand rose), wrapping to two lines when long; dark glass pill with a red rim across the circle's bottom edge. Circles use the spot photo (800px) once decoded, else the 128px tile.
- Idle ambience: every 2–3s a random circle glows/scales up slightly for ~1s; a light sweep every 20–30s; faint crown watermark (≤ 6% opacity).

**Spotlight queue** (`lib/wall/queue.ts`, pure state machine + unit tests):
- States: `WALL_IDLE → SPOT_IN → SPOT_HOLD → SPOT_FLY → (next | WALL_IDLE)`.
- Enqueue an attendee when it appears as an `added` change **after** the initial snapshot. On page reload, also enqueue attendees with `createdAt > lastSpotlightedAt` (stored in `localStorage`), max 10.
- Ignore `added` changes whose `createdAt` is still pending (`hasPendingWrites`) until the server timestamp arrives.
- Remove from queue if it becomes hidden.
- If `control.epoch` changes (reset): clear queue, image cache and `lastSpotlightedAt`, and treat the next attendees snapshot as a fresh initial snapshot (empty wall, no spotlights for old data). Same for Screen 2: clear layout and return to empty state.
- Timings in `config/timings.ts`:
  - queue 1–3: hold 3.5s
  - queue 4–10: hold 2.0s
  - queue > 10: **group spotlight** of up to 4 people side by side, hold 3.0s
  - SPOT_IN 0.6s, SPOT_FLY 0.9s
- If `welcomePaused` is true: keep queue but stay in `WALL_IDLE`; tiles still appear on the wall with a small pop.

**Spotlight visual** (`SpotlightRenderer.ts`):
- Wall dims to ~35% and blurs slightly (pre-render a blurred wall snapshot to an offscreen canvas once per spotlight; don't blur every frame).
- Card: photo ~55% of stage height, rounded corners, red accent ring; "Welcome" (serif) + name (heavy sans, auto-fit to width); confetti burst in brand colours on SPOT_IN.
- FLY: card scales/translates exactly into the attendee's grid spot (FLIP, corners rounding into a circle); wall un-dims during the flight, tile lands with a small bounce.

**Final mode** (`mode === 'final'`, `FinalMosaic.ts`):
- Load `crown-mask.png` → occupancy grid. Find the largest tile size where ≥ N cells fit inside the mask. Assign **all** visible attendees (not only the 25 on the rings) to in-mask cells (seeded). The 25 on the wall fly from their spots; everyone else grows out of their crown cell, staggered over 2.5s. Wordmark fades in below (no event title). Hold until mode returns to `live`.

**Performance rules**:
- One `requestAnimationFrame` loop per screen; skip drawing when nothing changes.
- Only `drawImage` of decoded images; no per-frame image decoding, no per-frame filters.
- Must hold **60fps with 1000 tiles** on the event laptop (test with the seed script).

### 11.6 Screen 2 — crown word cloud

**Data**: `onSnapshot` on `responses` + `control/state`. Aggregate with `lib/cloud/aggregate.ts` → `Map<optionId, count>` (also per question).

**Visual concept**: dark background; crown silhouette filled with answer words (crown moved up into the space the removed event title used); the "George Steuart / HEALTH" wordmark below the crown at ~60% of stage width: the **real wordmark drawn faint** (35%) as a frame, with its strokes filled with small random letters (`lib/cloud/letterMosaic.ts`: seeded A–Z, one per 8px cell where the stroke covers ≥ 40%, ~88% kept; warm white in the name, mint in HEALTH; clipped to the wordmark shape so none spill onto the black; pre-rendered once, a few letters twinkle). Settings in `WORDMARK_MOSAIC`. No event title. Optional question banner at the top when `spotlightQuestion` is set.

**Mask** (`lib/mask/mask.ts`): draw `crown-mask.png` at stage size → alpha threshold → occupancy grid with cell size 3px; cells outside crown pre-marked occupied.

**Two word layers**:
- **Hero layer**: each option appears once. Font size = `minHero + (maxHero − minHero) × √(count / maxCount)`. Colours: white for top 3, brand red for the rest, full opacity.
- **Filler layer**: options repeated at small sizes (12–22px stage) to fill remaining crown area until ≥ 85% of mask cells are covered or attempts run out. Repeat frequency ∝ option share (+ a floor so every option appears at least a few times). Colours: dark reds/greys at 35–55% opacity.
- **Empty state** (0 responses): all options equal weight as dim filler only, crown faintly visible. As responses arrive, words brighten and grow → "the crown comes alive".

**Layout algorithm** (`lib/cloud/layout.ts`, pure + unit tested, run inside `layout.worker.ts`):
1. Words sorted by size desc (heroes first, then filler).
2. For each word: measure with `OffscreenCanvas` + chosen font, rasterise to a bitmap at cell resolution.
3. Search positions on an Archimedean spiral from the crown centroid (heroes) or from random in-mask points (filler); accept the first position where all word cells land on free cells; mark occupied.
4. Rotation: heroes horizontal; filler 80% horizontal / 20% vertical (helps the narrow spikes and the cross).
5. Seeded with `seedrandom(eventId + bucketedCountsHash)` so similar inputs give similar layouts.
6. Return `[{ key, text, x, y, size, rotate, color, opacity, layer }]`.
- Performance target: layout < 400 ms in the worker.

**Updates & animation** (`lib/cloud/tween.ts`):
- Re-run layout at most every **6 s** (config) and only if counts changed.
- Tween from previous to next layout over 1.2s: words matched by `key` (hero: `optionId`; filler: `optionId#n`) interpolate x/y/size/opacity; unmatched fade in/out.
- When a hero's count increases since last frame, play a 0.8s glow pulse on that word.
- **New answers fly out of the wordmark** (`lib/cloud/letterFlight.ts`): each letter of the chosen word pops out of a matching letter in the wordmark (staggered), arcs up into its place in the word in the crown shedding soft star sparks (pooled, ≤ 0.45 alpha), and the word pulses as they land. Timings in `CLOUD` (`letterPopMs`, `letterFlyMs`, `letterStaggerMs`, `spark*`).
- Spotlight question mode: words of that question at full brightness, others dimmed to 25%, banner shows the question text. Operator-controlled, plus optional auto-rotation every 30 s.

**Final mode**: all filler fades out, heroes settle into a calm final layout, wordmark scales up slightly; matches Screen 1's crown finale.

### 11.7 Operator dashboard (`/control/login` → `/control/[eventId]`)

**Accounts**
- Create in Firebase console → Authentication → Users → Add user: email `<username>@operators.local`, password (min 8 chars).
- Add the username to `src/config/operators.ts` and the email to the allow-list in **both** rules files; deploy rules (`firebase deploy --only firestore:rules,storage`).
- Remove an operator: delete the user in the console and remove it from the allow-lists.

**Login & session**
- `/control/login`: **Username** and **Password** fields (operators never see the internal email), "Sign in" button, generic error "Invalid username or password".
- `signInWithEmailAndPassword(auth, usernameToEmail(u), p)` with `browserLocalPersistence` so the operator stays signed in on that browser.
- `<AuthGate>` on dashboard pages: wait for `onAuthStateChanged`; no user, or email not in `operators.ts` → redirect to `/control/login?next=<path>`.
- Logout button → `signOut`.
- Event switcher in the header (dropdown of allowed event ids) so rehearsal data can be checked and reset.

**Dashboard sections** (dark theme, desktop-first, still usable on a phone)

1. **Stats bar** (live): registered, answered, answer rate %, hidden, last arrival time.
2. **Screen controls** (live state from `control/state`, writes via `services/control.ts`): Pause welcome toggle; Mode Live / Final; Spotlight question (All / Q1–Q5); Auto-rotate questions toggle. Creates `control/state` with defaults if missing. Links to Screen 1, Screen 2 and the QR target URL with copy buttons.
3. **Attendees & answers table** (live: `onSnapshot` on `attendees` + `responses`, joined client-side by id):
   - Columns: #, photo thumb, name, department, registered at (Asia/Colombo time), answered (yes/no), one column per question showing the selected option **labels**, status (visible/hidden), action (Hide / Restore → `updateDoc({ hidden })`).
   - Search by name; filters: All / Answered / Not answered / Hidden; sort by time or name.
   - Virtualised rows with `@tanstack/react-virtual`, so 1000+ rows scroll smoothly.
   - Row click → side drawer: large spotlight photo, name, every question with its selected answers, timestamps, Hide/Restore.
4. **Results panel**: for each question, horizontal bars per option with count and % of respondents (multi-select, so percentages can sum to over 100%; say so in a hint). Uses the same `aggregate.ts` as Screen 2.
5. **Export menu** — built entirely in the browser from the data the dashboard already has loaded (no extra reads):
   - **Excel (.xlsx)** — default and recommended (`exceljs` loaded with dynamic import):
     - Sheet `Attendees`: No., Name, Department, Registered at, Answered, Q1…Q5 (column header = question text, cell = selected labels joined with `; `), Photo URL, Hidden.
     - Sheet `Summary`: Question, Option, Count, % of respondents.
     - Sheet `Answers (long)`: Name, Department, Question, Option — one row per selection (easy pivot tables).
     - Bold frozen header row, autofilter, sensible column widths.
   - **CSV**: the `Attendees` sheet only, UTF-8 **with BOM** so Excel shows Sinhala/Tamil names correctly; proper escaping of commas, quotes and newlines.
   - **Photos (.zip)**, optional: `jszip`, fetch each `spotUrl`, file names `NNN_<name>.jpg`, progress indicator.
   - Filenames: `george-steuart-<eventId>-<YYYY-MM-DD-HHmm>.xlsx|csv|zip`.
   - Row building in pure functions in `lib/export/build.ts` (unit tested); `lib/export/download.ts` triggers the download.
6. **Danger zone — Reset event** (`services/reset.ts`):
   - "Reset event" button → dialog showing what will be deleted (N attendees, N responses, ~2N images), a **"Download Excel first"** button, and a text field that must equal `RESET <eventId>` before Confirm enables.
   - Steps, with a progress bar ("Deleting images 340 / 1400"):
     1. `setDoc(control/state, defaults + { epoch: increment(1) }, { merge: true })` — screens clear immediately.
     2. Delete all `attendees` and `responses` docs with `writeBatch`, chunks of 400.
     3. `listAll` on `events/{eventId}/spot` and `/tile`, `deleteObject` each with a concurrency limit of 20.
   - Takes roughly 10–30 s for 700 attendees; the dialog says "keep this tab open" and can safely be re-run if interrupted.
   - **Operator accounts are not affected** (they live in Firebase Authentication). Other event ids are not affected.

---

## 12. Development phases

### Phase 0 — Project setup
- [x] Create Next.js app (TypeScript strict, App Router, Tailwind, ESLint, `src/` dir).
- [x] Add dependencies from section 2 (`sharp` as dev dependency only).
- [x] `src/config/*` files with placeholders (stage 1248×1170, brand colours, events allow-list, 5 placeholder questions, timings, operators).
- [x] `lib/firebase/*` (app singleton, `db-lite`, `db` with persistent cache, storage, auth).
- [x] `.env.example`, `firestore.rules`, `storage.rules` (section 9), `firebase.json`, `.firebaserc`.
- [ ] Firebase console: Blaze plan + budget alert, Firestore + Storage in `asia-south1`, enable Email/Password auth, create the `admin` operator user.
- [ ] Deploy rules with the Firebase CLI.
- [x] `scripts/make-brand-assets.ts` → crown, wordmark, logo and `crown-mask.png` from `GS-Logo.png`.
- [ ] Vitest + Playwright + Firebase emulator configured; `npm run test`, `npm run test:rules`, `npm run e2e`.

**Done when:** app runs locally and on Vercel, `npm run build` passes, a test page reads a doc from Firestore, rules are deployed.

### Phase 1 — Phone registration flow
- [x] `device-id.ts` with per-event state and epoch.
- [x] Landing, Photo, Crop, Name steps with motion transitions; Firebase dynamically imported on "Join".
- [x] `image/resize.ts` (orientation, crop, spot/tile/lqip JPEGs).
- [x] `services/register.ts` per 11.3 (parallel resumable uploads, progress, retry, idempotency).
- [x] Success screen.
- [ ] Rules tests: anyone can create an attendee and JPEG images; nobody but an operator can update/delete; a second create on the same id is denied; non-JPEG or > 1 MB uploads are denied.
- [x] Playwright smoke test: mobile viewport, upload fixture image, see success.

**Done when:** registering from a real Android and iPhone works on mobile data, attendee doc + 2 small JPEGs (spot ≤ 250 KB, tile ≤ 10 KB) appear in Firebase, re-submitting does not duplicate, end-to-end < 3s on 4G.

### Phase 2 — Stage + Screen 1 wall
- [x] `Stage.tsx` with debug overlay.
- [x] Attendee listener + image cache with lqip fallback.
- [x] `grid.ts` tiers + seeded slot order (unit tests: capacity, no overlap, fits stage).
- [x] `WallRenderer.ts` canvas drawing, header band, counter, idle ambience, tier-change animation.

**Done when:** with 1000 seeded attendees the wall renders at 60fps on the event laptop at stage resolution, new attendees pop into place within 2s of registering.

### Phase 3 — Welcome spotlight loop
- [x] `queue.ts` state machine (unit tests: ordering, burst handling, group spotlight, hidden removal, reload catch-up).
- [x] `SpotlightRenderer.ts` (dim/blur snapshot, card, name auto-fit, confetti, FLIP fly-in).
- [x] Pre-decode spotlight image before SPOT_IN.
- [x] `welcomePaused` support.

**Done when:** a burst of 50 registrations in 30s is fully shown (none skipped), queue drains smoothly, no visible frame drops during fly-in.

### Phase 4 — Questionnaire
- [x] `Questionnaire.tsx`, `QuestionCard.tsx` (chips, maxSelect, progress dots, back/next).
- [x] `services/responses.ts` with validation.
- [x] Thanks screen; rescan logic.
- [ ] Rules tests for responses (create once, no update, operator-only delete).

**Done when:** answers save once per device, invalid selections are blocked in the UI, flow feels native on a small Android.

### Phase 5 — Crown word cloud (Screen 2)
- [x] `mask.ts` (unit test: inside/outside on the crown mask).
- [x] `aggregate.ts` (unit tests).
- [x] `layout.ts` + worker (unit tests: no overlaps, all words inside mask, deterministic for same seed, < 400 ms for 30 heroes + filler).
- [x] `CloudRenderer.ts` + `tween.ts` (smooth transitions, glow pulse).
- [x] Empty state, spotlight-question mode, auto-rotate flag.
- [x] Swap placeholder mask for the real `crown-mask.png` (built from `GS-Logo.png`).

**Done when:** with the load script feeding 700 responses, the crown stays clearly recognisable throughout, re-layouts glide without jumps, 60fps.

### Phase 6 — Operator login + dashboard
- [x] `auth/username.ts`, `/control/login`, `<AuthGate>`, logout, event switcher.
- [x] Dashboard: stats bar, screen controls (`services/control.ts`), attendees & answers table (virtualised, search/filter/sort, drawer, hide/restore), results panel.
- [x] `lib/export/build.ts` + `ExportMenu` (unit tests: column order, option id → label mapping, CSV BOM and escaping).
- [x] Optional photos ZIP.
- [x] `ResetDialog` + `services/reset.ts` + epoch handling on phone and both screens.
- [ ] Rules tests: signed-in operator can update/delete/write control; a signed-in user not in the allow-list cannot.

**Done when:** the operator can log in at `/control/login`; signed-out users are sent to login; the table shows all attendees with their answers live; the exported .xlsx opens in Excel with three sheets and correct Sinhala/Tamil names; the CSV opens correctly in Excel; Reset on `dev` deletes all its docs and images, both screens clear within 2s, a previously registered phone can register again, and the operator can still log in.

### Phase 6b — Final mode
- [x] `FinalMosaic.ts` photos-into-crown animation on Screen 1.
- [x] Cloud final mode on Screen 2.

**Done when:** switching Mode to Final in the dashboard animates both screens into the crown finale; switching back resumes live; hiding a photo removes it from Screen 1 within 2s.

### Phase 7 — Scripts, load testing, hardening
- [x] `scripts/seed.ts` — Node script using the **client SDK**: create N fake attendees (test photos generated with `sharp`, resized to the same spot/tile sizes) and responses for an event id.
- [x] `scripts/load-test.ts` — same approach, simulating phones: steady (6/min), burst (50 in 30s) and 700 total; report p50/p95 time per registration and errors.
- [ ] Network-drop test: disconnect display laptop Wi-Fi for 60s, reconnect → screens catch up, no missed spotlights beyond cap.
- [ ] Performance budget: landing step loads no Firebase code; landing JS < 150 KB gzipped; Lighthouse mobile performance ≥ 90 on `/e/main`.

**Done when:** load test passes with 0 errors and p95 registration < 3s; both screens stay at 60fps during the burst test.

### Phase 8 — Event readiness docs
- [x] `docs/KIOSK_SETUP.md` (see 13.1).
- [x] `docs/RUNBOOK.md` (see 13.2).
- [x] Generate print-ready QR code (SVG/PNG) for `https://<domain>/e/main`.

**Done when:** a teammate can set up both walls from the docs alone during rehearsal.

### Phase 9 — Client feedback (screens)
- [x] Remove "Achievers Night 2026" from both LED screens (wall header, wall finale, cloud).
- [x] Screen 1 header: stacked logo (crown above "George Steuart / HEALTH"), centred.
- [x] Screen 1 photo wall: newest 25 as still circles on a 5 × 5 grid; a newcomer replaces the oldest in place; decorative rings with travelling pulses behind; name + department badges, exit sparks. `lib/wall/slots.ts` + `tests/unit/slots.test.ts` (replaces `lib/wall/grid.ts`).
- [x] Final mode builds the crown from all attendees, not just the 25 on the wall.
- [x] Screen 2: crown moved up, wordmark under it.
- [x] Screen 2 wordmark ~60% width: real wordmark as a faint frame + sparse random letters clipped inside its strokes (`letterMosaic.ts` + tests).
- [x] Screen 2 new answers: letters pop out of the wordmark and fly into the word with soft star sparks (`letterFlight.ts` + tests).

**Done when:** Screen 1 never shows more than 25 photos, a new arrival takes the oldest person's spot and nobody else moves; final mode still shows everyone; neither screen shows the event title.

---

## 13. Event operations

### 13.1 Kiosk setup (Windows laptop → 2 LED walls)
- Settings → Display: **Extend**, arrange walls left→right, set each output to the LED processor's required input resolution (`TBD` from vendor), **scaling 100%**.
- Power: plugged in, High performance plan, sleep/screen saver off, lid-close = do nothing.
- Focus / Do Not Disturb on; pause Windows Update; taskbar auto-hide.
- Chrome hardware acceleration on.
- Launch (adjust `window-position` to each display's left x):
```bat
start chrome --kiosk --user-data-dir=C:\kiosk-welcome --window-position=1920,0 https://<domain>/screen/main/welcome
start chrome --kiosk --user-data-dir=C:\kiosk-cloud --window-position=3168,0 https://<domain>/screen/main/cloud
```
- Prefer wired Ethernet for the laptop; phone hotspot as backup.

### 13.2 Event-day runbook
- Before event day: create operator accounts, add them to the rules allow-lists, deploy rules, test each login.
- T-60 min: open screens, verify `?debug=1` shows 60fps, then reload without debug. Test one registration end to end on a phone using mobile data.
- T-30 min: log in to the dashboard; if `main` has test registrations, **Reset** it; confirm both screens show the empty state.
- During: operator watches the dashboard; hide any bad photo immediately.
- If a screen freezes: Alt+F4 the window, re-run its launch line (state reloads from the Firestore cache).
- Closing: operator switches mode → `final`.
- After event: dashboard → Export Excel (and photos ZIP if the client wants them). After the agreed retention period, Reset `main`.

---

## 14. CLAUDE.md (copy into the repo root)

```md
# CLAUDE.md
- Read PLAN.md before starting any task; follow its phase order and specs.
- TypeScript strict. No `any`. Validate user input with zod.
- Firebase **client SDK only**. Never add `firebase-admin`, API routes or server actions.
- All Firestore/Storage access goes through `src/lib/services/*` or the listeners in screen/dashboard components — no ad-hoc Firebase calls scattered in UI code.
- Phone uses `firebase/firestore/lite`; screens and dashboard use full `firebase/firestore`. The phone landing step must not import Firebase.
- `firestore.rules` and `storage.rules` are the security boundary. Any rules change needs a matching rules test in `tests/rules/`.
- Images are resized on the phone (spot 800px JPEG, tile 128px JPEG, lqip 16px data URL). Screens never load anything larger.
- All config values (stage size, colours, timings, questions, event ids, operators) come from `src/config/*`. Never hard-code them in components.
- Display screens render with canvas 2D in a single rAF loop. Never create a DOM element per tile or per word.
- Keep pure logic (grid, queue, layout, aggregate, mask, export rows) free of React/DOM so it is unit-testable; add vitest tests for it.
- Animate only transform/opacity in DOM UI. No per-frame image decoding or filters on canvas.
- Phone UI: mobile-first, tap targets ≥ 48px, dark brand theme, friendly error messages.
- After each phase: run `npm run build`, `npm run test`, `npm run test:rules`, tick PLAN.md checkboxes, commit with message `phase-N: <summary>`.
```

---

## 15. Open questions (fill in, then update config)

| # | Question | Affects | Placeholder |
|---|---|---|---|
| 1 | LED pixel pitch, exact wall resolution, LED processor input resolution/mapping | `config/stage.ts`, kiosk setup | 1248 × 1170 |
| 2 | Final 5 questions, options (short labels), max selections each | `config/questions.ts` | Done: final 5 questions, 10 options each, max 3 picks (confirm max picks) |
| 3 | Exact brand red and fonts / logo files (SVG) and crown silhouette | `config/brand.ts`, `public/brand/` | Done: `#AC1F2D` + crown from `GS-Logo.png` (SVG would be sharper); fonts still placeholders |
| 4 | Welcome/landing copy and consent wording | phone UI | placeholder copy |
| 5 | One laptop or two for the walls | kiosk setup | one laptop |
| 6 | Data retention after event (days) | reset timing | 7 days |
| 7 | Domain name for the QR code | QR, docs | Vercel default domain |
| 8 | Operator usernames (how many accounts) | console users, rules allow-list, `config/operators.ts` | one `admin` account |
| 9 | Does the client want the selfies exported (photos ZIP)? | export menu | optional, included |

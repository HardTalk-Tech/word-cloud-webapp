# User guide — trying every screen locally

This walks through running the app on your own computer and trying each URL: the attendee phone flow,
Screen 1 (welcome wall), Screen 2 (word cloud) and the operator dashboard.

Use the **`dev`** event for local testing (`main` is the real event). All examples below use `dev`.

---

## 1. Start the app

```bash
npm install          # first time only
npm run dev
```

Open <http://localhost:3000>. It redirects to the attendee page for `main`; for testing use the URLs below.

> Your `.env` must contain the five `NEXT_PUBLIC_FIREBASE_*` values (see `.env.example`).
> Everything you do locally writes to the real Firebase project, under `events/dev/...`.

---

## 2. Recommended layout for a full test

Open these side by side (two browser windows work well):

| Window | URL | What it is |
|---|---|---|
| A | <http://localhost:3000/screen/dev/welcome?debug=1> | Screen 1 — welcome spotlight + photo wall |
| B | <http://localhost:3000/screen/dev/cloud?debug=1> | Screen 2 — crown word cloud |
| C | <http://localhost:3000/control/dev> | Operator dashboard |
| D | Phone, or <http://localhost:3000/e/dev> in a narrow window | Attendee flow |

Then register in **D** and watch **A** welcome you, answer the questions and watch **B** update,
and control both screens from **C**.

---

## 3. Attendee phone flow — `/e/dev`

URL: <http://localhost:3000/e/dev>

### On your computer
Open Chrome DevTools (F12) → **Toggle device toolbar** (Ctrl+Shift+M) → pick a phone (e.g. Pixel 7). Then:

1. **Join Event** — landing page (no Firebase is loaded yet).
2. **Join the event** — one page with three fields:
   - **Name** (max 30 characters; rude words are blocked)
   - **Department** (max 40 characters)
   - **Selfie** — tap *Add your selfie* and pick any photo (on a phone this offers camera or gallery).
     The photo is cropped to a square automatically; the circle preview shows how it will look.
   Tap **Submit**. Empty fields are highlighted in red.
3. Progress ring while the photo uploads → **Look at the big screen!** → continues automatically.
4. **5 questions on one page** — scroll down and tap chips (each question shows "Pick up to N").
   The bar at the bottom shows how many are answered; **Submit answers** jumps to any unanswered question.
5. **Thank you** screen.

**Try it again as a new person:** the phone remembers you per event. To register again, open the page in a
new **Incognito window**, or DevTools → Application → Local Storage → delete the key `ew:device:dev`.
Re-opening as the same person skips straight to the questions (if not answered) or the thank-you screen.

### On a real phone (same Wi-Fi)
1. Find your computer's local IP: run `ipconfig` and look for **IPv4 Address**, e.g. `192.168.1.20`.
2. Start the dev server bound to that address (the dev server only serves other devices on the host it was started with):
   ```bash
   npx next dev -H 192.168.1.20
   ```
   Or run the production build, which has no such restriction:
   ```bash
   npm run build
   npm start
   ```
3. On the phone open `http://192.168.1.20:3000/e/dev`.
4. On the computer, open the screens with the same address, e.g. `http://192.168.1.20:3000/screen/dev/welcome`
   (`localhost` URLs also keep working on the computer).

If the phone can't connect, allow Node.js through Windows Firewall (Private networks).

---

## 4. Screen 1 — welcome wall — `/screen/dev/welcome`

URL: <http://localhost:3000/screen/dev/welcome?debug=1>

- **Header:** the George Steuart Health logo (crown above the wordmark), centred.
- **Photo wall:** the **25 most recent** arrivals as round photos on a 5 × 5 grid, filled in registration
  order. Photos never move: from the 26th arrival on, the newcomer takes the spot of the oldest person on the
  wall. Each photo has a badge with the first name and department. Faint rings with travelling lights run
  behind the grid.
- **Idle glow:** every 2–3 s a random circle grows slightly with a red ring.
- **Welcome spotlight:** when someone registers, the wall dims, confetti fires, a big card shows
  *Welcome* + their name, then the photo flies into its spot on the wall.
  - Several arrivals queue up and are shown **one by one, 3 s each** (nobody is skipped: 30 people at once take ~90 s).

**Debug overlay (`?debug=1`):** fps, attendees, queue length, current phase, photos on the wall (n/25), mode, epoch,
stage size and **synced** (yes = live data from the server). Remove `?debug=1` for the clean view.

**How to trigger a spotlight:** register from the phone flow (section 3), or add fake people:
```bash
npm run seed -- --event dev --count 5 --delay 3000    # 5 people, one every 3 s
```
The same command works in **Windows PowerShell** (which drops the `--`): the script then reads the options from
npm's own command line and prints `(read options from the npm command line: …)`. If they still can't be read it
stops with a message instead of seeding the default 100 people.

**Simultaneous registrations:** leave out `--delay` and everyone is written at once (16 in parallel), e.g.
`npm run seed -- --event dev --count 20`. For a timed burst of real-looking phone uploads use
`npm run load-test -- --event dev --mode burst` (50 in 30 s). Screen 1 queues them and shows one at a time.

The page renders a fixed 1248 × 1170 stage scaled to fit the window (black bars on the sides are normal).
Press **F11** for full screen.

---

## 5. Screen 2 — word cloud — `/screen/dev/cloud`

URL: <http://localhost:3000/screen/dev/cloud?debug=1>

- A crown shape filled with the answer words. Bigger and brighter = chosen more often.
  The top 3 answers are white, the other answers are red, and small dim "filler" words fill the edges of the crown.
- **No answers yet:** only dim filler words and a faint crown.
- **New answers:** the letters of each chosen word pop out of the "George Steuart / HEALTH" wordmark one by
  one and fly up with soft sparkles into that word in the crown, which then pulses. The layout is recalculated
  at most every 6 s and words glide to their new place.
- **Wordmark** below the crown: the real George Steuart Health wordmark, faint, with its strokes filled
  with small random letters; a few twinkle.

**How to feed it:** submit the questionnaire from the phone flow, or seed people with answers:
```bash
npm run seed -- --event dev --count 50 --responses 1
```

---

## 6. Operator dashboard — `/control/dev`

URL: <http://localhost:3000/control/dev> → redirects to <http://localhost:3000/control/login>

### One-time: create the operator account
Firebase console → **Authentication**:
1. **Sign-in method** → enable **Email/Password**.
2. **Users → Add user**: email `admin@operators.local`, a password of 8+ characters.

Log in with username **`admin`** and that password (you never type the `@operators.local` part).
Other usernames are rejected unless added to `src/config/operators.ts`.

### What to try
| Section | Try this | Where to look |
|---|---|---|
| **Event switcher** (top bar) | Switch between `dev` and `main` | Each event has separate data |
| **Stats** | Register someone | Registered / Answered / rate / Hidden / last arrival update live |
| **Mode: Live / Final crown** | Click **Final crown** | Screen 1: every attendee's photo (not just the 25 on the wall) forms a crown shape. Screen 2: filler fades, crown calms. Click **Live** to go back |
| **Pause welcome spotlight** | Turn on, then register someone | Screen 1 skips the spotlight; the tile just pops into the wall. Turn off → queued welcomes play |
| **Cloud spotlight question** | Click **Q1…Q5** | Screen 2 highlights that question's words, dims the rest, shows the question at the top. **All** to clear |
| **Auto-rotate** | Turn on | Screen 2 cycles Q1→Q5 every 30 s |
| **Links + QR** | Copy buttons, **Download QR** | QR points at `/e/<event>` on the domain you opened the dashboard on |
| **Attendees & answers** | Search, filters (Answered / Not answered / Hidden), sort | Click a row → side panel with the big photo and all answers |
| **Hide / Restore** | Hide someone | They disappear from Screen 1 within ~2 s (and from the welcome queue) |
| **Results** | — | Bars per option with count and % of respondents |
| **Export** | **Excel**, **CSV**, **Photos (.zip)** | Files named `george-steuart-dev-<date-time>.*` |
| **Danger zone → Reset event** | Type `RESET dev` → Confirm | Deletes all `dev` attendees, answers and photos; both screens clear; phones can register again |

> **Photos (.zip)** needs CORS on the Storage bucket. If every photo fails, see `docs/RUNBOOK.md` → *Storage CORS*.

---

## 7. Handy test scripts

| Command | What it does |
|---|---|
| `npm run seed -- --event dev --count 300` | 300 fake attendees (80% with answers) — fills the wall and the cloud |
| `npm run seed -- --event dev --count 5 --delay 3000` | Arrivals one by one, to watch spotlights |
| `npm run load-test -- --event dev --mode burst` | 50 simulated phones in 30 s; prints p50/p95 registration time |
| `npm run e2e` | Automated phone flow test (registers "E2E Tester" in `dev`) |
| `npm run test` | Unit tests |

The scripts refuse to write to `main` unless you add `--force`.
Clean up afterwards with **Reset event** on `dev` in the dashboard.

---

## 8. All URLs at a glance

There are two events: `dev` (testing) and `main` (the real event). Replace `dev` with `main` for the real thing.
Any other event id shows "Page not found".

| URL | Who |
|---|---|
| `/e/dev` | Attendee (QR code target) |
| `/screen/dev/welcome` | Screen 1 — welcome + photo wall (`?debug=1` for stats) |
| `/screen/dev/cloud` | Screen 2 — word cloud (`?debug=1` for stats) |
| `/control/login` | Operator login |
| `/control/dev` | Operator dashboard |
| `/control` | Redirects to `/control/main` |
| `/` | Redirects to `/e/main` |

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Phone shows "Couldn't send your photo" | Check internet; tap **Try again**. Check Storage is enabled in Firebase. |
| Screens stay empty | Check `?debug=1` → *synced*. Make sure you're on the same event id as the phone. |
| Can't log in to the dashboard | Email/Password must be enabled and `admin@operators.local` created (section 6). |
| Hide / Reset fail with "permission" | You deployed the strict rules but the operator email isn't in the allow-list in `firestore.rules` / `storage.rules`. |
| Phone on Wi-Fi gets a blank page | Start with `npx next dev -H <your-ip>` or use `npm run build && npm start` (section 3). |
| I can't register again on the same phone | Use Incognito, or delete `ew:device:dev` from Local Storage, or reset the event. |

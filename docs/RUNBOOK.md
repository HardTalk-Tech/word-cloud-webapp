# Event-day runbook

| What | URL |
|---|---|
| Attendee (QR code) | `https://<domain>/e/main` |
| Screen 1 — welcome wall | `https://<domain>/screen/main/welcome` |
| Screen 2 — word cloud | `https://<domain>/screen/main/cloud` |
| Operator dashboard | `https://<domain>/control/main` (login at `/control/login`) |

Testing and rehearsals: replace `main` with `dev`. The two events have separate data and separate resets.

## One-time setup (before event day)
1. **Firebase console**
   - Blaze plan + a budget alert.
   - Authentication → Sign-in method → enable **Email/Password**.
   - Authentication → Users → **Add user**: `admin@operators.local` + a strong password (min 8 chars).
     More operators: add `<username>@operators.local`, put the username in `src/config/operators.ts`
     and the email in the allow-list in **both** `firestore.rules` and `storage.rules`.
2. **Rules** (when you leave test mode): `npm i -g firebase-tools`, `firebase login`, then `npm run deploy:rules`.
   Test-mode rules expire after 30 days, so deploy the real rules before the event either way.
3. **Storage CORS** (only needed for the dashboard's *Photos (.zip)* export):
   `gcloud storage buckets update gs://<bucket> --cors-file=cors.json`
   (or `gsutil cors set cors.json gs://<bucket>`).
4. **Vercel**: import the repo, add the five `NEXT_PUBLIC_FIREBASE_*` env vars from `.env`, deploy.
5. **QR code**: dashboard → Screen controls → *Download QR (SVG, print)*. It encodes `https://<domain>/e/main`
   for whatever domain the dashboard is opened on — download it from the production domain.
6. Test each operator login.

## Rehearsal
Use the `dev` event (`/screen/dev/welcome`, `/screen/dev/cloud`, `/control/dev`).
- `npm run seed -- --event dev --count 700` fills the walls with fake people (add `--delay 2000` to watch
  arrivals one by one).
- `npm run load-test -- --event dev --mode burst` simulates 50 phones in 30 s and prints p50 / p95.
- Try **Final crown** mode, **Pause welcome**, hide/restore, Excel export, then **Reset** `dev`.

## T-60 min
- Launch both screens (see `KIOSK_SETUP.md`) with `?debug=1`: check **fps 60** and **synced: yes**, then relaunch without it.
- Register once from a phone **on mobile data** end to end. Watch the spotlight on Screen 1 and the answers on Screen 2.

## T-30 min
- Log in to the dashboard. If `main` has test registrations → **Reset event** (type `RESET main`).
- Both screens should show the empty state (empty wall, dim crown).

## During the event
- Keep the dashboard open. **Hide** any bad photo immediately — it disappears from Screen 1 within ~2 s
  (and is removed from the welcome queue if not shown yet).
- **Pause welcome spotlight** if you need the wall calm (new people still pop into the wall).
- Cloud: pick a **spotlight question** to highlight it, or turn on **auto-rotate** (30 s per question).
- Screen frozen? **Alt+F4** that window and re-run its launch line — state reloads from the local cache and catches up
  (up to 10 missed welcomes are replayed).

## Closing
- Dashboard → Mode **Final crown**: every photo flies into the crown on Screen 1; Screen 2 settles to a calm crown.
- Switch back to **Live** to resume.

## After the event
- Dashboard → **Excel (.xlsx)** (3 sheets: Attendees, Summary, Answers (long)). CSV and Photos (.zip) if the client wants them.
- After the agreed retention period, **Reset** `main`. Operator accounts are not affected.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Phone: "Couldn't send your photo" | Weak signal — tap *Try again* (uploads retry 3× automatically first). |
| Screen shows nothing new | Check the laptop network; `?debug=1` → *synced*. Firestore reconnects by itself. |
| Photos ZIP: all photos failed | Storage CORS not set (step 3 above). |
| Dashboard: permission errors on Hide/Reset | Rules deployed but the operator email isn't in the allow-list. |

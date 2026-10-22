// Shared helpers for the Node scripts. Client SDK only (same rules as phones).
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase/app';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import sharp from 'sharp';
import { DEPARTMENTS } from '../src/config/departments';
import { QUESTIONS } from '../src/config/questions';
import { isEventId } from '../src/config/events';
import { paths } from '../src/lib/paths';

export function firebase() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.projectId) throw new Error('Missing NEXT_PUBLIC_FIREBASE_* env (run with --env-file=.env)');
  const app = initializeApp(config);
  return { db: getFirestore(app), storage: getStorage(app) };
}

export type Fb = ReturnType<typeof firebase>;

/** Options the scripts understand (also read from npm's env vars, see `args`). */
const OPTIONS = ['event', 'count', 'responses', 'unique', 'delay', 'force', 'mode', 'over'] as const;

/**
 * `--key value` / `--key=value` / `--flag` from the command line.
 *
 * Windows PowerShell swallows the `--` in `npm run seed -- --count 30`. npm then keeps the flags as its own
 * config: `--count=30` reaches us as `npm_config_count=30` (read below), but `--count 30` becomes
 * `npm_config_count=true` plus a loose "30" argument with no way to pair them back up here. `args()` then
 * recovers them from npm's own command line; if that fails too, stop with a clear message instead of silently
 * using the defaults (which is how 30 turned into 100).
 */
export function parseArgs(a: readonly string[], env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  const loose: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) {
      loose.push(a[i]);
      continue;
    }
    const eq = a[i].indexOf('=');
    if (eq > 0) {
      out[a[i].slice(2, eq)] = a[i].slice(eq + 1);
      continue;
    }
    const key = a[i].slice(2);
    const next = a[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else out[key] = 'true';
  }
  const valueless: string[] = [];
  for (const key of OPTIONS) {
    const value = env[`npm_config_${key}`];
    if (out[key] !== undefined || value === undefined || value === '') continue;
    if (value === 'true' && loose.length) valueless.push(`--${key}`);
    else out[key] = value;
  }
  if (valueless.length || loose.length) {
    throw new Error(
      [
        `Could not read ${valueless.length ? valueless.join(', ') : 'the options'} (got loose values: ${loose.join(' ') || 'none'}).`,
        'PowerShell drops the "--" in "npm run seed -- --count 30". Use "=" instead, e.g.',
        '  npm run seed -- --event=dev --count=30 --delay=3000',
      ].join('\n'),
    );
  }
  return out;
}

/** Split a Windows command line into arguments (double quotes group, as cmd / PowerShell pass them). */
export function splitCommandLine(cmd: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  for (let m = re.exec(cmd); m; m = re.exec(cmd)) out.push(m[1] ?? m[2]);
  return out;
}

/** From npm's command line (`node npm-cli.js run seed --event dev --count 5`), the arguments after the script name. */
export function npmRunArgs(cmd: string): string[] | null {
  const parts = splitCommandLine(cmd);
  const cli = parts.findIndex((p) => /npm-cli\.js$/i.test(p));
  if (cli < 0) return null;
  const run = parts.findIndex((p, i) => i > cli && ['run', 'run-script', 'rum', 'urn'].includes(p));
  if (run < 0 || run + 1 >= parts.length) return null;
  return parts.slice(run + 2).filter((p) => p !== '--');
}

/**
 * Windows only: the arguments of the `npm run …` that started this script, read from the process list
 * (walks up a few parents: npm → cmd → tsx → us). These keep the flags in the order they were typed.
 */
function npmParentArgs(): string[] | null {
  if (process.platform !== 'win32') return null;
  try {
    const json = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress'],
      { encoding: 'utf8', timeout: 15000, windowsHide: true },
    );
    type Proc = { ProcessId: number; ParentProcessId: number; CommandLine: string | null };
    const byId = new Map((JSON.parse(json) as Proc[]).map((p) => [p.ProcessId, p]));
    let p = byId.get(process.ppid);
    for (let depth = 0; p && depth < 8; depth++) {
      const found = p.CommandLine ? npmRunArgs(p.CommandLine) : null;
      if (found) return found;
      p = byId.get(p.ParentProcessId);
    }
  } catch {
    // Fall through to the clear error below.
  }
  return null;
}

export function args(): Record<string, string> {
  try {
    return parseArgs(process.argv.slice(2), process.env);
  } catch (e) {
    // PowerShell ate the "--": take the options from npm's own command line, in the order they were typed.
    const recovered = npmParentArgs();
    if (recovered?.length) {
      const out = parseArgs(recovered, {});
      console.log(`(read options from the npm command line: ${recovered.join(' ')})`);
      return out;
    }
    throw e;
  }
}

export function eventArg(a: Record<string, string>): string {
  const eventId = a.event ?? 'dev';
  if (!isEventId(eventId)) throw new Error(`Unknown event "${eventId}" (see src/config/events.ts)`);
  if (eventId === 'main' && a.force !== 'true') throw new Error('Refusing to write to "main" without --force');
  return eventId;
}

const FIRST = ['Kasun', 'Nimali', 'Ashan', 'Dilini', 'Ruwan', 'Tharushi', 'Sanjay', 'Fathima', 'Pradeep', 'Ishara', 'Mohamed', 'Anushka', 'Chamara', 'Priya', 'Lahiru', 'Nadeesha', 'Kavinda', 'Sachini', 'Arjun', 'Hiruni'];
const LAST = ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wickramasinghe', 'Bandara', 'Rajapaksa', 'Dias', 'Kumar', 'Mendis', 'Rathnayake', 'Herath'];

/** Real department names (the phone's dropdown list). */
export function fakeDepartment(i: number): string {
  return DEPARTMENTS[(i * 7) % DEPARTMENTS.length];
}

export function fakeName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`;
}

const HUES = [0, 18, 200, 220, 260, 140, 32, 330, 180, 48];

/** Fake selfie: gradient + face-ish circle + initials, sized like the phone pipeline. */
export async function fakePhoto(i: number, name: string) {
  const hue = HUES[i % HUES.length];
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,42%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},60%,18%)"/>
    </linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <circle cx="400" cy="330" r="170" fill="hsl(${(hue + 20) % 360},35%,72%)"/>
    <rect x="170" y="520" width="460" height="320" rx="200" fill="hsl(${(hue + 20) % 360},30%,62%)"/>
    <text x="400" y="380" font-family="Arial, sans-serif" font-weight="800" font-size="150" text-anchor="middle" fill="rgba(0,0,0,0.55)">${initials}</text>
  </svg>`;
  const base = sharp(Buffer.from(svg));
  const spot = await base.clone().jpeg({ quality: 82 }).toBuffer();
  const tile = await sharp(spot).resize(128, 128).jpeg({ quality: 80 }).toBuffer();
  const lqipBuf = await sharp(spot).resize(16, 16).jpeg({ quality: 50 }).toBuffer();
  return { spot, tile, lqip: `data:image/jpeg;base64,${lqipBuf.toString('base64')}` };
}

const META = { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' };

export async function uploadPair(fb: Fb, eventId: string, id: string, photo: { spot: Buffer; tile: Buffer }) {
  const [spotUrl, tileUrl] = await Promise.all(
    (
      [
        [paths.spotImage(eventId, id), photo.spot],
        [paths.tileImage(eventId, id), photo.tile],
      ] as const
    ).map(async ([p, buf]) => {
      const r = ref(fb.storage, p);
      await uploadBytes(r, new Uint8Array(buf), META);
      return getDownloadURL(r);
    }),
  );
  return { spotUrl, tileUrl };
}

export function createAttendee(
  fb: Fb,
  eventId: string,
  a: { id: string; name: string; department: string; spotUrl: string; tileUrl: string; lqip: string },
) {
  return setDoc(doc(fb.db, paths.attendee(eventId, a.id)), { ...a, hidden: false, createdAt: serverTimestamp() });
}

/** Valid random answers, skewed so the cloud has clear winners. */
export function randomAnswers(): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  for (const q of QUESTIONS) {
    const n = 1 + Math.floor(Math.random() * q.maxSelect);
    const picked = new Set<string>();
    while (picked.size < n) {
      // Earlier options are more popular (≈ Zipf).
      const r = Math.random() ** 1.8;
      picked.add(q.options[Math.floor(r * q.options.length)].id);
    }
    answers[q.id] = [...picked];
  }
  return answers;
}

export function createResponse(fb: Fb, eventId: string, id: string) {
  return setDoc(doc(fb.db, paths.response(eventId, id)), { id, answers: randomAnswers(), createdAt: serverTimestamp() });
}

export const newId = () => randomUUID();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

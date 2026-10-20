// Simulate phones registering (unique photos, 2 uploads + attendee doc + response doc each).
//   npm run load-test -- --event dev --mode burst
// Modes: steady (6/min for 5 min), burst (50 in 30 s), full (700 over 20 min).
// Custom: --count 100 --over 60   (seconds)
import { args, createAttendee, createResponse, eventArg, fakeDepartment, fakeName, fakePhoto, firebase, newId, percentile, sleep, uploadPair } from './lib';

const MODES: Record<string, { count: number; over: number }> = {
  steady: { count: 30, over: 300 },
  burst: { count: 50, over: 30 },
  full: { count: 700, over: 1200 },
};

async function main() {
  const a = args();
  const eventId = eventArg(a);
  const mode = MODES[a.mode ?? 'burst'] ?? MODES.burst;
  const count = Number(a.count ?? mode.count);
  const over = Number(a.over ?? mode.over);
  const fb = firebase();
  const gap = (over * 1000) / count;

  console.log(`Load test "${eventId}": ${count} registrations over ${over}s (one every ${Math.round(gap)} ms)`);
  // Pre-render photos so CPU time on this machine doesn't count as phone network time.
  const photos = await Promise.all(Array.from({ length: Math.min(count, 40) }, (_, i) => fakePhoto(i, fakeName(i))));

  const times: number[] = [];
  const errors: string[] = [];
  const start = Date.now();
  const jobs: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const due = start + i * gap;
    const wait = due - Date.now();
    if (wait > 0) await sleep(wait);
    jobs.push(
      (async () => {
        const id = newId();
        const photo = photos[i % photos.length];
        const t0 = performance.now();
        try {
          const urls = await uploadPair(fb, eventId, id, photo);
          await createAttendee(fb, eventId, {
            id,
            name: fakeName(i),
            department: fakeDepartment(i),
            ...urls,
            lqip: photo.lqip,
          });
          times.push(performance.now() - t0);
          await createResponse(fb, eventId, id);
        } catch (e) {
          errors.push((e as Error).message);
        }
        const n = times.length + errors.length;
        if (n % 10 === 0 || n === count) console.log(`  ${n} / ${count}  (errors ${errors.length})`);
      })(),
    );
  }
  await Promise.all(jobs);

  times.sort((x, y) => x - y);
  const fmt = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  console.log('\nRegistration time (upload spot+tile → attendee doc):');
  console.log(`  ok     ${times.length}`);
  console.log(`  errors ${errors.length}`);
  console.log(`  p50    ${fmt(percentile(times, 50))}`);
  console.log(`  p95    ${fmt(percentile(times, 95))}`);
  console.log(`  max    ${fmt(times.at(-1) ?? 0)}`);
  if (errors.length) console.log('  first error:', errors[0]);
  const pass = errors.length === 0 && percentile(times, 95) < 3000;
  console.log(pass ? '\nPASS (0 errors, p95 < 3s)' : '\nFAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

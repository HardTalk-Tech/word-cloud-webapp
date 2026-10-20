// Seed fake attendees (+ responses) for screen testing.
//   npm run seed -- --event dev --count 1000 [--responses 0.8] [--unique 30] [--delay 0]
// --unique: how many distinct photos to upload (reused across attendees, keeps seeding fast)
// --delay:  ms between attendees, e.g. 2000 to watch them arrive one by one on Screen 1
import { args, createAttendee, createResponse, eventArg, fakeDepartment, fakeName, fakePhoto, firebase, newId, pool, sleep, uploadPair } from './lib';

async function main() {
  const a = args();
  const eventId = eventArg(a);
  const count = Number(a.count ?? 100);
  const share = Number(a.responses ?? 0.8);
  const unique = Math.max(1, Math.min(count, Number(a.unique ?? 30)));
  const delay = Number(a.delay ?? 0);
  const fb = firebase();

  console.log(`Seeding ${count} attendees into "${eventId}" (${unique} unique photos, ${Math.round(share * 100)}% answer)…`);
  const photos: { spotUrl: string; tileUrl: string; lqip: string }[] = [];
  await pool(
    Array.from({ length: unique }, (_, i) => i),
    6,
    async (i) => {
      const photo = await fakePhoto(i, fakeName(i));
      const urls = await uploadPair(fb, eventId, `seed-photo-${i}`, photo);
      photos[i] = { ...urls, lqip: photo.lqip };
    },
  );
  console.log(`Uploaded ${unique} photos.`);

  let done = 0;
  const run = async (i: number) => {
    const id = newId();
    const p = photos[i % unique];
    await createAttendee(fb, eventId, { id, name: fakeName(i), department: fakeDepartment(i), ...p });
    if (Math.random() < share) await createResponse(fb, eventId, id);
    done++;
    if (done % 50 === 0 || done === count) console.log(`  ${done} / ${count}`);
  };

  const indices = Array.from({ length: count }, (_, i) => i);
  if (delay > 0) {
    for (const i of indices) {
      await run(i);
      await sleep(delay);
    }
  } else {
    await pool(indices, 16, run);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

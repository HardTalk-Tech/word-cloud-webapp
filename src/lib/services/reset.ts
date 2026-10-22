// Dashboard: wipe one event (docs + images) and bump the epoch so phones and screens clear.
import {
  collection,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { deleteObject, listAll, ref, type StorageReference } from 'firebase/storage';
import { db } from '@/lib/firebase/db';
import { storage } from '@/lib/firebase/storage';
import { paths } from '@/lib/paths';
import { DEFAULT_CONTROL, type ControlState } from '@/types/models';

export type ResetProgress = {
  step: 'epoch' | 'docs' | 'images' | 'done';
  done: number;
  total: number;
  label: string;
};

const BATCH_SIZE = 400;
const DELETE_CONCURRENCY = 20;

async function deleteDocs(refs: DocumentReference[], onDeleted: (n: number) => void): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db());
    const chunk = refs.slice(i, i + BATCH_SIZE);
    chunk.forEach((r) => batch.delete(r));
    await batch.commit();
    onDeleted(chunk.length);
  }
}

async function listFolder(path: string): Promise<StorageReference[]> {
  const res = await listAll(ref(storage(), path));
  return res.items;
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export async function resetEvent(eventId: string, onProgress: (p: ResetProgress) => void): Promise<void> {
  onProgress({ step: 'epoch', done: 0, total: 1, label: 'Clearing screens…' });
  // Screen settings back to defaults, except the colour theme (it is the event's identity, not data).
  const defaults: Partial<ControlState> = { ...DEFAULT_CONTROL };
  delete defaults.theme;
  await setDoc(
    doc(db(), paths.control(eventId)),
    { ...defaults, epoch: increment(1), updatedAt: serverTimestamp() },
    { merge: true },
  );

  const [attendeeSnap, responseSnap] = await Promise.all([
    getDocs(collection(db(), paths.attendees(eventId))),
    getDocs(collection(db(), paths.responses(eventId))),
  ]);
  const docTotal = attendeeSnap.size + responseSnap.size;
  let docsDone = 0;
  const onDocs = (n: number) => {
    docsDone += n;
    onProgress({ step: 'docs', done: docsDone, total: docTotal, label: `Deleting records ${docsDone} / ${docTotal}` });
  };
  onDocs(0);
  await deleteDocs(
    [...attendeeSnap.docs, ...responseSnap.docs].map((d) => d.ref),
    onDocs,
  );

  const images = (await Promise.all([listFolder(paths.spotFolder(eventId)), listFolder(paths.tileFolder(eventId))])).flat();
  let imagesDone = 0;
  const reportImages = () =>
    onProgress({
      step: 'images',
      done: imagesDone,
      total: images.length,
      label: `Deleting images ${imagesDone} / ${images.length}`,
    });
  reportImages();
  await runPool(images, DELETE_CONCURRENCY, async (r) => {
    try {
      await deleteObject(r);
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: unknown }).code : undefined;
      if (code !== 'storage/object-not-found') throw e;
    }
    imagesDone++;
    reportImages();
  });

  onProgress({ step: 'done', done: 1, total: 1, label: 'Reset complete' });
}

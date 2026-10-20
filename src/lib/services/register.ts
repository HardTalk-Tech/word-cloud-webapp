// Phone only. Loaded with a dynamic import when the attendee taps "Join".
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { dbLite } from '@/lib/firebase/db-lite';
import { IMAGE_METADATA, storage } from '@/lib/firebase/storage';
import { paths } from '@/lib/paths';
import { validateRegistration } from '@/lib/validation';
import type { ProcessedImages } from '@/lib/image/resize';
import { PHONE } from '@/config/timings';
import { DEFAULT_CONTROL } from '@/types/models';

export { processImage } from '@/lib/image/resize';

/** Current reset epoch for the event (defaults when the control doc doesn't exist yet). */
export async function fetchEpoch(eventId: string): Promise<number> {
  const snap = await getDoc(doc(dbLite(), paths.control(eventId)));
  const epoch = snap.exists() ? snap.data().epoch : undefined;
  return typeof epoch === 'number' ? epoch : DEFAULT_CONTROL.epoch;
}

export async function isRegistered(eventId: string, id: string): Promise<boolean> {
  const snap = await getDoc(doc(dbLite(), paths.attendee(eventId, id)));
  return snap.exists();
}

type RegisterInput = {
  eventId: string;
  id: string;
  name: string;
  department: string;
  images: ProcessedImages;
  /** 0..1 combined upload progress. */
  onProgress?: (fraction: number) => void;
  /** Called before each retry, with the 1-based retry number. */
  onRetry?: (attempt: number) => void;
};

function errorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt({ eventId, id, name, department, images, onProgress }: RegisterInput): Promise<void> {
  if (await isRegistered(eventId, id)) {
    onProgress?.(1);
    return;
  }

  const st = storage();
  const total = images.spot.size + images.tile.size;
  const sent = { spot: 0, tile: 0 };
  const report = () => onProgress?.(Math.min(1, (sent.spot + sent.tile) / total));

  const upload = (kind: 'spot' | 'tile', path: string, blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(ref(st, path), blob, IMAGE_METADATA);
      task.on(
        'state_changed',
        (s) => {
          sent[kind] = s.bytesTransferred;
          report();
        },
        reject,
        () => {
          getDownloadURL(task.snapshot.ref).then(resolve, reject);
        },
      );
    });

  const [spotUrl, tileUrl] = await Promise.all([
    upload('spot', paths.spotImage(eventId, id), images.spot),
    upload('tile', paths.tileImage(eventId, id), images.tile),
  ]);

  try {
    await setDoc(doc(dbLite(), paths.attendee(eventId, id)), {
      id,
      name,
      department,
      spotUrl,
      tileUrl,
      lqip: images.lqip,
      hidden: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // A second create on the same id is an update → denied. An earlier retry already made it.
    if (errorCode(e) === 'permission-denied' && (await isRegistered(eventId, id))) return;
    throw e;
  }
}

export async function registerAttendee(input: RegisterInput): Promise<void> {
  const v = validateRegistration({ name: input.name, department: input.department });
  if (!v.ok) throw new Error(v.errors.name ?? v.errors.department);
  const data = { ...input, ...v.data };

  let lastError: unknown;
  for (let i = 0; i <= PHONE.uploadRetries; i++) {
    if (i > 0) {
      input.onRetry?.(i);
      await sleep(PHONE.retryBaseMs * 2 ** (i - 1));
    }
    try {
      await attempt(data);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

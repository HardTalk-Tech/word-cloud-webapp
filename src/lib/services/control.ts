// Dashboard writes: screen control + hide/restore.
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/db';
import { paths } from '@/lib/paths';
import { DEFAULT_CONTROL, type ControlState } from '@/types/models';

export async function ensureControlDoc(eventId: string): Promise<void> {
  const ref = doc(db(), paths.control(eventId));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...DEFAULT_CONTROL, updatedAt: serverTimestamp() });
  }
}

export type ControlPatch = Partial<Omit<ControlState, 'epoch' | 'updatedAt'>>;

export function updateControl(eventId: string, patch: ControlPatch): Promise<void> {
  return setDoc(doc(db(), paths.control(eventId)), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export function setAttendeeHidden(eventId: string, id: string, hidden: boolean): Promise<void> {
  return updateDoc(doc(db(), paths.attendee(eventId, id)), { hidden });
}

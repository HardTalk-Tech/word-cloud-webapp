// Realtime listeners for the screens and the dashboard (full Firestore SDK).
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  type DocumentChange,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/db';
import { paths } from '@/lib/paths';
import { DEFAULT_CONTROL, type Attendee, type ControlState, type ResponseDoc } from '@/types/models';

function toAttendee(id: string, d: DocumentData): Attendee {
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    department: typeof d.department === 'string' ? d.department : '',
    spotUrl: typeof d.spotUrl === 'string' ? d.spotUrl : '',
    tileUrl: typeof d.tileUrl === 'string' ? d.tileUrl : '',
    lqip: typeof d.lqip === 'string' ? d.lqip : '',
    hidden: d.hidden === true,
    createdAt: (d.createdAt as Timestamp | null | undefined) ?? null,
  };
}

function toResponse(id: string, d: DocumentData): ResponseDoc {
  const answers: Record<string, string[]> = {};
  if (d.answers && typeof d.answers === 'object') {
    for (const [k, v] of Object.entries(d.answers as Record<string, unknown>)) {
      if (Array.isArray(v)) answers[k] = v.filter((x): x is string => typeof x === 'string');
    }
  }
  return { id, answers, createdAt: (d.createdAt as Timestamp | null | undefined) ?? null };
}

export function toControl(d: DocumentData | undefined): ControlState {
  if (!d) return DEFAULT_CONTROL;
  return {
    mode: d.mode === 'final' ? 'final' : 'live',
    welcomePaused: d.welcomePaused === true,
    spotlightQuestion: typeof d.spotlightQuestion === 'string' ? d.spotlightQuestion : null,
    autoRotateQuestions: d.autoRotateQuestions === true,
    epoch: typeof d.epoch === 'number' ? d.epoch : DEFAULT_CONTROL.epoch,
    updatedAt: (d.updatedAt as Timestamp | null | undefined) ?? null,
  };
}

export type AttendeesSnapshot = {
  attendees: Attendee[];
  changes: { type: DocumentChange['type']; attendee: Attendee }[];
  fromCache: boolean;
};

/** Ordered by createdAt; `hidden` is filtered on the client (no composite index needed). */
export function listenAttendees(
  eventId: string,
  cb: (snap: AttendeesSnapshot) => void,
  onError?: (e: Error) => void,
  /** Also fire when only metadata changes (e.g. cache → server), so screens know when data is fresh. */
  includeMetadataChanges = false,
): () => void {
  const q = query(collection(db(), paths.attendees(eventId)), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    { includeMetadataChanges },
    (snap) => {
      // Pending server timestamps stay null so half-written docs are obvious.
      const attendees = snap.docs.map((d) => toAttendee(d.id, d.data()));
      const changes = snap.docChanges().map((c) => ({ type: c.type, attendee: toAttendee(c.doc.id, c.doc.data()) }));
      cb({ attendees, changes, fromCache: snap.metadata.fromCache });
    },
    (e) => onError?.(e),
  );
}

export function listenResponses(
  eventId: string,
  cb: (responses: ResponseDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    collection(db(), paths.responses(eventId)),
    (snap) => cb(snap.docs.map((d) => toResponse(d.id, d.data()))),
    (e) => onError?.(e),
  );
}

export function listenControl(
  eventId: string,
  cb: (state: ControlState, exists: boolean) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), paths.control(eventId)),
    (snap) => cb(toControl(snap.data()), snap.exists()),
    (e) => onError?.(e),
  );
}

export function timestampMs(t: Timestamp | null): number | null {
  return t ? t.toMillis() : null;
}

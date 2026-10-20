import type { Timestamp } from 'firebase/firestore';

export type Attendee = {
  id: string;
  name: string;
  department: string;
  spotUrl: string;
  tileUrl: string;
  lqip: string;
  hidden: boolean;
  /** null while the server timestamp is pending. */
  createdAt: Timestamp | null;
};

export type ResponseDoc = {
  id: string;
  answers: Record<string, string[]>;
  createdAt: Timestamp | null;
};

export type ControlState = {
  mode: 'live' | 'final';
  welcomePaused: boolean;
  spotlightQuestion: string | null;
  autoRotateQuestions: boolean;
  epoch: number;
  updatedAt?: Timestamp | null;
};

export const DEFAULT_CONTROL: ControlState = {
  mode: 'live',
  welcomePaused: false,
  spotlightQuestion: null,
  autoRotateQuestions: false,
  epoch: 1,
};

/** Plain-millisecond attendee used by the pure screen logic (no Firestore types). */
export type WallAttendee = {
  id: string;
  name: string;
  department: string;
  spotUrl: string;
  tileUrl: string;
  lqip: string;
  hidden: boolean;
  createdAtMs: number;
};

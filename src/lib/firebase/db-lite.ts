import { getFirestore, type Firestore } from 'firebase/firestore/lite';
import { firebaseApp } from './app';

/** Phone only: small REST-based Firestore, no realtime listeners. */
export function dbLite(): Firestore {
  return getFirestore(firebaseApp());
}

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseApp } from './app';

let instance: Firestore | null = null;

/** Screens + dashboard: full Firestore with an IndexedDB cache so reloads are instant. */
export function db(): Firestore {
  if (instance) return instance;
  const app = firebaseApp();
  try {
    instance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (hot reload) or IndexedDB unavailable.
    instance = getFirestore(app);
  }
  return instance;
}

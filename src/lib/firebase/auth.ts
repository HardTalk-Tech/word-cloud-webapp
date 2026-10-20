import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseApp } from './app';
import { isOperatorEmail, usernameToEmail } from '@/lib/auth/username';

function auth(): Auth {
  return getAuth(firebaseApp());
}

export async function operatorSignIn(username: string, password: string): Promise<User> {
  const a = auth();
  await setPersistence(a, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(a, usernameToEmail(username), password);
  if (!isOperatorEmail(cred.user.email)) {
    await signOut(a);
    throw new Error('not-operator');
  }
  return cred.user;
}

export function operatorSignOut(): Promise<void> {
  return signOut(auth());
}

export function watchOperator(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), (user) => cb(user && isOperatorEmail(user.email) ? user : null));
}

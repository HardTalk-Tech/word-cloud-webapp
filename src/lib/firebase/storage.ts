import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseApp } from './app';

export function storage(): FirebaseStorage {
  return getStorage(firebaseApp());
}

export const IMAGE_METADATA = {
  contentType: 'image/jpeg',
  cacheControl: 'public, max-age=31536000, immutable',
} as const;

'use client';

import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/**
 * Read a browser-only value (URL, localStorage, window size…) without a hydration mismatch:
 * `server` during SSR / hydration, then `get()` on the client. `get` must return a primitive
 * (or a stable reference). Pass `subscribe` to re-read on events.
 */
export function useClientValue<T>(get: () => T, server: T, subscribe: (cb: () => void) => () => void = noSubscribe): T {
  return useSyncExternalStore(subscribe, get, () => server);
}

export function subscribeResize(cb: () => void): () => void {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

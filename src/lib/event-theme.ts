// Which screen theme (and so which event name) an event uses. No Firebase SDK here: the phone landing page
// reads it with one plain REST call, and every page remembers the last value locally for an instant first paint.
import { DEFAULT_THEME, isThemeId, type ThemeId } from '@/config/themes';
import { paths } from '@/lib/paths';

const key = (eventId: string) => `ew:theme:${eventId}`;

export function readCachedTheme(eventId: string): ThemeId | null {
  try {
    const v = localStorage.getItem(key(eventId));
    return isThemeId(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(eventId: string, id: ThemeId): void {
  try {
    localStorage.setItem(key(eventId), id);
  } catch {
    // ignore (private mode)
  }
}

/** The event's theme from its control doc (public read), via the Firestore REST API. */
export async function fetchTheme(eventId: string): Promise<ThemeId> {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const url =
    `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/` +
    `${paths.control(eventId)}?key=${apiKey}&mask.fieldPaths=theme`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return DEFAULT_THEME; // no control doc yet → default
  if (!res.ok) throw new Error(`Theme lookup failed (${res.status})`);
  const json = (await res.json()) as { fields?: { theme?: { stringValue?: string } } };
  const v = json.fields?.theme?.stringValue;
  return isThemeId(v) ? v : DEFAULT_THEME;
}

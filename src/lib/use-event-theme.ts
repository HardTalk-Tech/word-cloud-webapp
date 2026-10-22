'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, themeOf, type ScreenTheme, type ThemeId } from '@/config/themes';
import { fetchTheme, readCachedTheme, writeCachedTheme } from './event-theme';
import { useClientValue } from './use-client-value';

/**
 * Event theme for pages without a live Firestore listener (phone, login): cached value first, then one REST
 * read. `ready` is false until the theme is known, so the event title can stay hidden instead of flashing
 * the wrong name.
 */
export function useEventTheme(eventId: string): { theme: ScreenTheme; ready: boolean } {
  const cached = useClientValue(() => readCachedTheme(eventId), null);
  const [fetched, setFetched] = useState<ThemeId | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchTheme(eventId)
      .then((id) => {
        if (!alive) return;
        writeCachedTheme(eventId, id);
        setFetched(id);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [eventId]);

  const id = fetched ?? cached ?? (failed ? DEFAULT_THEME : null);
  return { theme: themeOf(id), ready: id !== null };
}

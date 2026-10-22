'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEMES, isThemeId, type ScreenTheme, type ThemeId } from '@/config/themes';
import { readCachedTheme, writeCachedTheme } from '@/lib/event-theme';
import { listenControl } from '@/lib/services/listen';
import { useClientValue } from '@/lib/use-client-value';

/** If the theme can't be read at all (offline, first run), fall back to the default after this long. */
const FALLBACK_MS = 3000;

/**
 * Live screen theme for an LED screen: follows the operator's choice in the control doc. Starts from the last
 * theme this screen showed (localStorage), so a reload paints the right colours immediately.
 * null = not known yet (render nothing rather than flash the wrong theme).
 */
export function useScreenTheme(eventId: string): ScreenTheme | null {
  // `?theme=midnight` previews a theme on this screen only (the live setting is untouched).
  const preview = useClientValue(() => new URLSearchParams(window.location.search).get('theme'), null);
  const cached = useClientValue(() => readCachedTheme(eventId), null);
  const [live, setLive] = useState<ThemeId | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), FALLBACK_MS);
    const unsub = listenControl(eventId, (c) => {
      writeCachedTheme(eventId, c.theme);
      setLive(c.theme);
    });
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [eventId]);

  if (isThemeId(preview)) return THEMES[preview];
  const id = live ?? cached ?? (timedOut ? DEFAULT_THEME : null);
  return id ? THEMES[id] : null;
}

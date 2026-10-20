// Font families for canvas drawing, read from the CSS variables next/font sets on <html>.
import { FONT_FALLBACK, FONT_VARS } from '@/config/brand';

export type FontFamilies = { display: string; serif: string };

export function fontFamilies(): FontFamilies {
  const style = getComputedStyle(document.documentElement);
  const display = style.getPropertyValue(FONT_VARS.display).trim() || 'Montserrat, Arial Black, sans-serif';
  const serif = style.getPropertyValue(FONT_VARS.serif).trim() || 'Georgia, serif';
  return { display: `${display}, ${FONT_FALLBACK}`, serif: `${serif}, Georgia, serif` };
}

/** Wait for the web fonts so canvas measurements are right on the first frame. */
export async function ensureFonts(f: FontFamilies): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 48px ${f.display}`),
      document.fonts.load(`700 48px ${f.display}`),
      document.fonts.load(`600 48px ${f.serif}`),
      document.fonts.load(`700 48px ${f.serif}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Draw with fallbacks rather than block the screen.
  }
}

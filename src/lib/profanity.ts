import { PROFANITY_SUBSTRINGS, PROFANITY_WORDS } from '@/config/profanity-words';

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
};

function deLeet(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c);
}

export function containsProfanity(input: string): boolean {
  const lower = deLeet(input);
  const squashed = lower.replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1');
  if (PROFANITY_SUBSTRINGS.some((w) => squashed.includes(w))) return true;
  const words = lower.split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => PROFANITY_WORDS.includes(w));
}

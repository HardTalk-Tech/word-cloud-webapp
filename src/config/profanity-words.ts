// Basic English + Sinhala-transliterated list. Matched against a normalised name
// (lowercase, leetspeak undone). Substrings are blocked anywhere in the name, so keep
// them to words that never occur inside real names (e.g. no "nazi" → Nazir, "rape" → Draper).
export const PROFANITY_SUBSTRINGS = [
  'fuck',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'wanker',
  'bastard',
  'dickhead',
  'shithead',
  'bullshit',
  'asshole',
  'arsehole',
  'motherf',
  'pussy',
  'penis',
  'vagina',
  'porn',
  'hitler',
];

// Short words only blocked as a whole word, to avoid false positives on real names.
export const PROFANITY_WORDS = [
  'shit',
  'ass',
  'arse',
  'cock',
  'dick',
  'fag',
  'tit',
  'tits',
  'sex',
  'xxx',
  'cum',
  'rape',
  'nazi',
  'puta',
  'hutta',
  'pakaya',
  'ponnaya',
];

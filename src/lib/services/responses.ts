// Phone only. Loaded with a dynamic import on questionnaire submit.
import { doc, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import { dbLite } from '@/lib/firebase/db-lite';
import { paths } from '@/lib/paths';
import { validateAnswers, type Answers } from '@/lib/validation';
import { QUESTIONS } from '@/config/questions';
import { PHONE } from '@/config/timings';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function submitResponses(eventId: string, id: string, answers: Answers): Promise<void> {
  const error = validateAnswers(answers, QUESTIONS);
  if (error) throw new Error(error);

  let lastError: unknown;
  for (let i = 0; i <= PHONE.uploadRetries; i++) {
    if (i > 0) await sleep(PHONE.retryBaseMs * 2 ** (i - 1));
    try {
      await setDoc(doc(dbLite(), paths.response(eventId, id)), {
        id,
        answers,
        createdAt: serverTimestamp(),
      });
      return;
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: unknown }).code : undefined;
      // Already answered from this device (create-once rule) → success.
      if (code === 'permission-denied') return;
      lastError = e;
    }
  }
  throw lastError;
}

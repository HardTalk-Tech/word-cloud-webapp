// responses → counts (pure). Shared by Screen 2 and the dashboard results panel.
import type { Question } from '@/config/questions';

export type QuestionCounts = {
  questionId: string;
  respondents: number;
  counts: Map<string, number>;
};

export type Aggregate = {
  respondents: number;
  /** key = `${questionId}:${optionId}` */
  byOption: Map<string, number>;
  byQuestion: Map<string, QuestionCounts>;
};

export const optionKey = (questionId: string, optionId: string) => `${questionId}:${optionId}`;

export function aggregate(responses: { answers: Record<string, string[]> }[], questions: Question[]): Aggregate {
  const byOption = new Map<string, number>();
  const byQuestion = new Map<string, QuestionCounts>();
  const valid = new Map<string, Set<string>>();
  for (const q of questions) {
    valid.set(q.id, new Set(q.options.map((o) => o.id)));
    const counts = new Map<string, number>();
    for (const o of q.options) {
      counts.set(o.id, 0);
      byOption.set(optionKey(q.id, o.id), 0);
    }
    byQuestion.set(q.id, { questionId: q.id, respondents: 0, counts });
  }

  let respondents = 0;
  for (const r of responses) {
    let answeredAny = false;
    for (const q of questions) {
      const picked = r.answers[q.id];
      if (!picked?.length) continue;
      const ids = valid.get(q.id)!;
      const qc = byQuestion.get(q.id)!;
      let counted = false;
      for (const opt of new Set(picked)) {
        if (!ids.has(opt)) continue;
        qc.counts.set(opt, (qc.counts.get(opt) ?? 0) + 1);
        const k = optionKey(q.id, opt);
        byOption.set(k, (byOption.get(k) ?? 0) + 1);
        counted = true;
      }
      if (counted) {
        qc.respondents++;
        answeredAny = true;
      }
    }
    if (answeredAny) respondents++;
  }
  return { respondents, byOption, byQuestion };
}

/** Stable string of counts, bucketed so small changes don't reshuffle the cloud. */
export function bucketedCountsKey(byOption: Map<string, number>): string {
  const bucket = (n: number) => (n === 0 ? 0 : Math.floor(Math.log2(n)) + 1);
  return [...byOption.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, n]) => `${k}=${bucket(n)}`)
    .join('|');
}

export function countsKey(byOption: Map<string, number>): string {
  return [...byOption.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, n]) => `${k}=${n}`)
    .join('|');
}

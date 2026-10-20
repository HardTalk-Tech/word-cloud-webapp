import type { Question } from '@/config/questions';

export function QuestionCard({
  question,
  number,
  total,
  selected,
  missing,
  limitHint,
  onToggle,
}: {
  question: Question;
  number: number;
  total: number;
  selected: string[];
  /** Highlight: submit was tapped without answering this one. */
  missing: boolean;
  /** Shown when the user tries to pick more than maxSelect. */
  limitHint: boolean;
  onToggle: (optionId: string) => void;
}) {
  const full = selected.length >= question.maxSelect;
  return (
    <section
      id={`question-${question.id}`}
      className={`scroll-mt-6 rounded-3xl bg-surface p-5 ring-1 transition ${missing ? 'ring-2 ring-red-500' : 'ring-line'}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
            selected.length ? 'bg-brand text-white' : 'bg-surface-raised text-brand-grey-light'
          }`}
        >
          {selected.length ? '✓' : number}
        </span>
        <span className="text-xs font-semibold tracking-wide text-brand-grey uppercase">
          Question {number} of {total}
        </span>
      </div>
      <h2 className="mt-3 text-[1.3rem] leading-snug font-extrabold">{question.text}</h2>
      <p className={`mt-1 text-sm ${missing || limitHint ? 'text-red-400' : 'text-brand-grey-light'}`}>
        {missing
          ? 'Please answer this question.'
          : limitHint
            ? `You can pick up to ${question.maxSelect}. Tap one to remove it.`
            : question.maxSelect === 1
              ? 'Pick one'
              : `Pick up to ${question.maxSelect}`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {question.options.map((o) => {
          const on = selected.includes(o.id);
          const disabled = !on && full && question.maxSelect > 1;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.id)}
              className={`min-h-12 rounded-full px-5 text-base font-bold transition active:scale-95 ${
                on
                  ? 'bg-brand text-white shadow-[0_8px_24px_-10px_rgba(172,31,45,0.9)]'
                  : disabled
                    ? 'bg-surface text-brand-grey ring-1 ring-line'
                    : 'bg-surface-raised text-white ring-1 ring-line'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

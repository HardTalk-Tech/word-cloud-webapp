import { useState } from 'react';
import { QUESTIONS } from '@/config/questions';
import type { Answers } from '@/lib/validation';
import { QuestionCard } from './QuestionCard';
import { BrandMark, Button, Spinner, Title } from './ui';

/** All questions on one scrolling page; one Submit at the bottom. */
export function Questionnaire({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (answers: Answers) => void;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const [showMissing, setShowMissing] = useState(false);
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const answered = QUESTIONS.filter((q) => answers[q.id]?.length).length;

  const toggle = (questionId: string, optionId: string) => {
    const q = QUESTIONS.find((x) => x.id === questionId)!;
    const selected = answers[q.id] ?? [];
    setLimitHint(null);
    if (selected.includes(optionId)) {
      setAnswers({ ...answers, [q.id]: selected.filter((x) => x !== optionId) });
    } else if (q.maxSelect === 1) {
      setAnswers({ ...answers, [q.id]: [optionId] });
    } else if (selected.length >= q.maxSelect) {
      setLimitHint(q.id);
    } else {
      setAnswers({ ...answers, [q.id]: [...selected, optionId] });
    }
  };

  const submit = () => {
    const firstMissing = QUESTIONS.find((q) => !answers[q.id]?.length);
    if (firstMissing) {
      setShowMissing(true);
      document.getElementById(`question-${firstMissing.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onSubmit(answers);
  };

  return (
    <div className="flex min-h-dvh flex-col pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="px-5">
        <BrandMark size="sm" />
        <Title sub="Pick the answers that fit you best. Your answers appear on the second screen.">
          A few quick questions
        </Title>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-4 px-4 pb-6">
        {QUESTIONS.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            number={i + 1}
            total={QUESTIONS.length}
            selected={answers[q.id] ?? []}
            missing={showMissing && !answers[q.id]?.length}
            limitHint={limitHint === q.id}
            onToggle={(optionId) => toggle(q.id, optionId)}
          />
        ))}
      </div>

      {/* Sticky footer: progress + submit, always under the thumb. */}
      <div className="sticky bottom-0 border-t border-line bg-ink/95 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-brand-grey-light">
            <b className="text-white">{answered}</b> of {QUESTIONS.length} answered
          </span>
          <div className="flex gap-1.5">
            {QUESTIONS.map((q) => (
              <span key={q.id} className={`h-2 w-6 rounded-full ${answers[q.id]?.length ? 'bg-brand' : 'bg-line'}`} />
            ))}
          </div>
        </div>
        {error && <p className="mb-2 text-center text-sm text-red-400">{error}</p>}
        <Button onClick={submit} disabled={busy}>
          {busy && <Spinner />}
          Submit answers
        </Button>
      </div>
    </div>
  );
}

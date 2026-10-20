import { BRAND } from '@/config/brand';
import { Button, StepShell, Title } from './ui';

export function Submitting({
  progress,
  retrying,
  error,
  onRetry,
  onEdit,
}: {
  progress: number;
  retrying: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: () => void;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.round(progress * 100);
  return (
    <StepShell
      footer={
        error ? (
          <>
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="ghost" onClick={onEdit}>
              Edit details
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {error ? (
          <Title sub={error}>Couldn&apos;t send your photo</Title>
        ) : (
          <>
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={r} stroke="#2c2c33" strokeWidth="10" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  stroke={BRAND.red}
                  strokeWidth="10"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - progress)}
                  style={{ transition: 'stroke-dashoffset 200ms ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold">{pct}%</div>
            </div>
            <Title sub={retrying ? 'Weak signal — retrying…' : 'Hang tight, this takes a second.'}>
              Joining the wall…
            </Title>
          </>
        )}
      </div>
    </StepShell>
  );
}

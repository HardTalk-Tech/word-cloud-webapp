import { COPY } from '@/config/brand';
import { BrandMark, Button, Spinner, StepShell } from './ui';

export function Landing({
  returning,
  busy,
  onJoin,
}: {
  returning: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <StepShell
      footer={
        <Button onClick={onJoin} disabled={busy}>
          {busy && <Spinner />}
          {returning ? COPY.continueButton : COPY.joinButton}
        </Button>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <BrandMark size="lg" />
        <div>
          <h1 className="text-[2.6rem] leading-[1.05] font-extrabold">{COPY.landingHeadline}</h1>
          <p className="mx-auto mt-4 max-w-xs text-lg text-brand-grey-light">{COPY.landingSub}</p>
        </div>
      </div>
    </StepShell>
  );
}

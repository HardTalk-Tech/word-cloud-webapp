import { COPY, EVENT } from '@/config/brand';
import { BrandMark, Button, Spinner, StepShell } from './ui';

/** Event title in metallic gold ("Achievers Night 2026"). */
function EventTitle() {
  return <h1 className="text-gold text-[2.5rem] leading-[1.1] font-extrabold">{EVENT.title}</h1>;
}

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
          <p className="font-serif text-xl tracking-[0.2em] text-brand-grey-light uppercase">{COPY.landingEyebrow}</p>
          <div className="mt-2">
            <EventTitle />
          </div>
          <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-brand" aria-hidden />
          <p className="mx-auto mt-5 max-w-xs text-lg text-brand-grey-light">{COPY.landingSub}</p>
        </div>
      </div>
    </StepShell>
  );
}

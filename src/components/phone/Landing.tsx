import { COPY } from '@/config/brand';
import type { ThemeEvent } from '@/config/themes';
import { EventTitle } from '@/components/EventTitle';
import { BrandMark, Button, Spinner, StepShell } from './ui';

export function Landing({
  returning,
  busy,
  onJoin,
  event,
  eventReady,
}: {
  returning: boolean;
  busy: boolean;
  onJoin: () => void;
  /** Event name for the operator's chosen theme (gold Achievers Night / silver Arrowil Awards). */
  event: ThemeEvent;
  eventReady: boolean;
}) {
  // Long names (e.g. ARROWIL AWARDS CEREMONY 2026) get a slightly smaller headline so they wrap nicely.
  const size = event.title.length > 22 ? 'text-[2.05rem]' : 'text-[2.5rem]';
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
          <h1 className={`mt-2 ${size} leading-[1.1] font-extrabold`}>
            <EventTitle event={event} ready={eventReady} />
          </h1>
          <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-brand" aria-hidden />
          <p className="mx-auto mt-5 max-w-xs text-lg text-brand-grey-light">{COPY.landingSub}</p>
        </div>
      </div>
    </StepShell>
  );
}

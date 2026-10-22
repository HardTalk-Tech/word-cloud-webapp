import { motion } from 'motion/react';
import { COPY } from '@/config/brand';
import type { ThemeEvent } from '@/config/themes';
import { EventTitle } from '@/components/EventTitle';
import { BrandMark, StepShell, Title } from './ui';

export function Thanks({ event, eventReady }: { event: ThemeEvent; eventReady: boolean }) {
  return (
    <StepShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        >
          <BrandMark size="lg" />
        </motion.div>
        <Title sub={COPY.thanksSub}>{COPY.thanksTitle}</Title>
        <p className="px-4 text-center font-serif text-xl tracking-[0.12em] text-brand-grey-light">
          Enjoy <EventTitle event={event} ready={eventReady} className="font-bold" />
        </p>
      </div>
    </StepShell>
  );
}

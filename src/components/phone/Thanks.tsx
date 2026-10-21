import { motion } from 'motion/react';
import { COPY, EVENT } from '@/config/brand';
import { BrandMark, StepShell, Title } from './ui';

export function Thanks() {
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
        <p className="font-serif text-xl tracking-[0.12em] text-brand-grey-light">
          Enjoy <span className="text-gold font-bold">{EVENT.title}</span>
        </p>
      </div>
    </StepShell>
  );
}

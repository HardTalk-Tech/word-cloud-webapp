import { useEffect } from 'react';
import { motion } from 'motion/react';
import { COPY } from '@/config/brand';
import { PHONE } from '@/config/timings';
import { Button, StepShell, Title } from './ui';

export function Success({ name, onContinue }: { name: string; onContinue: () => void }) {
  useEffect(() => {
    const t = setTimeout(onContinue, PHONE.successAutoContinueMs);
    return () => clearTimeout(t);
  }, [onContinue]);

  return (
    <StepShell footer={<Button onClick={onContinue}>Next</Button>}>
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="flex h-36 w-36 items-center justify-center rounded-full bg-brand"
        >
          <svg viewBox="0 0 52 52" className="h-20 w-20" fill="none">
            <motion.path
              d="M14 27 l8 8 l16 -18"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.2, duration: 0.45, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
        <Title sub={`You're on the wall, ${name}.`}>{COPY.successTitle}</Title>
      </div>
    </StepShell>
  );
}

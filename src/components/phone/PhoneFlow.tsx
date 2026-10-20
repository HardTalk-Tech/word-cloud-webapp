'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { loadDeviceState, reconcileEpoch, updateDeviceState } from '@/lib/device-id';
import type { Answers, Registration } from '@/lib/validation';
import { useClientValue } from '@/lib/use-client-value';
import { Landing } from './Landing';
import { RegisterStep } from './RegisterStep';
import { Submitting } from './Submitting';
import { Success } from './Success';
import { Questionnaire } from './Questionnaire';
import { Thanks } from './Thanks';

// Firebase code stays out of the landing bundle.
type RegisterModule = typeof import('@/lib/services/register');
const loadRegister = () => import('@/lib/services/register');
const loadResponses = () => import('@/lib/services/responses');

type Step = 'landing' | 'register' | 'submitting' | 'success' | 'questionnaire' | 'thanks';

function friendlyError(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You seem to be offline. Check your connection.';
  const msg = e instanceof Error ? e.message : '';
  if (msg && !/firebase|storage\/|firestore/i.test(msg) && msg.length < 120) return msg;
  return 'Something went wrong. Please try again.';
}

export function PhoneFlow({ eventId }: { eventId: string }) {
  const [step, setStep] = useState<Step>('landing');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [details, setDetails] = useState<Registration>({ name: '', department: '' });
  const [progress, setProgress] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registerRef = useRef<Promise<RegisterModule> | null>(null);
  const submitRun = useRef(0);

  // Returning visitor: label the landing button "Continue" (localStorage only, no Firebase).
  const returning = useClientValue(() => loadDeviceState(eventId).registered, false);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const register = () => (registerRef.current ??= loadRegister());

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    window.scrollTo(0, 0);
  };

  const join = async () => {
    const stored = loadDeviceState(eventId);
    const check = register()
      .then((m) => m.fetchEpoch(eventId))
      .then((epoch) => reconcileEpoch(eventId, epoch))
      .catch(() => loadDeviceState(eventId)); // offline: trust local state
    if (!stored.registered) {
      // New attendee: don't wait on the network, the epoch check finishes in the background.
      go('register');
      void check;
      return;
    }
    setBusy(true);
    const s = await check;
    setBusy(false);
    go(s.answered ? 'thanks' : s.registered ? 'questionnaire' : 'register');
  };

  const onPhoto = (f: File) => {
    setFile(f);
    setImageUrl(URL.createObjectURL(f));
  };

  const submit = async (data: Registration) => {
    if (!file) return;
    const run = ++submitRun.current;
    setDetails(data);
    setProgress(0);
    setRetrying(false);
    setError(null);
    setStep('submitting');
    window.scrollTo(0, 0);
    try {
      const m = await register();
      const images = await m.processImage(file);
      if (run !== submitRun.current) return;
      setProgress(0.08);
      const { deviceId } = loadDeviceState(eventId);
      await m.registerAttendee({
        eventId,
        id: deviceId,
        ...data,
        images,
        onProgress: (f) => run === submitRun.current && setProgress(0.08 + f * 0.92),
        onRetry: () => run === submitRun.current && setRetrying(true),
      });
      if (run !== submitRun.current) return;
      updateDeviceState(eventId, { registered: true, name: data.name });
      setProgress(1);
      setStep('success');
    } catch (e) {
      if (run === submitRun.current) setError(friendlyError(e));
    }
  };

  const toQuestions = useCallback(() => {
    setError(null);
    setStep('questionnaire');
    window.scrollTo(0, 0);
  }, []);

  const submitAnswers = async (answers: Answers) => {
    setBusy(true);
    setError(null);
    try {
      const { submitResponses } = await loadResponses();
      await submitResponses(eventId, loadDeviceState(eventId).deviceId, answers);
      updateDeviceState(eventId, { answered: true });
      go('thanks');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  let content: React.ReactNode;
  switch (step) {
    case 'landing':
      content = <Landing returning={returning} busy={busy} onJoin={join} />;
      break;
    case 'register':
      content = <RegisterStep initial={details} imageUrl={imageUrl} onPhoto={onPhoto} onSubmit={submit} />;
      break;
    case 'submitting':
      content = (
        <Submitting
          progress={progress}
          retrying={retrying}
          error={error}
          onRetry={() => void submit(details)}
          onEdit={() => go('register')}
        />
      );
      break;
    case 'success':
      content = <Success name={details.name} onContinue={toQuestions} />;
      break;
    case 'questionnaire':
      content = <Questionnaire busy={busy} error={error} onSubmit={submitAnswers} />;
      break;
    case 'thanks':
      content = <Thanks />;
      break;
  }

  return (
    // overflow-x-clip (not hidden): hidden would make <main> a scroll container and break the sticky submit bar.
    <main className="phone-root mx-auto min-h-dvh w-full max-w-md overflow-x-clip">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

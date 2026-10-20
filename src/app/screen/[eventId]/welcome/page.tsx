import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT_IDS, isEventId } from '@/config/events';
import { MainScreen } from '@/components/main/MainScreen';

export const metadata: Metadata = { title: 'Screen 1 — Welcome wall' };

type Params = PageProps<'/screen/[eventId]/welcome'>['params'];

export function generateStaticParams() {
  return EVENT_IDS.map((eventId) => ({ eventId }));
}

export default function Page({ params }: PageProps<'/screen/[eventId]/welcome'>) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: { params: Params }) {
  const { eventId } = await params;
  if (!isEventId(eventId)) notFound();
  return <MainScreen eventId={eventId} />;
}

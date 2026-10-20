import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT_IDS, isEventId } from '@/config/events';
import { CloudScreen } from '@/components/cloud/CloudScreen';

export const metadata: Metadata = { title: 'Screen 2 — Word cloud' };

type Params = PageProps<'/screen/[eventId]/cloud'>['params'];

export function generateStaticParams() {
  return EVENT_IDS.map((eventId) => ({ eventId }));
}

export default function Page({ params }: PageProps<'/screen/[eventId]/cloud'>) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <Screen params={params} />
    </Suspense>
  );
}

async function Screen({ params }: { params: Params }) {
  const { eventId } = await params;
  if (!isEventId(eventId)) notFound();
  return <CloudScreen eventId={eventId} />;
}

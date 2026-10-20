import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT_IDS, isEventId } from '@/config/events';
import { ControlPage } from '@/components/control/ControlPage';

export const metadata: Metadata = { title: 'Operator dashboard' };

type Params = PageProps<'/control/[eventId]'>['params'];

export function generateStaticParams() {
  return EVENT_IDS.map((eventId) => ({ eventId }));
}

export default function Page({ params }: PageProps<'/control/[eventId]'>) {
  return (
    <Suspense fallback={null}>
      <Control params={params} />
    </Suspense>
  );
}

async function Control({ params }: { params: Params }) {
  const { eventId } = await params;
  if (!isEventId(eventId)) notFound();
  return <ControlPage eventId={eventId} />;
}

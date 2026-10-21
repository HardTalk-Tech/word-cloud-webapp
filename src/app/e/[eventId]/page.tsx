import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT } from '@/config/brand';
import { EVENT_IDS, isEventId } from '@/config/events';
import { PhoneFlow } from '@/components/phone/PhoneFlow';

export const metadata: Metadata = { title: EVENT.fullName };

type Params = PageProps<'/e/[eventId]'>['params'];

export function generateStaticParams() {
  return EVENT_IDS.map((eventId) => ({ eventId }));
}

export default function Page({ params }: PageProps<'/e/[eventId]'>) {
  return (
    <Suspense fallback={null}>
      <Phone params={params} />
    </Suspense>
  );
}

async function Phone({ params }: { params: Params }) {
  const { eventId } = await params;
  if (!isEventId(eventId)) notFound();
  return <PhoneFlow eventId={eventId} />;
}

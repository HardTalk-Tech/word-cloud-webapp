'use client';

import { AuthGate } from './AuthGate';
import { Dashboard } from './Dashboard';

export function ControlPage({ eventId }: { eventId: string }) {
  return <AuthGate>{(user) => <Dashboard key={eventId} eventId={eventId} user={user} />}</AuthGate>;
}

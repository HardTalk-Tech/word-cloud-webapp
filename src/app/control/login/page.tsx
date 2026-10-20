import type { Metadata } from 'next';
import { LoginForm } from '@/components/control/LoginForm';

export const metadata: Metadata = { title: 'Operator sign in' };

export default function Page() {
  return <LoginForm />;
}

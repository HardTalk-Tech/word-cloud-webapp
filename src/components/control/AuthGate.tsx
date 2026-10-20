'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { watchOperator } from '@/lib/firebase/auth';

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return watchOperator((u) => {
      setUser(u);
      if (!u) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/control/login?next=${encodeURIComponent(next)}`);
      }
    });
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-brand-grey-light">
        {user === undefined ? 'Checking sign-in…' : 'Redirecting to sign in…'}
      </div>
    );
  }
  return <>{children(user)}</>;
}

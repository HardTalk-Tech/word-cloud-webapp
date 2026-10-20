'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/config/brand';
import { DEFAULT_EVENT } from '@/config/events';
import { operatorSignIn } from '@/lib/firebase/auth';

function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/control/') && !next.startsWith('//') ? next : `/control/${DEFAULT_EVENT}`;
}

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await operatorSignIn(username, password);
      router.replace(safeNext());
    } catch {
      setError('Invalid username or password');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-surface p-8 ring-1 ring-line">
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logo} alt={BRAND.name} className="h-20 w-auto" />
          <h1 className="mt-4 text-xl font-extrabold">Operator sign in</h1>
        </div>
        <label className="mt-8 block text-sm font-semibold text-brand-grey-light">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            required
            className="mt-2 h-12 w-full rounded-xl bg-surface-raised px-4 text-base text-white ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-brand-grey-light">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-2 h-12 w-full rounded-xl bg-surface-raised px-4 text-base text-white ring-1 ring-line outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <button
          disabled={busy}
          className="mt-6 h-12 w-full rounded-xl bg-brand font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

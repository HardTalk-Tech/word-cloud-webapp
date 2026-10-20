import { BRAND } from '@/config/brand';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.crown} alt="" className="h-14 w-auto" />
      <h1 className="text-2xl font-extrabold">Page not found</h1>
      <p className="text-brand-grey-light">Please scan the QR code again.</p>
    </main>
  );
}

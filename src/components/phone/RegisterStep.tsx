import { useRef, useState } from 'react';
import { BRAND, COPY } from '@/config/brand';
import { PORTRAIT_TOP_BIAS } from '@/lib/image/resize';
import { DEPARTMENT_MAX, NAME_MAX, validateRegistration, type Registration } from '@/lib/validation';
import { BrandMark, Button, StepShell, Title } from './ui';

type Errors = Partial<Record<keyof Registration | 'photo', string>>;

function isImage(f: File) {
  return f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name);
}

/** One page: name → department → selfie → submit. The photo is cropped automatically. */
export function RegisterStep({
  initial,
  imageUrl,
  onPhoto,
  onSubmit,
}: {
  initial: Registration;
  imageUrl: string | null;
  onPhoto: (file: File) => void;
  onSubmit: (data: Registration) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [department, setDepartment] = useState(initial.department);
  const [errors, setErrors] = useState<Errors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!isImage(f)) {
      setErrors((x) => ({ ...x, photo: 'Please choose a photo.' }));
      return;
    }
    setErrors((x) => ({ ...x, photo: undefined }));
    onPhoto(f);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = validateRegistration({ name, department });
    const next: Errors = r.ok ? {} : { ...r.errors };
    if (!imageUrl) next.photo = 'Please add your selfie.';
    setErrors(next);
    if (r.ok && imageUrl) onSubmit(r.data);
  };

  const input =
    'h-14 w-full rounded-2xl bg-surface-raised px-5 text-lg font-semibold text-white ring-1 ring-line outline-none placeholder:text-brand-grey focus:ring-2 focus:ring-brand';

  return (
    <form onSubmit={submit} noValidate className="contents">
      <StepShell
        footer={
          <>
            <p className="text-center text-sm text-brand-grey">{COPY.consent}</p>
            <Button type="submit">Submit</Button>
          </>
        }
      >
        <BrandMark size="sm" />
        <Title sub="Tell us who you are and add a selfie.">Join the event</Title>

        <div className="mt-8 flex flex-col gap-5">
          <label className="block">
            <span className="text-sm font-semibold text-brand-grey-light">Name</span>
            <input
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((x) => ({ ...x, name: undefined }));
              }}
              placeholder="Your name"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              className={`mt-2 ${input}`}
            />
            <span className="mt-1 flex justify-between text-sm">
              <span className="text-red-400">{errors.name}</span>
              <span className="text-brand-grey">
                {name.length}/{NAME_MAX}
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-brand-grey-light">Department</span>
            <input
              value={department}
              maxLength={DEPARTMENT_MAX}
              onChange={(e) => {
                setDepartment(e.target.value);
                setErrors((x) => ({ ...x, department: undefined }));
              }}
              placeholder="e.g. Finance"
              autoComplete="organization-title"
              autoCapitalize="words"
              enterKeyHint="done"
              className={`mt-2 ${input}`}
            />
            {errors.department && <span className="mt-1 block text-sm text-red-400">{errors.department}</span>}
          </label>

          <div>
            <span className="text-sm font-semibold text-brand-grey-light">Selfie</span>
            {imageUrl ? (
              <div className="mt-3 flex items-center gap-5">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ring-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Your selfie"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `50% ${PORTRAIT_TOP_BIAS * 100}%` }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-brand-grey-light">This is how you&apos;ll appear on screen.</span>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="h-12 self-start rounded-xl px-4 text-base font-bold text-white ring-1 ring-line active:scale-95"
                  >
                    Change photo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-surface py-8 transition active:scale-[0.98] ${
                  errors.photo ? 'border-red-500' : 'border-line'
                }`}
              >
                <CameraIcon />
                <span className="text-lg font-bold">Add your selfie</span>
                <span className="text-sm text-brand-grey-light">Take a photo or choose from your gallery</span>
              </button>
            )}
            {errors.photo && <span className="mt-1 block text-sm text-red-400">{errors.photo}</span>}
            {/* No `capture`: the phone offers both camera and gallery. */}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>
        </div>
      </StepShell>
    </form>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BRAND.red} strokeWidth="2" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

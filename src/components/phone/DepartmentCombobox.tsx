'use client';

import { useId, useRef, useState } from 'react';
import { DEPARTMENTS, DEPARTMENT_SUGGESTIONS } from '@/config/departments';
import { highlightParts, searchDepartments } from '@/lib/departments';

/**
 * Searchable department field (select2-style). The list never shows in full: suggestions appear as the
 * user types (best matches first, capped). Picking one fills the field; anything else typed is kept as is.
 */
export function DepartmentCombobox({
  value,
  onChange,
  maxLength,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  invalid: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { results, total } = searchDepartments(value, DEPARTMENTS, DEPARTMENT_SUGGESTIONS);
  const typed = value.trim();
  const exact = results.some((r) => r.toLowerCase() === typed.toLowerCase());

  const choose = (label: string) => {
    onChange(label);
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted suggestion; otherwise it just keeps what was typed (no form submit).
      e.preventDefault();
      if (open && active >= 0 && results[active]) choose(results[active]);
      else {
        setOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && typed.length > 0;
  const activeId = active >= 0 ? `${id}-opt-${active}` : undefined;

  return (
    <div ref={wrapRef} className="relative scroll-mt-4">
      <div className="relative mt-2">
        <SearchIcon />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={invalid || undefined}
          value={value}
          maxLength={maxLength}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => {
            setOpen(true);
            // Lift the field to the top so the suggestions stay visible above the phone keyboard.
            setTimeout(() => wrapRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search your department"
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className="h-14 w-full rounded-2xl bg-surface-raised pr-12 pl-12 text-lg font-semibold text-white ring-1 ring-line outline-none placeholder:text-brand-grey focus:ring-2 focus:ring-brand"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear department"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-1 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-brand-grey-light active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {open && !typed && (
        <p className="mt-1 text-sm text-brand-grey">Start typing, e.g. &quot;Braun&quot; or &quot;Accounts&quot;.</p>
      )}

      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-surface-raised shadow-[0_18px_40px_-12px_rgba(0,0,0,0.85)] ring-1 ring-line">
          <ul id={listId} role="listbox" className="max-h-[min(19rem,42dvh)] overflow-y-auto overscroll-contain py-1">
            {results.map((label, i) => (
              <li
                key={label}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the input so the tap selects instead of closing the list first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(label)}
                onMouseEnter={() => setActive(i)}
                className={`flex min-h-12 cursor-pointer items-center px-4 py-2 text-base leading-snug ${
                  i === active ? 'bg-brand/25 text-white' : 'text-brand-grey-light'
                }`}
              >
                <span>
                  {highlightParts(label, value).map((p, k) =>
                    p.match ? (
                      <b key={k} className="font-extrabold text-white">
                        {p.text}
                      </b>
                    ) : (
                      <span key={k}>{p.text}</span>
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
          {total > results.length && (
            <p className="border-t border-line px-4 py-2 text-xs text-brand-grey">
              {total - results.length} more — keep typing to narrow down
            </p>
          )}
          {/* Free text is always accepted; say so once it looks like a real entry, not after one letter. */}
          {!exact && (results.length === 0 || typed.length >= 4) && (
            <p className="border-t border-line px-4 py-3 text-sm text-brand-grey-light">
              {results.length ? 'Not listed? ' : 'No match in the list. '}
              We&apos;ll use <b className="text-white">&ldquo;{typed}&rdquo;</b>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-brand-grey"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

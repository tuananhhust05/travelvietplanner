'use client';

import { useId } from 'react';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  maxHeight?: number;
}

/** Point at which the counter starts warning that room is running out. */
const WARN_RATIO = 0.9;

export function TextareaField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  error,
  optional,
  maxHeight,
}: TextareaFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;

  // Counting UTF-16 code units matches what maxLength enforces and what the server's
  // z.string().max() measures. Vietnamese diacritics can be composed of two code
  // units, so a "characters" count from Intl.Segmenter would read lower than the
  // limit actually being applied and let the user hit a wall the counter denied.
  const used = value.length;
  const ratio = used / maxLength;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {optional && <span className="ml-1.5 font-normal text-text-muted">(tuỳ chọn)</span>}
        </label>
        <span
          id={countId}
          aria-live="off"
          className={cn(
            'shrink-0 text-xs tabular-nums transition-colors',
            used >= maxLength ? 'font-medium text-danger'
              : ratio >= WARN_RATIO ? 'text-warning'
              : 'text-text-muted',
          )}
        >
          {used}/{maxLength}
        </span>
      </div>

      {hint && <p id={hintId} className="text-xs text-text-muted">{hint}</p>}

      <Textarea
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        maxHeight={maxHeight}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        // Joined by hand rather than with cn(): useId() emits colons, which twMerge
        // reads as Tailwind modifiers and may collapse two ids into one.
        aria-describedby={[hint && hintId, countId, error && errorId].filter(Boolean).join(' ')}
        className={cn(error && 'border-danger focus-visible:ring-danger')}
      />

      {error && <p id={errorId} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

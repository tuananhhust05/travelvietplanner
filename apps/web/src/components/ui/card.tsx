import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, glass, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-border shadow-e2',
        glass
          ? 'backdrop-blur-xl bg-surface-1/60 border-white/10'
          : 'bg-surface-1',
        className,
      )}
      {...props}
    />
  );
});

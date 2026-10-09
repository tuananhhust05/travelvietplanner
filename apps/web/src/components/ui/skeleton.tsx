import { cn } from '@/lib/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton animate-shimmer rounded-lg', className)}
      aria-hidden
      {...props}
    />
  );
}

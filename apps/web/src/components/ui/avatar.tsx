import { cn } from '@/lib/cn';

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

const ringByType: Record<AccountType, string> = {
  traveler: 'ring-primary',
  agency: 'ring-info',
  business: 'ring-accent',
  guide: 'ring-secondary',
};

export interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  accountType?: AccountType;
  className?: string;
}

export function Avatar({ name, src, size = 40, accountType, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-text font-semibold',
        accountType && `ring-2 ring-offset-2 ring-offset-bg ${ringByType[accountType]}`,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

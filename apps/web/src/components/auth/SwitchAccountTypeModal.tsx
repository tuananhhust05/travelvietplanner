'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Compass, Building2, Store, Check, X, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

interface Option {
  value: AccountType;
  icon: LucideIcon;
  label: string;
  desc: string;
}

const OPTIONS: Option[] = [
  {
    value: 'traveler',
    icon: User,
    label: 'Traveler',
    desc: 'Khám phá và lập kế hoạch du lịch',
  },
  {
    value: 'guide',
    icon: Compass,
    label: 'Hướng dẫn viên',
    desc: 'Cung cấp dịch vụ tour & hướng dẫn',
  },
  {
    value: 'agency',
    icon: Building2,
    label: 'Công ty lữ hành',
    desc: 'Quản lý tour và dịch vụ du lịch',
  },
  {
    value: 'business',
    icon: Store,
    label: 'Doanh nghiệp',
    desc: 'Quảng bá điểm đến & dịch vụ',
  },
];

const TYPE_LABELS: Record<AccountType, string> = {
  traveler: 'Traveler',
  guide: 'Hướng dẫn viên',
  agency: 'Công ty lữ hành',
  business: 'Doanh nghiệp',
};

export interface SwitchAccountTypeModalProps {
  open: boolean;
  onClose: () => void;
  currentType: AccountType;
  onSwitch: (type: AccountType) => Promise<void>;
}

export function SwitchAccountTypeModal({
  open,
  onClose,
  currentType,
  onSwitch,
}: SwitchAccountTypeModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSwitch = async () => {
    if (!selected || selected === currentType) return;
    setLoading(true);
    try {
      await onSwitch(selected);
      onClose();
      router.push('/onboarding?switched=1');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelected(null);
    onClose();
  };

  const confirmDisabled = !selected || selected === currentType;
  const confirmLabel = selected ? `Chuyển sang ${TYPE_LABELS[selected]}` : 'Chuyển loại tài khoản';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-md bg-surface-1 rounded-2xl p-6 shadow-e3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              disabled={loading}
              className={cn(
                'absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg',
                'text-text-muted hover:bg-surface-2 hover:text-text',
                'transition-colors duration-base ease-standard',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-60',
              )}
              aria-label="Đóng"
            >
              <X size={18} aria-hidden />
            </button>

            {/* Header */}
            <div className="mb-5 pr-8">
              <h2 className="text-lg font-semibold text-text">Chuyển loại tài khoản</h2>
              <p className="mt-1 text-sm text-text-muted">
                Dữ liệu hồ sơ của bạn sẽ được giữ nguyên khi chuyển loại tài khoản.
              </p>
            </div>

            {/* Account type grid */}
            <div
              role="radiogroup"
              aria-label="Loại tài khoản"
              className="grid grid-cols-2 gap-3 mb-6"
            >
              {OPTIONS.map(({ value, icon: Icon, label, desc }) => {
                const isCurrent = value === currentType;
                const isSelected = value === selected;

                return (
                  <motion.button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isCurrent || isSelected}
                    disabled={isCurrent || loading}
                    onClick={() => {
                      if (!isCurrent) setSelected(value);
                    }}
                    whileTap={isCurrent ? undefined : { scale: 0.97 }}
                    className={cn(
                      'relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left',
                      'transition-colors duration-base ease-standard',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isCurrent
                        ? 'border-transparent bg-surface-2 ring-2 ring-primary cursor-default opacity-75'
                        : isSelected
                          ? 'border-transparent bg-primary/10 ring-2 ring-primary cursor-pointer'
                          : 'border-border bg-surface-1 hover:bg-surface-2 cursor-pointer',
                    )}
                  >
                    {/* Icon row */}
                    <span className="flex w-full items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-text-muted">
                        <Icon size={16} aria-hidden />
                      </span>
                      {(isCurrent || isSelected) && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-fg"
                        >
                          <Check size={11} aria-hidden />
                        </motion.span>
                      )}
                    </span>

                    <span className="text-sm font-semibold text-text leading-tight">{label}</span>
                    <span className="text-xs text-text-muted leading-snug text-pretty">{desc}</span>

                    {/* "Hiện tại" badge */}
                    {isCurrent && (
                      <span className="absolute -top-2 left-2.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-fg">
                        Hiện tại
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={handleClose}
                disabled={loading}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleSwitch}
                disabled={confirmDisabled}
                loading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

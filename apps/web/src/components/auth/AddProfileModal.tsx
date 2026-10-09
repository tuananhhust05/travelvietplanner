'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Compass, Building2, Store, Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

export type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

interface Option {
  value: AccountType;
  icon: LucideIcon;
  label: string;
  desc: string;
}

const ALL_OPTIONS: Option[] = [
  { value: 'traveler', icon: User, label: 'Traveler', desc: 'Khám phá và lập kế hoạch du lịch' },
  { value: 'guide', icon: Compass, label: 'Hướng dẫn viên', desc: 'Cung cấp dịch vụ tour & hướng dẫn' },
  { value: 'agency', icon: Building2, label: 'Công ty lữ hành', desc: 'Quản lý tour và dịch vụ du lịch' },
  { value: 'business', icon: Store, label: 'Doanh nghiệp', desc: 'Quảng bá điểm đến & dịch vụ' },
];

export interface AddProfileModalProps {
  open: boolean;
  onClose: () => void;
  existingTypes: AccountType[];
  onAdd: (profileType: AccountType, displayName: string) => Promise<void>;
}

export function AddProfileModal({ open, onClose, existingTypes, onAdd }: AddProfileModalProps) {
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const available = ALL_OPTIONS.filter((o) => !existingTypes.includes(o.value));

  const handleClose = () => {
    if (loading) return;
    setSelected(null);
    setDisplayName('');
    setError(null);
    setDone(false);
    onClose();
  };

  const handleAdd = async () => {
    if (!selected || !displayName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAdd(selected, displayName.trim());
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể thêm hồ sơ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

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
            <button
              onClick={handleClose}
              disabled={loading}
              className={cn(
                'absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg',
                'text-text-muted hover:bg-surface-2 hover:text-text transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-60',
              )}
              aria-label="Đóng"
            >
              <X size={18} aria-hidden />
            </button>

            {done ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                  <Check size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-text">Đã thêm hồ sơ!</h2>
                <p className="mt-1 mb-4 text-sm text-text-muted">
                  Hồ sơ <strong>{displayName}</strong> đã được tạo. Bạn có thể chuyển sang hồ sơ này từ menu tài khoản.
                </p>
                <Button className="w-full" onClick={handleClose}>Đóng</Button>
              </div>
            ) : (
              <>
                <div className="mb-5 pr-8">
                  <h2 className="text-lg font-semibold text-text">Thêm hồ sơ mới</h2>
                  <p className="mt-1 text-sm text-text-muted">
                    Mỗi hồ sơ có dashboard và tính năng riêng biệt.
                  </p>
                </div>

                {available.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-muted">
                    Bạn đã có tất cả các loại hồ sơ.
                  </p>
                ) : (
                  <>
                    <div role="radiogroup" aria-label="Loại hồ sơ" className="grid grid-cols-2 gap-3 mb-4">
                      {available.map(({ value, icon: Icon, label, desc }) => {
                        const isSelected = value === selected;
                        return (
                          <motion.button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setSelected(value)}
                            whileTap={{ scale: 0.97 }}
                            className={cn(
                              'relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left',
                              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isSelected
                                ? 'border-transparent bg-primary/10 ring-2 ring-primary'
                                : 'border-border bg-surface-1 hover:bg-surface-2',
                            )}
                          >
                            <span className="flex w-full items-center justify-between">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-text-muted">
                                <Icon size={16} aria-hidden />
                              </span>
                              {isSelected && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-fg"
                                >
                                  <Check size={11} aria-hidden />
                                </motion.span>
                              )}
                            </span>
                            <span className="text-sm font-semibold text-text leading-tight">{label}</span>
                            <span className="text-xs text-text-muted leading-snug">{desc}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {selected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-4"
                      >
                        <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium text-text">
                          Tên hiển thị cho hồ sơ này
                        </label>
                        <input
                          id="profile-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ví dụ: ABC Travel Agency"
                          maxLength={80}
                          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </motion.div>
                    )}

                    {error && <p className="mb-3 text-sm text-danger">{error}</p>}

                    <div className="flex gap-2">
                      <Button variant="outline" size="md" className="flex-1" onClick={handleClose} disabled={loading}>
                        Hủy
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={handleAdd}
                        disabled={!selected || !displayName.trim() || loading}
                        loading={loading}
                      >
                        Thêm hồ sơ
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

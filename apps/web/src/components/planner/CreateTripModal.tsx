'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CalendarDays, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { ItineraryDay } from '@/components/planner/DayCard';

export interface CreateTripModalProps {
  open: boolean;
  onClose: () => void;
  destination?: string;
  dayCount: number;
  days: ItineraryDay[];
  onCreated: (tripId: string) => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateTripModal({
  open,
  onClose,
  destination,
  dayCount,
  days,
  onCreated,
}: CreateTripModalProps) {
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = destination
    ? `${destination} · ${dayCount} ngày`
    : `Chuyến đi · ${dayCount} ngày`;

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!startDate) return;
    setLoading(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('tvp_token')
        : null;

      const res = await fetch(`${api.base}/v1/trips`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          destination,
          startDate,
          days,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { id: string };
      onCreated(data.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể tạo chuyến đi. Vui lòng thử lại.');
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
            className="relative w-full max-w-sm bg-surface-1 rounded-2xl p-6 shadow-e3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-trip-title"
          >
            {/* Close button */}
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

            {/* Header */}
            <div className="mb-5 pr-8">
              <h2
                id="create-trip-title"
                className="text-lg font-semibold text-text"
              >
                Tạo chuyến đi
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Lưu hành trình này vào tài khoản của bạn.
              </p>
            </div>

            {/* Trip info */}
            <div className="mb-5 rounded-xl border border-border bg-surface-2 px-4 py-3 space-y-2">
              {destination && (
                <div className="flex items-center gap-2 text-sm text-text">
                  <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                  <span className="font-medium">{destination}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <CalendarDays size={14} className="shrink-0" aria-hidden />
                <span>{dayCount} ngày · {days.length} lịch trình</span>
              </div>
            </div>

            {/* Start date input */}
            <div className="mb-5">
              <label
                htmlFor="trip-start-date"
                className="mb-1.5 block text-sm font-medium text-text"
              >
                Ngày bắt đầu
              </label>
              <input
                id="trip-start-date"
                type="date"
                value={startDate}
                min={todayISO()}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
                className={cn(
                  'w-full rounded-xl border border-border bg-surface-2 px-3 py-2',
                  'text-sm text-text',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="mb-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}

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
                onClick={handleSubmit}
                disabled={!startDate || loading}
                loading={loading}
              >
                Tạo chuyến đi
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

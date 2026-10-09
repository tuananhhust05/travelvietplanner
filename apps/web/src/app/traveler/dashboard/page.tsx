'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Compass, MessageCircle, BookOpen, MapPin, AlertCircle, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Trip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  dayCount: number;
  createdAt: string;
}

function formatTripDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TravelerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const profile = user?.profiles.find((p) => p.type === 'traveler');

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsStatus, setTripsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const loadTrips = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
    if (!token) return;
    setTripsStatus('loading');
    try {
      const res = await fetch(`${api.base}/v1/trips`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Trip[];
      setTrips(data);
      setTripsStatus('ready');
    } catch {
      setTripsStatus('error');
    }
  }, []);

  useEffect(() => {
    if (tripsStatus === 'idle') void loadTrips();
  }, [tripsStatus, loadTrips]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome header */}
        <div>
          <h1 className="text-2xl font-bold text-text">
            Xin chào, {profile?.displayName ?? user?.displayName ?? 'bạn'} 👋
          </h1>
          <p className="mt-1 text-text-muted">Lên kế hoạch cho chuyến đi tiếp theo của bạn.</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: '/planner', icon: Sparkles, label: 'AI Planner', desc: 'Lên kế hoạch', color: 'bg-primary/10 text-primary' },
            { href: '/explore', icon: Compass, label: 'Khám phá', desc: 'Điểm đến mới', color: 'bg-secondary/10 text-secondary' },
            { href: '/feed', icon: BookOpen, label: 'Bảng tin', desc: 'Cộng đồng', color: 'bg-info/10 text-info' },
            { href: '/messages', icon: MessageCircle, label: 'Tin nhắn', desc: 'Liên hệ guide', color: 'bg-warning/10 text-warning' },
          ].map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-4 hover:bg-surface-2 transition-colors"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon size={20} />
              </span>
              <span className="font-semibold text-sm text-text">{label}</span>
              <span className="text-xs text-text-muted">{desc}</span>
            </Link>
          ))}
        </div>

        {/* Recent trips */}
        <div className="rounded-xl border border-border bg-surface-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-text">Chuyến đi gần đây</h2>
            <Link href="/planner" className="text-xs text-primary hover:underline">Lên kế hoạch mới →</Link>
          </div>

          {tripsStatus === 'loading' && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="mb-2 h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </Card>
              ))}
            </div>
          )}

          {tripsStatus === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertCircle className="text-danger" size={28} aria-hidden />
              <p className="text-sm text-text-muted">Không thể tải chuyến đi.</p>
              <Button variant="outline" onClick={() => { setTripsStatus('idle'); void loadTrips(); }}>
                Thử lại
              </Button>
            </div>
          )}

          {tripsStatus === 'ready' && trips.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-text-muted">
              <MapPin size={32} className="opacity-40" />
              <p className="text-sm">Chưa có chuyến đi nào. Hãy bắt đầu lên kế hoạch!</p>
              <Link
                href="/planner"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:brightness-110"
              >
                Bắt đầu với AI Planner
              </Link>
            </div>
          )}

          {tripsStatus === 'ready' && trips.map((trip) => (
            <Card
              key={trip.id}
              className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-2"
              onClick={() => router.push(`/trips/${trip.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{trip.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatTripDate(trip.startDate)} → {formatTripDate(trip.endDate)}
                  {trip.destination ? ` · ${trip.destination}` : ''}
                  {' · '}{trip.dayCount} ngày
                </p>
              </div>
              <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            </Card>
          ))}
        </div>

        {/* Suggested destinations placeholder */}
        <div className="rounded-xl border border-border bg-surface-1 p-6">
          <h2 className="mb-4 font-semibold text-text">Điểm đến gợi ý</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {['Hội An', 'Sa Pa', 'Đà Lạt'].map((dest) => (
              <div key={dest} className="flex h-20 items-center justify-center rounded-xl border border-border bg-surface-2 text-sm font-medium text-text-muted">
                {dest}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
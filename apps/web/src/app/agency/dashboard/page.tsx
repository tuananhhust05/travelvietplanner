'use client';

import Link from 'next/link';
import { LayoutList, MessageCircle, Star, TrendingUp, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';

export default function AgencyDashboard() {
  const { user } = useAuth();
  const profile = user?.profiles.find((p) => p.type === 'agency');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">
              {profile?.displayName ?? 'Agency Dashboard'}
            </h1>
            <p className="mt-1 text-text-muted">Quản lý tour và dịch vụ của bạn.</p>
          </div>
          <Link
            href="/listings/new"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:brightness-110"
          >
            <Plus size={16} />
            Thêm listing
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Listing đang hoạt động', value: '0', icon: LayoutList, color: 'text-primary' },
            { label: 'Đặt chỗ tháng này', value: '0', icon: TrendingUp, color: 'text-secondary' },
            { label: 'Tin nhắn mới', value: '0', icon: MessageCircle, color: 'text-info' },
            { label: 'Đánh giá trung bình', value: '—', icon: Star, color: 'text-warning' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-surface-1 p-4">
              <Icon size={18} className={`mb-2 ${color}`} />
              <p className="text-2xl font-bold text-text">{value}</p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: '/listings', icon: LayoutList, label: 'Quản lý listings', desc: 'Xem và chỉnh sửa các tour của bạn' },
            { href: '/messages', icon: MessageCircle, label: 'Tin nhắn', desc: 'Trả lời khách hàng' },
            { href: '/profile/me', icon: Star, label: 'Hồ sơ công ty', desc: 'Cập nhật thông tin agency' },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-4 hover:bg-surface-2 transition-colors"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-muted">
                <Icon size={20} />
              </span>
              <div>
                <p className="font-medium text-sm text-text">{label}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent activity placeholder */}
        <div className="rounded-xl border border-border bg-surface-1 p-6">
          <h2 className="mb-4 font-semibold text-text">Hoạt động gần đây</h2>
          <div className="py-6 text-center text-sm text-text-muted">
            Chưa có hoạt động nào. Hãy thêm listing đầu tiên của bạn!
          </div>
        </div>
      </div>
    </AppShell>
  );
}

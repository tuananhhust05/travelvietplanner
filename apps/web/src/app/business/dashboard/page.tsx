'use client';

import Link from 'next/link';
import { LayoutList, MessageCircle, TrendingUp, BarChart3, Plus, Star } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const profile = user?.profiles.find((p) => p.type === 'business');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">
              {profile?.displayName ?? 'Business Dashboard'}
            </h1>
            <p className="mt-1 text-text-muted">Quảng bá dịch vụ và theo dõi hiệu quả kinh doanh.</p>
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
            { label: 'Lượt xem tháng này', value: '0', icon: TrendingUp, color: 'text-secondary' },
            { label: 'Đánh giá', value: '—', icon: Star, color: 'text-warning' },
            { label: 'Tin nhắn mới', value: '0', icon: MessageCircle, color: 'text-info' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-surface-1 p-4">
              <Icon size={18} className={`mb-2 ${color}`} />
              <p className="text-2xl font-bold text-text">{value}</p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* Analytics placeholder */}
        <div className="rounded-xl border border-border bg-surface-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-text">Phân tích</h2>
            <BarChart3 size={18} className="text-text-muted" />
          </div>
          <div className="flex h-32 items-center justify-center text-sm text-text-muted">
            Dữ liệu phân tích sẽ hiển thị sau khi bạn có listing đầu tiên.
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: '/listings', icon: LayoutList, label: 'Quản lý listings', desc: 'Xem và chỉnh sửa listings' },
            { href: '/messages', icon: MessageCircle, label: 'Tin nhắn', desc: 'Trả lời khách hàng' },
            { href: '/profile/me', icon: Star, label: 'Hồ sơ doanh nghiệp', desc: 'Cập nhật thông tin' },
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
      </div>
    </AppShell>
  );
}

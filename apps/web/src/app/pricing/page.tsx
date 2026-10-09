import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Check, Zap, Crown, Building2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Bảng giá',
  description:
    'Gói Miễn phí, Pro và Doanh nghiệp cho travelvietplaner. Lịch trình AI không giới hạn, xuất PDF, đặt tour tích hợp — nâng cấp bất kỳ lúc nào.',
};

const tiers = [
  {
    icon: Zap,
    name: 'Miễn phí',
    price: '0đ',
    period: 'mãi mãi',
    description: 'Dành cho du khách muốn khám phá AI lập lịch và cộng đồng du lịch Việt Nam.',
    features: [
      '5 lịch trình AI mỗi tháng',
      'Feed cộng đồng đọc không giới hạn',
      'Khám phá bản đồ điểm đến',
      'Follow tối đa 10 người dùng',
      'Bình luận và tương tác bài viết',
      'Lưu tối đa 3 lịch trình yêu thích',
    ],
    cta: 'Bắt đầu miễn phí',
    href: '/register',
    highlighted: false,
  },
  {
    icon: Crown,
    name: 'Pro',
    price: '99k',
    period: 'tháng',
    description: 'Cho người đi du lịch thường xuyên muốn khai thác tối đa sức mạnh của AI.',
    features: [
      'Lịch trình AI không giới hạn',
      'Lưu không giới hạn lịch trình',
      'Xuất lịch trình sang PDF',
      'Chia sẻ lịch trình riêng tư theo link',
      'Follow không giới hạn người dùng',
      'Hồ sơ nổi bật trong cộng đồng',
      'Ưu tiên hỗ trợ khách hàng',
      'Truy cập sớm tính năng mới',
    ],
    cta: 'Dùng thử 14 ngày miễn phí',
    href: '/register?plan=pro',
    highlighted: true,
  },
  {
    icon: Building2,
    name: 'Doanh nghiệp',
    price: 'Liên hệ',
    period: '',
    description: 'Giải pháp toàn diện cho công ty lữ hành, khách sạn và nền tảng du lịch.',
    features: [
      'Tất cả tính năng Pro',
      'Dashboard analytics thời gian thực',
      'API access đầy đủ',
      'White-label tùy chỉnh thương hiệu',
      'Quản lý đội nhóm & phân quyền',
      'Tích hợp hệ thống quản lý tour',
      'SLA hỗ trợ 24/7 cam kết',
      'Tư vấn triển khai tận nơi',
    ],
    cta: 'Liên hệ tư vấn',
    href: '/contact',
    highlighted: false,
  },
];

const faqs = [
  {
    q: 'Tôi có thể hủy gói Pro bất kỳ lúc nào không?',
    a: 'Có. Bạn có thể hủy gói Pro bất kỳ lúc nào trong phần cài đặt tài khoản. Gói sẽ tiếp tục hoạt động đến hết chu kỳ thanh toán hiện tại và không bị trừ thêm phí. Sau khi hủy, tài khoản sẽ chuyển về gói Miễn phí.',
  },
  {
    q: '14 ngày dùng thử Pro có cần thẻ tín dụng không?',
    a: 'Không. Bạn có thể dùng thử đầy đủ tính năng Pro trong 14 ngày mà không cần nhập thông tin thẻ. Sau 14 ngày, nếu không đăng ký, tài khoản tự động về gói Miễn phí — không bị tính phí gì.',
  },
  {
    q: 'Phương thức thanh toán nào được hỗ trợ?',
    a: 'Hiện tại chúng tôi hỗ trợ thanh toán qua thẻ Visa/Mastercard, chuyển khoản ngân hàng nội địa, MoMo và ZaloPay. Với gói Doanh nghiệp, chúng tôi hỗ trợ thêm hóa đơn VAT và thanh toán theo quý/năm với chiết khấu.',
  },
  {
    q: 'Nâng cấp từ Miễn phí lên Pro mất bao lâu?',
    a: 'Nâng cấp có hiệu lực ngay lập tức sau khi thanh toán thành công. Toàn bộ lịch trình đã lưu và dữ liệu tài khoản được giữ nguyên. Bạn không cần tạo tài khoản mới hay nhập lại bất kỳ thông tin nào.',
  },
];

const comparisonRows = [
  { feature: 'Lịch trình AI mỗi tháng', free: '5 lịch trình', pro: 'Không giới hạn', enterprise: 'Không giới hạn' },
  { feature: 'Lưu lịch trình', free: '3 lịch trình', pro: 'Không giới hạn', enterprise: 'Không giới hạn' },
  { feature: 'Xuất PDF', free: '—', pro: 'Có', enterprise: 'Có' },
  { feature: 'Chia sẻ riêng tư', free: '—', pro: 'Có', enterprise: 'Có' },
  { feature: 'Follow người dùng', free: 'Tối đa 10', pro: 'Không giới hạn', enterprise: 'Không giới hạn' },
  { feature: 'Hồ sơ nổi bật', free: '—', pro: 'Có', enterprise: 'Có' },
  { feature: 'API access', free: '—', pro: '—', enterprise: 'Có' },
  { feature: 'Dashboard analytics', free: '—', pro: '—', enterprise: 'Có' },
  { feature: 'White-label', free: '—', pro: '—', enterprise: 'Có' },
  { feature: 'SLA hỗ trợ', free: 'Cộng đồng', pro: 'Ưu tiên', enterprise: '24/7 cam kết' },
];

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Bảng giá
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Đơn giản, minh bạch, không phí ẩn
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            Chọn gói phù hợp với nhu cầu của bạn. Nâng cấp hoặc hủy bất kỳ lúc nào — không bị ràng buộc.
          </p>
        </section>

        {/* Pricing cards */}
        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map(({ icon: Icon, name, price, period, description, features, cta, href, highlighted }) => (
              <div
                key={name}
                className={cn(
                  'flex flex-col rounded-2xl border bg-surface-1 p-8',
                  highlighted ? 'ring-2 ring-primary border-primary' : 'border-border',
                )}
              >
                {highlighted && (
                  <span className="mb-4 self-start rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
                    Phổ biến nhất
                  </span>
                )}
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon size={24} className="text-primary" />
                </div>
                <h3 className="text-xl font-bold text-text">{name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-text">{price}</span>
                  {period && <span className="text-sm text-text-muted">/ {period}</span>}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{description}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text">
                      <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={href}
                  className={cn(
                    'mt-8 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                    highlighted
                      ? 'bg-primary text-primary-fg hover:brightness-110'
                      : 'border border-border bg-surface-2 text-text hover:bg-surface-1',
                  )}
                >
                  {cta}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="mx-auto max-w-5xl px-4 pb-20 md:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-text">So sánh tất cả tính năng</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-5 py-4 text-left font-semibold text-text-muted">Tính năng</th>
                  <th className="px-5 py-4 text-center font-semibold text-text">Miễn phí</th>
                  <th className="px-5 py-4 text-center font-semibold text-primary">Pro</th>
                  <th className="px-5 py-4 text-center font-semibold text-text">Doanh nghiệp</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ feature, free, pro, enterprise }, i) => (
                  <tr
                    key={feature}
                    className={cn('border-b border-border', i % 2 === 0 ? 'bg-surface-1' : 'bg-bg')}
                  >
                    <td className="px-5 py-3.5 text-text-muted">{feature}</td>
                    <td className="px-5 py-3.5 text-center text-text">{free}</td>
                    <td className="px-5 py-3.5 text-center font-medium text-primary">{pro}</td>
                    <td className="px-5 py-3.5 text-center text-text">{enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 pb-24 md:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-text">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-surface-1 p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle size={18} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold text-text">{q}</p>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="border-t border-border bg-surface-2">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Bắt đầu hành trình của bạn ngay hôm nay</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Gói Miễn phí không cần thẻ tín dụng. Nâng lên Pro bất kỳ lúc nào.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="/register"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Tạo tài khoản miễn phí
              </a>
              <a
                href="/contact"
                className="rounded-xl border border-border bg-bg px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-1"
              >
                Tư vấn doanh nghiệp
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

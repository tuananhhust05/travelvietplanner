import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Users, BarChart2, Plug, Globe } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Dành cho công ty lữ hành',
  description:
    'Tiếp cận hàng nghìn du khách đang lên kế hoạch. Đăng tour, nhận đặt chỗ trực tuyến và xây dựng thương hiệu bền vững trên TravelVietPlaner.',
};

const benefits = [
  {
    icon: Users,
    title: 'Quản lý đội nhóm và khách hàng',
    description:
      'Phân quyền nhân viên theo vai trò, theo dõi tiến độ từng tour và quản lý hồ sơ khách hàng trong một nền tảng duy nhất. Tránh nhầm lẫn khi nhiều người cùng xử lý một booking.',
  },
  {
    icon: BarChart2,
    title: 'Dashboard analytics thời gian thực',
    description:
      'Xem báo cáo đặt tour, doanh thu, tỷ lệ hoàn thành và đánh giá khách hàng theo thời gian thực. Hiểu rõ tour nào đang bán tốt, khách đến từ kênh nào và mùa nào cần chuẩn bị thêm nhân lực.',
  },
  {
    icon: Plug,
    title: 'Tích hợp hệ thống sẵn có',
    description:
      'API đầy đủ cho phép kết nối TravelVietPlaner với phần mềm quản lý tour, hệ thống CRM hay kênh phân phối hiện có của bạn. Tài liệu API chi tiết và đội kỹ thuật hỗ trợ tích hợp tận nơi.',
  },
  {
    icon: Globe,
    title: 'Tiếp cận du khách đúng thời điểm',
    description:
      'Tour của bạn xuất hiện trong lịch trình AI được tạo cho hàng nghìn du khách mỗi ngày — đúng lúc họ đang quyết định mua. Không phải quảng cáo banner bị bỏ qua, mà là gợi ý hữu ích trong ngữ cảnh thực tế.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Đăng ký tài khoản doanh nghiệp',
    description:
      'Điền thông tin công ty, tải lên giấy phép kinh doanh và chứng chỉ lữ hành. Đội ngũ của chúng tôi xác minh trong 2 ngày làm việc. Sau khi được duyệt, bạn có quyền truy cập toàn bộ dashboard doanh nghiệp.',
  },
  {
    number: '02',
    title: 'Đăng tour và gói dịch vụ',
    description:
      'Thêm tour của bạn vào hệ thống với mô tả chi tiết, ảnh, lịch khởi hành và giá cả. Công cụ nhập liệu hỗ trợ import hàng loạt từ Excel hoặc kết nối trực tiếp qua API nếu bạn đã có hệ thống quản lý.',
  },
  {
    number: '03',
    title: 'Nhận đặt chỗ và phát triển kinh doanh',
    description:
      'Du khách tìm thấy tour của bạn qua AI gợi ý và đặt trực tuyến. Bạn nhận thông báo ngay, xác nhận booking và quản lý toàn bộ quy trình từ dashboard. Thanh toán được xử lý qua cổng thanh toán bảo mật.',
  },
];

export default async function ForAgenciesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Dành cho công ty lữ hành
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Nâng tầm dịch vụ lữ hành của bạn
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            Tiếp cận hàng nghìn du khách đang lên kế hoạch chuyến đi. Đăng tour, nhận đặt chỗ
            trực tuyến và xây dựng thương hiệu bền vững trên nền tảng du lịch lớn nhất Việt Nam.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/register?type=agency"
              className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Đăng ký dùng thử miễn phí
            </a>
            <a
              href="/contact"
              className="rounded-xl border border-border bg-surface-1 px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-2"
            >
              Liên hệ tư vấn
            </a>
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-surface-2 py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold text-text">
              Tại sao chọn TravelVietPlaner?
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {benefits.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-2xl border border-border bg-bg p-7">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-text">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-4 py-20 md:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-text">Cách hoạt động</h2>
          <div className="space-y-6">
            {steps.map(({ number, title, description }) => (
              <div key={number} className="flex gap-6 rounded-2xl border border-border bg-surface-1 p-7">
                <span className="shrink-0 select-none text-5xl font-black leading-none text-primary/20">
                  {number}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-text">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="bg-surface-2 py-16">
          <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
            <p className="text-lg leading-relaxed text-text-muted">
              &ldquo;Từ khi đăng tour lên TravelVietPlaner, chúng tôi nhận được trung bình 15-20 booking
              mới mỗi tuần mà không cần chạy thêm quảng cáo. Du khách tìm đến chúng tôi trong quá
              trình lên kế hoạch — đó là thời điểm tốt nhất để chốt một tour.&rdquo;
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                T
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Hoàng Văn Tuấn</p>
                <p className="text-xs text-text-muted">Giám đốc, Công ty Du lịch Sao Biển, Đà Nẵng</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Sẵn sàng mở rộng kênh bán hàng?</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Bắt đầu với gói dùng thử miễn phí 30 ngày. Không cần cam kết dài hạn.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="/register?type=agency"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Đăng ký ngay
              </a>
              <a
                href="/pricing"
                className="rounded-xl border border-border bg-bg px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-1"
              >
                Xem bảng giá
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

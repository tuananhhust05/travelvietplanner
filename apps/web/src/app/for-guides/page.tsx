import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { BadgeCheck, Star, CalendarCheck, DollarSign } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Dành cho hướng dẫn viên',
  description:
    'Xây dựng thương hiệu cá nhân, nhận booking trực tuyến và kết nối với du khách yêu Việt Nam trên TravelVietPlaner.',
};

const benefits = [
  {
    icon: BadgeCheck,
    title: 'Hồ sơ chuyên nghiệp được xác minh',
    description:
      'Tạo profile đầy đủ với ảnh, video giới thiệu bản thân, chứng chỉ hành nghề, ngôn ngữ và chuyên môn địa phương. Badge xác minh chính thức giúp du khách tin tưởng và dễ dàng quyết định chọn bạn hơn hướng dẫn viên không có xác nhận.',
  },
  {
    icon: Star,
    title: 'Xây dựng danh tiếng qua đánh giá thực',
    description:
      'Mỗi chuyến đi hoàn thành, du khách để lại đánh giá về bạn — điểm số, nhận xét và ảnh chụp cùng nhau. Điểm uy tín tích lũy theo thời gian giúp profile của bạn nổi bật trong kết quả tìm kiếm và được AI gợi ý ưu tiên cho các lịch trình phù hợp.',
  },
  {
    icon: CalendarCheck,
    title: 'Quản lý lịch và booking đơn giản',
    description:
      'Thiết lập lịch khả dụng theo ngày và giờ, đặt giá tour và nhận yêu cầu đặt lịch trực tuyến. Toàn bộ thông tin liên lạc với khách, xác nhận booking và theo dõi lịch sử tour được tập trung trong một ứng dụng — không cần quản lý Zalo, email và điện thoại riêng lẻ.',
  },
  {
    icon: DollarSign,
    title: 'Thu nhập ổn định và minh bạch',
    description:
      'Thiết lập mức giá của riêng bạn, không bị ép giá. Thanh toán qua cổng bảo mật, được chuyển khoản trực tiếp sau khi chuyến đi hoàn thành. Xem lịch sử thu nhập, dự báo booking trong tháng tới và tối ưu giá theo mùa cao điểm.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Tạo hồ sơ hướng dẫn viên',
    description:
      'Đăng ký tài khoản, điền thông tin chuyên môn và tải lên chứng chỉ hành nghề. Đội xác minh của chúng tôi kiểm tra hồ sơ trong 3 ngày làm việc. Sau khi được duyệt, profile của bạn xuất hiện trong danh sách hướng dẫn viên và được AI xét gợi ý cho du khách.',
  },
  {
    number: '02',
    title: 'Thiết lập dịch vụ và lịch khả dụng',
    description:
      'Tạo các gói tour của bạn với mô tả, ảnh, giá cả và thời lượng. Đặt lịch các ngày bạn sẵn sàng nhận khách. Bạn có thể tạo nhiều gói tour khác nhau — nửa ngày, trọn ngày, tour đặc biệt theo yêu cầu — và điều chỉnh giá linh hoạt theo mùa.',
  },
  {
    number: '03',
    title: 'Nhận khách và xây dựng uy tín',
    description:
      'Du khách tìm thấy bạn qua tìm kiếm, gợi ý AI và cộng đồng. Họ đặt lịch trực tuyến, bạn xác nhận và dẫn tour. Sau mỗi chuyến đi, đánh giá từ khách tích lũy vào profile — mỗi review tốt là bước đệm để nhận thêm nhiều booking hơn trong tháng tiếp theo.',
  },
];

export default async function ForGuidesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Dành cho hướng dẫn viên
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Kết nối với du khách yêu Việt Nam
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            Chia sẻ kiến thức địa phương của bạn, xây dựng thương hiệu cá nhân và phát triển
            sự nghiệp hướng dẫn viên chuyên nghiệp — tất cả trên một nền tảng.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/register?type=guide"
              className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Đăng ký làm hướng dẫn viên
            </a>
            <a
              href="/pricing"
              className="rounded-xl border border-border bg-surface-1 px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-2"
            >
              Xem bảng giá
            </a>
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-surface-2 py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold text-text">
              Tại sao hướng dẫn viên chọn TravelVietPlaner?
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
              &ldquo;Trước đây mình tìm khách chủ yếu qua Facebook và giới thiệu miệng. Từ khi có profile
              trên TravelVietPlaner, mình nhận được booking từ du khách mình chưa từng gặp — họ đọc
              đánh giá của người đi trước và quyết định đặt luôn. Thu nhập tháng này tăng gần gấp đôi.&rdquo;
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                L
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Lò Văn Long</p>
                <p className="text-xs text-text-muted">Hướng dẫn viên trekking, Sa Pa</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">
              Biến kiến thức địa phương thành thu nhập ổn định
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Đăng ký miễn phí. Không mất phí đến khi bạn nhận booking đầu tiên.
            </p>
            <a
              href="/register?type=guide"
              className="mt-8 inline-flex items-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Tạo hồ sơ hướng dẫn viên
            </a>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

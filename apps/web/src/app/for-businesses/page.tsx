import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { TrendingUp, Globe, MessageCircle, LayoutDashboard } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Dành cho khách sạn và nhà hàng',
  description:
    'Đưa doanh nghiệp của bạn vào hành trình du lịch của hàng nghìn du khách mỗi ngày. Hợp tác với TravelVietPlaner để tiếp cận đúng khách, đúng thời điểm.',
};

const benefits = [
  {
    icon: TrendingUp,
    title: 'Xuất hiện trong lịch trình AI mỗi ngày',
    description:
      'Khách sạn, nhà hàng và điểm tham quan của bạn được AI gợi ý trực tiếp trong lịch trình đang được tạo cho hàng nghìn du khách. Không phải quảng cáo banner bị lướt qua — mà là đề xuất hữu ích trong đúng ngữ cảnh du lịch, khi du khách đang thực sự cần.',
  },
  {
    icon: Globe,
    title: 'Tiếp cận du khách nội địa lẫn quốc tế',
    description:
      'Nền tảng hỗ trợ tiếng Việt và tiếng Anh, giúp bạn kết nối với du khách trong nước từ Hà Nội, TP.HCM đến Cần Thơ, cũng như khách quốc tế đang tìm kiếm trải nghiệm đích thực tại Việt Nam. Profile doanh nghiệp được tối ưu cho cả hai ngôn ngữ.',
  },
  {
    icon: MessageCircle,
    title: 'Quản lý đánh giá và phản hồi',
    description:
      'Thu thập đánh giá từ du khách sau mỗi lần ghé thăm, phản hồi trực tiếp và theo dõi xu hướng nhận xét theo thời gian. Dashboard phân tích giúp bạn hiểu khách đến từ đâu, họ đánh giá gì cao nhất và điểm nào cần cải thiện để giữ chân khách quay lại.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard doanh nghiệp toàn diện',
    description:
      'Quản lý toàn bộ sự hiện diện trực tuyến của bạn từ một nơi: cập nhật thông tin, ảnh, giờ mở cửa và ưu đãi đặc biệt. Xem số liệu lượt xem profile, lượt lưu vào lịch trình và tỷ lệ chuyển đổi thành lượt đặt thực tế theo tuần và tháng.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Tạo profile doanh nghiệp',
    description:
      'Đăng ký tài khoản doanh nghiệp và điền đầy đủ thông tin: tên, địa chỉ, danh mục (khách sạn, nhà hàng, điểm tham quan, spa...), ảnh, mô tả và thông tin liên hệ. Profile được kiểm duyệt trong 1 ngày làm việc. Ảnh chất lượng cao và mô tả chi tiết giúp tăng đáng kể khả năng được AI gợi ý.',
  },
  {
    number: '02',
    title: 'Xuất hiện trong gợi ý AI',
    description:
      'Sau khi được duyệt, doanh nghiệp của bạn trở thành một phần trong cơ sở dữ liệu mà AI tham chiếu khi tạo lịch trình. Dữ liệu cộng đồng — đánh giá, lượt lưu, nhắc đến trong bình luận — ảnh hưởng trực tiếp đến tần suất bạn được gợi ý. Doanh nghiệp có nhiều đánh giá tích cực sẽ xuất hiện ưu tiên hơn.',
  },
  {
    number: '03',
    title: 'Theo dõi và tối ưu hiệu quả',
    description:
      'Dùng dashboard analytics để xem profile của bạn đang hoạt động như thế nào: số lượt xem, lượt lưu vào lịch trình, xu hướng theo mùa và phân tích đánh giá. Từ dữ liệu này, bạn có thể điều chỉnh mô tả, cập nhật ưu đãi mùa cao điểm và phản hồi đánh giá để duy trì điểm số tốt.',
  },
];

export default async function ForBusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Dành cho khách sạn và nhà hàng
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Đưa doanh nghiệp của bạn vào hành trình du lịch
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            Hợp tác với TravelVietPlaner để tiếp cận du khách đúng lúc họ đang lên kế hoạch —
            khi quyết định đặt phòng, chọn nhà hàng hay mua vé tham quan chưa được đưa ra.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/register?type=business"
              className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Đăng ký doanh nghiệp
            </a>
            <a
              href="/contact"
              className="rounded-xl border border-border bg-surface-1 px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-2"
            >
              Liên hệ hợp tác
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
              &ldquo;Nhà hàng của tôi ở Hội An đã tăng đáng kể lượng khách đặt bàn trước từ khi có
              mặt trên TravelVietPlaner. Khách đến từ platform thường đã biết rõ về chúng tôi —
              họ đọc đánh giá và lưu vào lịch trình trước khi đến. Chất lượng khách tốt hơn nhiều
              so với các kênh giới thiệu khác.&rdquo;
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                N
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Nguyễn Thị Bích Ngọc</p>
                <p className="text-xs text-text-muted">Chủ nhà hàng Bếp Quảng, Hội An</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">
              Bắt đầu tiếp cận du khách ngay hôm nay
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Tạo profile doanh nghiệp miễn phí. Nâng cấp lên gói có phí khi bạn thấy kết quả.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="/register?type=business"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Đăng ký miễn phí
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

import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Sparkles, Share2, MapPin, UserCheck } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Dành cho du khách',
  description:
    'Khám phá Việt Nam theo cách của bạn với AI lập kế hoạch thông minh, bản đồ tương tác và cộng đồng du lịch sôi động.',
};

const benefits = [
  {
    icon: Sparkles,
    title: 'Lịch trình AI cá nhân hóa',
    description:
      'Không ai giống ai — và lịch trình du lịch cũng vậy. AI của chúng tôi phân tích sở thích, ngân sách, phong cách đi và ràng buộc thực tế của bạn để tạo ra hành trình thực sự phù hợp, không phải mẫu chung cho tất cả mọi người.',
  },
  {
    icon: Share2,
    title: 'Cộng đồng du khách chân thực',
    description:
      'Học hỏi từ hàng nghìn du khách đã đi trước — không phải bài viết PR, không phải review giả. Từng đánh giá quán ăn, từng bình luận về chất lượng đường đi đều đến từ người dùng thực tế của TravelVietPlaner.',
  },
  {
    icon: MapPin,
    title: 'Bản đồ tuyến đường thông minh',
    description:
      'Xem toàn bộ chuyến đi trực quan trên bản đồ với khoảng cách, thời gian di chuyển và phương tiện gợi ý theo từng chặng. Chế độ offline giúp bạn dùng được kể cả khi không có sóng ở vùng núi hay hải đảo.',
  },
  {
    icon: UserCheck,
    title: 'Kết nối với người địa phương',
    description:
      'Tìm và đặt lịch với hướng dẫn viên địa phương được xác minh — những người biết đường tắt, biết quán ngon ít người biết và có thể đưa bạn đến những trải nghiệm mà khách du lịch thông thường không bao giờ tiếp cận được.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Tạo tài khoản miễn phí',
    description:
      'Đăng ký trong 30 giây bằng email hoặc tài khoản Google. Không cần thẻ tín dụng. Gói miễn phí cho phép bạn tạo ngay 5 lịch trình AI đầu tiên và truy cập toàn bộ feed cộng đồng.',
  },
  {
    number: '02',
    title: 'Kể cho AI nghe chuyến đi bạn muốn',
    description:
      'Nhập điểm đến, thời gian, phong cách du lịch và ngân sách bằng ngôn ngữ tự nhiên. AI sẽ phân tích và tạo ra lịch trình chi tiết theo từng ngày — có thể tinh chỉnh ngay trong cuộc trò chuyện.',
  },
  {
    number: '03',
    title: 'Lên đường, khám phá và chia sẻ',
    description:
      'Dùng ứng dụng như bản đồ đồng hành trong chuyến đi. Sau khi về, chia sẻ hành trình thực tế với cộng đồng — ảnh, đánh giá và những điều bạn học được sẽ giúp ích cho du khách tiếp theo.',
  },
];

export default async function ForTravelersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Dành cho du khách
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Khám phá Việt Nam theo cách của bạn
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            Từ Hà Nội đến Phú Quốc, từ Sa Pa đến Hội An — AI giúp bạn lên kế hoạch hoàn hảo cho
            mọi chuyến đi, dù đi một mình, đi cặp hay đi cùng cả gia đình.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/register"
              className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Bắt đầu miễn phí
            </a>
            <a
              href="/how-it-works"
              className="rounded-xl border border-border bg-surface-1 px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-2"
            >
              Tìm hiểu thêm
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
              &ldquo;Mình là người hay lo lắng, lên kế hoạch rất kỹ trước mỗi chuyến đi. TravelVietPlaner
              là lần đầu tiên mình thấy một công cụ thực sự hiểu mình cần gì — không chỉ đưa ra danh
              sách điểm đến mà còn giải thích tại sao sắp xếp theo thứ tự đó.&rdquo;
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                H
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Phạm Thu Hà</p>
                <p className="text-xs text-text-muted">Solo traveler, Hải Phòng</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Chuyến đi tiếp theo của bạn bắt đầu từ đây</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Tạo tài khoản miễn phí và lên lịch trình AI đầu tiên trong 5 phút.
            </p>
            <a
              href="/register"
              className="mt-8 inline-flex items-center rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Đăng ký miễn phí
            </a>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

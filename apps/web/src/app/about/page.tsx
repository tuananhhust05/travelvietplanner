import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Heart, MapPin, Brain, Users } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Về chúng tôi',
  description:
    'travelvietplaner ra đời từ niềm đam mê khám phá Việt Nam. Tìm hiểu về đội ngũ kỹ sư, nhà thiết kế và sứ mệnh xóa bỏ rào cản lên kế hoạch du lịch.',
};

const values = [
  {
    icon: Heart,
    title: 'Chân thực',
    description:
      'Chúng tôi không bán quảng cáo trá hình hay gợi ý điểm đến vì tiền hoa hồng. Mọi đề xuất đều đến từ dữ liệu thực tế của cộng đồng và kiến thức chuyên môn của hướng dẫn viên địa phương.',
  },
  {
    icon: MapPin,
    title: 'Địa phương',
    description:
      'Việt Nam không thể được hiểu từ xa. Đội ngũ của chúng tôi đến từ ba miền, và mạng lưới hướng dẫn viên đối tác trải dài khắp 34 tỉnh thành — mang kiến thức thực địa vào từng gợi ý AI.',
  },
  {
    icon: Brain,
    title: 'Thông minh',
    description:
      'Công nghệ phải phục vụ con người, không phải ngược lại. AI của chúng tôi được tinh chỉnh để hiểu văn hóa du lịch Việt Nam — không chỉ dịch dữ liệu toàn cầu sang tiếng Việt.',
  },
  {
    icon: Users,
    title: 'Cộng đồng',
    description:
      'Mọi lịch trình được chia sẻ, mỗi đánh giá được viết và từng câu hỏi được trả lời đều làm cho nền tảng trở nên tốt hơn cho người tiếp theo. Chúng tôi xây dựng sản phẩm mà cộng đồng đồng sở hữu.',
  },
];

const team = [
  {
    name: 'Nguyễn Minh Anh',
    role: 'CEO & Co-founder',
    location: 'Hà Nội',
    bio: 'Từng là kỹ sư phần mềm tại một startup fintech Hà Nội, Minh Anh bắt đầu xây dựng TravelVietPlaner sau khi nhận ra không có công cụ nào đủ tốt để lên kế hoạch cho chuyến đi xuyên Việt 30 ngày của mình. Anh đã đặt chân đến hầu hết 34 tỉnh thành trên cả nước.',
  },
  {
    name: 'Trần Quốc Huy',
    role: 'CTO & Co-founder',
    location: 'TP.HCM',
    bio: 'Quốc Huy xây dựng hệ thống AI và infrastructure của TravelVietPlaner. Anh có nền tảng nghiên cứu về xử lý ngôn ngữ tự nhiên tiếng Việt và từng làm việc tại các công ty công nghệ ở Singapore trước khi về Việt Nam khởi nghiệp.',
  },
  {
    name: 'Lê Thị Lan',
    role: 'Head of Design',
    location: 'Đà Nẵng',
    bio: 'Lan thiết kế toàn bộ trải nghiệm người dùng của TravelVietPlaner với triết lý "đơn giản đến mức không thể đơn giản hơn". Cô là người đi du lịch solo kỳ cựu và hiểu rõ những điểm đau của du khách cần giải quyết trước những người dùng khác.',
  },
];

const stats = [
  { value: '50.000+', label: 'Lịch trình đã tạo' },
  { value: '63', label: 'Tỉnh thành Việt Nam' },
  { value: '2.000+', label: 'Hướng dẫn viên đối tác' },
  { value: '120.000+', label: 'Du khách tin dùng' },
];

export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero / Mission */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Về chúng tôi
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Du lịch Việt Nam xứng đáng được lên kế hoạch tốt hơn
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
            Hàng triệu người Việt và du khách quốc tế khao khát khám phá dải đất hình chữ S mỗi
            năm. Nhưng quá trình lên kế hoạch vẫn còn đầy rẫy khó khăn: thông tin rải rác trên
            hàng chục trang web, lời khuyên lỗi thời, và không có công cụ nào thực sự hiểu bối
            cảnh địa phương.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-text-muted">
            TravelVietPlaner ra đời để thay đổi điều đó. Chúng tôi kết hợp AI tiên tiến với
            kiến thức sâu về 34 tỉnh thành và cộng đồng hướng dẫn viên địa phương — để mỗi
            chuyến đi được chuẩn bị kỹ lưỡng, dù bạn là người lần đầu đến Việt Nam hay đã
            đi hàng chục lần.
          </p>
        </section>

        {/* Story */}
        <section className="bg-surface-2 py-20">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <h2 className="mb-8 text-2xl font-bold text-text md:text-3xl">Câu chuyện của chúng tôi</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4 text-text-muted leading-relaxed">
                <p>
                  Năm 2023, Minh Anh và Quốc Huy — hai người bạn từ thời đại học — quyết định
                  thực hiện chuyến đi xuyên Việt 30 ngày trên xe máy. Sau hai tuần lên kế hoạch
                  trên 15 tab trình duyệt khác nhau, đọc hàng trăm bài blog và vẫn không chắc
                  lịch trình có thực tế hay không, họ nhận ra vấn đề rõ ràng hơn bao giờ hết.
                </p>
                <p>
                  "Không có công cụ nào hiểu được rằng từ Sa Pa xuống Hà Nội rồi bay vào Đà
                  Nẵng cùng ngày là không thực tế," Minh Anh nhớ lại. "Mọi công cụ lập lịch
                  đều không biết gì về thực tế di chuyển ở Việt Nam."
                </p>
              </div>
              <div className="space-y-4 text-text-muted leading-relaxed">
                <p>
                  Sau chuyến đi đó — vừa tuyệt vời vừa đầy bất ngờ vì những điều không được
                  lên kế hoạch — họ bắt tay xây dựng thứ mình muốn có. Sáu tháng sau, phiên
                  bản đầu tiên của TravelVietPlaner ra đời với 200 người dùng beta đầu tiên.
                </p>
                <p>
                  Hôm nay, TravelVietPlaner phục vụ hơn 120.000 du khách, với hơn 50.000 lịch
                  trình đã được tạo và một cộng đồng hướng dẫn viên đối tác trải rộng khắp
                  đất nước.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-5xl px-4 py-20 md:px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface-1 p-6 text-center">
                <p className="text-4xl font-black text-primary">{value}</p>
                <p className="mt-2 text-sm text-text-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="bg-surface-2 py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold text-text md:text-3xl">
              Giá trị cốt lõi
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {values.map(({ icon: Icon, title, description }) => (
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

        {/* Team */}
        <section className="mx-auto max-w-5xl px-4 py-20 md:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-text md:text-3xl">Đội ngũ</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {team.map(({ name, role, location, bio }) => (
              <div key={name} className="rounded-2xl border border-border bg-surface-1 p-7">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary">
                  {name.charAt(0)}
                </div>
                <p className="mt-4 font-semibold text-text">{name}</p>
                <p className="text-sm font-medium text-primary">{role}</p>
                <p className="mt-0.5 text-xs text-text-muted">{location}</p>
                <p className="mt-4 text-sm leading-relaxed text-text-muted">{bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Join CTA */}
        <section className="border-t border-border bg-surface-2">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Cùng chúng tôi xây dựng tương lai du lịch Việt Nam</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Dù là du khách, hướng dẫn viên hay đối tác doanh nghiệp — bạn là một phần của câu chuyện này.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="/register"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Tham gia cộng đồng
              </a>
              <a
                href="/contact"
                className="rounded-xl border border-border bg-bg px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-1"
              >
                Liên hệ chúng tôi
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

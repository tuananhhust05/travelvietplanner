import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Sparkles, Users, Map, MapPin, UserCheck, Share2, Check } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Tính năng',
  description:
    'Khám phá toàn bộ tính năng của travelvietplaner: lập kế hoạch AI, mạng xã hội du lịch, bản đồ tương tác, kết nối hướng dẫn viên và đặt tour trực tiếp.',
};

const features = [
  {
    icon: Sparkles,
    title: 'AI lập kế hoạch hành trình',
    paragraphs: [
      'TravelVietPlaner sử dụng Claude AI để phân tích yêu cầu của bạn và tạo lịch trình du lịch chi tiết theo từng ngày. Chỉ cần mô tả bằng ngôn ngữ tự nhiên: "Mình muốn đi Hội An 4 ngày, thích ẩm thực và kiến trúc cổ, ngân sách tầm trung" — AI sẽ hiểu và trả về hành trình đầy đủ trong vài giây.',
      'Hệ thống streaming SSE cho phép lịch trình hiện ra theo thời gian thực, từng dòng một — giống như đang được một chuyên gia du lịch tư vấn trực tiếp. AI hiểu ngữ cảnh sâu về tất cả 34 tỉnh thành Việt Nam, từ mùa mưa Tây Nguyên, lễ hội làng nghề đồng bằng sông Cửu Long đến điểm trekking ít người biết ở Hà Giang.',
      'Kết quả không chỉ là danh sách địa điểm mà là lịch trình đã tối ưu tuyến đường, gợi ý khung giờ tham quan, cảnh báo thời tiết theo mùa và ước tính chi phí thực tế cho từng hoạt động.',
    ],
    highlights: [
      'Hỗ trợ 34 tỉnh thành với dữ liệu mùa vụ và lễ hội địa phương',
      'Streaming SSE — lịch trình hiện ra ngay lập tức, không chờ đợi',
      'Context-aware: nhớ sở thích của bạn qua nhiều lần tương tác',
    ],
  },
  {
    icon: Users,
    title: 'Mạng xã hội du lịch',
    paragraphs: [
      'TravelVietPlaner là cộng đồng của những người yêu du lịch Việt Nam. Bạn có thể theo dõi hướng dẫn viên địa phương giàu kinh nghiệm, các blogger du lịch nổi tiếng và bạn bè đồng hành để không bao giờ bỏ lỡ hành trình thú vị nào.',
      'Feed cá nhân hóa hiển thị lịch trình từ những người bạn theo dõi, cùng các bài viết chia sẻ trải nghiệm thực tế. Hệ thống bình luận cho phép hỏi trực tiếp người đã đi: "Cửa hàng bún bò đó giờ còn hoạt động không?" hay "Đường lên Fansipan mùa này thế nào?".',
      'Tính năng "Repost hành trình" giúp bạn lưu và điều chỉnh lịch trình của người khác thành của riêng mình chỉ với một cú click — nền tảng cho việc cộng tác lên kế hoạch nhóm hiệu quả.',
    ],
    highlights: [
      'Follow hướng dẫn viên, blogger và bạn bè du lịch yêu thích',
      'Comment, hỏi đáp và tương tác trực tiếp trên từng hành trình',
      'Repost và tùy chỉnh lịch trình từ cộng đồng thành của riêng bạn',
    ],
  },
  {
    icon: Map,
    title: 'Bản đồ tương tác Việt Nam',
    paragraphs: [
      'Xem toàn bộ hành trình trực quan trên bản đồ với hơn 50 điểm đến được đánh dấu chi tiết — từ các di sản UNESCO như Vịnh Hạ Long, Phố cổ Hội An đến những bản làng xa xôi ở vùng cao Tây Bắc. Mỗi pin chứa ảnh, mô tả và thông tin thực tế do cộng đồng đóng góp.',
      'Tính năng lập tuyến đường thông minh tự động sắp xếp thứ tự các điểm tham quan để tối thiểu hóa di chuyển. Bản đồ hiển thị rõ khoảng cách, phương tiện phù hợp (xe máy, xe khách, tàu hỏa, máy bay) và thời gian di chuyển thực tế theo từng chặng.',
      'Chế độ offline-ready cho phép tải bản đồ khu vực trước chuyến đi — rất hữu ích khi di chuyển đến vùng sóng yếu như Sapa, Mù Cang Chải hay đảo Cát Bà nơi 4G không ổn định.',
    ],
    highlights: [
      '50+ điểm đến được đánh dấu với thông tin chi tiết từ cộng đồng',
      'Tự động tối ưu tuyến đường, tiết kiệm thời gian di chuyển giữa các điểm',
      'Hỗ trợ offline — dùng được cả khi không có mạng',
    ],
  },
  {
    icon: MapPin,
    title: 'Khám phá điểm đến ẩn',
    paragraphs: [
      'Hàng triệu du khách đổ về Hội An, Đà Lạt, Sapa mỗi năm — nhưng Việt Nam còn vô số viên ngọc chưa được khai phá. TravelVietPlaner tổng hợp và kiểm duyệt những địa điểm chưa bị "du lịch hóa": những con đèo hoang sơ, bãi biển vắng, chợ phiên vùng cao chỉ họp vào cuối tuần.',
      'Bộ lọc thông minh giúp tìm điểm đến theo tiêu chí cụ thể: "ít người Việt biết", "phù hợp trekking 1 ngày", "gần Đà Nẵng bán kính 50km", "có thác nước đẹp". Mỗi địa điểm có đánh giá thực tế từ cộng đồng và hướng dẫn đường đi chi tiết.',
      'Tính năng "Địa điểm theo mùa" cho bạn biết chính xác thời điểm đẹp nhất để đến — ruộng bậc thang Mù Cang Chải tháng 9-10, hoa tam giác mạch Hà Giang tháng 10-11, mùa nước nổi miền Tây tháng 9-11.',
    ],
    highlights: [
      'Curated hidden gems — chọn lọc kỹ bởi hướng dẫn viên địa phương',
      'Bộ lọc theo mùa, loại hình trải nghiệm và khoảng cách từ vị trí của bạn',
      'Hướng dẫn đường đi chi tiết cả với xe máy lẫn phương tiện công cộng',
    ],
  },
  {
    icon: UserCheck,
    title: 'Đặt lịch với hướng dẫn viên địa phương',
    paragraphs: [
      'Không ai hiểu một vùng đất tốt hơn người đã sống ở đó cả đời. TravelVietPlaner kết nối bạn với hơn 2.000 hướng dẫn viên địa phương được xác minh danh tính và chứng chỉ hành nghề — từ chuyên gia leo núi ở Sa Pa đến người dẫn tour kayak ở Phong Nha, từ hướng dẫn viên ẩm thực Hội An đến người biết từng con hẻm của chợ Bến Thành.',
      'Mỗi hướng dẫn viên có trang profile chi tiết với video giới thiệu, lịch sử tour đã dẫn, điểm đánh giá từ du khách thực tế và chứng nhận chuyên môn. Hệ thống đặt lịch trực tuyến cho phép chọn ngày, tùy chỉnh chương trình và thanh toán an toàn trong 5 phút.',
      'Chính sách hoàn tiền linh hoạt và hỗ trợ 24/7 đảm bảo trải nghiệm đặt tour an tâm. Hướng dẫn viên có thể tích hợp trực tiếp vào lịch trình AI, thay thế một ngày tự túc bằng một ngày có chuyên gia đồng hành.',
    ],
    highlights: [
      '2.000+ hướng dẫn viên địa phương đã xác minh danh tính và chứng chỉ',
      'Hệ thống đánh giá minh bạch từ du khách đã trải nghiệm thực tế',
      'Đặt lịch, tùy chỉnh và thanh toán trực tuyến trong vài phút',
    ],
  },
  {
    icon: Share2,
    title: 'Chia sẻ hành trình thực tế',
    paragraphs: [
      'Sau mỗi chuyến đi, những gì bạn trải nghiệm là kho báu vô giá cho cộng đồng. TravelVietPlaner cho phép biến lịch trình đã đi thành bài viết du lịch phong phú: tải ảnh theo từng ngày, ghi chú cảm nhận thực tế, đánh dấu điểm đã bỏ qua hoặc đề xuất thêm.',
      'Tính năng GPS route cho phép xuất tuyến đường thực tế từ điện thoại lên bản đồ — những con đường tắt, điểm dừng tự phát và bí kíp "chỉ người địa phương biết" sẽ được lưu lại cho cộng đồng. Nhật ký ảnh được tổ chức theo ngày và địa điểm tự động.',
      'Hành trình chia sẻ có thể để công khai, chỉ cho bạn bè, hoặc riêng tư. Bật tính năng "Theo dõi hành trình trực tiếp" để người thân biết bạn đang ở đâu trong suốt chuyến đi — tính năng an toàn được nhiều solo traveler yêu thích.',
    ],
    highlights: [
      'Nhật ký ảnh theo ngày và địa điểm được tổ chức tự động',
      'Export GPS route thực tế từ điện thoại lên bản đồ cộng đồng',
      'Tùy chỉnh quyền riêng tư: công khai, bạn bè hoặc chỉ mình bạn',
    ],
  },
];

export default async function FeaturesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Tính năng
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl lg:text-6xl">
            Mọi tính năng bạn cần cho một chuyến đi Việt Nam hoàn hảo
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
            Từ AI lập kế hoạch thông minh đến cộng đồng du lịch sôi động — TravelVietPlaner là
            người bạn đồng hành từ lúc nảy ra ý tưởng cho đến khi kết thúc chuyến đi.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/register"
              className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
            >
              Bắt đầu miễn phí
            </a>
            <a
              href="/pricing"
              className="rounded-xl border border-border bg-surface-1 px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-2"
            >
              Xem bảng giá
            </a>
          </div>
        </section>

        {/* Feature sections */}
        <section className="mx-auto max-w-5xl px-4 pb-32 md:px-6">
          <div className="space-y-16">
            {features.map(({ icon: Icon, title, paragraphs, highlights }, i) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-surface-1 p-8 md:p-12"
              >
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <div className="shrink-0 rounded-xl bg-primary/10 p-4">
                    <Icon size={48} className="text-primary" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                      Tính năng {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 className="mt-1 text-2xl font-bold text-text md:text-3xl">{title}</h2>
                  </div>
                </div>
                <div className="space-y-4">
                  {paragraphs.map((p, pi) => (
                    <p key={pi} className="leading-relaxed text-text-muted">
                      {p}
                    </p>
                  ))}
                </div>
                <ul className="mt-8 space-y-3 border-t border-border pt-8">
                  {highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-sm text-text">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <Check size={12} className="text-primary" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="border-t border-border bg-surface-2">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Sẵn sàng khám phá Việt Nam?</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Tạo lịch trình AI đầu tiên miễn phí — không cần thẻ tín dụng, không cần cài đặt gì thêm.
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
                className="rounded-xl border border-border bg-bg px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-1"
              >
                Cách hoạt động
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

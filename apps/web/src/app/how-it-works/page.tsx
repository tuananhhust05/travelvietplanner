import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Lightbulb } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Cách hoạt động',
  description:
    'Ba bước đơn giản: mô tả chuyến đi, nhận lịch trình AI chi tiết theo ngày, rồi chia sẻ hành trình với cộng đồng du khách Việt Nam.',
};

const steps = [
  {
    number: '01',
    title: 'Kể cho AI về chuyến đi của bạn',
    paragraphs: [
      'Hãy tưởng tượng bạn đang nhắn tin cho một người bạn thân am hiểu du lịch Việt Nam. Không cần điền form, không cần chọn từ dropdown — chỉ cần nói tự nhiên. Ví dụ: "Mình muốn đi Hà Giang 5 ngày vào cuối tháng 10, thích cảnh đẹp và văn hóa dân tộc, ngân sách khoảng 5 triệu, đi xe máy". AI sẽ hiểu ngay bối cảnh và bắt đầu xây dựng hành trình phù hợp.',
      'Bạn có thể cung cấp thêm chi tiết như số người đi cùng, sở thích ăn uống (ăn chay, thích ẩm thực đường phố, không ăn hải sản), phong cách du lịch (phượt bụi, gia đình, cặp đôi, chill hay trải nghiệm nhiều), và mức độ di chuyển bạn chịu được trong ngày. Càng nhiều thông tin, lịch trình càng sát với mong muốn thực tế.',
    ],
    tip: 'Mẹo: Thêm ràng buộc thực tế như "mình hay say xe" hay "bọn mình có em bé 2 tuổi" để AI điều chỉnh nhịp độ và lựa chọn phương tiện phù hợp.',
  },
  {
    number: '02',
    title: 'AI phân tích và gợi ý lịch trình',
    paragraphs: [
      'Ngay khi bạn gửi yêu cầu, AI bắt đầu phân tích đồng thời nhiều yếu tố: thời tiết theo mùa tại điểm đến, lịch lễ hội và sự kiện địa phương trong thời gian bạn đi, khoảng cách thực tế giữa các địa điểm, thời gian mở cửa của điểm tham quan và mức độ phổ biến (để tránh giờ cao điểm đông khách). Với 34 tỉnh thành Việt Nam, AI có dữ liệu cụ thể cho từng vùng.',
      'Lịch trình được trả về theo dạng streaming — bạn thấy từng ngày hiện ra ngay lập tức, không phải chờ toàn bộ kết quả. Mỗi ngày bao gồm địa điểm tham quan sắp xếp theo tuyến đường hợp lý, gợi ý ăn sáng/trưa/tối với tên quán cụ thể và mức giá, lựa chọn chỗ nghỉ theo ngân sách, và ghi chú thực tế như "nên đặt vé cáp treo trước 1 tuần vào mùa cao điểm".',
    ],
    tip: 'Mẹo: Lịch trình AI không phải bản cuối cùng — đây là điểm khởi đầu để bạn tinh chỉnh. Hãy xem nó như bản nháp thông minh.',
  },
  {
    number: '03',
    title: 'Tinh chỉnh với AI',
    paragraphs: [
      'Sau khi có lịch trình đầu tiên, bạn có thể trao đổi tiếp với AI để điều chỉnh theo ý muốn. "Ngày 3 quá nhiều di chuyển, rút bớt 1 điểm cho mình" — AI sẽ tái cấu trúc ngày đó. "Thêm cho mình một buổi tối xem biểu diễn nghệ thuật truyền thống" — AI gợi ý lựa chọn phù hợp tại địa phương. Mỗi yêu cầu chỉnh sửa được xử lý trong ngữ cảnh của toàn bộ hành trình.',
      'Bạn cũng có thể kéo thêm dữ liệu từ cộng đồng: "Tìm cho mình những quán cà phê view đẹp ở Đà Lạt được cộng đồng đánh giá cao nhất" hay "Có hướng dẫn viên nào chuyên về Hội An cổ phố không?". AI tổng hợp gợi ý từ lịch trình thực tế của hàng nghìn du khách đã đi trước.',
    ],
    tip: 'Mẹo: Dùng lệnh "So sánh phương án A và B" để AI đưa ra hai phiên bản lịch trình khác nhau và phân tích ưu nhược điểm từng cái.',
  },
  {
    number: '04',
    title: 'Chia sẻ lên cộng đồng',
    paragraphs: [
      'Lịch trình hoàn chỉnh có thể được chia sẻ với nhiều mức độ quyền riêng tư khác nhau: công khai để toàn cộng đồng xem và học hỏi, chia sẻ qua link riêng cho nhóm bạn đi cùng, hoặc giữ riêng tư chỉ cho bản thân. Với lịch trình công khai, bạn có thể thêm hashtag điểm đến, mùa đi, phong cách du lịch để người có cùng sở thích dễ tìm thấy.',
      'Cộng đồng có thể bình luận, đặt câu hỏi và lưu lịch trình của bạn vào bộ sưu tập cá nhân. Bạn sẽ nhận thông báo khi có người repost hay bình luận — đây là cách tự nhiên nhất để xây dựng uy tín như một "travel curator" trong cộng đồng TravelVietPlaner.',
    ],
    tip: 'Mẹo: Lịch trình có ảnh thực tế và ghi chú chi tiết thường nhận được 3-5x lượng tương tác so với lịch trình chỉ có địa điểm.',
  },
  {
    number: '05',
    title: 'Lên đường và cập nhật thực tế',
    paragraphs: [
      'Trong chuyến đi, ứng dụng đồng hành cùng bạn — mở lịch trình theo từng ngày, đánh dấu địa điểm đã đến, chụp ảnh và gắn thẳng vào lịch trình. Nếu thay đổi kế hoạch đột xuất (thời tiết xấu, tìm ra chỗ hay hơn), bạn có thể cập nhật lịch trình thực tế ngay trên điện thoại và ghi chú sự thay đổi.',
      'Sau chuyến đi, hệ thống nhắc bạn viết đánh giá ngắn cho từng địa điểm đã ghé thăm — đây là đóng góp có giá trị nhất cho cộng đồng, vì nó là thông tin thực tế mới nhất. Những đánh giá này được tổng hợp vào dữ liệu AI, giúp lịch trình tương lai của người khác ngày càng chính xác hơn.',
    ],
    tip: 'Mẹo: Bật tính năng "Nhật ký hành trình trực tiếp" trước chuyến đi để GPS tự ghi lại tuyến đường thực tế — bạn sẽ có một bản đồ chi tiết toàn bộ chuyến đi sau khi về.',
  },
];

const testimonials = [
  {
    quote: 'Trước đây mình mất cả tuần để lên kế hoạch cho 10 ngày Tây Bắc. Với TravelVietPlaner, mình có lịch trình chi tiết trong 20 phút và chỉ cần điều chỉnh đôi chút. Chuyến đi thực sự tuyệt vời hơn bất kỳ lần nào mình tự lên kế hoạch.',
    name: 'Trần Minh Tú',
    role: 'Phượt thủ, Hà Nội',
  },
  {
    quote: 'Điều mình thích nhất là AI hiểu mình đi với con nhỏ — nó tự động tránh những điểm leo núi dài và gợi ý khách sạn có hồ bơi cho trẻ em. Chưa có app nào làm được điều đó trước đây.',
    name: 'Nguyễn Thị Hương',
    role: 'Mẹ hai con, TP.HCM',
  },
];

const faqs = [
  {
    q: 'AI có thể lên lịch cho những tỉnh ít nổi tiếng không?',
    a: 'Có. AI được huấn luyện với dữ liệu từ tất cả 34 tỉnh thành, bao gồm cả những điểm đến ít người biết như Lai Châu, Cao Bằng, Vĩnh Long hay Tây Ninh. Dữ liệu từ cộng đồng hướng dẫn viên địa phương đặc biệt giúp ích cho các tỉnh ít xuất hiện trên blog du lịch phổ thông.',
  },
  {
    q: 'Lịch trình AI có đảm bảo thông tin cập nhật không?',
    a: 'AI kết hợp dữ liệu được cập nhật định kỳ với đóng góp thực tế từ cộng đồng. Tuy nhiên, với những thông tin nhạy cảm như giờ mở cửa hay giá vé, bạn nên xác nhận lại trực tiếp trước khi đến, đặc biệt là dịp lễ tết.',
  },
  {
    q: 'Tôi có thể dùng lịch trình offline khi đi không?',
    a: 'Với gói Pro, bạn có thể xuất lịch trình sang PDF để dùng offline. Bản đồ khu vực cũng có thể tải về trước trong ứng dụng di động, bao gồm cả pins địa điểm và tuyến đường — hữu ích cho các vùng sóng điện thoại không ổn định.',
  },
];

export default async function HowItWorksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-24 text-center md:px-6">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            Cách hoạt động
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-text md:text-5xl">
            Từ ý tưởng đến hành trình, chỉ trong vài phút
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
            Năm bước đơn giản để có một chuyến đi Việt Nam được lên kế hoạch kỹ lưỡng — từ cuộc
            trò chuyện đầu tiên với AI đến những kỷ niệm bạn chia sẻ với cộng đồng sau chuyến đi.
          </p>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-4xl px-4 pb-20 md:px-6">
          <div className="space-y-10">
            {steps.map(({ number, title, paragraphs, tip }) => (
              <div
                key={number}
                className="rounded-2xl border border-border bg-surface-1 p-8 md:p-10"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                  <span className="shrink-0 select-none text-7xl font-black leading-none text-primary/15">
                    {number}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-text md:text-2xl">{title}</h2>
                    <div className="mt-4 space-y-3">
                      {paragraphs.map((p, i) => (
                        <p key={i} className="leading-relaxed text-text-muted">
                          {p}
                        </p>
                      ))}
                    </div>
                    <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <Lightbulb size={18} className="mt-0.5 shrink-0 text-primary" />
                      <p className="text-sm leading-relaxed text-text">{tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-surface-2 py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold text-text">
              Du khách nói gì về TravelVietPlaner
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {testimonials.map(({ quote, name, role }) => (
                <div key={name} className="rounded-2xl border border-border bg-bg p-7">
                  <p className="leading-relaxed text-text-muted before:mr-1 before:text-2xl before:font-serif before:text-primary before:content-['\201C'] after:ml-1 after:text-2xl after:font-serif after:text-primary after:content-['\201D']">
                    {quote}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text">{name}</p>
                      <p className="text-xs text-text-muted">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-text">Câu hỏi thường gặp</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-surface-1 p-6">
                <p className="font-semibold text-text">{q}</p>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-surface-2">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center md:px-6">
            <h2 className="text-3xl font-bold text-text">Thử ngay — miễn phí</h2>
            <p className="mx-auto mt-4 max-w-lg text-text-muted">
              Tạo lịch trình đầu tiên trong vài phút. Không cần thẻ tín dụng.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="/register"
                className="rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-fg transition-all hover:brightness-110"
              >
                Bắt đầu miễn phí
              </a>
              <a
                href="/features"
                className="rounded-xl border border-border bg-bg px-7 py-3 text-sm font-semibold text-text transition-all hover:bg-surface-1"
              >
                Xem tất cả tính năng
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

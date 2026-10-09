import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { getLocale } from '@/lib/i18n';

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h1 className="text-4xl font-bold text-text">Chính sách bảo mật</h1>
          <p className="mt-3 text-sm text-text-muted">Cập nhật lần cuối: tháng 8 năm 2026</p>

          <div className="mt-10 space-y-10 text-text-muted leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-text">1. Thông tin chúng tôi thu thập</h2>
              <p className="mt-3">
                Chúng tôi thu thập thông tin bạn cung cấp trực tiếp khi tạo tài khoản (tên, email,
                mật khẩu), khi sử dụng dịch vụ (lịch trình, bài viết, bình luận) và khi liên hệ
                hỗ trợ. Chúng tôi cũng tự động thu thập dữ liệu sử dụng như địa chỉ IP, loại
                trình duyệt và trang bạn truy cập.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">2. Cách chúng tôi sử dụng thông tin</h2>
              <p className="mt-3">
                Thông tin của bạn được sử dụng để cung cấp và cải thiện dịch vụ, cá nhân hóa trải
                nghiệm, gửi thông báo liên quan đến tài khoản và phản hồi các yêu cầu hỗ trợ.
                Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">3. Chia sẻ thông tin</h2>
              <p className="mt-3">
                Chúng tôi chỉ chia sẻ thông tin của bạn với các nhà cung cấp dịch vụ tin cậy giúp
                vận hành nền tảng (lưu trữ đám mây, xử lý thanh toán, phân tích dữ liệu), khi có
                yêu cầu pháp lý hoặc khi bạn đồng ý rõ ràng.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">4. Bảo mật dữ liệu</h2>
              <p className="mt-3">
                Chúng tôi áp dụng các biện pháp bảo mật kỹ thuật và tổ chức phù hợp để bảo vệ
                thông tin cá nhân của bạn khỏi truy cập trái phép, mất mát hoặc tiết lộ. Tất cả
                dữ liệu được mã hóa khi truyền tải và lưu trữ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">5. Cookie và công nghệ theo dõi</h2>
              <p className="mt-3">
                Chúng tôi sử dụng cookie và các công nghệ tương tự để ghi nhớ tùy chọn của bạn,
                duy trì phiên đăng nhập và phân tích lưu lượng truy cập. Bạn có thể kiểm soát
                cookie thông qua cài đặt trình duyệt, nhưng một số tính năng có thể không hoạt
                động đúng nếu tắt cookie.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">6. Quyền của bạn</h2>
              <p className="mt-3">
                Bạn có quyền truy cập, sửa đổi hoặc xóa thông tin cá nhân của mình bất kỳ lúc
                nào thông qua phần cài đặt tài khoản. Bạn cũng có quyền yêu cầu xuất dữ liệu hoặc
                phản đối một số hình thức xử lý dữ liệu nhất định.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">7. Liên hệ</h2>
              <p className="mt-3">
                Nếu bạn có câu hỏi về Chính sách bảo mật này, vui lòng liên hệ qua{' '}
                <a href="/contact" className="text-primary hover:underline">
                  trang liên hệ
                </a>
                .
              </p>
            </section>
          </div>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { getLocale } from '@/lib/i18n';

export default async function TermsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h1 className="text-4xl font-bold text-text">Điều khoản dịch vụ</h1>
          <p className="mt-3 text-sm text-text-muted">Cập nhật lần cuối: tháng 8 năm 2026</p>

          <div className="mt-10 space-y-10 text-text-muted leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-text">1. Chấp nhận điều khoản</h2>
              <p className="mt-3">
                Bằng cách truy cập và sử dụng travelvietplaner, bạn đồng ý bị ràng buộc bởi các
                Điều khoản dịch vụ này. Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản
                này, bạn không được phép sử dụng dịch vụ của chúng tôi.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">2. Tài khoản người dùng</h2>
              <p className="mt-3">
                Bạn chịu trách nhiệm duy trì tính bảo mật của tài khoản và mật khẩu của mình. Bạn
                đồng ý thông báo ngay cho chúng tôi về bất kỳ việc sử dụng trái phép tài khoản của
                bạn. Chúng tôi không chịu trách nhiệm về bất kỳ tổn thất nào phát sinh từ việc
                không bảo mật thông tin tài khoản.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">3. Nội dung người dùng</h2>
              <p className="mt-3">
                Bằng cách đăng nội dung lên nền tảng, bạn cấp cho chúng tôi quyền không độc quyền,
                toàn cầu để sử dụng, hiển thị và phân phối nội dung đó trong phạm vi cung cấp dịch
                vụ. Bạn giữ lại quyền sở hữu đối với nội dung của mình.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">4. Hành vi bị cấm</h2>
              <p className="mt-3">
                Bạn đồng ý không sử dụng dịch vụ để đăng nội dung bất hợp pháp, gây hại, đe dọa,
                lạm dụng hoặc vi phạm quyền riêng tư của người khác; thu thập thông tin cá nhân của
                người dùng khác mà không có sự đồng ý; hoặc can thiệp vào hoạt động bình thường của
                dịch vụ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">5. Giới hạn trách nhiệm</h2>
              <p className="mt-3">
                Dịch vụ được cung cấp "nguyên trạng" mà không có bảo đảm. Chúng tôi không chịu
                trách nhiệm về bất kỳ thiệt hại gián tiếp, ngẫu nhiên hoặc hậu quả nào phát sinh
                từ việc sử dụng hoặc không thể sử dụng dịch vụ.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">6. Thay đổi điều khoản</h2>
              <p className="mt-3">
                Chúng tôi có quyền sửa đổi các điều khoản này bất kỳ lúc nào. Chúng tôi sẽ thông
                báo cho bạn về các thay đổi quan trọng qua email hoặc thông báo trên nền tảng. Việc
                tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực đồng nghĩa với việc bạn chấp
                nhận các điều khoản mới.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-text">7. Liên hệ</h2>
              <p className="mt-3">
                Nếu bạn có câu hỏi về Điều khoản dịch vụ này, vui lòng liên hệ với chúng tôi
                qua{' '}
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

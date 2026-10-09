'use client';

import { Suspense } from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { getLocale } from '@/lib/i18n';

const faqs = [
  {
    question: 'travelvietplaner hoạt động như thế nào?',
    answer:
      'Bạn mô tả chuyến đi mong muốn bằng ngôn ngữ tự nhiên — điểm đến, thời gian, sở thích và ngân sách. AI của chúng tôi sẽ phân tích và tạo lịch trình chi tiết theo ngày, bao gồm địa điểm, nhà hàng, khách sạn và bản đồ tuyến đường.',
  },
  {
    question: 'Tôi cần tạo tài khoản để sử dụng không?',
    answer:
      'Bạn có thể khám phá nền tảng mà không cần đăng ký. Tuy nhiên để tạo và lưu lịch trình cá nhân, chia sẻ với cộng đồng và theo dõi hướng dẫn viên, bạn cần tạo tài khoản miễn phí.',
  },
  {
    question: 'Sự khác biệt giữa tài khoản Miễn phí và Pro là gì?',
    answer:
      'Tài khoản Miễn phí cho phép tạo tối đa 3 lịch trình AI mỗi tháng và truy cập các tính năng cơ bản. Tài khoản Pro (99k/tháng) cung cấp lịch trình không giới hạn, xuất PDF, đặt tour tích hợp và ưu tiên hỗ trợ.',
  },
  {
    question: 'Làm sao để tôi trở thành hướng dẫn viên trên nền tảng?',
    answer:
      'Đăng ký tài khoản hướng dẫn viên, điền thông tin xác minh nghề nghiệp và chờ phê duyệt từ đội ngũ của chúng tôi. Sau khi được duyệt, bạn có thể tạo profile chuyên nghiệp, đăng tour và kết nối với du khách.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-text">{question}</span>
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <p className="pb-5 text-sm text-text-muted leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

function HelpContent() {
  const searchParams = useSearchParams();
  const locale = getLocale(Object.fromEntries(searchParams.entries()));
  return (

    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        <section className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h1 className="text-4xl font-bold text-text">Trung tâm hỗ trợ</h1>
          <p className="mt-3 text-text-muted">
            Tìm câu trả lời nhanh cho những câu hỏi thường gặp.
          </p>

          <div className="mt-10 rounded-xl border border-border bg-surface-1 px-6">
            {faqs.map((faq) => (
              <FaqItem key={faq.question} {...faq} />
            ))}
          </div>

          <p className="mt-8 text-sm text-text-muted text-center">
            Không tìm thấy câu trả lời?{' '}
            <a href="/contact" className="text-primary hover:underline">
              Liên hệ hỗ trợ
            </a>
          </p>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

export default function HelpPage() {
  return (
    <Suspense>
      <HelpContent />
    </Suspense>
  );
}

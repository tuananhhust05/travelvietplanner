'use client';

import { Suspense } from 'react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Textarea } from '@/components/ui/input';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getLocale } from '@/lib/i18n';

function ContactContent() {
  const searchParams = useSearchParams();
  const locale = getLocale(Object.fromEntries(searchParams.entries()));
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        <section className="mx-auto max-w-2xl px-4 py-20 md:px-6">
          <h1 className="text-4xl font-bold text-text">Liên hệ</h1>
          <p className="mt-3 text-text-muted">
            Có câu hỏi hay đề xuất? Chúng tôi rất muốn nghe từ bạn.
          </p>

          {sent ? (
            <div className="mt-10 rounded-xl border border-border bg-surface-1 p-8 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                ✓
              </div>
              <p className="text-lg font-semibold text-text">Đã gửi thành công!</p>
              <p className="mt-2 text-sm text-text-muted">
                Chúng tôi sẽ phản hồi trong vòng 1–2 ngày làm việc.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5 rounded-xl border border-border bg-surface-1 p-8"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="ban@example.com"
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-text">
                  Tiêu đề
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  placeholder="Tôi muốn hỏi về..."
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-text">
                  Nội dung
                </label>
                <Textarea
                  id="message"
                  required
                  maxLength={2000}
                  maxHeight={360}
                  placeholder="Mô tả chi tiết vấn đề hoặc câu hỏi của bạn..."
                  className="mt-1.5 bg-bg px-4 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-opacity hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Gửi tin nhắn
              </button>
            </form>
          )}
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense>
      <ContactContent />
    </Suspense>
  );
}

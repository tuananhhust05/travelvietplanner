import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { BookOpen } from 'lucide-react';
import { getLocale } from '@/lib/i18n';

export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main className="min-h-screen bg-bg">
        <section className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-center justify-center px-4 py-24 text-center md:px-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <BookOpen size={32} className="text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-text md:text-5xl">Blog</h1>
          <p className="mt-4 text-lg text-text-muted">Sắp ra mắt</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
            Chúng tôi đang chuẩn bị những bài viết hay về du lịch Việt Nam, mẹo lên kế hoạch
            và câu chuyện từ cộng đồng. Hãy theo dõi nhé!
          </p>
        </section>
      </main>
      <Footer locale={locale} />
    </>
  );
}

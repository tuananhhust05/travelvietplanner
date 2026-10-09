import type { Metadata } from 'next';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/marketing/Hero';
import { PlannerTeaser } from '@/components/marketing/PlannerTeaser';
import { FeedPreview } from '@/components/marketing/FeedPreview';
import { AudienceBento } from '@/components/marketing/AudienceBento';
import { DestinationGallery } from '@/components/marketing/DestinationGallery';
import { Testimonials } from '@/components/marketing/Testimonials';
import { CTABand } from '@/components/marketing/CTABand';
import { getLocale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Lên kế hoạch du lịch Việt Nam cùng AI',
  description:
    'Trợ lý AI lập kế hoạch du lịch Việt Nam — nhận lịch trình chi tiết theo ngày, khám phá điểm đến ẩn, kết nối cộng đồng du khách và hướng dẫn viên địa phương.',
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const locale = getLocale(await searchParams);
  return (
    <>
      <PublicNav locale={locale} />
      <main>
        {/* Hero renders the signature Living Vietnam Map as its centerpiece */}
        <Hero locale={locale} />
        <PlannerTeaser locale={locale} />
        <FeedPreview locale={locale} />
        <AudienceBento locale={locale} />
        <DestinationGallery locale={locale} />
        <Testimonials locale={locale} />
        <CTABand locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}

// The Living Vietnam Map is the hero centerpiece and already renders inside <Hero/>.
// This anchor keeps the section ordering explicit without duplicating the map.
function LivingVietnamMapSectionAnchor() {
  return null;
}

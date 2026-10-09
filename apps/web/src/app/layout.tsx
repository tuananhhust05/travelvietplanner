import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono, Playfair_Display } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { CursorEffect } from '@/components/effects/CursorEffect';
import './globals.css';

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://waki.autos'),
  title: {
    default: 'travelvietplaner — Lên kế hoạch du lịch Việt Nam cùng AI',
    template: '%s | travelvietplaner',
  },
  description:
    'Mạng xã hội du lịch và trợ lý AI lập kế hoạch cho Việt Nam. Tạo lịch trình cá nhân hóa, khám phá điểm đến ẩn, kết nối với hướng dẫn viên địa phương.',
  keywords: ['du lịch Việt Nam', 'lập kế hoạch du lịch', 'AI travel planner', 'Vietnam travel', 'lịch trình du lịch'],
  authors: [{ name: 'travelvietplaner' }],
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'travelvietplaner',
    title: 'travelvietplaner — Lên kế hoạch du lịch Việt Nam cùng AI',
    description: 'Mạng xã hội du lịch và trợ lý AI lập kế hoạch cho Việt Nam.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'travelvietplaner',
    description: 'Lên kế hoạch du lịch Việt Nam cùng AI',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" dir="ltr" className={`dark ${beVietnam.variable} ${jetbrains.variable} ${playfair.variable}`}>
      <body className="font-sans antialiased">
        <CursorEffect />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

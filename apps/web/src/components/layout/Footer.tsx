import Link from 'next/link';
import { t, type Locale } from '@/lib/i18n';
import { BrandLogo } from '@/components/layout/BrandLogo';

export function Footer({ locale = 'vi' }: { locale?: Locale }) {
  const cols: Array<{ head: string; links: Array<[string, string]> }> = [
    {
      head: t(locale, 'footer.product'),
      links: [
        ['/features', t(locale, 'nav.features')],
        ['/how-it-works', t(locale, 'nav.how')],
        ['/pricing', t(locale, 'nav.pricing')],
        ['/explore', t(locale, 'nav.explore')],
      ],
    },
    {
      head: t(locale, 'footer.audiences'),
      links: [
        ['/for-travelers', t(locale, 'account.traveler')],
        ['/for-agencies', t(locale, 'account.agency')],
        ['/for-guides', t(locale, 'account.guide')],
        ['/for-businesses', t(locale, 'account.business')],
      ],
    },
    {
      head: t(locale, 'footer.company'),
      links: [
        ['/about', 'About'],
        ['/blog', 'Blog'],
        ['/contact', 'Contact'],
        ['/help', 'Help'],
      ],
    },
    {
      head: t(locale, 'footer.legal'),
      links: [
        ['/legal/terms', 'Terms'],
        ['/legal/privacy', 'Privacy'],
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-surface-1">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-14 md:grid-cols-5 md:px-6">
        <div className="col-span-2 md:col-span-1">
          <div className="flex flex-col gap-2">
            <div>
              <BrandLogo />
            </div>
            <p className="mt-2 text-sm text-text-muted">{t(locale, 'app.tagline')}</p>
          </div>
        </div>
        {cols.map((col) => (
          <div key={col.head}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {col.head}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-text-muted transition-colors duration-base hover:text-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} travelvietplaner · Made for Vietnam travel
      </div>
    </footer>
  );
}

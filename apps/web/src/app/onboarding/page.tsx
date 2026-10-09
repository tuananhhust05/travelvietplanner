'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, PartyPopper, User, Briefcase, Building2, Map } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AddressPicker,
  addressValueLabel,
  type AddressValue,
} from '@/components/form/AddressPicker';
import { cn } from '@/lib/cn';
import { MeshBackground } from '@/components/effects/MeshBackground';
import { t, useLocale } from '@/lib/i18n';

const INTERESTS = ['Biển', 'Núi', 'Ẩm thực', 'Văn hóa', 'Phượt'] as const;
const STYLES = [
  { id: 'budget', label: 'Tiết kiệm', desc: 'Đi bụi, khám phá theo ngân sách nhỏ.' },
  { id: 'balanced', label: 'Cân bằng', desc: 'Kết hợp trải nghiệm và tiện nghi.' },
  { id: 'luxury', label: 'Sang trọng', desc: 'Nghỉ dưỡng cao cấp, dịch vụ trọn gói.' },
] as const;

const GUIDE_LANGUAGES = ['Tiếng Việt', 'English', '日本語', '한국어', 'Français', 'Deutsch', '中文'] as const;
const GUIDE_SPECIALTIES = ['Văn hóa & Lịch sử', 'Ẩm thực', 'Trekking & Phiêu lưu', 'Biển & Đảo', 'Đô thị & Hiện đại', 'Làng nghề & Thủ công'] as const;

const ACCOUNT_TYPES = [
  { id: 'traveler', label: 'Du khách', desc: 'Tôi muốn lên kế hoạch và khám phá Việt Nam.', icon: User },
  { id: 'guide', label: 'Hướng dẫn viên', desc: 'Tôi là HDV địa phương muốn kết nối với du khách.', icon: Map },
  { id: 'agency', label: 'Công ty lữ hành', desc: 'Tôi đại diện cho công ty du lịch / lữ hành.', icon: Briefcase },
  { id: 'business', label: 'Doanh nghiệp', desc: 'Tôi cung cấp dịch vụ du lịch (khách sạn, nhà hàng…).', icon: Building2 },
] as const;

interface Prefs {
  // traveler
  interests: string[];
  style: string;
  homeLocation: AddressValue;
  // guide
  languages: string[];
  specialties: string[];
  ratesPerDay: string;
  // agency / business
  orgName: string;
  website: string;
  phone: string;
  address: AddressValue;
  /** Số nhà / đường — phần không suy ra được từ dữ liệu ranh giới. */
  addressStreet: string;
  // google users
  accountType: string;
  displayName: string;
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromGoogle = searchParams.get('from') === 'google';
  const switched = searchParams.get('switched') === '1';
  const reduce = useReducedMotion();
  const locale = useLocale();

  // Detect account type from localStorage for switched mode
  const storedType = (() => {
    if (typeof window === 'undefined') return 'traveler';
    try {
      const u = JSON.parse(localStorage.getItem('tvp_user') ?? '{}');
      return (u.accountType as string) ?? 'traveler';
    } catch { return 'traveler'; }
  })();

  const [step, setStep] = useState(fromGoogle ? -1 : 0);
  const [prefs, setPrefs] = useState<Prefs>({
    interests: [],
    style: '',
    homeLocation: { province: '', commune: '' },
    languages: [],
    specialties: [],
    ratesPerDay: '',
    orgName: '',
    website: '',
    phone: '',
    address: { province: '', commune: '' },
    addressStreet: '',
    accountType: storedType,
    displayName: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Effective account type (from selection on step -1, or from stored value for switched/normal)
  const effectiveType = fromGoogle ? prefs.accountType : storedType;

  // Total steps varies by type
  const totalSteps = fromGoogle ? 5 : 4;
  const progressStep = fromGoogle ? step + 2 : step + 1;
  const progress = Math.round((progressStep / totalSteps) * 100);
  const isLast = step === 3;

  async function finishOnboarding() {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('tvp_token');
      if (token) {
        let updateData: Record<string, unknown> = {};

        if (effectiveType === 'guide') {
          updateData = {
            languages: prefs.languages.length ? prefs.languages : undefined,
            specialties: prefs.specialties.length ? prefs.specialties : undefined,
            ratesPerDay: prefs.ratesPerDay ? Number(prefs.ratesPerDay) : undefined,
          };
        } else if (effectiveType === 'agency' || effectiveType === 'business') {
          // Số nhà / đường ghép trước xã, phường và tỉnh đã chọn.
          const adminPart = addressValueLabel(prefs.address);
          const street = prefs.addressStreet.trim();
          const fullAddress = [street, adminPart].filter(Boolean).join(', ');
          updateData = {
            orgName: prefs.orgName || undefined,
            website: prefs.website || undefined,
            phone: prefs.phone || undefined,
            address: fullAddress || undefined,
          };
        } else {
          updateData = {
            interests: prefs.interests,
            travelStyle: prefs.style || undefined,
            location: addressValueLabel(prefs.homeLocation) || undefined,
          };
        }

        if (fromGoogle && prefs.accountType) updateData.accountType = prefs.accountType;
        if (fromGoogle && prefs.displayName) updateData.displayName = prefs.displayName;

        const updated = await api.updateProfile(updateData, token);
        const stored = localStorage.getItem('tvp_user');
        const existing = stored ? JSON.parse(stored) : {};
        localStorage.setItem('tvp_user', JSON.stringify({ ...existing, ...(updated as object) }));
      }
    } catch {
      // Non-blocking
    } finally {
      setIsSaving(false);
      router.push('/planner');
    }
  }

  function toggleInterest(v: string) {
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(v) ? p.interests.filter((i) => i !== v) : [...p.interests, v],
    }));
  }

  function toggleMulti(field: 'languages' | 'specialties', v: string) {
    setPrefs((p) => ({
      ...p,
      [field]: p[field].includes(v) ? p[field].filter((i) => i !== v) : [...p[field], v],
    }));
  }

  function next() { setStep((s) => Math.min(s + 1, 3)); }
  function back() { setStep((s) => Math.max(s - 1, fromGoogle ? -1 : 0)); }

  const slide = reduce
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };

  const isGuide = effectiveType === 'guide';
  const isOrg = effectiveType === 'agency' || effectiveType === 'business';

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-5 py-12">
      <MeshBackground variant="jade" />
      <div className="w-full max-w-lg">
        {!isLast && (
          <div className="mb-6">
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={t(locale, 'onboarding.progressLabel')}
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 30 }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-text-muted" aria-live="polite">
              Bước {progressStep} {t(locale, 'onboarding.progressOf')} {totalSteps}
            </p>
          </div>
        )}

        <Card className="overflow-hidden p-6 md:p-8">
          <AnimatePresence mode="wait" initial={false}>

            {/* Step -1: Google user — chọn loại tài khoản + tên hiển thị */}
            {step === -1 && (
              <motion.div
                key="s-1"
                {...slide}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="space-y-5"
              >
                <div>
                  <h1 className="text-2xl font-bold text-text text-balance">{t(locale, 'onboarding.welcome')}</h1>
                  <p className="mt-1 text-sm text-text-muted text-pretty">
                    {t(locale, 'onboarding.welcomeSub')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="displayName" className="text-sm font-medium text-text">
                    {t(locale, 'onboarding.displayName')}
                  </label>
                  <Input
                    id="displayName"
                    value={prefs.displayName}
                    onChange={(e) => setPrefs((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder={t(locale, 'onboarding.displayNamePlaceholder')}
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
                <div role="radiogroup" aria-label="Loại tài khoản" className="grid grid-cols-2 gap-2.5">
                  {ACCOUNT_TYPES.map(({ id, label, desc, icon: Icon }) => {
                    const on = prefs.accountType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPrefs((p) => ({ ...p, accountType: id }))}
                        className={cn(
                          'flex flex-col items-start gap-2 rounded-xl border p-4 text-left',
                          'transition-colors duration-base ease-standard',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          on ? 'border-primary bg-primary/10' : 'border-border bg-surface-1 hover:bg-surface-2',
                        )}
                      >
                        <span className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          on ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-text-muted',
                        )}>
                          <Icon size={16} aria-hidden />
                        </span>
                        <span>
                          <span className="block font-medium text-sm text-text">{label}</span>
                          <span className="block text-xs text-text-muted text-pretty leading-snug mt-0.5">{desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 0 — traveler: sở thích / guide: ngôn ngữ / org: tên tổ chức */}
            {step === 0 && (
              <motion.div key="s0" {...slide} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} className="space-y-5">
                {isGuide ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Bạn nói được ngôn ngữ nào?</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Giúp du khách tìm bạn dễ hơn.</p>
                    </div>
                    <div role="group" aria-label="Ngôn ngữ" className="flex flex-wrap gap-2.5">
                      {GUIDE_LANGUAGES.map((v) => {
                        const on = prefs.languages.includes(v);
                        return (
                          <motion.button key={v} type="button" aria-pressed={on} onClick={() => toggleMulti('languages', v)}
                            whileTap={reduce ? undefined : { scale: 0.9 }} animate={reduce ? undefined : { scale: on ? 1.05 : 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                            className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg', on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text-muted hover:text-text')}>
                            {on && <Check size={14} aria-hidden />}{v}
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                ) : isOrg ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Tên tổ chức của bạn?</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Tên hiển thị công khai trên hồ sơ.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="orgName" className="text-sm font-medium text-text">Tên công ty / tổ chức</label>
                      <Input id="orgName" value={prefs.orgName} onChange={(e) => setPrefs((p) => ({ ...p, orgName: e.target.value }))} placeholder="Ví dụ: Viettravel, Saigon Tourist…" maxLength={100} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">{t(locale, 'onboarding.interests')}</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">{t(locale, 'onboarding.interestsSub')}</p>
                    </div>
                    <div role="group" aria-label="Sở thích du lịch" className="flex flex-wrap gap-2.5">
                      {INTERESTS.map((v) => {
                        const on = prefs.interests.includes(v);
                        return (
                          <motion.button key={v} type="button" aria-pressed={on} onClick={() => toggleInterest(v)}
                            whileTap={reduce ? undefined : { scale: 0.9 }} animate={reduce ? undefined : { scale: on ? 1.05 : 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                            className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg', on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text-muted hover:text-text')}>
                            {on && <Check size={14} aria-hidden />}{v}
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 1 — traveler: phong cách / guide: specialties / org: website+phone */}
            {step === 1 && (
              <motion.div key="s1" {...slide} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} className="space-y-5">
                {isGuide ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Chuyên môn của bạn?</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Chọn những lĩnh vực bạn am hiểu nhất.</p>
                    </div>
                    <div role="group" aria-label="Chuyên môn" className="flex flex-wrap gap-2.5">
                      {GUIDE_SPECIALTIES.map((v) => {
                        const on = prefs.specialties.includes(v);
                        return (
                          <motion.button key={v} type="button" aria-pressed={on} onClick={() => toggleMulti('specialties', v)}
                            whileTap={reduce ? undefined : { scale: 0.9 }} animate={reduce ? undefined : { scale: on ? 1.05 : 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                            className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg', on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text-muted hover:text-text')}>
                            {on && <Check size={14} aria-hidden />}{v}
                          </motion.button>
                        );
                      })}
                    </div>
                  </>
                ) : isOrg ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Thông tin liên hệ</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Giúp khách hàng liên hệ với bạn.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label htmlFor="website" className="text-sm font-medium text-text">Website <span className="text-text-muted font-normal">(tuỳ chọn)</span></label>
                        <Input id="website" type="url" value={prefs.website} onChange={(e) => setPrefs((p) => ({ ...p, website: e.target.value }))} placeholder="https://yourcompany.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="phone" className="text-sm font-medium text-text">Số điện thoại</label>
                        <Input id="phone" type="tel" value={prefs.phone} onChange={(e) => setPrefs((p) => ({ ...p, phone: e.target.value }))} placeholder="0901 234 567" maxLength={30} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Phong cách chuyến đi</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Điều này giúp trợ lý AI cân đối ngân sách và lịch trình.</p>
                    </div>
                    <div role="radiogroup" aria-label="Phong cách chuyến đi" className="space-y-2.5">
                      {STYLES.map((s) => {
                        const on = prefs.style === s.id;
                        return (
                          <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setPrefs((p) => ({ ...p, style: s.id }))}
                            className={cn('flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg', on ? 'border-primary bg-primary/10' : 'border-border bg-surface-1 hover:bg-surface-2')}>
                            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-primary bg-primary text-primary-fg' : 'border-border')}>
                              {on && <Check size={12} aria-hidden />}
                            </span>
                            <span>
                              <span className="block font-medium text-text">{s.label}</span>
                              <span className="block text-sm text-text-muted text-pretty">{s.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* Step 2 — traveler: location / guide: rates / org: address */}
            {step === 2 && (
              <motion.div key="s2" {...slide} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} className="space-y-5">
                {isGuide ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Mức phí của bạn?</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Giá tham khảo cho một ngày dẫn tour.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="rates" className="text-sm font-medium text-text">Phí / ngày (VNĐ)</label>
                      <Input id="rates" type="number" min="0" value={prefs.ratesPerDay} onChange={(e) => setPrefs((p) => ({ ...p, ratesPerDay: e.target.value }))} placeholder="Ví dụ: 500000" />
                    </div>
                  </>
                ) : isOrg ? (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Địa chỉ văn phòng</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Địa chỉ hiển thị trên hồ sơ công ty.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label htmlFor="addressStreet" className="text-sm font-medium text-text">Số nhà / đường <span className="text-text-muted font-normal">(tuỳ chọn)</span></label>
                        {/* Street fragment only — the saved `address` is street + ", " +
                            admin label and is capped at 200 (auth.routes.ts:115). */}
                        <Input id="addressStreet" value={prefs.addressStreet} onChange={(e) => setPrefs((p) => ({ ...p, addressStreet: e.target.value }))} placeholder="Ví dụ: 123 Lê Lợi" maxLength={120} />
                      </div>
                      <AddressPicker
                        value={prefs.address}
                        onChange={(v) => setPrefs((p) => ({ ...p, address: v }))}
                        locale={locale}
                        idPrefix="org"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h1 className="text-2xl font-bold text-text text-balance">Bạn đang ở đâu?</h1>
                      <p className="mt-1 text-sm text-text-muted text-pretty">Chúng mình sẽ gợi ý điểm đến và chuyến đi gần bạn.</p>
                    </div>
                    <AddressPicker
                      value={prefs.homeLocation}
                      onChange={(v) => setPrefs((p) => ({ ...p, homeLocation: v }))}
                      locale={locale}
                      idPrefix="home"
                    />
                  </>
                )}
              </motion.div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <motion.div key="s3" {...slide} transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} className="flex flex-col items-center gap-4 py-4 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <PartyPopper size={30} aria-hidden />
                </span>
                <div>
                  <h1 className="text-2xl font-bold text-text text-balance">
                    {switched ? 'Hồ sơ đã được cập nhật!' : t(locale, 'onboarding.done')}
                  </h1>
                  <p className="mt-1 max-w-sm text-sm text-text-muted text-pretty">
                    {switched
                      ? 'Hồ sơ của bạn đã được chuyển đổi thành công. Bảng tin sẽ được cá nhân hóa theo loại tài khoản mới.'
                      : t(locale, 'onboarding.doneSub')}
                  </p>
                </div>
                <Button size="lg" className="mt-2 w-full" onClick={finishOnboarding} disabled={isSaving}>
                  {isSaving ? t(locale, 'common.loading') : t(locale, 'onboarding.goToFeed')}
                  <ArrowRight size={18} aria-hidden />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {!isLast && (
            <div className="mt-8 flex items-center gap-3">
              {step > (fromGoogle ? -1 : 0) && (
                <Button variant="outline" size="lg" onClick={back} className="shrink-0">
                  <ArrowLeft size={18} aria-hidden />
                  {t(locale, 'auth.back')}
                </Button>
              )}
              <Button
                size="lg"
                onClick={next}
                className="flex-1"
                disabled={step === -1 && !prefs.displayName.trim()}
              >
                {t(locale, 'auth.next')}
                <ArrowRight size={18} aria-hidden />
              </Button>
            </div>
          )}
        </Card>

        {!isLast && (
          <button
            type="button"
            onClick={() => router.push('/planner')}
            className="mx-auto mt-5 block text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t(locale, 'common.skip')}
          </button>
        )}
      </div>
    </main>
  );
}

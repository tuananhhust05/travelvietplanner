'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AlertCircle, ArrowLeft, ArrowRight,
  User, Mail, Lock, Quote,
  Compass, Sparkles, Mountain, TreePalm,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AccountTypeCards, type AccountType } from '@/components/auth/AccountTypeCards';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { t } from '@/lib/i18n';

// ─── Animated left panel (jade theme) ─────────────────────────────────────

const HIGHLIGHTS = [
  { icon: Mountain, label: 'Hà Giang Loop', sub: 'Trekking & Homestay' },
  { icon: TreePalm, label: 'Phú Quốc', sub: 'Biển đảo nhiệt đới' },
  { icon: Compass, label: 'Tây Nguyên', sub: 'Cà phê & Văn hóa' },
];

function AnimatedRegisterPanel({ reduce }: { reduce: boolean | null }) {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <aside className="relative hidden md:flex flex-col justify-between p-10 overflow-hidden">
      {/* Background gradient — jade/teal */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-800" />
      <span aria-hidden className="absolute -top-32 -right-24 -z-10 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <span aria-hidden className="absolute -bottom-20 -left-16 -z-10 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />
      <span aria-hidden className="absolute top-1/2 right-1/4 -z-10 h-48 w-48 rounded-full bg-cyan-300/10 blur-2xl" />

      <Link href="/" className="text-xl font-bold text-white/90 tracking-tight hover:text-white transition-colors">
        travelvietplaner
      </Link>

      <motion.div
        variants={reduce ? undefined : containerVariants}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="space-y-6"
      >
        <motion.div variants={reduce ? undefined : itemVariants} className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
            <Sparkles size={11} />
            Tham gia miễn phí
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight max-w-xs text-balance">
            Tạo tài khoản và bắt đầu khám phá Việt Nam.
          </h2>
          <p className="text-emerald-200/70 text-sm">
            Lên kế hoạch, chia sẻ và kết nối cùng cộng đồng du lịch.
          </p>
        </motion.div>

        {/* Destination highlight cards */}
        <motion.div variants={reduce ? undefined : itemVariants} className="space-y-2.5">
          {HIGHLIGHTS.map(({ icon: Icon, label, sub }, i) => (
            <motion.div
              key={label}
              initial={reduce ? undefined : { opacity: 0, x: -12 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.09, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/25 text-emerald-300">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-white/60">{sub}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Quote */}
        <motion.figure
          variants={reduce ? undefined : itemVariants}
          className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
        >
          <Quote size={15} className="mb-2 text-emerald-300" aria-hidden />
          <blockquote className="text-sm leading-relaxed text-white/90">
            Chia sẻ lịch trình cho nhóm bạn dễ dàng, mọi người đều biết cần chuẩn bị gì.
          </blockquote>
          <figcaption className="mt-2 text-xs text-white/55">Minh Khoa — backpacker, TP.HCM</figcaption>
        </motion.figure>
      </motion.div>

      <motion.p
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-xs text-white/45"
      >
        Hạ Long · Hội An · Hà Giang · Đà Lạt · Phong Nha · Ninh Bình
      </motion.p>
    </aside>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  const steps = [
    { num: 1, label: 'Loại tài khoản' },
    { num: 2, label: 'Thông tin cá nhân' },
  ];

  return (
    <div className="flex items-center gap-2" aria-label={`Bước ${step} trong 2`}>
      {steps.map(({ num, label }, idx) => {
        const isActive = num === step;
        const isDone = num < step;
        return (
          <div key={num} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <motion.div
                animate={
                  isActive
                    ? { scale: 1.05 }
                    : { scale: 1 }
                }
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-fg shadow-sm shadow-primary/30'
                    : isDone
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-3 text-text-muted'
                }`}
              >
                {num}
              </motion.div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  isActive ? 'text-text' : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-px w-8 transition-colors duration-300 ${
                  step > 1 ? 'bg-primary/50' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Register form data ────────────────────────────────────────────────────

interface RegisterForm {
  accountType: AccountType;
  displayName: string;
  email: string;
  password: string;
}

const EMPTY: RegisterForm = {
  accountType: 'traveler',
  displayName: '',
  email: '',
  password: '',
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<RegisterForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function upd<K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        accountType: form.accountType,
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      };
      const session = await api.register(payload);
      localStorage.setItem('tvp_token', session.accessToken);
      localStorage.setItem('tvp_refresh', session.refreshToken);
      document.cookie = `tvp_token=${session.accessToken}; path=/; max-age=86400; SameSite=Lax`;
      try {
        const { user } = await api.getMe(session.accessToken);
        localStorage.setItem('tvp_user', JSON.stringify(user));
      } catch {
        // Non-blocking — redirect proceeds even if user fetch fails
      }
      router.push('/onboarding');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const slide = reduce
    ? { initial: false as const, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };

  function iconClass(field: string) {
    return `absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150 ${
      focusedField === field ? 'text-primary' : 'text-text-muted'
    }`;
  }

  return (
    <main className="grid min-h-screen bg-bg md:grid-cols-2">
      <AnimatedRegisterPanel reduce={reduce} />

      <div className="relative flex flex-col items-center justify-center px-5 py-12 md:px-10 bg-bg">
        {/* Subtle background glows */}
        <span aria-hidden className="absolute top-0 right-0 -z-0 h-72 w-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <span aria-hidden className="absolute bottom-0 left-0 -z-0 h-56 w-56 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-7 md:hidden">
            <Link href="/" className="text-lg font-bold text-primary">
              travelvietplaner
            </Link>
          </div>

          {/* Step indicator */}
          <div className="mb-5">
            <StepIndicator step={step} />
          </div>

          <h1 className="text-2xl font-bold text-text text-balance">{t('vi', 'auth.register')}</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            {step === 1 ? 'Chọn loại tài khoản phù hợp với bạn.' : 'Điền thông tin để hoàn tất đăng ký.'}
          </p>

          {/* Glassmorphism card */}
          <div className="mt-5 rounded-2xl border border-border/60 bg-surface-1/80 backdrop-blur-md shadow-lg shadow-black/5 p-6">
            {/* Google button — show on step 1 only */}
            {step === 1 && (
              <>
                <GoogleSignInButton />
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-surface-1 px-2.5 text-text-muted font-medium">hoặc đăng ký với email</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={submit} className="space-y-5" noValidate>
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger overflow-hidden"
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    {...slide}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-4"
                  >
                    <AccountTypeCards
                      value={form.accountType}
                      onChange={(v) => upd('accountType', v)}
                      className="gap-3"
                    />
                    <Button
                      type="button"
                      size="lg"
                      className="w-full"
                      onClick={() => setStep(2)}
                    >
                      {t('vi', 'auth.next')}
                      <ArrowRight size={18} aria-hidden />
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    {...slide}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="space-y-4"
                  >
                    {/* Display name */}
                    <div className="space-y-1.5">
                      <label htmlFor="displayName" className="text-sm font-medium text-text">
                        {t('vi', 'auth.displayName')}
                      </label>
                      <div className="relative">
                        <User size={16} aria-hidden className={iconClass('displayName')} />
                        <Input
                          id="displayName"
                          autoComplete="name"
                          value={form.displayName}
                          onChange={(e) => upd('displayName', e.target.value)}
                          onFocus={() => setFocusedField('displayName')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Nguyễn Minh Anh"
                          required
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-sm font-medium text-text">
                        {t('vi', 'auth.email')}
                      </label>
                      <div className="relative">
                        <Mail size={16} aria-hidden className={iconClass('email')} />
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => upd('email', e.target.value)}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="ban@email.com"
                          required
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="password" className="text-sm font-medium text-text">
                        {t('vi', 'auth.password')}
                      </label>
                      <div className="relative">
                        <Lock size={16} aria-hidden className={iconClass('password')} />
                        <Input
                          id="password"
                          type="password"
                          autoComplete="new-password"
                          value={form.password}
                          onChange={(e) => upd('password', e.target.value)}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Tối thiểu 8 ký tự"
                          minLength={8}
                          required
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setStep(1)}
                        className="shrink-0"
                      >
                        <ArrowLeft size={18} aria-hidden />
                        {t('vi', 'auth.back')}
                      </Button>
                      <Button type="submit" size="lg" loading={loading} className="flex-1">
                        {loading ? t('vi', 'common.loading') : t('vi', 'auth.register')}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-text-muted">
            {t('vi', 'auth.haveAccount')}{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {t('vi', 'auth.login')}
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

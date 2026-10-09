'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Mail, Lock, MapPin, Star, Users, TrendingUp, Quote } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { t } from '@/lib/i18n';

// ─── Animated left panel ───────────────────────────────────────────────────

const DESTINATIONS = [
  { name: 'Hà Giang', tag: 'Trekking', rating: '4.9', color: 'from-emerald-500/90 to-teal-600/90' },
  { name: 'Hội An', tag: 'Di sản UNESCO', rating: '4.8', color: 'from-amber-500/90 to-orange-500/90' },
  { name: 'Đà Lạt', tag: 'Cao nguyên', rating: '4.7', color: 'from-violet-500/90 to-purple-600/90' },
];

const STATS = [
  { icon: TrendingUp, label: 'chuyến đi đã lên kế hoạch', value: '10,000+' },
  { icon: MapPin, label: 'tỉnh thành', value: '34' },
  { icon: Star, label: 'đánh giá trung bình', value: '4.9★' },
];

function AnimatedLoginPanel({ reduce }: { reduce: boolean | null }) {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <aside className="relative hidden md:flex flex-col justify-between p-10 overflow-hidden">
      {/* Background gradient */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-700" />
      {/* Decorative blobs */}
      <span aria-hidden className="absolute -top-28 -right-28 -z-10 h-96 w-96 rounded-full bg-yellow-400/20 blur-3xl" />
      <span aria-hidden className="absolute -bottom-24 -left-20 -z-10 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl" />
      <span aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-64 w-64 rounded-full bg-orange-300/10 blur-2xl" />

      {/* Logo */}
      <Link href="/" className="text-xl font-bold text-white/90 tracking-tight hover:text-white transition-colors">
        travelvietplaner
      </Link>

      {/* Floating destination cards */}
      <motion.div
        variants={reduce ? undefined : containerVariants}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'visible'}
        className="space-y-6"
      >
        {/* Tagline */}
        <motion.div variants={reduce ? undefined : itemVariants} className="space-y-2">
          <h2 className="text-3xl font-bold text-white leading-tight max-w-xs text-balance">
            Hành trình Việt Nam của bạn đang chờ.
          </h2>
          <p className="text-amber-200/80 text-sm">Lên kế hoạch thông minh, trải nghiệm trọn vẹn.</p>
        </motion.div>

        {/* Destination preview cards */}
        <motion.div variants={reduce ? undefined : itemVariants} className="grid grid-cols-3 gap-2">
          {DESTINATIONS.map((dest, i) => (
            <motion.div
              key={dest.name}
              initial={reduce ? undefined : { opacity: 0, y: 16 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl bg-gradient-to-br ${dest.color} p-3 border border-white/15 backdrop-blur-sm`}
            >
              <p className="font-semibold text-white text-sm leading-tight">{dest.name}</p>
              <p className="text-white/70 text-xs mt-0.5">{dest.tag}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <Star size={10} className="fill-yellow-300 text-yellow-300" />
                <span className="text-yellow-200 text-xs font-medium">{dest.rating}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonial quote */}
        <motion.figure
          variants={reduce ? undefined : itemVariants}
          className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
        >
          <Quote size={16} className="mb-2 text-amber-300" aria-hidden />
          <blockquote className="text-sm leading-relaxed text-white/90">
            Mình lên lịch trình Hà Giang 4 ngày chỉ trong một buổi tối, rồi chia sẻ ngay cho nhóm bạn cùng đi. Quá tiện.
          </blockquote>
          <figcaption className="mt-2 text-xs text-white/60">Thu Trang — phượt thủ, Hà Nội</figcaption>
        </motion.figure>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="grid grid-cols-3 gap-3"
      >
        {STATS.map(({ icon: Icon, value, label }) => (
          <div key={value} className="rounded-xl bg-black/20 border border-white/10 p-3 text-center">
            <Icon size={14} className="mx-auto mb-1 text-amber-300" />
            <p className="text-white font-bold text-base leading-none">{value}</p>
            <p className="text-white/60 text-xs mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </motion.div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await api.login(email, password);
      localStorage.setItem('tvp_token', session.accessToken);
      localStorage.setItem('tvp_refresh', session.refreshToken);
      document.cookie = `tvp_token=${session.accessToken}; path=/; max-age=86400; SameSite=Lax`;
      try {
        const { user } = await api.getMe(session.accessToken);
        localStorage.setItem('tvp_user', JSON.stringify(user));
      } catch {
        // Non-blocking — header will fall back to token-only state
      }
      router.push('/planner');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-bg md:grid-cols-2">
      <AnimatedLoginPanel reduce={reduce} />

      <div className="relative flex flex-col items-center justify-center px-5 py-12 md:px-10 bg-bg">
        {/* Subtle background blobs for right panel */}
        <span aria-hidden className="absolute top-0 right-0 -z-0 h-72 w-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <span aria-hidden className="absolute bottom-0 left-0 -z-0 h-56 w-56 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="mb-7 md:hidden">
            <Link href="/" className="text-lg font-bold text-primary">
              travelvietplaner
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-text">{t('vi', 'auth.login')}</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Đăng nhập để tiếp tục lên kế hoạch và chia sẻ chuyến đi.
          </p>

          {/* Glassmorphism card */}
          <div className="mt-6 rounded-2xl border border-border/60 bg-surface-1/80 backdrop-blur-md shadow-lg shadow-black/5 p-6">
            <GoogleSignInButton />

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface-1 px-2.5 text-text-muted font-medium">hoặc đăng nhập với email</span>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
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

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-text">
                  {t('vi', 'auth.email')}
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    aria-hidden
                    className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150 ${
                      focusedField === 'email' ? 'text-primary' : 'text-text-muted'
                    }`}
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="ban@email.com"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-text">
                  {t('vi', 'auth.password')}
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    aria-hidden
                    className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-150 ${
                      focusedField === 'password' ? 'text-primary' : 'text-text-muted'
                    }`}
                  />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••"
                    required
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="w-full mt-1"
              >
                {loading ? t('vi', 'common.loading') : t('vi', 'auth.login')}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-text-muted">
            {t('vi', 'auth.noAccount')}{' '}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {t('vi', 'auth.register')}
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

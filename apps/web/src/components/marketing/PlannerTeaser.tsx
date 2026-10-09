'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t, type Locale } from '@/lib/i18n';

interface Bubble {
  role: 'user' | 'assistant';
  text: string;
}

const CONVERSATION: readonly Bubble[] = [
  {
    role: 'user',
    text: 'Mình có 4 ngày, đi xe máy từ Hà Giang. Chưa đến Đồng Văn lần nào, muốn đi vòng cung cực Bắc nhưng không biết bắt đầu từ đâu.',
  },
  {
    role: 'assistant',
    text: 'Ngày 1 đi Quản Bạ — Yên Minh, dừng đèo Mã Pí Lèng buổi chiều để tránh nắng. Ngày 2 dành cả ngày ở Đồng Văn: chợ cũ buổi sáng, cột cờ Lũng Cú chiều. Ngày 3 xuống Mèo Vạc qua sông Nho Quế, chỗ này cảnh đẹp nhất cung đường. Ngày 4 về Hà Giang theo đường tắt qua Mậu Duệ để tránh lặp lại.',
  },
  {
    role: 'user',
    text: 'Có homestay nào ở Đồng Văn nhìn ra thung lũng không, giá tầm trung thôi?',
  },
];

export function PlannerTeaser({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const [shown, setShown] = useState(reduce ? CONVERSATION.length : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setShown(CONVERSATION.length);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= CONVERSATION.length) clearInterval(id);
    }, 900);
    return () => clearInterval(id);
  }, [inView, reduce]);

  return (
    <section
      aria-label={t(locale, 'planner.title')}
      className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"
    >
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t(locale, 'planner.title')}
          </span>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            Kể cho trợ lý nghe, nhận lịch trình theo ngày
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-text-muted">
            Không cần biết trước muốn đi đâu. Kể hoàn cảnh — bao nhiêu ngày,
            đi một mình hay theo nhóm, thích núi hay biển — trợ lý dựng lịch
            trình cụ thể, có địa chỉ ăn uống và chỗ nghỉ thực tế.
          </p>
        </div>

        {/* Faux chat panel */}
        <div
          ref={ref}
          className="rounded-2xl border border-white/10 bg-surface-1/60 p-4 shadow-e2 backdrop-blur-xl sm:p-5"
          aria-label="Ví dụ minh hoạ cuộc trò chuyện với trợ lý"
        >
          <div className="flex flex-col gap-3">
            {CONVERSATION.slice(0, shown).map((b, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 380, damping: 26 }
                }
                className={cn(
                  'flex items-end gap-2',
                  b.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    b.role === 'user'
                      ? 'bg-surface-3 text-text'
                      : 'bg-primary/15 text-primary',
                  )}
                >
                  {b.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </span>
                <p
                  className={cn(
                    'max-w-[80%] text-pretty rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    b.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-fg'
                      : 'rounded-bl-sm bg-surface-2 text-text',
                  )}
                >
                  {b.text}
                </p>
              </motion.div>
            ))}

            {/* Thinking indicator while more bubbles remain */}
            {!reduce && shown > 0 && shown < CONVERSATION.length && (
              <div className="flex items-center gap-1.5 pl-10 text-text-muted">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-text-muted"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: d * 0.2,
                    }}
                  />
                ))}
                <span className="ml-1 text-xs">{t(locale, 'planner.thinking')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

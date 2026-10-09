'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Heart, MessageCircle, Bookmark } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { t, type Locale } from '@/lib/i18n';

interface Post {
  author: string;
  handle: string;
  accountType: 'traveler' | 'agency' | 'business' | 'guide';
  place: string;
  caption: string;
  cover: string;
  likes: number;
  comments: number;
}

const POSTS: readonly Post[] = [
  {
    author: 'Mai Linh',
    handle: '@mailinh.travel',
    accountType: 'traveler',
    place: 'Hội An',
    caption: 'Đêm rằm phố cổ, đèn lồng thả trôi trên sông Hoài. Đẹp không lời nào tả nổi.',
    cover: 'linear-gradient(135deg,#eab308 0%,#f59e0b 45%,#ec4899 100%)',
    likes: 248,
    comments: 31,
  },
  {
    author: 'Đặng Quốc Huy',
    handle: '@huy.guide',
    accountType: 'guide',
    place: 'Sa Pa',
    caption: 'Trek Fansipan mùa mây. Sương giăng kín Ô Quy Hồ, đoàn lên đỉnh lúc bình minh.',
    cover: 'linear-gradient(135deg,#059669 0%,#10b981 40%,#6ee7b0 100%)',
    likes: 176,
    comments: 22,
  },
  {
    author: 'Sông Hàn Boutique',
    handle: '@songhan.danang',
    accountType: 'business',
    place: 'Đà Nẵng',
    caption: 'Phòng hướng sông Hàn, ban công đón nắng sớm. Ưu đãi mùa thu cho khách đặt trực tiếp.',
    cover: 'linear-gradient(135deg,#3b82f6 0%,#10b981 55%,#eab308 100%)',
    likes: 312,
    comments: 44,
  },
] as const;

export function FeedPreview({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label={t(locale, 'feed.title')}
      className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"
    >
      <div className="mb-10 max-w-lg">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t(locale, 'feed.title')}
        </span>
        <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          Nơi mọi hành trình được kể lại
        </h2>
        <p className="mt-3 text-pretty text-lg leading-relaxed text-text-muted">
          Theo dõi người du lịch, hướng dẫn viên và các điểm lưu trú. Lấy cảm
          hứng thật từ những chuyến đi thật.
        </p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {POSTS.map((post, i) => (
          <motion.li
            key={post.handle}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.45, delay: i * 0.06, ease: [0, 0, 0.2, 1] }
            }
          >
            <article className="group h-full overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-e2">
              {/* Gradient editorial cover */}
              <div
                className="relative h-44 w-full"
                style={{ backgroundImage: post.cover }}
                role="img"
                aria-label={`Ảnh bìa: ${post.place}`}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"
                />
                <Badge
                  tone="accent"
                  className="absolute left-3 top-3 bg-black/40 text-white backdrop-blur-sm"
                >
                  {post.place}
                </Badge>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={post.author} accountType={post.accountType} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">
                      {post.author}
                    </p>
                    <p className="truncate text-xs text-text-muted">{post.handle}</p>
                  </div>
                </div>

                <p className="mt-3 text-pretty text-sm leading-relaxed text-text-muted">
                  {post.caption}
                </p>

                <div className="mt-4 flex items-center gap-4 text-text-muted">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <Heart className="h-4 w-4" aria-hidden />
                    {post.likes}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    {post.comments}
                  </span>
                  <Bookmark className="ml-auto h-4 w-4" aria-hidden />
                </div>
              </div>
            </article>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

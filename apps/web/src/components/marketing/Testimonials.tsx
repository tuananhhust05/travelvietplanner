'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { t, type Locale } from '@/lib/i18n';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  accountType: 'traveler' | 'agency' | 'business' | 'guide';
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      'Mình hỏi một câu về 5 ngày ở Cà Mau, trợ lý trả về lịch trình chia theo ngày, có cả tên quán ăn và giờ nước lên xuống ở rừng đước. Trước đó mình google mãi không ra.',
    name: 'Nguyễn Thu Hà',
    role: 'Người du lịch · Hà Nội',
    accountType: 'traveler',
  },
  {
    quote:
      'Trước đây khách toàn liên hệ qua Zalo rồi mất dấu. Từ khi có hồ sơ trên này, họ đọc đủ thông tin tour, xem đánh giá thật, rồi mới nhắn — tỉ lệ chốt cao hơn hẳn.',
    name: 'Trần Minh Đức',
    role: 'Chủ đơn vị lữ hành · Đà Nẵng',
    accountType: 'agency',
  },
  {
    quote:
      'Mình dẫn tour Sa Pa đã 6 năm nhưng khách cũ giới thiệu khách mới chậm lắm. Hồ sơ ở đây có ảnh, có đánh giá của từng đoàn, khách mới nhìn vào là tin ngay — không cần mình tự quảng cáo.',
    name: 'Lò Thị Sương',
    role: 'Hướng dẫn viên · Sa Pa',
    accountType: 'guide',
  },
] as const;

export function Testimonials({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="Cảm nhận người dùng"
      className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"
    >
      <div className="mb-10 max-w-lg">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          Cảm nhận
        </span>
        <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          Người đi, người dẫn tour, người làm khách sạn — cùng dùng một nơi
        </h2>
      </div>

      <ul className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((item, i) => (
          <motion.li
            key={item.name}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.45, delay: i * 0.06, ease: [0, 0, 0.2, 1] }
            }
          >
            <figure className="flex h-full flex-col rounded-2xl border border-border bg-surface-1 p-6 shadow-e2">
              <Quote className="h-6 w-6 text-primary" aria-hidden />
              <blockquote className="mt-4 flex-1 text-pretty text-base leading-relaxed text-text">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Avatar name={item.name} accountType={item.accountType} size={40} />
                <div>
                  <p className="text-sm font-semibold text-text">{item.name}</p>
                  <p className="text-xs text-text-muted">{item.role}</p>
                </div>
              </figcaption>
            </figure>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

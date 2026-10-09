import Link from 'next/link';
import { Quote } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface BrandPanelProps {
  valueLine: string;
  className?: string;
}

export function BrandPanel({ valueLine, className }: BrandPanelProps) {
  return (
    <aside
      className={cn(
        'relative hidden flex-col justify-between overflow-hidden p-10 md:flex',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-800 via-teal-800 to-cyan-900"
      />
      <span
        aria-hidden
        className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl"
      />
      <span
        aria-hidden
        className="absolute -bottom-20 -left-16 -z-10 h-64 w-64 rounded-full bg-secondary/25 blur-3xl"
      />

      <Link href="/" className="text-lg font-bold text-white">
        travelvietplaner
      </Link>

      <div className="space-y-6">
        <h2 className="max-w-sm text-3xl font-bold leading-tight text-white text-balance">
          {valueLine}
        </h2>

        <figure className="max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
          <Quote size={18} className="mb-2 text-accent" aria-hidden />
          <blockquote className="text-[15px] leading-relaxed text-white/90 text-pretty">
            Mình lên lịch trình Hà Giang 4 ngày chỉ trong một buổi tối, rồi chia sẻ ngay
            cho nhóm bạn cùng đi. Quá tiện.
          </blockquote>
          <figcaption className="mt-3 text-sm text-white/70">
            Thu Trang — phượt thủ, Hà Nội
          </figcaption>
        </figure>
      </div>

      <p className="text-sm text-white/60">
        Hạ Long · Hội An · Hà Giang · Đà Lạt · Phong Nha
      </p>
    </aside>
  );
}

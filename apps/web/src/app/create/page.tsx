'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { AddressPicker, type AddressValue } from '@/components/form/AddressPicker';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type Lang = 'vi' | 'en';

export default function CreatePostPage() {
  const [body, setBody] = useState('');
  const [address, setAddress] = useState<AddressValue>({ province: '', commune: '' });
  const [lang, setLang] = useState<Lang>('vi');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess(false);
    setError(null);

    const token =
      typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;

    if (!token) {
      setError('Bạn chưa đăng nhập. Vui lòng đăng nhập để đăng bài.');
      return;
    }

    if (!body.trim()) {
      setError('Nội dung bài viết không được để trống.');
      return;
    }

    if (address.province && !address.commune) {
      setError('Vui lòng chọn xã / phường.');
      return;
    }

    setLoading(true);
    try {
      await api.createPost(
        {
          body: body.trim(),
          address: address.commune ? address : undefined,
          lang,
        },
        token,
      );
      setSuccess(true);
      setBody('');
      setAddress({ province: '', commune: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-bold text-text">Tạo bài viết mới</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="overflow-hidden p-0">
            {/* Cover image placeholder */}
            <div
              aria-label="Thêm ảnh bìa"
              role="button"
              tabIndex={0}
              className="relative flex aspect-video w-full cursor-default items-center justify-center bg-gradient-to-br from-emerald-400 via-teal-500 to-amber-400 select-none"
            >
              <div className="flex flex-col items-center gap-2 text-white/90">
                <Camera size={32} aria-hidden />
                <span className="text-sm font-medium">Thêm ảnh bìa</span>
              </div>
            </div>

            <div className="space-y-4 p-4">
              {/* Body textarea */}
              {/* maxLength matches posts.routes.ts `body: z.string().max(5000)` — without it
                  a long post was only rejected after submitting. */}
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Chia sẻ chuyến đi của bạn..."
                maxLength={5000}
                maxHeight={480}
                className="min-h-[180px] px-4 py-3 text-sm"
              />

              {/* Địa điểm — chọn tỉnh/thành phố rồi xã/phường */}
              <fieldset className="space-y-3">
                <legend className="mb-1 text-sm font-medium text-text">
                  Địa điểm <span className="font-normal text-text-muted">(tuỳ chọn)</span>
                </legend>
                <AddressPicker value={address} onChange={setAddress} idPrefix="create" />
              </fieldset>

              {/* Language toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">Ngôn ngữ:</span>
                {(['vi', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-medium transition-colors duration-base',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      lang === l
                        ? 'bg-primary text-primary-fg'
                        : 'border border-border bg-surface-2 text-text-muted hover:text-text',
                    )}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Feedback messages */}
          {success && (
            <p
              role="status"
              className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400"
            >
              Đăng thành công!
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            Đăng bài
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

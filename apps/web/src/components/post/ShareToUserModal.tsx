'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Search, Send, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { postUrl } from '@/lib/site';

export interface ShareToUserModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  postBody?: string;
}

interface UserResult {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  accountType?: string;
}

function Avatar({ src, displayName }: { src?: string | null; displayName: string }) {
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src.startsWith('/') ? src : src}
        alt={displayName}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-text-muted"
    >
      {initials || '?'}
    </span>
  );
}

export function ShareToUserModal({
  open,
  onClose,
  postId,
  postBody,
}: ShareToUserModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setError(null);
      setSentTo(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.searchUsers(trimmed, 10);
        setResults((data as { items: UserResult[] }).items ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  async function handleSend(user: UserResult) {
    if (sending) return;
    setSending(true);
    setError(null);

    try {
      const conv = await api.createConversation(user._id) as { _id: string };
      await api.sendMessage(conv._id, '', {
        type: 'link',
        attachments: [],
        linkPreview: {
          url: postUrl(postId),
          title: postBody?.slice(0, 80) || 'Bài viết',
          description: '',
          image: null,
        },
      });
      setSentTo(user._id);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không thể gửi. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="share-user-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            key="share-user-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm bg-surface-1 rounded-2xl shadow-e3 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-to-user-title"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h2
                id="share-to-user-title"
                className="text-base font-semibold text-text"
              >
                Gửi tới
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  'text-text-muted hover:bg-surface-2 hover:text-text transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:pointer-events-none disabled:opacity-60',
                )}
                aria-label="Đóng"
              >
                <X size={17} aria-hidden />
              </button>
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative flex items-center">
                <Search
                  size={15}
                  className="absolute left-3 text-text-muted pointer-events-none"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  type="search"
                  placeholder="Tìm người dùng..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={sending}
                  className={cn(
                    'w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 py-2',
                    'text-sm text-text placeholder:text-text-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  )}
                  aria-label="Tìm kiếm người dùng"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="min-h-[160px] max-h-[280px] overflow-y-auto px-2 pb-3">
              {searching && (
                <div className="flex items-center justify-center py-10">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
                  <span className="sr-only">Đang tìm kiếm...</span>
                </div>
              )}

              {!searching && query.trim().length >= 1 && results.length === 0 && (
                <p className="py-10 text-center text-sm text-text-muted">
                  Không tìm thấy người dùng
                </p>
              )}

              {!searching && query.trim().length === 0 && (
                <p className="py-10 text-center text-sm text-text-muted">
                  Nhập tên hoặc @handle để tìm kiếm
                </p>
              )}

              {!searching && results.length > 0 && (
                <ul role="list" className="space-y-0.5 pt-1">
                  {results.map((user) => {
                    const isSent = sentTo === user._id;
                    return (
                      <li key={user._id}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => handleSend(user)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5',
                            'hover:bg-surface-2 transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'disabled:pointer-events-none disabled:opacity-60',
                          )}
                          aria-label={`Gửi tới ${user.displayName}`}
                        >
                          <Avatar src={user.avatarUrl} displayName={user.displayName} />
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-medium text-text leading-tight">
                              {user.displayName}
                            </p>
                            <p className="truncate text-xs text-text-muted leading-tight">
                              @{user.handle}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 flex items-center justify-center h-8 w-8 rounded-full transition-colors',
                              isSent
                                ? 'bg-green-500/15 text-green-500'
                                : 'bg-primary/10 text-primary',
                            )}
                            aria-hidden
                          >
                            {isSent ? (
                              <Check size={15} />
                            ) : sending ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                            ) : (
                              <Send size={14} />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {(error || sentTo) && (
              <div
                className={cn(
                  'mx-4 mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm',
                  sentTo
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                    : 'bg-danger/10 text-danger',
                )}
                role="alert"
              >
                {sentTo ? (
                  <>
                    <Check size={14} aria-hidden />
                    Đã gửi!
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} aria-hidden />
                    {error}
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

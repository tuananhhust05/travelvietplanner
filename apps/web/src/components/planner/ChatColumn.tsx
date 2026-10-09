'use client';

import { useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Send, MessageSquareText, AlertCircle, Bot, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SuggestedPrompts } from './SuggestedPrompts';
import { CitationChip } from './CitationChip';
import { RichMessage } from './RichMessage';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  images?: MessageImage[];
}

export interface Source {
  title: string;
  url?: string;
}

export interface MessageImage {
  imageUrl: string;
  url: string;
  title: string;
}

export interface ChatColumnProps {
  locale: Locale;
  messages: ChatMessage[];
  input: string;
  busy: boolean;
  streaming: boolean;
  error: string | null;
  loggedIn: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onPickPrompt: (prompt: string) => void;
}

export function ChatColumn({
  locale,
  messages,
  input,
  busy,
  streaming,
  error,
  loggedIn,
  onInputChange,
  onSend,
  onRetry,
  onPickPrompt,
}: ChatColumnProps) {
  const reduce = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, busy, reduce]);

  // Thinking = we've queued an assistant turn but no tokens have streamed yet.
  const last = messages[messages.length - 1];
  const thinking = busy && !streaming && last?.role === 'assistant' && last.content === '';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busy && input.trim()) onSend();
  }

  return (
    <section aria-label={t(locale, 'planner.title')} className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text">{t(locale, 'planner.title')}</h2>
          <p className="text-xs text-text-muted">
            {locale === 'vi' ? 'Trợ lý AI cho chuyến đi Việt Nam' : 'AI assistant for your Vietnam trip'}
          </p>
        </div>
      </header>

      {/* message log */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t(locale, 'planner.title')}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {!loggedIn && <LoginNeeded locale={locale} />}

        {loggedIn && messages.length === 0 && !error && <EmptyChat locale={locale} />}

        <AnimatePresence initial={!reduce}>
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const showThinking = thinking && isLast && m.role === 'assistant';
            if (showThinking) {
              return <ThinkingBubble key={`thinking-${i}`} locale={locale} />;
            }
            return (
              <Bubble
                key={i}
                locale={locale}
                message={m}
                streaming={streaming && isLast && m.role === 'assistant'}
              />
            );
          })}
        </AnimatePresence>

        {error && (
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3">
            <p className="flex items-center gap-2 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
            <Button size="sm" variant="outline" onClick={onRetry} aria-label={t(locale, 'common.retry')}>
              {t(locale, 'common.retry')}
            </Button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="space-y-3 border-t border-border px-5 py-4">
        {loggedIn && (
          <SuggestedPrompts locale={locale} disabled={busy} onPick={onPickPrompt} />
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label htmlFor="planner-input" className="sr-only">
            {t(locale, 'planner.placeholder')}
          </label>
          <Input
            id="planner-input"
            value={input}
            disabled={!loggedIn || busy}
            placeholder={t(locale, 'planner.placeholder')}
            onChange={(e) => onInputChange(e.target.value)}
          />
          <Button
            type="submit"
            loading={busy}
            disabled={!loggedIn || busy || !input.trim()}
            aria-label={t(locale, 'planner.send')}
            className="shrink-0"
          >
            {!busy && <Send className="h-4 w-4" aria-hidden />}
            <span className="hidden sm:inline">{t(locale, 'planner.send')}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}

function Bubble({
  locale,
  message,
  streaming,
}: {
  locale: Locale;
  message: ChatMessage;
  streaming: boolean;
}) {
  const reduce = useReducedMotion();
  const isUser = message.role === 'user';
  const showSources = !isUser && !streaming && !!message.sources && message.sources.length > 0;

  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 26 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('flex max-w-[85%] flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm text-pretty',
            isUser
              ? 'whitespace-pre-wrap bg-primary text-primary-fg shadow-e1'
              : 'w-full border border-border bg-surface-2 text-text',
          )}
        >
          {isUser ? (
            <>
              {message.content}
              {streaming && <Caret />}
            </>
          ) : (
            <RichMessage content={message.content} streaming={streaming} />
          )}
        </div>
        {!isUser && !streaming && !!message.images && message.images.length > 0 && (
          <div className="flex gap-2">
            {message.images.map((img, i) => (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-border"
                title={img.title}
              >
                <img
                  src={img.imageUrl}
                  alt={img.title}
                  className="h-full w-full object-cover transition-opacity hover:opacity-90"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        )}
        {showSources && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {t(locale, 'planner.sources')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {message.sources!.map((s, i) => (
                <CitationChip
                  key={`${s.title}-${i}`}
                  index={i}
                  citation={{ id: `${s.title}-${i}`, title: s.title, source: 'web', url: s.url }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Caret() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-current align-middle"
      animate={reduce ? { opacity: 1 } : { opacity: [1, 0.15, 1] }}
      transition={reduce ? undefined : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function ThinkingBubble({ locale }: { locale: Locale }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 26 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
              transition={
                reduce
                  ? undefined
                  : { duration: 1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }
              }
            />
          ))}
        </span>
        {t(locale, 'planner.thinking')}
      </div>
    </motion.div>
  );
}

function EmptyChat({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-primary">
        <MessageSquareText className="h-6 w-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-text-muted text-pretty">{t(locale, 'planner.emptyChat')}</p>
    </div>
  );
}

function LoginNeeded({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-muted">
        <LogIn className="h-6 w-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-text-muted text-pretty">{t(locale, 'planner.loginNeeded')}</p>
      <Link
        href="/login"
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-text',
          'transition-[background] duration-base hover:bg-surface-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        )}
      >
        <LogIn className="h-4 w-4" aria-hidden />
        {t(locale, 'nav.login')}
      </Link>
    </div>
  );
}

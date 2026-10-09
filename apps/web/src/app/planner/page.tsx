'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquareText,
  Route,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Bell,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { MeshBackground } from '@/components/effects/MeshBackground';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { ProfileMenu } from '@/components/layout/ProfileMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNotificationBadge } from '@/hooks/useNotifications';
import { ChatColumn, type ChatMessage, type Source, type MessageImage } from '@/components/planner/ChatColumn';
import { ItineraryCanvas, type ItineraryDay } from '@/components/planner/ItineraryCanvas';
import type { Citation } from '@/components/planner/CitationChip';
import { CreateTripModal } from '@/components/planner/CreateTripModal';

const LOCALE: Locale = 'vi';

type MobileTab = 'chat' | 'itinerary';

interface Conversation {
  id: string;
  title: string;
  updatedAt?: string;
}

export default function PlannerPage() {
  const router = useRouter();
  const { isLoggedIn: authLoggedIn, loading: authLoading } = useAuth();
  const unreadNotifications = useNotificationBadge(!authLoading && authLoggedIn);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean>(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem('tvp_token') : true,
  );
  const [tab, setTab] = useState<MobileTab>('chat');

  // Conversation management
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Itinerary canvas — populated from the RAG itinerary endpoint.
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [destination, setDestination] = useState('');
  const [itineraryBusy, setItineraryBusy] = useState(false);
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const lastQuestion = useRef<string>('');
  const autoLoadedRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
    if (!token) return;
    setLoadingConversations(true);
    try {
      const res = await fetch(`${api.base}/v1/planner/conversations`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data?.items ?? [];
      const list: Conversation[] = raw.map((c: { _id?: string; id?: string; title?: string; updatedAt?: string }) => ({
        id: c.id ?? c._id ?? '',
        title: c.title ?? '',
        updatedAt: c.updatedAt,
      }));
      setConversations(list);
    } catch {
      /* ignore list errors */
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const clearItinerary = useCallback(() => {
    setDays([]);
    setCitations([]);
    setDestination('');
  }, []);

  const applyItinerary = useCallback((data: unknown) => {
    const payload = data as
      | { itinerary?: { days?: ItineraryDay[]; destination?: string }; citations?: { title?: string; url?: string }[] }
      | null;
    const itin = payload?.itinerary;
    if (!itin || !Array.isArray(itin.days) || itin.days.length === 0) return false;
    setDays(itin.days);
    setDestination(itin.destination ?? '');
    setCitations(
      (payload?.citations ?? []).map((c, i) => ({
        id: `c${i}`,
        title: c.title ?? '',
        source: 'web',
        url: c.url,
        imageUrl: (c as { imageUrl?: string }).imageUrl,
      })),
    );
    return true;
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
      if (!token) return;
      setLoadingHistory(true);
      setError(null);
      clearItinerary();
      try {
        const res = await fetch(`${api.base}/v1/planner/conversations/${id}/messages`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data?.items ?? [];
        const mapped: ChatMessage[] = raw.map((m: { role?: string; content?: string; sources?: Source[]; images?: MessageImage[] }) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content ?? '',
          sources: Array.isArray(m.sources) ? m.sources : undefined,
          images: Array.isArray(m.images) ? m.images : undefined,
        }));
        setMessages(mapped);
        setConversationId(id);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingHistory(false);
      }

      // Restore the cached plan (if this conversation already produced one) so the
      // canvas is not empty when reopening from the sidebar.
      try {
        const res = await fetch(`${api.base}/v1/planner/conversations/${id}/itinerary`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) applyItinerary(await res.json());
      } catch {
        /* cached itinerary is best-effort */
      }
    },
    [applyItinerary, clearItinerary],
  );

  const fetchItinerary = useCallback(
    async (convId: string) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
      if (!token || !convId) return;
      setItineraryBusy(true);
      try {
        const res = await fetch(`${api.base}/v1/planner/itinerary`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversationId: convId, lang: LOCALE }),
        });
        if (!res.ok) return;
        applyItinerary(await res.json());
      } catch {
        /* ignore itinerary errors */
      } finally {
        setItineraryBusy(false);
      }
    },
    [applyItinerary],
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    clearItinerary();
    void fetchConversations();
  }, [clearItinerary, fetchConversations]);

  const deleteConversation = useCallback(
    async (id: string) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
      if (!token) return;
      try {
        const res = await fetch(`${api.base}/v1/planner/conversations/${id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (conversationId === id) {
          setMessages([]);
          setConversationId(null);
          clearItinerary();
        }
        void fetchConversations();
      } catch {
        /* ignore */
      }
    },
    [clearItinerary, conversationId, fetchConversations],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
      if (!token) return;
      const trimmed = title.trim();
      if (!trimmed) {
        setRenamingId(null);
        return;
      }
      try {
        const res = await fetch(`${api.base}/v1/planner/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        void fetchConversations();
      } catch {
        /* ignore */
      } finally {
        setRenamingId(null);
      }
    },
    [fetchConversations],
  );

  // Load conversation list on mount; auto-open the first conversation once.
  useEffect(() => {
    if (!loggedIn) return;
    void (async () => {
      await fetchConversations();
    })();
  }, [loggedIn, fetchConversations]);

  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (conversations.length > 0 && !loadingConversations) {
      autoLoadedRef.current = true;
      void loadConversation(conversations[0].id);
    }
  }, [conversations, loadingConversations, loadConversation]);

  const runAsk = useCallback(
    async (question: string) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
      if (!token) {
        setLoggedIn(false);
        setError(t(LOCALE, 'planner.loginNeeded'));
        return;
      }
      setLoggedIn(true);
      lastQuestion.current = question;
      let activeConvId = conversationId;

      setMessages((m) => [
        ...m,
        { role: 'user', content: question },
        { role: 'assistant', content: '' },
      ]);
      setBusy(true);
      setStreaming(false);
      setError(null);
      setDays([]);
      setCitations([]);
      setDestination('');

      try {
        const res = await fetch(`${api.base}/v1/planner/ask`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            message: question,
            lang: LOCALE,
            ...(conversationId ? { conversationId } : {}),
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // Parse SSE frames: meta (conversationId), citations, sources, token (delta), done, error.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const data = JSON.parse(dataLine.slice(5).trim());
              if (data.conversationId) {
                activeConvId = data.conversationId;
                setConversationId(data.conversationId);
              }
              if (data.delta) {
                setStreaming(true);
                setMessages((m) => {
                  const copy = [...m];
                  copy[copy.length - 1] = {
                    role: 'assistant',
                    content: copy[copy.length - 1].content + data.delta,
                  };
                  return copy;
                });
              }
              if (Array.isArray(data.sources)) {
                setMessages((m) => {
                  const copy = [...m];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = { ...last, sources: data.sources };
                  return copy;
                });
              }
              if (Array.isArray(data.images)) {
                setMessages((m) => {
                  const copy = [...m];
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = { ...last, images: data.images as MessageImage[] };
                  return copy;
                });
              }
            } catch {
              /* meta/citations/done frames */
            }
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
        setStreaming(false);
        void fetchConversations();
        if (activeConvId) void fetchItinerary(activeConvId);
      }
    },
    [conversationId, fetchConversations, fetchItinerary],
  );

  const send = useCallback(() => {
    const question = input.trim();
    if (!question) return;
    setInput('');
    void runAsk(question);
  }, [input, runAsk]);

  const pickPrompt = useCallback(
    (prompt: string) => {
      setInput('');
      void runAsk(prompt);
    },
    [runAsk],
  );

  const retry = useCallback(() => {
    setError(null);
    if (!loggedIn) return;
    const q = lastQuestion.current;
    if (!q) return;
    // Drop the empty assistant turn from the failed attempt before retrying.
    setMessages((m) => {
      const copy = [...m];
      if (copy.length && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
        copy.pop();
      }
      if (copy.length && copy[copy.length - 1].role === 'user') {
        copy.pop();
      }
      return copy;
    });
    void runAsk(q);
  }, [loggedIn, runAsk]);

  return (
    <main className="relative flex h-dvh flex-col bg-bg text-text">
      <MeshBackground variant="dark" />
      <nav className="flex items-center gap-2 border-b border-border px-4 py-3 md:px-6">
        <BrandLogo />

        {/* Search bar */}
        <div className="relative mx-4 hidden flex-1 md:block">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            aria-label="Tìm kiếm"
            placeholder="Tìm kiếm điểm đến, tour, hướng dẫn viên..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) window.location.href = `/search?q=${encodeURIComponent(val)}&tab=places`;
              }
            }}
            className="w-full rounded-full border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <span className="flex-1 md:hidden" />

        {/* Create post */}
        <div className="group relative">
          <Link
            href="/create"
            aria-label={t(LOCALE, 'common.create')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-fg hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={18} />
          </Link>
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-1 text-xs text-text opacity-0 transition-opacity group-hover:opacity-100">
            {t(LOCALE, 'common.create')}
          </span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div className="group relative">
          <Link
            href="/notifications"
            aria-label={
              unreadNotifications > 0
                ? `${t(LOCALE, 'common.notifications')} (${unreadNotifications})`
                : t(LOCALE, 'common.notifications')
            }
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-text hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadNotifications > 0 && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </Link>
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-1 text-xs text-text opacity-0 transition-opacity group-hover:opacity-100">
            {t(LOCALE, 'common.notifications')}
          </span>
        </div>

        <ProfileMenu />
      </nav>

      {/* mobile tab toggle */}
      <div className="flex gap-1 border-b border-border p-2 lg:hidden" role="tablist" aria-label={t(LOCALE, 'planner.title')}>
        <TabButton
          active={tab === 'chat'}
          onClick={() => setTab('chat')}
          icon={<MessageSquareText className="h-4 w-4" aria-hidden />}
          label={t(LOCALE, 'planner.title')}
        />
        <TabButton
          active={tab === 'itinerary'}
          onClick={() => setTab('itinerary')}
          icon={<Route className="h-4 w-4" aria-hidden />}
          label={t(LOCALE, 'planner.itinerary')}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_2fr_3fr]">
        {/* conversation sidebar — hidden on mobile */}
        <aside className="hidden min-h-0 flex-col border-r border-border lg:flex">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <MessageSquareText className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-text">{t(LOCALE, 'planner.conversations')}</h2>
                <p className="text-xs text-text-muted">{conversations.length > 0 ? `${conversations.length} cuộc trò chuyện` : 'Chưa có cuộc trò chuyện'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={newChat}
              aria-label={t(LOCALE, 'planner.newChat')}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-text transition-colors hover:bg-surface-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingConversations ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t(LOCALE, 'common.loading')}
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-text-muted">
                {t(LOCALE, 'planner.emptyConversations')}
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    {renamingId === c.id ? (
                      <form
                        className="flex items-center gap-1 px-1 py-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void renameConversation(c.id, renameValue);
                        }}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void renameConversation(c.id, renameValue)}
                          maxLength={200}
                          className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-xs text-text outline-none focus:ring-2 focus:ring-ring"
                          aria-label={t(LOCALE, 'planner.rename')}
                        />
                      </form>
                    ) : (
                      <div
                        className={cn(
                          'group flex items-center gap-1 rounded-lg px-2 py-2 transition-colors',
                          conversationId === c.id ? 'bg-primary/10' : 'hover:bg-surface-2',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void loadConversation(c.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm text-text">{c.title}</span>
                          {c.updatedAt && (
                            <span className="block text-[11px] text-text-muted">
                              {formatRelativeTime(c.updatedAt)}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameValue(c.title);
                          }}
                          className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={t(LOCALE, 'planner.rename')}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t(LOCALE, 'planner.deleteConfirm'))) {
                              void deleteConversation(c.id);
                            }
                          }}
                          className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={t(LOCALE, 'planner.delete')}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div
          className={cn(
            'min-h-0 border-border lg:block lg:border-r',
            tab === 'chat' ? 'block' : 'hidden',
          )}
        >
          <ChatColumn
            locale={LOCALE}
            messages={messages}
            input={input}
            busy={busy || loadingHistory}
            streaming={streaming}
            error={error}
            loggedIn={loggedIn}
            onInputChange={setInput}
            onSend={send}
            onRetry={retry}
            onPickPrompt={pickPrompt}
          />
        </div>
        <div className={cn('min-h-0 bg-surface-1/30 lg:block', tab === 'itinerary' ? 'block' : 'hidden')}>
          <ItineraryCanvas
            locale={LOCALE}
            days={days}
            citations={citations}
            destination={destination}
            loading={(busy || itineraryBusy) && days.length === 0}
            onCreateTrip={() => setShowCreateTrip(true)}
          />
        </div>
      </div>

      <CreateTripModal
        open={showCreateTrip}
        onClose={() => setShowCreateTrip(false)}
        destination={destination}
        dayCount={days.length}
        days={days}
        onCreated={(tripId) => router.push(`/trips/${tripId}`)}
      />
    </main>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/15 text-primary' : 'text-text-muted hover:bg-surface-2',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

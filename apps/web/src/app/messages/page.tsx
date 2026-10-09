'use client';

import { useState, use, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { ArrowLeft, MessagesSquare, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { AccountType } from '@/components/feed/PostCard';
import { ConversationList, type SearchResult } from '@/components/messages/ConversationList';
import { Composer } from '@/components/messages/Composer';
import { DaySeparator, MessageBubble, groupFlags } from '@/components/messages/MessageBubble';
import {
  formatDaySeparator,
  sameDay,
  type Attachment,
  type Conversation,
  type LinkPreview,
  type Message,
  type Participant,
} from '@/components/messages/types';

export default function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = use(searchParams);
  const convParam = params.conv;
  const { user, isLoggedIn, loading } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showThread, setShowThread] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks which conversation the current scroll position belongs to so a
  // conversation switch jumps instantly while new messages animate.
  const scrolledConvRef = useRef<string | null>(null);
  // Which conversation the `messages` state actually holds. Effects run after
  // commit, so on the first render after a switch `messages` still belongs to
  // the previous conversation; comparing ids is what tells the two apart.
  const messagesConvRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations();
      setConversations((data.items as Conversation[]) ?? []);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) void loadConversations();
  }, [isLoggedIn, loadConversations]);

  // Open a conversation passed via ?conv= (e.g. from a profile page).
  useEffect(() => {
    if (!convParam || conversations.length === 0) return;
    const found = conversations.find((c) => c._id === convParam);
    if (found) {
      setSelected(found);
      setShowThread(true);
    }
  }, [convParam, conversations]);

  // Debounced user search for starting a new conversation.
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchUsers(q);
        setSearchResults((data.items as SearchResult[]) ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isLoggedIn]);

  const loadMessages = useCallback(async (convId: string) => {
    setThreadLoading(true);
    try {
      const data = await api.listMessages(convId);
      messagesConvRef.current = convId;
      setMessages((data.items as Message[]) ?? []);
    } catch {
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadMessages(selected._id);
  }, [selected, loadMessages]);

  // Real-time: listen for new messages, join the selected room.
  useEffect(() => {
    if (!isLoggedIn) return;
    const s = getSocket();
    if (!s) return;

    const onNewMessage = (msg: Message) => {
      if (selected && msg.conversationId === selected._id) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      }
      setConversations((prev) => {
        if (!prev.some((c) => c._id === msg.conversationId)) {
          void loadConversations();
          return prev;
        }
        const preview =
          msg.body ||
          (msg.type === 'image' ? '[Ảnh]' : msg.type === 'file' ? '[Tệp]' : '[Liên kết]');
        return prev
          .map((c) =>
            c._id === msg.conversationId
              ? { ...c, lastMessage: preview, lastMessageAt: msg.createdAt }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime(),
          );
      });
    };

    s.on('message:new', onNewMessage);
    const joined = selected?._id;
    if (joined) s.emit('conversation:join', joined);
    return () => {
      s.off('message:new', onNewMessage);
      if (joined) s.emit('conversation:leave', joined);
    };
  }, [isLoggedIn, selected, loadConversations]);

  useEffect(() => () => disconnectSocket(), []);

  // Keep the thread pinned to the newest message. Writing scrollTop on the
  // container (instead of scrollIntoView) keeps ancestors from scrolling,
  // which is what made the shell drift.
  useEffect(() => {
    const el = scrollRef.current;
    // `messages` lags `selected` by a commit, so compare ids instead of trusting
    // that the state belongs to the open conversation. Claiming the switch while
    // the scroller is still empty spends the one-shot jump on zero content and
    // leaves the thread parked at the top once the fetch lands.
    if (!el || !selected || messagesConvRef.current !== selected._id) return;
    const isSwitch = scrolledConvRef.current !== selected._id;
    // Only follow the tail if the reader is already there. Yanking someone out
    // of scrolled-up history is the most jarring kind of movement.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!isSwitch && !atBottom) return;
    scrolledConvRef.current = selected._id;
    el.scrollTo({ top: el.scrollHeight, behavior: isSwitch ? 'auto' : 'smooth' });
  }, [messages, selected]);

  // Escape closes the image lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const peerOf = useCallback(
    (conv: Conversation): Participant | null => {
      if (!user) return null;
      const otherId = conv.participantIds.find((id) => id !== user.id);
      return otherId ? (conv.participants?.find((p) => p._id === otherId) ?? null) : null;
    },
    [user],
  );

  const nameOf = useCallback(
    (conv: Conversation): string => {
      const peer = peerOf(conv);
      if (peer?.displayName) return peer.displayName;
      const otherId = conv.participantIds.find((id) => id !== user?.id);
      return otherId ? `Khách ${otherId.slice(-4)}` : 'Hội thoại';
    },
    [peerOf, user],
  );

  async function handleStartConversation(other: SearchResult) {
    const conv = await api.createConversation(other._id);
    const next: Conversation = {
      _id: conv._id,
      participantIds: [user?.id ?? '', other._id],
      participants: [
        {
          _id: other._id,
          displayName: other.displayName,
          handle: other.handle,
          avatarUrl: other.avatarUrl,
          accountType: other.accountType,
        },
      ],
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
    };
    setSearchQuery('');
    setSearchResults([]);
    setConversations((prev) => (prev.some((c) => c._id === conv._id) ? prev : [next, ...prev]));
    setSelected(next);
    setShowThread(true);
  }

  async function handleSend({
    body,
    attachments,
    linkPreview,
  }: {
    body: string;
    attachments: Attachment[];
    linkPreview: LinkPreview | null;
  }) {
    if (!selected) return;
    const hasImage = attachments.some((a) => (a.mimeType ?? '').startsWith('image/'));
    const type = hasImage
      ? 'image'
      : attachments.length > 0
        ? 'file'
        : linkPreview
          ? 'link'
          : 'text';

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      _id: tempId,
      conversationId: selected._id,
      senderId: user?.id ?? '',
      body,
      type,
      attachments,
      linkPreview,
      seq: Number.MAX_SAFE_INTEGER,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const saved = (await api.sendMessage(selected._id, body, {
        type,
        attachments,
        linkPreview: linkPreview ?? undefined,
      })) as unknown as Message;
      setMessages((prev) => {
        if (prev.some((m) => m._id === saved._id)) return prev.filter((m) => m._id !== tempId);
        return prev.map((m) => (m._id === tempId ? { ...saved, pending: false } : m));
      });
      const preview = body || (type === 'image' ? '[Ảnh]' : type === 'file' ? '[Tệp]' : '[Liên kết]');
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selected._id
            ? { ...c, lastMessage: preview, lastMessageAt: new Date().toISOString() }
            : c,
        ),
      );
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      throw e;
    }
  }

  const peer = selected ? peerOf(selected) : null;
  const peerName = selected ? nameOf(selected) : '';
  const rendered = messages;

  return (
    <AppShell flush>
      {/* h-full inherits the shell's dvh-based height — no second viewport calc. */}
      <div className="flex h-full overflow-hidden border border-border bg-surface-1">
        <aside
          className={`flex w-full min-w-0 flex-col border-r border-border md:w-80 md:shrink-0 ${
            showThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selected?._id}
            loading={pageLoading || loading}
            peerOf={peerOf}
            nameOf={nameOf}
            onSelect={(c) => {
              setSelected(c);
              setShowThread(true);
            }}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            searching={searching}
            onStartConversation={(r) => void handleStartConversation(r)}
          />
        </aside>

        <section
          className={`min-w-0 flex-1 flex-col ${showThread ? 'flex' : 'hidden md:flex'}`}
          aria-label="Cuộc trò chuyện"
        >
          {selected ? (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setShowThread(false)}
                  aria-label="Quay lại danh sách"
                  className="-ml-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar
                  name={peerName}
                  src={peer?.avatarUrl}
                  accountType={(peer?.accountType as AccountType) ?? 'traveler'}
                  size={38}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{peerName}</p>
                  <p className="truncate text-xs text-text-muted">
                    {peer?.handle ? `@${peer.handle}` : 'Hội thoại'}
                  </p>
                </div>
              </header>

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
              >
                {threadLoading && rendered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Đang tải tin nhắn…</p>
                ) : rendered.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
                      <MessagesSquare size={22} className="text-text-muted" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-text">Chưa có tin nhắn</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Gửi lời chào để bắt đầu cuộc trò chuyện với {peerName}.
                    </p>
                  </div>
                ) : (
                  rendered.map((msg, i) => {
                    const prev = rendered[i - 1];
                    const showDay = !prev || !sameDay(prev.createdAt, msg.createdAt);
                    const { isGroupStart, isGroupEnd } = groupFlags(rendered, i);
                    return (
                      <div key={msg._id}>
                        {showDay && <DaySeparator label={formatDaySeparator(msg.createdAt)} />}
                        <MessageBubble
                          message={msg}
                          mine={msg.senderId === user?.id}
                          isGroupStart={showDay || isGroupStart}
                          isGroupEnd={isGroupEnd}
                          peer={peer}
                          peerName={peerName}
                          onOpenImage={setLightbox}
                        />
                      </div>
                    );
                  })
                )}
              </div>

              <Composer onSend={handleSend} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
                <MessagesSquare size={26} className="text-text-muted" aria-hidden />
              </span>
              <p className="text-base font-semibold text-text">Tin nhắn của bạn</p>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-text-muted">
                Chọn một hội thoại bên trái, hoặc tìm người để bắt đầu trò chuyện.
              </p>
            </div>
          )}
        </section>
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
            className="absolute right-4 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full cursor-default rounded-lg object-contain"
          />
        </div>
      )}
    </AppShell>
  );
}

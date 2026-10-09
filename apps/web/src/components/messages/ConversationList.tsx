'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, Search, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { Avatar } from '@/components/ui/avatar';
import type { AccountType } from '@/components/feed/PostCard';
import { formatListStamp, type Conversation, type Participant } from './types';

export interface SearchResult {
  _id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: string;
}

interface Props {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  peerOf: (c: Conversation) => Participant | null;
  nameOf: (c: Conversation) => string;
  onSelect: (c: Conversation) => void;
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  searchResults: SearchResult[];
  searching: boolean;
  onStartConversation: (r: SearchResult) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  peerOf,
  nameOf,
  onSelect,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searching,
  onStartConversation,
}: Props) {
  const [showResults, setShowResults] = useState(false);
  const menu = useAnchoredMenu<HTMLDivElement>({
    align: 'start',
    matchWidth: true,
    onOpenChange: (open) => {
      if (!open) setShowResults(false);
    },
  });

  const showDropdown = showResults && searchQuery.trim().length >= 2;

  // The query drives this menu rather than a click on a trigger.
  useEffect(() => {
    menu.setOpen(showDropdown);
  }, [showDropdown, menu.setOpen]);

  // Results arriving changes the panel's height, which changes whether it still
  // fits below the field.
  useEffect(() => {
    if (menu.open) menu.reposition();
  }, [menu.open, menu.reposition, searching, searchResults.length]);

  return (
    <>
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-text">Tin nhắn</h1>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
            {conversations.length}
          </span>
        </div>

        <div ref={menu.triggerRef} className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-transparent bg-surface-2 px-3 py-2 transition-colors focus-within:border-ring">
            <Search size={15} className="shrink-0 text-text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Tìm người để nhắn tin…"
              value={searchQuery}
              onChange={(e) => {
                onSearchQueryChange(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              className="w-full min-w-0 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              aria-label="Tìm người để nhắn tin"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                className="shrink-0 cursor-pointer rounded text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Xoá tìm kiếm"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {menu.mounted && menu.open && createPortal(
            <div
              ref={menu.menuRef}
              style={menu.style}
              className="overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-1 shadow-e3"
            >
              {searching ? (
                <p className="px-4 py-3 text-sm text-text-muted">Đang tìm…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-text-muted">Không tìm thấy người dùng.</p>
              ) : (
                <ul className="py-1">
                  {searchResults.map((r) => (
                    <li key={r._id}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResults(false);
                          onStartConversation(r);
                        }}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-base hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                      >
                        <Avatar
                          name={r.displayName}
                          src={r.avatarUrl}
                          accountType={(r.accountType as AccountType) ?? 'traveler'}
                          size={36}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text">
                            {r.displayName}
                          </span>
                          <span className="block truncate text-xs text-text-muted">
                            {r.handle ? `@${r.handle}` : 'Người dùng'}
                          </span>
                        </span>
                        <MessageSquarePlus size={16} className="shrink-0 text-text-muted" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>,
            document.body,
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <ul className="space-y-1 p-2" aria-busy="true" aria-label="Đang tải hội thoại">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="skeleton h-11 w-11 shrink-0 animate-shimmer rounded-full" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="skeleton block h-3 w-1/2 animate-shimmer rounded" />
                  <span className="skeleton block h-3 w-3/4 animate-shimmer rounded" />
                </span>
              </li>
            ))}
          </ul>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
              <MessageSquarePlus size={22} className="text-text-muted" aria-hidden />
            </span>
            <p className="text-sm font-medium text-text">Chưa có hội thoại</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Tìm một người ở trên để bắt đầu cuộc trò chuyện đầu tiên.
            </p>
          </div>
        ) : (
          <ul className="p-2">
            {conversations.map((conv, i) => {
              const active = selectedId === conv._id;
              const peer = peerOf(conv);
              return (
                <motion.li
                  key={conv._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.18 }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conv)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-primary/10' : 'hover:bg-surface-2',
                    )}
                  >
                    <Avatar
                      name={nameOf(conv)}
                      src={peer?.avatarUrl}
                      accountType={(peer?.accountType as AccountType) ?? 'traveler'}
                      size={44}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm',
                            active ? 'font-semibold text-primary' : 'font-semibold text-text',
                          )}
                        >
                          {nameOf(conv)}
                        </span>
                        <span className="shrink-0 text-[11px] text-text-muted">
                          {formatListStamp(conv.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-muted">
                        {conv.lastMessage || 'Bắt đầu trò chuyện'}
                      </span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

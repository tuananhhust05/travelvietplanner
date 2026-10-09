'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Link2, Send, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { postUrl } from '@/lib/site';
import { t, useLocale } from '@/lib/i18n';

export interface ShareButtonProps {
  postId: string;
  postBody?: string;
  className?: string;
  size?: 'sm' | 'default';
  onSendMessage?: () => void;
}

function FIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-[11px] font-bold leading-none text-white"
    >
      f
    </span>
  );
}

function XIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F1419] text-[11px] font-bold leading-none text-white dark:bg-white dark:text-[#0F1419]"
    >
      X
    </span>
  );
}

function ZIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0068FF] text-[11px] font-bold leading-none text-white"
    >
      z
    </span>
  );
}

const MENU_WIDTH = 208; // w-52
const MENU_APPROX_HEIGHT = 220;

export function ShareButton({
  postId,
  postBody,
  className,
  size = 'default',
  onSendMessage,
}: ShareButtonProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const url = postUrl(postId);
  const shareText = postBody ? postBody.slice(0, 100) : '';
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.left;

    if (rect.bottom + MENU_APPROX_HEIGHT > window.innerHeight) {
      top = rect.top - MENU_APPROX_HEIGHT - 6;
    }
    if (left + MENU_WIDTH > window.innerWidth) {
      left = window.innerWidth - MENU_WIDTH - 8;
    }
    left = Math.max(8, left);

    setMenuPos({ top, left });
    setOpen(true);
  }

  function handleClick() {
    const isMobile =
      typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
    if (typeof navigator !== 'undefined' && navigator.share && isMobile) {
      void navigator.share({
        url,
        text: shareText || undefined,
        title: shareText || undefined,
      });
      return;
    }
    openDropdown();
  }

  async function copyLink() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently — user can copy manually
    }
  }

  const menuItems = [
    {
      key: 'facebook',
      icon: <FIcon />,
      label: 'Facebook',
      onClick() {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank',
          'noopener,noreferrer',
        );
        setOpen(false);
      },
    },
    {
      key: 'twitter',
      icon: <XIcon />,
      label: 'Twitter / X',
      onClick() {
        window.open(
          `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
          '_blank',
          'noopener,noreferrer',
        );
        setOpen(false);
      },
    },
    {
      key: 'zalo',
      icon: <ZIcon />,
      label: 'Zalo',
      onClick() {
        window.open(
          `https://zalo.me/share/button?url=${encodedUrl}`,
          '_blank',
          'noopener,noreferrer',
        );
        setOpen(false);
      },
    },
    {
      key: 'copy',
      icon: copied ? (
        <Check size={14} className="text-green-500" aria-hidden />
      ) : (
        <Link2 size={14} aria-hidden />
      ),
      label: t(locale, 'share.copyLink'),
      onClick: copyLink,
    },
    ...(onSendMessage
      ? [
          {
            key: 'message',
            icon: <Send size={14} aria-hidden />,
            label: t(locale, 'share.sendMessage'),
            onClick() {
              onSendMessage();
              setOpen(false);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-label={t(locale, 'share.share')}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          size === 'sm'
            ? 'gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2 hover:text-text'
            : 'flex-1 justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-text-muted hover:bg-surface-2 hover:text-text',
          className,
        )}
      >
        <Share2 size={size === 'sm' ? 15 : 17} aria-hidden />
        <span>{t(locale, 'share.share')}</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={t(locale, 'share.share')}
            style={{ top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
            className="fixed w-52 rounded-xl border border-border bg-surface-1 py-1 shadow-e3"
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

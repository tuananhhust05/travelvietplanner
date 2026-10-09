'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import UsersTab from './users';
import PostsTab from './posts';
import KnowledgeTab from './knowledge';

type Tab = 'users' | 'posts' | 'knowledge';

const TABS: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'posts', label: 'Posts' },
  { key: 'knowledge', label: 'Knowledge' },
];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const isAdmin = user?.roles?.some((r) => r === 'admin' || r === 'superadmin');
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access denied</h2>
          <p className="mt-2 text-sm text-text-muted">Admin access required.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bg">
      <nav className="flex items-center border-b border-border px-6 py-3">
        <Link href="/" className="font-display text-lg font-bold">travelvietplaner</Link>
        <span className="ml-auto rounded-full bg-primary/20 px-3 py-1 text-xs text-primary">Admin console</span>
      </nav>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <h2 className="text-2xl font-semibold">Admin console</h2>
        <p className="mt-1 text-sm text-text-muted">Manage users, posts, and the AI knowledge base.</p>
        <div className="mt-4 flex gap-2 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t-lg px-4 py-2 text-sm ${
                tab === t.key ? 'border-b-2 border-primary text-primary' : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {tab === 'users' && <UsersTab />}
          {tab === 'posts' && <PostsTab />}
          {tab === 'knowledge' && <KnowledgeTab />}
        </div>
      </div>
    </main>
  );
}
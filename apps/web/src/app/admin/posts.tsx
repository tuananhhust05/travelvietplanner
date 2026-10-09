'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface AdminPost {
  id: string;
  body: string;
  status: string;
  featured?: boolean;
  createdAt?: string;
}

export default function PostsTab() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListPosts({ status });
      setPosts(res.items as AdminPost[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const setPostStatus = async (id: string, s: string) => {
    await api.adminSetPostStatus(id, s);
    load();
  };
  const toggleFeature = async (id: string, featured: boolean) => {
    await api.adminSetPostFeatured(id, featured);
    load();
  };

  return (
    <div className="space-y-4">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded border border-border bg-surface-1 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="published">Published</option>
        <option value="hidden">Hidden</option>
        <option value="deleted">Deleted</option>
      </select>
      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-surface-1 p-3">
              <p className="line-clamp-2 text-sm">{p.body}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                <span className="rounded-full bg-surface-3 px-2 py-0.5">{p.status}</span>
                {p.featured && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-accent">Featured</span>}
                <Link
                  href={`/post/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-surface-3 px-2 py-1 hover:bg-border"
                >
                  <ExternalLink size={12} aria-hidden />
                  View
                </Link>
                <button
                  onClick={() => setPostStatus(p.id, p.status === 'published' ? 'hidden' : 'published')}
                  className="rounded bg-surface-3 px-2 py-1 hover:bg-border"
                >
                  {p.status === 'published' ? 'Hide' : 'Publish'}
                </button>
                <button
                  onClick={() => toggleFeature(p.id, !p.featured)}
                  className="rounded bg-surface-3 px-2 py-1 hover:bg-border"
                >
                  {p.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button
                  onClick={() => setPostStatus(p.id, 'deleted')}
                  className="rounded bg-danger/20 px-2 py-1 text-danger hover:bg-danger/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
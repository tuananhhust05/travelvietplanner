'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  handle?: string | null;
  roles: string[];
  banned?: boolean;
  createdAt?: string;
}

export default function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminListUsers({ q });
      setUsers(res.items as AdminUser[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const setRole = async (id: string, role: string) => {
    await api.adminSetUserRole(id, role);
    load();
  };
  const setBan = async (id: string, banned: boolean) => {
    await api.adminSetUserBan(id, banned);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await api.adminDeleteUser(id);
    load();
  };

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by email, name, handle..."
        className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm"
      />
      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="py-2">User</th>
              <th className="py-2">Roles</th>
              <th className="py-2">Status</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border">
                <td className="py-2">
                  <div className="font-medium">{u.displayName}</div>
                  <div className="text-xs text-text-muted">{u.email}</div>
                </td>
                <td className="py-2">
                  <select
                    value={u.roles[0] ?? ''}
                    onChange={(e) => setRole(u.id, e.target.value)}
                    className="rounded border border-border bg-surface-1 px-2 py-1 text-xs"
                  >
                    {['traveler', 'guide', 'moderator', 'kb.editor', 'admin', 'superadmin'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${u.banned ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                    {u.banned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="py-2 space-x-2">
                  <Link
                    href={`/profile/${u.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-surface-3 px-2 py-1 text-xs hover:bg-border"
                  >
                    <ExternalLink size={12} aria-hidden />
                    Profile
                  </Link>
                  <button
                    onClick={() => setBan(u.id, !u.banned)}
                    className="rounded bg-surface-3 px-2 py-1 text-xs hover:bg-border"
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                  <button
                    onClick={() => remove(u.id)}
                    className="rounded bg-danger/20 px-2 py-1 text-xs text-danger hover:bg-danger/30"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface KbDocument {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string;
  lang: string;
  status: string;
  chunkCount: number;
  published: boolean;
  createdAt?: string;
}

export default function KnowledgeTab() {
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.kbListDocuments();
      setDocs(res.items as KbDocument[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name);
      fd.append('lang', 'vi');
      await api.kbUploadDocument(fd);
      fileRef.current.value = '';
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const process = async (id: string) => {
    setBusy(true);
    try {
      await api.kbProcessDocument(id);
      await load();
    } finally {
      setBusy(false);
    }
  };
  const togglePublish = async (id: string, published: boolean) => {
    await api.kbSetPublished(id, published);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this document and its chunks?')) return;
    await api.kbDeleteDocument(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".txt,.md,.pdf" className="text-sm" />
        <button
          onClick={upload}
          disabled={busy}
          className="rounded bg-primary px-3 py-2 text-sm text-primary-fg disabled:opacity-50"
        >
          Upload
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-surface-1 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-text-muted">
                    {d.status} · {d.chunkCount} chunks · {d.lang}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {d.status === 'uploaded' && (
                    <button
                      onClick={() => process(d.id)}
                      disabled={busy}
                      className="rounded bg-primary px-2 py-1 text-primary-fg disabled:opacity-50"
                    >
                      Process
                    </button>
                  )}
                  <button
                    onClick={() => togglePublish(d.id, !d.published)}
                    className="rounded bg-surface-3 px-2 py-1 hover:bg-border"
                  >
                    {d.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => remove(d.id)}
                    className="rounded bg-danger/20 px-2 py-1 text-danger hover:bg-danger/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
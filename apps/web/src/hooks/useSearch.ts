'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { SearchUserResult, SearchPostResult, SearchPlaceResult } from '@/lib/api';

export type SearchTab = 'all' | 'posts' | 'users' | 'places';

export interface SearchState {
  posts: SearchPostResult[];
  users: SearchUserResult[];
  places: SearchPlaceResult[];
  loading: boolean;
  error: string | null;
}

const EMPTY: SearchState = { posts: [], users: [], places: [], loading: false, error: null };

export function useSearch(q: string, tab: SearchTab): SearchState {
  const [state, setState] = useState<SearchState>(EMPTY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setState(EMPTY);
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    if (timerRef.current) clearTimeout(timerRef.current);

    let cancelled = false;
    timerRef.current = setTimeout(() => {
      const fetcher =
        tab === 'all'
          ? api.searchAll(trimmed)
          : tab === 'posts'
            ? api.searchPosts(trimmed).then((d) => ({ posts: d.items, users: [], places: [] }))
            : tab === 'users'
              ? (api.searchUsers(trimmed) as Promise<{ items: SearchUserResult[] }>).then((d) => ({ posts: [], users: d.items, places: [] }))
              : api.searchPlaces(trimmed).then((d) => ({ posts: [], users: [], places: d.items }));

      fetcher
        .then((data) => {
          if (cancelled) return;
          setState({
            posts: (data as { posts?: SearchPostResult[] }).posts ?? [],
            users: (data as { users?: SearchUserResult[] }).users ?? [],
            places: (data as { places?: SearchPlaceResult[] }).places ?? [],
            loading: false,
            error: null,
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Search failed',
          }));
        });
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [q, tab]);

  return state;
}

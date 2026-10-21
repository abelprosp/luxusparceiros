'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResponse } from '@luxus/types';

export interface PaginatedList<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Lista paginada com "carregar mais". `fetchPage` deve ser memoizado com useCallback:
 * quando ele muda (filtros), a lista recomeça da primeira página após `debounceMs`.
 */
export function usePaginatedList<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
  { debounceMs = 300 }: { debounceMs?: number } = {},
): PaginatedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(1);
      if (current !== requestId.current) return;
      setItems(res.data);
      setPage(1);
      setTotalPages(res.meta?.totalPages ?? 1);
      setTotal(res.meta?.total ?? res.data.length);
    } catch (err) {
      if (current !== requestId.current) return;
      setItems([]);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    const current = requestId.current;
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      if (current !== requestId.current) return;
      setItems((previous) => {
        const ids = new Set(previous.map((item) => (item as { id?: string }).id));
        return [...previous, ...res.data.filter((item) => !ids.has((item as { id?: string }).id))];
      });
      setPage(page + 1);
      setTotalPages(res.meta?.totalPages ?? totalPages);
      setTotal(res.meta?.total ?? total);
    } catch (err) {
      if (current === requestId.current) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar mais itens');
      }
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, page, total, totalPages]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), debounceMs);
    return () => clearTimeout(timer);
  }, [reload, debounceMs]);

  return {
    items,
    setItems,
    total,
    loading,
    loadingMore,
    error,
    hasMore: page < totalPages,
    reload,
    loadMore,
  };
}

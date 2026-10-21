import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResponse, PaginatedResponse } from '@luxus/types';

/**
 * Lista com rolagem infinita. `fetchPage` deve ser memoizado com useCallback:
 * quando ele muda (filtros), a lista recomeça da primeira página.
 */
export function useInfiniteList<T extends { id: string }>(
  fetchPage: (page: number) => Promise<ApiResponse<PaginatedResponse<T>>>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadFirst = useCallback(async () => {
    const current = ++requestId.current;
    setError(null);
    try {
      const response = await fetchPage(1);
      if (current !== requestId.current) return;
      const data = response.data;
      setItems(data?.data ?? []);
      setPage(1);
      setTotalPages(data?.meta?.totalPages ?? 1);
      setTotal(data?.meta?.total ?? data?.data?.length ?? 0);
    } catch (err) {
      if (current !== requestId.current) return;
      setItems([]);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os dados');
    }
  }, [fetchPage]);

  useEffect(() => {
    setLoading(true);
    loadFirst().finally(() => setLoading(false));
  }, [loadFirst]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }, [loadFirst]);

  const retry = useCallback(async () => {
    setLoading(true);
    await loadFirst();
    setLoading(false);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || page >= totalPages) return;
    const current = requestId.current;
    setLoadingMore(true);
    try {
      const response = await fetchPage(page + 1);
      if (current !== requestId.current) return;
      const next = response.data?.data ?? [];
      setItems((previous) => {
        const ids = new Set(previous.map((item) => item.id));
        return [...previous, ...next.filter((item) => !ids.has(item.id))];
      });
      setPage(page + 1);
      setTotalPages(response.data?.meta?.totalPages ?? totalPages);
    } catch {
      // A próxima rolagem até o fim tenta novamente.
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loading, loadingMore, page, refreshing, totalPages]);

  return {
    items,
    total,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: page < totalPages,
    refresh,
    retry,
    loadMore,
  };
}

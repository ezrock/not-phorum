import { useCallback, useState } from 'react';

interface UseShowMorePagingOptions {
  initialVisible: number;
  step: number;
}

export function useShowMorePaging({ initialVisible, step }: UseShowMorePagingOptions) {
  const normalizedInitial = Math.max(1, initialVisible);
  const normalizedStep = Math.max(1, step);
  const [visibleCount, setVisibleCount] = useState(normalizedInitial);

  const resetVisibleCount = useCallback((nextInitial?: number) => {
    if (typeof nextInitial === 'number' && Number.isFinite(nextInitial)) {
      setVisibleCount(Math.max(1, Math.floor(nextInitial)));
      return;
    }
    setVisibleCount(normalizedInitial);
  }, [normalizedInitial]);

  const showMore = useCallback(() => {
    setVisibleCount((prev) => prev + normalizedStep);
  }, [normalizedStep]);

  return {
    visibleCount,
    setVisibleCount,
    resetVisibleCount,
    showMore,
  };
}

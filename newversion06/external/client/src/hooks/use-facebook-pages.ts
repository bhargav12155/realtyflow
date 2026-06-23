import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

interface UseFacebookPagesOptions {
  autoSelect?: boolean; // Auto-select first page if only one exists
}

export function useFacebookPages(options: UseFacebookPagesOptions = {}) {
  const { autoSelect = false } = options;
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(undefined);

  const {
    data: pages = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<FacebookPage[]>({
    queryKey: ["/api/facebook/pages"],
    enabled: true,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-select first page if enabled and only one page exists
  // Clear selection if pages become empty or selected page no longer exists
  useEffect(() => {
    // Clear selection if no pages available
    if (pages.length === 0) {
      setSelectedPageId(undefined);
      return;
    }

    // Auto-select first page if enabled and only one page exists
    if (autoSelect && pages.length === 1 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
      return;
    }

    // Reset selection if the selected page no longer exists
    if (selectedPageId) {
      const pageExists = pages.some((page) => page.id === selectedPageId);
      if (!pageExists) {
        setSelectedPageId(undefined);
      }
    }
  }, [autoSelect, pages, selectedPageId]);

  // Hook is ready when pages have loaded successfully or with error (not still loading)
  const isReady = !isLoading;

  return {
    pages,
    isLoading,
    isError,
    error,
    refetch,
    selectedPageId,
    setSelectedPageId,
    isReady,
  };
}

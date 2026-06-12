import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface InstagramAccount {
  instagramBusinessAccountId: string;
  pageId: string;
  pageName: string;
  username?: string;
}

interface UseInstagramAccountsOptions {
  autoSelect?: boolean;
}

export function useInstagramAccounts(options: UseInstagramAccountsOptions = {}) {
  const { autoSelect = false } = options;
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  // Fetch Instagram accounts linked to Facebook Pages
  const {
    data: accounts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<InstagramAccount[]>({
    queryKey: ["/api/instagram/accounts"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Auto-select if only one account
  useEffect(() => {
    if (autoSelect && accounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].instagramBusinessAccountId);
    }
  }, [autoSelect, accounts, selectedAccountId]);

  // Clear selection if selected account no longer exists
  useEffect(() => {
    if (selectedAccountId && accounts.length > 0) {
      const accountExists = accounts.some(
        (acc) => acc.instagramBusinessAccountId === selectedAccountId
      );
      if (!accountExists) {
        setSelectedAccountId(undefined);
      }
    }
  }, [accounts, selectedAccountId]);

  // Clear selection if accounts become empty
  useEffect(() => {
    if (accounts.length === 0 && selectedAccountId) {
      setSelectedAccountId(undefined);
    }
  }, [accounts.length, selectedAccountId]);

  const isReady = !isLoading;

  return {
    accounts,
    isLoading,
    isError,
    error,
    refetch,
    selectedAccountId,
    setSelectedAccountId,
    isReady,
  };
}

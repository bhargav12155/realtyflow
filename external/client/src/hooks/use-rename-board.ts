import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BoardSummary } from "@/components/boards/BoardCard";

export interface RenameBoardVariables {
  boardId: string;
  title: string;
}

interface RenameBoardContext {
  previousList?: BoardSummary[];
  previousDetail?: Record<string, unknown> & { title?: string };
}

/**
 * Shared rename-board mutation used by both the boards grid (BoardsHomeView)
 * and the board detail page. Owns the PATCH /api/boards/:id call, the
 * optimistic update for the list cache (`["/api/boards"]`) and the detail
 * cache (`["/api/boards", boardId]`), the success/error toast copy, and
 * rollback + reconciliation on settle. Either cache may be absent at call
 * time (e.g. detail page hasn't loaded the list, or vice versa) — the hook
 * only patches what's actually in the cache.
 */
export function useRenameBoardMutation() {
  const { toast } = useToast();
  return useMutation<unknown, Error, RenameBoardVariables, RenameBoardContext>({
    mutationFn: async ({ boardId, title }) => {
      const res = await apiRequest("PATCH", `/api/boards/${boardId}`, { title });
      return res.json();
    },
    onMutate: async ({ boardId, title }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/boards"] });
      await queryClient.cancelQueries({ queryKey: ["/api/boards", boardId] });
      const previousList = queryClient.getQueryData<BoardSummary[]>([
        "/api/boards",
      ]);
      if (previousList) {
        queryClient.setQueryData<BoardSummary[]>(
          ["/api/boards"],
          previousList.map((b) => (b.id === boardId ? { ...b, title } : b)),
        );
      }
      const previousDetail = queryClient.getQueryData<
        Record<string, unknown> & { title?: string }
      >(["/api/boards", boardId]);
      if (previousDetail) {
        queryClient.setQueryData(["/api/boards", boardId], {
          ...previousDetail,
          title,
        });
      }
      return { previousList, previousDetail };
    },
    onSuccess: () => {
      toast({ title: "Board renamed" });
    },
    onError: (e, { boardId }, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(["/api/boards"], context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(
          ["/api/boards", boardId],
          context.previousDetail,
        );
      }
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({
        title: "Couldn't rename board",
        description: errText,
        variant: "destructive",
      });
    },
    // Always reconcile with the server — both on success (replace optimistic
    // title with the server's canonical title) and on error (after rollback,
    // refetch in case another tab made changes). Invalidate both caches so
    // the home grid and the detail page stay in sync regardless of which
    // surface initiated the rename.
    onSettled: (_data, _err, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
    },
  });
}

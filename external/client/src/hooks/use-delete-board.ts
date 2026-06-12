import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BoardSummary } from "@/components/boards/BoardCard";

interface DeleteBoardContext {
  previousList?: BoardSummary[];
}

/**
 * Shared delete-board mutation used by both the boards grid (BoardsHomeView)
 * and the board detail page. Owns the DELETE /api/boards/:id call, the
 * optimistic removal from the list cache (`["/api/boards"]`), the success/
 * error toast copy, rollback on failure, removal of the now-stale detail
 * cache entry, and onSettled invalidation. The list cache may be absent at
 * call time (e.g. detail page hasn't loaded the grid yet) — the hook only
 * patches what's actually in the cache.
 */
export function useDeleteBoardMutation() {
  const { toast } = useToast();
  return useMutation<unknown, Error, string, DeleteBoardContext>({
    mutationFn: async (boardId) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}`);
      return res.json();
    },
    onMutate: async (boardId) => {
      await queryClient.cancelQueries({ queryKey: ["/api/boards"] });
      const previousList = queryClient.getQueryData<BoardSummary[]>([
        "/api/boards",
      ]);
      if (previousList) {
        queryClient.setQueryData<BoardSummary[]>(
          ["/api/boards"],
          previousList.filter((b) => b.id !== boardId),
        );
      }
      return { previousList };
    },
    onSuccess: (_data, boardId) => {
      toast({
        title: "Board deleted",
        description: "The board and its assets have been removed.",
      });
      // Drop the per-board detail cache entry — the board no longer exists,
      // so any cached detail response is stale and a refetch would 404.
      queryClient.removeQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e, _boardId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(["/api/boards"], context.previousList);
      }
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({
        title: "Couldn't delete board",
        description: errText,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
  });
}

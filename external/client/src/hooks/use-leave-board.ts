import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BoardSummary } from "@/components/boards/BoardCard";

interface LeaveBoardContext {
  previousList?: BoardSummary[];
}

/**
 * Shared leave-board mutation used by both the boards grid (BoardsHomeView)
 * and the board detail page. Owns the DELETE /api/boards/:id/share/me call,
 * the optimistic removal from the list cache (`["/api/boards"]`), the
 * success/error toast copy, rollback on failure, removal of the now-stale
 * detail cache entry (the leaver no longer has access), and onSettled
 * invalidation. Callers that need to navigate away after leaving (e.g. the
 * detail page) can pass an `onSuccess` to `mutate` — react-query runs the
 * mutate-level callback after the hook's, so navigation happens after the
 * toast and cache cleanup.
 */
export function useLeaveBoardMutation() {
  const { toast } = useToast();
  return useMutation<unknown, Error, string, LeaveBoardContext>({
    mutationFn: async (boardId) => {
      const res = await apiRequest("DELETE", `/api/boards/${boardId}/share/me`);
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
        title: "Left board",
        description: "It has been removed from your Shared tab.",
      });
      // Drop the per-board detail cache entry — the leaver no longer has
      // access, so any cached detail response is stale and a refetch would
      // 403/404.
      queryClient.removeQueries({ queryKey: ["/api/boards", boardId] });
    },
    onError: (e, _boardId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(["/api/boards"], context.previousList);
      }
      const errText = e?.message?.replace(/^\d+:\s*/, "") ?? String(e);
      toast({
        title: "Couldn't leave board",
        description: errText,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    },
  });
}

import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUp, MoreVertical, Paperclip, Mic, Search } from "lucide-react";
import { BoardsSidebar } from "@/components/boards/BoardsSidebar";
import { BoardCard, NewBoardCard, type BoardSummary } from "@/components/boards/BoardCard";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Tab = "all" | "shared" | "mine";

export default function BoardsHomePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");

  const boardsQuery = useQuery<BoardSummary[]>({
    queryKey: ["/api/boards"],
  });

  const createBoardMutation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiRequest("POST", "/api/boards", title ? { title } : {});
      return res.json() as Promise<BoardSummary>;
    },
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setLocation(`/boards/${board.id}`);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't create board", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const list = boardsQuery.data ?? [];
    return list.filter((b) => {
      if (tab === "shared" && !b.isShared) return false;
      if (tab === "mine" && b.isShared) return false;
      if (search.trim() && !b.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [boardsQuery.data, tab, search]);

  return (
    <div className="min-h-screen bg-neutral-200/40 flex font-sans text-[13px] text-neutral-900">
      <BoardsSidebar active="boards" />
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-end px-6 pt-4">
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center" data-testid="button-more">
            <MoreVertical className="w-4 h-4 text-neutral-600" />
          </button>
        </header>

        <section className="flex flex-col items-center pt-10 pb-8">
          <h1 className="text-2xl text-neutral-900 mb-5 tracking-tight">What do you want to create today?</h1>
          <div className="w-[560px] bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-neutral-200/80 px-5 py-4">
            <input
              className="w-full bg-transparent outline-none text-[14px] placeholder:text-neutral-400"
              placeholder="Describe what you want to create..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createBoardMutation.mutate(prompt.trim() || undefined);
                }
              }}
              data-testid="input-prompt"
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <button className="text-neutral-500 hover:text-neutral-900" data-testid="button-attach"><Paperclip className="w-4 h-4" /></button>
              <button className="text-neutral-500 hover:text-neutral-900" data-testid="button-mic"><Mic className="w-4 h-4" /></button>
              <button
                onClick={() => createBoardMutation.mutate(prompt.trim() || undefined)}
                disabled={createBoardMutation.isPending}
                className="w-7 h-7 rounded-full bg-neutral-300 hover:bg-neutral-400 disabled:opacity-50 flex items-center justify-center"
                data-testid="button-prompt-send"
              >
                <ArrowUp className="w-3.5 h-3.5 text-neutral-700" />
              </button>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between px-6 mb-4">
          <div className="flex items-center gap-5 text-[13px]">
            {(["all", "shared", "mine"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={tab === t ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}
                data-testid={`tab-${t}`}
              >
                {t === "all" ? "All" : t === "shared" ? "Shared" : "Mine"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-white rounded-full border border-neutral-200 px-3 py-1.5 w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <input
              className="bg-transparent outline-none flex-1 text-[12px]"
              placeholder="Search boards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex-1 px-6 pb-6 overflow-auto">
          {boardsQuery.isLoading ? (
            <div className="grid grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-neutral-100/80 animate-pulse min-h-[220px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-4">
              <NewBoardCard onClick={() => createBoardMutation.mutate(undefined)} />
              {filtered.map((b) => (
                <BoardCard key={b.id} board={b} />
              ))}
              {filtered.length === 0 && (boardsQuery.data?.length ?? 0) > 0 && (
                <div className="col-span-4 flex items-center text-[12px] text-neutral-400 px-4">
                  No boards match your search.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

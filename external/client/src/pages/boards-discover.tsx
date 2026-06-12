import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, MoreVertical, Search } from "lucide-react";
import { BoardsSidebar } from "@/components/boards/BoardsSidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBoardsTheme } from "@/hooks/useBoardsTheme";

import type { ProviderId, GenerationMode } from "@/components/boards/PlatformPicker";

interface Template {
  id: string;
  title: string;
  desc: string;
  hero: string;
  seedPrompt: string;
  seedProvider: ProviderId;
  seedGenerationMode: GenerationMode;
}

const TEMPLATES: Template[] = [
  { id: "thumb-variations", title: "Make Thumbnail Variations", desc: "Generate social media thumbnails for different platforms, moods, and styles.", hero: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=240&fit=crop", seedPrompt: "Generate 6 thumbnail variations of my topic in different moods (bold, soft, playful, premium, retro, futuristic). Square format.", seedProvider: "openai-image", seedGenerationMode: "text-to-video" },
  { id: "redesign-room", title: "Redesign Any Room", desc: "Upload a room photo and explore new styles instantly.", hero: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=240&fit=crop", seedPrompt: "Redesign this room in 4 styles: modern minimalist, mid-century, Scandinavian, and industrial. Keep the same camera angle.", seedProvider: "gemini-image", seedGenerationMode: "text-to-video" },
  { id: "pitch-deck", title: "Build a Tech Pitch Deck", desc: "Design a compelling pitch deck that sells your startup's vision.", hero: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=240&fit=crop", seedPrompt: "Outline a 10-slide tech pitch deck for a startup, then generate cover art for each slide.", seedProvider: "openai-image", seedGenerationMode: "text-to-video" },
  { id: "listing-hero", title: "Listing Photo Hero Sweep", desc: "Turn one listing photo into a cinematic 8s drone-style intro clip.", hero: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=240&fit=crop", seedPrompt: "Turn this listing photo into a cinematic 8-second drone-style intro clip with a slow push-in.", seedProvider: "luma", seedGenerationMode: "image-to-video" },
  { id: "agent-headshot", title: "Agent Headshot Varieties", desc: "Generate a grid of professional headshots with studio lighting.", hero: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=240&fit=crop", seedPrompt: "Generate 4 professional headshot variations with studio lighting: navy background, gray background, outdoor, and editorial.", seedProvider: "openai-image", seedGenerationMode: "text-to-video" },
  { id: "open-house-reel", title: "Open House Reel", desc: "Stitch property photos into a 30-second reel for Instagram + TikTok.", hero: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=240&fit=crop", seedPrompt: "Build a 30-second open-house reel from property photos, vertical 9:16, with smooth ken-burns transitions.", seedProvider: "veo", seedGenerationMode: "image-to-video" },
  { id: "neighborhood-story", title: "Neighborhood Story", desc: "Auto-build a 3-card carousel highlighting nearby schools and parks.", hero: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=240&fit=crop", seedPrompt: "Build a 3-card carousel highlighting nearby schools, parks, and dining for a neighborhood listing.", seedProvider: "gemini-image", seedGenerationMode: "text-to-video" },
  { id: "sold-just-listed", title: "Sold-Just-Listed Combo", desc: "Generate matching sold + just-listed graphics in your brand colors.", hero: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=240&fit=crop", seedPrompt: "Generate matching SOLD and JUST LISTED graphics in my brand colors with the property photo as the hero.", seedProvider: "openai-image", seedGenerationMode: "text-to-video" },
  { id: "daily-special", title: "Restaurant Daily Special", desc: "Produce a tap-worthy dish photo + 1-line caption from one snapshot.", hero: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=240&fit=crop", seedPrompt: "Make my daily-special dish photo look pro and write a 1-line caption that drives orders.", seedProvider: "gemini-image", seedGenerationMode: "text-to-video" },
  { id: "walkthrough-v2v", title: "Property Walk-Through V2V", desc: "Turn a phone walk-through into a polished video using video-to-video.", hero: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=240&fit=crop", seedPrompt: "Take my phone walk-through video and restyle it into a polished, color-graded property tour.", seedProvider: "runway", seedGenerationMode: "video-to-video" },
  { id: "before-after", title: "Before & After Renovation", desc: "Show the same room rendered in three different styles.", hero: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=240&fit=crop", seedPrompt: "Render this room before/after in 3 renovation styles: modern, farmhouse, and luxury.", seedProvider: "gemini-image", seedGenerationMode: "text-to-video" },
  { id: "holiday-email", title: "Holiday Email Header", desc: "Create a season-themed banner sized for Mailchimp + Gmail.", hero: "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=400&h=240&fit=crop", seedPrompt: "Design a 600x200 holiday-themed email header banner that works in Mailchimp and Gmail.", seedProvider: "openai-image", seedGenerationMode: "text-to-video" },
];

export default function BoardsDiscoverPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme } = useBoardsTheme();
  const [search, setSearch] = useState("");

  const launchTemplate = useMutation({
    mutationFn: async (template: Template) => {
      const res = await apiRequest("POST", "/api/boards", {
        title: template.title,
        seedPrompt: template.seedPrompt,
        seedProvider: template.seedProvider,
        seedGenerationMode: template.seedGenerationMode,
        seedTemplateId: template.id,
      });
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (board, template) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      const params = new URLSearchParams({
        seed: template.seedPrompt,
        provider: template.seedProvider,
        mode: template.seedGenerationMode,
        template: template.id,
      });
      setLocation(`/boards/${board.id}?${params.toString()}`);
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't launch template", description: e?.message ?? String(e), variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(
      (t) => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className={`${theme === "dark" ? "dark " : ""}min-h-screen w-full flex bg-neutral-200/40 font-sans text-[13px] text-neutral-900 overflow-hidden dark:bg-neutral-950 dark:text-neutral-100`}>
      <BoardsSidebar active="discover" />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-end px-6 pt-4">
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center dark:hover:bg-neutral-800/60" data-testid="button-more">
            <MoreVertical className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        </header>
        <div className="px-7 py-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-[22px] font-semibold tracking-tight">Discover</h1>
            <div className="relative w-[280px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 dark:text-neutral-500" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-md border border-neutral-200 bg-white outline-none focus:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600"
                placeholder="Search templates"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
          <p className="text-[12px] text-neutral-500 mb-5 dark:text-neutral-400">
            Pre-built starting points. Click one to launch a board with the prompt already set.
          </p>

          <div className="grid grid-cols-4 gap-4">
            {filtered.map((t) => (
              <button
                key={t.id}
                disabled={launchTemplate.isPending}
                onClick={() => launchTemplate.mutate(t)}
                className="text-left rounded-xl overflow-hidden bg-white border border-neutral-200/80 hover:shadow-lg hover:border-neutral-300 transition-all cursor-pointer disabled:opacity-50 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700"
                data-testid={`card-template-${t.id}`}
              >
                <div className="aspect-[16/10] bg-neutral-100 overflow-hidden relative dark:bg-neutral-800">
                  <img src={t.hero} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="text-[13px] font-semibold text-neutral-900 mb-0.5 flex items-center justify-between dark:text-neutral-100">
                    <span>{t.title}</span>
                    <ArrowUpRight className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />
                  </div>
                  <div className="text-[11.5px] text-neutral-500 leading-snug line-clamp-2 dark:text-neutral-400">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

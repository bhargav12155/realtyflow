import { Compass, LayoutGrid, Users, Gauge, Share2, Bell, ChevronDown, Search, ArrowUpRight, MoreVertical } from "lucide-react";

type Card = {
  title: string;
  desc: string;
  hero: string;
  hover?: boolean;
};

const CARDS: Card[] = [
  { title: "Make Thumbnail Variations", desc: "Generate social media thumbnails for different platforms, moods, and styles.", hero: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=240&fit=crop", hover: true },
  { title: "Redesign Any Room", desc: "Upload a room photo and explore new styles instantly.", hero: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&h=240&fit=crop" },
  { title: "Build a Tech Pitch Deck", desc: "Design a compelling pitch deck that sells your startup's vision.", hero: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=240&fit=crop" },
  { title: "Listing Photo Hero Sweep", desc: "Turn one listing photo into a cinematic 8s drone-style intro clip.", hero: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=240&fit=crop" },
  { title: "Agent Headshot Varieties", desc: "Generate a grid of professional headshots with studio lighting.", hero: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=240&fit=crop" },
  { title: "Open House Reel", desc: "Stitch property photos into a 30-second reel for Instagram + TikTok.", hero: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=240&fit=crop" },
  { title: "Neighborhood Story", desc: "Auto-build a 3-card carousel highlighting nearby schools and parks.", hero: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=240&fit=crop" },
  { title: "Sold-Just-Listed Combo", desc: "Generate matching sold + just-listed graphics in your brand colors.", hero: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=240&fit=crop" },
  { title: "Restaurant Daily Special", desc: "Produce a tap-worthy dish photo + 1-line caption from one snapshot.", hero: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=240&fit=crop" },
  { title: "Property Walk-Through V2V", desc: "Turn a phone walk-through into a polished video using video-to-video.", hero: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=240&fit=crop" },
  { title: "Before & After Renovation", desc: "Show the same room rendered in three different styles.", hero: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=240&fit=crop" },
  { title: "Holiday Email Header", desc: "Create a season-themed banner sized for Mailchimp + Gmail.", hero: "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=400&h=240&fit=crop" },
];

// Sidebar mirrors boards-home/Spacious.tsx exactly, with active item switched to Discover.
function Sidebar() {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-white/60 backdrop-blur-sm border-r border-neutral-200/80 flex flex-col">
      <div className="p-3">
        <button className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-neutral-200/60" data-testid="button-workspace">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-semibold">M</div>
          <span className="font-medium flex-1 text-left truncate">Michael Bjork</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        </button>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
          <Share2 className="w-4 h-4" />
          <span>Shared With You</span>
        </button>
        <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>
      </div>

      <div className="px-3 mt-2">
        <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-200/60">
          <div className="w-5 h-5 rounded bg-neutral-800 text-white text-[10px] font-bold flex items-center justify-center">M</div>
          <span className="font-medium flex-1 text-left">Michael's team</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        </button>
      </div>

      <nav className="px-3 mt-1 space-y-0.5">
        <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
          <LayoutGrid className="w-4 h-4" />
          <span>Boards</span>
        </a>
        <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-neutral-200/80 text-neutral-900 font-medium">
          <Compass className="w-4 h-4" />
          <span>Discover</span>
        </a>
        <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
          <Users className="w-4 h-4" />
          <span>Team</span>
        </a>
        <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
          <Gauge className="w-4 h-4" />
          <span>Usage</span>
        </a>
      </nav>

      <div className="mt-auto p-3 text-[11px] text-neutral-400">iMakePage Boards</div>
    </aside>
  );
}

function CardTile({ c }: { c: Card }) {
  return (
    <div className={`group rounded-xl overflow-hidden bg-white border border-neutral-200/80 hover:shadow-lg hover:border-neutral-300 transition-all cursor-pointer ${c.hover ? "shadow-lg ring-1 ring-neutral-300 -translate-y-0.5" : ""}`} data-testid={`card-template-${c.title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="aspect-[16/10] bg-neutral-100 overflow-hidden relative">
        <img src={c.hero} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {c.hover && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center">
            <ArrowUpRight className="w-3.5 h-3.5 text-neutral-700" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[13px] font-semibold text-neutral-900 mb-0.5 flex items-center justify-between">
          <span>{c.title}</span>
          <ArrowUpRight className="w-3 h-3 text-neutral-300 group-hover:text-neutral-600" />
        </div>
        <div className="text-[11.5px] text-neutral-500 leading-snug line-clamp-2">{c.desc}</div>
      </div>
    </div>
  );
}

export function Discover() {
  return (
    <div className="min-h-screen w-full flex bg-neutral-200/40 font-sans text-[13px] text-neutral-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-end px-6 pt-4">
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center" data-testid="button-more">
            <MoreVertical className="w-4 h-4 text-neutral-600" />
          </button>
        </header>
        <div className="px-7 py-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-[22px] font-semibold tracking-tight">Discover</h1>
            <div className="relative w-[280px]">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-md border border-neutral-200 bg-white outline-none focus:border-neutral-400" placeholder="Search templates" data-testid="input-search" />
            </div>
          </div>
          <p className="text-[12px] text-neutral-500 mb-5">Pre-built starting points. Click one to launch a board with the prompt already set.</p>

          <div className="grid grid-cols-4 gap-4">
            {CARDS.map((c) => <CardTile key={c.title} c={c} />)}
          </div>
        </div>
      </main>
    </div>
  );
}

import { Bell, Share2, Search, Plus, Paperclip, Mic, ArrowUp, ChevronDown, Compass, Users, Gauge, MoreVertical, LayoutGrid } from "lucide-react";

type Board = {
  title: string;
  highlight: string;
  edited: string;
  thumbs: string[];
  tint?: string;
};

const BOARDS: Board[] = [
  {
    title: "ENVIRONMENTAL",
    highlight: "TRANSFORMATION",
    edited: "Edited 7 hours ago",
    tint: "from-emerald-100 to-amber-50",
    thumbs: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "WEBSITE IDEAS",
    highlight: "EXPLORATION",
    edited: "Edited 1 day ago",
    tint: "from-slate-200 to-slate-100",
    thumbs: [
      "",
      "https://images.unsplash.com/photo-1467453678174-768ec283a940?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1559523161-0fc0d8b38a7a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1483450388369-9ed95738483c?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "FEMALE HEADSHOT",
    highlight: "VARIATIONS",
    edited: "Edited 3 days ago",
    tint: "from-amber-100 to-rose-50",
    thumbs: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "REAL ESTATE",
    highlight: "SOCIAL MEDIA",
    edited: "Edited 5 days ago",
    tint: "from-orange-100 to-amber-50",
    thumbs: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "LOGO",
    highlight: "REVEAL",
    edited: "Edited 8 days ago",
    tint: "from-stone-200 to-stone-100",
    thumbs: [
      "https://images.unsplash.com/photo-1583912267550-d44c9c4dd5fc?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1579541814924-49fef17c5be5?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "MINI",
    highlight: "ME",
    edited: "Edited 8 days ago",
    tint: "from-rose-100 to-pink-50",
    thumbs: [
      "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1546015720-b8b30df5aa27?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "REAL ESTATE AGENT",
    highlight: "VIDEO",
    edited: "Edited 9 days ago",
    tint: "from-emerald-100 to-teal-50",
    thumbs: [
      "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "HEADSHOT",
    highlight: "VARIETIES",
    edited: "Edited 9 days ago",
    tint: "from-blue-100 to-sky-50",
    thumbs: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    ],
  },
  {
    title: "VIDEO UPLOAD",
    highlight: "PROCESS",
    edited: "Edited 9 days ago",
    tint: "from-emerald-200 to-emerald-50",
    thumbs: [
      "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?w=400&h=400&fit=crop",
    ],
  },
];

function ThumbCollage({ thumbs }: { thumbs: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 w-[148px] h-[148px] flex-shrink-0">
      {thumbs.map((src, i) => (
        <div key={i} className="bg-neutral-300 rounded-md overflow-hidden">
          {src ? (
            <img src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-black" />
          )}
        </div>
      ))}
    </div>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <div className={`bg-gradient-to-br ${board.tint ?? "from-neutral-100 to-neutral-50"} rounded-2xl p-4 hover:ring-2 hover:ring-neutral-300 transition cursor-pointer`}>
      <div className="text-[10px] font-semibold tracking-wider text-neutral-700 mb-0.5">
        {board.title} <span className="text-neutral-900">{board.highlight}</span>
      </div>
      <div className="text-[10px] text-neutral-500 mb-3">{board.edited}</div>
      <ThumbCollage thumbs={board.thumbs} />
    </div>
  );
}

function NewBoardCard() {
  return (
    <div className="bg-neutral-100/70 border border-dashed border-neutral-300 rounded-2xl p-4 flex items-center justify-center min-h-[220px] hover:bg-neutral-200/60 transition cursor-pointer group" data-testid="card-new-board">
      <div className="flex flex-col items-center gap-2">
        <Plus className="w-8 h-8 text-neutral-700" strokeWidth={1.5} />
        <div className="w-9 h-5 rounded-full border border-neutral-400 flex items-center justify-center text-[9px] text-neutral-500">⌘O</div>
      </div>
    </div>
  );
}

export function Spacious() {
  return (
    <div className="min-h-screen bg-neutral-200/40 flex font-sans text-[13px] text-neutral-900">
      {/* Sidebar */}
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
          <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md bg-neutral-200/80 text-neutral-900 font-medium">
            <LayoutGrid className="w-4 h-4" />
            <span>Boards</span>
          </a>
          <a className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-200/60 text-neutral-700">
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

      {/* Main area */}
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-end px-6 pt-4">
          <button className="w-8 h-8 rounded-full hover:bg-neutral-200/60 flex items-center justify-center" data-testid="button-more">
            <MoreVertical className="w-4 h-4 text-neutral-600" />
          </button>
        </header>

        {/* Hero prompt */}
        <section className="flex flex-col items-center pt-10 pb-8">
          <h1 className="text-2xl text-neutral-900 mb-5 tracking-tight">What do you want to create today?</h1>
          <div className="w-[560px] bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-neutral-200/80 px-5 py-4">
            <div className="text-neutral-400 text-[14px]">Describe what you want to create...</div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button className="text-neutral-500 hover:text-neutral-900" data-testid="button-attach"><Paperclip className="w-4 h-4" /></button>
              <button className="text-neutral-500 hover:text-neutral-900" data-testid="button-mic"><Mic className="w-4 h-4" /></button>
              <button className="w-7 h-7 rounded-full bg-neutral-300 hover:bg-neutral-400 flex items-center justify-center" data-testid="button-send">
                <ArrowUp className="w-3.5 h-3.5 text-neutral-700" />
              </button>
            </div>
          </div>
        </section>

        {/* Tabs + search */}
        <div className="flex items-center justify-between px-6 mb-4">
          <div className="flex items-center gap-5 text-[13px]">
            <button className="font-medium text-neutral-900" data-testid="tab-all">All</button>
            <button className="text-neutral-500 hover:text-neutral-900" data-testid="tab-shared">Shared</button>
            <button className="text-neutral-500 hover:text-neutral-900" data-testid="tab-mine">Mine</button>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-full border border-neutral-200 px-3 py-1.5 w-[260px]">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <input className="bg-transparent outline-none flex-1 text-[12px]" placeholder="Search boards..." data-testid="input-search" />
            <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1">⌘K</span>
          </div>
        </div>

        {/* Boards grid */}
        <div className="flex-1 px-6 pb-6 overflow-auto">
          <div className="grid grid-cols-5 gap-4">
            <NewBoardCard />
            {BOARDS.map((b) => (
              <BoardCard key={b.title + b.highlight} board={b} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

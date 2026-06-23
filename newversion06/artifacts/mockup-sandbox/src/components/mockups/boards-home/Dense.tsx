import { Bell, Share2, Search, Plus, Paperclip, Mic, ArrowUp, ChevronDown, Compass, Users, Gauge, LayoutGrid, Sparkles, Image as ImageIcon, Video, Folder, Clock } from "lucide-react";

type Board = {
  title: string;
  highlight: string;
  edited: string;
  count: number;
  kind: "image" | "video";
  thumbs: string[];
};

const BOARDS: Board[] = [
  { title: "ENVIRONMENTAL", highlight: "TRANSFORMATION", edited: "7h", count: 24, kind: "image", thumbs: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=300&h=300&fit=crop"] },
  { title: "WEBSITE IDEAS", highlight: "EXPLORATION", edited: "1d", count: 12, kind: "image", thumbs: ["","https://images.unsplash.com/photo-1467453678174-768ec283a940?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1559523161-0fc0d8b38a7a?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1483450388369-9ed95738483c?w=300&h=300&fit=crop"] },
  { title: "FEMALE HEADSHOT", highlight: "VARIATIONS", edited: "3d", count: 18, kind: "image", thumbs: ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1554151228-14d9def656e4?w=300&h=300&fit=crop"] },
  { title: "REAL ESTATE", highlight: "SOCIAL MEDIA", edited: "5d", count: 32, kind: "video", thumbs: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop"] },
  { title: "LOGO", highlight: "REVEAL", edited: "8d", count: 6, kind: "video", thumbs: ["https://images.unsplash.com/photo-1583912267550-d44c9c4dd5fc?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1579541814924-49fef17c5be5?w=300&h=300&fit=crop"] },
  { title: "MINI", highlight: "ME", edited: "8d", count: 9, kind: "image", thumbs: ["https://images.unsplash.com/photo-1519689680058-324335c77eba?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1546015720-b8b30df5aa27?w=300&h=300&fit=crop"] },
  { title: "REAL ESTATE AGENT", highlight: "VIDEO", edited: "9d", count: 14, kind: "video", thumbs: ["https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1556157382-97eda2d62296?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop"] },
  { title: "HEADSHOT", highlight: "VARIETIES", edited: "9d", count: 21, kind: "image", thumbs: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop"] },
  { title: "VIDEO UPLOAD", highlight: "PROCESS", edited: "9d", count: 11, kind: "video", thumbs: ["https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1494526585095-c41746248156?w=300&h=300&fit=crop"] },
  { title: "MY GOLDEN BRICK", highlight: "30s", edited: "12d", count: 4, kind: "video", thumbs: ["https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop"] },
  { title: "LISTING", highlight: "WALKTHROUGHS", edited: "13d", count: 7, kind: "video", thumbs: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1598228723793-52759bba239c?w=300&h=300&fit=crop","https://images.unsplash.com/photo-1605146768851-eda79da39897?w=300&h=300&fit=crop"] },
];

function ThumbCollage({ thumbs }: { thumbs: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-0.5 w-full aspect-square">
      {thumbs.map((src, i) => (
        <div key={i} className="bg-neutral-800 rounded-sm overflow-hidden">
          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-black" />}
        </div>
      ))}
    </div>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-lg p-2 hover:border-neutral-700 hover:bg-neutral-900 transition cursor-pointer group">
      <div className="text-[9px] font-semibold tracking-wider text-neutral-400 truncate">
        {board.title} <span className="text-neutral-100">{board.highlight}</span>
      </div>
      <div className="text-[9px] text-neutral-500 mb-2 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        <span>Edited {board.edited} ago</span>
        <span className="ml-auto flex items-center gap-0.5 text-neutral-400">
          {board.kind === "video" ? <Video className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
          <span>{board.count}</span>
        </span>
      </div>
      <ThumbCollage thumbs={board.thumbs} />
    </div>
  );
}

function NewBoardCard() {
  return (
    <div className="border border-dashed border-neutral-700 rounded-lg flex items-center justify-center min-h-[180px] hover:border-neutral-500 hover:bg-neutral-900/40 cursor-pointer transition" data-testid="card-new-board">
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center"><Plus className="w-4 h-4 text-neutral-300" /></div>
        <div className="text-[10px] text-neutral-400">New board</div>
      </div>
    </div>
  );
}

export function Dense() {
  return (
    <div className="min-h-screen bg-neutral-950 flex font-sans text-[13px] text-neutral-200">
      {/* Sidebar */}
      <aside className="w-[200px] flex-shrink-0 bg-neutral-900/80 border-r border-neutral-800 flex flex-col">
        <div className="p-2.5">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/80" data-testid="button-workspace">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-[11px] font-semibold">M</div>
            <span className="font-medium flex-1 text-left truncate text-[12px]">Michael Bjork</span>
            <ChevronDown className="w-3 h-3 text-neutral-500" />
          </button>
        </div>

        <div className="px-2.5 space-y-0.5">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-300 text-[12px]">
            <Share2 className="w-3.5 h-3.5" /><span>Shared With You</span>
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-300 text-[12px]">
            <Bell className="w-3.5 h-3.5" /><span>Notifications</span>
            <span className="ml-auto text-[9px] bg-rose-500 text-white rounded-full px-1.5">3</span>
          </button>
        </div>

        <div className="px-2.5 mt-3">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 px-2 mb-1">Workspace</div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-[12px]">
            <div className="w-4 h-4 rounded bg-white text-neutral-900 text-[9px] font-bold flex items-center justify-center">M</div>
            <span className="flex-1 text-left">Michael's team</span>
            <ChevronDown className="w-3 h-3 text-neutral-500" />
          </button>
        </div>

        <nav className="px-2.5 mt-2 space-y-0.5">
          <a className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-neutral-800 text-neutral-50 text-[12px]">
            <LayoutGrid className="w-3.5 h-3.5" /><span>Boards</span>
          </a>
          <a className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-300 text-[12px]">
            <Compass className="w-3.5 h-3.5" /><span>Discover</span>
          </a>
          <a className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-300 text-[12px]">
            <Users className="w-3.5 h-3.5" /><span>Team</span>
          </a>
          <a className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-300 text-[12px]">
            <Gauge className="w-3.5 h-3.5" /><span>Usage</span>
            <span className="ml-auto text-[9px] text-neutral-500">42%</span>
          </a>
        </nav>

        <div className="px-2.5 mt-4">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 px-2 mb-1">Folders</div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 text-[12px]">
            <Folder className="w-3.5 h-3.5" /><span>Listings</span>
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-800/60 text-neutral-400 text-[12px]">
            <Folder className="w-3.5 h-3.5" /><span>Brand assets</span>
          </button>
        </div>

        <div className="mt-auto p-3 text-[10px] text-neutral-600">iMakePage Boards · v0.1</div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Hero prompt */}
        <section className="flex flex-col items-center pt-10 pb-6 px-6">
          <div className="flex items-center gap-1.5 text-[11px] text-violet-300 mb-2">
            <Sparkles className="w-3 h-3" /><span>Any provider · any media</span>
          </div>
          <h1 className="text-xl text-neutral-100 mb-5 tracking-tight">What do you want to create today?</h1>
          <div className="w-full max-w-[640px] bg-neutral-900 rounded-xl border border-neutral-800 px-4 py-3">
            <div className="text-neutral-500 text-[13px]">Describe what you want to create...</div>
            <div className="flex items-center justify-between mt-5">
              <div className="flex items-center gap-1.5">
                <button className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Image</button>
                <button className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Video</button>
                <button className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700">Audio</button>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-neutral-500 hover:text-neutral-200" data-testid="button-attach"><Paperclip className="w-4 h-4" /></button>
                <button className="text-neutral-500 hover:text-neutral-200" data-testid="button-mic"><Mic className="w-4 h-4" /></button>
                <button className="w-6 h-6 rounded-full bg-violet-500 hover:bg-violet-400 flex items-center justify-center" data-testid="button-send">
                  <ArrowUp className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs + search */}
        <div className="flex items-center justify-between px-6 pb-3 border-b border-neutral-900">
          <div className="flex items-center gap-1 text-[12px]">
            <button className="px-3 py-1 rounded-md bg-neutral-800 text-neutral-50 font-medium" data-testid="tab-all">All</button>
            <button className="px-3 py-1 rounded-md text-neutral-400 hover:text-neutral-200" data-testid="tab-shared">Shared</button>
            <button className="px-3 py-1 rounded-md text-neutral-400 hover:text-neutral-200" data-testid="tab-mine">Mine</button>
            <button className="px-3 py-1 rounded-md text-neutral-400 hover:text-neutral-200">Recent</button>
          </div>
          <div className="flex items-center gap-2 bg-neutral-900 rounded-md border border-neutral-800 px-2.5 py-1.5 w-[240px]">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input className="bg-transparent outline-none flex-1 text-[12px] text-neutral-200 placeholder:text-neutral-500" placeholder="Search boards..." data-testid="input-search" />
            <span className="text-[9px] text-neutral-500 border border-neutral-700 rounded px-1">⌘K</span>
          </div>
        </div>

        {/* Boards grid - dense */}
        <div className="flex-1 px-6 py-4 overflow-auto">
          <div className="grid grid-cols-6 gap-3">
            <NewBoardCard />
            {BOARDS.map((b) => (
              <BoardCard key={b.title} board={b} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

import { ArrowLeft, ChevronDown, Settings, Share2, Minus, ThumbsUp, ThumbsDown, Paperclip, Mic, ArrowUp, MousePointer2, Image as ImageIcon, Video, Volume2, Maximize2, Brush, Type, RectangleHorizontal, Circle, HelpCircle, Plus, Minus as MinusIcon, Sparkles, Scissors, Flag, MessageSquare } from "lucide-react";

type Asset = {
  src: string;
  duration?: string;
  flagged?: boolean;
  selected?: boolean;
};

type Batch = {
  label: string;
  assets: Asset[];
};

const BATCHES: Batch[] = [
  {
    label: "Regenerate Group Power Walk Keyframe V1",
    assets: [
      { src: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop" },
    ],
  },
  {
    label: "Generate Videos V2-V5 Solo Owners",
    assets: [
      { src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=300&fit=crop", duration: "5s", selected: true },
      { src: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop", duration: "8s" },
      { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=300&fit=crop", duration: "8s", flagged: true },
      { src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=300&fit=crop", duration: "8s", flagged: true },
      { src: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=400&h=300&fit=crop", duration: "8s", flagged: true },
      { src: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop", duration: "8s" },
    ],
  },
  {
    label: "Generate Videos V6-V7 Property + V8 Poolside",
    assets: [
      { src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop", duration: "8s" },
      { src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop", duration: "8s", flagged: true },
      { src: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400&h=300&fit=crop", duration: "8s" },
    ],
  },
];

function AssetTile({ a }: { a: Asset }) {
  return (
    <div className={`relative rounded-md overflow-hidden bg-neutral-200 group flex-shrink-0 w-[150px] h-[110px] ${a.selected ? "ring-2 ring-blue-500" : ""}`}>
      <img src={a.src} alt="" className="w-full h-full object-cover" />
      {a.duration && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-white/90 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[4px] border-l-black border-y-[3px] border-y-transparent ml-[1px]" />
          </div>
          <span className="font-medium">{a.duration}</span>
        </div>
      )}
      {a.flagged && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 border border-white shadow flex items-center justify-center">
          <Flag className="w-2.5 h-2.5 text-white" strokeWidth={3} fill="white" />
        </div>
      )}
      {a.selected && (
        <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
      )}
    </div>
  );
}

function BatchGroup({ batch }: { batch: Batch }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] text-neutral-500 mb-1.5 ml-1">{batch.label}</div>
      <div className="bg-white/70 backdrop-blur-sm border border-neutral-200/80 rounded-lg p-2.5">
        <div className="flex flex-wrap gap-2">
          {batch.assets.map((a, i) => (
            <AssetTile key={i} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BottomToolbar() {
  const Icon = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
    <button className={`w-8 h-8 rounded-md flex items-center justify-center hover:bg-neutral-200 ${active ? "bg-neutral-900 text-white hover:bg-neutral-800" : "text-neutral-600"}`}>
      {children}
    </button>
  );
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-md border border-neutral-200 px-2 py-1.5 flex items-center gap-0.5">
      <Icon active><MousePointer2 className="w-4 h-4" /></Icon>
      <Icon><ImageIcon className="w-4 h-4" /></Icon>
      <Icon><Video className="w-4 h-4" /></Icon>
      <Icon><Volume2 className="w-4 h-4" /></Icon>
      <div className="w-px h-5 bg-neutral-200 mx-1" />
      <Icon><Maximize2 className="w-4 h-4" /></Icon>
      <Icon><Brush className="w-4 h-4" /></Icon>
      <Icon><Type className="w-4 h-4" /></Icon>
      <Icon><RectangleHorizontal className="w-4 h-4" /></Icon>
      <Icon><div className="w-3.5 h-3.5 rounded-full bg-rose-500" /></Icon>
      <Icon><HelpCircle className="w-4 h-4" /></Icon>
    </div>
  );
}

function ZoomControls() {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-full shadow-sm border border-neutral-200 px-2 py-1 flex items-center gap-1 text-[11px] text-neutral-600">
      <button className="w-5 h-5 rounded hover:bg-neutral-100 flex items-center justify-center"><MinusIcon className="w-3 h-3" /></button>
      <span className="font-medium tabular-nums w-9 text-center">100%</span>
      <button className="w-5 h-5 rounded hover:bg-neutral-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
    </div>
  );
}

function ChatToggle() {
  return (
    <button className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white shadow border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50">
      <MessageSquare className="w-4 h-4" />
    </button>
  );
}

function ChatPanel() {
  return (
    <aside className="w-[360px] flex-shrink-0 bg-white border-l border-neutral-200 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <button className="flex items-center gap-1 font-medium text-[13px] text-neutral-900">
          <span>Website Idea Exploration</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        </button>
        <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center text-neutral-500"><Minus className="w-3.5 h-3.5" /></button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4 text-[13px]">
        {/* User message */}
        <div className="flex justify-end">
          <div className="bg-neutral-100 rounded-2xl rounded-tr-md px-3.5 py-2.5 max-w-[280px] text-neutral-800 leading-relaxed">
            <span>Trim video </span><span className="inline-flex items-center gap-1 align-middle"><span className="w-3 h-3 rounded-full bg-black inline-block" /><span className="text-neutral-500 italic">(untitled)</span></span><span> to keep only the first 3 seconds. Use the video_trim tool: </span><span className="font-mono text-[11px]">video=</span><span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-black inline-block" /><span className="text-neutral-500 italic">(untitled)</span></span><span className="font-mono text-[11px]">, start_seconds=0, duration_seconds=3.</span>
          </div>
        </div>

        {/* AI analyzed pill */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <Sparkles className="w-3 h-3" />
          <span>Analyzed your request</span>
          <span className="text-neutral-400">1s</span>
        </div>

        {/* Action card */}
        <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50/60">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-900">
              <div className="w-2 h-2 rounded-full bg-neutral-900" />
              <span>Trim Logo Reveal to 3s</span>
            </div>
            <span className="text-neutral-400 text-xs">✓</span>
          </div>
          <div className="text-[11px] text-neutral-500 mb-2">Finished generating 1 Asset</div>
          <button className="text-[11px] text-neutral-700 underline mb-2">Show process</button>
          <div className="w-10 h-10 rounded-md bg-black flex items-center justify-center">
            <div className="w-0 h-0 border-l-[7px] border-l-white border-y-[5px] border-y-transparent ml-1" />
          </div>
        </div>

        {/* AI bullet-summary reply */}
        <div className="text-neutral-800 leading-relaxed space-y-1.5">
          <div>Done — here's what I shipped:</div>
          <ul className="space-y-1 pl-1">
            <li className="flex gap-2"><span className="text-neutral-400 mt-0.5">•</span><span>Trimmed the logo reveal to its first 3 seconds <Scissors className="w-3 h-3 inline text-rose-500" /></span></li>
            <li className="flex gap-2"><span className="text-neutral-400 mt-0.5">•</span><span>Placed the new clip next to the original on your canvas <span className="inline-flex items-center gap-1 align-middle"><span className="w-2.5 h-2.5 rounded-full bg-black inline-block" /><span className="text-neutral-500 italic">(untitled)</span></span></span></li>
            <li className="flex gap-2"><span className="text-neutral-400 mt-0.5">•</span><span>Auto-flagged 3 weaker variants from the previous batch</span></li>
          </ul>
        </div>

        {/* Feedback */}
        <div className="flex items-center gap-1 text-neutral-400">
          <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center"><Sparkles className="w-3 h-3" /></button>
          <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center"><ThumbsUp className="w-3 h-3" /></button>
          <button className="w-6 h-6 rounded hover:bg-neutral-100 flex items-center justify-center"><ThumbsDown className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Composer */}
      <div className="px-3 pb-3">
        <div className="border border-neutral-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-start gap-2 px-3 pt-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-300 via-rose-300 to-violet-400 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-[13px] text-neutral-800 placeholder:text-neutral-400 py-0.5"
              placeholder="What do you want to do?"
              data-testid="input-chat"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <button className="flex items-center gap-1 text-[12px] text-neutral-700 hover:bg-neutral-100 rounded-md px-2 py-1" data-testid="toggle-mode">
              <Sparkles className="w-3 h-3 text-violet-500" />
              <span>Create</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
            <div className="flex items-center gap-2">
              <button className="text-neutral-400 hover:text-neutral-700"><Paperclip className="w-3.5 h-3.5" /></button>
              <button className="text-neutral-400 hover:text-neutral-700"><Mic className="w-3.5 h-3.5" /></button>
              <button className="w-6 h-6 rounded-full bg-neutral-200 hover:bg-neutral-300 flex items-center justify-center"><ArrowUp className="w-3 h-3 text-neutral-700" /></button>
            </div>
          </div>
        </div>
        {/* Mode pills below composer to make Brainstorm/Create explicit */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <button className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200">Brainstorm</button>
          <button className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Create</button>
          <span className="text-[10px] text-neutral-400 ml-1">Brainstorm = plan only · Create = execute</span>
        </div>
      </div>
    </aside>
  );
}

export function CanvasChat() {
  return (
    <div className="h-screen w-full bg-neutral-200/40 flex flex-col font-sans text-[13px] text-neutral-900 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white/60 backdrop-blur border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <button className="w-7 h-7 rounded hover:bg-neutral-200/60 flex items-center justify-center" data-testid="button-back"><ArrowLeft className="w-4 h-4 text-neutral-600" /></button>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-neutral-200/60">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-600">WEBSITE IDEA <span className="text-neutral-900">EXPLORATION</span></span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded hover:bg-neutral-200/60 flex items-center justify-center" data-testid="button-settings"><Settings className="w-4 h-4 text-neutral-600" /></button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium" data-testid="button-share">
            <Share2 className="w-3.5 h-3.5" /><span>Share</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas surface */}
        <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] [background-size:18px_18px] bg-neutral-100">
          <div className="absolute inset-0 overflow-auto px-8 py-6">
            {BATCHES.map((b) => (
              <BatchGroup key={b.label} batch={b} />
            ))}
          </div>
          <ZoomControls />
          <BottomToolbar />
          <ChatToggle />
        </main>

        <ChatPanel />
      </div>
    </div>
  );
}

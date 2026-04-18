import { Check, Image as ImageIcon, Film, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Platform = {
  id: string;
  name: string;
  tagline: string;
  v2v: boolean;
  badge?: string;
  accent: string;
  monogram: string;
};

const PLATFORMS: Platform[] = [
  { id: "luma", name: "Luma Ray 2", tagline: "Best motion + camera control", v2v: true, accent: "from-violet-500 to-fuchsia-500", monogram: "L" },
  { id: "runway", name: "Runway Gen-4", tagline: "Cinematic v2v transforms", v2v: true, accent: "from-emerald-500 to-teal-500", monogram: "R" },
  { id: "sora", name: "Sora 2", tagline: "Coherent long shots, natural physics", v2v: false, badge: "OpenAI", accent: "from-neutral-700 to-neutral-900", monogram: "S2" },
  { id: "seedance", name: "Seedance", tagline: "Fast, stylized motion", v2v: false, accent: "from-rose-500 to-orange-500", monogram: "Sd" },
  { id: "veo", name: "Google VEO", tagline: "Photoreal 1080p clips", v2v: false, accent: "from-blue-500 to-sky-500", monogram: "V" },
  { id: "kling", name: "Kling AI", tagline: "Strong character consistency", v2v: false, accent: "from-amber-500 to-yellow-500", monogram: "K" },
];

function PlatformCard({ p, selected }: { p: Platform; selected?: boolean }) {
  return (
    <button
      className={`relative text-left rounded-xl border p-3 bg-white transition-all ${
        selected ? "border-neutral-900 shadow-md ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
      }`}
      data-testid={`platform-${p.id}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.accent} flex-shrink-0 flex items-center justify-center text-white shadow-sm font-bold text-[13px]`}>
          <span>{p.monogram}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-900 truncate">{p.name}</span>
            {p.badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium">{p.badge}</span>}
          </div>
          <div className="text-[11px] text-neutral-500 leading-snug mt-0.5">{p.tagline}</div>
          {p.v2v && <div className="text-[10px] text-emerald-600 font-medium mt-1">Supports video → video</div>}
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-neutral-900 flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

function ModeTabs({ supportV2V }: { supportV2V: boolean }) {
  const Tab = ({ icon: Icon, label, active, hidden }: { icon: LucideIcon; label: string; active?: boolean; hidden?: boolean }) => {
    if (hidden) return null;
    return (
      <button
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-[12px] ${
          active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tab icon={Sparkles} label="Text → Video" active />
      <Tab icon={ImageIcon} label="Image → Video" />
      <Tab icon={Film} label="Video → Video" hidden={!supportV2V} />
      {!supportV2V && (
        <span className="text-[10px] text-neutral-400 italic ml-1">v2v unavailable on this provider</span>
      )}
    </div>
  );
}

function Variant({ title, sub, selectedId }: { title: string; sub: string; selectedId: string }) {
  const sel = PLATFORMS.find((p) => p.id === selectedId)!;
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase mb-0.5">{title}</div>
      <div className="text-[12px] text-neutral-500 mb-3">{sub}</div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.id} p={p} selected={p.id === selectedId} />
        ))}
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <div className="text-[11px] text-neutral-500 mb-2">
          Modes available for <span className="font-semibold text-neutral-700">{sel.name}</span>:
        </div>
        <ModeTabs supportV2V={sel.v2v} />
      </div>
    </div>
  );
}

export function PlatformPicker() {
  return (
    <div className="min-h-screen w-full bg-neutral-50 p-6 font-sans text-neutral-900">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[18px] font-semibold">Platform picker</h1>
          <p className="text-[12px] text-neutral-500 mt-0.5">
            When the user invokes video generation, they pick a provider. Available modes adapt to the selection — only Luma + Runway expose video → video.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Variant title="A · Luma selected" sub="All three modes visible — text → video, image → video, video → video." selectedId="luma" />
          <Variant title="B · Sora 2 selected" sub="Video → video tab is hidden because Sora 2 doesn't support it." selectedId="sora" />
        </div>
      </div>
    </div>
  );
}

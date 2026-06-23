import { Circle, RotateCw, Maximize2, Download, Tag, Ban, Crop, Info, Flag } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=900&h=600&fit=crop";
const ALT = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=600&fit=crop";

function CornerHandles() {
  const dot = "absolute w-2 h-2 bg-white border border-neutral-400 rounded-sm";
  return (
    <>
      <div className={`${dot} -top-1 -left-1`} />
      <div className={`${dot} -top-1 -right-1`} />
      <div className={`${dot} -bottom-1 -left-1`} />
      <div className={`${dot} -bottom-1 -right-1`} />
    </>
  );
}

function Toolbar() {
  const Btn = ({ children, danger }: { children: React.ReactNode; danger?: boolean }) => (
    <button className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 ${danger ? "text-rose-500" : "text-neutral-700"}`}>
      {children}
    </button>
  );
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-md border border-neutral-200 px-1.5 py-1 flex items-center gap-0.5 z-20" data-testid="toolbar-asset">
      <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-900" data-testid="button-animate" title="Animate">
        <span className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-neutral-900 opacity-50 animate-ping" />
          <Circle className="w-3.5 h-3.5 fill-current relative" />
        </span>
      </button>
      <Btn><RotateCw className="w-4 h-4" /></Btn>
      <Btn><Maximize2 className="w-4 h-4" /></Btn>
      <Btn><Download className="w-4 h-4" /></Btn>
      <Btn danger><Tag className="w-4 h-4 fill-rose-500" /></Btn>
      <Btn><Ban className="w-4 h-4" /></Btn>
      <Btn><Crop className="w-4 h-4" /></Btn>
      <Btn><Info className="w-4 h-4" /></Btn>
    </div>
  );
}

function MetaRow() {
  return (
    <div className="absolute -top-6 left-0 right-0 flex justify-between text-[11px] text-neutral-500 px-1">
      <span data-testid="text-asset-name">Unnamed 2026-04-16</span>
      <span data-testid="text-asset-model">Nano Banana Pro</span>
    </div>
  );
}

function FlagDot() {
  return (
    <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white shadow-sm" data-testid="badge-flag" />
  );
}

function TypePill() {
  return (
    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white border border-neutral-200 shadow-sm text-[12px] text-neutral-400">
      Type...
    </div>
  );
}

function RejectionPopup() {
  return (
    <div className="absolute -top-2 -right-3 w-[260px] bg-rose-500 text-white rounded-xl shadow-lg p-3 z-30" data-testid="popup-rejection">
      <div className="flex items-center gap-2 mb-1">
        <Tag className="w-4 h-4 fill-white" />
        <span className="text-[13px] font-bold tracking-wide">REJECTED</span>
        <span className="text-[12px] text-rose-100 font-medium">@agent</span>
      </div>
      <div className="text-[12px] leading-snug mb-2.5">
        Taylor dropped to 82.8%; V1 superior on all metrics
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded-md bg-rose-600/50 text-white text-[12px] font-semibold hover:bg-rose-600/70" data-testid="button-delete">Delete</button>
        <button className="px-3 py-1 rounded-md bg-rose-600/30 text-white text-[12px] font-semibold hover:bg-rose-600/50" data-testid="button-clear">Clear</button>
      </div>
    </div>
  );
}

function VariantCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="text-[11px] font-semibold tracking-wider text-neutral-500 mb-2 uppercase">{title}</div>
      <div className="flex-1 bg-neutral-100 rounded-xl border border-neutral-200/80 p-12 relative overflow-visible bg-[radial-gradient(circle,_rgba(0,0,0,0.06)_1px,_transparent_1px)] [background-size:18px_18px]">
        {children}
      </div>
    </div>
  );
}

export function AssetToolbar() {
  return (
    <div className="min-h-screen w-full bg-white p-8 font-sans">
      <div className="max-w-[1180px] mx-auto">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold text-neutral-900">Asset interaction states</h1>
          <p className="text-[12px] text-neutral-500 mt-0.5">Selected asset (left) and AI-rejected asset with reasoning popup (right).</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Variant A — Selected */}
          <VariantCard title="A · Selected">
            <div className="relative w-full aspect-[3/2] mx-auto" style={{ maxWidth: 460 }}>
              {/* Selection box */}
              <div className="absolute inset-0 ring-1 ring-neutral-400 ring-offset-0 rounded-sm">
                <img src={HERO} alt="" className="w-full h-full object-cover" />
                <CornerHandles />
                <FlagDot />
              </div>
              <MetaRow />
              <Toolbar />
              <TypePill />
            </div>
          </VariantCard>

          {/* Variant B — Rejected */}
          <VariantCard title="B · Rejected with AI reasoning">
            <div className="relative w-full" style={{ maxWidth: 520 }}>
              <div className="flex gap-2 items-start">
                <div className="relative flex-1 aspect-[3/2]">
                  <div className="absolute inset-0 ring-1 ring-neutral-400 rounded-sm">
                    <img src={HERO} alt="" className="w-full h-full object-cover" />
                    <CornerHandles />
                    <FlagDot />
                  </div>
                  <MetaRow />
                  <Toolbar />
                  <TypePill />
                </div>
                {/* Adjacent (lighter, non-selected) sibling on right to anchor popup */}
                <div className="w-[100px] aspect-square rounded-sm overflow-hidden flex-shrink-0">
                  <img src={ALT} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
              <RejectionPopup />
            </div>
          </VariantCard>
        </div>

        {/* Toolbar legend */}
        <div className="mt-8 bg-neutral-50 border border-neutral-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 mb-3 uppercase">Toolbar buttons</div>
          <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-[12px] text-neutral-700">
            <div className="flex items-center gap-2"><Circle className="w-3.5 h-3.5 fill-current" /><span>Animate</span></div>
            <div className="flex items-center gap-2"><RotateCw className="w-3.5 h-3.5" /><span>Regenerate</span></div>
            <div className="flex items-center gap-2"><Maximize2 className="w-3.5 h-3.5" /><span>Fullscreen</span></div>
            <div className="flex items-center gap-2"><Download className="w-3.5 h-3.5" /><span>Download</span></div>
            <div className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /><span>Flag (AI reject)</span></div>
            <div className="flex items-center gap-2"><Ban className="w-3.5 h-3.5" /><span>Cancel / hide</span></div>
            <div className="flex items-center gap-2"><Crop className="w-3.5 h-3.5" /><span>Crop</span></div>
            <div className="flex items-center gap-2"><Info className="w-3.5 h-3.5" /><span>Info / metadata</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

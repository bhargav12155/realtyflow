import { useEffect } from "react";
import { Check, Image as ImageIcon, Film, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";
import type { IconType } from "react-icons";

export type ProviderId =
  | "luma"
  | "runway"
  | "sora2"
  | "seedance"
  | "veo"
  | "kling"
  | "gemini-image"
  | "openai-image"
  | "heygen";

export const PROVIDER_IDS: readonly ProviderId[] = [
  "luma",
  "runway",
  "sora2",
  "seedance",
  "veo",
  "kling",
  "gemini-image",
  "openai-image",
  "heygen",
];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

export type GenerationMode = "text-to-video" | "image-to-video" | "video-to-video";

export interface Platform {
  id: ProviderId;
  name: string;
  tagline: string;
  v2v: boolean;
  badge?: string;
  accent: string;
  brandIcon?: IconType;
  monogram?: string;
}

export const PLATFORMS: Platform[] = [
  { id: "luma", name: "Luma Ray 2", tagline: "Best motion + camera control", v2v: true, accent: "from-violet-500 to-fuchsia-500", monogram: "L" },
  { id: "runway", name: "Runway Gen-4", tagline: "Cinematic v2v transforms", v2v: true, accent: "from-emerald-500 to-teal-500", monogram: "R" },
  { id: "sora2", name: "Sora 2", tagline: "Coherent long shots", v2v: false, badge: "OpenAI", accent: "from-neutral-700 to-neutral-900", brandIcon: SiOpenai },
  { id: "seedance", name: "Seedance", tagline: "Fast, stylized motion", v2v: false, accent: "from-rose-500 to-orange-500", monogram: "Sd" },
  { id: "veo", name: "Google VEO", tagline: "Photoreal 1080p clips", v2v: false, accent: "from-blue-500 to-sky-500", brandIcon: SiGoogle },
  { id: "kling", name: "Kling AI", tagline: "Strong character consistency", v2v: false, accent: "from-amber-500 to-yellow-500", monogram: "K" },
  { id: "openai-image", name: "OpenAI Image", tagline: "Crisp graphics + thumbnails", v2v: false, badge: "Image", accent: "from-zinc-700 to-zinc-900", brandIcon: SiOpenai },
  { id: "gemini-image", name: "Gemini Image", tagline: "Photoreal + text rendering", v2v: false, badge: "Image", accent: "from-blue-400 to-cyan-400", brandIcon: SiGoogle },
  { id: "heygen", name: "HeyGen Avatar", tagline: "Talking-head avatars", v2v: false, badge: "Avatar", accent: "from-pink-500 to-purple-500", monogram: "H" },
];

export function isGenerationMode(value: unknown): value is GenerationMode {
  return value === "text-to-video" || value === "image-to-video" || value === "video-to-video";
}

interface PlatformPickerProps {
  selectedProvider: ProviderId;
  onSelectProvider: (id: ProviderId) => void;
  selectedMode: GenerationMode;
  onSelectMode: (mode: GenerationMode) => void;
}

export function PlatformPicker({ selectedProvider, onSelectProvider, selectedMode, onSelectMode }: PlatformPickerProps) {
  const sel = PLATFORMS.find((p) => p.id === selectedProvider) ?? PLATFORMS[0];

  // Auto-correct mode if v2v becomes invalid for the selected provider.
  // Run as a side effect (not during render) so we never trigger a parent
  // setState while React is still rendering this component.
  useEffect(() => {
    if (selectedMode === "video-to-video" && !sel.v2v) {
      onSelectMode("text-to-video");
    }
  }, [selectedMode, sel.v2v, onSelectMode]);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4" data-testid="picker-platform">
      <div>
        <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase mb-2">Provider</div>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map((p) => {
            const selected = p.id === selectedProvider;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProvider(p.id)}
                className={`relative text-left rounded-xl border p-3 bg-white transition-all ${
                  selected ? "border-neutral-900 shadow-md ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
                }`}
                data-testid={`platform-${p.id}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.accent} flex-shrink-0 flex items-center justify-center text-white shadow-sm font-bold text-[13px]`}>
                    {p.brandIcon ? <p.brandIcon className="w-4 h-4" /> : <span>{p.monogram}</span>}
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
          })}
        </div>
      </div>

      <div className="border-t border-neutral-100 pt-3">
        <div className="text-[11px] text-neutral-500 mb-2">
          Modes available for <span className="font-semibold text-neutral-700">{sel.name}</span>:
        </div>
        <ModeTabs supportV2V={sel.v2v} selected={selectedMode} onSelect={onSelectMode} />
      </div>
    </div>
  );
}

function ModeTabs({
  supportV2V,
  selected,
  onSelect,
}: {
  supportV2V: boolean;
  selected: GenerationMode;
  onSelect: (m: GenerationMode) => void;
}) {
  const Tab = ({ icon: Icon, label, mode, hidden }: { icon: LucideIcon; label: string; mode: GenerationMode; hidden?: boolean }) => {
    if (hidden) return null;
    const active = selected === mode;
    return (
      <button
        onClick={() => onSelect(mode)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-[12px] ${
          active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
        }`}
        data-testid={`mode-${mode}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tab icon={Sparkles} label="Text → Video" mode="text-to-video" />
      <Tab icon={ImageIcon} label="Image → Video" mode="image-to-video" />
      <Tab icon={Film} label="Video → Video" mode="video-to-video" hidden={!supportV2V} />
      {!supportV2V && (
        <span className="text-[10px] text-neutral-400 italic ml-1" data-testid="text-v2v-unavailable">
          v2v unavailable on this provider
        </span>
      )}
    </div>
  );
}

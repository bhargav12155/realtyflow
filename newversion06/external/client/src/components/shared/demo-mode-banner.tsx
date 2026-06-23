import { Info, Sparkles } from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";

export function DemoModeBanner() {
  const { isDemo } = useDemo();

  if (!isDemo) return null;

  return (
    <div 
      className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium"
      data-testid="banner-demo-mode"
    >
      <Sparkles className="h-4 w-4" />
      <span>Demo Mode</span>
      <span className="hidden sm:inline">- Explore all features with sample data</span>
      <Info className="h-4 w-4 ml-2 opacity-70" />
    </div>
  );
}

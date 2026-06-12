import { TabsContent } from "@/components/ui/tabs";
import { VoiceLibraryManager } from "../voice-library-manager";

export function VoiceLibraryTab() {
  return (
    <TabsContent value="voice-library" className="space-y-4">
      <VoiceLibraryManager />
    </TabsContent>
  );
}

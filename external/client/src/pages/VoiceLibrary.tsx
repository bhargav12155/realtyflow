import { VoiceLibraryManager } from "@/components/dashboard/voice-library-manager";

export default function VoiceLibrary() {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Voice Library</h1>
        <p className="text-muted-foreground mt-2">
          Manage your custom voice recordings for AI-generated videos
        </p>
      </div>

      <VoiceLibraryManager />
    </div>
  );
}

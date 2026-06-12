import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Sparkles, Terminal, Upload, Users } from "lucide-react";
import { ActivityLogPanel } from "./photo-avatars/ActivityLogPanel";
import { AddMotionDialog } from "./photo-avatars/AddMotionDialog";
import { AILookDialog } from "./photo-avatars/AILookDialog";
import { DebugPanel } from "./photo-avatars/DebugPanel";
import { EditOutfitDialog } from "./photo-avatars/EditOutfitDialog";
import { GenerateTab } from "./photo-avatars/GenerateTab";
import { GeneratedLooksGrid } from "./photo-avatars/GeneratedLooksGrid";
import { ManageGroupsTab } from "./photo-avatars/ManageGroupsTab";
import { PhotoGalleryDialog } from "./photo-avatars/PhotoGalleryDialog";
import { UploadTab } from "./photo-avatars/UploadTab";
import { VoiceLibraryTab } from "./photo-avatars/VoiceLibraryTab";
import { VoiceRecordTab } from "./photo-avatars/VoiceRecordTab";
import { PhotoAvatarProvider } from "./photo-avatars/context";
import { usePhotoAvatarManager } from "./photo-avatars/hooks";

export function PhotoAvatarManager() {
  const manager = usePhotoAvatarManager();
  const { selectedTab, setSelectedTab, showActivityPanel, setShowActivityPanel } = manager;

  return (
    <PhotoAvatarProvider value={manager}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <Card data-testid="card-photo-avatar-manager" className="flex-1">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Photo Avatar Groups</CardTitle>
                  <CardDescription>
                    Create and manage AI-powered avatar groups from photos for
                    personalized video content
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityPanel(!showActivityPanel)}
                  className="flex items-center gap-1"
                  data-testid="button-toggle-activity-log"
                >
                  <Terminal className="w-4 h-4" />
                  {showActivityPanel ? 'Hide' : 'Show'} Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="generate" data-testid="tab-generate">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Photos
                  </TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-upload">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Avatars
                  </TabsTrigger>
                  <TabsTrigger value="voice" data-testid="tab-voice">
                    <Mic className="w-4 h-4 mr-2" />
                    Voice Recording
                  </TabsTrigger>
                  <TabsTrigger value="voice-library" data-testid="tab-voice-library">
                    <Mic className="w-4 h-4 mr-2" />
                    Voice Library
                  </TabsTrigger>
                  <TabsTrigger value="manage" data-testid="tab-manage">
                    <Users className="w-4 h-4 mr-2" />
                    Manage Groups
                  </TabsTrigger>
                </TabsList>

                <GenerateTab />
                <UploadTab />
                <VoiceRecordTab />
                <VoiceLibraryTab />
                <ManageGroupsTab />
              </Tabs>
            </CardContent>

            <EditOutfitDialog />
            <AILookDialog />
            <AddMotionDialog />
            <PhotoGalleryDialog />
            <DebugPanel />
          </Card>

          <ActivityLogPanel />
        </div>

        <GeneratedLooksGrid />
      </div>
    </PhotoAvatarProvider>
  );
}

export default PhotoAvatarManager;

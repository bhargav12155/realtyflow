import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Check, Mic, MicOff, Play, RotateCcw } from "lucide-react";
import { usePhotoAvatars } from "./context";
import type { AvatarGroup } from "./types";

export function VoiceRecordTab() {
  const m = usePhotoAvatars();
  const {
    avatarGroups,
    selectedGroupForVoice, setSelectedGroupForVoice,
    isRecording, recordedAudio, recordingTime,
    startRecording, stopRecording, playRecording, resetRecording, saveVoiceToGroup,
  } = m;

  return (
    <TabsContent value="voice" className="space-y-4">
      <Alert>
        <Mic className="h-4 w-4" />
        <AlertDescription>
          Record a custom voice for your photo avatars. Your voice will be used
          to generate personalized video content.
        </AlertDescription>
      </Alert>

      {avatarGroups && avatarGroups.length > 0 && (
        <div>
          <Label>Select Avatar Group for Voice</Label>
          <Select
            value={selectedGroupForVoice || ""}
            onValueChange={setSelectedGroupForVoice}
          >
            <SelectTrigger data-testid="select-avatar-group-voice">
              <SelectValue placeholder="Choose an avatar group" />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(avatarGroups) &&
                avatarGroups
                  .filter((g: AvatarGroup) => g.status !== "failed")
                  .map((group: AvatarGroup) => {
                    const statusLabel =
                      group.status === "pending"
                        ? "Processing"
                        : group.status === "completed"
                        ? "Ready"
                        : group.status === "ready" &&
                          group.train_status === "ready"
                        ? "Trained"
                        : group.status === "ready"
                        ? "Ready to Train"
                        : group.status;

                    return (
                      <SelectItem key={group.group_id} value={group.group_id}>
                        <span className="flex items-center justify-between w-full">
                          <span className="font-medium">{group.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({statusLabel})
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="border rounded-lg p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          {!isRecording && !recordedAudio && (
            <>
              <Mic className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Record a 5-15 second voice sample for your avatar
              </p>
              <Button
                onClick={startRecording}
                size="lg"
                className="w-full max-w-xs"
                data-testid="button-start-recording"
              >
                <Mic className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
            </>
          )}

          {isRecording && (
            <>
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-75"></div>
                <div className="relative flex items-center justify-center w-16 h-16 bg-red-500 rounded-full">
                  <MicOff className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-lg font-semibold mb-2">
                Recording... {recordingTime}s
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Speak clearly into your microphone
              </p>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="w-full max-w-xs"
                data-testid="button-stop-recording"
              >
                <MicOff className="w-4 h-4 mr-2" />
                Stop Recording
              </Button>
            </>
          )}

          {recordedAudio && !isRecording && (
            <>
              <Check className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-sm font-semibold mb-4">
                Voice Recording Complete!
              </p>
              <div className="flex gap-2 justify-center mb-4">
                <Button
                  onClick={playRecording}
                  variant="outline"
                  data-testid="button-play-recording"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Recording
                </Button>
                <Button
                  onClick={resetRecording}
                  variant="outline"
                  data-testid="button-re-record"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Re-record
                </Button>
              </div>
              {selectedGroupForVoice && (
                <Button
                  onClick={saveVoiceToGroup}
                  className="w-full max-w-xs"
                  data-testid="button-save-voice"
                >
                  Save Voice to Avatar Group
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {!avatarGroups ||
        (avatarGroups.length === 0 && (
          <Alert>
            <AlertDescription>
              Create an avatar group first before recording a custom voice.
            </AlertDescription>
          </Alert>
        ))}
    </TabsContent>
  );
}

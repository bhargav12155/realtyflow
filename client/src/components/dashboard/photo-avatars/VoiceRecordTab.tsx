import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Check, Mic, MicOff, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { usePhotoAvatars } from "./context";
import type { AvatarGroup } from "./types";
import {
  getDefaultVoiceReadingScript,
  VOICE_RECORDING_MIN_SECONDS,
  VOICE_RECORDING_RECOMMENDED_SECONDS,
} from "./voice-recording-scripts";

export function VoiceRecordTab() {
  const m = usePhotoAvatars();
  const {
    avatarGroups,
    selectedGroupForVoice, setSelectedGroupForVoice,
    isRecording, recordedAudio, recordingTime, isPlayingRecording,
    startRecording, stopRecording, playRecording, pauseRecording, resetRecording, saveVoiceToGroup,
  } = m;

  const activeScript = getDefaultVoiceReadingScript();
  const minDurationReached = recordingTime >= VOICE_RECORDING_MIN_SECONDS;
  const progressValue = Math.min(
    (recordingTime / VOICE_RECORDING_MIN_SECONDS) * 100,
    100
  );
  const hasGroupOptions = Array.isArray(avatarGroups) && avatarGroups.length > 0;
  const canSaveAndClone = !!recordedAudio && !!selectedGroupForVoice && minDurationReached;

  return (
    <TabsContent value="voice" className="space-y-5">
      <Alert className="border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
        <Mic className="h-4 w-4" />
        <AlertDescription>
          Record a guided sample for custom voice cloning. A clear 20-30 second
          take gives the best results.
        </AlertDescription>
      </Alert>

      {hasGroupOptions && (
        <div>
          <Label>Select Avatar Group for Voice Clone</Label>
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

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="border rounded-xl p-5 space-y-4 bg-white dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Reading Script</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Keep this visible while recording for a consistent sample.
              </p>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {activeScript.language} ({activeScript.locale}) · ~{activeScript.estimatedDurationSeconds}s
            </Badge>
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40 p-4 space-y-2">
            {activeScript.lines.map((line, idx) => (
              <p
                key={`${activeScript.id}-${idx}`}
                className="text-sm leading-6 text-gray-700 dark:text-gray-200"
              >
                {line}
              </p>
            ))}
          </div>

          <div className="rounded-lg border bg-gray-50 dark:bg-gray-900 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isRecording ? "Recording..." : recordedAudio ? "Recorded sample" : "Waiting to record"}
              </span>
              <span className="tabular-nums text-gray-600 dark:text-gray-300">
                {recordingTime} / {VOICE_RECORDING_MIN_SECONDS} seconds
              </span>
            </div>
            <Progress value={progressValue} className="h-2" />
            {!minDurationReached ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Please record at least {VOICE_RECORDING_MIN_SECONDS} seconds for a better voice clone.
              </p>
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Minimum recording reached. You can save now or continue recording for even better voice quality.
              </p>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Recommended recording length: {VOICE_RECORDING_RECOMMENDED_SECONDS.min}-{VOICE_RECORDING_RECOMMENDED_SECONDS.max} seconds for best voice quality.
            </p>
          </div>

          <div className="text-center pt-1">
          {!isRecording && !recordedAudio && (
            <>
              <Mic className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Start recording and read the script naturally in one continuous take.
              </p>
              <Button
                onClick={startRecording}
                size="lg"
                className="w-full max-w-xs"
                disabled={!hasGroupOptions}
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
                Speak naturally and continue reading the guided script.
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
                Voice Recording Complete
              </p>
              <div className="flex gap-2 justify-center mb-4">
                <Button
                  onClick={isPlayingRecording ? pauseRecording : playRecording}
                  variant="outline"
                  data-testid="button-play-recording"
                >
                  {isPlayingRecording ? (
                    <Pause className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {isPlayingRecording ? "Pause" : "Play"}
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
              <Button
                onClick={saveVoiceToGroup}
                className="w-full max-w-xs"
                disabled={!canSaveAndClone}
                data-testid="button-save-voice"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Save & Clone
              </Button>
              {!selectedGroupForVoice && (
                <p className="text-xs text-gray-500 mt-2">
                  Select an avatar group to save this recording.
                </p>
              )}
              {selectedGroupForVoice && !minDurationReached && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Please record at least {VOICE_RECORDING_MIN_SECONDS} seconds for a better voice clone.
                </p>
              )}
            </>
          )}
        </div>
      </div>

        <div className="border rounded-xl p-5 bg-white dark:bg-neutral-950 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline">Recording Tips</Badge>
          </div>
          <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-2 list-disc pl-5">
            <li>Speak naturally and at a steady pace.</li>
            <li>Read the script continuously in one take.</li>
            <li>Record in a quiet room.</li>
            <li>Avoid background noise and interruptions.</li>
            <li>Keep your microphone at a consistent distance.</li>
          </ul>
        </div>
      </div>

      {(!avatarGroups || avatarGroups.length === 0) && (
        <Alert>
          <AlertDescription>
            Create an avatar group first before recording and cloning a custom voice.
          </AlertDescription>
        </Alert>
      )}
    </TabsContent>
  );
}

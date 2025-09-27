import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Camera, Users, Sparkles, Loader2, Check, X, AlertCircle, Image, UserPlus, Wand2, Mic, MicOff, Play, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AvatarGroup {
  group_id: string;
  name: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  created_at: string;
  avatar_count?: number;
  training_progress?: number;
}

interface PhotoGenerationRequest {
  name: string;
  age: 'Child' | 'Young Adult' | 'Middle Age' | 'Senior';
  gender: 'Man' | 'Woman' | 'Person';
  ethnicity: string;
  orientation: 'horizontal' | 'vertical';
  pose: 'full_body' | 'half_body' | 'close_up';
  style: 'Realistic' | 'Artistic' | 'Professional';
  appearance: string;
}

export function PhotoAvatarManager() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('generate');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedGroupForVoice, setSelectedGroupForVoice] = useState<string | null>(null);
  const [generationForm, setGenerationForm] = useState<PhotoGenerationRequest>({
    name: 'Mike Bjork Professional Avatar',
    age: 'Middle Age',
    gender: 'Man',
    ethnicity: 'Caucasian',
    orientation: 'vertical',
    pose: 'half_body',
    style: 'Professional',
    appearance: 'Professional real estate agent, well-groomed, confident smile, business attire'
  });

  // Query avatar groups
  const { data: avatarGroups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['/api/photo-avatars/groups'],
    refetchInterval: (data) => {
      // Refetch every 5 seconds if any group is processing
      if (!Array.isArray(data)) return false;
      const hasProcessing = data.some((g: AvatarGroup) => g.status === 'processing');
      return hasProcessing ? 5000 : false;
    }
  });

  // Generate AI photos
  const generatePhotosMutation = useMutation({
    mutationFn: (data: PhotoGenerationRequest) =>
      apiRequest('/api/photo-avatars/generate-photos', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (data) => {
      toast({
        title: "Photo Generation Started",
        description: `Generating 5 AI photos for ${generationForm.name}. This may take a few minutes.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photo-avatars/groups'] });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to start photo generation. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Upload custom photos
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      
      const response = await fetch('/api/photo-avatars/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Photo Uploaded",
        description: "Photo uploaded successfully. You can now create an avatar group.",
      });
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create avatar group
  const createGroupMutation = useMutation({
    mutationFn: ({ name, imageKey }: { name: string; imageKey: string }) =>
      apiRequest('/api/photo-avatars/groups', {
        method: 'POST',
        body: JSON.stringify({ name, imageKey })
      }),
    onSuccess: () => {
      toast({
        title: "Avatar Group Created",
        description: "Avatar group has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photo-avatars/groups'] });
    }
  });

  // Train avatar group
  const trainGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest(`/api/photo-avatars/groups/${groupId}/train`, {
        method: 'POST'
      }),
    onSuccess: () => {
      toast({
        title: "Training Started",
        description: "Avatar training has started. This process will take 15-30 minutes.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photo-avatars/groups'] });
    }
  });

  // Generate new looks
  const generateLooksMutation = useMutation({
    mutationFn: ({ groupId, numLooks }: { groupId: string; numLooks: number }) =>
      apiRequest(`/api/photo-avatars/groups/${groupId}/generate-looks`, {
        method: 'POST',
        body: JSON.stringify({ numLooks })
      }),
    onSuccess: () => {
      toast({
        title: "Generating New Looks",
        description: "New avatar looks are being generated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photo-avatars/groups'] });
    }
  });

  // Delete avatar group
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiRequest(`/api/photo-avatars/groups/${groupId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast({
        title: "Group Deleted",
        description: "Avatar group has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/photo-avatars/groups'] });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(files);
  };

  const handleUploadFiles = async () => {
    for (const file of uploadedFiles) {
      await uploadPhotoMutation.mutateAsync(file);
    }
    setUploadedFiles([]);
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingTime(elapsed);
        
        // Auto-stop after 15 seconds
        if (elapsed >= 15) {
          stopRecording();
        }
      }, 100);
      
      recorder.onstop = () => {
        clearInterval(timer);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check your permissions.",
        variant: "destructive"
      });
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };
  
  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };
  
  const resetRecording = () => {
    setRecordedAudio(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };
  
  const saveVoiceToGroup = async () => {
    if (!recordedAudio || !selectedGroupForVoice) {
      toast({
        title: "Missing Data",
        description: "Please select an avatar group and record a voice sample.",
        variant: "destructive"
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('voiceRecording', recordedAudio, 'voice.webm');
    formData.append('groupId', selectedGroupForVoice);
    
    try {
      const response = await fetch(`/api/photo-avatars/groups/${selectedGroupForVoice}/voice`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        toast({
          title: "Voice Saved",
          description: "Voice recording has been saved to the avatar group.",
        });
        resetRecording();
        setSelectedGroupForVoice(null);
      } else {
        throw new Error('Failed to save voice');
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save voice recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'processing': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card data-testid="card-photo-avatar-manager">
      <CardHeader>
        <CardTitle>Photo Avatar Groups</CardTitle>
        <CardDescription>
          Create and manage AI-powered avatar groups from photos for personalized video content
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate AI Photos
            </TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Photos
            </TabsTrigger>
            <TabsTrigger value="voice" data-testid="tab-voice">
              <Mic className="w-4 h-4 mr-2" />
              Voice Recording
            </TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage">
              <Users className="w-4 h-4 mr-2" />
              Manage Groups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={generationForm.name}
                  onChange={(e) => setGenerationForm({ ...generationForm, name: e.target.value })}
                  placeholder="Avatar name..."
                  data-testid="input-avatar-name"
                />
              </div>
              
              <div>
                <Label>Age Range</Label>
                <Select
                  value={generationForm.age}
                  onValueChange={(value) => setGenerationForm({ ...generationForm, age: value as any })}
                >
                  <SelectTrigger data-testid="select-age">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Child">Child</SelectItem>
                    <SelectItem value="Young Adult">Young Adult</SelectItem>
                    <SelectItem value="Middle Age">Middle Age</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Gender</Label>
                <Select
                  value={generationForm.gender}
                  onValueChange={(value) => setGenerationForm({ ...generationForm, gender: value as any })}
                >
                  <SelectTrigger data-testid="select-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Man">Man</SelectItem>
                    <SelectItem value="Woman">Woman</SelectItem>
                    <SelectItem value="Person">Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Ethnicity</Label>
                <Input
                  value={generationForm.ethnicity}
                  onChange={(e) => setGenerationForm({ ...generationForm, ethnicity: e.target.value })}
                  placeholder="e.g., Caucasian, Asian, African..."
                  data-testid="input-ethnicity"
                />
              </div>
              
              <div>
                <Label>Orientation</Label>
                <Select
                  value={generationForm.orientation}
                  onValueChange={(value) => setGenerationForm({ ...generationForm, orientation: value as any })}
                >
                  <SelectTrigger data-testid="select-orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Pose</Label>
                <Select
                  value={generationForm.pose}
                  onValueChange={(value) => setGenerationForm({ ...generationForm, pose: value as any })}
                >
                  <SelectTrigger data-testid="select-pose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_body">Full Body</SelectItem>
                    <SelectItem value="half_body">Half Body</SelectItem>
                    <SelectItem value="close_up">Close Up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Style</Label>
                <Select
                  value={generationForm.style}
                  onValueChange={(value) => setGenerationForm({ ...generationForm, style: value as any })}
                >
                  <SelectTrigger data-testid="select-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Realistic">Realistic</SelectItem>
                    <SelectItem value="Artistic">Artistic</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Appearance Description</Label>
              <Textarea
                value={generationForm.appearance}
                onChange={(e) => setGenerationForm({ ...generationForm, appearance: e.target.value })}
                placeholder="Describe the appearance in detail..."
                rows={3}
                data-testid="textarea-appearance"
              />
            </div>
            
            <Button
              onClick={() => generatePhotosMutation.mutate(generationForm)}
              disabled={generatePhotosMutation.isPending}
              className="w-full"
              data-testid="button-generate"
            >
              {generatePhotosMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Photos...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Generate 5 AI Photos
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload 5-20 high-quality photos of the same person from different angles for best results.
                Photos should be clear, well-lit, and show the face clearly.
              </AlertDescription>
            </Alert>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="photo-upload"
              />
              <label
                htmlFor="photo-upload"
                className="cursor-pointer flex flex-col items-center"
                data-testid="label-upload"
              >
                <Image className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Click to upload photos</span>
                <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB each</span>
              </label>
            </div>
            
            {uploadedFiles.length > 0 && (
              <>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUploadedFiles(files => files.filter((_, i) => i !== index))}
                        data-testid={`button-remove-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <Button
                  onClick={handleUploadFiles}
                  disabled={uploadPhotoMutation.isPending}
                  className="w-full"
                  data-testid="button-upload-files"
                >
                  {uploadPhotoMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload {uploadedFiles.length} Photo{uploadedFiles.length > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="voice" className="space-y-4">
            <Alert>
              <Mic className="h-4 w-4" />
              <AlertDescription>
                Record a custom voice for your photo avatars. Your voice will be used to generate personalized video content.
              </AlertDescription>
            </Alert>

            {/* Select Avatar Group */}
            {avatarGroups && avatarGroups.length > 0 && (
              <div>
                <Label>Select Avatar Group for Voice</Label>
                <Select value={selectedGroupForVoice || ''} onValueChange={setSelectedGroupForVoice}>
                  <SelectTrigger data-testid="select-avatar-group-voice">
                    <SelectValue placeholder="Choose an avatar group" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(avatarGroups) && avatarGroups
                      .filter((g: AvatarGroup) => g.status === 'ready')
                      .map((group: AvatarGroup) => (
                        <SelectItem key={group.group_id} value={group.group_id}>
                          {group.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Recording Interface */}
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
                    <p className="text-lg font-semibold mb-2">Recording... {recordingTime}s</p>
                    <p className="text-sm text-gray-500 mb-4">Speak clearly into your microphone</p>
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
                    <p className="text-sm font-semibold mb-4">Voice Recording Complete!</p>
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

            {!avatarGroups || avatarGroups.length === 0 && (
              <Alert>
                <AlertDescription>
                  Create an avatar group first before recording a custom voice.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {isLoadingGroups ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading avatar groups...</p>
              </div>
            ) : !avatarGroups || avatarGroups.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No avatar groups found. Generate AI photos or upload your own to get started.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {Array.isArray(avatarGroups) && avatarGroups.map((group: AvatarGroup) => (
                  <div
                    key={group.group_id}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`card-group-${group.group_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{group.name}</h3>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(group.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(group.status)}>
                        {group.status}
                      </Badge>
                    </div>
                    
                    {group.status === 'processing' && group.training_progress && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Training Progress</span>
                          <span>{group.training_progress}%</span>
                        </div>
                        <Progress value={group.training_progress} />
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {group.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => trainGroupMutation.mutate(group.group_id)}
                          disabled={trainGroupMutation.isPending}
                          data-testid={`button-train-${group.group_id}`}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Start Training
                        </Button>
                      )}
                      
                      {group.status === 'ready' && (
                        <Button
                          size="sm"
                          onClick={() => generateLooksMutation.mutate({ groupId: group.group_id, numLooks: 3 })}
                          disabled={generateLooksMutation.isPending}
                          data-testid={`button-looks-${group.group_id}`}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Generate New Looks
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteGroupMutation.mutate(group.group_id)}
                        disabled={deleteGroupMutation.isPending}
                        data-testid={`button-delete-${group.group_id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
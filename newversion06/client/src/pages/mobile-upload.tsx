import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Video, Upload, CheckCircle, AlertCircle, Camera, Loader2 } from "lucide-react";

interface SessionStatus {
  valid: boolean;
  uploadType: "training" | "consent";
  uploadTypeLabel: string;
  expiresAt?: string;
}

export default function MobileUploadPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const { data: sessionStatus, isLoading, error } = useQuery<SessionStatus>({
    queryKey: [`/api/mobile-upload/${sessionId}`],
    enabled: !!sessionId,
    retry: false,
  });

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleRecordVideo = () => {
    if (recordInputRef.current) {
      recordInputRef.current.value = "";
      recordInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus("idle");
      setErrorMessage("");
    }
  };

  const checkForFile = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    const file = inputRef.current?.files?.[0];
    if (file && !selectedFile) {
      setSelectedFile(file);
      setUploadStatus("idle");
      setErrorMessage("");
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setTimeout(() => {
          checkForFile(recordInputRef);
          checkForFile(fileInputRef);
        }, 300);
      }
    };

    const handleFocus = () => {
      setTimeout(() => {
        checkForFile(recordInputRef);
        checkForFile(fileInputRef);
      }, 300);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedFile]);

  const handleUpload = async () => {
    if (!selectedFile || !sessionId) return;

    setUploadStatus("uploading");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadStatus("success");
          setUploadProgress(100);
        } else {
          const errorResponse = JSON.parse(xhr.responseText);
          setUploadStatus("error");
          setErrorMessage(errorResponse.error || "Upload failed. Please try again.");
        }
      });

      xhr.addEventListener("error", () => {
        setUploadStatus("error");
        setErrorMessage("Network error. Please check your connection and try again.");
      });

      xhr.open("POST", `/api/mobile-upload/${sessionId}/upload`);
      xhr.send(formData);
    } catch (err) {
      setUploadStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4" data-testid="loading-container">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground" data-testid="text-loading">Loading session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle network errors separately from expired sessions
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4" data-testid="error-container">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-destructive" data-testid="text-error-title">Connection Error</CardTitle>
            <CardDescription className="text-base" data-testid="text-error-description">
              Unable to connect to the server. Please check your internet connection and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              data-testid="button-retry"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle expired or invalid sessions
  if (!sessionStatus?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4" data-testid="expired-container">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-destructive" data-testid="text-expired-title">Session Expired</CardTitle>
            <CardDescription className="text-base" data-testid="text-expired-description">
              This upload link is no longer valid. Please scan a new QR code to continue.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (uploadStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4" data-testid="success-container">
        <Card className="w-full max-w-md border-green-500">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 animate-in zoom-in duration-300">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 animate-in zoom-in duration-500 delay-150" />
            </div>
            <CardTitle className="text-green-600 dark:text-green-400 text-2xl" data-testid="text-success-title">
              Upload Complete!
            </CardTitle>
            <CardDescription className="text-base mt-2" data-testid="text-success-description">
              Your {sessionStatus.uploadTypeLabel} has been uploaded successfully. You can close this page now.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4" data-testid="upload-container">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Video className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl" data-testid="text-upload-title">
            Upload {sessionStatus.uploadTypeLabel}
          </CardTitle>
          <CardDescription className="text-base" data-testid="text-upload-description">
            {sessionStatus.uploadType === "training" 
              ? "Record or select a video for your AI avatar training"
              : "Record or select your consent video"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            onBlur={() => checkForFile(fileInputRef)}
            className="hidden"
            data-testid="input-file"
          />
          <input
            ref={recordInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileChange}
            onBlur={() => checkForFile(recordInputRef)}
            onClick={() => {
              setTimeout(() => checkForFile(recordInputRef), 500);
            }}
            className="hidden"
            data-testid="input-record"
          />

          {!selectedFile ? (
            <div className="space-y-4">
              <Button
                onClick={handleRecordVideo}
                variant="default"
                className="w-full h-20 flex items-center justify-center gap-3 text-lg"
                data-testid="button-record-video"
              >
                <Camera className="h-8 w-8" />
                <span className="font-medium">Record New Video</span>
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button
                onClick={handleFileSelect}
                variant="outline"
                className="w-full h-20 flex items-center justify-center gap-3 text-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
                data-testid="button-select-video"
              >
                <Video className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">Choose from Gallery</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg" data-testid="selected-file-info">
                <Video className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid="text-filename">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-filesize">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>

              {uploadStatus === "uploading" && (
                <div className="space-y-2" data-testid="upload-progress-container">
                  <Progress value={uploadProgress} className="h-3" />
                  <p className="text-center text-sm text-muted-foreground" data-testid="text-progress">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg" data-testid="error-message">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleFileSelect}
                  className="flex-1 h-14"
                  disabled={uploadStatus === "uploading"}
                  data-testid="button-change-video"
                >
                  Change
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1 h-14 text-lg"
                  disabled={uploadStatus === "uploading"}
                  data-testid="button-upload"
                >
                  {uploadStatus === "uploading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Uploading
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

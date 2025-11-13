import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload, X, CheckCircle } from "lucide-react";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  acceptedFileTypes?: string;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (uploadedFileUrl: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  disabled?: boolean;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  acceptedFileTypes = "image/*",
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  disabled = false,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate file size
    const oversizedFiles = files.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large. Maximum file size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
      return;
    }

    // Limit number of files
    const filesToAdd = files.slice(0, maxNumberOfFiles);
    setSelectedFiles(filesToAdd);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File) => {
    try {
      const uploadParams = await onGetUploadParameters();
      
      const response = await fetch(uploadParams.url, {
        method: uploadParams.method,
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return uploadParams.url.split('?')[0]; // Remove query parameters to get the file URL
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      let uploadedUrl = '';
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        uploadedUrl = await uploadFile(file);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }

      setUploadComplete(true);
      
      // Call completion callback with the last uploaded file URL
      if (onComplete && uploadedUrl) {
        onComplete(uploadedUrl);
      }

      // Reset after a short delay
      setTimeout(() => {
        setShowModal(false);
        setSelectedFiles([]);
        setUploadComplete(false);
        setUploadProgress(0);
      }, 1500);
      
    } catch (error) {
      alert('Upload failed. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        disabled={disabled}
      >
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Select files to upload to your brand assets or documents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!uploadComplete && !uploading && (
              <>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Drag files here or click to browse
                    </p>
                    <Button variant="outline" asChild>
                      <label>
                        Browse Files
                        <input
                          type="file"
                          multiple={maxNumberOfFiles > 1}
                          accept={acceptedFileTypes}
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max {maxNumberOfFiles} file(s), up to {Math.round(maxFileSize / 1024 / 1024)}MB each
                  </p>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Files:</p>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded overflow-hidden">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm truncate" title={file.name}>{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={handleUpload}
                      className="w-full"
                      disabled={selectedFiles.length === 0}
                    >
                      Upload {selectedFiles.length} file(s)
                    </Button>
                  </div>
                )}
              </>
            )}

            {uploading && (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Uploading...</p>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}% complete</p>
                </div>
              </div>
            )}

            {uploadComplete && (
              <div className="text-center space-y-4">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-600">Upload Complete!</p>
                  <p className="text-xs text-muted-foreground">Files uploaded successfully</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
import { apiRequest } from "./queryClient";

export type BoardUploadKind = "image" | "video" | "audio";

export interface BoardUploadResult {
  id: string;
  assetUrl: string;
  kind: BoardUploadKind;
}

function detectKind(file: File): BoardUploadKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Upload a single user-picked file to a board, reusing the existing
 * /api/objects/upload signed-PUT pipeline and the board asset create
 * endpoint. Skips files whose MIME isn't an image/video so the bottom
 * toolbar's accept filter is enforced even if the picker is bypassed.
 */
export async function uploadFileToBoard(
  boardId: string,
  file: File,
): Promise<BoardUploadResult | null> {
  const kind = detectKind(file);
  if (!kind) return null;

  const fallbackContentType =
    kind === "image" ? "image/jpeg" : kind === "video" ? "video/mp4" : "audio/webm";
  const uploadInfoRes = await apiRequest("POST", "/api/objects/upload", {
    contentType: file.type || fallbackContentType,
    fileName: file.name,
  });
  const uploadInfo = (await uploadInfoRes.json()) as {
    uploadURL: string | null;
    fileUrl: string;
  };
  if (!uploadInfo.uploadURL || !uploadInfo.fileUrl) {
    throw new Error("Upload URL was not returned by the server");
  }

  const putRes = await fetch(uploadInfo.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
  }

  const batchId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tileWidth = kind === "image" ? 256 : kind === "video" ? 320 : 240;
  const tileHeight = kind === "image" ? 256 : kind === "video" ? 180 : 80;

  const createRes = await apiRequest("POST", `/api/boards/${boardId}/assets`, {
    batchId,
    batchLabel: `Uploaded ${kind}`,
    kind,
    provider: "upload",
    status: "ready",
    assetUrl: uploadInfo.fileUrl,
    thumbnailUrl: kind === "image" ? uploadInfo.fileUrl : null,
    positionX: 40,
    positionY: 40,
    width: tileWidth,
    height: tileHeight,
  });
  const created = (await createRes.json()) as { id: string };
  return { id: created.id, assetUrl: uploadInfo.fileUrl, kind };
}

/**
 * Upload all files in the list, swallowing per-file errors so one bad file
 * doesn't kill the rest. Returns the list of successful results.
 */
export async function uploadFilesToBoard(
  boardId: string,
  files: FileList | File[],
  onError?: (file: File, err: unknown) => void,
): Promise<BoardUploadResult[]> {
  const out: BoardUploadResult[] = [];
  const arr = Array.from(files);
  for (const file of arr) {
    try {
      const result = await uploadFileToBoard(boardId, file);
      if (result) out.push(result);
    } catch (err) {
      if (onError) onError(file, err);
      else console.error("[boardUpload] failed:", err);
    }
  }
  return out;
}

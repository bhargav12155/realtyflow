import { apiRequest } from "./queryClient";

export type BoardUploadKind = "image" | "video" | "audio";

export interface BoardUploadResult {
  id: string;
  assetUrl: string;
  kind: BoardUploadKind;
}

export interface BoardUploadOptions {
  /** Called as the PUT body uploads; `percent` is 0-100. Only fires when the
   * browser reports a computable length (which it does for File bodies). */
  onProgress?: (percent: number) => void;
  /** Optional signal to abort the in-flight signed PUT. When aborted, the
   * upload promise rejects with a `BoardUploadCancelledError` and no board
   * asset row is created. */
  signal?: AbortSignal;
}

/** Sentinel error thrown when a caller aborts an upload via `options.signal`.
 * Pages can detect this with `isBoardUploadCancelled(err)` to skip the
 * destructive failure toast for user-initiated cancels. */
export class BoardUploadCancelledError extends Error {
  constructor(message = "Upload cancelled") {
    super(message);
    this.name = "BoardUploadCancelledError";
  }
}

export function isBoardUploadCancelled(err: unknown): boolean {
  return err instanceof BoardUploadCancelledError;
}

function detectKind(file: File): BoardUploadKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/** PUT a File to a signed URL via XHR so we can surface upload progress to
 * the UI. `fetch()` doesn't expose request-body progress in browsers yet. */
function putWithProgress(
  url: string,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new BoardUploadCancelledError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    let cancelled = false;
    const onAbortSignal = () => {
      cancelled = true;
      xhr.abort();
    };
    if (signal) signal.addEventListener("abort", onAbortSignal);
    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbortSignal);
    };
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Upload failed: network error"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(
        cancelled
          ? new BoardUploadCancelledError()
          : new Error("Upload aborted"),
      );
    };
    xhr.send(file);
  });
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
  options: BoardUploadOptions = {},
): Promise<BoardUploadResult | null> {
  const kind = detectKind(file);
  if (!kind) return null;

  if (options.signal?.aborted) throw new BoardUploadCancelledError();

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

  await putWithProgress(
    uploadInfo.uploadURL,
    file,
    options.onProgress,
    options.signal,
  );

  if (options.signal?.aborted) throw new BoardUploadCancelledError();

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
  options.onProgress?.(100);
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const apiRequestMock = vi.fn();
vi.mock("../queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

import { uploadFileToBoard } from "../boardUpload";

interface FakeUpload {
  onprogress: ((e: ProgressEvent) => void) | null;
}

interface FakeXhr {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  upload: FakeUpload;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  status: number;
  statusText: string;
}

function installFakeXhr(): { instances: FakeXhr[]; restore: () => void } {
  const instances: FakeXhr[] = [];
  const original = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  class XHR implements FakeXhr {
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    upload: FakeUpload = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    statusText = "";
    constructor() {
      instances.push(this);
    }
  }
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest =
    XHR as unknown as typeof XMLHttpRequest;
  return {
    instances,
    restore: () => {
      (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = original;
    },
  };
}

beforeEach(() => {
  apiRequestMock.mockReset();
});

describe("uploadFileToBoard", () => {
  let xhrCtl: ReturnType<typeof installFakeXhr>;
  beforeEach(() => {
    xhrCtl = installFakeXhr();
  });
  afterEach(() => {
    xhrCtl.restore();
  });

  it("emits onProgress callbacks during PUT and resolves with the created asset id", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        json: async () => ({
          uploadURL: "https://signed.example/put",
          fileUrl: "https://cdn.example/img.png",
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ id: "asset-123" }),
      });

    const file = new File([new Uint8Array(1024)], "pic.png", {
      type: "image/png",
    });
    const onProgress = vi.fn();

    const promise = uploadFileToBoard("board-1", file, { onProgress });

    // Wait for the first apiRequest (signed-URL fetch) to resolve and for
    // the XHR PUT to be opened.
    await new Promise((r) => setTimeout(r, 0));
    expect(xhrCtl.instances).toHaveLength(1);
    const xhr = xhrCtl.instances[0];

    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://signed.example/put");
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "image/png",
    );
    expect(xhr.send).toHaveBeenCalledWith(file);

    // Drive a couple of progress events through the upload object.
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 256,
      total: 1024,
    } as ProgressEvent);
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 1024,
      total: 1024,
    } as ProgressEvent);
    // A non-computable progress event must be ignored.
    xhr.upload.onprogress?.({
      lengthComputable: false,
      loaded: 0,
      total: 0,
    } as ProgressEvent);

    // 256/1024 = 25%, 1024/1024 = clamped to 99% mid-upload.
    expect(onProgress).toHaveBeenNthCalledWith(1, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 99);

    // Complete the PUT successfully so the create-asset call kicks off.
    xhr.status = 200;
    xhr.statusText = "OK";
    xhr.onload?.();

    const result = await promise;
    expect(result).toEqual({
      id: "asset-123",
      assetUrl: "https://cdn.example/img.png",
      kind: "image",
    });
    // The final 100% pulse should fire after the asset is created.
    expect(onProgress).toHaveBeenLastCalledWith(100);

    // Confirm the second apiRequest hits the board's asset endpoint.
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    const [method, url, body] = apiRequestMock.mock.calls[1];
    expect(method).toBe("POST");
    expect(url).toBe("/api/boards/board-1/assets");
    expect(body).toMatchObject({
      kind: "image",
      provider: "upload",
      assetUrl: "https://cdn.example/img.png",
    });
  });

  it("rejects with the XHR status when the PUT fails", async () => {
    apiRequestMock.mockResolvedValueOnce({
      json: async () => ({
        uploadURL: "https://signed.example/put",
        fileUrl: "https://cdn.example/x.mp4",
      }),
    });

    const file = new File([new Uint8Array(8)], "clip.mp4", {
      type: "video/mp4",
    });
    const promise = uploadFileToBoard("board-2", file);

    await new Promise((r) => setTimeout(r, 0));
    const xhr = xhrCtl.instances[0];
    xhr.status = 500;
    xhr.statusText = "Server Error";
    xhr.onload?.();

    await expect(promise).rejects.toThrow(/Upload failed: 500/);
    // Should NOT have made the create-asset call after a failed PUT.
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it("returns null without uploading when the file's MIME type isn't image/video/audio", async () => {
    const file = new File(["hi"], "notes.txt", { type: "text/plain" });
    const result = await uploadFileToBoard("board-3", file);
    expect(result).toBeNull();
    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(xhrCtl.instances).toHaveLength(0);
  });
});

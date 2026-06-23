import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, clearAuthToken } from "./authToken";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const isFormData = data instanceof FormData;
  const authHeaders = getAuthHeaders();
  
  const headers: HeadersInit = isFormData 
    ? { ...authHeaders }
    : data 
      ? { "Content-Type": "application/json", ...authHeaders }
      : { ...authHeaders };
  
  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? data as FormData : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: authHeaders,
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Download file utility - handles cross-origin URLs properly
export async function downloadFile(url: string, filename?: string): Promise<void> {
  try {
    // Fetch the file as a blob
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    
    // Create a blob URL and trigger download
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    
    // Extract filename from URL if not provided
    if (!filename) {
      const urlParts = url.split('/');
      filename = urlParts[urlParts.length - 1].split('?')[0] || 'download';
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Download error:', error);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

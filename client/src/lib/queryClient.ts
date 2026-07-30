import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, clearAuthToken } from "./authToken";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function fetchWithAuthFallback(
  url: string,
  init: RequestInit,
  authHeaders: HeadersInit,
): Promise<Response> {
  const headerEntries =
    authHeaders instanceof Headers
      ? Array.from(authHeaders.entries())
      : Array.isArray(authHeaders)
        ? authHeaders
        : Object.entries(authHeaders ?? {});

  const hasBearer = headerEntries.some(([key]) => key.toLowerCase() === "authorization");
  const fallbackHeaders = Object.fromEntries(
    headerEntries.filter(([key]) => key.toLowerCase() !== "authorization"),
  );

  let res = await fetch(url, {
    ...init,
    headers: authHeaders,
    credentials: "include",
  });

  // Recover from stale localStorage bearer tokens by retrying once with cookie auth only.
  if (res.status === 401 && hasBearer) {
    clearAuthToken();
    res = await fetch(url, {
      ...init,
      headers: fallbackHeaders,
      credentials: "include",
    });
  }

  return res;
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
  
  const res = await fetchWithAuthFallback(
    url,
    {
      method,
      body: isFormData ? (data as FormData) : (data ? JSON.stringify(data) : undefined),
      signal: options?.signal,
    },
    headers,
  );

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

    const res = await fetchWithAuthFallback(
      queryKey.join("/") as string,
      { method: "GET" },
      authHeaders,
    );

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

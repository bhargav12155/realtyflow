export function shouldAutoOpenUploadStep(search: string | undefined | null): boolean {
  if (!search) return false;
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    return params.get("action") === "upload";
  } catch {
    return false;
  }
}

export function clearUploadIntent(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("action")) {
      url.searchParams.delete("action");
      const newSearch = url.searchParams.toString();
      const next = `${url.pathname}${newSearch ? `?${newSearch}` : ""}${url.hash}`;
      window.history.replaceState(window.history.state, "", next);
    }
  } catch {
    /* no-op */
  }
}

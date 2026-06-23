/**
 * OAuth Redirect Controller
 * Handles redirect-based OAuth flows (no popups!) for mobile-friendly authentication
 */

interface OAuthContext {
  platform: string;
  intent?: string; // e.g., 'connect', 'post', 'schedule'
  returnPath?: string;
  postData?: any; // Store pending post data if user was trying to post
}

const OAUTH_CONTEXT_KEY = 'oauth_pending_context';
const OAUTH_RETURN_PATH_KEY = 'oauth_return_path';

/**
 * Store OAuth context before redirecting to provider
 */
export function storeOAuthContext(context: OAuthContext) {
  sessionStorage.setItem(OAUTH_CONTEXT_KEY, JSON.stringify(context));
  if (context.returnPath) {
    sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, context.returnPath);
  }
}

/**
 * Retrieve stored OAuth context after callback
 */
export function getOAuthContext(): OAuthContext | null {
  const stored = sessionStorage.getItem(OAUTH_CONTEXT_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get the return path to navigate back to
 */
export function getOAuthReturnPath(): string {
  return sessionStorage.getItem(OAUTH_RETURN_PATH_KEY) || '/';
}

/**
 * Clear OAuth context after processing
 */
export function clearOAuthContext() {
  sessionStorage.removeItem(OAUTH_CONTEXT_KEY);
  sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
}

/**
 * Initiate redirect-based OAuth flow
 * This won't get blocked by popup blockers!
 */
export async function initiateOAuthRedirect(platform: string, intent: string = 'connect'): Promise<void> {
  try {
    // Store context for when we return
    const context: OAuthContext = {
      platform,
      intent,
      returnPath: window.location.pathname + window.location.hash,
    };
    
    storeOAuthContext(context);
    
    // Get OAuth URL from backend (uses existing endpoint)
    const response = await fetch(`/api/social/connect/${platform}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get OAuth URL for ${platform}`);
    }
    
    const data = await response.json();
    const { authUrl } = data;
    
    // Redirect to provider's OAuth page (replaces popup)
    window.location.href = authUrl;
  } catch (error) {
    // Clean up on error
    clearOAuthContext();
    throw error;
  }
}

/**
 * Handle OAuth callback after provider redirects back
 * Returns the stored context for processing
 */
export function handleOAuthCallback(searchParams: URLSearchParams): {
  success: boolean;
  platform?: string;
  error?: string;
  context?: OAuthContext;
  returnPath: string;
} {
  const success = searchParams.get('success') === 'true';
  const platform = searchParams.get('platform') || undefined;
  const error = searchParams.get('error') || undefined;
  const context = getOAuthContext();
  const returnPath = getOAuthReturnPath();
  
  // Clean up stored context
  clearOAuthContext();
  
  return {
    success,
    platform,
    error,
    context: context || undefined,
    returnPath,
  };
}

/**
 * Check if we're in the middle of an OAuth flow
 */
export function isOAuthPending(): boolean {
  return !!sessionStorage.getItem(OAUTH_CONTEXT_KEY);
}

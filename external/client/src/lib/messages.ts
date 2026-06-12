/**
 * Centralized Message Catalog
 * Provides user-friendly, non-technical messages for the entire application
 */

export const messages = {
  oauth: {
    connecting: (platform: string) => ({
      title: `Connecting to ${platform}...`,
      description: "This will only take a moment",
    }),
    success: (platform: string) => ({
      title: "Great! You're all set",
      description: `Your ${platform} account is now connected and ready to use`,
    }),
    cancelled: (platform: string) => ({
      title: "No worries!",
      description: `You can connect your ${platform} account anytime from settings`,
    }),
    error: (platform: string, reason?: string) => ({
      title: `Couldn't connect to ${platform}`,
      description: reason || "Let's try that again. Make sure you're logged into your account and grant the necessary permissions",
    }),
    notConnected: (platform: string) => ({
      title: `Connect your ${platform} account first`,
      description: `To post to ${platform}, please connect your account from Quick Posts`,
    }),
    disconnectSuccess: (platform: string) => ({
      title: "Account disconnected",
      description: `Your ${platform} account has been removed`,
    }),
    disconnectError: (platform: string) => ({
      title: "Couldn't disconnect",
      description: "Something went wrong. Please try again in a moment",
    }),
  },
  posting: {
    success: (platform: string) => ({
      title: "Posted successfully!",
      description: `Your content is now live on ${platform}`,
    }),
    scheduled: (platform: string, date: string) => ({
      title: "Scheduled!",
      description: `Your post will go live on ${platform} on ${date}`,
    }),
    error: (platform: string) => ({
      title: "Post didn't go through",
      description: `There was a problem posting to ${platform}. Please check your connection and try again`,
    }),
    selectPage: {
      title: "Select a page",
      description: "Choose which page you'd like to post to",
    },
    noPages: {
      title: "No pages available",
      description: "Make sure you have at least one page you manage",
    },
  },
  content: {
    generating: {
      title: "Creating your content...",
      description: "Our AI is crafting engaging content just for you",
    },
    generated: {
      title: "Content is ready!",
      description: "Take a look and edit as needed",
    },
    generationError: {
      title: "Couldn't generate content",
      description: "Let's try that again. If this keeps happening, please contact support",
    },
    saveSuccess: {
      title: "Saved!",
      description: "Your changes have been saved successfully",
    },
    saveError: {
      title: "Couldn't save changes",
      description: "Please try again in a moment",
    },
    deleteSuccess: {
      title: "Deleted",
      description: "The content has been removed",
    },
    deleteError: {
      title: "Couldn't delete",
      description: "Please try again",
    },
  },
  validation: {
    required: (field: string) => `Please enter your ${field}`,
    invalidEmail: "Please enter a valid email address",
    invalidUrl: (platform: string) => `Please enter a valid ${platform} URL`,
    passwordTooShort: "Password must be at least 8 characters",
    passwordMismatch: "Passwords don't match",
  },
  network: {
    offline: {
      title: "You're offline",
      description: "Please check your internet connection and try again",
    },
    timeout: {
      title: "That took too long",
      description: "Please check your connection and try again",
    },
    serverError: {
      title: "Something went wrong on our end",
      description: "We're looking into it. Please try again in a few minutes",
    },
  },
  auth: {
    loginSuccess: {
      title: "Welcome back!",
      description: "You're all logged in",
    },
    loginError: {
      title: "Couldn't log you in",
      description: "Please check your email and password and try again",
    },
    logoutSuccess: {
      title: "You're logged out",
      description: "See you next time!",
    },
    sessionExpired: {
      title: "Session expired",
      description: "Please log in again to continue",
    },
    unauthorized: {
      title: "Access denied",
      description: "You don't have permission to do that",
    },
  },
  upload: {
    success: {
      title: "Upload complete!",
      description: "Your file has been uploaded successfully",
    },
    error: {
      title: "Upload failed",
      description: "Something went wrong with your upload. Please try a different file",
    },
    tooLarge: (maxSize: string) => ({
      title: "File is too large",
      description: `Please choose a file smaller than ${maxSize}`,
    }),
    invalidType: (allowedTypes: string) => ({
      title: "Invalid file type",
      description: `Please upload a ${allowedTypes} file`,
    }),
  },
  video: {
    generationStarted: {
      title: "Creating your video...",
      description: "This usually takes 2-3 minutes. We'll let you know when it's ready",
    },
    generationComplete: {
      title: "Your video is ready!",
      description: "Click to preview and download",
    },
    generationError: {
      title: "Couldn't create video",
      description: "Let's try that again with different settings",
    },
  },
};

/**
 * Get a friendly error message based on HTTP status code
 */
export function getHttpErrorMessage(status: number, defaultMessage?: string): { title: string; description: string } {
  switch (status) {
    case 400:
      return {
        title: "Something's not quite right",
        description: defaultMessage || "Please check your information and try again",
      };
    case 401:
      return messages.auth.unauthorized;
    case 403:
      return {
        title: "Access denied",
        description: "You don't have permission to do that",
      };
    case 404:
      return {
        title: "Couldn't find that",
        description: "The item you're looking for doesn't exist",
      };
    case 429:
      return {
        title: "Slow down there!",
        description: "You're doing that too often. Please wait a moment and try again",
      };
    case 500:
    case 502:
    case 503:
      return messages.network.serverError;
    default:
      return {
        title: "Something went wrong",
        description: defaultMessage || "Please try again in a moment",
      };
  }
}

/**
 * Convert technical error messages to user-friendly ones
 */
export function friendlyError(error: any): { title: string; description: string } {
  // Network/fetch errors
  if (error?.message?.includes("Failed to fetch") || error?.message?.includes("Network request failed")) {
    return messages.network.offline;
  }

  // Timeout errors
  if (error?.message?.includes("timeout") || error?.message?.includes("timed out")) {
    return messages.network.timeout;
  }

  // HTTP status errors
  if (error?.status || error?.response?.status) {
    const status = error.status || error.response?.status;
    return getHttpErrorMessage(status, error.message);
  }

  // Default friendly error
  return {
    title: "Something went wrong",
    description: "Please try again in a moment. If this keeps happening, contact support",
  };
}

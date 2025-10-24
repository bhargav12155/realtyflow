# Quick Integration Examples

## Example 1: Pass User Data from Açaí Freeman App

```typescript
// In your Açaí Freeman app (parent app)
// After successful user login:

function handleLoginSuccess(user) {
  // Store user data in localStorage
  localStorage.setItem(
    "aiseo_user",
    JSON.stringify({
      id: user.id, // Required
      email: user.email, // Required
      name: user.fullName, // Optional but recommended
      sourceApp: "acai-freeman", // Track source
      phone: user.phone, // Any additional data you want to pass
      company: user.companyName,
      profileImage: user.avatar,
    })
  );

  // Option A: Redirect to Aiseo in new tab
  window.open("https://aiseo-app.com", "_blank");

  // Option B: Redirect in same tab
  // window.location.href = 'https://aiseo-app.com';

  // Option C: Open in iframe
  // document.getElementById('aiseo-container').src = 'https://aiseo-app.com';
}
```

---

## Example 2: Use User Data in Aiseo Components

```typescript
// In any Aiseo component:

import { useAiseoUser } from "@/hooks/useAiseoUser";

export function UserWelcome() {
  const { user, isLoading, logout } = useAiseoUser();

  if (isLoading) {
    return <div className="animate-spin">Loading...</div>;
  }

  if (!user) {
    return <div>No user data found. Redirecting to login...</div>;
  }

  return (
    <div className="p-4">
      <h1>Welcome, {user.name}! 👋</h1>
      <p className="text-gray-600">{user.email}</p>

      {user.company && (
        <p className="text-sm text-gray-500">Company: {user.company}</p>
      )}

      <button
        onClick={logout}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
      >
        Logout
      </button>
    </div>
  );
}
```

---

## Example 3: Check and Setup Social API Keys

```typescript
// In a social posting component:

import { useState, useEffect } from "react";

export function SocialPostingComponent() {
  const [hasKeys, setHasKeys] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Check if API keys are configured
  useEffect(() => {
    const checkKeys = async () => {
      try {
        const response = await fetch("/api/user/social-api-keys", {
          credentials: "include",
        });

        if (response.ok) {
          const keys = await response.json();
          setHasKeys(keys.configured);

          // If specific platform needed:
          if (!keys.facebook.configured) {
            setShowSetupModal(true);
          }
        }
      } catch (error) {
        console.error("Error checking keys:", error);
      }
    };

    checkKeys();
  }, []);

  const handlePostToFacebook = async (postContent) => {
    if (!hasKeys) {
      setShowSetupModal(true);
      return;
    }

    // Proceed with posting
    try {
      const response = await fetch("/api/social/post/facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: postContent,
        }),
      });

      if (response.ok) {
        // Success
      }
    } catch (error) {
      console.error("Error posting:", error);
    }
  };

  return (
    <div>
      {showSetupModal && (
        <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
          ⚠️ Please set up your Facebook API keys first.
          <button onClick={() => setShowSetupModal(true)}>Setup Now</button>
        </div>
      )}

      {hasKeys && (
        <button
          onClick={() => handlePostToFacebook("Hello world")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Post to Facebook
        </button>
      )}
    </div>
  );
}
```

---

## Example 4: Add Settings Page for Key Management

```typescript
// client/src/pages/settings.tsx

import { useState, useEffect } from "react";
import { SocialKeysOnboarding } from "@/components/auth/social-keys-onboarding";
import { Button } from "@/components/ui/button";

export function SettingsPage() {
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [keysStatus, setKeysStatus] = useState(null);

  useEffect(() => {
    fetchKeyStatus();
  }, []);

  const fetchKeyStatus = async () => {
    try {
      const response = await fetch("/api/user/social-api-keys", {
        credentials: "include",
      });

      if (response.ok) {
        setKeysStatus(await response.json());
      }
    } catch (error) {
      console.error("Error fetching keys:", error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Social Media Integration</h2>

        {keysStatus && (
          <div className="space-y-2 mb-4">
            <p>
              Facebook:
              <span
                className={
                  keysStatus.facebook.configured
                    ? "text-green-600 ml-2"
                    : "text-red-600 ml-2"
                }
              >
                {keysStatus.facebook.configured
                  ? "✓ Configured"
                  : "✗ Not configured"}
              </span>
            </p>
            <p>
              Instagram:
              <span
                className={
                  keysStatus.instagram.configured
                    ? "text-green-600 ml-2"
                    : "text-red-600 ml-2"
                }
              >
                {keysStatus.instagram.configured
                  ? "✓ Configured"
                  : "✗ Not configured"}
              </span>
            </p>
            <p>
              TikTok:
              <span
                className={
                  keysStatus.tiktok.configured
                    ? "text-green-600 ml-2"
                    : "text-red-600 ml-2"
                }
              >
                {keysStatus.tiktok.configured
                  ? "✓ Configured"
                  : "✗ Not configured"}
              </span>
            </p>
            {/* Add other platforms... */}
          </div>
        )}

        <Button
          onClick={() => setShowKeySetup(true)}
          className="bg-blue-600 text-white"
        >
          {keysStatus?.configured ? "Update API Keys" : "Setup API Keys"}
        </Button>
      </div>

      {showKeySetup && (
        <SocialKeysOnboarding
          open={showKeySetup}
          onOpenChange={setShowKeySetup}
          onSaved={() => {
            fetchKeyStatus(); // Refresh status
            setShowKeySetup(false);
          }}
        />
      )}
    </div>
  );
}
```

---

## Example 5: URL-based User Transfer

```typescript
// In parent app (Açaí Freeman):

function initiateAiseoSession(user) {
  const userData = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
  };

  // Encode user data as base64
  const encoded = btoa(JSON.stringify(userData));

  // Open Aiseo with encoded user data
  const aiseoUrl = `https://aiseo-app.com?user=${encoded}`;
  window.open(aiseoUrl, "aiseo_window");
}
```

---

## Example 6: postMessage Integration (For Iframe)

```typescript
// In parent app:

const aiseoIframe = document.getElementById("aiseo-frame");

aiseoIframe.onload = function () {
  // Send user data via postMessage
  aiseoIframe.contentWindow.postMessage(
    {
      type: "AISEO_USER",
      user: {
        id: "user123",
        email: "user@example.com",
        name: "John Doe",
      },
    },
    window.location.origin
  );
};
```

---

## Example 7: Handle User Logout

```typescript
// In any Aiseo component:

import { useAiseoUser } from "@/hooks/useAiseoUser";

export function LogoutButton() {
  const { logout } = useAiseoUser();

  const handleLogout = async () => {
    // Call backend logout endpoint if needed
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    // Clear local user data
    logout();

    // Redirect to parent app login
    window.location.href = "https://acai-freeman-app.com/login";
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 text-white rounded"
    >
      Logout
    </button>
  );
}
```

---

## Example 8: Multi-Platform Posting

```typescript
// In a component that posts to multiple platforms:

import { useState } from "react";

export function MultiPlatformPosting() {
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState({
    facebook: false,
    instagram: false,
    tiktok: false,
    twitter: false,
  });

  const handlePostToAll = async () => {
    const enabledPlatforms = Object.keys(platforms).filter((p) => platforms[p]);

    try {
      // Post to backend
      const response = await fetch("/api/social/post/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          platforms: enabledPlatforms,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Posted to:", result.postedTo);
        alert("Successfully posted to " + result.postedTo.join(", "));
      }
    } catch (error) {
      console.error("Error posting:", error);
    }
  };

  return (
    <div className="p-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        placeholder="What's on your mind?"
      />

      <div className="space-y-2 mb-4">
        {Object.keys(platforms).map((platform) => (
          <label key={platform} className="flex items-center">
            <input
              type="checkbox"
              checked={platforms[platform]}
              onChange={(e) =>
                setPlatforms({
                  ...platforms,
                  [platform]: e.target.checked,
                })
              }
              className="mr-2"
            />
            <span className="capitalize">{platform}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handlePostToAll}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Post to Selected Platforms
      </button>
    </div>
  );
}
```

---

## API Reference

### Endpoints

| Endpoint                    | Method | Auth | Description                  |
| --------------------------- | ------ | ---- | ---------------------------- |
| `/api/user/social-api-keys` | GET    | JWT  | Get key configuration status |
| `/api/user/social-api-keys` | POST   | JWT  | Save/update API keys         |
| `/api/user/social-links`    | GET    | JWT  | Get social profile URLs      |
| `/api/user/social-links`    | POST   | JWT  | Save social profile URLs     |

### Error Responses

```json
{
  "error": "Unauthorized",
  "status": 401
}
```

```json
{
  "error": "Failed to save social API keys",
  "status": 500
}
```

---

## Deployment Checklist

- [ ] Update API base URL in `.env`
- [ ] Enable HTTPS for all API calls
- [ ] Test user data transfer from parent app
- [ ] Test API key onboarding flow
- [ ] Test skip functionality
- [ ] Test all social platforms
- [ ] Review security (no secrets in localStorage)
- [ ] Set up automated key rotation
- [ ] Configure database backups
- [ ] Set up error logging
- [ ] Test on mobile devices
- [ ] Performance test with high user load

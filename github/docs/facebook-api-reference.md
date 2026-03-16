# Facebook API Reference Documentation

## Overview

This document contains reference material for Facebook Login and Access Token implementation for posting content to Facebook.

## Access Tokens for Meta Technologies

An access token is an opaque string that identifies a user, app, or Page and can be used by the app to make graph API calls. The token includes information about when the token will expire and which app generated the token. Because of privacy checks, the majority of API calls on Meta apps need to include an access token.

### Access Token Types

| Access Token Type | Description |
|-------------------|-------------|
| **App Access Token** | Used to read and modify app settings. Generated using a Meta app secret and used during calls that change app-wide settings. Obtained via server-to-server call. |
| **Client Token** | Used to access app-level APIs that can be embedded into native or desktop apps to identify your app. Not meant to be secret since it's embedded in apps. |
| **Page Access Token** | Used to read, write, and modify data belonging to a Facebook Page. Requires obtaining a user access token first, then using it to get a Page access token via Graph API. |
| **System User Access Token** | Used for programmatic, automated actions on business clients' Ad objects or Pages without requiring user input or re-authentication. |
| **User Access Token** | Used when app takes actions in real time based on user input. Required for reading, modifying, or writing a specific person's Facebook data on their behalf. |

## User Access Tokens

### Short-Term vs Long-Term Tokens

- **Short-lived tokens**: Usually have a lifetime of about an hour or two
- **Long-lived tokens**: Usually have a lifetime of about 60 days
- **Important**: Don't depend on these lifetimes remaining the same - they may change without warning or expire early

### Token Generation by Platform

- **Web login**: Generates short-lived tokens (can be converted to long-lived via server-side API call with app secret)
- **Mobile apps** (iOS/Android SDKs): Get long-lived tokens by default
- **Marketing API** (Standard access): Long-lived tokens without expiry time (still subject to invalidation for other reasons)

### Token Portability

Tokens are portable across platforms (except Apple doesn't allow moving tokens to servers). Once you have an access token, you can use it to make calls from:
- Mobile client
- Web browser  
- Server to Facebook's servers

**Security Note**: Moving tokens between client and server must be done securely over HTTPS.

## Platform-Specific Implementation

### JavaScript (Web)
```javascript
FB.getLoginStatus(function(response) {
  if (response.status === 'connected') {
    var accessToken = response.authResponse.accessToken;
  } 
});
```

### Android
```java
@Override
public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    accessToken = AccessToken.getCurrentAccessToken();
}
```

### iOS
```objc
- (void)viewDidLoad {
  [super viewDidLoad];
  NSString *accessToken = [FBSDKAccessToken currentAccessToken];
}
```

## App Access Tokens

Used to make requests to Facebook APIs on behalf of an app rather than a user.

### Limitations
- Some user data visible with user access tokens isn't always visible with app access tokens
- Considered insecure if your app is set to Native/Desktop in App Dashboard settings
- Should never be hard-coded into client-side code

### Generating App Access Token

**Requirements:**
- Your App ID
- Your App Secret

**API Call:**
```bash
curl -X GET "https://graph.facebook.com/oauth/access_token
  ?client_id={your-app-id}
  &client_secret={your-app-secret}
  &grant_type=client_credentials"
```

**Alternative Method:**
```bash
curl -i -X GET "https://graph.facebook.com/{api-endpoint}&access_token={your-app_id}|{your-app_secret}"
```

## Page Access Tokens

Used in Graph API calls to manage Facebook Pages.

### Getting Page Access Tokens

1. Page admin must grant your app the required Page permissions
2. Use user access token to retrieve Page access token:

```bash
curl -i -X GET "https://graph.facebook.com/{your-user-id}/accounts?access_token={user-access-token}"
```

### Response Example
```json
{
  "data": [
    {
      "access_token": "EAACEdE...",
      "category": "Brand",
      "category_list": [
        {
          "id": "1605186416478696",
          "name": "Brand"
        }
      ],
      "name": "Ash Cat Page",
      "id": "1353269864728879",
      "tasks": [
        "ANALYZE",
        "ADVERTISE",
        "MODERATE",
        "CREATE_CONTENT",
        "MANAGE"
      ]
    }
  ]
}
```

**Key Points:**
- Page access tokens are unique to each Page, admin, and app
- Can be used to post status updates to a Page or read Page Insights data

## Client Access Tokens

- Make Graph API requests on behalf of apps instead of users
- Cannot be used alone - must be combined with App ID
- Format: `{app-id}|{client-token}`
- Example: `access_token=1234|5678`

### Getting Client Access Token
1. Sign into developer account
2. Go to Apps page → select app
3. Navigate to Settings → Advanced → Security → Client token

## Important Security Notes

- **App secrets must never be shared** or embedded in client-side code
- Use **server-side code only** for calls requiring app secret
- **Variable length data type** recommended for storing access tokens (they change size over time)
- All token transfers must use **HTTPS**

## Useful Tools

- **Access Token Tool**: View list of access tokens and debugging information
- **Graph API Explorer**: Test API calls with different token types

---

*This documentation will be updated as additional Facebook API references are provided.*
Facebook Page Posting Setup

1. Ensure your Facebook account is an Admin of the Page you want to post to.
2. Generate a User Access Token with these scopes: pages_show_list, pages_manage_posts, pages_read_engagement, pages_manage_metadata.
3. Verify with Graph API:
   - me/accounts should list your Page
   - Or directly: /{pageId}?fields=id,name,access_token should return access_token
4. In .env, you can set:
   - FACEBOOK_PAGE_ID=61581294927027
   - FACEBOOK_PAGE_ACCESS_TOKEN=... # optional shortcut if you have a Page access token
   - FACEBOOK_USER_TOKEN=... # user token with page permissions
5. Restart the server. The server will use FACEBOOK_PAGE_ID by default when the client doesn't send a pageId. If FACEBOOK_PAGE_ACCESS_TOKEN is present, it will post with it directly.

import { google } from '@googleapis/youtube';
import { OAuth2Client } from 'google-auth-library';

const SEARCH_CONSOLE_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly'
];

interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SearchConsoleMetrics {
  avgPosition: number;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;
}

export class SearchConsoleService {
  private oauth2Client: any;
  
  constructor() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.warn('Google OAuth credentials not configured for Search Console');
      return;
    }
    
    this.oauth2Client = new OAuth2Client(clientId, clientSecret);
  }
  
  getAuthUrl(redirectUri: string, state?: string): string {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SEARCH_CONSOLE_SCOPES,
      redirect_uri: redirectUri,
      state: state,
      prompt: 'consent'
    });
  }
  
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }
    
    this.oauth2Client.setCredentials({});
    const { tokens } = await this.oauth2Client.getToken({
      code,
      redirect_uri: redirectUri
    });
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date)
    };
  }
  
  async refreshAccessToken(refreshToken: string): Promise<string> {
    if (!this.oauth2Client) {
      throw new Error('Google OAuth not configured');
    }
    
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials.access_token;
  }
  
  async getSiteList(accessToken: string): Promise<string[]> {
    const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sites: ${response.statusText}`);
    }
    
    const data = await response.json();
    return (data.siteEntry || []).map((site: any) => site.siteUrl);
  }
  
  async getSearchMetrics(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<SearchConsoleMetrics> {
    const baseUrl = 'https://www.googleapis.com/webmasters/v3/sites';
    const encodedSite = encodeURIComponent(siteUrl);
    
    const queryRequest = {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 10
    };
    
    const pageRequest = {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 10
    };
    
    const overallRequest = {
      startDate,
      endDate,
      rowLimit: 1
    };
    
    const [queryResponse, pageResponse, overallResponse] = await Promise.all([
      fetch(`${baseUrl}/${encodedSite}/searchAnalytics/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryRequest)
      }),
      fetch(`${baseUrl}/${encodedSite}/searchAnalytics/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageRequest)
      }),
      fetch(`${baseUrl}/${encodedSite}/searchAnalytics/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(overallRequest)
      })
    ]);
    
    if (!queryResponse.ok || !pageResponse.ok || !overallResponse.ok) {
      const errorText = await queryResponse.text();
      throw new Error(`Search Console API error: ${errorText}`);
    }
    
    const queryData = await queryResponse.json();
    const pageData = await pageResponse.json();
    const overallData = await overallResponse.json();
    
    const overallRow = overallData.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    
    return {
      avgPosition: overallRow.position || 0,
      totalClicks: overallRow.clicks || 0,
      totalImpressions: overallRow.impressions || 0,
      avgCtr: overallRow.ctr || 0,
      topQueries: (queryData.rows || []).map((row: SearchAnalyticsRow) => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position
      })),
      topPages: (pageData.rows || []).map((row: SearchAnalyticsRow) => ({
        page: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position
      }))
    };
  }
}

export const searchConsoleService = new SearchConsoleService();

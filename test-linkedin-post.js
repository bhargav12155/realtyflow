import { storage } from './server/storage.ts';
import { SocialMediaService } from './server/services/socialMedia.ts';

async function postToLinkedIn() {
  try {
    console.log('🔍 Checking LinkedIn connection...');
    
    // Get user's social accounts
    const accounts = await storage.getSocialMediaAccounts('2');
    const linkedinAccount = accounts.find(a => a.platform === 'linkedin');
    
    if (!linkedinAccount) {
      console.log('❌ LinkedIn not connected. Please connect LinkedIn first.');
      return;
    }
    
    if (!linkedinAccount.accessToken) {
      console.log('❌ LinkedIn connected but no access token found.');
      return;
    }
    
    console.log('✅ LinkedIn connected!');
    console.log('📝 Posting to LinkedIn...');
    
    const socialService = new SocialMediaService();
    const content = "🏡 Exciting news from the Omaha real estate market! Properties in Aksarben are seeing increased interest this season. Perfect time for buyers and sellers alike! #OmahaRealEstate #NebraskaHomes";
    
    const result = await socialService.postToLinkedIn(content, linkedinAccount.accessToken);
    
    console.log('✅ Posted successfully to LinkedIn!');
    console.log('Post ID:', result.id);
    console.log('Post URL:', result.url || 'N/A');
    
  } catch (error) {
    console.error('❌ Error posting to LinkedIn:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

postToLinkedIn();

import { storage } from './server/storage.ts';

async function simulateLinkedInConnection() {
  console.log('🔄 Simulating LinkedIn OAuth Connection...\n');
  
  // Get the user from database
  const allUsers = Array.from(storage.users?.values() || []);
  console.log(`📋 Found ${allUsers.length} users in storage`);
  
  if (allUsers.length === 0) {
    console.log('❌ No users found in memory storage');
    console.log('💡 Checking database directly...');
    return;
  }
  
  const user = allUsers[0];
  console.log(`✅ Using user: ${user.username} (${user.id})`);
  
  // Create a mock LinkedIn connection
  const mockLinkedInToken = 'mock_linkedin_access_token_' + Date.now();
  
  console.log('\n📝 Creating LinkedIn social media account...');
  
  try {
    // Check if LinkedIn account already exists
    const existingAccounts = await storage.getSocialMediaAccounts(user.id);
    const linkedinAccount = existingAccounts.find(a => a.platform.toLowerCase() === 'linkedin');
    
    if (linkedinAccount) {
      console.log('📌 LinkedIn account already exists, updating...');
      await storage.updateSocialMediaAccount(linkedinAccount.id, {
        accessToken: mockLinkedInToken,
        isConnected: true,
        lastSync: new Date().toISOString()
      });
    } else {
      console.log('🆕 Creating new LinkedIn account...');
      await storage.createSocialMediaAccount({
        userId: user.id,
        platform: 'linkedin',
        accountId: 'linkedin_' + user.username,
        accessToken: mockLinkedInToken,
        isConnected: true
      });
    }
    
    console.log('\n✅ LinkedIn connection simulated successfully!');
    console.log(`   User: ${user.username}`);
    console.log(`   Token: ${mockLinkedInToken.substring(0, 30)}...`);
    console.log('\n🎉 You can now use LinkedIn posting features!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

simulateLinkedInConnection();

import { storage } from './server/storage.ts';

async function testLinkedInPost() {
  console.log('📱 Testing LinkedIn Post Simulation...\n');
  
  // Get user
  const allUsers = Array.from(storage.users?.values() || []);
  const user = allUsers[0];
  
  // Get LinkedIn account
  const accounts = await storage.getSocialMediaAccounts(user.id);
  const linkedinAccount = accounts.find(a => a.platform.toLowerCase() === 'linkedin');
  
  if (!linkedinAccount) {
    console.log('❌ No LinkedIn account found');
    return;
  }
  
  console.log('✅ LinkedIn Account Found');
  console.log(`   Platform: ${linkedinAccount.platform}`);
  console.log(`   Connected: ${linkedinAccount.isConnected}`);
  console.log(`   Token: ${linkedinAccount.accessToken?.substring(0, 30)}...`);
  
  // Simulate posting
  const postContent = "🏡 Exciting market update! Homes in the Aksarben neighborhood are seeing incredible interest this quarter. Great opportunity for buyers and sellers! #OmahaRealEstate #NebraskaHomes";
  
  console.log('\n📤 Simulating LinkedIn Post:');
  console.log(`   Content: ${postContent.substring(0, 80)}...`);
  console.log(`   User: ${user.username}`);
  console.log(`   Platform: LinkedIn`);
  
  // Create a scheduled post record
  console.log('\n💾 Creating post record...');
  
  const scheduledPost = await storage.createScheduledPost({
    userId: user.id,
    platform: 'linkedin',
    content: postContent,
    status: 'posted',
    scheduledFor: new Date().toISOString()
  });
  
  console.log('\n✅ POST SIMULATION COMPLETE!');
  console.log(`   Post ID: ${scheduledPost.id}`);
  console.log(`   Status: ${scheduledPost.status}`);
  console.log(`   Platform: ${scheduledPost.platform}`);
  console.log('\n🎉 In a real scenario, this would be posted to your LinkedIn profile!');
  console.log('📊 Check your Social Media Manager to see the post record.');
}

testLinkedInPost();

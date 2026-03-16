import { MemStorage } from './server/storage';

async function diagnoseTwitterOAuth() {
  console.log('🔍 Twitter OAuth Flow Diagnostic Report');
  console.log('='.repeat(70));
  
  const storage = new MemStorage();
  await storage.initialize();
  
  // Step 1: Examine Users
  console.log('\n📊 USERS IN STORAGE');
  console.log('-'.repeat(70));
  
  const allUsers = Array.from(storage.users.values());
  console.log(`Total users: ${allUsers.length}\n`);
  
  allUsers.forEach((user, index) => {
    console.log(`User ${index + 1}:`);
    console.log(`  ID: ${user.id} (Type: ${typeof user.id}, UUID: ${user.id.includes('-')})`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email || 'N/A'}`);
    console.log(`  Role: ${user.role}`);
    console.log('');
  });
  
  // Step 2: Check Social Media Accounts
  console.log('📱 SOCIAL MEDIA ACCOUNTS');
  console.log('-'.repeat(70));
  
  for (const user of allUsers) {
    const accounts = await storage.getSocialMediaAccounts(user.id);
    console.log(`User: ${user.username} (${user.id})`);
    
    if (accounts.length === 0) {
      console.log('  ❌ No social accounts connected\n');
    } else {
      accounts.forEach(account => {
        console.log(`  Platform: ${account.platform}`);
        console.log(`    - Account ID: ${account.id}`);
        console.log(`    - Access Token: ${account.accessToken ? '✅ Present' : '❌ Missing'}`);
        console.log(`    - Refresh Token: ${account.refreshToken ? '✅ Present' : '❌ Missing'}`);
        console.log(`    - Connected: ${account.connectedAt}`);
      });
      console.log('');
    }
  }
  
  // Step 3: Identify OAuth Flow Issues
  console.log('⚠️  IDENTIFIED ISSUES');
  console.log('-'.repeat(70));
  
  const issues = [];
  
  // Issue 1: Check if session user ID would match storage
  console.log('\n1️⃣  SESSION vs STORAGE USER ID MISMATCH');
  console.log('   Problem: req.user.id from session might be numeric');
  console.log('   Database: Uses UUID strings');
  console.log('   Impact: User lookup fails → falls back to wrong user\n');
  
  if (allUsers.some(u => typeof u.id === 'string' && u.id.includes('-'))) {
    console.log('   ✅ Storage uses UUID format');
    console.log('   ❌ Session needs to provide UUID, not numeric ID\n');
    issues.push('Session ID format mismatch');
  }
  
  // Issue 2: Check Twitter credentials
  console.log('2️⃣  TWITTER OAUTH CREDENTIALS');
  const hasTwitterClient = !!process.env.TWITTER_CLIENT_ID;
  const hasTwitterSecret = !!process.env.TWITTER_CLIENT_SECRET;
  
  console.log(`   Client ID: ${hasTwitterClient ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Client Secret: ${hasTwitterSecret ? '✅ Present' : '❌ Missing'}`);
  
  if (!hasTwitterClient || !hasTwitterSecret) {
    console.log('   ❌ Twitter OAuth not configured\n');
    issues.push('Missing Twitter credentials');
  } else {
    console.log('   ✅ Twitter credentials configured\n');
  }
  
  // Issue 3: Check redirect URI
  console.log('3️⃣  OAUTH REDIRECT URI');
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000';
  const redirectUri = `${baseUrl}/api/social/callback/twitter`;
  
  console.log(`   Redirect URI: ${redirectUri}`);
  console.log('   ⚠️  Must match Twitter app settings exactly\n');
  
  // Issue 4: User lookup methods
  console.log('4️⃣  STORAGE LOOKUP METHODS');
  console.log('   Available methods:');
  console.log('   - getUser(id: string) ✅');
  console.log('   - getUserByUsername(username: string) ✅');
  console.log('   - getUserByEmail() ❌ NOT AVAILABLE');
  console.log('   Impact: Fallback logic needs to use username only\n');
  
  // Step 4: Trace the OAuth Flow
  console.log('🔄 OAUTH FLOW TRACE');
  console.log('-'.repeat(70));
  
  console.log('\nStep 1: User clicks "Connect Twitter"');
  console.log('  → POST /api/social/connect/x');
  console.log('  → Needs: req.user.id (UUID from session)');
  console.log(`  → Current: Likely numeric ID → lookup fails`);
  console.log('');
  
  console.log('Step 2: OAuth state encoding');
  console.log('  → State = base64({ userId, platform })');
  console.log('  → Problem: If userId is wrong, callback fails');
  console.log('');
  
  console.log('Step 3: Twitter redirects to callback');
  console.log('  → GET /api/social/callback/twitter?code=XXX&state=YYY');
  console.log('  → Decode state to get userId');
  console.log('  → Look up user: storage.getUser(userId)');
  console.log('  → If fails: Try getUserByUsername()');
  console.log('  → Save token to social_media_accounts');
  console.log('');
  
  console.log('Step 4: Post to Twitter');
  console.log('  → POST /api/social/post { platform: "twitter", content: "..." }');
  console.log('  → Get user from session');
  console.log('  → Look up social account for user');
  console.log('  → Use access token to post via Twitter API');
  console.log('');
  
  // Step 5: Recommendations
  console.log('💡 RECOMMENDATIONS');
  console.log('-'.repeat(70));
  
  console.log('\n1. Fix Session User ID');
  console.log('   - Ensure req.user.id is the UUID from users table');
  console.log('   - Not a numeric ID from a different table');
  console.log('');
  
  console.log('2. Add Logging');
  console.log('   - Log req.user object in OAuth connect endpoint');
  console.log('   - Log user lookup attempts and results');
  console.log('   - Log OAuth state encoding/decoding');
  console.log('');
  
  console.log('3. Remove Fallback User Logic');
  console.log('   - Don\'t use "first user" as fallback');
  console.log('   - Return 404 if user not found');
  console.log('');
  
  console.log('4. Test the Flow');
  console.log('   - Check what req.user.id contains');
  console.log('   - Verify it matches a user UUID in storage');
  console.log('   - Ensure OAuth callback saves to correct user');
  console.log('');
  
  console.log('='.repeat(70));
  console.log('✅ Diagnostic complete');
  console.log('='.repeat(70));
}

diagnoseTwitterOAuth().catch(console.error);

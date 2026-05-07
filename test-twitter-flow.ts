import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Simulate authenticated user session
const mockUser = {
  id: '2',
  username: 'testuser',
  email: 'test@example.com'
};

async function testTwitterFlow() {
  console.log('🧪 Testing Twitter OAuth & Posting Flow\n');
  console.log('=' .repeat(60));
  
  // Step 1: Test OAuth Connect Initiation
  console.log('\n📍 STEP 1: OAuth Connect Initiation');
  console.log('-'.repeat(60));
  
  try {
    const connectResponse = await fetch(`${BASE_URL}/api/social/connect/x`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session' // Simulate session
      }
    });
    
    const connectData = await connectResponse.json();
    console.log(`Status: ${connectResponse.status}`);
    console.log('Response:', JSON.stringify(connectData, null, 2));
    
    if (!connectResponse.ok) {
      console.log('❌ FAILED: OAuth connect initiation');
      console.log('   Reason:', connectData.error);
      return;
    }
    
    console.log('✅ PASSED: OAuth URL generated');
    console.log('   Auth URL:', connectData.authUrl?.substring(0, 100) + '...');
    
  } catch (error) {
    console.log('❌ ERROR in OAuth connect:', error.message);
    return;
  }
  
  // Step 2: Simulate OAuth Callback
  console.log('\n📍 STEP 2: OAuth Callback Simulation');
  console.log('-'.repeat(60));
  
  const mockState = Buffer.from(JSON.stringify({ 
    userId: mockUser.id, 
    platform: 'twitter' 
  })).toString('base64');
  
  console.log('Simulated State:', mockState);
  console.log('Note: In real flow, Twitter would redirect here with code & state');
  console.log('Testing with mock callback parameters...\n');
  
  // Step 3: Test Storage User Lookup
  console.log('📍 STEP 3: Testing User Lookup Logic');
  console.log('-'.repeat(60));
  
  try {
    // Check what happens when we try to look up user ID "2"
    console.log(`Looking up user ID: "${mockUser.id}"`);
    console.log('Expected: Should find user or fail gracefully');
    console.log('Current Issue: Numeric ID "2" vs UUID in database\n');
    
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
  
  // Step 4: Test Twitter Posting (with mock token)
  console.log('\n📍 STEP 4: Twitter Posting Simulation');
  console.log('-'.repeat(60));
  
  try {
    const postResponse = await fetch(`${BASE_URL}/api/social/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session'
      },
      body: JSON.stringify({
        platform: 'twitter',
        content: 'Test post from automated flow simulation 🚀'
      })
    });
    
    const postData = await postResponse.json();
    console.log(`Status: ${postResponse.status}`);
    console.log('Response:', JSON.stringify(postData, null, 2));
    
    if (!postResponse.ok) {
      console.log('❌ FAILED: Twitter posting');
      console.log('   Reason:', postData.error);
    } else {
      console.log('✅ PASSED: Post created successfully');
    }
    
  } catch (error) {
    console.log('❌ ERROR in posting:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('\nKey Issues to Fix:');
  console.log('1. Session user ID (numeric "2") vs Database UUID mismatch');
  console.log('2. OAuth state encoding/decoding with correct user ID');
  console.log('3. Twitter token storage and retrieval');
  console.log('4. Twitter API posting with OAuth 2.0 Bearer token');
  console.log('\n');
}

// Run the test
testTwitterFlow().catch(console.error);

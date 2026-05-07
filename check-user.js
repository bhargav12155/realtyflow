import { storage } from './server/storage.ts';

async function checkUser() {
  console.log('🔍 Checking user lookup...\n');
  
  // Try different ways to look up user ID 2
  const user1 = await storage.getUser('2');
  const user2 = await storage.getUser(2);
  
  console.log('storage.getUser("2"):', user1 ? `✅ Found: ${user1.username}` : '❌ Not found');
  console.log('storage.getUser(2):', user2 ? `✅ Found: ${user2.username}` : '❌ Not found');
  
  // Get all users to see what IDs exist
  const allUsers = Array.from(storage.users?.values() || []);
  console.log('\n📋 All users in storage:');
  allUsers.forEach(u => {
    console.log(`  - ID: "${u.id}" (type: ${typeof u.id}), Username: ${u.username}`);
  });
}

checkUser();

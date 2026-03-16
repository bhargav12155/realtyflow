import { storage } from './server/storage.ts';

async function checkAuth() {
  console.log('🔍 Checking authentication system...\n');
  
  // Get all users
  const allUsers = Array.from(storage.users?.values() || []);
  console.log('📋 Users in database:');
  allUsers.forEach(u => {
    console.log(`  - UUID: ${u.id}`);
    console.log(`    Username: ${u.username}`);
    console.log(`    Session ID: ${u.id === 'd3bfc3db-e01e-45b2-bd39-a64feec47407' ? '2 (assumption)' : 'unknown'}`);
    console.log('');
  });
  
  console.log('💡 The session uses numeric ID (2), but storage needs UUID');
  console.log('💡 Need to find the mapping between session ID and UUID');
}

checkAuth();

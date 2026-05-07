// Test LinkedIn OAuth connection by simulating the flow
const BASE_URL = process.env.BASE_URL || 'https://596fe8f7-6151-4b60-9a63-924b1ec27201-00-2po7zhxr512nn.janeway.replit.dev';

console.log('🔗 LinkedIn OAuth Configuration Test');
console.log('=====================================');
console.log('');
console.log('📍 Your Redirect URIs (add BOTH to LinkedIn Developer App):');
console.log('   1. ' + BASE_URL + '/api/social/callback/linkedin');
console.log('   2. ' + BASE_URL + '/api/social/callback/linkedin/');
console.log('');
console.log('✅ Credentials Check:');
console.log('   LINKEDIN_CLIENT_ID:', process.env.LINKEDIN_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('   LINKEDIN_CLIENT_SECRET:', process.env.LINKEDIN_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
console.log('   BASE_URL:', process.env.BASE_URL ? '✓ Set' : '✗ Missing');
console.log('');
console.log('🔗 To manually test OAuth:');
console.log('   Visit: ' + BASE_URL + '/social-media-manager');
console.log('   Click "Connect" next to LinkedIn');
console.log('');

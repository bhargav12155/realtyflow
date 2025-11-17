#!/usr/bin/env tsx
/**
 * Social Media Configuration Validator CLI
 * 
 * Run this script to validate your social media OAuth configurations
 * and get automated setup instructions for all platforms.
 * 
 * Usage: npm run validate:social
 */

import { SocialConfigValidator } from '../server/utils/social-config-validator';

async function main() {
  console.log('\n🔍 Starting social media configuration validation...\n');
  
  const validator = new SocialConfigValidator();
  
  // Check BASE_URL first
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' BASE_URL Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const baseUrlCheck = validator.validateBaseUrl();
  const baseUrlIcon = baseUrlCheck.status === 'valid' ? '✅' : baseUrlCheck.status === 'warning' ? '⚠️' : '❌';
  
  console.log(`${baseUrlIcon} ${baseUrlCheck.message}`);
  if (baseUrlCheck.fixInstructions) {
    console.log(`   💡 ${baseUrlCheck.fixInstructions}`);
  }
  console.log('');
  
  // Validate all platforms
  const report = await validator.generateReport();
  console.log(report);
  
  // Exit with appropriate code
  const results = await validator.validateAll();
  const hasErrors = results.some(r => r.status === 'error') || baseUrlCheck.status === 'error';
  
  if (hasErrors) {
    console.log('\n❌ Configuration has errors. Please fix the issues above.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All configurations valid!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('\n❌ Validation failed:', error);
  process.exit(1);
});

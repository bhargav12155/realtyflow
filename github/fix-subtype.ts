// Quick script to clear invalid business subtypes
import { db } from "./server/db";
import { publicUsers } from "./shared/schema";
import { eq, ne } from "drizzle-orm";

async function fixSubtypes() {
  console.log("Clearing invalid business subtypes...");
  
  // Clear subtypes that don't match their business type
  // For retail with fast_casual (which is a restaurant subtype)
  const result = await db
    .update(publicUsers)
    .set({ businessSubtype: null })
    .where(eq(publicUsers.businessType, 'retail'));
    
  console.log("✅ Fixed retail businesses");
  
  // Also fix home_services and others that might have restaurant subtypes
  const result2 = await db
    .update(publicUsers)
    .set({ businessSubtype: null })
    .where(eq(publicUsers.businessType, 'home_services'));
    
  console.log("✅ Fixed home_services businesses");
  
  const result3 = await db
    .update(publicUsers)
    .set({ businessSubtype: null })
    .where(eq(publicUsers.businessType, 'real_estate'));
    
  console.log("✅ Fixed real_estate businesses");
  
  console.log("✅ All done! Refresh your browser.");
  process.exit(0);
}

fixSubtypes().catch(console.error);

import type { CompanyProfile } from "@shared/schema";
import type { IStorage } from "../storage";

/**
 * Get company profile with smart fallbacks
 * Returns actual profile data or placeholder values that prompt users to set up their profile
 */
export async function getCompanyProfileOrDefaults(
  storage: IStorage,
  userId: string | undefined
): Promise<Partial<CompanyProfile>> {
  if (!userId) {
    return getDefaultProfile();
  }

  try {
    const profile = await storage.getCompanyProfile(userId);
    if (profile) {
      return profile;
    }
  } catch (error) {
    console.warn("Failed to fetch company profile for user:", userId, error);
  }

  return getDefaultProfile();
}

function getDefaultProfile(): Partial<CompanyProfile> {
  return {
    agentName: "[Your Name]",
    businessName: "[Your Business]",
    brokerageName: "[Your Brokerage]",
    agentTitle: "real estate professional",
    phone: "",
    email: "",
    licenseNumber: "",
    tagline: "",
  };
}

import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TemplateData {
  agentName?: string;
  agentTitle?: string;
  companyName?: string;
  companyDescription?: string;
  phone?: string;
  phoneRaw?: string;
  email?: string;
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  socialHandles?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  colors?: {
    primary?: string;
    accent?: string;
    text?: string;
  };
  websiteUrl?: string;
  source?: string;
  timestamp?: string;
}

interface PostMessageData {
  type: string;
  template?: TemplateData;
}

const STORAGE_KEY = "template_imported_timestamp";
const STORAGE_HASH_KEY = "template_imported_hash";
const ALLOWED_ORIGINS = [
  "https://www.imakepage.com",
  "https://imakepage.com",
  "http://localhost:3000",
];

function hashTemplateData(data: TemplateData): string {
  const str = JSON.stringify({
    companyName: data.companyName,
    email: data.email,
    phone: data.phone,
    timestamp: data.timestamp,
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function useTemplateDataImport() {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const isImportingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const handleMessage = async (event: MessageEvent<PostMessageData>) => {
      console.log("📬 Received postMessage:", event.data?.type, "from:", event.origin);
      
      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        console.log("❌ Origin not allowed:", event.origin);
        return;
      }

      if (event.data?.type !== "AISEO_TEMPLATE_DATA" || !event.data.template) {
        console.log("⏭️ Not a template data message, skipping");
        return;
      }
      
      console.log("✅ Valid template data received:", event.data.template);

      if (isImportingRef.current) {
        return;
      }

      const template = event.data.template;
      const newHash = hashTemplateData(template);
      const storedHash = localStorage.getItem(STORAGE_HASH_KEY);

      if (storedHash === newHash) {
        console.log("Template data already imported, skipping");
        return;
      }

      isImportingRef.current = true;

      try {
        console.log("📥 Importing template data from imakepage.com");

        const companyProfileData = {
          companyName: template.companyName || "My Company",
          phone: template.phone || template.phoneRaw || undefined,
          email: template.email || undefined,
          website: template.websiteUrl || undefined,
          bio: template.companyDescription || template.tagline || undefined,
          socialLinks: template.socialHandles
            ? {
                instagram: template.socialHandles.instagram || undefined,
                facebook: template.socialHandles.facebook || undefined,
                linkedin: template.socialHandles.linkedin || undefined,
                twitter: template.socialHandles.twitter || undefined,
                tiktok: template.socialHandles.tiktok || undefined,
                youtube: template.socialHandles.youtube || undefined,
              }
            : undefined,
          agentName: template.agentName || undefined,
          agentTitle: template.agentTitle || undefined,
          source: template.source || "imakepage",
        };

        // Include colors and social handles in the import payload
        // The server-side merge logic will preserve existing user values
        const importPayload = {
          ...companyProfileData,
          colors: template.colors ? {
            primary: template.colors.primary || "#daa520",
            accent: template.colors.accent || "#ffd700",
            text: template.colors.text || "#333333",
          } : undefined,
          socialConnections: template.socialHandles || undefined,
        };

        await apiRequest(
          "POST",
          "/api/company/profile/import",
          importPayload
        );

        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        localStorage.setItem(STORAGE_HASH_KEY, newHash);

        toast({
          title: "Profile Imported",
          description: "Your company profile has been synced from iMakePage.",
        });

        console.log("✅ Template data imported successfully");
      } catch (error) {
        console.error("❌ Failed to import template data:", error);
        toast({
          title: "Import Failed",
          description: "Could not sync your profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        isImportingRef.current = false;
      }
    };

    window.addEventListener("message", handleMessage);

    if (window.self !== window.top) {
      try {
        window.parent.postMessage(
          { source: "realtyflow", action: "requestTemplateData" },
          "*"
        );
      } catch (e) {
        console.log("Could not request template data from parent");
      }
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isAuthenticated, user, toast]);
}

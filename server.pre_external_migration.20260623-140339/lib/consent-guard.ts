import type { Response } from "express";
import { storage } from "../storage";

const REVOKED_MESSAGE =
  "Consent for this avatar has been revoked. Re-approve consent before generating new looks or videos.";

export function isRevoked(group: { consentStatus?: string | null } | null | undefined): boolean {
  return group?.consentStatus === "revoked";
}

export function rejectIfRevoked(
  res: Response,
  group: { consentStatus?: string | null } | null | undefined,
): boolean {
  if (isRevoked(group)) {
    res.status(403).json({
      error: "consent_revoked",
      code: "CONSENT_REVOKED",
      message: REVOKED_MESSAGE,
    });
    return true;
  }
  return false;
}

export async function rejectIfGroupRevokedByHeygenId(
  res: Response,
  heygenGroupId: string,
): Promise<boolean> {
  try {
    const group = await storage.getPhotoAvatarGroupByHeygenId(heygenGroupId);
    return rejectIfRevoked(res, group as { consentStatus?: string | null } | null);
  } catch {
    return false;
  }
}

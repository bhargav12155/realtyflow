/**
 * Detect when a user is asking to create a Photo Avatar of THEMSELVES.
 *
 * Positive: "create an avatar of myself", "make an avatar of me",
 *           "build an avatar from my photo", "I want my own avatar".
 * Negative: generic image/video requests, or "make a talking avatar video
 *           with my script" (which is about an EXISTING avatar, not creating
 *           a new photo avatar).
 *
 * The rule: must mention an avatar-family noun AND a first-person possessive
 * marker. We also explicitly reject phrases that point at an existing avatar
 * being driven with text/audio (talking avatar video, avatar reading my
 * script, etc.) — those are handled by the existing Avatar Video flow.
 */
export function detectCreateSelfAvatarIntent(message: string): boolean {
  if (!message) return false;
  const text = message.toLowerCase();

  const avatarNoun = /\b(avatar|avatars|photo[- ]?avatar|ai (?:clone|twin)|digital (?:twin|clone))\b/.test(text);
  if (!avatarNoun) return false;

  const firstPerson =
    /\b(myself|me)\b/.test(text) ||
    /\bmy (?:own|photo|photos|picture|pictures|pic|pics|face|headshot|selfie|image|images|portrait)\b/.test(text);
  if (!firstPerson) return false;

  // Reject: user is talking about driving an EXISTING avatar with text/audio.
  // "talking avatar video", "avatar that reads my script", "avatar saying ...",
  // "avatar voiceover", "avatar narrate my script".
  const drivingExistingAvatar =
    /\btalking avatar\b/.test(text) ||
    /\bavatar\b[^.!?]*\b(?:read|reads|reading|say|says|saying|speak|speaks|speaking|narrate|narrates|narrating|present|presents|presenting|voiceover|voice over)\b/.test(text) ||
    /\b(?:read|reads|reading|say|says|saying|speak|speaks|speaking|narrate|narrates|narrating|present|presents|presenting)\b[^.!?]*\bavatar\b/.test(text) ||
    /\bmy script\b/.test(text);
  if (drivingExistingAvatar) return false;

  return true;
}

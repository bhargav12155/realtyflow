import { describe, it, expect } from "vitest";
import { detectCreateSelfAvatarIntent } from "@shared/avatarIntent";

describe("detectCreateSelfAvatarIntent", () => {
  const positives = [
    "create an avatar of myself",
    "make an avatar of me",
    "I want an avatar of myself for marketing",
    "build an avatar from my photo",
    "turn my photo into an avatar",
    "generate a photo avatar from my headshot",
    "make me my own avatar please",
    "can you create an AI clone of me?",
    "I'd like a digital twin of myself",
    "use my selfie to make an avatar",
    "make an avatar using my picture",
    "build my own AI avatar",
  ];

  const negatives = [
    "generate a video of a sunset",
    "create an image of a beach house",
    "make a talking avatar video with this script",
    "have my avatar read my script for the new listing",
    "create an avatar saying welcome to the open house",
    "make an avatar that presents this property",
    "write me a property description",
    "schedule a post for tomorrow",
    "show me avatar options",
    "help me with my avatar settings",
    "tell me about avatars on this platform",
  ];

  for (const phrase of positives) {
    it(`detects positive: "${phrase}"`, () => {
      expect(detectCreateSelfAvatarIntent(phrase)).toBe(true);
    });
  }

  for (const phrase of negatives) {
    it(`rejects negative: "${phrase}"`, () => {
      expect(detectCreateSelfAvatarIntent(phrase)).toBe(false);
    });
  }

  it("handles empty input safely", () => {
    expect(detectCreateSelfAvatarIntent("")).toBe(false);
  });
});

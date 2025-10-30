import { config } from "dotenv";
config();

// Simulate what the actual request looks like
async function debugHeyGenRequest() {
  const apiKey = process.env.HEYGEN_API_KEY;

  // Test with mock image keys that would come from upload
  const mockImageKeys = [
    "test-image-1",
    "test-image-2",
    "test-image-3",
    "test-image-4",
    "test-image-5",
  ];

  // Test 1: with image_key as string (single image)
  const payload1 = {
    name: "Test Avatar Group Single",
    image_key: "test-image-1",
  };

  console.log("\n🧪 Test 1: image_key as string (single image)");
  console.log("📦 Payload:", JSON.stringify(payload1, null, 2));

  let response = await fetch(
    "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
    {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload1),
    }
  );

  console.log("📊 Response:", response.status, await response.text());

  // Test 2: with image_keys (plural) as array
  const payload2 = {
    name: "Test Avatar Group Multiple",
    image_keys: mockImageKeys,
  };

  console.log("\n🧪 Test 2: image_keys (plural) as array");
  console.log("📦 Payload:", JSON.stringify(payload2, null, 2));

  response = await fetch(
    "https://api.heygen.com/v2/photo_avatar/avatar_group/create",
    {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload2),
    }
  );

  console.log("📊 Response:", response.status, await response.text());
}

debugHeyGenRequest().catch(console.error);

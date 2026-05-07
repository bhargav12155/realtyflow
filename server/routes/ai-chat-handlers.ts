import type { Response } from "express";
import { eq } from "drizzle-orm";

export interface ChatImageInput {
  url: string;
  mediaType?: string;
}

export interface ChatService {
  chat: (
    message: string,
    history: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    images?: ChatImageInput[],
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
}

export interface MultiOpenAILike {
  makeRequest: (kind: string, fn: (client: any) => Promise<any>) => Promise<any>;
}

export interface OpenAIServiceLike {
  generateImage: (opts: { prompt: string }) => Promise<string | null>;
}

export interface S3UploadLike {
  uploadBuffer: (buffer: Buffer, key: string, mime: string) => Promise<string>;
}

export interface AiChatDeps {
  multiOpenAI: MultiOpenAILike;
  openaiService: OpenAIServiceLike;
  storage: { getCompanyProfile: (userId: any) => Promise<any> };
  db: any;
  userPreferencesTable: any;
  loadAnthropic: () => Promise<{ anthropicService: ChatService }>;
  loadGemini: () => Promise<{ geminiService: ChatService }>;
}

export interface AiAssistantDeps {
  multiOpenAI: MultiOpenAILike;
  db: any;
  aiAssistantMessagesTable: any;
  s3UploadService: S3UploadLike;
  loadAnthropic: () => Promise<{ anthropicService: ChatService }>;
  loadGemini: () => Promise<{ geminiService: ChatService }>;
}

const IMAGE_PATTERNS =
  /\b(generate|create|make|draw|design|produce|show me|give me)\b.*\b(image|photo|picture|illustration|graphic|visual|artwork|poster|flyer|banner)\b|\b(image|photo|picture|illustration|graphic|visual|artwork|poster|flyer|banner)\b.*\b(of|for|showing|featuring|with)\b/i;

const GENERIC_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Help the user with whatever they ask. Be clear and concise.";

const ASSISTANT_GENERIC_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Help the user with whatever they ask. Be clear and concise.";

const ASSISTANT_REAL_ESTATE_SYSTEM_PROMPT = `You are an AI assistant for iMakePage (imakepage.com), an AI-powered real estate marketing platform built by My Golden Brick. You help real estate agents with:

CONTENT & MARKETING:
- Writing property descriptions and marketing content
- Analyzing market trends and property photos
- Creating social media posts for Facebook, Instagram, LinkedIn, X/Twitter, YouTube, TikTok
- Answering questions about real estate best practices
- Providing advice on home staging, pricing, and marketing strategies

VIDEO GENERATION (You CAN help create videos!):
- This platform has a built-in Video Studio that generates professional real estate videos
- Kling AI Motion Videos: Turn any property photo into a cinematic panning/zooming video. Users can go to the Media Library, select a photo, and click "Generate Motion Video"
- HeyGen Talking Avatar Videos: Create AI spokesperson videos with a talking avatar presenting a property listing or marketing script. Users can upload their photo to create a custom avatar, write a script, and generate a video
- Property Tour Studio: A 4-step wizard that creates virtual property tour videos from room photos with spatial camera motion
- AI Content Generator: Creates marketing videos with text overlays, property details, and professional templates

When someone asks about creating a video, guide them to the appropriate tool in the platform:
1. For property photo animations → "Go to Media Library, select your photo, and click Generate Motion Video"
2. For talking head/presenter videos → "Go to the Avatar section to create a talking avatar video with your script"
3. For property tours → "Use the Property Tour Studio to create a virtual walkthrough from your room photos"
4. For marketing/social media videos → "Use the Video Studio to create professional marketing videos"

WHATSAPP & BULK MESSAGING:
- The platform supports WhatsApp Business bulk messaging
- Users can upload CSV, PDF, Word, or text files to import phone numbers
- Supports up to 5,000 recipients per send

NOTE: When a user asks to create a Photo Avatar of THEMSELVES (e.g. "make an avatar of me", "create an avatar from my photo"), the client app intercepts the request locally and sends them straight to the Photo Avatars flow — you do not need to repeat those instructions.

Be helpful, professional, and concise. Always let users know what the platform can do for them.`;

export function createAiChatHandler(deps: AiChatDeps) {
  return async (req: any, res: Response) => {
    try {
      const {
        message,
        conversationHistory = [],
        provider = "auto",
        generalMode = false,
      } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      const validProviders = ["openai", "gemini", "claude", "auto"];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({
          error:
            "Invalid provider. Must be 'openai', 'gemini', 'claude', or 'auto'",
        });
      }

      const isGeneralMode = generalMode === true || generalMode === "true";

      const userId = req.user?.id;
      let companyProfile: any = null;
      let userPreferencesData: any = null;
      if (userId && !isGeneralMode) {
        companyProfile = await deps.storage.getCompanyProfile(userId);
        const prefResults = await deps.db
          .select()
          .from(deps.userPreferencesTable)
          .where(eq(deps.userPreferencesTable.userId, userId))
          .limit(1);
        userPreferencesData = prefResults.length > 0 ? prefResults[0] : null;
      }

      let locationContext = "";
      if (!isGeneralMode && userPreferencesData) {
        if (userPreferencesData.serviceArea) {
          locationContext += `The user is a real estate agent serving the ${userPreferencesData.serviceArea} area.`;
        } else if (companyProfile?.city || companyProfile?.state) {
          const cpCity = companyProfile?.city || "";
          const cpState = companyProfile?.state || "";
          const cpArea =
            cpCity && cpState ? `${cpCity}, ${cpState}` : cpCity || cpState;
          locationContext += `The user operates in ${cpArea}.`;
        }
        if (
          userPreferencesData.communities &&
          userPreferencesData.communities.length > 0
        ) {
          locationContext += ` They focus on these neighborhoods/communities: ${userPreferencesData.communities.join(", ")}.`;
        }
        locationContext = locationContext.trim();
      } else if (
        !isGeneralMode &&
        (companyProfile?.city || companyProfile?.state)
      ) {
        const cpCity = companyProfile?.city || "";
        const cpState = companyProfile?.state || "";
        const cpArea =
          cpCity && cpState ? `${cpCity}, ${cpState}` : cpCity || cpState;
        locationContext = `The user operates in ${cpArea}.`;
      }

      if (provider === "claude") {
        const { anthropicService } = await deps.loadAnthropic();
        const claudeSystemPrompt = isGeneralMode
          ? GENERIC_SYSTEM_PROMPT
          : `You are a helpful AI assistant for real estate professionals. 
You help with:
- Creating social media posts and marketing content
- Writing blog articles and property descriptions
- Answering real estate marketing questions
- Providing market insights and advice
- Generating image and video ideas

${locationContext ? locationContext : ""}

Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`.trim();

        const result = await anthropicService.chat(
          message,
          conversationHistory,
          claudeSystemPrompt,
        );
        if (!result.success) {
          return res
            .status(500)
            .json({ error: result.error || "Claude chat failed" });
        }
        return res.json({
          message: result.message,
          role: "assistant",
          provider: "claude",
        });
      }

      if (provider === "gemini") {
        const { geminiService } = await deps.loadGemini();

        const geminiSystemPrompt = isGeneralMode
          ? GENERIC_SYSTEM_PROMPT
          : `You are a helpful AI assistant for real estate professionals. 
You help with:
- Creating social media posts and marketing content
- Writing blog articles and property descriptions
- Answering real estate marketing questions
- Providing market insights and advice
- Generating image and video ideas

${locationContext ? locationContext : ""}

Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`.trim();

        const result = await geminiService.chat(
          message,
          conversationHistory,
          geminiSystemPrompt,
        );

        if (!result.success) {
          return res
            .status(500)
            .json({ error: result.error || "Gemini chat failed" });
        }

        let geminiImageUrl: string | null = null;
        if (IMAGE_PATTERNS.test(message)) {
          try {
            const imagePrompt = `Professional high-quality marketing image: ${message}. Photorealistic, well-lit, suitable for social media and marketing. Do not include any text, logos, watermarks, branding, labels, or written words in the image.`;
            geminiImageUrl = await deps.openaiService.generateImage({
              prompt: imagePrompt,
            });
          } catch (imgError: any) {
            console.error(
              "❌ [AI Chat/Gemini] Image generation failed:",
              imgError?.message,
            );
          }
        }

        return res.json({
          message: result.message,
          role: "assistant",
          provider: "gemini",
          imageUrl: geminiImageUrl || undefined,
        });
      }

      // OpenAI / auto path
      const openaiSystemContent = isGeneralMode
        ? GENERIC_SYSTEM_PROMPT
        : `You are a helpful AI assistant for real estate professionals. 
You help with:
- Creating social media posts and marketing content
- Writing blog articles and property descriptions
- Answering real estate marketing questions
- Providing market insights and advice
- Generating image and video ideas

${locationContext ? locationContext : ""}

${companyProfile ? `The user works for ${companyProfile.companyName || "a real estate company"} with tagline: "${companyProfile.tagline || ""}"` : ""}

Be professional, helpful, and focused on real estate marketing. Keep responses concise but informative.`;

      const messages = [
        { role: "system" as const, content: openaiSystemContent },
        ...conversationHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: message },
      ];

      const response = await deps.multiOpenAI.makeRequest(
        "content",
        async (client) => {
          return await client.chat.completions.create({
            model: "gpt-4o",
            messages,
            max_completion_tokens: 1000,
          });
        },
      );

      let assistantMessage = response.choices?.[0]?.message?.content;

      if (!assistantMessage || assistantMessage.trim() === "") {
        const retryResponse = await deps.multiOpenAI.makeRequest(
          "content",
          async (client) => {
            return await client.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "system" as const,
                  content: isGeneralMode
                    ? "You are a helpful assistant. Be concise and helpful."
                    : "You are a helpful assistant for real estate professionals. Be concise and helpful.",
                },
                { role: "user" as const, content: message },
              ],
              max_completion_tokens: 500,
            });
          },
        );
        assistantMessage = retryResponse.choices?.[0]?.message?.content;
      }

      if (!assistantMessage || assistantMessage.trim() === "") {
        assistantMessage =
          "I'm having trouble processing your request right now. Could you try rephrasing your question or try again in a moment?";
      }

      let imageUrl: string | null = null;
      if (IMAGE_PATTERNS.test(message)) {
        try {
          const imagePrompt = `Professional high-quality marketing image: ${message}. Photorealistic, well-lit, suitable for social media and marketing. Do not include any text, logos, watermarks, branding, labels, or written words in the image.`;
          imageUrl = await deps.openaiService.generateImage({
            prompt: imagePrompt,
          });
        } catch (imgError: any) {
          console.error(
            "❌ [AI Chat] Image generation failed:",
            imgError?.message,
          );
        }
      }

      res.json({
        message: assistantMessage,
        role: "assistant",
        provider: "openai",
        imageUrl: imageUrl || undefined,
      });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({
        error: "Failed to process your request. Please try again.",
      });
    }
  };
}

export function createAiAssistantChatHandler(deps: AiAssistantDeps) {
  return async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { message, provider = "auto", generalMode = false } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];
      const isGeneralMode = generalMode === true || generalMode === "true";

      if (!message && files.length === 0) {
        return res.status(400).json({ error: "Message or files required" });
      }

      const attachments: { url: string; type: string; name: string }[] = [];
      const imageUrls: string[] = [];
      const imageInputs: ChatImageInput[] = [];

      for (const file of files) {
        try {
          const timestamp = Date.now();
          const safeFileName = file.originalname.replace(
            /[^a-zA-Z0-9.-]/g,
            "_",
          );
          const key = `user-${userId}/ai-assistant/${timestamp}-${safeFileName}`;

          const url = await deps.s3UploadService.uploadBuffer(
            file.buffer,
            key,
            file.mimetype,
          );

          attachments.push({
            url,
            type: file.mimetype,
            name: file.originalname,
          });

          if (file.mimetype.startsWith("image/")) {
            imageUrls.push(url);
            imageInputs.push({ url, mediaType: file.mimetype });
          }
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
        }
      }

      const [userMessage] = await deps.db
        .insert(deps.aiAssistantMessagesTable)
        .values({
          userId,
          role: "user",
          content: message || "",
          attachments: attachments.length > 0 ? attachments : null,
        })
        .returning();

      let aiResponse = "";

      const systemPrompt = isGeneralMode
        ? ASSISTANT_GENERIC_SYSTEM_PROMPT
        : ASSISTANT_REAL_ESTATE_SYSTEM_PROMPT;

      try {
        if (imageUrls.length === 0) {
          if (provider === "claude") {
            const { anthropicService } = await deps.loadAnthropic();
            const claudeResult = await anthropicService.chat(
              message || "",
              [],
              systemPrompt,
            );
            if (claudeResult.success && claudeResult.message) {
              aiResponse = claudeResult.message;
            } else {
              console.warn(
                `⚠️ [AI Assistant] Claude failed, falling back to OpenAI: ${claudeResult.error}`,
              );
            }
          } else if (provider === "gemini") {
            const { geminiService } = await deps.loadGemini();
            const geminiResult = await geminiService.chat(
              message || "",
              [],
              systemPrompt,
            );
            if (geminiResult.success && geminiResult.message) {
              aiResponse = geminiResult.message;
            } else {
              console.warn(
                `⚠️ [AI Assistant] Gemini failed, falling back to OpenAI: ${geminiResult.error}`,
              );
            }
          }
        } else if (provider === "claude") {
          console.log(
            `🖼️ [AI Assistant] Claude selected with ${imageUrls.length} image(s) — using Claude vision`,
          );
          const { anthropicService } = await deps.loadAnthropic();
          const claudeResult = await anthropicService.chat(
            message || "",
            [],
            systemPrompt,
            imageInputs,
          );
          if (claudeResult.success && claudeResult.message) {
            aiResponse = claudeResult.message;
          } else {
            console.warn(
              `⚠️ [AI Assistant] Claude vision failed, falling back to GPT-4o vision: ${claudeResult.error}`,
            );
          }
        } else if (provider === "gemini") {
          console.log(
            `🖼️ [AI Assistant] Gemini selected with ${imageUrls.length} image(s) — using Gemini vision`,
          );
          const { geminiService } = await deps.loadGemini();
          const geminiResult = await geminiService.chat(
            message || "",
            [],
            systemPrompt,
            imageInputs,
          );
          if (geminiResult.success && geminiResult.message) {
            aiResponse = geminiResult.message;
          } else {
            console.warn(
              `⚠️ [AI Assistant] Gemini vision failed, falling back to GPT-4o vision: ${geminiResult.error}`,
            );
          }
        }

        if (aiResponse) {
          // Provider path succeeded; skip OpenAI calls.
        } else if (imageUrls.length > 0) {
          const contentParts: any[] = [];

          if (message) {
            contentParts.push({ type: "text", text: message });
          }

          for (const imageUrl of imageUrls) {
            contentParts.push({
              type: "image_url",
              image_url: { url: imageUrl },
            });
          }

          const response = await deps.multiOpenAI.makeRequest(
            "vision",
            async (client) => {
              return await client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: contentParts },
                ],
                max_tokens: 2000,
              });
            },
          );

          aiResponse = response.choices?.[0]?.message?.content || "";

          if (!aiResponse || aiResponse.trim() === "") {
            const retryResponse = await deps.multiOpenAI.makeRequest(
              "content",
              async (client) => {
                return await client.chat.completions.create({
                  model: "gpt-4o",
                  messages: [
                    {
                      role: "system",
                      content: isGeneralMode
                        ? "You are a helpful AI assistant. Be concise."
                        : "You are a helpful real estate AI assistant. Be concise.",
                    },
                    {
                      role: "user",
                      content:
                        message ||
                        "Please describe what you see in the uploaded images.",
                    },
                  ],
                  max_tokens: 1000,
                });
              },
            );
            aiResponse = retryResponse.choices?.[0]?.message?.content || "";
          }
        } else {
          const response = await deps.multiOpenAI.makeRequest(
            "content",
            async (client) => {
              return await client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: message },
                ],
                max_tokens: 2000,
              });
            },
          );

          aiResponse = response.choices?.[0]?.message?.content || "";

          if (!aiResponse || aiResponse.trim() === "") {
            const retryResponse = await deps.multiOpenAI.makeRequest(
              "content",
              async (client) => {
                return await client.chat.completions.create({
                  model: "gpt-4o",
                  messages: [
                    {
                      role: "system",
                      content: isGeneralMode
                        ? "You are a helpful assistant. Be concise."
                        : "You are a helpful real estate assistant. Be concise.",
                    },
                    { role: "user", content: message },
                  ],
                  max_tokens: 1000,
                });
              },
            );
            aiResponse = retryResponse.choices?.[0]?.message?.content || "";
          }
        }

        if (!aiResponse || aiResponse.trim() === "") {
          aiResponse =
            "I'm having trouble processing your request right now. Could you try rephrasing your question or try again in a moment?";
        }
      } catch (openaiError: any) {
        console.error("OpenAI error:", openaiError);
        aiResponse =
          "I apologize, but I'm having trouble processing your request right now. Please try again later.";
      }

      const [assistantMessage] = await deps.db
        .insert(deps.aiAssistantMessagesTable)
        .values({
          userId,
          role: "assistant",
          content: aiResponse,
          attachments: null,
        })
        .returning();

      res.json({
        userMessage,
        assistantMessage,
      });
    } catch (error: any) {
      console.error("Error in AI assistant chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  };
}

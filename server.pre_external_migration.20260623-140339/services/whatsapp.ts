import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class WhatsAppService {
  
  // Send a text message via WhatsApp Cloud API
  async sendTextMessage(phoneNumberId: string, accessToken: string, to: string, text: string): Promise<any> {
    console.log(`📱 WhatsApp: Sending text to ${to}`);
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp API Error:", error);
      throw new Error(`WhatsApp API error: ${error.error?.message || "Unknown error"}`);
    }

    const result = await response.json();
    console.log(`📱 WhatsApp: Message sent successfully, id: ${result.messages?.[0]?.id}`);
    return result;
  }

  // Send an image message via WhatsApp Cloud API
  async sendImageMessage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string): Promise<any> {
    console.log(`📱 WhatsApp: Sending image to ${to}`);
    
    // WhatsApp requires HTTPS URLs - proxy HTTP through our server if needed
    let resolvedUrl = imageUrl;
    if (resolvedUrl.startsWith("http://")) {
      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL || "https://multi-users-realtyflow.replit.app";
      resolvedUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(resolvedUrl)}`;
    }

    const body: any = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: resolvedUrl },
    };
    if (caption) {
      body.image.caption = caption;
    }

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Image API Error:", error);
      throw new Error(`WhatsApp API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  // Send a template message (required for initiating conversations)
  async sendTemplateMessage(phoneNumberId: string, accessToken: string, to: string, templateName: string, languageCode: string = "en_US", components?: any[]): Promise<any> {
    console.log(`📱 WhatsApp: Sending template "${templateName}" to ${to}`);
    
    const body: any = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components) {
      body.template.components = components;
    }

    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Template API Error:", error);
      throw new Error(`WhatsApp API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async getMessageTemplates(wabId: string, accessToken: string): Promise<any[]> {
    console.log(`📱 WhatsApp: Fetching message templates for WABA ${wabId}`);
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${wabId}/message_templates?fields=name,status,category,language,components&limit=100`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Templates Fetch Error:", error);
      throw new Error(`WhatsApp API error: ${error.error?.message || "Unknown error"}`);
    }

    const result = await response.json();
    return (result.data || []).filter((t: any) => {
      const status = (t.status || "").toUpperCase();
      return status === "APPROVED" || status.startsWith("ACTIVE") || status === "PENDING";
    });
  }

  // Mark a message as read
  async markAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<void> {
    await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    );
  }

  // Generate AI chatbot response for real estate context
  async generateChatbotResponse(
    messageText: string,
    conversationHistory: Array<{ role: string; content: string }>,
    settings: {
      aiPersonality?: string;
      agentName?: string;
      brokerageName?: string;
      serviceAreas?: string[];
      specialties?: string[];
    },
    leadInfo: {
      leadName?: string | null;
      leadEmail?: string | null;
      askForName?: boolean;
      askForEmail?: boolean;
    }
  ): Promise<{ response: string; extractedInfo: { name?: string; email?: string; interest?: string } }> {
    const personalityMap: Record<string, string> = {
      friendly: "warm, approachable, and enthusiastic",
      professional: "professional, knowledgeable, and courteous",
      casual: "casual, relatable, and conversational",
    };

    const personality = personalityMap[settings.aiPersonality || "friendly"] || personalityMap.friendly;

    let leadPrompt = "";
    if (leadInfo.askForName && !leadInfo.leadName) {
      leadPrompt += "\n- Try to naturally ask for the person's name if they haven't provided it.";
    }
    if (leadInfo.askForEmail && !leadInfo.leadEmail) {
      leadPrompt += "\n- Try to naturally ask for their email address for follow-up.";
    }

    const systemPrompt = `You are an AI assistant for ${settings.agentName || "a real estate agent"}${settings.brokerageName ? ` at ${settings.brokerageName}` : ""}. 
Your tone is ${personality}.
${settings.serviceAreas?.length ? `Service areas: ${settings.serviceAreas.join(", ")}` : ""}
${settings.specialties?.length ? `Specialties: ${settings.specialties.join(", ")}` : ""}

Your goal is to:
1. Answer real estate questions helpfully
2. Qualify leads by understanding their needs (buying, selling, budget, timeline)
3. Capture contact information naturally${leadPrompt}
4. Encourage them to schedule a showing or consultation

Keep responses concise (under 160 characters when possible for WhatsApp readability).
If they seem like a serious buyer/seller, suggest connecting with the agent directly.

IMPORTANT: Also analyze the message and extract any of these details if mentioned:
- Name (if they introduce themselves)
- Email address
- Interest (buying/selling/both/renting/general)

Return your response as JSON: {"response": "your message", "extractedInfo": {"name": "if found", "email": "if found", "interest": "if found"}}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: "user", content: messageText },
    ];

    try {
      const systemMsg = messages.find((m: any) => m.role === 'system')?.content;
      const otherMsgs = messages.filter((m: any) => m.role !== 'system');
      const completion = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: otherMsgs.map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config: { systemInstruction: systemMsg, maxOutputTokens: 300, responseMimeType: 'application/json' },
      });

      const content = completion.text || '{"response": "Thanks for reaching out! How can I help you with your real estate needs?", "extractedInfo": {}}';
      const parsed = JSON.parse(content);
      return {
        response: parsed.response || "Thanks for your message! How can I help?",
        extractedInfo: parsed.extractedInfo || {},
      };
    } catch (error) {
      console.error("WhatsApp AI generation error:", error);
      return {
        response: "Thanks for reaching out! I'll connect you with our agent shortly. How can we help you today?",
        extractedInfo: {},
      };
    }
  }

  async getTemplateAnalytics(wabaId: string, accessToken: string, templateIds: string[], startDate: number, endDate: number): Promise<any> {
    const url = new URL(`https://graph.facebook.com/v25.0/${wabaId}/template_analytics`);
    url.searchParams.set("start", String(startDate));
    url.searchParams.set("end", String(endDate));
    url.searchParams.set("granularity", "DAILY");
    url.searchParams.set("template_ids", JSON.stringify(templateIds));
    url.searchParams.set("metric_types", JSON.stringify(["SENT", "DELIVERED", "READ", "REPLIED", "CLICKED", "COST"]));

    console.log(`📊 WhatsApp: Fetching template analytics for WABA ${wabaId} (${templateIds.length} templates)`);
    const response = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Template Analytics Error:", error);
      throw new Error(`WhatsApp Analytics API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async enableTemplateInsights(wabaId: string, accessToken: string): Promise<boolean> {
    try {
      console.log(`📊 WhatsApp: Enabling template insights for WABA ${wabaId}`);
      const response = await fetch(
        `https://graph.facebook.com/v25.0/${wabaId}?is_enabled_for_insights=true`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );
      if (response.ok) {
        console.log(`✅ Template insights enabled for WABA ${wabaId}`);
        return true;
      }
      const error = await response.json();
      console.warn(`⚠️ Template insights enable response:`, error);
      return false;
    } catch (err) {
      console.warn("Could not enable template insights:", err);
      return false;
    }
  }

  async getMessagingAnalytics(wabaId: string, accessToken: string, startTimestamp: number, endTimestamp: number): Promise<any> {
    const url = `https://graph.facebook.com/v25.0/${wabaId}?fields=analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(DAY)&access_token=${accessToken}`;

    console.log(`📊 WhatsApp: Fetching messaging analytics for WABA ${wabaId}`);
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Messaging Analytics Error:", error);
      throw new Error(`WhatsApp Messaging Analytics API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async getConversationAnalytics(wabaId: string, accessToken: string, startTimestamp: number, endTimestamp: number): Promise<any> {
    const url = `https://graph.facebook.com/v25.0/${wabaId}?fields=conversation_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(DAILY).phone_numbers([]).dimensions(["CONVERSATION_CATEGORY","CONVERSATION_TYPE","COUNTRY"])&access_token=${accessToken}`;

    console.log(`📊 WhatsApp: Fetching conversation analytics for WABA ${wabaId}`);
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Conversation Analytics Error:", error);
      throw new Error(`WhatsApp Conversation Analytics API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async getPricingAnalytics(wabaId: string, accessToken: string, startTimestamp: number, endTimestamp: number): Promise<any> {
    const url = `https://graph.facebook.com/v25.0/${wabaId}?fields=pricing_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE","COUNTRY"])&access_token=${accessToken}`;

    console.log(`📊 WhatsApp: Fetching pricing analytics for WABA ${wabaId}`);
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Pricing Analytics Error:", error);
      throw new Error(`WhatsApp Pricing Analytics API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async getPhoneNumberAnalytics(phoneNumberId: string, accessToken: string): Promise<any> {
    console.log(`📊 WhatsApp: Fetching phone number quality for ${phoneNumberId}`);
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number,status`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Phone Analytics Error:", error);
      throw new Error(`WhatsApp Phone API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  async getAccountInfo(wabaId: string, accessToken: string): Promise<any> {
    console.log(`📊 WhatsApp: Fetching account info for WABA ${wabaId}`);
    const response = await fetch(
      `https://graph.facebook.com/v25.0/${wabaId}?fields=account_review_status,is_enabled_for_insights`,
      {
        headers: { "Authorization": `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("WhatsApp Account Info Error:", error);
      throw new Error(`WhatsApp Account API error: ${error.error?.message || "Unknown error"}`);
    }

    return await response.json();
  }

  // Verify webhook signature from Meta
  verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean {
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");
    return `sha256=${expectedSignature}` === signature;
  }
}

export const whatsappService = new WhatsAppService();

import twilio from 'twilio';
import type { TwilioSettings, TwilioMessage, TwilioConversation } from '@shared/schema';
import { GoogleGenAI } from '@google/genai';

const { MessagingResponse, VoiceResponse } = twilio.twiml;

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class TwilioService {
  generateSmsResponse(message: string): string {
    const twiml = new MessagingResponse();
    twiml.message(message);
    return twiml.toString();
  }

  generateVoiceResponse(settings: TwilioSettings): string {
    const twiml = new VoiceResponse();
    const greeting = settings.voiceGreeting || "Hello! Thank you for calling. I'm an AI assistant. How can I help you today?";
    
    twiml.say({ voice: 'Polly.Joanna' }, greeting);
    
    const gather = twiml.gather({
      input: ['speech'],
      timeout: 5,
      action: '/api/twilio/voice-input',
      method: 'POST',
    });
    gather.say({ voice: 'Polly.Joanna' }, 'Please tell me how I can help you.');
    
    if (settings.transferNumber) {
      twiml.say({ voice: 'Polly.Joanna' }, 'I didn\'t catch that. Let me transfer you to our agent.');
      twiml.dial(settings.transferNumber);
    } else {
      twiml.say({ voice: 'Polly.Joanna' }, 'I\'m sorry, I didn\'t catch that. Please try again or leave a message.');
    }
    
    return twiml.toString();
  }

  generateVoiceInputResponse(speechResult: string, settings: TwilioSettings): string {
    const twiml = new VoiceResponse();
    
    if (speechResult) {
      twiml.say(
        { voice: 'Polly.Joanna' }, 
        'Thank you for your message. One of our agents will get back to you shortly.'
      );
      
      if (settings.transferNumber) {
        twiml.say({ voice: 'Polly.Joanna' }, 'Let me connect you with an agent now.');
        twiml.dial(settings.transferNumber);
      }
    } else {
      twiml.say({ voice: 'Polly.Joanna' }, 'I\'m sorry, I couldn\'t understand. Please try again later.');
    }
    
    twiml.hangup();
    return twiml.toString();
  }

  async generateChatbotResponse(
    message: string,
    conversationHistory: TwilioMessage[],
    settings: TwilioSettings
  ): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(settings);
      const messages = this.buildConversationMessages(conversationHistory, message, systemPrompt);
      
      const systemMsg = messages.find((m: any) => m.role === 'system')?.content;
      const otherMsgs = messages.filter((m: any) => m.role !== 'system');
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: otherMsgs.map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config: { systemInstruction: systemMsg, maxOutputTokens: 300 },
      });
      
      return response.text || this.getFallbackResponse(settings);
    } catch (error) {
      console.error('Error generating chatbot response:', error);
      return this.getFallbackResponse(settings);
    }
  }

  private buildSystemPrompt(settings: TwilioSettings): string {
    const agentName = settings.agentName || 'a local real estate agent';
    const brokerageName = settings.brokerageName || 'our brokerage';
    const serviceAreas = settings.serviceAreas?.join(', ') || 'the local area';
    const specialties = settings.specialties?.join(', ') || 'residential real estate';
    const personality = settings.aiPersonality || 'friendly';

    const personalityDescriptions: Record<string, string> = {
      friendly: 'warm, approachable, and helpful while maintaining professionalism',
      professional: 'formal, polished, and business-focused',
      casual: 'relaxed, conversational, and easy-going',
    };

    const personalityDescription = personalityDescriptions[personality] || personalityDescriptions.friendly;

    return `You are an AI assistant for ${agentName} at ${brokerageName}. You help potential home buyers and sellers via SMS.

Your communication style should be ${personalityDescription}.

Key information:
- Agent: ${agentName}
- Brokerage: ${brokerageName}
- Service Areas: ${serviceAreas}
- Specialties: ${specialties}

Your goals:
1. Answer questions about real estate and the local market
2. Qualify leads by understanding their buying/selling needs
3. Collect contact information (name, email) when appropriate
4. Schedule appointments or callbacks with the agent
5. Provide helpful information while encouraging them to work with ${agentName}

Keep responses concise (under 160 characters when possible for SMS) but informative.
If you don't know specific details, offer to have the agent follow up.
Always be helpful and never dismiss potential clients.`;
  }

  private buildConversationMessages(
    history: TwilioMessage[],
    currentMessage: string,
    systemPrompt: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      const role = msg.direction === 'inbound' ? 'user' : 'assistant';
      messages.push({ role, content: msg.body });
    }

    messages.push({ role: 'user', content: currentMessage });

    return messages;
  }

  private getFallbackResponse(settings: TwilioSettings): string {
    const agentName = settings.agentName || 'our agent';
    return `Thanks for your message! ${agentName} will get back to you shortly. How can we help with your real estate needs?`;
  }

  isWithinBusinessHours(settings: TwilioSettings): boolean {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;

    const startParts = (settings.businessHoursStart || '09:00').split(':');
    const endParts = (settings.businessHoursEnd || '17:00').split(':');
    
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || '0');
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || '0');

    return currentTime >= startMinutes && currentTime <= endMinutes;
  }

  extractLeadInfo(message: string, existingLead: Partial<TwilioConversation>): Partial<TwilioConversation> {
    const updates: Partial<TwilioConversation> = {};

    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !existingLead.leadEmail) {
      updates.leadEmail = emailMatch[0];
    }

    const buyingKeywords = ['buy', 'buying', 'purchase', 'looking for', 'search', 'find'];
    const sellingKeywords = ['sell', 'selling', 'list', 'listing'];
    const lowerMessage = message.toLowerCase();

    if (!existingLead.leadInterest) {
      const wantsToBuy = buyingKeywords.some(k => lowerMessage.includes(k));
      const wantsToSell = sellingKeywords.some(k => lowerMessage.includes(k));

      if (wantsToBuy && wantsToSell) {
        updates.leadInterest = 'both';
      } else if (wantsToBuy) {
        updates.leadInterest = 'buying';
      } else if (wantsToSell) {
        updates.leadInterest = 'selling';
      }
    }

    return updates;
  }
}

export const twilioService = new TwilioService();

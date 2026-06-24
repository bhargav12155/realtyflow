import { log } from "console";

export interface HeyGenTemplate {
  template_id: string;
  name: string;
  thumbnail_image_url: string;
  aspect_ratio: string;
}

export interface TemplateVariable {
  name: string;
  type: string;
  properties: {
    content?: string;
    url?: string;
    asset_id?: string;
    fit?: string;
    play_style?: string;
    character_id?: string;
    voice_id?: string;
  };
}

export interface TemplateScene {
  id: string;
  script: string;
  variables: TemplateVariable[];
}

export interface TemplateDetails {
  version: string;
  scenes: TemplateScene[] | null;
  variables: Record<string, TemplateVariable>;
}

export class HeyGenTemplateService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  // List all available templates
  async listTemplates(): Promise<HeyGenTemplate[]> {
    try {
      const response = await fetch('https://api.heygen.com/v2/templates', {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('HeyGen Templates API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Failed to list templates: ${response.status}`);
      }

      const data = await response.json();
      // HeyGen returns { error, data: { templates: [...] } }
      return data.data?.templates || [];
    } catch (error) {
      console.error('Failed to list HeyGen templates:', error);
      throw error;
    }
  }

  // Get template details (V3 API for new AI Studio support)
  async getTemplateDetails(templateId: string): Promise<TemplateDetails> {
    try {
      const response = await fetch(`https://api.heygen.com/v3/template/${templateId}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('HeyGen Template Details API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Failed to get template details: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to get template details:', error);
      throw error;
    }
  }

  // Generate video from template
  async generateVideoFromTemplate(
    templateId: string,
    options: {
      title?: string;
      variables?: Record<string, any>;
      caption?: boolean;
      dimension?: { width: number; height: number };
      include_gif?: boolean;
      enable_sharing?: boolean;
      folder_id?: string;
      brand_voice_id?: string;
      callback_url?: string;
      scene_ids?: string[];
    }
  ): Promise<{ video_id: string }> {
    try {
      const response = await fetch(`https://api.heygen.com/v2/template/${templateId}/generate`, {
        method: 'POST',
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caption: options.caption || false,
          title: options.title,
          variables: options.variables || {},
          dimension: options.dimension,
          include_gif: options.include_gif || false,
          enable_sharing: options.enable_sharing,
          folder_id: options.folder_id,
          brand_voice_id: options.brand_voice_id,
          callback_url: options.callback_url,
          scene_ids: options.scene_ids,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('HeyGen Generate Template Video API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Failed to generate video from template: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return { video_id: data.data?.video_id };
    } catch (error) {
      console.error('Failed to generate video from template:', error);
      throw error;
    }
  }
}

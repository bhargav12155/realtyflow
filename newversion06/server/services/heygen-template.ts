interface Template {
  template_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  duration: number;
  variables: TemplateVariable[];
  created_at: string;
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'image' | 'video' | 'avatar' | 'voice' | 'background';
  properties: any;
}

interface GenerateTemplateOptions {
  templateId: string;
  variables: Record<string, any>;
  title?: string;
  test?: boolean;
}

export class HeyGenTemplateService {
  private apiKey: string;
  private baseUrl = 'https://api.heygen.com/v2';

  constructor() {
    const apiKey = process.env.HEYGEN_API_KEY;
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is not set in environment variables');
    }
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HeyGen Template API error at ${endpoint}:`, response.status, errorText);
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // List all available templates
  async listTemplates(limit: number = 100, offset: number = 0) {
    const response = await this.makeRequest(`/templates?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // Get specific template details
  async getTemplate(templateId: string) {
    const response = await this.makeRequest(`/templates/${templateId}`);
    return response.data;
  }

  // Create custom template
  async createTemplate(name: string, description: string, elements: any[]) {
    const payload = {
      name,
      description,
      elements,
      dimension: {
        width: 1280,
        height: 720
      }
    };

    const response = await this.makeRequest('/templates', 'POST', payload);
    return response.data;
  }

  // Generate video from template with variables
  async generateFromTemplate(options: GenerateTemplateOptions) {
    const { templateId, variables, title, test = false } = options;

    // Format variables for the API
    const formattedVariables: any = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        // Text variable
        formattedVariables[key] = {
          name: key,
          type: 'text',
          properties: {
            content: value
          }
        };
      } else if (value.type === 'avatar') {
        // Avatar replacement
        formattedVariables[key] = {
          name: key,
          type: 'character',
          properties: {
            type: value.isTalkingPhoto ? 'talking_photo' : 'avatar',
            character_id: value.avatarId,
            ...(value.voiceId && { voice_id: value.voiceId })
          }
        };
      } else if (value.type === 'background') {
        // Background replacement
        formattedVariables[key] = {
          name: key,
          type: 'background',
          properties: value.properties || {
            type: 'color',
            value: '#ffffff'
          }
        };
      } else if (value.type === 'image') {
        // Image replacement
        formattedVariables[key] = {
          name: key,
          type: 'image',
          properties: {
            url: value.url
          }
        };
      } else {
        // Default to passing through
        formattedVariables[key] = value;
      }
    }

    const payload = {
      variables: formattedVariables,
      test,
      ...(title && { title })
    };

    const response = await this.makeRequest(`/template/${templateId}/generate`, 'POST', payload);
    return response.data;
  }

  // Update template
  async updateTemplate(templateId: string, updates: Partial<Template>) {
    const response = await this.makeRequest(`/templates/${templateId}`, 'PUT', updates);
    return response.data;
  }

  // Delete template
  async deleteTemplate(templateId: string) {
    const response = await this.makeRequest(`/templates/${templateId}`, 'DELETE');
    return response.data;
  }

  // Get template variables
  async getTemplateVariables(templateId: string) {
    const template = await this.getTemplate(templateId);
    return template.variables || [];
  }

  // Create template from existing video
  async createTemplateFromVideo(videoId: string, name: string) {
    const payload = {
      video_id: videoId,
      name,
      extract_variables: true
    };

    const response = await this.makeRequest('/templates/from_video', 'POST', payload);
    return response.data;
  }

  // Duplicate template
  async duplicateTemplate(templateId: string, newName: string) {
    const payload = {
      source_template_id: templateId,
      name: newName
    };

    const response = await this.makeRequest('/templates/duplicate', 'POST', payload);
    return response.data;
  }

  // Get template generation status
  async getTemplateGenerationStatus(generationId: string) {
    // Uses the same video status endpoint
    const url = `https://api.heygen.com/v1/video_status.get?video_id=${generationId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get template generation status: ${response.status}`);
    }

    return await response.json();
  }

  // Get popular templates for real estate
  async getRealEstateTemplates() {
    let realEstateTemplates: Template[] = [];
    
    try {
      const allTemplates = await this.listTemplates();
      
      // Filter for real estate related templates
      const realEstateKeywords = ['property', 'real estate', 'home', 'house', 'listing', 'tour', 'walkthrough'];
      
      realEstateTemplates = allTemplates.templates?.filter((template: Template) => {
        const searchString = `${template.name} ${template.description}`.toLowerCase();
        return realEstateKeywords.some(keyword => searchString.includes(keyword));
      }) || [];
      
      if (realEstateTemplates.length > 0) {
        return { templates: realEstateTemplates };
      }
    } catch (error) {
      console.log('Failed to fetch templates, returning suggestions instead');
    }

    // If no real estate templates found, provide suggestions
    if (realEstateTemplates.length === 0) {
      return {
        templates: [],
        suggestions: [
          {
            name: "Property Tour Template",
            description: "Virtual property walkthrough with agent narration",
            recommended_variables: {
              property_address: "text",
              agent_avatar: "avatar",
              property_images: "image[]",
              price: "text",
              features: "text"
            }
          },
          {
            name: "Market Update Template",
            description: "Monthly real estate market analysis video",
            recommended_variables: {
              month: "text",
              market_stats: "text",
              agent_avatar: "avatar",
              charts: "image[]"
            }
          },
          {
            name: "Agent Introduction Template",
            description: "Professional agent introduction and services",
            recommended_variables: {
              agent_name: "text",
              agent_avatar: "avatar",
              expertise: "text",
              contact_info: "text"
            }
          }
        ]
      };
    }

    return { templates: realEstateTemplates };
  }
}
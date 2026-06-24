import { storage } from "../storage";

interface TemplateDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  scriptTemplate: string;
  sortOrder: number;
  variables: Array<{
    key: string;
    label: string;
    fieldType: string;
    placeholder?: string;
    helperText?: string;
    required?: boolean;
    options?: string[];
    defaultValue?: string;
    orderIndex: number;
  }>;
}

const REAL_ESTATE_TEMPLATES: TemplateDefinition[] = [
  {
    slug: "just-listed",
    name: "Just Listed",
    category: "property",
    description: "Announce a new property listing with excitement and key details",
    sortOrder: 1,
    scriptTemplate: `🏠 Just Listed! I'm thrilled to present {{property_address}} in the beautiful {{neighborhood}} neighborhood!

This stunning {{bedrooms}}-bedroom, {{bathrooms}}-bathroom home offers {{square_footage}} square feet of exceptional living space.

Listed at {{listing_price}}, this property won't last long in today's market!

{{highlights}}

Ready to schedule a private showing? Contact me today!

I'm {{agent_name}}, and I'd love to help you find your dream home.
{{call_to_action}}`,
    variables: [
      { key: "property_address", label: "Property Address", fieldType: "text", placeholder: "123 Main Street, Omaha, NE", helperText: "Full street address of the listing", required: true, orderIndex: 1 },
      { key: "neighborhood", label: "Neighborhood", fieldType: "text", placeholder: "Aksarben", helperText: "Name of the neighborhood", required: true, orderIndex: 2 },
      { key: "bedrooms", label: "Bedrooms", fieldType: "number", placeholder: "4", required: true, orderIndex: 3 },
      { key: "bathrooms", label: "Bathrooms", fieldType: "text", placeholder: "2.5", required: true, orderIndex: 4 },
      { key: "square_footage", label: "Square Footage", fieldType: "text", placeholder: "2,500", required: true, orderIndex: 5 },
      { key: "listing_price", label: "Listing Price", fieldType: "text", placeholder: "$425,000", required: true, orderIndex: 6 },
      { key: "highlights", label: "Property Highlights", fieldType: "rich_text", placeholder: "Updated kitchen, hardwood floors, large backyard...", helperText: "Key features that make this property special", required: false, orderIndex: 7 },
      { key: "agent_name", label: "Your Name", fieldType: "text", placeholder: "Mike Bjork", required: true, orderIndex: 8 },
      { key: "call_to_action", label: "Call to Action", fieldType: "text", placeholder: "Call me at 402-555-1234", defaultValue: "Reach out today to schedule your showing!", required: true, orderIndex: 9 }
    ]
  },
  {
    slug: "open-house",
    name: "Open House Invitation",
    category: "property",
    description: "Invite buyers to your upcoming open house event",
    sortOrder: 2,
    scriptTemplate: `🏡 You're Invited! Join me for an Open House at {{property_address}}!

📅 {{open_house_date}}
⏰ {{start_time}} - {{end_time}}

This is your chance to explore this incredible home in person!

{{highlights}}

Can't make the open house? No problem! I'm happy to arrange a private showing at your convenience.

I'm {{agent_name}} with BHHS Ambassador Real Estate.
See you there!`,
    variables: [
      { key: "property_address", label: "Property Address", fieldType: "text", placeholder: "456 Oak Avenue, Omaha, NE", required: true, orderIndex: 1 },
      { key: "open_house_date", label: "Open House Date", fieldType: "date", placeholder: "Saturday, December 14th", required: true, orderIndex: 2 },
      { key: "start_time", label: "Start Time", fieldType: "text", placeholder: "1:00 PM", required: true, orderIndex: 3 },
      { key: "end_time", label: "End Time", fieldType: "text", placeholder: "4:00 PM", required: true, orderIndex: 4 },
      { key: "highlights", label: "Property Highlights", fieldType: "rich_text", placeholder: "3 bedrooms, renovated kitchen, beautiful backyard...", helperText: "Key features to highlight", required: false, orderIndex: 5 },
      { key: "agent_name", label: "Your Name", fieldType: "text", placeholder: "Mike Bjork", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "market-update",
    name: "Market Update",
    category: "market",
    description: "Share local real estate market insights and trends",
    sortOrder: 3,
    scriptTemplate: `📊 {{market_area}} Real Estate Market Update

Here's what you need to know about the current market:

💰 Median Home Price: {{median_price}}
📈 Market Status: {{inventory_level}}

🏠 For Buyers:
{{buyer_tip}}

🏡 For Sellers:
{{seller_tip}}

The market is always changing, and staying informed is key to making the best real estate decisions.

I'm {{agent_name}}, your local real estate expert. Have questions about buying or selling in today's market? Let's connect!`,
    variables: [
      { key: "market_area", label: "Market Area", fieldType: "text", placeholder: "Omaha Metro", required: true, orderIndex: 1 },
      { key: "median_price", label: "Median Home Price", fieldType: "text", placeholder: "$325,000", required: true, orderIndex: 2 },
      { key: "inventory_level", label: "Inventory Level/Status", fieldType: "text", placeholder: "Low inventory - seller's market", required: true, orderIndex: 3 },
      { key: "buyer_tip", label: "Tip for Buyers", fieldType: "rich_text", placeholder: "Be prepared to act fast. Get pre-approved before you start looking!", required: true, orderIndex: 4 },
      { key: "seller_tip", label: "Tip for Sellers", fieldType: "rich_text", placeholder: "Now is a great time to list. Low inventory means more buyer interest!", required: true, orderIndex: 5 },
      { key: "agent_name", label: "Your Name", fieldType: "text", placeholder: "Mike Bjork", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "agent-introduction",
    name: "Agent Introduction",
    category: "personal",
    description: "Introduce yourself to potential clients and build trust",
    sortOrder: 4,
    scriptTemplate: `👋 Hi there! I'm {{agent_name}}, and I'm so glad you're here!

As a real estate professional with {{brokerage_name}}, I've been helping families find their perfect homes for {{years_experience}} years.

My specialties include:
{{specialties}}

I proudly serve the {{service_areas}} areas, and I'm passionate about making the home buying and selling process as smooth and stress-free as possible.

Whether you're a first-time buyer, looking to upgrade, or ready to sell, I'm here to guide you every step of the way.

Let's connect! You can reach me at {{contact_email}}.
I can't wait to help you achieve your real estate goals!`,
    variables: [
      { key: "agent_name", label: "Your Name", fieldType: "text", placeholder: "Mike Bjork", required: true, orderIndex: 1 },
      { key: "brokerage_name", label: "Brokerage Name", fieldType: "text", placeholder: "BHHS Ambassador Real Estate", defaultValue: "BHHS Ambassador Real Estate", required: true, orderIndex: 2 },
      { key: "years_experience", label: "Years of Experience", fieldType: "text", placeholder: "10+", required: true, orderIndex: 3 },
      { key: "specialties", label: "Your Specialties", fieldType: "rich_text", placeholder: "First-time homebuyers, luxury properties, investment properties...", required: true, orderIndex: 4 },
      { key: "service_areas", label: "Service Areas", fieldType: "text", placeholder: "Omaha, Bellevue, and Papillion", required: true, orderIndex: 5 },
      { key: "contact_email", label: "Contact Email", fieldType: "text", placeholder: "mike@bhhsamb.com", required: true, orderIndex: 6 }
    ]
  },
  {
    slug: "neighborhood-spotlight",
    name: "Neighborhood Spotlight",
    category: "community",
    description: "Highlight a local neighborhood and its unique features",
    sortOrder: 5,
    scriptTemplate: `🌟 Neighborhood Spotlight: {{neighborhood_name}}

Let me tell you why {{neighborhood_name}} is one of the most sought-after neighborhoods in the area!

✨ What makes it special:
{{signature_feature}}

📊 Market Insight:
{{recent_stat}}

🎉 Community Highlights:
{{local_event}}

If you're thinking about calling {{neighborhood_name}} home, I'd love to show you around and introduce you to this wonderful community.

I'm {{agent_name}}, your local neighborhood expert.
Call me at {{contact_phone}} to start your home search today!`,
    variables: [
      { key: "neighborhood_name", label: "Neighborhood Name", fieldType: "text", placeholder: "Aksarben Village", required: true, orderIndex: 1 },
      { key: "signature_feature", label: "Signature Features", fieldType: "rich_text", placeholder: "Tree-lined streets, walkable to shops and restaurants, excellent schools...", required: true, orderIndex: 2 },
      { key: "recent_stat", label: "Recent Market Stat", fieldType: "text", placeholder: "Average home price up 12% this year", required: true, orderIndex: 3 },
      { key: "local_event", label: "Local Events/Attractions", fieldType: "rich_text", placeholder: "Weekly farmers market, annual neighborhood block party, proximity to UNO...", required: true, orderIndex: 4 },
      { key: "agent_name", label: "Your Name", fieldType: "text", placeholder: "Mike Bjork", required: true, orderIndex: 5 },
      { key: "contact_phone", label: "Contact Phone", fieldType: "text", placeholder: "402-555-1234", required: true, orderIndex: 6 }
    ]
  }
];

export async function seedVideoTemplates(): Promise<void> {
  console.log("🎬 Checking video templates...");
  
  for (const templateDef of REAL_ESTATE_TEMPLATES) {
    const existing = await storage.getVideoTemplateBySlug(templateDef.slug);
    
    if (existing) {
      console.log(`  ✓ Template "${templateDef.name}" already exists`);
      continue;
    }

    console.log(`  → Creating template: ${templateDef.name}`);
    
    const template = await storage.createVideoTemplate({
      slug: templateDef.slug,
      name: templateDef.name,
      category: templateDef.category,
      description: templateDef.description,
      scriptTemplate: templateDef.scriptTemplate,
      sortOrder: templateDef.sortOrder,
      isActive: true,
    });

    const variablesToCreate = templateDef.variables.map((v) => ({
      templateId: template.id,
      key: v.key,
      label: v.label,
      fieldType: v.fieldType,
      placeholder: v.placeholder,
      helperText: v.helperText,
      required: v.required ?? true,
      options: v.options,
      defaultValue: v.defaultValue,
      orderIndex: v.orderIndex,
    }));

    await storage.createTemplateVariables(variablesToCreate);
    console.log(`  ✓ Created template "${templateDef.name}" with ${variablesToCreate.length} variables`);
  }

  console.log("🎬 Video templates seeding complete!");
}

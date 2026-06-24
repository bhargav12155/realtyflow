import type { Property, InsertProperty } from "@shared/schema";

export interface MLSSearchParams {
  city?: string;
  state?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  status?: string;
  limit?: number;
}

export interface MLSProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

// This service integrates with MLS/IDX providers like SimplyRETS
export class IDXService {
  private provider: MLSProvider;

  constructor(provider: MLSProvider = this.getDefaultProvider()) {
    this.provider = provider;
  }

  private getDefaultProvider(): MLSProvider {
    return {
      name: "SimplyRETS",
      baseUrl: "https://api.simplyrets.com",
      username: process.env.SIMPLYRETS_USERNAME,
      password: process.env.SIMPLYRETS_PASSWORD,
    };
  }

  private getAuthHeader(): string {
    if (this.provider.username && this.provider.password) {
      const credentials = btoa(`${this.provider.username}:${this.provider.password}`);
      return `Basic ${credentials}`;
    }
    return `Bearer ${this.provider.apiKey || ''}`;
  }

  async searchProperties(params: MLSSearchParams): Promise<Property[]> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params.city) searchParams.append('cities', params.city);
      if (params.state) searchParams.append('state', params.state);
      if (params.minPrice) searchParams.append('minprice', params.minPrice.toString());
      if (params.maxPrice) searchParams.append('maxprice', params.maxPrice.toString());
      if (params.bedrooms) searchParams.append('bedrooms', params.bedrooms.toString());
      if (params.bathrooms) searchParams.append('bathrooms', params.bathrooms.toString());
      if (params.propertyType) searchParams.append('type', params.propertyType);
      if (params.status) searchParams.append('status', params.status);
      if (params.limit) searchParams.append('limit', params.limit.toString());

      const response = await fetch(`${this.provider.baseUrl}/properties?${searchParams}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`MLS API error: ${response.status} ${response.statusText}`);
      }

      const mlsData = await response.json();
      return this.transformMLSDataToProperties(mlsData);
    } catch (error) {
      console.error('IDX Service error:', error);
      // Return sample/fallback data for development when MLS API is unavailable
      return this.getFallbackProperties(params);
    }
  }

  async getPropertyById(mlsId: string): Promise<Property | null> {
    try {
      const response = await fetch(`${this.provider.baseUrl}/properties/${mlsId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`MLS API error: ${response.status} ${response.statusText}`);
      }

      const mlsData = await response.json();
      return this.transformMLSDataToProperty(mlsData);
    } catch (error) {
      console.error('IDX Service error:', error);
      return null;
    }
  }

  private transformMLSDataToProperties(mlsData: any[]): Property[] {
    return mlsData.map(item => this.transformMLSDataToProperty(item)).filter(Boolean) as Property[];
  }

  private transformMLSDataToProperty(mlsItem: any): Property | null {
    try {
      const property: Omit<Property, 'id' | 'createdAt' | 'lastUpdated'> = {
        mlsId: mlsItem.mlsId || mlsItem.listingId,
        listPrice: parseInt(mlsItem.listPrice),
        address: mlsItem.address?.full || `${mlsItem.address?.streetNumber || ''} ${mlsItem.address?.streetName || ''}`.trim(),
        city: mlsItem.address?.city || '',
        state: mlsItem.address?.state || '',
        zipCode: mlsItem.address?.postalCode || '',
        bedrooms: mlsItem.property?.bedrooms || null,
        bathrooms: parseFloat(mlsItem.property?.bathsFull) + (parseFloat(mlsItem.property?.bathsHalf) * 0.5) || null,
        squareFootage: mlsItem.property?.area || null,
        lotSize: mlsItem.property?.lotSize || null,
        yearBuilt: mlsItem.property?.yearBuilt || null,
        propertyType: mlsItem.property?.type || 'Residential',
        listingStatus: mlsItem.listingStatus || 'Active',
        listingDate: new Date(mlsItem.listDate),
        description: mlsItem.remarks || mlsItem.description || '',
        features: mlsItem.property?.features || [],
        photoUrls: mlsItem.photos?.map((photo: any) => photo.href) || [],
        virtualTourUrl: mlsItem.virtualTourUrl || null,
        latitude: parseFloat(mlsItem.geo?.lat) || null,
        longitude: parseFloat(mlsItem.geo?.lng) || null,
        neighborhood: mlsItem.address?.area || null,
        schoolDistrict: mlsItem.school?.district || null,
        agentId: mlsItem.agent?.id || null,
        agentName: mlsItem.agent?.firstName && mlsItem.agent?.lastName 
          ? `${mlsItem.agent.firstName} ${mlsItem.agent.lastName}` 
          : null,
        officeId: mlsItem.office?.id || null,
        officeName: mlsItem.office?.name || null,
      };

      return {
        ...property,
        id: `prop_${property.mlsId}`,
        createdAt: new Date(),
        lastUpdated: new Date(),
      } as Property;
    } catch (error) {
      console.error('Error transforming MLS data:', error);
      return null;
    }
  }

  // Fallback data for development when MLS API is unavailable
  private getFallbackProperties(params: MLSSearchParams): Property[] {
    const sampleProperties: Property[] = [
      {
        id: "prop_sample_1",
        mlsId: "NE12345",
        listPrice: 425000,
        address: "123 Maple Street",
        city: "Omaha",
        state: "NE",
        zipCode: "68154",
        bedrooms: 4,
        bathrooms: 3.5,
        squareFootage: 2400,
        lotSize: 0.25,
        yearBuilt: 2018,
        propertyType: "Single Family Residential",
        listingStatus: "Active",
        listingDate: new Date("2024-11-15"),
        description: "Beautiful two-story home in desirable Aksarben neighborhood. This stunning property features an open floor plan, gourmet kitchen with granite countertops, and a spacious master suite. The finished basement provides additional living space, perfect for entertaining.",
        features: ["Open Floor Plan", "Granite Counters", "Finished Basement", "2-Car Garage", "Fenced Yard"],
        photoUrls: [
          "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
          "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"
        ],
        virtualTourUrl: null,
        latitude: 41.2524,
        longitude: -95.9980,
        neighborhood: "Aksarben",
        schoolDistrict: "Millard Public Schools",
        agentId: "agent_mike_bjork",
        agentName: "Mike Bjork",
        officeId: "office_bhhs",
        officeName: "Berkshire Hathaway HomeServices",
        lastUpdated: new Date(),
        createdAt: new Date(),
      },
      {
        id: "prop_sample_2",
        mlsId: "NE12346",
        listPrice: 375000,
        address: "456 Oak Drive",
        city: "Omaha",
        state: "NE",
        zipCode: "68114",
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1800,
        lotSize: 0.20,
        yearBuilt: 2015,
        propertyType: "Single Family Residential",
        listingStatus: "Active",
        listingDate: new Date("2024-11-20"),
        description: "Charming ranch-style home in quiet Benson neighborhood. Features include hardwood floors throughout, updated kitchen with stainless steel appliances, and a private backyard perfect for summer gatherings.",
        features: ["Hardwood Floors", "Updated Kitchen", "Stainless Appliances", "Private Yard", "Near Parks"],
        photoUrls: [
          "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
          "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800"
        ],
        virtualTourUrl: null,
        latitude: 41.3114,
        longitude: -96.0186,
        neighborhood: "Benson",
        schoolDistrict: "Omaha Public Schools",
        agentId: "agent_mike_bjork",
        agentName: "Mike Bjork",
        officeId: "office_bhhs",
        officeName: "Berkshire Hathaway HomeServices",
        lastUpdated: new Date(),
        createdAt: new Date(),
      },
      {
        id: "prop_sample_3",
        mlsId: "NE12347",
        listPrice: 525000,
        address: "789 Pine Boulevard",
        city: "Omaha",
        state: "NE",
        zipCode: "68130",
        bedrooms: 5,
        bathrooms: 4,
        squareFootage: 3200,
        lotSize: 0.35,
        yearBuilt: 2020,
        propertyType: "Single Family Residential",
        listingStatus: "Active",
        listingDate: new Date("2024-11-22"),
        description: "Stunning modern home in prestigious West Omaha location. This executive property boasts luxury finishes throughout, including quartz countertops, custom cabinetry, and premium hardwood flooring. The gourmet kitchen is a chef's dream with top-of-the-line appliances.",
        features: ["Luxury Finishes", "Quartz Countertops", "Premium Hardwood", "Gourmet Kitchen", "Executive Location"],
        photoUrls: [
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800"
        ],
        virtualTourUrl: null,
        latitude: 41.2459,
        longitude: -96.1091,
        neighborhood: "West Omaha",
        schoolDistrict: "Elkhorn Public Schools",
        agentId: "agent_mike_bjork",
        agentName: "Mike Bjork",
        officeId: "office_bhhs",
        officeName: "Berkshire Hathaway HomeServices",
        lastUpdated: new Date(),
        createdAt: new Date(),
      }
    ];

    // Filter based on search params
    let filtered = sampleProperties;

    if (params.city) {
      filtered = filtered.filter(p => p.city.toLowerCase().includes(params.city!.toLowerCase()));
    }
    if (params.neighborhood) {
      filtered = filtered.filter(p => p.neighborhood?.toLowerCase().includes(params.neighborhood!.toLowerCase()));
    }
    if (params.minPrice) {
      filtered = filtered.filter(p => p.listPrice >= params.minPrice!);
    }
    if (params.maxPrice) {
      filtered = filtered.filter(p => p.listPrice <= params.maxPrice!);
    }
    if (params.bedrooms) {
      filtered = filtered.filter(p => p.bedrooms! >= params.bedrooms!);
    }
    if (params.propertyType) {
      filtered = filtered.filter(p => p.propertyType.toLowerCase().includes(params.propertyType!.toLowerCase()));
    }

    return filtered.slice(0, params.limit || 10);
  }
}
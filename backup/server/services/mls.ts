interface ParagonProperty {
  APIModificationTimestamp: string;
  ListPrice: number;
  UnparsedAddress: string;
  City: string;
  StateOrProvince: string;
  PostalCode: string;
  BedroomsTotal: number | null;
  BathroomsTotalInteger: number | null;
  BathroomsTotalDecimal: number | null;
  LivingArea: number | null;
  PropertyType: string;
  StandardStatus: string;
  ListingContractDate: string;
  PublicRemarks: string;
  Media?: Array<{ MediaURL: string }>;
  Subdivision?: string;
  ListAgentFullName?: string;
  ListingId: string;
  MLSNumber: string;
}

interface SearchParams {
  city?: string;
  state?: string;
  neighborhood?: string;
  propertyType?: string;
  mlsNumber?: string;
  address?: string;
  listingAgent?: string;
}

export class MLSService {
  private baseUrl = 'https://paragonapi.com/platform/mls/bk9/listings';
  private appId = process.env.PARAGON_APP_ID;
  private token = process.env.PARAGON_API_TOKEN;

  async searchProperties(params: SearchParams) {
    if (!this.token || !this.appId) {
      console.warn('Paragon API credentials not configured, returning sample data');
      return this.getFallbackProperties(params);
    }

    // Build search query parameters for Paragon API
    const searchParams = new URLSearchParams({
      limit: '50',
      offset: '0',
      appID: this.appId,
      sortBy: 'APIModificationTimestamp',
    });

    // Build query filters
    const filters: string[] = [];

    if (params.mlsNumber && params.mlsNumber !== '') {
      filters.push(`and[${filters.length}][MLSNumber][eq]=${encodeURIComponent(params.mlsNumber)}`);
    }

    if (params.address && params.address !== '') {
      filters.push(`and[${filters.length}][UnparsedAddress][contains]=${encodeURIComponent(params.address)}`);
    }

    if (params.city && params.city !== '') {
      filters.push(`and[${filters.length}][City][eq]=${encodeURIComponent(params.city)}`);
    }

    if (params.state && params.state !== '') {
      filters.push(`and[${filters.length}][StateOrProvince][eq]=${encodeURIComponent(params.state)}`);
    }

    if (params.listingAgent && params.listingAgent !== '') {
      filters.push(`and[${filters.length}][ListAgentFullName][contains]=${encodeURIComponent(params.listingAgent)}`);
    }

    

    if (params.neighborhood && params.neighborhood !== '') {
      filters.push(`and[${filters.length}][Subdivision][contains]=${encodeURIComponent(params.neighborhood)}`);
    }

    // Add active listings filter (unless searching by specific MLS# which might include inactive)
    if (!params.mlsNumber || params.mlsNumber === '') {
      filters.push(`and[${filters.length}][StandardStatus][eq]=Active`);
    }

    // Combine all filters
    const queryString = searchParams.toString() + (filters.length > 0 ? '&' + filters.join('&') : '');

    try {
      const response = await fetch(`${this.baseUrl}?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`MLS API error: ${response.status} ${response.statusText}`);
      }

      const data: ParagonProperty[] = await response.json();
      
      // Transform Paragon data to our Property interface
      return data.map(this.transformProperty);
    } catch (error) {
      console.error('Error fetching MLS data:', error);
      console.warn('Falling back to sample data due to API error');
      return this.getFallbackProperties(params);
    }
  }

  private getFallbackProperties(params: SearchParams) {
    // Generate sample properties based on search criteria
    const sampleProperties = [
      {
        id: "sample-1",
        mlsId: "22301234",
        listPrice: 575000,
        address: "19863 Cottonwood Street",
        city: "Omaha",
        state: "NE",
        zipCode: "68028",
        bedrooms: 4,
        bathrooms: 3,
        squareFootage: 2890,
        propertyType: "Residential",
        listingStatus: "Active",
        listingDate: "2024-01-15",
        description: "Beautiful 4-bedroom home in desirable Omaha neighborhood. Features open floor plan, updated kitchen, and large backyard perfect for entertaining.",
        features: ["Open Floor Plan", "Updated Kitchen", "Large Backyard", "Hardwood Floors"],
        photoUrls: ["https://via.placeholder.com/400x300/4a90e2/ffffff?text=Property+Image"],
        neighborhood: "Dundee",
        agentName: "Mike Bjork",
      },
      {
        id: "sample-2", 
        mlsId: "22301235",
        listPrice: 425000,
        address: "1456 Maple Avenue",
        city: "Omaha",
        state: "NE",
        zipCode: "68104",
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1850,
        propertyType: "Residential",
        listingStatus: "Active",
        listingDate: "2024-01-10",
        description: "Charming 3-bedroom ranch in established neighborhood. Move-in ready with recent updates throughout.",
        features: ["Ranch Style", "Updated Bathrooms", "Attached Garage", "Fenced Yard"],
        photoUrls: ["https://via.placeholder.com/400x300/e74c3c/ffffff?text=Ranch+Home"],
        neighborhood: "Benson",
        agentName: "Sarah Johnson",
      },
      {
        id: "sample-3",
        mlsId: "22301236", 
        listPrice: 750000,
        address: "2890 Cottonwood Drive",
        city: "Omaha",
        state: "NE",
        zipCode: "68022",
        bedrooms: 5,
        bathrooms: 4,
        squareFootage: 3200,
        propertyType: "Residential",
        listingStatus: "Active",
        listingDate: "2024-01-08",
        description: "Stunning 5-bedroom luxury home with finished basement. Premium finishes and spacious layout throughout.",
        features: ["Luxury Finishes", "Finished Basement", "Walk-in Closets", "Granite Countertops"],
        photoUrls: ["https://via.placeholder.com/400x300/27ae60/ffffff?text=Luxury+Home"],
        neighborhood: "Aksarben",
        agentName: "Mike Bjork",
      }
    ];

    // Filter based on search parameters
    let filtered = sampleProperties;

    if (params.address) {
      filtered = filtered.filter(p => 
        p.address.toLowerCase().includes(params.address!.toLowerCase())
      );
    }

    if (params.city) {
      filtered = filtered.filter(p => 
        p.city.toLowerCase().includes(params.city!.toLowerCase())
      );
    }

    if (params.mlsNumber) {
      filtered = filtered.filter(p => p.mlsId === params.mlsNumber);
    }

    if (params.listingAgent) {
      filtered = filtered.filter(p => 
        p.agentName?.toLowerCase().includes(params.listingAgent!.toLowerCase())
      );
    }

    if (params.neighborhood) {
      filtered = filtered.filter(p => 
        p.neighborhood?.toLowerCase().includes(params.neighborhood!.toLowerCase())
      );
    }

    return filtered;
  }

  private transformProperty(paragonProperty: ParagonProperty) {
    // Calculate total bathrooms from integer and decimal parts
    const totalBathrooms = paragonProperty.BathroomsTotalDecimal || paragonProperty.BathroomsTotalInteger || null;

    return {
      id: paragonProperty.ListingId,
      mlsId: paragonProperty.MLSNumber,
      listPrice: paragonProperty.ListPrice,
      address: paragonProperty.UnparsedAddress,
      city: paragonProperty.City,
      state: paragonProperty.StateOrProvince,
      zipCode: paragonProperty.PostalCode,
      bedrooms: paragonProperty.BedroomsTotal,
      bathrooms: totalBathrooms,
      squareFootage: paragonProperty.LivingArea,
      propertyType: paragonProperty.PropertyType,
      listingStatus: paragonProperty.StandardStatus,
      listingDate: paragonProperty.ListingContractDate || paragonProperty.APIModificationTimestamp,
      description: paragonProperty.PublicRemarks || '',
      features: [], // Could be parsed from PublicRemarks or other fields
      photoUrls: paragonProperty.Media?.map(m => m.MediaURL) || [],
      neighborhood: paragonProperty.Subdivision || null,
      agentName: paragonProperty.ListAgentFullName || null,
    };
  }
}
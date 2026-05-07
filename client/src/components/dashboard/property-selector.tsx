import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Home, MapPin, Bed, Bath, Square, DollarSign, Calendar, Eye, Loader2, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mapAddressLookupToProperty, mapSearchResultToProperty } from "@shared/mlsAddressMapping";

export interface Property {
  id: string;
  mlsId: string;
  /** null when the upstream MLS service did not provide a price.
   *  Renderers MUST treat this as "not provided" rather than a real $0. */
  listPrice: number | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string;
  listingStatus: string;
  listingDate: string;
  description: string;
  features: string[];
  photoUrls: string[];
  neighborhood: string | null;
  agentName: string | null;
}

interface PropertySelectorProps {
  onSelectProperty: (property: Property) => void;
  selectedProperty?: Property | null;
}

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyABw7DX0sg8fmhPt9H6JdlIGO-GikNgWhI";

export function PropertySelector({ onSelectProperty, selectedProperty }: PropertySelectorProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useState({
    city: "",
    state: "NE",
    neighborhood: "",
    propertyType: "",
    mlsNumber: "",
    address: "",
    listingAgent: "",
  });
  const [showDialog, setShowDialog] = useState(false);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [googleMapsStatus, setGoogleMapsStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [manualAddressMode, setManualAddressMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [searchMessage, setSearchMessage] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [autoFoundProperty, setAutoFoundProperty] = useState<Property | null>(null);
  // Beds/baths/sqft are already conditionally rendered based on truthy
  // values, so null naturally hides them. Only listPrice needs an
  // explicit "missing" flag to render the "Price not provided" copy.
  const [autoFoundMissingPrice, setAutoFoundMissingPrice] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps API with enhanced error handling
  useEffect(() => {
    const handleGoogleMapsError = () => {
      console.error('Google Maps failed to load');
      setGoogleMapsStatus('error');
      setGoogleMapsLoaded(false);
      setSearchMessage('Google Maps auto-fill unavailable. Using manual entry mode.');
    };

    // Check if already loaded
    if ((window as any).google?.maps?.places) {
      setGoogleMapsLoaded(true);
      setGoogleMapsStatus('ready');
      setSearchMessage('');
      return;
    }

    // Set up global callback
    (window as any).initGoogleMaps = () => {
      console.log('Google Maps loaded successfully');
      setGoogleMapsLoaded(true);
      setGoogleMapsStatus('ready');
      setSearchMessage('');
    };

    const loadGoogleMaps = () => {
      setGoogleMapsStatus('loading');
      setSearchMessage('Loading Google Maps for address auto-completion...');
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      script.onerror = handleGoogleMapsError;
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Function to fetch property details from GBCMA API
  const fetchPropertyDetails = async (address: string) => {
    if (!address || address.trim().length < 5) return;
    
    setIsSearchingAddress(true);
    setAutoFoundProperty(null); setAutoFoundMissingPrice(false);
    
    try {
      console.log('Fetching property details for address:', address);
      const response = await fetch('/api/property/details-by-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const propertyData = await response.json();
        console.log('GBCMA property details for address:', address, propertyData);
        
        // Auto-fill search parameters with GBCMA data
        if (propertyData && (propertyData.ListingKey || propertyData.UnparsedAddress)) {
          const mapped = mapAddressLookupToProperty(propertyData, address);
          // listPrice gets a dedicated flag so the card can render
          // "Price not provided". Beds/baths/sqft already render
          // conditionally on truthy values, so null naturally hides
          // them — no extra flag needed.
          setAutoFoundMissingPrice(mapped.listPrice === null);
          const foundProperty: Property = mapped;

          setSearchParams(prev => ({
            ...prev,
            // Use the LISTING's MLS number (not the agent's ID).
            mlsNumber: foundProperty.mlsId || prev.mlsNumber,
            listingAgent: propertyData.ListAgentFullName || propertyData.ListingAgent || propertyData.listingAgent || prev.listingAgent,
            city: propertyData.City || prev.city,
            neighborhood: propertyData.SubdivisionName || propertyData.Neighborhood || prev.neighborhood,
            address: propertyData.UnparsedAddress || prev.address
          }));

          setAutoFoundProperty(foundProperty);
          toast({
            title: "Property Found",
            description: `Found: ${foundProperty.address}`,
          });
        } else {
          toast({
            title: "No Match",
            description: "No property found for that address. Try a different search.",
            variant: "destructive",
          });
        }
      } else {
        console.log('No property details found for address:', address);
        toast({
          title: "Search Failed",
          description: "Could not find property. Check the address and try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
      toast({
        title: "Connection Error",
        description: "Unable to search. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const { data: properties, isLoading, refetch } = useQuery<Property[]>({
    queryKey: ["gbcma-property-search", searchParams],
    queryFn: async () => {
      const baseUrl = '/api/property/search';
      const params = new URLSearchParams();

      // MLS number search should return single property
      if (searchParams.mlsNumber && searchParams.mlsNumber.trim() !== '') {
        // Use GBCMA API directly for MLS number searches
        params.append('mls_number', searchParams.mlsNumber.trim());
      }

      if (searchParams.address && searchParams.address.trim() !== '') {
        params.append('address', searchParams.address.trim());
      }

      if (searchParams.listingAgent && searchParams.listingAgent.trim() !== '') {
        params.append('agent', searchParams.listingAgent.trim());
      }

      if (searchParams.city && searchParams.city.trim() !== '') {
        params.append('city', searchParams.city.trim());
      }

      // Only default to Omaha if no search criteria at all
      if (params.toString() === '') {
        params.append('city', 'Omaha');
      }

      const fullUrl = `${baseUrl}?${params.toString()}`;
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Property API error:', response.status, errorText);
        throw new Error(`Property API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform gbcma API response to our Property interface
      const properties = data.properties || [];
      
      // Use the shared sibling helper so missing numeric fields stay
      // null instead of silently collapsing to 0 (mirrors the
      // address-lookup branch fixed in task #48). The PropertyCard
      // renderer below relies on these nulls to show explicit
      // "— beds/baths/sqft" placeholders (task #49) rather than
      // misrepresenting missing MLS data as a real "0".
      return properties.map((prop: any) =>
        mapSearchResultToProperty({
          ...prop,
          mlsId: prop.mlsId ?? prop.id, // gbcma uses 'id' field for the listing
        }),
      );
    },
    enabled: false, // Only search when user clicks search button
    retry: false, // Don't auto-retry failed requests
  });

  const handleSearch = () => {
    // If we have an auto-found property, auto-select it and close modal
    if (autoFoundProperty) {
      console.log('Auto-selecting found property:', autoFoundProperty);
      onSelectProperty(autoFoundProperty);
      setShowDialog(false);
      toast({
        title: "Property Selected",
        description: autoFoundProperty.address,
      });
      return;
    }
    
    refetch();
  };

  // Clear all search fields
  const clearForm = () => {
    setSearchParams({
      city: "",
      state: "NE",
      neighborhood: "",
      propertyType: "",
      mlsNumber: "",
      address: "",
      listingAgent: "",
    });
    setAutoFoundProperty(null); setAutoFoundMissingPrice(false);
    setSearchMessage('');
  };

  // Helper functions for address handling
  const handleManualAddressOverride = () => {
    setManualAddressMode(true);
    setSearchMessage('Manual address entry mode enabled. Enter complete address manually.');
  };

  const resetToGoogleMode = () => {
    setManualAddressMode(false);
    if (googleMapsStatus === 'ready') {
      setSearchMessage('');
    }
  };

  const handleManualAddressSearch = async () => {
    if (!searchParams.address.trim()) return;
    
    setIsLoadingDetails(true);
    try {
      console.log('Manual address search for:', searchParams.address);
      const response = await fetch('/api/property/details-by-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: searchParams.address })
      });
      
      if (response.ok) {
        const propertyData = await response.json();
        console.log('Manual address search result:', propertyData);
        
        if (propertyData) {
          setSearchParams(prev => ({
            ...prev,
            mlsNumber: propertyData.mlsNumber || prev.mlsNumber,
            listingAgent: propertyData.listingAgent || prev.listingAgent
          }));
        }
      }
    } catch (error) {
      console.error('Manual address search error:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null || !Number.isFinite(price)) return 'Price upon request';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const PropertyCard = ({
    property,
    missingPrice,
  }: {
    property: Property;
    missingPrice?: boolean;
  }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
      onSelectProperty(property);
      setShowDialog(false);
    }}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Property Image */}
          <div className="w-24 h-24 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
            {property.photoUrls?.[0] ? (
              <img 
                src={property.photoUrls[0]} 
                alt={property.address}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Property Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm truncate">{property.address}</h3>
                <p className="text-xs text-muted-foreground">
                  {property.city}, {property.state} {property.zipCode}
                </p>
                {property.neighborhood && (
                  <Badge variant="outline" className="text-xs mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {property.neighborhood}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-primary" data-testid="text-property-price">
                  {missingPrice
                    ? <span className="text-muted-foreground font-normal">Price upon request</span>
                    : formatPrice(property.listPrice)}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {property.listingStatus}
                </Badge>
              </div>
            </div>

            {/* Property Features */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1" data-testid="text-property-beds">
                <Bed className="h-3 w-3" />
                {property.bedrooms === null
                  ? <span className="italic">— beds</span>
                  : `${property.bedrooms} bed${property.bedrooms !== 1 ? 's' : ''}`}
              </div>
              <div className="flex items-center gap-1" data-testid="text-property-baths">
                <Bath className="h-3 w-3" />
                {property.bathrooms === null
                  ? <span className="italic">— baths</span>
                  : `${property.bathrooms} bath${property.bathrooms !== 1 ? 's' : ''}`}
              </div>
              <div className="flex items-center gap-1" data-testid="text-property-sqft">
                <Square className="h-3 w-3" />
                {property.squareFootage === null
                  ? <span className="italic">— sqft</span>
                  : `${property.squareFootage.toLocaleString()} sqft`}
              </div>
            </div>

            {/* MLS ID and Agent */}
            <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
              <span>MLS# {property.mlsId}</span>
              {property.agentName && <span>Agent: {property.agentName}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {/* Selected Property Display */}
      {selectedProperty && (
        <Card className="mb-4 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">Selected Property</h4>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowDialog(true)}
                data-testid="button-change-property"
              >
                Change Property
              </Button>
            </div>
            <PropertyCard property={selectedProperty} />
          </CardContent>
        </Card>
      )}
      {/* Property Selector Button */}
      {!selectedProperty && (
        <Button 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
          data-testid="button-select-property"
          onClick={() => setShowDialog(true)}
        >
          <Home className="mr-2 h-4 w-4" />
          Select Property from MLS
        </Button>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-white dark:bg-gray-900 border-2 border-golden-accent/30 shadow-2xl overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Select Property from MLS</DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearForm}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-form"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </DialogHeader>

            {/* Search Filters */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">MLS#</label>
                  <Input
                    value={searchParams.mlsNumber}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, mlsNumber: e.target.value }))}
                    placeholder="Enter MLS number"
                    data-testid="input-mls-number"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Address
                      {isSearchingAddress && (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      )}
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      {isSearchingAddress ? (
                        <span className="text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Searching...
                        </span>
                      ) : autoFoundProperty ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Found
                        </span>
                      ) : (
                        <span className="text-gray-500 flex items-center gap-1">
                          Type address to search
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      ref={addressInputRef}
                      value={searchParams.address}
                      onChange={(e) => {
                        const newAddress = e.target.value;
                        setSearchParams(prev => ({ ...prev, address: newAddress }));
                        setAutoFoundProperty(null); setAutoFoundMissingPrice(false);
                        
                        // Clear existing search timeout
                        if (searchTimeoutRef.current) {
                          clearTimeout(searchTimeoutRef.current);
                        }
                        
                        // Only search after user stops typing for 1.5 seconds and has enough characters
                        if (newAddress && newAddress.trim().length > 5) {
                          searchTimeoutRef.current = setTimeout(() => {
                            fetchPropertyDetails(newAddress);
                          }, 1500);
                        }
                      }}
                      onKeyDown={(e) => {
                        // When user presses Enter, search immediately
                        if (e.key === 'Enter' && searchParams.address && searchParams.address.trim().length > 5) {
                          e.preventDefault();
                          if (searchTimeoutRef.current) {
                            clearTimeout(searchTimeoutRef.current);
                          }
                          fetchPropertyDetails(searchParams.address);
                        }
                      }}
                      placeholder="Type address and press Enter (e.g. 19863 cottonwood)"
                      data-testid="input-address"
                      disabled={isSearchingAddress}
                      className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        autoFoundProperty ? 'border-green-500 ring-1 ring-green-500/20' : 'border-input'
                      }`}
                    />
                    {searchParams.address && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchParams(prev => ({ ...prev, address: '' }));
                          setAutoFoundProperty(null); setAutoFoundMissingPrice(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        data-testid="button-clear-address"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {autoFoundProperty && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Found: {autoFoundProperty.address} - Click "Select Property" below
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={searchParams.city}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Neighborhood</label>
                  <Input
                    value={searchParams.neighborhood}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, neighborhood: e.target.value }))}
                    placeholder="Enter neighborhood"
                    data-testid="input-neighborhood"
                  />
                </div>
                
              </div>

              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Listing Agent</label>
                  <Input
                    value={searchParams.listingAgent}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, listingAgent: e.target.value }))}
                    placeholder="Enter agent name"
                    data-testid="input-listing-agent"
                  />
                </div>
              </div>

              <div className="flex justify-center gap-3">
                {autoFoundProperty ? (
                  <Button 
                    onClick={handleSearch} 
                    disabled={isLoading || isSearchingAddress}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-select-found-property"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Select This Property
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSearch} 
                    disabled={isLoading || isSearchingAddress} 
                    data-testid="button-search-properties"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Properties
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-primary rounded-full" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Loading properties...</p>
                </div>
              )}

              {/* Show auto-found property if available */}
              {autoFoundProperty && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-green-600">✓ Found Property from Address</h3>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Auto-detected</span>
                  </div>
                  <div className="space-y-3">
                    <PropertyCard key={autoFoundProperty.id} property={autoFoundProperty} missingPrice={autoFoundMissingPrice} />
                  </div>
                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    Click "Search Properties" to select this property automatically
                  </div>
                </div>
              )}

              {!autoFoundProperty && properties && properties.length === 0 && (
                <div className="text-center py-8">
                  <Home className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No Properties Found</h3>
                  <p className="text-muted-foreground">Try adjusting your search criteria</p>
                </div>
              )}

              {!autoFoundProperty && properties && properties.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Found {properties.length} Properties</h3>
                  </div>
                  <div className="space-y-3">
                    {properties.map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Search,
  Home,
  MapPin,
  Bed,
  Bath,
  Square,
  DollarSign,
  Calendar,
  Eye,
} from "lucide-react";

interface Property {
  id: string;
  mlsId: string;
  listPrice: number;
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

export function PropertySelector({
  onSelectProperty,
  selectedProperty,
}: PropertySelectorProps) {
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
  const [googleMapsStatus, setGoogleMapsStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [manualAddressMode, setManualAddressMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [searchMessage, setSearchMessage] = useState("");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [autoFoundProperty, setAutoFoundProperty] = useState<Property | null>(
    null
  );
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load Google Maps API with enhanced error handling
  useEffect(() => {
    const handleGoogleMapsError = () => {
      console.error("Google Maps failed to load");
      setGoogleMapsStatus("error");
      setGoogleMapsLoaded(false);
      setSearchMessage(
        "Google Maps auto-fill unavailable. Using manual entry mode."
      );
    };

    // Check if already loaded
    if ((window as any).google?.maps?.places) {
      setGoogleMapsLoaded(true);
      setGoogleMapsStatus("ready");
      setSearchMessage("");
      return;
    }

    // Set up global callback
    (window as any).initGoogleMaps = () => {
      console.log("Google Maps loaded successfully");
      setGoogleMapsLoaded(true);
      setGoogleMapsStatus("ready");
      setSearchMessage("");
    };

    const loadGoogleMaps = () => {
      setGoogleMapsStatus("loading");
      setSearchMessage("Loading Google Maps for address auto-completion...");

      const script = document.createElement("script");
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
    try {
      console.log("Fetching property details for address:", address);
      const response = await fetch("/api/property/details-by-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      if (response.ok) {
        const propertyData = await response.json();
        console.log(
          "GBCMA property details for address:",
          address,
          propertyData
        );

        // Auto-fill search parameters with GBCMA data
        if (propertyData) {
          setSearchParams((prev) => ({
            ...prev,
            mlsNumber:
              propertyData.ListAgentMlsId ||
              propertyData.mlsNumber ||
              prev.mlsNumber,
            listingAgent:
              propertyData.ListAgentFullName ||
              propertyData.ListingAgent ||
              propertyData.listingAgent ||
              prev.listingAgent,
            city: propertyData.City || prev.city,
            neighborhood:
              propertyData.SubdivisionName ||
              propertyData.Neighborhood ||
              prev.neighborhood,
            // Also update the address to the complete formatted address if available
            address: propertyData.UnparsedAddress || prev.address,
          }));
          console.log("Form auto-filled with:", {
            mlsNumber: propertyData.ListAgentMlsId,
            listingAgent: propertyData.ListAgentFullName,
            city: propertyData.City,
            neighborhood: propertyData.SubdivisionName,
            address: propertyData.UnparsedAddress,
          });

          // Create a property object for auto-selection
          const foundProperty: Property = {
            id: propertyData.ListingKey || "auto-found",
            mlsId: propertyData.ListAgentMlsId || "",
            address: propertyData.UnparsedAddress || address,
            city: propertyData.City || "",
            state: "NE",
            zipCode: propertyData.PostalCode || "",
            listPrice: Number(propertyData.ListPrice) || 0,
            bedrooms: Number(propertyData.BedroomsTotal) || 0,
            bathrooms: Number(propertyData.BathroomsTotal) || 0,
            squareFootage: Number(propertyData.LivingArea) || 0,
            propertyType: "Residential",
            listingStatus: propertyData.MlsStatus || "",
            listingDate: propertyData.OnMarketDate || new Date().toISOString(),
            description: propertyData.PublicRemarks || "",
            features: [],
            photoUrls:
              propertyData.Media?.slice(0, 3)?.map((m: any) => m.MediaURL) ||
              [],
            neighborhood: propertyData.SubdivisionName || null,
            agentName: propertyData.ListAgentFullName || null,
          };
          setAutoFoundProperty(foundProperty);
        }
      } else {
        console.log("No property details found for address:", address);
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
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

  const {
    data: properties,
    isLoading,
    refetch,
  } = useQuery<Property[]>({
    queryKey: ["gbcma-property-search", searchParams],
    queryFn: async () => {
      const baseUrl = "/api/property/search";
      const params = new URLSearchParams();

      // MLS number search should return single property
      if (searchParams.mlsNumber && searchParams.mlsNumber.trim() !== "") {
        // Use GBCMA API directly for MLS number searches
        params.append("mls_number", searchParams.mlsNumber.trim());
      }

      if (searchParams.address && searchParams.address.trim() !== "") {
        params.append("address", searchParams.address.trim());
      }

      if (
        searchParams.listingAgent &&
        searchParams.listingAgent.trim() !== ""
      ) {
        params.append("agent", searchParams.listingAgent.trim());
      }

      if (searchParams.city && searchParams.city.trim() !== "") {
        params.append("city", searchParams.city.trim());
      }

      // Only default to Omaha if no search criteria at all
      if (params.toString() === "") {
        params.append("city", "Omaha");
      }

      const fullUrl = `${baseUrl}?${params.toString()}`;

      const response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Property API error:", response.status, errorText);
        throw new Error(
          `Property API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Transform gbcma API response to our Property interface
      const properties = data.properties || [];

      return properties.map((prop: any) => ({
        id: prop.id || Math.random().toString(),
        mlsId: prop.id || "", // gbcma uses 'id' field
        listPrice: prop.listPrice || 0,
        address: prop.address || "",
        city: prop.city || "",
        state: prop.state || "NE",
        zipCode: prop.zipCode || "",
        bedrooms: prop.beds || 0,
        bathrooms: prop.baths || 0,
        squareFootage: prop.sqft || 0,
        propertyType: prop.propertyType || "",
        listingStatus: prop.status || "Active",
        listingDate: prop.onMarketDate || "",
        description: "",
        features: prop.condition || [],
        photoUrls: prop.imageUrl ? [prop.imageUrl] : [],
        neighborhood: prop.subdivision || null,
        agentName: null,
      }));
    },
    enabled: false, // Only search when user clicks search button
    retry: false, // Don't auto-retry failed requests
  });

  const handleSearch = () => {
    // If we have an auto-found property, auto-select it and close modal
    if (autoFoundProperty) {
      console.log("Auto-selecting found property:", autoFoundProperty);
      onSelectProperty(autoFoundProperty);
      setShowDialog(false);
      return;
    }

    refetch();
  };

  // Helper functions for address handling
  const handleManualAddressOverride = () => {
    setManualAddressMode(true);
    setSearchMessage(
      "Manual address entry mode enabled. Enter complete address manually."
    );
  };

  const resetToGoogleMode = () => {
    setManualAddressMode(false);
    if (googleMapsStatus === "ready") {
      setSearchMessage("");
    }
  };

  const handleManualAddressSearch = async () => {
    if (!searchParams.address.trim()) return;

    setIsLoadingDetails(true);
    try {
      console.log("Manual address search for:", searchParams.address);
      const response = await fetch("/api/property/details-by-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: searchParams.address }),
      });

      if (response.ok) {
        const propertyData = await response.json();
        console.log("Manual address search result:", propertyData);

        if (propertyData) {
          setSearchParams((prev) => ({
            ...prev,
            mlsNumber: propertyData.mlsNumber || prev.mlsNumber,
            listingAgent: propertyData.listingAgent || prev.listingAgent,
          }));
        }
      }
    } catch (error) {
      console.error("Manual address search error:", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const PropertyCard = ({ property }: { property: Property }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        onSelectProperty(property);
        setShowDialog(false);
      }}
    >
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
                <h3 className="font-semibold text-sm truncate">
                  {property.address}
                </h3>
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
                <p className="font-bold text-primary">
                  {formatPrice(property.listPrice)}
                </p>
                <Badge variant="secondary" className="text-xs">
                  {property.listingStatus}
                </Badge>
              </div>
            </div>

            {/* Property Features */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {property.bedrooms && (
                <div className="flex items-center gap-1">
                  <Bed className="h-3 w-3" />
                  {property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""}
                </div>
              )}
              {property.bathrooms && (
                <div className="flex items-center gap-1">
                  <Bath className="h-3 w-3" />
                  {property.bathrooms} bath{property.bathrooms !== 1 ? "s" : ""}
                </div>
              )}
              {property.squareFootage && (
                <div className="flex items-center gap-1">
                  <Square className="h-3 w-3" />
                  {property.squareFootage.toLocaleString()} sqft
                </div>
              )}
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
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-select-property"
            >
              <Home className="mr-2 h-4 w-4" />
              Select Property from MLS
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] bg-white dark:bg-gray-900 border-2 border-golden-accent/30 shadow-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Property from MLS</DialogTitle>
            </DialogHeader>

            {/* Search Filters */}
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">MLS#</label>
                  <Input
                    value={searchParams.mlsNumber}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        mlsNumber: e.target.value,
                      }))
                    }
                    placeholder="Enter MLS number"
                    data-testid="input-mls-number"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Address</label>
                    <div className="flex items-center gap-2 text-xs">
                      {googleMapsStatus === "loading" && (
                        <span className="text-blue-600 flex items-center gap-1">
                          <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          Loading...
                        </span>
                      )}
                      <span className="text-green-600 flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                        Auto-search Ready
                      </span>
                      {googleMapsStatus === "error" && (
                        <span className="text-red-600 flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                          Error
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setManualAddressMode(!manualAddressMode)}
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        {manualAddressMode
                          ? "Use Autocomplete"
                          : "Manual Entry"}
                      </button>
                    </div>
                  </div>
                  <input
                    ref={addressInputRef}
                    value={searchParams.address}
                    onChange={(e) => {
                      const newAddress = e.target.value;
                      setSearchParams((prev) => ({
                        ...prev,
                        address: newAddress,
                      }));
                      console.log("Address input changed:", newAddress);

                      // Clear existing search timeout
                      if (searchTimeoutRef.current) {
                        clearTimeout(searchTimeoutRef.current);
                      }

                      // Only search after user stops typing for 2 seconds and has enough characters
                      if (newAddress && newAddress.trim().length > 8) {
                        searchTimeoutRef.current = setTimeout(() => {
                          console.log(
                            "Auto-searching after typing stopped:",
                            newAddress
                          );
                          fetchPropertyDetails(newAddress);
                        }, 2000);
                      }
                    }}
                    onFocus={() => console.log("Address input focused")}
                    onBlur={() => {
                      // When user finishes typing and clicks away, search for property details
                      if (
                        searchParams.address &&
                        searchParams.address.trim().length > 5
                      ) {
                        console.log(
                          "Address input blur - searching for property details:",
                          searchParams.address
                        );
                        fetchPropertyDetails(searchParams.address);
                      }
                    }}
                    onKeyDown={(e) => {
                      // When user presses Enter, search for property details
                      if (
                        e.key === "Enter" &&
                        searchParams.address &&
                        searchParams.address.trim().length > 5
                      ) {
                        console.log(
                          "Enter pressed - searching for property details:",
                          searchParams.address
                        );
                        fetchPropertyDetails(searchParams.address);
                      }
                    }}
                    placeholder="Type address (e.g. 19863 cottonwood) - auto-search after 2 seconds or press Enter"
                    data-testid="input-address"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    value={searchParams.city}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Enter city"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Neighborhood</label>
                  <Input
                    value={searchParams.neighborhood}
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        neighborhood: e.target.value,
                      }))
                    }
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
                    onChange={(e) =>
                      setSearchParams((prev) => ({
                        ...prev,
                        listingAgent: e.target.value,
                      }))
                    }
                    placeholder="Enter agent name"
                    data-testid="input-listing-agent"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleSearch}
                  disabled={isLoading}
                  data-testid="button-search-properties"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {isLoading ? "Searching..." : "Search Properties"}
                </Button>
              </div>
            </div>

            {/* Search Results */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="text-center py-8">
                  <div
                    className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-primary rounded-full"
                    role="status"
                  >
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Loading properties...
                  </p>
                </div>
              )}

              {/* Show auto-found property if available */}
              {autoFoundProperty && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-green-600">
                      ✓ Found Property from Address
                    </h3>
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      Auto-detected
                    </span>
                  </div>
                  <div className="space-y-3">
                    <PropertyCard
                      key={autoFoundProperty.id}
                      property={autoFoundProperty}
                    />
                  </div>
                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    Click "Search Properties" to select this property
                    automatically
                  </div>
                </div>
              )}

              {!autoFoundProperty && properties && properties.length === 0 && (
                <div className="text-center py-8">
                  <Home className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No Properties Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search criteria
                  </p>
                </div>
              )}

              {!autoFoundProperty && properties && properties.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">
                      Found {properties.length} Properties
                    </h3>
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
      )}
    </div>
  );
}

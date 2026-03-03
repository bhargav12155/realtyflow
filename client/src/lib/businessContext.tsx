import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type BusinessType =
  | "real_estate"
  | "restaurant"
  | "home_services"
  | "retail"
  | "professional_services"
  | "general";

export interface BusinessTerminology {
  item: string;
  items: string;
  itemCapitalized: string;
  itemsCapitalized: string;
  catalog: string;
  addItem: string;
  editItem: string;
  searchItem: string;
  role: string;
  handle: string;
  topicPlaceholder: string;
  contentTypes: string[];
  dashboardTitle: string;
  dashboardSubtitle: string;
  catalogPage: string;
  catalogDescription: string;
  featureLabel: string;
  features: {
    mlsSearch: boolean;
    propertyTours: boolean;
    aiContentGenerator: boolean;
    complianceCheck: boolean;
    neighborhoodFocus: boolean;
    dietaryTags: boolean;
    ingredients: boolean;
  };
}

const TERMINOLOGY: Record<BusinessType, BusinessTerminology> = {
  real_estate: {
    item: "property",
    items: "properties",
    itemCapitalized: "Property",
    itemsCapitalized: "Properties",
    catalog: "Listings",
    addItem: "Add New Property",
    editItem: "Edit Property",
    searchItem: "Search properties...",
    role: "Real Estate Agent",
    handle: "@our_realestate",
    topicPlaceholder: "New listings, open house events, market updates...",
    contentTypes: ["Property Feature", "Market Update", "Neighborhood Spotlight", "Agent Introduction", "Blog Post"],
    dashboardTitle: "AI SEO & Social Media Dashboard",
    dashboardSubtitle: "Automated content generation for real estate marketing",
    catalogPage: "Property Listings",
    catalogDescription: "Manage your property listings and generate AI content for each one",
    featureLabel: "Property Feature",
    features: {
      mlsSearch: true,
      propertyTours: true,
      aiContentGenerator: true,
      complianceCheck: true,
      neighborhoodFocus: true,
      dietaryTags: false,
      ingredients: false,
    },
  },
  restaurant: {
    item: "menu item",
    items: "menu items",
    itemCapitalized: "Menu Item",
    itemsCapitalized: "Menu Items",
    catalog: "Our Menu",
    addItem: "Add New Menu Item",
    editItem: "Edit Menu Item",
    searchItem: "Search menu items...",
    role: "Restaurant Professional",
    handle: "@our_restaurant",
    topicPlaceholder: "Daily specials, new dishes, seasonal menu, weekend brunch...",
    contentTypes: ["Menu Item Feature", "Daily Special", "Seasonal Promotion", "Customer Story", "Blog Post"],
    dashboardTitle: "AI Marketing Dashboard",
    dashboardSubtitle: "Automated content generation for restaurant marketing",
    catalogPage: "Menu & Catalog",
    catalogDescription: "Manage your menu items and generate AI content for each dish",
    featureLabel: "Menu Item Feature",
    features: {
      mlsSearch: false,
      propertyTours: false,
      aiContentGenerator: true,
      complianceCheck: false,
      neighborhoodFocus: false,
      dietaryTags: true,
      ingredients: true,
    },
  },
  home_services: {
    item: "service",
    items: "services",
    itemCapitalized: "Service",
    itemsCapitalized: "Services",
    catalog: "Services",
    addItem: "Add New Service",
    editItem: "Edit Service",
    searchItem: "Search services...",
    role: "Home Services Professional",
    handle: "@our_services",
    topicPlaceholder: "Emergency services, seasonal maintenance, new service offerings...",
    contentTypes: ["Service Feature", "Seasonal Offer", "Customer Testimonial", "How-To Guide", "Blog Post"],
    dashboardTitle: "AI Marketing Dashboard",
    dashboardSubtitle: "Automated content generation for home services marketing",
    catalogPage: "Services Catalog",
    catalogDescription: "Manage your services and generate AI content for each offering",
    featureLabel: "Service Feature",
    features: {
      mlsSearch: false,
      propertyTours: false,
      aiContentGenerator: true,
      complianceCheck: false,
      neighborhoodFocus: false,
      dietaryTags: false,
      ingredients: false,
    },
  },
  retail: {
    item: "product",
    items: "products",
    itemCapitalized: "Product",
    itemsCapitalized: "Products",
    catalog: "Catalog",
    addItem: "Add New Product",
    editItem: "Edit Product",
    searchItem: "Search products...",
    role: "Retail Professional",
    handle: "@our_retail",
    topicPlaceholder: "New arrivals, sales, seasonal collections, featured products...",
    contentTypes: ["Product Feature", "Sale Announcement", "New Arrival", "Customer Review", "Blog Post"],
    dashboardTitle: "AI Marketing Dashboard",
    dashboardSubtitle: "Automated content generation for retail marketing",
    catalogPage: "Product Catalog",
    catalogDescription: "Manage your products and generate AI content for each item",
    featureLabel: "Product Feature",
    features: {
      mlsSearch: false,
      propertyTours: false,
      aiContentGenerator: true,
      complianceCheck: false,
      neighborhoodFocus: false,
      dietaryTags: false,
      ingredients: false,
    },
  },
  professional_services: {
    item: "service",
    items: "services",
    itemCapitalized: "Service",
    itemsCapitalized: "Services",
    catalog: "Services",
    addItem: "Add New Service",
    editItem: "Edit Service",
    searchItem: "Search services...",
    role: "Professional",
    handle: "@our_practice",
    topicPlaceholder: "Client success stories, industry insights, new offerings...",
    contentTypes: ["Service Feature", "Case Study", "Industry Insight", "Client Success Story", "Blog Post"],
    dashboardTitle: "AI Marketing Dashboard",
    dashboardSubtitle: "Automated content generation for professional services marketing",
    catalogPage: "Services Catalog",
    catalogDescription: "Manage your services and generate AI content for each offering",
    featureLabel: "Service Feature",
    features: {
      mlsSearch: false,
      propertyTours: false,
      aiContentGenerator: true,
      complianceCheck: false,
      neighborhoodFocus: false,
      dietaryTags: false,
      ingredients: false,
    },
  },
  general: {
    item: "item",
    items: "items",
    itemCapitalized: "Item",
    itemsCapitalized: "Items",
    catalog: "Catalog",
    addItem: "Add New Item",
    editItem: "Edit Item",
    searchItem: "Search items...",
    role: "Business Professional",
    handle: "@our_business",
    topicPlaceholder: "Promotions, updates, announcements, featured items...",
    contentTypes: ["Feature Post", "Announcement", "Promotion", "Customer Story", "Blog Post"],
    dashboardTitle: "AI Marketing Dashboard",
    dashboardSubtitle: "Automated content generation for business marketing",
    catalogPage: "Business Catalog",
    catalogDescription: "Manage your items and generate AI content for each one",
    featureLabel: "Feature Post",
    features: {
      mlsSearch: false,
      propertyTours: false,
      aiContentGenerator: true,
      complianceCheck: false,
      neighborhoodFocus: false,
      dietaryTags: false,
      ingredients: false,
    },
  },
};

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; icon: string }[] = [
  { value: "real_estate", label: "Real Estate", icon: "🏠" },
  { value: "restaurant", label: "Restaurant", icon: "🍽️" },
  { value: "home_services", label: "Home Services", icon: "🔧" },
  { value: "retail", label: "Retail", icon: "🛍️" },
  { value: "professional_services", label: "Professional Services", icon: "💼" },
  { value: "general", label: "General Business", icon: "🏢" },
];

interface BusinessContextValue {
  businessType: BusinessType;
  setBusinessType: (type: BusinessType) => void;
  terms: BusinessTerminology;
  isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextValue>({
  businessType: "real_estate",
  setBusinessType: () => {},
  terms: TERMINOLOGY.real_estate,
  isLoading: false,
});

export function BusinessTypeProvider({ children }: { children: ReactNode }) {
  const [businessType, setBusinessTypeState] = useState<BusinessType>("real_estate");
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/company/profile"],
  });

  useEffect(() => {
    if (profile?.businessType) {
      const stored = profile.businessType as BusinessType;
      if (TERMINOLOGY[stored]) {
        setBusinessTypeState(stored);
      }
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async (type: BusinessType) => {
      return apiRequest("POST", "/api/company/profile", { businessType: type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/profile"] });
    },
  });

  const setBusinessType = (type: BusinessType) => {
    setBusinessTypeState(type);
    mutation.mutate(type);
  };

  return (
    <BusinessContext.Provider
      value={{
        businessType,
        setBusinessType,
        terms: TERMINOLOGY[businessType] || TERMINOLOGY.real_estate,
        isLoading,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessType() {
  return useContext(BusinessContext);
}

export function getTerminology(businessType: BusinessType): BusinessTerminology {
  return TERMINOLOGY[businessType] || TERMINOLOGY.real_estate;
}

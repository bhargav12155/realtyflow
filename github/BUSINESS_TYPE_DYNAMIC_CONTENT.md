# Business Type Dynamic Content Documentation

This document details all hardcoded restaurant-specific content that has been made dynamic to support multiple business types (Restaurant, Home Services, Real Estate, Retail, Professional Services).

## Overview

The application now dynamically adapts all UI labels, placeholders, terminology, and content based on the selected business type and subtype in Settings.

---

## 1. Core Terminology System

### File: `client/src/lib/businessTerminology.ts`

**Purpose**: Central mapping system for business-specific UI terminology

| Component | Restaurant | Home Services (Plumbing) | Home Services (HVAC) | Real Estate | Retail |
|-----------|-----------|-------------------------|---------------------|------------|--------|
| **Item (singular)** | menu item | service | service | property | product |
| **Items (plural)** | menu items | services | services | properties | products |
| **Catalog** | Our Menu | Services | Services | Listings | Catalog |
| **Professional Role** | Restaurant Professional | Plumbing Professional | HVAC Professional | Real Estate Professional | Retail Professional |
| **Business Handle** | @our_restaurant | @our_plumbing | @our_hvac | @our_realestate | @our_retail |

**Changes Made**:
- ✅ Created centralized terminology mapping
- ✅ Exported `getBusinessTerminology()` function
- ✅ Returns dynamic labels based on business type

---

## 2. Dashboard Components

### A. Menu Item Selector (`menu-item-selector.tsx`)

| Element | Hardcoded (Restaurant) | Dynamic for Plumbing | Dynamic for Real Estate |
|---------|----------------------|---------------------|------------------------|
| **Dialog Title** | "Add New Menu Item" | "Add New Service" | "Add New Property" |
| **Search Placeholder** | "Search menu items" | "Search services" | "Search properties" |
| **Name Placeholder** | "e.g., Margherita Pizza" | "e.g., Emergency Drain Cleaning" | "e.g., 3BR Luxury Condo" |
| **Description Placeholder** | "Fresh mozzarella, tomato sauce, basil..." | "Professional service with certified technicians..." | "Modern finishes, updated kitchen, prime location..." |
| **Field Label** | "Ingredients" | "Components" | "Components" |
| **Ingredients Placeholder** | "Mozzarella, tomato sauce, fresh basil..." | "Tools, materials, equipment required..." | "Appliances, fixtures, features included..." |
| **Tags Placeholder** | "bestseller, house-special, new..." | "popular, emergency, certified..." | "featured, new-listing, reduced..." |
| **Category Name Placeholder** | "e.g., Pizza, Pasta, Desserts" | "e.g., Plumbing, HVAC, Electrical" | "e.g., Residential, Commercial, Land" |
| **Category Desc Placeholder** | "Traditional Italian pizzas..." | "Professional services for your needs..." | "Properties in this category..." |
| **Empty State** | "No menu items found" | "No services found" | "No properties found" |
| **Select Button** | "Select a menu item" | "Select a service" | "Select a property" |

**Changes Made**:
- ✅ Import `useBusinessType()` and `getBusinessTerminology()`
- ✅ All dialog titles use `terms.addItem` / `terms.editItem`
- ✅ Search placeholders use `terms.searchItem`
- ✅ All static labels replaced with dynamic terminology
- ✅ Form placeholders adapt based on business type

---

### B. AI Content Generator (`ai-content-generator.tsx`)

| Element | Hardcoded (Restaurant) | Dynamic for Plumbing | Dynamic for Real Estate |
|---------|----------------------|---------------------|------------------------|
| **Content Types** | "Menu Item Feature" | "Service Feature" | "Property Feature" |
| **Topic Placeholder** | "Seasonal specials, Brunch menu highlights" | "Emergency services, Drain cleaning" | "New listings, Open house events" |
| **Item Selection** | "Select a menu item" | "Select a service" | "Select a property" |
| **Search Placeholder** | "Search menu items..." | "Search services..." | "Search properties..." |

**Changes Made**:
- ✅ Dynamic `contentTypes` array rebuilt on business type change
- ✅ Uses `${terms.itemCapitalized} Feature` format
- ✅ Topic placeholder adapts to business context
- ✅ All item references use business terminology

---

### C. Video Templates (`video-templates.tsx`)

| Element | Hardcoded | Dynamic | Example Values |
|---------|-----------|---------|---------------|
| **Business Badge** | None | Shows business type | "Plumbing", "Restaurant", "Real Estate" |
| **Description** | "Restaurant templates" | "{businessTypeLabel} templates" | "Home Services templates" |

**Changes Made**:
- ✅ Added business type badge to header
- ✅ Description adapts to business context
- ✅ Template personalization via `personalizeText()` function

---

### D. Template Manager (`template-manager.tsx`)

| Element | Hardcoded | Dynamic | Notes |
|---------|-----------|---------|-------|
| **Tab Label** | "Restaurant" | Business label | Shows selected business type |
| **Tab Description** | "Restaurant templates" | "{businessTypeLabel} industry-specific templates" | Contextual description |

**Changes Made**:
- ✅ Tab title shows current business type
- ✅ Tab description includes business context
- ✅ Template filtering by business type

---

### E. Avatar Studio (`avatar-studio.tsx`)

| Element | Hardcoded (Restaurant) | Dynamic for Plumbing | Dynamic for HVAC |
|---------|----------------------|---------------------|-----------------|
| **Custom Instructions Placeholder** | "Focus on our signature dishes, mention our 20 years of culinary experience..." | "Highlight our certified technicians, mention our 24/7 emergency services..." | "Highlight our certified technicians, mention our energy-efficient solutions..." |

**Changes Made**:
- ✅ Import `useBusinessType()` hook
- ✅ Custom prompt placeholder adapts to business type
- ✅ Subtype-specific examples (plumbing shows emergency services, HVAC shows energy efficiency)

---

### F. Photo Avatar Manager (`photo-avatar-manager.tsx`)

| Element | Restaurant | Home Services | Real Estate | Professional Services |
|---------|-----------|---------------|-------------|----------------------|
| **Avatar Name** | "Professional Restaurant Avatar" | "Professional Service Expert Avatar" | "Professional Real Estate Avatar" | "Professional Consultant Avatar" |
| **Appearance Prompt** | "Professional restaurant owner/chef, well-groomed, confident smile, business attire" | "Professional home service technician, clean uniform, friendly smile, trustworthy demeanor" | "Professional real estate agent, business attire, confident smile, approachable demeanor" | "Professional consultant, business formal attire, confident smile, trustworthy demeanor" |

**Changes Made**:
- ✅ Import `useBusinessType()` hook
- ✅ `getDefaultPersona()` function returns business-specific avatar names and appearance prompts
- ✅ Supports all 6 business types with appropriate professional descriptions

---

### G. Image Picker (`image-picker.tsx`)

| Element | Hardcoded (Restaurant) | Dynamic for Plumbing | Dynamic for Real Estate |
|---------|----------------------|---------------------|------------------------|
| **Video Prompt Placeholder** | "Steaming pasta dish with fresh herbs being plated by a chef" | "Professional technician installing modern HVAC system" | "Luxury home exterior with landscaped yard at sunset" |
| **Stock Query Default** | "restaurant visuals" | "home services visuals" | "real estate visuals" |

**Changes Made**:
- ✅ Video description placeholder adapts to business
- ✅ Default stock query uses business type
- ✅ Updates automatically when business type changes

---

## 3. Dashboard Header

### File: `client/src/pages/dashboard.tsx`

| Element | Hardcoded | Dynamic | Example |
|---------|-----------|---------|---------|
| **Business Type Badge** | None | Shows current type | "Plumbing", "Restaurant" |
| **Subtitle** | "Automated content generation for restaurant marketing" | "Automated content generation for {businessType} marketing" | "...for home services marketing" |

**Changes Made**:
- ✅ Added badge showing business type next to dashboard title
- ✅ Badge displays subtype if selected (e.g., "Plumbing" instead of "Home Services")
- ✅ Subtitle dynamically includes business type

---

### H. Template Studio Page (`template-studio.tsx`)

| Element | Hardcoded | Dynamic |
|---------|-----------|---------|
| **Subtitle** | "Create professional restaurant marketing videos using pre-built templates" | "Create professional {businessTypeLabel} marketing videos using pre-built templates" |

**Changes Made**:
- ✅ Import `useBusinessType()` hook
- ✅ Subtitle dynamically uses `businessTypeLabel.toLowerCase()`

---

### I. SEO Optimizer (`seo-optimizer.tsx`)

| Element | Restaurant | Home Services | Real Estate |
|---------|-----------|---------------|-------------|
| **Keyword Generation Toast** | "Generated X optimized keywords for your restaurant business" | "Generated X optimized keywords for your home services business" | "Generated X optimized keywords for your real estate business" |
| **Business Type in API** | `businessType: 'restaurant'` | `businessType: 'home_services'` | `businessType: 'real_estate'` |
| **Weekly Tips - Video** | "best brunch spots in Dundee" | "best home service tips for your area" | "best neighborhoods in your market" |
| **Weekly Tips - Photos** | "food photos" | "project photos" | "property photos" |
| **Weekly Tips - Blog** | "Guide to dining in Aksarben" | "Home maintenance tips for the season" | "Guide to buying in your local market" |
| **Monthly Tips - Reviews** | "customers" | "clients" | "clients" |
| **Monthly Tips - Updates** | "menu items" | "service listings" | "property listings" |
| **Monthly Tips - Newsletter** | "customers" | "clients" | "clients" |

**Changes Made**:
- ✅ Import `useBusinessType()` hook
- ✅ Keyword generation uses dynamic `businessType` variable
- ✅ Toast message uses `businessTypeLabel.toLowerCase()`
- ✅ All recommendation tips adapt to business context

---

### J. AI Search Optimizer (`ai-search-optimizer.tsx`)

| Element | Restaurant | Home Services | Real Estate |
|---------|-----------|---------------|-------------|
| **Entity Label** | "Restaurant" | "Home Service Business" | "Real Estate Agency" |
| **Content Description** | "restaurants and food" | "home services and repairs" | "real estate and properties" |
| **Schema Recommendation** | "LocalBusiness, Restaurant, FAQPage" | "LocalBusiness, HomeAndConstructionBusiness, FAQPage" | "RealEstateAgent, LocalBusiness, FAQPage" |
| **Action - Entity** | "Include '[Your Restaurant Name], [Your Location]'" | "Include '[Your Home Service Business Name], [Your Location]'" | "Include '[Your Real Estate Agency Name], [Your Location]'" |
| **Market Data Tips** | "local dining trends, popular cuisines, customer preferences" | "industry trends, local market data, customer insights" | "recent sale prices, market trends, neighborhood statistics" |
| **Video Transcripts** | "video tours and menu features" | "all your video content" | "video tours and property features" |

**Changes Made**:
- ✅ Import `useBusinessType()` hook
- ✅ Converted static `aiSearchTips` array to `getAiSearchTips(businessType)` function
- ✅ 12 AI search tips now dynamically adapt based on business type
- ✅ Schema markup recommendations are industry-specific
- ✅ Entity optimization examples use business-specific terminology

---

## 4. Server-Side Changes

### File: `server/routes.ts`

| Function | Purpose | Restaurant Example | Plumbing Example |
|----------|---------|-------------------|------------------|
| `describeBusinessType()` | Map type to description | "restaurant" | "home services business (plumbing)" |
| `describeBusinessSubtype()` | Map subtype to description | "fine_dining" → "fine dining establishment" | "plumbing" → "plumbing company" |
| **Image Generation Prompts** | Add business context | "...for a restaurant" | "...for a home services business (plumbing)" |

**Changes Made**:
- ✅ Business context injected into all image generation prompts
- ✅ Helper functions map business types to natural descriptions
- ✅ Server-side labels match client-side terminology

---

## 5. Video Templates Content

### File: `client/src/components/dashboard/omaha-video-templates.tsx`

| Template | Hardcoded Script | Dynamic Replacement | Example Result |
|----------|-----------------|---------------------|---------------|
| **All Templates** | "Restaurant" | `personalizeText()` replaces with business type | "Home Services" |
| **Signature Dish** | "signature dish" | Could be "signature service" | Business-specific |
| **Kitchen Tour** | "kitchen" | Could be "work area" | Context-aware |

**Function**: `personalizeText(text: string, businessTypeLabel: string)`

**Changes Made**:
- ✅ Created personalization function
- ✅ Replaces "Restaurant" with actual business type
- ✅ Maintains template structure while adapting context

---

## 6. Complete Business Type Mapping Reference

### Restaurant & Food Service
```typescript
{
  item: "menu item",
  items: "menu items",
  catalog: "Our Menu",
  professionalRole: "Restaurant Professional",
  placeholders: {
    name: "e.g., Margherita Pizza",
    description: "Fresh mozzarella, tomato sauce, basil...",
    ingredients: "Mozzarella, tomato sauce, fresh basil...",
    tags: "bestseller, house-special, new...",
    topic: "Seasonal specials, Brunch menu highlights",
    videoPrompt: "Steaming pasta dish with fresh herbs being plated by a chef",
    customInstructions: "Focus on our signature dishes, mention our 20 years of culinary experience..."
  }
}
```

### Home Services - Plumbing
```typescript
{
  item: "service",
  items: "services",
  catalog: "Services",
  professionalRole: "Plumbing Professional",
  placeholders: {
    name: "e.g., Emergency Drain Cleaning",
    description: "Professional service with certified technicians...",
    components: "Tools, materials, equipment required...",
    tags: "popular, emergency, certified...",
    topic: "Emergency services, Drain cleaning",
    videoPrompt: "Professional technician installing modern plumbing system",
    customInstructions: "Highlight our certified technicians, mention our 24/7 emergency services..."
  }
}
```

### Home Services - HVAC
```typescript
{
  item: "service",
  items: "services",
  catalog: "Services",
  professionalRole: "HVAC Professional",
  placeholders: {
    name: "e.g., AC System Installation",
    description: "Professional service with certified technicians...",
    components: "Tools, materials, equipment required...",
    tags: "popular, emergency, certified...",
    topic: "AC maintenance, Heating repair",
    videoPrompt: "Professional technician installing modern HVAC system",
    customInstructions: "Highlight our certified technicians, mention our energy-efficient solutions..."
  }
}
```

### Real Estate
```typescript
{
  item: "property",
  items: "properties",
  catalog: "Listings",
  professionalRole: "Real Estate Professional",
  placeholders: {
    name: "e.g., 3BR Luxury Condo",
    description: "Modern finishes, updated kitchen, prime location...",
    components: "Appliances, fixtures, features included...",
    tags: "featured, new-listing, reduced...",
    topic: "New listings, Open house events",
    videoPrompt: "Luxury home exterior with landscaped yard at sunset",
    customInstructions: "Focus on prime locations, mention our market expertise..."
  }
}
```

### Retail
```typescript
{
  item: "product",
  items: "products",
  catalog: "Catalog",
  professionalRole: "Retail Professional",
  placeholders: {
    name: "e.g., Premium Product",
    description: "High-quality product with premium features...",
    components: "Key components and materials...",
    tags: "featured, bestseller, new...",
    topic: "New arrivals, Special promotions",
    videoPrompt: "Professional product showcase with modern lighting",
    customInstructions: "Focus on our key features, mention our experience..."
  }
}
```

---

## 7. Implementation Summary

### Files Modified (21 Total)

| # | File | Changes |
|---|------|---------|
| 1 | `client/src/lib/businessTerminology.ts` | **NEW** central terminology system |
| 2 | `client/src/components/dashboard/menu-item-selector.tsx` | Dynamic labels, placeholders, toast messages, "Chef's Pick" → "Expert Pick", "Food Categories" → dynamic |
| 3 | `client/src/components/dashboard/ai-content-generator.tsx` | Dynamic content types |
| 4 | `client/src/components/dashboard/video-templates.tsx` | Business type badge |
| 5 | `client/src/components/dashboard/template-manager.tsx` | Dynamic tab labels |
| 6 | `client/src/components/dashboard/omaha-video-templates.tsx` | Template personalization |
| 7 | `client/src/components/dashboard/avatar-studio.tsx` | Dynamic placeholders |
| 8 | `client/src/components/shared/image-picker.tsx` | Business-aware prompts, empty state text |
| 9 | `client/src/pages/dashboard.tsx` | Business type badge in header |
| 10 | `server/routes.ts` | Business context in image generation |
| 11 | `client/src/components/dashboard/video-generator.tsx` | Dynamic video types, hashtags |
| 12 | `client/src/components/dashboard/avatar-iv-studio.tsx` | Dynamic script styles |
| 13 | `client/src/components/dashboard/scheduled-posts-manager.tsx` | Business owner label |
| 14 | `client/src/components/dashboard/ai-assistant-dialog.tsx` | Dynamic item description |
| 15 | `client/src/components/dashboard/social-media-manager.tsx` | Dynamic labels, video titles |
| 16 | `client/src/pages/profile.tsx` | Business owner badge and label |
| 17 | `client/src/components/ProtectedRoute.tsx` | Business owner message |
| 18 | `client/src/pages/template-studio.tsx` | Dynamic subtitle "Create professional {businessType} marketing videos" |
| 19 | `client/src/components/dashboard/photo-avatar-manager.tsx` | Dynamic persona prompts and avatar names based on business type |
| 20 | `client/src/components/dashboard/seo-optimizer.tsx` | Dynamic SEO tips ("food photos" → "project/property photos"), business type in keyword generation |
| 21 | `client/src/components/dashboard/ai-search-optimizer.tsx` | Dynamic AI search tips, entity optimization descriptions, schema recommendations per business type |

### Integration Points
- **Settings**: User selects business type → Saved to database
- **Hook**: `useBusinessType()` provides business context throughout app
- **Helper**: `getBusinessTerminology()` returns appropriate labels
- **UI**: All components react to business type changes automatically
- **API**: Server includes business context in AI prompts

---

## 8. Additional Dynamic Elements

### Video Generator
| Element | Restaurant | Home Services | Real Estate |
|---------|-----------|---------------|-------------|
| Video Type 1 | Menu Feature | Service Feature | Property Feature |
| Video Type 2 | Restaurant Tour | Business Tour | Neighborhood Tour |
| Video Type 3 | Chef Spotlight | Team Spotlight | Agent Spotlight |
| Hashtag 1 | FoodLovers | HomeServices | RealEstate |
| Hashtag 2 | RestaurantLife | ProServices | PropertyTour |

### Avatar IV Studio Script Styles
| Style | Restaurant | Home Services | Real Estate |
|-------|-----------|---------------|-------------|
| Showcase | Menu Showcase | Service Showcase | Listing Showcase |
| Spotlight | Dish Spotlight | Project Spotlight | Property Spotlight |
| Update | Restaurant Update | Business Update | Market Update |
| Introduction | Chef Introduction | Team Introduction | Agent Introduction |

### Menu Item Selector Labels
| Element | Restaurant | Home Services | Real Estate | Default |
|---------|-----------|---------------|-------------|---------|
| **Recommended Label** | Chef's Pick | Expert Pick | Featured | Recommended |
| **Categories Header** | Food Categories | Service Categories | Property Categories | Categories |

### Photo Avatar Manager Personas
| Element | Restaurant | Home Services | Real Estate | Professional Services |
|---------|-----------|---------------|-------------|----------------------|
| **Avatar Name** | Professional Restaurant Avatar | Professional Service Expert Avatar | Professional Real Estate Avatar | Professional Consultant Avatar |
| **Demeanor** | business attire, confident smile | clean uniform, friendly smile, trustworthy | business attire, approachable | business formal, trustworthy |

---

## 9. Testing Checklist

### For Each Business Type:
- [ ] Change business type in Settings
- [ ] Verify dashboard header shows correct badge
- [ ] Open menu item selector → Check dialog title and placeholders
- [ ] Open menu item selector → Check "Chef's Pick" becomes "Expert Pick" (home services) or "Featured" (real estate)
- [ ] Open menu item selector → Check "Food Categories" becomes "Service Categories" or "Property Categories"
- [ ] Create AI content → Check topic placeholder and content types
- [ ] Open image picker → Check video prompt placeholder
- [ ] Open avatar studio → Check custom instructions placeholder
- [ ] Open photo avatar manager → Check avatar name and appearance prompts
- [ ] Open SEO optimizer → Check weekly/monthly tips adapt to business
- [ ] Open AI Search optimizer → Check tips are business-specific
- [ ] Generate video → Check template descriptions
- [ ] Generate image → Verify business context in prompt

### Expected Behavior:
✅ All labels update immediately after changing business type
✅ Placeholders reflect the selected industry
✅ Dialog titles use appropriate terminology
✅ Content types adapt to business context
✅ Image/video prompts include business-specific examples

---

## 9. Future Enhancements

### Potential Additions:
1. **Custom Terminology**: Allow users to override default labels
2. **Industry-Specific Templates**: More templates per business type
3. **Localization**: Multi-language support for terminology
4. **AI Suggestions**: Business-aware content recommendations
5. **Industry Best Practices**: Context-specific tips and guidance

---

## Notes

- The system maintains backward compatibility with existing restaurant data
- Default business type is "restaurant" if not set
- All changes are centralized through `businessTerminology.ts` for easy maintenance
- Server-side and client-side terminology stay synchronized
- The UI updates reactively when business type changes (no page refresh required)

---

**Last Updated**: January 23, 2026  
**Version**: 2.0 - Full Business Type Integration

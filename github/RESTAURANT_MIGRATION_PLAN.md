# Restaurant Application Migration Plan
## Adapting from Real Estate to Restaurant Business

---

## 🎯 **Executive Summary**

This application is currently built for **real estate agents** to manage property listings, neighborhoods, and market data. To adapt it for **restaurants**, we need to transform:
- Properties → Menu Items / Dishes
- Neighborhoods → Restaurant Locations / Delivery Areas  
- Agent/Listings → Restaurant Owner/Manager
- Market Data → Food Trends / Popular Items

---

## 📊 **Core Data Model Changes**

### **1. USERS & ROLES**
#### Current (Real Estate)
- `role: "agent"` - Real estate agent
- `agentSlug` - URL-friendly agent identifier

#### Proposed (Restaurant)
```typescript
role: "restaurant_owner" | "manager" | "staff"
restaurantSlug: string  // e.g., "joes-pizzeria"
```

---

### **2. PROPERTIES → MENU ITEMS**
#### Current Schema
```typescript
properties: {
  mlsId: string
  listPrice: number
  address: string
  bedrooms: number
  bathrooms: number
  squareFootage: number
  propertyType: string
  listingStatus: string
  neighborhood: string
  agentId: string
}
```

#### Proposed Schema
```typescript
menuItems: {
  id: string
  restaurantId: string
  name: string              // "Margherita Pizza"
  category: string          // "Pizza", "Pasta", "Appetizers"
  price: number
  description: text
  ingredients: string[]
  dietaryTags: string[]     // "vegetarian", "vegan", "gluten-free"
  allergens: string[]       // "dairy", "nuts", "shellfish"
  imageUrls: string[]
  availability: string      // "always", "seasonal", "limited"
  popularityScore: number   // 0-100
  preparationTime: number   // minutes
  calories: number
  spiceLevel: number        // 0-5
  isSpecial: boolean
  specialPrice: number
  status: string            // "active", "sold_out", "discontinued"
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

### **3. NEIGHBORHOODS → LOCATIONS**
#### Current
```typescript
neighborhood: string  // "Dundee", "Aksarben", "Old Market"
```

#### Proposed
```typescript
locations: {
  id: string
  restaurantId: string
  name: string              // "Downtown Location", "West Side Branch"
  address: string
  city: string
  state: string
  zipCode: string
  phoneNumber: string
  deliveryRadius: number    // miles
  operatingHours: jsonb     // {monday: "9am-10pm", tuesday: ...}
  cuisineTypes: string[]    // "Italian", "Pizza", "Pasta"
  diningOptions: string[]   // "dine-in", "takeout", "delivery"
  acceptsReservations: boolean
  latitude: number
  longitude: number
  status: string            // "open", "closed", "coming_soon"
}
```

---

### **4. MARKET DATA → FOOD TRENDS**
#### Current
```typescript
marketData: {
  neighborhood: string
  avgPrice: number
  daysOnMarket: number
  inventoryLevel: number
  priceGrowth: string
}
```

#### Proposed
```typescript
foodTrends: {
  id: string
  restaurantId: string
  period: string            // "daily", "weekly", "monthly"
  itemCategory: string      // "Pizza", "Pasta", etc.
  popularItems: jsonb       // [{name, orderCount, revenue}]
  avgOrderValue: number
  totalOrders: number
  peakHours: jsonb          // {hour: orderCount}
  customerDemographics: jsonb
  seasonalTrends: jsonb
  competitorPricing: jsonb
  createdAt: timestamp
}
```

---

### **5. CONTENT PIECES → PROMOTIONAL CONTENT**
#### Current Types
- `'property_feature'` - Showcase property
- `'blog'` - Real estate articles
- `'social'` - Social media posts

#### Proposed Types
```typescript
type: 
  | 'menu_highlight'        // Feature a dish
  | 'daily_special'         // Today's special
  | 'seasonal_menu'         // Seasonal offerings
  | 'chef_recommendation'   // Chef's picks
  | 'customer_favorite'     // Most popular items
  | 'new_item_launch'       // New menu addition
  | 'food_blog'             // Recipes, cooking tips
  | 'event_promotion'       // Catering, events
  | 'social_post'           // Quick social media content
```

---

### **6. SCHEDULED POSTS**
#### Current Post Types
```typescript
postType: 'open_houses' | 'just_listed' | 'just_sold' | 'market_update'
```

#### Proposed Post Types
```typescript
postType: 
  | 'daily_special'
  | 'lunch_deal'
  | 'happy_hour'
  | 'weekend_brunch'
  | 'new_menu_item'
  | 'seasonal_dish'
  | 'customer_review'
  | 'behind_scenes'
  | 'food_photo'
  | 'recipe_share'
  | 'event_announcement'
```

---

## 🎨 **UI Component Changes**

### **1. Property Selector → Menu Item Selector**
**File:** `client/src/components/dashboard/property-selector.tsx`

**Current Features:**
- Search by MLS number, address, city
- Display bedrooms, bathrooms, square footage
- Show listing price and agent

**New Features:**
```typescript
interface MenuItemSelectorProps {
  onSelectItem: (item: MenuItem) => void;
  selectedItem?: MenuItem | null;
}

// Search filters:
- Category (Pizza, Pasta, Salads, etc.)
- Dietary restrictions
- Price range
- Popularity
- Preparation time
- Spice level
- Current availability

// Display:
- Item name and description
- Price
- Image gallery
- Ingredients & allergens
- Nutritional info
- Customer ratings
```

---

### **2. AI Content Generator**
**File:** `client/src/components/dashboard/ai-content-generator.tsx`

**Current Focus:**
- Generate property descriptions
- Neighborhood highlights
- Market updates
- Buyer/seller tips

**New Focus:**
```typescript
// Content generation for:
1. Menu item descriptions
   - Mouth-watering descriptions
   - Ingredient highlights
   - Pairing suggestions

2. Daily specials
   - Limited-time offers
   - Chef's creations
   - Seasonal items

3. Food photography captions
   - Instagram-ready descriptions
   - Hashtag suggestions
   - Engagement hooks

4. Recipe snippets
   - Cooking tips
   - Behind-the-scenes
   - Chef stories

5. Promotional content
   - Event announcements
   - Catering services
   - Gift cards & loyalty programs
```

---

### **3. Local Market Tools → Food Insights Dashboard**
**File:** `client/src/components/dashboard/local-market-tools.tsx`

**Transform to:**
```typescript
<FoodInsightsDashboard>
  - Popular items trending
  - Peak dining hours
  - Average order values
  - Customer preferences
  - Seasonal demand patterns
  - Competition analysis
  - Menu performance metrics
</FoodInsightsDashboard>
```

---

## 🔧 **Backend API Changes**

### **New Routes Needed**

```typescript
// Menu Management
POST   /api/menu/items              // Create menu item
GET    /api/menu/items              // List all items
GET    /api/menu/items/:id          // Get specific item
PUT    /api/menu/items/:id          // Update item
DELETE /api/menu/items/:id          // Remove item
GET    /api/menu/categories         // Get all categories

// Food Trends & Analytics
GET    /api/analytics/popular-items       // Most ordered
GET    /api/analytics/revenue-by-category // Revenue breakdown
GET    /api/analytics/peak-hours         // Busiest times
GET    /api/analytics/customer-favorites // Top rated items

// Orders & Reservations (New Feature)
POST   /api/orders                   // Create order
GET    /api/orders                   // List orders
GET    /api/orders/:id               // Order details
POST   /api/reservations             // Make reservation
GET    /api/reservations             // List reservations

// Reviews & Ratings (New Feature)
POST   /api/reviews                  // Submit review
GET    /api/reviews/:itemId          // Get item reviews
GET    /api/reviews/featured         // Featured reviews
```

---

## 📝 **Content Type Adaptations**

### **Real Estate → Restaurant Content Mapping**

| Real Estate | Restaurant |
|------------|------------|
| Property Listing | Menu Item Feature |
| Neighborhood Guide | Location Guide / Area Delivery Info |
| Market Update | Food Trends & Popular Items |
| Open House Announcement | Special Event / Tasting Menu |
| Buyer Tips | Dining Tips / Ordering Guide |
| Seller Tips | Catering Services Info |
| Agent Introduction | Chef/Restaurant Story |
| Just Listed | New Menu Item Launch |
| Just Sold | Sold Out Item / Limited Edition |

---

## 🎯 **Implementation Options**

### **Option 1: Full Migration (Recommended)**
**Pros:**
- Clean slate, optimized for restaurant business
- Better user experience
- No real estate terminology confusion

**Cons:**
- Requires significant development time
- Need to migrate/adapt all components

**Estimated Time:** 2-3 weeks

---

### **Option 2: Dual-Purpose Application**
**Pros:**
- Supports both real estate AND restaurant clients
- Reuse existing infrastructure
- Faster to market

**Cons:**
- More complex codebase
- Need careful UX to avoid confusion
- Larger maintenance burden

**Estimated Time:** 1-2 weeks

---

### **Option 3: Phased Approach**
**Phase 1:** Core menu items & posting (1 week)
**Phase 2:** Analytics & insights (3-5 days)
**Phase 3:** Advanced features (orders, reservations) (1 week)

---

## 🚀 **Quick Start Implementation**

### **Step 1: Update Schema (Priority 1)**
```bash
# Add new tables for restaurants
npm run db:bootstrap-schema
```

Create migration:
```sql
-- Add menu_items table
CREATE TABLE "onrestuanrants"."menu_items" (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  ingredients TEXT[],
  dietary_tags TEXT[],
  allergens TEXT[],
  image_urls TEXT[],
  popularity_score INTEGER DEFAULT 0,
  preparation_time INTEGER,
  calories INTEGER,
  spice_level INTEGER DEFAULT 0,
  is_special BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add food_categories table
CREATE TABLE "onrestuanrants"."food_categories" (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Add restaurant_locations table
CREATE TABLE "onrestuanrants"."restaurant_locations" (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  phone_number TEXT,
  delivery_radius NUMERIC(5,2),
  operating_hours JSONB,
  cuisine_types TEXT[],
  dining_options TEXT[],
  accepts_reservations BOOLEAN DEFAULT true,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  status TEXT DEFAULT 'open'
);
```

---

### **Step 2: Update User Roles**
```typescript
// shared/schema.ts
role: text("role").notNull().default("restaurant_owner")
// Options: "restaurant_owner", "manager", "staff", "customer"
```

---

### **Step 3: Create Menu Item Selector Component**
```tsx
// client/src/components/dashboard/menu-item-selector.tsx
export function MenuItemSelector({ onSelectItem, selectedItem }) {
  // Categories dropdown
  // Search by name
  // Filter by dietary restrictions
  // Price range slider
  // Popularity sorting
  // Grid view with images
}
```

---

### **Step 4: Update Content Generator**
```typescript
// Update prompt templates in AI service
const restaurantPrompts = {
  menu_highlight: `Create an appetizing description for {itemName}...`,
  daily_special: `Generate excitement for today's special: {itemName}...`,
  social_post: `Create Instagram-worthy caption for {itemName}...`
};
```

---

## 📱 **Social Media Post Examples**

### **Real Estate (Current)**
```
🏡 Just Listed!
Beautiful 3BR/2BA home in Dundee
$425,000 | 1,850 sq ft
Open House this Sunday!
#OmahaRealEstate #JustListed
```

### **Restaurant (New)**
```
🍕 Today's Special!
Truffle Mushroom Pizza
Fresh mozzarella, wild mushrooms, truffle oil
$18.99 (limited time!)
Order now for delivery!
#FoodieOmaha #PizzaLovers
```

---

## ✅ **Next Steps**

1. **Decision Required:** Which implementation option do you prefer?
   - Full migration to restaurant-only
   - Dual-purpose (real estate + restaurant)
   - Phased approach

2. **Priority Features:**
   - Menu item management
   - Food posting system
   - Basic analytics
   - Social media integration

3. **Design Preferences:**
   - Color scheme (currently blue/professional, consider warm food colors)
   - Imagery focus (food photography vs property photos)
   - Tone (casual/fun vs professional)

---

## 💡 **Additional Restaurant Features to Consider**

1. **Online Ordering Integration**
   - Connect to DoorDash, UberEats APIs
   - Own ordering system
   - Table reservations

2. **Customer Reviews & Ratings**
   - Import from Google, Yelp
   - Internal review system
   - Featured testimonials

3. **Loyalty Programs**
   - Points system
   - Repeat customer rewards
   - Referral bonuses

4. **Menu QR Code Generator**
   - Digital menus
   - Contactless ordering
   - Multi-language support

5. **Kitchen Management**
   - Order timing
   - Inventory tracking
   - Prep time optimization

---

## 🎨 **Visual Design Changes**

### Icons to Update:
- 🏠 Home → 🍽️ Restaurant
- 🏘️ Neighborhood → 📍 Location
- 💵 Listing Price → 💲 Menu Price
- 🛏️ Bedrooms → 🥗 Category
- 🚿 Bathrooms → ⏱️ Prep Time
- 📏 Square Feet → 🔥 Spice Level

### Color Palette:
- **Current:** Blues, grays (professional real estate)
- **Suggested:** Warm oranges, reds, greens (appetizing food colors)

---

**Would you like me to start implementing any of these changes? Please specify which approach you'd like to take!**

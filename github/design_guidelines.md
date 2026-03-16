# RealtyFlow Dashboard Design Guidelines

## Design Approach
**Reference-Based (Luxury SaaS)**: Drawing from Webflow's premium feel, Linear's clean interface, and luxury real estate platforms' sophisticated aesthetics. The golden brick theme creates a unique premium identity while maintaining dashboard functionality.

## Typography System

**Headings**: Playfair Display
- H1: 48px/56px, Font Weight 700 (Dashboard titles)
- H2: 36px/44px, Font Weight 600 (Section headers)
- H3: 24px/32px, Font Weight 600 (Card titles)
- H4: 20px/28px, Font Weight 500 (Subsections)

**Body**: Cormorant Garamond
- Large: 18px/28px, Font Weight 400 (Primary content)
- Regular: 16px/24px, Font Weight 400 (Standard text)
- Small: 14px/20px, Font Weight 400 (Labels, captions)

**UI Elements**: Inter (for buttons, inputs, navigation)
- 14-16px, Font Weight 500-600 (maintains readability in interactive elements)

## Layout System

**Spacing Scale**: Tailwind units of 3, 4, 6, 8, 12, 16, 24
- Micro spacing: 3-4 (button padding, tight gaps)
- Component spacing: 6-8 (card padding, form gaps)
- Section spacing: 12-16 (between major sections)
- Page spacing: 24 (top-level margins)

**Dashboard Structure**:
- Fixed sidebar: 280px width (desktop), collapsible on tablet
- Main content: Full remaining width with max-w-7xl inner container
- Header: 72px height, fixed position
- Content grid: 12-column system for flexible layouts

## Component Library

### Navigation
**Sidebar Navigation**:
- Dark charcoal (#1A1A1A) background with subtle gold border-right (1px, #D4AF37 at 20% opacity)
- Logo area: 72px height matching header, centered Playfair Display branding
- Nav items: 48px height, Inter font, gold hover state with left border accent
- Grouped sections with subtle dividers (gold at 10% opacity)
- Active state: Gold gradient background (#D4AF37 to #B8860B at 15% opacity), left border solid gold
- Bottom section: User profile card with avatar, name, subscription tier badge

**Top Header**:
- White/off-white background (#FAFAF9) with subtle bottom shadow
- Left: Breadcrumb navigation (Inter, 14px)
- Right: Search bar (rounded-full, gold focus ring), notification bell (with badge), user avatar dropdown
- Height: 72px with centered content

### Core UI Elements

**Premium Card Component**:
- White background with subtle gold border (1px, 20% opacity)
- Rounded corners: 12px
- Padding: p-6 to p-8 depending on content density
- Shadow: Soft elevation (0 4px 16px rgba(212, 175, 55, 0.1))
- Hover: Slight lift effect (translateY -2px), enhanced shadow
- Header with icon (gold accent), title (Playfair), action button

**3D Luxury Buttons**:
- Primary: Gold gradient background (#D4AF37 to #B8860B), white text
- 3D effect: Multiple box-shadows creating depth (0 2px 0 #8B6914, 0 4px 8px rgba(212, 175, 55, 0.4))
- Height: 44px, padding: px-8, rounded-lg
- Hover: Brightness increase, slight scale (1.02)
- Active: Compress effect (translateY 2px), remove bottom shadow
- When on images: backdrop-blur-md, gold background at 85% opacity

**Buttons on Images**:
- Background: backdrop-blur-md with gold (#D4AF37) at 85% opacity
- Border: 1px solid white at 30% opacity
- Text: White, bold
- No additional hover states (relies on Button component's built-in interactions)

### Forms & Inputs
**Input Fields**:
- Height: 48px, rounded-lg borders
- Border: 1px solid neutral-200, gold focus ring (2px, #D4AF37 at 50% opacity)
- Padding: px-4
- Label: Cormorant Garamond, 14px, mb-2
- Error state: Red border, error message below in 12px

**Select Dropdowns**:
- Match input styling with chevron icon
- Dropdown panel: white with gold border, shadow
- Options: hover gold background (10% opacity)

### Data Display Components

**Stat Cards** (for dashboard metrics):
- 2x2 or 4-column grid layout
- Each card: white background, gold accent border-top (3px)
- Large number: Playfair Display, 36px, gold color
- Label: Cormorant Garamond, 14px, neutral-600
- Trend indicator: small arrow icon with percentage change

**Content Cards** (AI generation results):
- Larger format with thumbnail/preview area
- Title, description, metadata row
- Action buttons in footer (edit, share, download)
- Tag system with gold outlined pills

**Table Component**:
- Minimal borders, alternating row backgrounds (neutral-50)
- Header: gold text, Inter font, 14px semibold
- Rows: 56px height, hover state with gold background (5% opacity)
- Action column: icon buttons with gold hover state

### Overlays & Modals
**Modal Dialog**:
- Max width: 600-800px depending on content
- White background, rounded-xl (16px)
- Header: gold gradient border-bottom, Playfair title
- Content: p-8 with scrollable body if needed
- Footer: flex justify-end with cancel/confirm buttons
- Backdrop: dark overlay (rgba(0,0,0,0.6)) with blur

**Toast Notifications**:
- Positioned top-right, stacked vertically
- White background with gold left border (4px)
- Icon, message, close button
- Auto-dismiss after 5 seconds with slide-out animation

## Dashboard-Specific Layouts

### Main Dashboard View
- 4-column stat card grid at top (responsive to 2 then 1 column)
- Below: 2-column layout for "Recent AI Content" and "Social Media Schedule"
- Bottom: Full-width "SEO Performance" chart card
- All sections with 8-unit gap between

### AI Content Generation Page
- Left sidebar (350px): Form with inputs for content type, tone, keywords
- Right main area: Generated content preview with rich text editor
- Bottom toolbar: word count, readability score, save/export buttons
- Template gallery below with masonry grid of pre-designed options

### Social Media Manager
- Calendar view header with week/month toggle
- Grid layout showing scheduled posts as cards with platform icons
- Right panel: post composer with image upload, caption editor, platform multi-select
- Analytics section below: engagement metrics in stat cards

### Video Avatar Studio
- Center stage: large video preview area (16:9 ratio)
- Left: avatar selection gallery (grid of thumbnail options)
- Right: script editor with teleprompter controls
- Bottom: rendering progress bar and export settings

## Images

**Hero Dashboard Section** (above main content):
- Full-width background image: Luxury real estate property (modern mansion, high-end condo, or architectural detail)
- Height: 320px with gradient overlay (dark bottom to transparent top)
- Overlay content: Welcome message with user's name (Playfair Display, 42px, white), quick action buttons with blurred backgrounds
- Image treatment: Slight blur and darkening for text legibility

**Empty State Illustrations**:
- When no content exists: custom illustration of golden brick building/geometric shapes
- Placement: centered in empty content areas
- Style: line art with gold accents, minimalist

**User Avatars**: Throughout dashboard for profile, comments, team members

**Feature Icons**: Custom iconography with gold finish for:
- AI generation (brain/sparkle)
- Social media (network nodes)
- Video avatar (play button in frame)
- SEO tools (search graph)

**Content Thumbnails**: In cards for generated posts, video previews, saved templates

## Animations
**Minimal, Purposeful Motion**:
- Card hover lifts: 150ms ease-out
- Button press: 100ms ease-in-out
- Modal entrance: 200ms fade + scale
- Page transitions: 300ms fade between dashboard sections
- Loading states: subtle gold shimmer effect on skeleton screens

**Avoid**: Excessive scroll animations, parallax effects, auto-playing elements
# Real Estate AI Content & SEO Platform

## Overview

This is a full-stack web application designed for real estate agents in the Omaha, Nebraska market. The platform provides AI-powered content generation, social media management, SEO optimization, and local market analytics tools. Built specifically for the Bjork Group at Berkshire Hathaway HomeServices, it automates content creation workflows while maintaining local market focus and SEO best practices.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Updates (September 19, 2025)

### HeyGen Video Features Implementation
- **Streaming Avatars**: Added real-time WebRTC avatar interaction with session management
- **Photo Avatar Groups**: Implemented AI photo generation, upload, and avatar group management
- **Video Templates**: Created template system for real estate videos with browse/create functionality
- **Avatar IV API**: Integrated advanced avatar features and video generation endpoints
- All features accessible via sidebar navigation with proper error handling and demo mode fallback

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Framework**: shadcn/ui components built on Radix UI primitives for accessible, customizable interfaces
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript with ES modules for type safety and modern JavaScript features
- **Database ORM**: Drizzle ORM for type-safe database operations and migrations
- **Session Management**: Connect-pg-simple for PostgreSQL-backed session storage
- **API Structure**: Service layer pattern with dedicated services for OpenAI, SEO, and social media integrations

### Database Design
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Tables**:
  - Users (authentication and profile data)
  - Content Pieces (generated content with metadata)
  - Social Media Accounts (platform connections and tokens)
  - SEO Keywords (keyword tracking and ranking data)
  - Market Data (Omaha neighborhood analytics)
  - Analytics (performance metrics and tracking)

### Development & Deployment
- **Build System**: Vite for frontend, esbuild for backend bundling
- **Development**: Hot module replacement with Vite dev server and Express middleware
- **Code Quality**: TypeScript strict mode with path aliases for clean imports
- **Environment**: Replit-optimized with development banner and error overlay

## External Dependencies

### AI & Content Generation
- **OpenAI API**: GPT-5 model for AI content generation with real estate and local SEO focus
- **Content Types**: Blog posts, social media content, and property feature descriptions

### Social Media Platforms
- **Facebook Graph API**: For posting and managing Facebook business pages
- **Instagram Graph API**: For Instagram business account content publishing
- **LinkedIn API**: For professional networking and business content
- **X API**: For real-time social media engagement

### SEO & Analytics Services
- **Google PageSpeed Insights API**: For site performance analysis
- **SEO Ranking APIs**: Integration ready for SEMrush, Ahrefs, or SerpAPI for keyword tracking
- **Local SEO**: Omaha-specific neighborhood and market data integration

### Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Session Storage**: PostgreSQL-based session management for user authentication

### UI & Development Tools
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Lucide React**: Comprehensive icon library for consistent iconography
- **TailwindCSS**: Utility-first CSS framework with custom design system
- **Date-fns**: Date manipulation and formatting utilities
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing
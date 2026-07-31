import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useBusinessType } from "@/lib/businessContext";
import { getIndustryContent } from "@shared/industryContent";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFacebookPages } from "@/hooks/use-facebook-pages";
import { FacebookPageSelector } from "@/components/facebook/facebook-page-selector";
import { useInstagramAccounts } from "@/hooks/use-instagram-accounts";
import { InstagramAccountSelector } from "@/components/instagram/instagram-account-selector";
import {
  Sparkles,
  FileText,
  Eye,
  Search,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Share2,
  ImagePlus,
  Send,
  X,
  RefreshCw,
  Home,
  Edit2,
  Save,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Globe,
  Bed,
  Bath,
  Square,
  MapPin,
  Check,
  Wand2,
  ArrowRight,
  History,
  Trash2,
  Download,
} from "lucide-react";
import {
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTwitter,
  FaYoutube,
  FaTiktok,
} from "react-icons/fa";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useOptimizationPrereqs } from "@/hooks/use-optimization-prereqs";
import { ComplianceChecker } from "@/components/shared/compliance-checker";
import { AiGeneratedBadge } from "@/components/shared/ai-generated-badge";
import { PostingDialog } from "@/components/shared/posting-dialog";
import {
  classifyContent,
  calculateMarketSignals,
  scorePlatform,
} from "@/lib/platform-intelligence";
import type { PlatformScore as PlatformScoreType } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const renderInlineMarkdown = (text: string) => {
  const tokens = text.split(/(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g);
  return tokens.filter(Boolean).map((token, index) => {
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={`md-link-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {label}
        </a>
      );
    }
    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      return <strong key={`md-strong-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={`md-em-${index}`}>{token.slice(1, -1)}</em>;
    }
    return <span key={`md-text-${index}`}>{token}</span>;
  });
};

const normalizeMarkdownInput = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
};

const renderMarkdownContent = (content: unknown): ReactNode => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h1 className="mt-6 first:mt-0 text-[2rem] font-bold tracking-tight text-foreground leading-tight">{children}</h1>,
      h2: ({ children }) => <h2 className="mt-5 first:mt-0 text-[1.65rem] font-bold tracking-tight text-foreground leading-tight">{children}</h2>,
      h3: ({ children }) => <h3 className="mt-4 first:mt-0 text-[1.25rem] font-semibold tracking-tight text-foreground leading-tight">{children}</h3>,
      h4: ({ children }) => <h4 className="mt-4 first:mt-0 text-[1.1rem] font-semibold tracking-tight text-foreground leading-tight">{children}</h4>,
      h5: ({ children }) => <h5 className="mt-3 first:mt-0 text-[1rem] font-semibold tracking-tight text-foreground leading-tight">{children}</h5>,
      h6: ({ children }) => <h6 className="mt-3 first:mt-0 text-[0.95rem] font-semibold tracking-tight text-foreground leading-tight">{children}</h6>,
      p: ({ children }) => <p className="mt-3 first:mt-0 text-[0.98rem] leading-8 text-foreground/95">{children}</p>,
      ul: ({ children }) => <ul className="mt-3 first:mt-0 list-disc space-y-1 pl-6 text-[0.98rem] leading-8 text-foreground/95">{children}</ul>,
      ol: ({ children }) => <ol className="mt-3 first:mt-0 list-decimal space-y-1 pl-6 text-[0.98rem] leading-8 text-foreground/95">{children}</ol>,
      li: ({ children }) => <li className="leading-8">{children}</li>,
      blockquote: ({ children }) => <blockquote className="mt-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground">{children}</blockquote>,
      hr: () => <hr className="my-5 border-border" />,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4 hover:text-primary/80">
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
      th: ({ children }) => <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">{children}</th>,
      td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top text-foreground/95">{children}</td>,
      code: ({ inline, className, children }) => {
        if (inline) {
          return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">{children}</code>;
        }
        return (
          <pre className="my-4 overflow-x-auto rounded-lg bg-neutral-950 px-4 py-3 text-sm text-neutral-100 shadow-sm">
            <code className={className ? `${className} font-mono` : "font-mono"}>{children}</code>
          </pre>
        );
      },
    }}
  >
    {normalizeMarkdownInput(content)}
  </ReactMarkdown>
);

const plainTextFromMarkdown = (content: unknown) =>
  normalizeMarkdownInput(content)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

type GeneratedViewKind =
  | "social"
  | "blog"
  | "email"
  | "property"
  | "landing"
  | "marketing"
  | "generic";

function detectGeneratedViewKind(contentType: string, markdown: unknown): GeneratedViewKind {
  const markdownSafe = normalizeMarkdownInput(markdown);
  if (contentType === "social") return "social";
  if (contentType === "blog") return "blog";
  if (contentType === "property_feature") return "property";

  const lower = markdownSafe.toLowerCase();
  if (/\bsubject\s*:/i.test(markdownSafe) || /\bdear\b|\bhello\b|\bbest regards\b|\bsincerely\b/.test(lower)) return "email";
  if (/\bmeta description\b|\bsuggested slug\b|\bintroduction\b|\bconclusion\b/.test(lower)) return "blog";
  if (/#[a-z0-9_]+/i.test(markdownSafe) || /\bcaption\b|\bhashtag\b|\binstagram\b|\bfacebook\b/.test(lower)) return "social";
  if (/\bbedroom\b|\bbathroom\b|\bsq\s?ft\b|\bmls\b|\bopen house\b|\bproperty\b/.test(lower)) return "property";
  if (/\bhero\b|\bfeatures\b|\bpricing\b|\bfaq\b|\bheadline\b/.test(lower)) return "landing";
  if (/\boffer\b|\bbenefit\b|\bcall to action\b|\bcta\b/.test(lower)) return "marketing";
  return "generic";
}

function extractHashtags(markdown: unknown): string[] {
  const tags = normalizeMarkdownInput(markdown).match(/#[a-zA-Z0-9_]+/g) ?? [];
  return Array.from(new Set(tags));
}

function parseMarkdownSections(markdown: unknown): Record<string, string> {
  const lines = normalizeMarkdownInput(markdown).split(/\r?\n/);
  const sections: Record<string, string> = {};
  let current = "body";
  let buf: string[] = [];

  const flush = () => {
    const value = buf.join("\n").trim();
    if (value) {
      sections[current] = sections[current] ? `${sections[current]}\n\n${value}` : value;
    }
    buf = [];
  };

  for (const line of lines) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = heading[1]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ");
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

function findSectionValue(sections: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const key = name.toLowerCase();
    if (sections[key]) return sections[key];
  }
  return "";
}

function extractLikelyCta(markdown: unknown, sections?: Record<string, string>): string {
  const markdownSafe = normalizeMarkdownInput(markdown);
  const byHeading = sections ? findSectionValue(sections, ["cta", "call to action", "next steps", "conclusion"]) : "";
  if (byHeading) return byHeading;
  const lines = markdownSafe
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const ctaLine = lines.find((line) => /\b(book|schedule|contact|call|visit|learn more|dm|message|register|start|subscribe)\b/i.test(line));
  return ctaLine ?? "";
}

function ContentHistory() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: contentPieces = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/content"],
  });

  if (isLoading) {
    return (
      <div className="mt-6 p-4 border rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4" />
          <h3 className="font-medium">Content History</h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!contentPieces.length) {
    return (
      <div className="mt-6 p-4 border rounded-lg bg-card" data-testid="content-history-empty">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Content History</h3>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">No content generated yet.</p>
            <p className="text-sm text-muted-foreground">Generate your first post to see it here.</p>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...contentPieces].sort((a: any, b: any) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ).slice(0, 20);

  return (
    <div className="mt-6 border rounded-lg bg-card" data-testid="content-history">
      <div className="flex items-center gap-2 p-4 pb-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-foreground">Content History</h3>
        <Badge variant="secondary" className="ml-auto">{contentPieces.length}</Badge>
      </div>
      <div className="max-h-[400px] overflow-y-auto px-4 pb-4 space-y-2">
        {sorted.map((piece: any) => (
          <div
            key={piece.id}
            className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
            data-testid={`content-history-item-${piece.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{piece.title || "Untitled"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{piece.type || "content"}</Badge>
                  {piece.metadata?.wordCount && <span>{piece.metadata.wordCount} words</span>}
                  {piece.metadata?.seoScore && <span>SEO: {piece.metadata.seoScore}/100</span>}
                  {piece.createdAt && <span>{format(new Date(piece.createdAt), "MMM d, h:mm a")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(piece.content || "");
                    toast({ title: "Copied", description: "Content copied to clipboard" });
                  }}
                  data-testid={`button-copy-history-${piece.id}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setExpandedId(expandedId === piece.id ? null : piece.id)}
                  data-testid={`button-expand-history-${piece.id}`}
                >
                  {expandedId === piece.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            {expandedId === piece.id && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-sm text-foreground max-h-[320px] overflow-y-auto leading-relaxed">
                  {renderMarkdownContent(piece.content?.replace(/<[^>]*>/g, "") || "No content")}
                </div>
                {piece.keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {piece.keywords.map((kw: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{kw}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AIContentGeneratorProps {
  isGenerating: boolean;
}

interface GeneratedContent {
  id?: string;
  title: string;
  content: string;
  keywords: string[];
  wordCount: number;
  seoScore?: number;
  seoBreakdown?: {
    keywordOptimization: number;
    contentStructure: number;
    localSEO: number;
    contentQuality: number;
    metaOptimization: number;
    callToAction: number;
  };
}


interface ExtractedPromptDetails {
  propertyType: string;
  location: string;
  highlights: string[];
  tone: string;
  platforms: string[];
  cta: string;
  additionalInstructions: string[];
}

const normalizePlatformName = (platform: string) => {
  const trimmed = platform.trim().toLowerCase();
  if (trimmed === "x" || trimmed === "twitter") {
    return "X (Twitter)";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const extractPromptDetails = (promptText: string): ExtractedPromptDetails => {
  const rawLines = promptText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalized = promptText.replace(/\r/g, "");

  const introMatch = normalized.match(/for\s+(?:an?\s+|the\s+)?(.+?)(?:\s+in\s+(.+?))?(?:[.\n]|$)/i);
  const propertyType = introMatch?.[1]?.trim() || "";
  const location = introMatch?.[2]?.trim() || "";

  const platforms = Array.from(
    new Set(
      Array.from(normalized.matchAll(/\b(instagram|facebook|linkedin|x|twitter|tiktok|youtube|threads|pinterest)\b/gi))
        .map((match) => normalizePlatformName(match[1] || ""))
        .filter(Boolean),
    ),
  );

  const toneMatch = normalized.match(/tone\s*[:\-]\s*([^\n.]+)/i);
  const tone = toneMatch?.[1]?.trim() || "";

  const ctaMatch = normalized.match(/(?:cta|call to action)\s*[:\-]\s*([^\n.]+(?:\.[^\n.]*)?)/i);
  const ctaFromSentence = normalized.match(/encourag(?:e|ing)\s+users?\s+to\s+([^\n.]+?)(?:\.|$)/i);
  const cta = ctaMatch?.[1]?.trim() || ctaFromSentence?.[1]?.trim() || "";

  const highlightBlock = normalized.match(/highlight(?:s)?\s*[:\-]\s*([\s\S]*?)(?:\n\s*(?:include|tone|cta|call to action)\b|$)/i);
  const highlightSource = highlightBlock?.[1] || "";
  const highlights = (highlightSource ? highlightSource.split(/\r?\n/) : rawLines)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter((line) => line && !/^(include|tone|cta|call to action)\b/i.test(line));

  const additionalInstructions = rawLines
    .filter((line) => /^(include|ensure|make|add|use|keep|focus)\b/i.test(line))
    .filter((line) => !/^highlight(?:s)?\s*[:\-]/i.test(line))
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim());

  return {
    propertyType,
    location,
    highlights,
    tone,
    platforms,
    cta,
    additionalInstructions,
  };
};

const buildPromptTopic = (details: ExtractedPromptDetails, fallbackPrompt: string) => {
  const subject = details.propertyType || fallbackPrompt.split(/[.\n]/)[0]?.trim() || fallbackPrompt.trim();
  if (details.location) {
    return `${subject} in ${details.location}`;
  }
  return subject;
};

const buildStructuredPrompt = (rawPrompt: string, details: ExtractedPromptDetails) => {
  const sections = [
    `Original user prompt:\n${rawPrompt.trim()}`,
  ];

  const extractedFields = [
    details.propertyType ? `Property Type: ${details.propertyType}` : null,
    details.location ? `Location: ${details.location}` : null,
    details.highlights.length > 0 ? `Highlights:\n- ${details.highlights.join("\n- ")}` : null,
    details.tone ? `Tone: ${details.tone}` : null,
    details.platforms.length > 0 ? `Platforms: ${details.platforms.join(", ")}` : null,
    details.cta ? `CTA: ${details.cta}` : null,
    details.additionalInstructions.length > 0
      ? `Additional instructions:\n- ${details.additionalInstructions.join("\n- ")}`
      : null,
  ].filter(Boolean);

  if (extractedFields.length > 0) {
    sections.push(`Extracted structured fields:\n${extractedFields.join("\n")}`);
  }

  sections.push(
    "Use the original prompt and extracted fields as the only source of truth. Do not replace them with template defaults or generic placeholder real estate copy.",
  );

  return sections.join("\n\n");
};

const getSocialLengthInstruction = (platforms: string[]) => {
  const selected = platforms.length > 0 ? platforms : ["Instagram", "Facebook"];
  const instructions = selected.map((platform) => {
    if (platform === "LinkedIn") {
      return "LinkedIn length: 150-300 words.";
    }
    if (platform === "X (Twitter)") {
      return "X length: under 280 characters unless the prompt explicitly asks for long form.";
    }
    return `${platform} length: 100-200 words.`;
  });
  return instructions.join(" ");
};

const getTypeSpecificDirective = (
  type: string,
  details: ExtractedPromptDetails,
  rawPrompt: string,
  style: string,
) => {
  const styleInstruction = style !== "None" ? `Use a ${style.toLowerCase()} tone only if it does not conflict with the user's requested tone.` : "";

  if (type === "social") {
    return [
      "Generate a concise social media caption, not a blog post or landing page.",
      getSocialLengthInstruction(details.platforms),
      "Output exactly with these sections in order: Headline, Caption, CTA, Hashtags.",
      "Keep hashtags only in the Hashtags section.",
      details.platforms.length > 0 ? `Target these platforms: ${details.platforms.join(", ")}.` : "If no platform is provided, optimize for Instagram and Facebook.",
      styleInstruction,
      "Do not invent amenities, schools, or property features not explicitly present in the prompt or extracted details.",
      `Prompt source: ${rawPrompt}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (type === "blog") {
    return [
      "Generate a structured long-form article.",
      "Output with clear hierarchy: Title, Introduction, section headings, body content, Conclusion, and optional CTA.",
      "Use markdown heading structure for article readability and SEO formatting.",
      styleInstruction,
      "Do not use social caption structure in blog output.",
      "Do not invent amenities, schools, or property features not explicitly present in the prompt or extracted details.",
      `Prompt source: ${rawPrompt}`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    styleInstruction,
    "Use only information explicitly provided by the user or selected property data.",
  ]
    .filter(Boolean)
    .join(" ");
};
interface Property {
  id: string;
  mlsNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  propertyType: string;
  description?: string;
  yearBuilt?: number;
  listingAgent?: string;
  photos?: string[];
}

const contentTypes = [
  { 
    value: "blog", 
    label: "Blog Post", 
    icon: FileText,
    description: "Long-form articles for your website",
    color: "from-blue-500 to-blue-600"
  },
  { 
    value: "social", 
    label: "Social Post", 
    icon: Share2,
    description: "Quick posts for social media",
    color: "from-purple-500 to-pink-500"
  },
  { 
    value: "property_feature", 
    label: "Property Feature", 
    icon: Home,
    description: "Showcase a specific listing",
    color: "from-amber-500 to-orange-500"
  },
];

const WIZARD_STEPS = [
  { id: 1, label: "Choose Type", description: "Select content type" },
  { id: 2, label: "Add Details", description: "Enter your topic" },
  { id: 3, label: "Generate", description: "Create with AI" },
  { id: 4, label: "Share", description: "Post to platforms" },
];

type ContentTypeId = "blog" | "social" | "property_feature";
type EntrySource = "direct" | "boards" | "quick-action";

const TOPIC_PLACEHOLDERS: Record<ContentTypeId, string> = {
  blog: "Top 10 reasons to invest in luxury villas in Arizona",
  social: "Luxury villa launch in Scottsdale",
  property_feature: "Luxury waterfront listing in Scottsdale",
};

const TOPIC_EXAMPLES: Record<ContentTypeId, string[]> = {
  blog: ["Investment property tips", "Neighborhood spotlight", "Market trends and price updates", "Open house announcement"],
  social: ["Luxury villa launch", "Open house announcement", "Beachfront condos", "Neighborhood spotlight", "Investment property tips"],
  property_feature: ["Modern Scottsdale estate", "Waterfront listing spotlight", "Luxury condo feature", "Newly listed family home"],
};

const neighborhoods = [
  "All Omaha Areas",
  "Dundee",
  "Aksarben",
  "Old Market",
  "Benson",
  "Blackstone",
  "Elkhorn",
  "Millard",
  "Custom",
];

interface PlatformSuggestion {
  platform: string;
  icon: any;
  fit: "excellent" | "very-good" | "good";
  reason: string;
  optimization: string;
  score: number;
}

const platformIcons: Record<string, any> = {
  "Instagram": FaInstagram,
  "Facebook": FaFacebook,
  "LinkedIn": FaLinkedin,
  "X (Twitter)": FaTwitter,
  "TikTok": FaTiktok,
  "YouTube": FaYoutube,
};

const getPlatformSuggestions = (
  content: GeneratedContent | null,
  marketData?: any[]
): PlatformSuggestion[] => {
  if (!content) {
    return [];
  }

  const profile = classifyContent(content);
  const signals = calculateMarketSignals(marketData);

  const platforms = ["Instagram", "Facebook", "LinkedIn", "X (Twitter)", "TikTok", "YouTube"];
  const scores: PlatformScoreType[] = platforms.map(platform =>
    scorePlatform(platform, profile, signals)
  );

  const suggestions: PlatformSuggestion[] = scores
    .filter(s => s.fit !== "fair")
    .map(score => ({
      platform: score.platform,
      icon: platformIcons[score.platform] || FaFacebook,
      fit: score.fit as "excellent" | "very-good" | "good",
      reason: score.reasons.slice(0, 2).join("; ") || "Good platform for this content",
      optimization: score.optimization,
      score: score.score,
    }));

  return suggestions.sort((a, b) => b.score - a.score);
};

export function AIContentGenerator({ isGenerating }: AIContentGeneratorProps) {
  const { businessType, terms } = useBusinessType();
  const isRealEstate = terms.features.mlsSearch;
  const routedPromptRef = useRef(false);
  const topicInputRef = useRef<HTMLInputElement>(null);

  const dynamicContentTypes = useMemo(() => [
    { value: "blog", label: "Blog Post", icon: FileText, description: "Long-form articles for your website", color: "from-blue-500 to-blue-600" },
    { value: "social", label: "Social Post", icon: Share2, description: "Quick posts for social media", color: "from-purple-500 to-pink-500" },
    { value: "property_feature", label: terms.featureLabel, icon: Home, description: isRealEstate ? "Showcase a specific listing" : `Showcase a specific ${terms.item}`, color: "from-amber-500 to-orange-500" },
  ], [businessType, terms, isRealEstate]);

  // Wizard step state
  const [currentStep, setCurrentStep] = useState(1);
  const [contentType, setContentType] = useState<ContentTypeId>("blog");

  // Handle URL parameters for quick actions (e.g., ?type=blog)
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const typeParam = urlParams.get('type');
      const promptParam = urlParams.get('prompt');
      const resolvedType: ContentTypeId =
        typeParam === "social" || typeParam === "property_feature" || typeParam === "blog"
          ? typeParam
          : "blog";

      if (promptParam) {
        routedPromptRef.current = true;
        try {
          const decodedPrompt = decodeURIComponent(promptParam);
          const details = extractPromptDetails(decodedPrompt);
          setContentType(resolvedType);
          setCurrentStep(2);
          setPromptDetails(details);
          setSourcePrompt(decodedPrompt);
          setTopic(decodedPrompt);
          setAiPrompt(buildStructuredPrompt(decodedPrompt, details));
          setContentStyles((prev) => ({
            ...prev,
            social: "Professional",
          }));
        } catch {
          const details = extractPromptDetails(promptParam);
          setContentType(resolvedType);
          setCurrentStep(2);
          setPromptDetails(details);
          setSourcePrompt(promptParam);
          setTopic(promptParam);
          setAiPrompt(buildStructuredPrompt(promptParam, details));
          setContentStyles((prev) => ({
            ...prev,
            social: "Professional",
          }));
        }
      } else if (typeParam && ["blog", "social", "property_feature"].includes(typeParam)) {
        setContentType(resolvedType);
        setCurrentStep(2);
        setSourcePrompt("");
        setPromptDetails(null);
        setTopic("");
      }

      if (typeParam || promptParam) {
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, "", newUrl);
      }
    };

    // Check on mount
    handleUrlChange();
    
    // Also listen for popstate (back/forward) and custom navigation
    window.addEventListener('popstate', handleUrlChange);
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);
  const [sourcePrompt, setSourcePrompt] = useState("");
  const [promptDetails, setPromptDetails] = useState<ExtractedPromptDetails | null>(null);
  const [topic, setTopic] = useState("");
  const [aiPrompt, setAiPrompt] = useState(
    "Follow the user request exactly, keep the writing clear and polished, and avoid filler. Use markdown formatting when structure improves readability."
  );
  const [neighborhood, setNeighborhood] = useState("All Omaha Areas");
  const [customLocation, setCustomLocation] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(true);
  const [longTailKeywords, setLongTailKeywords] = useState(true);

  // Style selection for each content type
  const industryContent = getIndustryContent(businessType);

  const [contentStyles, setContentStyles] = useState<Record<string, string>>({
    blog: "Professional",
    social: "Professional",
    social_media: "Professional",
    property_feature: "Professional",
    market_analysis: "Market data",
    newsletter: "Things around town",
    listing_description: "Luxury",
  });

  useEffect(() => {
    const defaultStyle = industryContent.defaultStyle;
    if (defaultStyle && defaultStyle !== "None" && !routedPromptRef.current) {
      setContentStyles((prev) => ({
        ...prev,
        blog: prev.blog === "None" ? defaultStyle : prev.blog,
        social: prev.social === "None" ? defaultStyle : prev.social,
        property_feature: prev.property_feature === "None" ? defaultStyle : prev.property_feature,
      }));
    }
  }, [businessType]);

  useEffect(() => {
    if (currentStep !== 2 || contentType === "property_feature") return;
    const frame = window.requestAnimationFrame(() => {
      topicInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep, contentType]);
  const [lastGenerated, setLastGenerated] = useState<GeneratedContent | null>(
    null
  );
  const [showFullContent, setShowFullContent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [postingTo, setPostingTo] = useState<string | null>(null);
  const [regeneratingFor, setRegeneratingFor] = useState<string | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<Record<string, any>>(
    {}
  );
  const [viewingPlatform, setViewingPlatform] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});

  // Content editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [showPlatformPreview, setShowPlatformPreview] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const postingSectionRef = useRef<HTMLDivElement | null>(null);
  const [socialPreviewPlatform, setSocialPreviewPlatform] = useState<"Instagram" | "Facebook" | "LinkedIn" | "X (Twitter)">("Instagram");

  // Photo upload dialog states
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoUploadMode, setPhotoUploadMode] = useState<
    "upload" | "stock" | "ai"
  >("upload");

  // MLS Property Search States
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [propertySearchParams, setPropertySearchParams] = useState({
    mlsNumber: "",
    address: "",
    city: "",
    listingAgent: "",
  });

  // Google Places autocomplete states
  const [addressAutocomplete, setAddressAutocomplete] =
    useState<any | null>(null);
  const [googleMapsStatus, setGoogleMapsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ description: string; place_id: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Posting dialog states
  const [showPostingDialog, setShowPostingDialog] = useState(false);
  const [platformToPost, setPlatformToPost] = useState<string | null>(null);
  
  // Store selected IDs for posting (independent of hook auto-select)
  const [selectedPageForPosting, setSelectedPageForPosting] = useState<string | null>(null);
  const [selectedInstagramForPosting, setSelectedInstagramForPosting] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const topicPlaceholder = TOPIC_PLACEHOLDERS[contentType] ?? terms.topicPlaceholder;
  const topicExamples = TOPIC_EXAMPLES[contentType] ?? [];
  const showTopicExamples = currentStep === 2 && contentType !== "property_feature" && !topic.trim();
  const topicHelperMessage = sourcePrompt.trim()
    ? "We've used your Boards prompt as the starting point. You can edit or refine it before continuing."
    : "Enter the topic or keywords you'd like to create content about.";

  const activeContentBody = normalizeMarkdownInput(isEditing ? editedContent : lastGenerated?.content);
  const contentViewKind = useMemo(
    () => detectGeneratedViewKind(contentType, activeContentBody),
    [contentType, activeContentBody],
  );
  const parsedSections = useMemo(() => parseMarkdownSections(activeContentBody), [activeContentBody]);
  const detectedHashtags = useMemo(() => extractHashtags(activeContentBody), [activeContentBody]);
  const socialHeadline = useMemo(
    () => findSectionValue(parsedSections, ["headline", "title", "hook"]),
    [parsedSections],
  );
  const socialCaption = useMemo(() => {
    const byHeading = findSectionValue(parsedSections, ["caption", "post", "body", "content"]);
    if (byHeading) return byHeading;
    return activeContentBody
      .split(/\r?\n/)
      .filter((line) => !/#[a-zA-Z0-9_]+/.test(line))
      .join("\n")
      .trim();
  }, [parsedSections, activeContentBody]);
  const socialCta = useMemo(
    () => extractLikelyCta(activeContentBody, parsedSections),
    [activeContentBody, parsedSections],
  );
  const estimatedReadingMinutes = useMemo(
    () => Math.max(1, Math.ceil((lastGenerated?.wordCount ?? 0) / 200)),
    [lastGenerated?.wordCount],
  );
  const previewText = useMemo(() => {
    const normalized = plainTextFromMarkdown(activeContentBody);
    if (!normalized) return "";
    if (normalized.length <= 320) return normalized;
    return `${normalized.slice(0, 320).trimEnd()}...`;
  }, [activeContentBody]);

  const handleExportGeneratedContent = () => {
    if (!lastGenerated?.content) return;
    const blob = new Blob([lastGenerated.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fileSafeTitle = (lastGenerated.title || "generated-content")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileSafeTitle || "generated-content"}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: "Generated content exported as a markdown file.",
    });
  };

  const handleScrollToShareActions = () => {
    postingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Fetch company profile for dynamic content
  const { data: companyProfile } = useQuery({
    queryKey: ["/api/company/profile"],
  });

  // Get agent name and brokerage with smart defaults
  const agentName = (companyProfile as any)?.agentName || "[Your Name]";
  const brokerageName = (companyProfile as any)?.brokerageName || "[Your Brokerage]";
  const businessName = (companyProfile as any)?.businessName || "[Your Business]";

  // Facebook Pages hook for page selection
  const {
    pages: facebookPages,
    isLoading: isLoadingPages,
    isError: isPagesError,
    refetch,
    selectedPageId,
    setSelectedPageId,
    isReady: isFacebookPagesReady,
  } = useFacebookPages({ autoSelect: true });

  // Instagram Accounts hook for account selection
  const {
    accounts: instagramAccounts,
    isLoading: isLoadingInstagram,
    isError: isInstagramError,
    error: instagramError,
    selectedAccountId: selectedInstagramAccountId,
    setSelectedAccountId: setSelectedInstagramAccountId,
    isReady: isInstagramReady,
  } = useInstagramAccounts({ autoSelect: true });

  const { data: marketData } = useQuery({
    queryKey: ['/api/market/data'],
    staleTime: 15 * 60 * 1000,
  });

  // Style options for all content types
  const styleOptions = [
    { value: "None", label: "None" },
    { value: "Professional", label: "Professional" },
    { value: "Funny", label: "Funny" },
    { value: "Luxury", label: "Luxury" },
    { value: "Market data", label: "Market data" },
    { value: "Things around town", label: "Things around town" },
    { value: "Custom template", label: "Custom template" },
  ];

  // Initialize Google Maps
  useEffect(() => {
    const initializeGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log("Google Maps loaded successfully");
        setGoogleMapsStatus("ready");

        // Initialize AutocompleteService for dropdown suggestions
        if (!addressAutocomplete) {
          const service = new (window.google.maps.places as any).AutocompleteService();
          setAddressAutocomplete(service);
        }
      } else {
        setTimeout(initializeGoogleMaps, 500);
      }
    };

    initializeGoogleMaps();
  }, [addressAutocomplete]);

  // Debounced auto-search function
  const handleAddressAutoSearch = async (address: string) => {
    if (!address || address.length < 5) return;

    setIsLoadingDetails(true);
    try {
      console.log("Fetching property details for address:", address);
      const response = await fetch("/api/property/details-by-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: address.split(",")[0] }),
      });

      if (response.ok) {
        const propertyData = await response.json();
        console.log(
          "GBCMA property details for address:",
          address,
          propertyData
        );

        // Auto-fill other form fields
        setPropertySearchParams((prev) => ({
          ...prev,
          city: propertyData.City || prev.city,
          mlsNumber: propertyData.ListAgentMlsId || prev.mlsNumber,
          listingAgent: propertyData.ListAgentFullName || prev.listingAgent,
          address: propertyData.UnparsedAddress || address,
        }));

        console.log("AI Content Generator form auto-filled with:", {
          mlsNumber: propertyData.ListAgentMlsId,
          listingAgent: propertyData.ListAgentFullName,
          city: propertyData.City,
          address: propertyData.UnparsedAddress,
        });

        // Auto-select this property
        const foundProperty: Property = {
          id: propertyData.ListingKey || "auto-found",
          mlsNumber: propertyData.ListAgentMlsId || "",
          address: propertyData.UnparsedAddress || address,
          city: propertyData.City || "",
          state: "NE",
          zipCode: propertyData.PostalCode || "",
          price: Number(propertyData.ListPrice) || 0,
          bedrooms: Number(propertyData.BedroomsTotal) || 0,
          bathrooms: Number(propertyData.BathroomsTotal) || 0,
          squareFootage: Number(propertyData.LivingArea) || 0,
          yearBuilt: Number(propertyData.YearBuilt) || 0,
          propertyType: "Residential",
          listingAgent: propertyData.ListAgentFullName || null,
          photos:
            propertyData.Media?.slice(0, 3)?.map((m: any) => m.MediaURL) || [],
          description: propertyData.PublicRemarks || "",
        };
        setSelectedProperty(foundProperty);
      } else {
        console.log("No property details found for address:", address);
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Get address suggestions as user types
  const getAddressSuggestions = async (input: string) => {
    if (!addressAutocomplete || !input || input.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const request = {
        input: input,
        types: ["address"],
        componentRestrictions: { country: "US" },
      };

      addressAutocomplete.getPlacePredictions(
        request,
        (
          predictions: Array<{ description: string; place_id: string }> | null
        ) => {
          if (predictions) {
            setAddressSuggestions(predictions);
            setShowSuggestions(true);
          }
        }
      );
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    }
  };

  // Handle address suggestion selection
  const selectAddressSuggestion = async (
    suggestion: { description: string; place_id: string }
  ) => {
    const address = suggestion.description;
    setPropertySearchParams((prev) => ({ ...prev, address }));
    setShowSuggestions(false);

    // Auto-search for property details immediately
    await handleAddressAutoSearch(address);
  };

  // Get suggestions when address changes
  useEffect(() => {
    if (
      propertySearchParams.address &&
      propertySearchParams.address.length >= 3
    ) {
      getAddressSuggestions(propertySearchParams.address);
    } else {
      setShowSuggestions(false);
      setAddressSuggestions([]);
    }
  }, [propertySearchParams.address, addressAutocomplete]);

  // MLS Property Search Query - using the same API as the dropdown for consistency
  const {
    data: properties,
    isLoading: isSearchingProperties,
    refetch: searchProperties,
  } = useQuery<Property[]>({
    queryKey: ["gbcma-ai-content-search", propertySearchParams],
    queryFn: async () => {
      const hasAddress =
        propertySearchParams.address &&
        propertySearchParams.address.trim() !== "";
      const hasMlsNumber =
        propertySearchParams.mlsNumber &&
        propertySearchParams.mlsNumber.trim() !== "";
      const hasListingAgent =
        propertySearchParams.listingAgent &&
        propertySearchParams.listingAgent.trim() !== "";

      // If we have an address, use the same details-by-address API that works for dropdown
      if (hasAddress) {
        console.log(
          "Search Properties using details-by-address API for:",
          propertySearchParams.address
        );

        const response = await fetch("/api/property/details-by-address", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            address: propertySearchParams.address.trim().split(",")[0], // Extract just the street address
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property details API error:",
            response.status,
            errorText
          );
          throw new Error(`Property details API error: ${response.status}`);
        }

        const propertyData = await response.json();
        console.log("Search Properties API response:", propertyData);

        // Convert single property to array format using the same structure as dropdown
        const property: Property = {
          id: propertyData.ListingKey || "search-result",
          mlsNumber:
            propertyData.ListingId ||
            propertyData.MLSNumber ||
            propertyData.mlsNumber ||
            propertyData.ListingKey ||
            "",
          address: propertyData.UnparsedAddress || propertySearchParams.address,
          city: propertyData.City || "",
          state: "NE",
          zipCode: propertyData.PostalCode || "",
          price: Number(propertyData.ListPrice) || 0,
          bedrooms: Number(propertyData.BedroomsTotal) || 0,
          bathrooms: Number(propertyData.BathroomsTotal) || 0,
          squareFootage: Number(propertyData.LivingArea) || 0,
          yearBuilt: Number(propertyData.YearBuilt) || 0,
          propertyType: "Residential",
          description: propertyData.PublicRemarks || "",
          listingAgent: propertyData.ListAgentFullName || undefined,
          photos: propertyData.Media?.slice(0, 3)?.map((m: any) => m.MediaURL) || [],
        };

        return [property];
      }

      // If no address but has MLS number, use the GBCMA search API
      if (hasMlsNumber) {
        const response = await fetch(
          `/api/property/search?mls_number=${encodeURIComponent(
            propertySearchParams.mlsNumber.trim()
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property search API error:",
            response.status,
            errorText
          );
          throw new Error(`Property search API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform GBCMA API response to our Property interface
        const properties = data.properties || [];

        return properties.map((prop: any) => ({
          id: prop.id || Math.random().toString(),
          mlsNumber:
            prop.mlsNumber ||
            prop.MLSNumber ||
            prop.mlsId ||
            propertySearchParams.mlsNumber ||
            prop.id ||
            "",
          address: prop.address || "",
          city: prop.city || "",
          state: prop.state || "NE",
          zipCode: prop.zipCode || "",
          price: prop.listPrice || 0,
          listPrice: prop.listPrice || 0,
          bedrooms: prop.beds || 0,
          bathrooms: prop.baths || 0,
          squareFootage: prop.sqft || 0,
          yearBuilt: prop.yearBuilt || 0,
          propertyType: prop.propertyType || "Residential",
          listingStatus: prop.status || "Active",
          listingDate: prop.onMarketDate || "",
          description: "",
          features: prop.condition ? [prop.condition] : [],
          photoUrls: prop.imageUrl ? [prop.imageUrl] : [],
          neighborhood: prop.subdivision || null,
          agentName: null,
        }));
      }

      // If no address or MLS but has listing agent, use the GBCMA search API
      if (hasListingAgent) {
        const response = await fetch(
          `/api/property/search?agent=${encodeURIComponent(
            propertySearchParams.listingAgent.trim()
          )}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Property search API error:",
            response.status,
            errorText
          );
          throw new Error(`Property search API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform GBCMA API response to our Property interface
        const properties = data.properties || [];

        return properties.map((prop: any) => ({
          id: prop.id || Math.random().toString(),
          mlsNumber:
            prop.mlsNumber ||
            prop.MLSNumber ||
            prop.mlsId ||
            prop.id ||
            "",
          address: prop.address || "",
          city: prop.city || "",
          state: prop.state || "NE",
          zipCode: prop.zipCode || "",
          price: prop.listPrice || 0,
          listPrice: prop.listPrice || 0,
          bedrooms: prop.beds || 0,
          bathrooms: prop.baths || 0,
          squareFootage: prop.sqft || 0,
          yearBuilt: prop.yearBuilt || 0,
          propertyType: prop.propertyType || "Residential",
          listingStatus: prop.status || "Active",
          listingDate: prop.onMarketDate || "",
          description: "",
          features: prop.condition ? [prop.condition] : [],
          photoUrls: prop.imageUrl ? [prop.imageUrl] : [],
          neighborhood: prop.subdivision || null,
          agentName: null,
        }));
      }

      // No valid search criteria
      return [];
    },
    enabled: false, // Only search when user clicks search button
  });

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image under 50MB. Large images are auto-compressed.",
          variant: "destructive",
        });
        return;
      }

      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const postToPlatformMutation = useMutation({
    mutationFn: async ({
      platform,
      content,
      photo,
      selectedPageId: explicitPageId,
      selectedInstagramId: explicitInstagramId,
    }: {
      platform: string;
      content: string;
      photo?: File;
      selectedPageId?: string | null;
      selectedInstagramId?: string | null;
    }) => {
      // Handle Facebook posting separately using Facebook Pages API
      if (platform.toLowerCase() === "facebook") {
        // Use explicit page ID from mutation params if provided
        const pageId = explicitPageId !== undefined ? explicitPageId : selectedPageId;
        
        const payload: Record<string, any> = { content };
        // Only include pageId if explicitly selected, otherwise backend uses saved default
        if (pageId) {
          payload.pageId = pageId;
        }
        // Include image URL only if it's a remote URL (S3), not a local data URL
        if (photoPreview && photoPreview.startsWith('https://')) {
          payload.mediaUrl = photoPreview;
        }
        
        const response = await fetch("/api/facebook/post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Facebook");
        }

        return response.json();
      } else if (platform.toLowerCase() === "instagram") {
        // Handle Instagram posting using Instagram Graph API
        // Use explicit Instagram ID from mutation params if provided
        const instagramAccountId = explicitInstagramId !== undefined ? explicitInstagramId : selectedInstagramAccountId;
        
        if (!instagramAccountId) {
          throw new Error("Please select an Instagram account to post to");
        }

        const formData = new FormData();
        formData.append("content", content);
        formData.append("instagramBusinessAccountId", instagramAccountId);
        if (photo) {
          formData.append("photo", photo);
        }
        // Include image URL only if it's a remote URL (S3), not a local data URL
        if (photoPreview && !photo && photoPreview.startsWith('https://')) {
          formData.append("mediaUrl", photoPreview);
        }

        const response = await fetch("/api/instagram/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Instagram");
        }

        return response.json();
      } else if (
        platform.toLowerCase() === "x (twitter)" ||
        platform.toLowerCase() === "twitter"
      ) {
        // Handle Twitter posting using Twitter API v2
        const formData = new FormData();
        formData.append("content", content);
        if (photo) {
          formData.append("photo", photo);
        }

        const response = await fetch("/api/twitter/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to post to Twitter");
        }

        return response.json();
      } else {
        // For other platforms, use the general endpoint
        const formData = new FormData();
        formData.append("platform", platform);
        formData.append("content", content);
        if (photo) {
          formData.append("photo", photo);
        }

        const response = await fetch("/api/social/post", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return response.json();
      }
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Posted Successfully!",
        description: `Your content has been posted to ${variables.platform}`,
      });
      setPostingTo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      // Reset dialog-specific state after successful posting
      setSelectedPageForPosting(null);
      setSelectedInstagramForPosting(null);
    },
    onError: (error: any, variables) => {
      toast({
        title: "Posting Failed",
        description: `Failed to post to ${variables.platform}: ${error.message}`,
        variant: "destructive",
      });
      setPostingTo(null);
      // Reset dialog-specific state after failed posting
      setSelectedPageForPosting(null);
      setSelectedInstagramForPosting(null);
    },
  });

  const handlePostToPlatform = (platform: string) => {
    if (!lastGenerated) return;

    // For Facebook and Instagram, show dialog to select page/account
    if (platform.toLowerCase() === "facebook" || platform.toLowerCase() === "instagram") {
      // Pre-fill dialog with current defaults from hooks for better UX
      setSelectedPageForPosting(selectedPageId || null);
      setSelectedInstagramForPosting(selectedInstagramAccountId || null);
      setPlatformToPost(platform);
      setShowPostingDialog(true);
    } else {
      // For other platforms, post directly
      setPostingTo(platform);
      postToPlatformMutation.mutate({
        platform: platform.toLowerCase(),
        content: lastGenerated.content,
        photo: selectedPhoto || undefined,
      });
    }
  };

  const handleConfirmPost = () => {
    if (!lastGenerated || !platformToPost) return;

    const platform = platformToPost.toLowerCase();
    
    // Capture selected IDs BEFORE any state changes
    const selectedPage = selectedPageForPosting;
    const selectedInstagram = selectedInstagramForPosting;
    
    // Validate selection for Facebook/Instagram
    if (platform === "facebook" && !selectedPage) {
      toast({
        title: "No Page Selected",
        description: "Please select a Facebook page to post to",
        variant: "destructive",
      });
      return;
    }
    
    if (platform === "instagram" && !selectedInstagram) {
      toast({
        title: "No Account Selected",
        description: "Please select an Instagram account to post to",
        variant: "destructive",
      });
      return;
    }

    // Sync dialog selections back to hooks for UI consistency
    if (platform === "facebook" && selectedPage) {
      setSelectedPageId(selectedPage);
    }
    if (platform === "instagram" && selectedInstagram) {
      setSelectedInstagramAccountId(selectedInstagram);
    }

    setPostingTo(platformToPost);
    setShowPostingDialog(false);

    // Pass captured IDs explicitly to mutation
    postToPlatformMutation.mutate({
      platform,
      content: lastGenerated.content,
      photo: selectedPhoto || undefined,
      selectedPageId: selectedPage,
      selectedInstagramId: selectedInstagram,
    });
  };

  const handlePostToWebsite = (platform: string) => {
    const content =
      optimizedContent[platform]?.content || lastGenerated?.content;
    if (!content) return;

    toast({
      title: "Posting to Website",
      description: `Publishing "${
        lastGenerated?.title || "Real Estate Content"
      }" to your website...`,
    });

    // Simulate posting to website - this would integrate with CMS
    setTimeout(() => {
      toast({
        title: "Posted to Website",
        description: "Your content has been published to your website!",
      });
    }, 2000);
  };

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/content/generate", data);
      return response.json();
    },
    onSuccess: (data: GeneratedContent) => {
      setLastGenerated(data);
      setGeneratedAt(new Date());
      setShowFullContent(false);
      setIsEditing(false);
      toast({
        title: "Content Generated Successfully!",
        description: `Created "${data.title}" with ${data.wordCount} words`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const regenerateForPlatformMutation = useMutation<
    GeneratedContent,
    Error,
    {
      platform: string;
      originalContent: string;
      contentType: string;
      topic: string;
      neighborhood: string;
    }
  >({
    mutationFn: async ({
      platform,
      originalContent,
      contentType,
      topic,
      neighborhood,
    }) => {
      const response = await apiRequest(
        "POST",
        "/api/content/regenerate-for-platform",
        {
          platform: platform.toLowerCase(),
          originalContent,
          contentType,
          topic,
          neighborhood,
          seoOptimized: true,
          longTailKeywords: true,
        }
      );
      return await response.json();
    },
    onSuccess: (data: GeneratedContent, variables) => {
      // Check if SEO score is below 80%, if so, automatically regenerate (max 2 retries)
      const seoScore = data.seoScore || 0;
      const currentRetries = retryCount[variables.platform] || 0;

      if (seoScore < 80 && currentRetries < 2) {
        // Automatically retry to get better SEO score
        console.log(
          `SEO score ${seoScore}% below target, auto-regenerating for ${
            variables.platform
          } (attempt ${currentRetries + 1})...`
        );
        setRetryCount((prev) => ({
          ...prev,
          [variables.platform]: currentRetries + 1,
        }));

        regenerateForPlatformMutation.mutate({
          platform: variables.platform,
          originalContent: variables.originalContent,
          contentType: variables.contentType,
          topic: variables.topic,
          neighborhood: variables.neighborhood,
        });
        return;
      }

      // Reset retry count for this platform
      setRetryCount((prev) => ({
        ...prev,
        [variables.platform]: 0,
      }));

      // Store optimized content for this platform
      setOptimizedContent((prev) => ({
        ...prev,
        [variables.platform]: data,
      }));
      setLastGenerated(data);
      setGeneratedAt(new Date());

      const message =
        seoScore >= 80
          ? `Content optimized for ${variables.platform} with ${seoScore}% SEO score`
          : `Content optimized for ${variables.platform} with ${seoScore}% SEO score (reached max retries)`;

      toast({
        title: "Content Optimized!",
        description: message,
      });
      setRegeneratingFor(null);
    },
    onError: (error: any, variables) => {
      toast({
        title: "Regeneration Failed",
        description: `Failed to regenerate content for ${variables.platform}`,
        variant: "destructive",
      });
      setRegeneratingFor(null);
    },
  });

  const handleRegenerateForPlatform = (platform: string) => {
    if (!lastGenerated) return;

    setRegeneratingFor(platform);
    regenerateForPlatformMutation.mutate({
      platform,
      originalContent: lastGenerated.content,
      contentType,
      topic,
      neighborhood,
    });
  };

  const handleGenerate = () => {
    const promptInstruction = sourcePrompt.trim() || aiPrompt.trim();
    const extractedDetails = promptDetails || extractPromptDetails(promptInstruction);
    const topicInstruction = topic.trim() || buildPromptTopic(extractedDetails, promptInstruction);

    if (!topicInstruction.trim() && contentType !== "property_feature") {
      toast({
        title: "Topic Required",
        description: "Please enter a topic or keywords for content generation",
        variant: "destructive",
      });
      return;
    }

    if (contentType === "property_feature" && !selectedProperty) {
      toast({
        title: "Property Required",
        description:
          "Please search and select a property for property feature content",
        variant: "destructive",
      });
      return;
    }

    const selectedStyle = contentStyles[contentType] || "None";
    const typeSpecificDirective = getTypeSpecificDirective(
      contentType,
      extractedDetails,
      promptInstruction,
      selectedStyle,
    );

    const routedInstruction = routedPromptRef.current
      ? buildStructuredPrompt(promptInstruction, extractedDetails)
      : null;

    const qualityDirective = [
      "Write with professional tone, strong grammar, and precise punctuation.",
      `Stay tightly focused on this topic: ${topicInstruction || "the requested topic"}.`,
      "Only use facts explicitly provided in the prompt, extracted details, or selected property data.",
      "Never invent or assume amenities, schools, concierge, rooftop lounges, smart-home features, gyms, or gourmet kitchens unless they are explicitly provided.",
      typeSpecificDirective,
    ].join(" ");

    const enhancedPrompt = routedInstruction
      ? `${routedInstruction}\n\n${qualityDirective}`
      : selectedStyle === "None"
        ? `${aiPrompt.trim()} ${qualityDirective}`
        : `${aiPrompt.trim()} Use a ${selectedStyle.toLowerCase()} style and tone for this content. ${qualityDirective}`;

    generateContentMutation.mutate({
      type: contentType,
      topic: topicInstruction,
      aiPrompt: enhancedPrompt,
      neighborhood:
        neighborhood === "All Omaha Areas" ? undefined : (neighborhood === "Custom" ? (customLocation.trim() || undefined) : neighborhood),
      seoOptimized,
      longTailKeywords,
      localSeoFocus: true,
      propertyData:
        contentType === "property_feature" ? selectedProperty : undefined,
      businessType,
    });
  };

  // Determine if generator is active (ready to generate content)
  const isActive =
    !isGenerating &&
    !generateContentMutation.isPending &&
    (contentType !== "property_feature" ||
      (contentType === "property_feature" && selectedProperty));

  // Optimization prerequisites validation
  const optimizationPrereqs = useOptimizationPrereqs({
    contentType,
    topic,
    lastGenerated,
    selectedProperty,
    isGenerating,
    isPending: regenerateForPlatformMutation.isPending,
  });

  // Navigate to next step
  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Navigate to previous step
  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if we can proceed to next step
  const canProceedToStep2 = contentType !== "";
  const canProceedToStep3 = contentType === "property_feature" 
    ? selectedProperty !== null 
    : topic.trim() !== "";
  const canProceedToStep4 = lastGenerated !== null;

  // Handle generate and auto-advance to step 4
  const handleGenerateAndAdvance = () => {
    handleGenerate();
  };

  // Auto-advance to step 4 when content is generated
  const prevLastGenerated = useRef(lastGenerated);
  useEffect(() => {
    if (lastGenerated && !prevLastGenerated.current) {
      setCurrentStep(4);
    }
    prevLastGenerated.current = lastGenerated;
  }, [lastGenerated]);

  return (
    <>
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                AI Content Generator
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Create professional content in 4 simple steps
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={
              isActive
                ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                : "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
            }
          >
            {isActive ? "Ready" : "Setup Required"}
          </Badge>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => {
                  if (step.id === 1) setCurrentStep(1);
                  else if (step.id === 2 && canProceedToStep2) setCurrentStep(2);
                  else if (step.id === 3 && canProceedToStep3) setCurrentStep(3);
                  else if (step.id === 4 && canProceedToStep4) setCurrentStep(4);
                }}
                className={`flex items-center gap-2 transition-all ${
                  step.id <= currentStep ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
                disabled={
                  (step.id === 2 && !canProceedToStep2) ||
                  (step.id === 3 && !canProceedToStep3) ||
                  (step.id === 4 && !canProceedToStep4)
                }
                data-testid={`wizard-step-${step.id}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : currentStep > step.id
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${currentStep === step.id ? "text-primary" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                </div>
              </button>
              {index < WIZARD_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${currentStep > step.id ? "bg-green-500" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Step 1: Choose Content Type */}
        {currentStep === 1 && (
          <div className="space-y-6" data-testid="wizard-step-1-content">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">What would you like to create?</h3>
              <p className="text-muted-foreground">Choose the type of content that fits your needs</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dynamicContentTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = contentType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setContentType(type.value);
                    }}
                    className={`relative p-6 rounded-xl border-2 transition-all text-left group hover:shadow-lg ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                    data-testid={`content-type-card-${type.value}`}
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center mb-4`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <h4 className="font-semibold text-foreground mb-1">{type.label}</h4>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg ring-2 ring-primary/30 ring-offset-2">
                          <Check className="h-5 w-5 text-primary-foreground stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Style Selection */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-medium text-foreground mb-3 block">
                Content Style (Optional)
              </Label>
              <Select
                value={contentStyles[contentType] || "None"}
                onValueChange={(value) =>
                  setContentStyles((prev) => ({
                    ...prev,
                    [contentType]: value,
                  }))
                }
              >
                <SelectTrigger className="w-full" data-testid="select-content-style">
                  <SelectValue placeholder="Choose a style..." />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Next Button */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToStep2}
                className="px-6"
                data-testid="button-next-step-1"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Add Details */}
        {currentStep === 2 && (
          <div className="space-y-6" data-testid="wizard-step-2-content">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {contentType === "property_feature" ? (isRealEstate ? "Select a Property" : `Select a ${terms.itemCapitalized}`) : "What's your topic?"}
              </h3>
              <p className="text-muted-foreground">
                {contentType === "property_feature" 
                  ? (isRealEstate ? "Search for a property to feature" : `Search for a ${terms.item} to feature`)
                  : "Enter keywords or a topic for your content"}
              </p>
            </div>

            {/* Property Selection (only for Property Feature) */}
            {contentType === "property_feature" ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center space-x-2 mb-4">
                    <Home className="h-5 w-5 text-primary" />
                    <Label className="text-sm font-medium text-foreground">
                      Search Property from MLS
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="mls-number" className="text-xs text-muted-foreground mb-1 block">
                        MLS#
                      </Label>
                      <Input
                        id="mls-number"
                        placeholder="e.g., 22301234"
                        value={propertySearchParams.mlsNumber}
                        onChange={(e) =>
                          setPropertySearchParams((prev) => ({
                            ...prev,
                            mlsNumber: e.target.value,
                          }))
                        }
                        className="w-full"
                        data-testid="input-mls-number"
                      />
                    </div>
                    <div className="relative">
                      <Label htmlFor="property-address" className="text-xs text-muted-foreground mb-1 block">
                        Address{" "}
                        {isLoadingDetails && (
                          <span className="text-blue-600">(Loading...)</span>
                        )}
                      </Label>
                      <Input
                        ref={addressInputRef}
                        id="property-address"
                        placeholder="Start typing address..."
                        value={propertySearchParams.address}
                        onChange={(e) =>
                          setPropertySearchParams((prev) => ({
                            ...prev,
                            address: e.target.value,
                          }))
                  }
                  className="w-full"
                  data-testid="input-property-address"
                  onBlur={() => {
                    // Hide suggestions after a small delay to allow clicking
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onFocus={() => {
                    if (addressSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                />

                {/* Address Suggestions Dropdown */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-gray-600"
                        onClick={() => selectAddressSuggestion(suggestion)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {suggestion.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {googleMapsStatus === "loading" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Loading address suggestions...
                  </p>
                )}
                {googleMapsStatus === "ready" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ✓ Type to see address suggestions
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="listing-agent"
                  className="text-xs text-muted-foreground mb-1 block"
                >
                  Listing Agent
                </Label>
                <Input
                  id="listing-agent"
                  placeholder={`e.g., ${agentName}`}
                  value={propertySearchParams.listingAgent}
                  onChange={(e) =>
                    setPropertySearchParams((prev) => ({
                      ...prev,
                      listingAgent: e.target.value,
                    }))
                  }
                  className="w-full"
                  data-testid="input-listing-agent"
                />
              </div>
            </div>

            <Button
              onClick={() => searchProperties()}
              disabled={
                isSearchingProperties ||
                (!propertySearchParams.mlsNumber &&
                  !propertySearchParams.address &&
                  !propertySearchParams.listingAgent)
              }
              className="w-full"
              variant="outline"
              data-testid="button-search-properties"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearchingProperties ? "Searching..." : "Search Properties"}
            </Button>

            {properties && properties.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Found Properties
                </Label>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedProperty?.id === property.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                      onClick={() => setSelectedProperty(property)}
                      data-testid={`property-option-${property.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-xs font-medium">
                            #{property.mlsNumber}
                          </p>
                          <p className="text-xs">{property.address}</p>
                          <p className="text-xs opacity-75">
                            ${property.price?.toLocaleString() || "N/A"} •{" "}
                            {property.bedrooms || 0}BR/{property.bathrooms || 0}
                            BA
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProperty && (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Selected Property
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProperty(null)}
                    className="h-7 text-xs"
                    data-testid="button-clear-property"
                  >
                    Change Property
                  </Button>
                </div>
                
                <div className="flex gap-4">
                  {/* Property Image */}
                  <div className="w-28 h-28 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                    {selectedProperty.photos?.[0] ? (
                      <img 
                        src={selectedProperty.photos[0]} 
                        alt={selectedProperty.address}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Home className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  {/* Property Details */}
                  <div className="flex-1 space-y-2">
                    <div>
                      <h5 className="font-semibold text-base text-foreground line-clamp-1">
                        {selectedProperty.address}
                      </h5>
                      <p className="text-sm text-muted-foreground">
                        {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedProperty.bedrooms || 0}</span>
                        <span className="text-xs text-muted-foreground">beds</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Bath className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedProperty.bathrooms || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Square className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedProperty.squareFootage?.toLocaleString() || "N/A"}</span>
                        <span className="text-xs text-muted-foreground">sqft</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="text-xs text-muted-foreground">
                        MLS# {selectedProperty.mlsNumber}
                      </div>
                      {selectedProperty.listingAgent && (
                        <div className="text-xs text-muted-foreground">
                          Agent: {selectedProperty.listingAgent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
            </div>
            ) : (
              /* Topic Input for non-property content */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="topic" className="text-sm font-medium text-foreground mb-2 block">
                    Topic or Keywords
                  </Label>
                  <Input
                    id="topic"
                    placeholder={topicPlaceholder}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full text-lg py-6"
                    data-testid="input-topic"
                    ref={topicInputRef}
                  />
                  <p className="mt-2 text-xs text-muted-foreground" data-testid="text-topic-helper">
                    {topicHelperMessage}
                  </p>
                  {showTopicExamples && (
                    <div className="mt-4 space-y-2" data-testid="topic-example-section">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Example Topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topicExamples.map((suggestedTopic, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="text-xs px-2.5 py-1 rounded-full transition-all bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-transparent"
                            onClick={() => setTopic(suggestedTopic)}
                            data-testid={`suggested-topic-${idx}`}
                          >
                            {suggestedTopic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {promptDetails && sourcePrompt.trim() && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2" data-testid="extracted-prompt-details">
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Extracted from your prompt</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {promptDetails.propertyType && (
                        <div>
                          <span className="text-muted-foreground">Property Type:</span>
                          <span className="ml-2 font-medium text-foreground">{promptDetails.propertyType}</span>
                        </div>
                      )}
                      {promptDetails.location && (
                        <div>
                          <span className="text-muted-foreground">Location:</span>
                          <span className="ml-2 font-medium text-foreground">{promptDetails.location}</span>
                        </div>
                      )}
                      {promptDetails.platforms.length > 0 && (
                        <div className="md:col-span-2">
                          <span className="text-muted-foreground">Platforms:</span>
                          <span className="ml-2 font-medium text-foreground">{promptDetails.platforms.join(", ")}</span>
                        </div>
                      )}
                      {promptDetails.tone && (
                        <div className="md:col-span-2">
                          <span className="text-muted-foreground">Tone:</span>
                          <span className="ml-2 font-medium text-foreground">{promptDetails.tone}</span>
                        </div>
                      )}
                      {promptDetails.cta && (
                        <div className="md:col-span-2">
                          <span className="text-muted-foreground">CTA:</span>
                          <span className="ml-2 font-medium text-foreground">{promptDetails.cta}</span>
                        </div>
                      )}
                    </div>
                    {promptDetails.highlights.length > 0 && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Highlights:</p>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {promptDetails.highlights.map((highlight, index) => (
                            <li key={`highlight-${index}`} className="text-foreground">{highlight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Neighborhood Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-2 block">
                      {isRealEstate ? "Neighborhood Focus" : "Area / Location"}
                    </Label>
                    <Select value={neighborhood} onValueChange={setNeighborhood}>
                      <SelectTrigger data-testid="select-neighborhood">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {neighborhoods.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {neighborhood === "Custom" && (
                      <input
                        type="text"
                        data-testid="input-custom-location"
                        placeholder="Enter your city, area, or neighborhood..."
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground mb-2 block">
                      SEO Options
                    </Label>
                    <div className="flex items-center space-x-4 h-10">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="long-tail"
                          checked={longTailKeywords}
                          onCheckedChange={(checked) => setLongTailKeywords(checked === true)}
                          data-testid="checkbox-long-tail"
                        />
                        <Label htmlFor="long-tail" className="text-sm text-muted-foreground">
                          Long-tail
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="local-seo"
                          checked={seoOptimized}
                          onCheckedChange={(checked) => setSeoOptimized(checked === true)}
                          data-testid="checkbox-local-seo"
                        />
                        <Label htmlFor="local-seo" className="text-sm text-muted-foreground">
                          Local SEO
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button variant="outline" onClick={goToPrevStep} data-testid="button-back-step-2">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToStep3}
                className="px-6"
                data-testid="button-next-step-2"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {currentStep === 3 && (
          <div className="space-y-6" data-testid="wizard-step-3-content">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Generate</h3>
              <p className="text-muted-foreground">Review your settings and create your content</p>
            </div>

            {/* Summary Card */}
            <div className="p-6 bg-muted/30 rounded-xl border space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Content Summary
              </h4>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 font-medium">{dynamicContentTypes.find(t => t.value === contentType)?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Style:</span>
                  <span className="ml-2 font-medium">{contentStyles[contentType] || "None"}</span>
                </div>
                {topic && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Topic:</span>
                    <span className="ml-2 font-medium">{topic}</span>
                  </div>
                )}
                {contentType === "property_feature" && selectedProperty && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Property:</span>
                    <span className="ml-2 font-medium">{selectedProperty.address}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Neighborhood:</span>
                  <span className="ml-2 font-medium">{neighborhood}</span>
                </div>
              </div>
            </div>

            {/* AI Instructions (collapsed by default) */}
            <details className="p-4 bg-muted/20 rounded-lg border">
              <summary className="cursor-pointer text-sm font-medium text-foreground flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                AI Instructions (Advanced)
              </summary>
              <div className="mt-4">
                <Textarea
                  id="ai-prompt"
                  placeholder="Tell the AI exactly how to create your content..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="w-full resize-none"
                  rows={3}
                  data-testid="input-ai-prompt"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Customize tone, style, call-to-actions, or any special requirements.
                </p>
              </div>
            </details>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || generateContentMutation.isPending}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              data-testid="button-generate-ai-content"
            >
              {isGenerating || generateContentMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Generating Your Content...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Content with AI
                </>
              )}
            </Button>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={goToPrevStep} data-testid="button-back-step-3">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {lastGenerated && (
                <Button onClick={() => setCurrentStep(4)} data-testid="button-view-results">
                  View Results
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Share */}
        {currentStep === 4 && !lastGenerated && (
          <div className="mt-6 rounded-xl border border-dashed bg-muted/20 p-8 text-center" data-testid="content-preview-empty">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-base font-medium text-foreground">No content generated yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Generate your first post to see it here.</p>
            <Button className="mt-4" variant="outline" onClick={() => setCurrentStep(3)}>
              Go To Generate Step
            </Button>
          </div>
        )}

        {currentStep === 4 && lastGenerated && (
          <div className="mt-6 rounded-xl border bg-card shadow-sm" data-testid="content-preview">
            <div className="border-b px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-base">Latest Generated Content</h3>
                  <AiGeneratedBadge size="sm" showTooltip={true} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {generatedAt ? format(generatedAt, "MMM d, h:mm a") : "Generated just now"}
                  </span>
                  {lastGenerated.seoScore ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        lastGenerated.seoScore >= 80
                          ? "border-green-500 text-green-700 dark:text-green-400"
                          : lastGenerated.seoScore >= 70
                            ? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                            : "border-red-500 text-red-700 dark:text-red-400"
                      }`}
                    >
                      SEO {lastGenerated.seoScore}%
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="text-lg font-semibold text-foreground mt-3">{lastGenerated.title}</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg border bg-muted/20 overflow-hidden">
                <div className="px-4 py-4">
                  {contentViewKind === "blog" ? (
                    <Tabs
                      value={isEditing ? "editor" : "reading"}
                      onValueChange={(value) => setIsEditing(value === "editor")}
                    >
                      <TabsList className="mb-4">
                        <TabsTrigger value="reading" data-testid="tab-blog-reading-view">Reading View</TabsTrigger>
                        <TabsTrigger value="editor" data-testid="tab-blog-editor-view">Editor View</TabsTrigger>
                      </TabsList>
                      <TabsContent value="reading">
                        <article className="mx-auto max-w-3xl rounded-xl border bg-card px-6 py-6 shadow-sm">
                          <div className="mb-6 border-b pb-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blog Article</p>
                            <h1 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-foreground">
                              {lastGenerated.title}
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {estimatedReadingMinutes} min read</span>
                              <span>{lastGenerated.wordCount} words</span>
                              {lastGenerated.seoScore ? <span>SEO {lastGenerated.seoScore}%</span> : null}
                            </div>
                          </div>
                          <div className="prose prose-neutral max-w-none text-[16px] leading-[1.75] dark:prose-invert">
                            {renderMarkdownContent(lastGenerated.content)}
                          </div>
                          {extractLikelyCta(lastGenerated.content, parsedSections) ? (
                            <div className="mt-6 rounded-lg border border-amber-300/70 bg-amber-50/70 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Call To Action</p>
                              <div className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                                {renderMarkdownContent(extractLikelyCta(lastGenerated.content, parsedSections))}
                              </div>
                            </div>
                          ) : null}
                        </article>
                      </TabsContent>
                      <TabsContent value="editor">
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={14}
                          className="resize-none text-sm"
                          placeholder="Edit your generated content..."
                        />
                      </TabsContent>
                    </Tabs>
                  ) : contentViewKind === "social" ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-4 py-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social Media Preview</p>
                          <p className="text-sm text-foreground">Instagram · Facebook · LinkedIn · X</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(["Instagram", "Facebook", "LinkedIn", "X (Twitter)"] as const).map((platform) => (
                            <Button
                              key={platform}
                              variant={socialPreviewPlatform === platform ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => setSocialPreviewPlatform(platform)}
                            >
                              {platform === "Instagram" ? "Instagram" : platform === "Facebook" ? "Facebook" : platform === "LinkedIn" ? "LinkedIn" : "X"}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md">
                        <p className="text-xs text-muted-foreground">Generated by AI • {socialPreviewPlatform}</p>
                        {socialHeadline ? (
                          <div className="mt-3">
                            <p className="mb-1.5 inline-flex rounded-full border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-violet-900 dark:border-violet-400/40 dark:bg-violet-500/20 dark:text-violet-200">Headline</p>
                            <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
                              {plainTextFromMarkdown(socialHeadline)}
                            </h2>
                          </div>
                        ) : null}
                        <div className="mt-4">
                          <p className="mb-2 inline-flex rounded-full border border-slate-400/50 bg-slate-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-800 dark:border-slate-400/40 dark:bg-slate-500/20 dark:text-slate-200">Caption</p>
                          <div className="text-[16px] leading-[1.75] text-foreground/95">
                          {renderMarkdownContent(socialCaption || lastGenerated.content)}
                          </div>
                        </div>
                        {socialCta ? (
                          <div className="mt-5 rounded-lg border border-sky-300/70 bg-sky-50/70 px-4 py-3 dark:border-sky-500/40 dark:bg-sky-500/10">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">Call To Action</p>
                            <div className="mt-1 text-sm text-sky-900 dark:text-sky-100">
                              {renderMarkdownContent(socialCta)}
                            </div>
                          </div>
                        ) : null}
                        {detectedHashtags.length > 0 ? (
                          <div className="mt-5">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hashtags</p>
                            <div className="flex flex-wrap gap-2">
                              {detectedHashtags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                                  onClick={() => {
                                    navigator.clipboard.writeText(tag);
                                    toast({ title: "Hashtag copied", description: tag });
                                  }}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={12}
                      className="resize-none text-sm"
                      placeholder="Edit your generated content..."
                    />
                  ) : (
                    <article className="mx-auto max-w-3xl rounded-xl border bg-card px-6 py-6 shadow-sm">
                      <div className="prose prose-neutral max-w-none text-[16px] leading-[1.75] dark:prose-invert">
                        {renderMarkdownContent(lastGenerated.content)}
                      </div>
                    </article>
                  )}
                </div>
              </div>

              {/* BHHS Compliance Check */}
              {isRealEstate && ((isEditing && editedContent.trim().length > 10) || (!isEditing && lastGenerated.content.trim().length > 10)) && (
                <ComplianceChecker
                  content={isEditing ? editedContent : lastGenerated.content}
                  platform="general"
                  hasMedia={false}
                  hasVideo={false}
                  onContentFix={(fixedContent) => {
                    const safeFixedContent = normalizeMarkdownInput(fixedContent);
                    setEditedContent(safeFixedContent);
                    if (!isEditing) {
                      setLastGenerated((prev) => (prev ? { ...prev, content: safeFixedContent } : prev));
                    }
                  }}
                  showGuidelines={false}
                />
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="quick-actions-row">
                {contentViewKind === "social" && socialCaption ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(plainTextFromMarkdown(socialCaption));
                      toast({ title: "Copied", description: "Caption copied to clipboard." });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Caption
                  </Button>
                ) : null}
                {contentViewKind === "social" && detectedHashtags.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(detectedHashtags.join(" "));
                      toast({ title: "Copied", description: "Hashtags copied to clipboard." });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Hashtags
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isEditing) {
                      setEditedContent(lastGenerated.content);
                      setShowFullContent(true);
                    } else {
                      setLastGenerated((prev) => (prev ? { ...prev, content: editedContent } : null));
                    }
                    setIsEditing((prev) => !prev);
                  }}
                >
                  {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit2 className="mr-2 h-4 w-4" />}
                  {isEditing ? "Save" : "Edit"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(lastGenerated.content);
                    toast({ title: "Copied", description: "Generated content copied to clipboard." });
                  }}
                  data-testid="button-copy-content"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportGeneratedContent}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={handleScrollToShareActions}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generateContentMutation.isPending}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generateContentMutation.isPending ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Word Count</p>
                  <p className="font-medium text-foreground">{lastGenerated.wordCount}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Keywords</p>
                  <p className="font-medium text-foreground">{lastGenerated.keywords?.length || 0}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Generated</p>
                  <p className="font-medium text-foreground">{generatedAt ? format(generatedAt, "h:mm a") : "Just now"}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-xs text-muted-foreground">Content Type</p>
                  <p className="font-medium text-foreground">{dynamicContentTypes.find((t) => t.value === contentType)?.label}</p>
                </div>
              </div>

              {(lastGenerated.keywords?.length || 0) > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(lastGenerated.keywords || []).map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo Upload Section */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-foreground">Add Photo (Optional)</Label>
                  {!selectedPhoto && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPhotoUpload(true)}
                      data-testid="button-add-photo"
                    >
                      <ImagePlus className="mr-1 h-3 w-3" />
                      Upload Image
                    </Button>
                  )}
                </div>

                {photoPreview && (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Selected photo"
                      className="max-w-full h-32 object-cover rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={removePhoto}
                      data-testid="button-remove-photo"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {lastGenerated.seoBreakdown && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-2">SEO Breakdown</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span>Keywords:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.keywordOptimization}/25</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Structure:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.contentStructure}/20</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Local SEO:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.localSEO}/20</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quality:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.contentQuality}/15</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Meta:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.metaOptimization}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Call-to-Action:</span>
                      <span className="font-mono">{lastGenerated.seoBreakdown.callToAction}/10</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Social Media Account Selectors */}
            <div ref={postingSectionRef} className="mt-3 px-5 pb-5 pt-4 border-t space-y-3">
              {/* Facebook Page Selector */}
              <FacebookPageSelector
                pages={facebookPages}
                isLoading={isLoadingPages}
                isError={isPagesError}
                value={selectedPageId}
                onChange={setSelectedPageId}
                label="Facebook Page"
                placeholder="Select a page to post to Facebook..."
                showLabel={true}
                onRefresh={() => refetch()}
              />

              {/* Instagram Account Selector */}
              <InstagramAccountSelector
                accounts={instagramAccounts}
                isLoading={isLoadingInstagram}
                isError={isInstagramError}
                error={instagramError}
                value={selectedInstagramAccountId}
                onChange={setSelectedInstagramAccountId}
                label="Instagram Account"
                placeholder="Select an Instagram account..."
                showLabel={true}
              />
            </div>

            {/* Platform Suggestions */}
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center mb-3">
                <Share2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Recommended Platforms:
                </p>
              </div>

              {/* Optimization Prerequisites Checklist */}
              <div className="mb-3 p-2 bg-muted/30 rounded-md border">
                <p className="text-xs font-medium text-foreground mb-2">Optimization Requirements:</p>
                <div className="space-y-1">
                  {optimizationPrereqs.checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      {item.isMet ? (
                        <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                          <span className="text-white text-xs">✗</span>
                        </div>
                      )}
                      <span className={`text-xs ${item.isMet ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {getPlatformSuggestions(lastGenerated, marketData as any[]).map(
                  (suggestion, index) => {
                    const IconComponent = suggestion.icon;
                    return (
                      <div
                        key={suggestion.platform}
                        className="flex items-start space-x-3 p-2 bg-background rounded border"
                      >
                        <div className="flex items-center space-x-2">
                          <IconComponent
                            className="h-4 w-4"
                            style={{
                              color:
                                suggestion.platform === "Facebook"
                                  ? "#1877F2"
                                  : suggestion.platform === "Instagram"
                                  ? "#E4405F"
                                  : suggestion.platform === "LinkedIn"
                                  ? "#0077B5"
                                  : suggestion.platform === "YouTube"
                                  ? "#FF0000"
                                  : "#1DA1F2",
                            }}
                          />
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              suggestion.fit === "excellent"
                                ? "border-green-500 text-green-700 dark:text-green-400"
                                : suggestion.fit === "very-good"
                                ? "border-blue-500 text-blue-700 dark:text-blue-400"
                                : "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                            }`}
                          >
                            {suggestion.fit === "excellent"
                              ? "🏆 Excellent"
                              : suggestion.fit === "very-good"
                              ? "⭐ Very Good"
                              : "👍 Good"}{" "}
                            Fit
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-foreground">
                              {suggestion.platform}
                            </p>
                            <div className="flex items-center space-x-1">
                              <TooltipProvider>
                                <Tooltip>
                                  {optimizationPrereqs.ready && regeneratingFor !== suggestion.platform ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() =>
                                        handleRegenerateForPlatform(
                                          suggestion.platform
                                        )
                                      }
                                      data-testid={`button-regenerate-${suggestion.platform.toLowerCase()}`}
                                    >
                                      <RefreshCw className="mr-1 h-3 w-3" />
                                      Optimize
                                    </Button>
                                  ) : (
                                    <TooltipTrigger asChild>
                                      <span
                                        tabIndex={0}
                                        role="button"
                                        className="inline-flex cursor-not-allowed"
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-6 px-2 text-xs pointer-events-none"
                                          disabled
                                          data-testid={`button-regenerate-${suggestion.platform.toLowerCase()}`}
                                        >
                                          {regeneratingFor === suggestion.platform ? (
                                            <>
                                              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                                              Optimizing...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="mr-1 h-3 w-3" />
                                              Optimize
                                            </>
                                          )}
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                  )}
                                  {!optimizationPrereqs.ready && (
                                    <TooltipContent>
                                      <div className="text-xs">
                                        {optimizationPrereqs.unmetReasons.join(" • ")}
                                      </div>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  setPreviewPlatform(suggestion.platform);
                                  setShowPlatformPreview(true);
                                }}
                                data-testid={`button-view-${suggestion.platform.toLowerCase()}`}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                Preview
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => {
                                  if (suggestion.platform === "Website") {
                                    handlePostToWebsite(suggestion.platform);
                                  } else {
                                    handlePostToPlatform(suggestion.platform);
                                  }
                                }}
                                disabled={
                                  postingTo === suggestion.platform ||
                                  postToPlatformMutation.isPending
                                }
                                data-testid={`button-post-${suggestion.platform.toLowerCase()}`}
                              >
                                {postingTo === suggestion.platform ? (
                                  <>
                                    <span className="animate-spin mr-1">
                                      ⏳
                                    </span>
                                    Posting...
                                  </>
                                ) : (
                                  <>
                                    {suggestion.platform === "Website" ? (
                                      <Globe className="mr-1 h-3 w-3" />
                                    ) : (
                                      <Send className="mr-1 h-3 w-3" />
                                    )}
                                    {suggestion.platform === "Website"
                                      ? "Post to Website"
                                      : "Post Now"}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.reason}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Tip:</span>{" "}
                            {suggestion.optimization}
                          </p>
                          {optimizedContent[suggestion.platform] && (
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge
                                variant="outline"
                                className="text-xs border-green-500 text-green-700 dark:text-green-400"
                              >
                                SEO:{" "}
                                {optimizedContent[suggestion.platform]
                                  .seoScore || 82}
                                %
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Optimized for {suggestion.platform}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Platform Preview Dialog */}
      <Dialog open={showPlatformPreview} onOpenChange={setShowPlatformPreview}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Platform Preview</DialogTitle>
          </DialogHeader>
          {previewPlatform && (
            <div>
              {/* Facebook Preview */}
              {previewPlatform === "Facebook" && (
                <div className="bg-white text-black">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        {agentName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{agentName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>{format(new Date(), "MMM d 'at' h:mm a")}</span>
                        <span>·</span>
                        <span>🌎</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(
                            optimizedContent[previewPlatform]?.content ||
                              lastGenerated?.content ||
                              ""
                          );
                        }}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <MoreHorizontal className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>

                  <div className="px-3 pb-3">
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-sm mb-3 min-h-[100px] resize-none"
                        placeholder="Edit your content..."
                      />
                    ) : (
                      <div className="text-sm mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {plainTextFromMarkdown(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            "",
                        )}
                      </div>
                    )}
                  </div>

                  {photoPreview && (
                    <div
                      className="aspect-video bg-cover bg-center"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    ></div>
                  )}
                  {!photoPreview && (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm">Property Image</div>
                      </div>
                    </div>
                  )}

                  <div className="p-3 border-t">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white">
                            👍
                          </div>
                          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                            ❤️
                          </div>
                        </div>
                        <span className="ml-2">43</span>
                      </div>
                      <div>8 comments</div>
                    </div>
                    <div className="flex items-center justify-around mt-3 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        👍 Like
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        💬 Comment
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-gray-600"
                      >
                        📤 Share
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Instagram Preview */}
              {previewPlatform === "Instagram" && (
                <div className="bg-white text-black">
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 rounded-full p-[2px]">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-golden-accent">
                            MB
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          mikebjork_realtor
                        </div>
                        <div className="text-xs text-gray-500">
                          Omaha, Nebraska
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          setEditedContent(
                            optimizedContent[previewPlatform]?.content ||
                              lastGenerated?.content ||
                              ""
                          );
                        }}
                        className="h-8 w-8 p-0 hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <MoreHorizontal className="h-4 w-4" />
                    </div>
                  </div>

                  {photoPreview ? (
                    <div
                      className="aspect-square bg-cover bg-center"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    ></div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm">Property Image</div>
                      </div>
                    </div>
                  )}

                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <Heart className="h-6 w-6" />
                        <MessageCircle className="h-6 w-6" />
                        <Send className="h-6 w-6" />
                      </div>
                      <Bookmark className="h-6 w-6" />
                    </div>
                    <div className="text-sm font-semibold mb-1">127 likes</div>
                    <div className="text-sm max-h-32 overflow-y-auto">
                      <span className="font-semibold">mikebjork_realtor</span>
                      <span className="ml-1">
                        {isEditing ? (
                          <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="text-sm mt-2 min-h-[80px] resize-none w-full"
                            placeholder="Edit your caption..."
                          />
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {plainTextFromMarkdown(
                              optimizedContent[previewPlatform]?.content ||
                                lastGenerated?.content ||
                                "",
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      View all 5 comments
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(), "MMMM d")}
                    </div>
                  </div>
                </div>
              )}

              {/* LinkedIn/X Preview */}
              {(previewPlatform === "LinkedIn" ||
                previewPlatform === "X (Twitter)") && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        {agentName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{agentName}</div>
                      <div className="text-xs text-gray-500">
                        Real Estate Professional at {brokerageName}
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(true);
                        setEditedContent(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            ""
                        );
                      }}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="text-sm mb-3 min-h-[100px] resize-none"
                      placeholder="Edit your content..."
                    />
                  ) : (
                    <div className="text-sm mb-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {plainTextFromMarkdown(
                        optimizedContent[previewPlatform]?.content ||
                          lastGenerated?.content ||
                          "",
                      )}
                    </div>
                  )}
                  {photoPreview && (
                    <div className="border rounded bg-gray-50 p-1 mb-3">
                      <img
                        src={photoPreview}
                        alt="Property"
                        className="w-full aspect-video object-cover rounded"
                      />
                    </div>
                  )}
                  {!photoPreview && (
                    <div className="border rounded bg-gray-50 p-4">
                      <div className="text-center text-gray-600">
                        <Home className="h-8 w-8 mx-auto mb-2" />
                        <div className="text-sm font-medium">
                          Property Listing
                        </div>
                        <div className="text-xs">Click to view details</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YouTube Preview */}
              {previewPlatform === "YouTube" && (
                <div className="bg-white text-black p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-golden-accent rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-golden-foreground">
                        {agentName.split(' ').map((n: string) => n.charAt(0)).join('').substring(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {businessName}
                      </div>
                      <div className="text-xs text-gray-500">
                        Omaha Real Estate Expert
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(true);
                        setEditedContent(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            ""
                        );
                      }}
                      className="h-8 w-8 p-0 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {photoPreview ? (
                    <div
                      className="aspect-video bg-cover bg-center rounded mb-3 relative"
                      style={{ backgroundImage: `url(${photoPreview})` }}
                    >
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent ml-1"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-golden-accent/20 to-golden-muted/40 flex items-center justify-center rounded mb-3">
                      <div className="text-center text-gray-600">
                        <Home className="h-12 w-12 mx-auto mb-2" />
                        <div className="text-sm font-medium">
                          Video Thumbnail
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-semibold line-clamp-2">
                      {lastGenerated?.title || "Real Estate Video Content"}
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="text-xs text-gray-600 min-h-[60px] resize-none"
                        placeholder="Edit video description..."
                      />
                    ) : (
                      <div className="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {plainTextFromMarkdown(
                          optimizedContent[previewPlatform]?.content ||
                            lastGenerated?.content ||
                            "",
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Controls */}
          {previewPlatform && (
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              {!isEditing ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    setEditedContent(
                      optimizedContent[previewPlatform]?.content ||
                        lastGenerated?.content ||
                        ""
                    );
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditedContent("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (previewPlatform) {
                        setOptimizedContent((prev) => ({
                          ...prev,
                          [previewPlatform]: {
                            ...prev[previewPlatform],
                            content: editedContent,
                          },
                        }));
                      }
                      setIsEditing(false);
                      toast({
                        title: "Content Updated",
                        description: "Your content has been saved",
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Posting Dialog for Facebook/Instagram Page Selection */}
      <PostingDialog
        open={showPostingDialog}
        onClose={() => {
          setShowPostingDialog(false);
          setPlatformToPost(null);
          // Reset dialog-specific state on cancel/escape
          setSelectedPageForPosting(null);
          setSelectedInstagramForPosting(null);
        }}
        onConfirm={handleConfirmPost}
        platform={platformToPost}
        isPosting={postingTo === platformToPost}
        facebookPages={facebookPages}
        isLoadingPages={isLoadingPages}
        isPagesError={isPagesError}
        pagesError={null}
        selectedPageId={selectedPageForPosting}
        onPageChange={setSelectedPageForPosting}
        onRefreshPages={() => refetch()}
        instagramAccounts={instagramAccounts}
        isLoadingInstagram={isLoadingInstagram}
        isInstagramError={isInstagramError}
        instagramError={instagramError}
        selectedInstagramAccountId={selectedInstagramForPosting}
        onInstagramAccountChange={setSelectedInstagramForPosting}
      />

      {/* Photo Upload Dialog */}
      <Dialog open={showPhotoUpload} onOpenChange={setShowPhotoUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Photo to Content</DialogTitle>
          </DialogHeader>

          <Tabs
            value={photoUploadMode}
            onValueChange={(value) =>
              setPhotoUploadMode(value as "upload" | "stock" | "ai")
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload Photo</TabsTrigger>
              <TabsTrigger value="stock">Stock Photos</TabsTrigger>
              <TabsTrigger value="ai">AI Image</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                saveToLibrary={true}
                libraryType="photo"
                onGetUploadParameters={async () => {
                  const response = await fetch("/api/objects/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contentType: "image/jpeg" }),
                    credentials: "include",
                  });
                  const data = await response.json();
                  return {
                    method: "PUT" as const,
                    url: data.uploadURL,
                    fileUrl: data.fileUrl, // S3 file URL
                  };
                }}
                onComplete={(uploadedFileUrl, savedToLibrary) => {
                  // Use the S3 URL directly
                  setPhotoPreview(uploadedFileUrl);
                  setShowPhotoUpload(false);
                  if (savedToLibrary === false) {
                    toast({
                      title: "Photo uploaded",
                      description: "Your photo has been added to the content but could not be saved to your library.",
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "Photo uploaded successfully",
                      description: "Your photo has been added to the content and saved to your library.",
                    });
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  <span>Select Photo to Upload</span>
                </div>
              </ObjectUploader>

              <div className="text-xs text-muted-foreground text-center">
                Upload your own photos for a personal touch. Supports JPG, PNG
                up to 10MB.
              </div>
            </TabsContent>

            <TabsContent value="stock" className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1582407947304-fd86f028f716?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1601760562234-9814eea6663a?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=200&q=80",
                ].map((image, index) => (
                  <div
                    key={index}
                    className="relative cursor-pointer group rounded overflow-hidden border hover:border-primary"
                    onClick={() => {
                      setPhotoPreview(image);
                      setShowPhotoUpload(false);
                      toast({
                        title: "Stock photo selected",
                        description:
                          "Professional stock photo added to your content.",
                      });
                    }}
                  >
                    <img
                      src={image}
                      alt={`Stock photo ${index + 1}`}
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Button
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Choose from our curated collection of professional real estate
                photos.
              </div>
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="ai-image-prompt"
                    className="text-sm font-medium"
                  >
                    Describe the image you want to generate
                  </Label>
                  <Input
                    id="ai-image-prompt"
                    placeholder="e.g., Modern luxury home with golden accents at sunset"
                    className="w-full"
                  />
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  onClick={() => {
                    toast({
                      title: "AI Image Generation",
                      description:
                        "This feature will generate custom images using AI. Coming soon!",
                    });
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate AI Image
                </Button>

                <div className="text-xs text-muted-foreground text-center">
                  AI will create a custom image based on your description,
                  perfectly tailored for your content.
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPhotoUpload(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>

    <ContentHistory />
    </>
  );
}

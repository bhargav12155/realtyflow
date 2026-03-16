import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/useAuth";
import {
  BookOpen,
  Download,
  FileText,
  Play,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  Home,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";

interface GuideContent {
  markdown: string;
  images: string[];
  videos: { type: string; label: string; filename: string }[];
}

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function parseMarkdownToToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of md.split("\n")) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      items.push({ level, text, id });
    }
  }
  return items;
}

const sectionImageMap: Record<string, { file: string; caption: string }> = {
  "1-setting-up-whatsapp": { file: "01-whatsapp-settings.png", caption: "WhatsApp Business Settings" },
  "2-creating-message-templates": { file: "02-create-template.png", caption: "Template Creation Form" },
  "4-sending-bulk-messages": { file: "03-bulk-send-workflow.png", caption: "Bulk Send Workflow" },
  "6-managing-bulk-queues": { file: "04-queue-management.png", caption: "Queue Management Dashboard" },
  "8-whatsapp-analytics": { file: "05-analytics-dashboard.png", caption: "Analytics Dashboard" },
  "5-understanding-the-bulk-queue-system": { file: "06-messaging-tiers.png", caption: "Meta Messaging Tiers" },
  "step-1-prepare-your-contact-list": { file: "07-file-import.png", caption: "File Import Process" },
  "template-approval": { file: "08-template-lifecycle.png", caption: "Template Approval Lifecycle" },
  "11-metafacebook-account-issues--restrictions": { file: "09-meta-restrictions.png", caption: "Meta Account Restrictions" },
};

function MarkdownRenderer({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: JSX.Element[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let key = 0;

  function flushTable() {
    if (tableRows.length === 0) return;
    const headers = tableRows[0];
    const dataRows = tableRows.slice(1).filter(r => !r.every(c => /^[-:]+$/.test(c)));
    elements.push(
      <div key={key++} className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse" data-testid="table-guide">
          <thead>
            <tr className="bg-muted/50">
              {headers.map((h, i) => (
                <th key={i} className="border px-3 py-2 text-left font-semibold text-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/30">
                {row.map((cell, ci) => (
                  <td key={ci} className="border px-3 py-2 text-muted-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      if (!inTable) inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed || trimmed === "---") continue;

    if (trimmed.startsWith("# ")) {
      const text = trimmed.replace(/^# /, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      elements.push(
        <h1 key={key++} id={id} className="text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 scroll-mt-20" data-testid={`heading-${id}`}>
          {text}
        </h1>
      );
    } else if (trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^## /, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      elements.push(
        <div key={key++}>
          <Separator className="my-6" />
          <h2 id={id} className="text-xl md:text-2xl font-bold text-foreground mt-6 mb-3 scroll-mt-20" data-testid={`heading-${id}`}>
            {text}
          </h2>
          {sectionImageMap[id] && (
            <div className="my-4 rounded-lg overflow-hidden border bg-muted/20">
              <img
                src={`/api/whatsapp/guide/image/${sectionImageMap[id].file}`}
                alt={sectionImageMap[id].caption}
                className="w-full max-h-80 object-contain"
                loading="lazy"
                data-testid={`img-${id}`}
              />
              <p className="text-xs text-muted-foreground text-center py-2 italic">{sectionImageMap[id].caption}</p>
            </div>
          )}
        </div>
      );
    } else if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^### /, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      elements.push(
        <div key={key++}>
          <h3 id={id} className="text-lg font-semibold text-foreground mt-5 mb-2 scroll-mt-20" data-testid={`heading-${id}`}>
            {text}
          </h3>
          {sectionImageMap[id] && (
            <div className="my-3 rounded-lg overflow-hidden border bg-muted/20">
              <img
                src={`/api/whatsapp/guide/image/${sectionImageMap[id].file}`}
                alt={sectionImageMap[id].caption}
                className="w-full max-h-64 object-contain"
                loading="lazy"
                data-testid={`img-${id}`}
              />
              <p className="text-xs text-muted-foreground text-center py-2 italic">{sectionImageMap[id].caption}</p>
            </div>
          )}
        </div>
      );
    } else if (trimmed.startsWith("- **") || trimmed.startsWith("* **")) {
      const cleanText = trimmed.replace(/^[-*]\s*/, "");
      const boldMatch = cleanText.match(/^\*\*(.+?)\*\*\s*[-—]\s*(.*)/);
      if (boldMatch) {
        elements.push(
          <li key={key++} className="ml-5 mb-1.5 text-sm text-muted-foreground list-disc">
            <span className="font-semibold text-foreground">{boldMatch[1]}</span> — {boldMatch[2]}
          </li>
        );
      } else {
        const text = cleanText.replace(/\*\*/g, "");
        elements.push(
          <li key={key++} className="ml-5 mb-1.5 text-sm text-muted-foreground list-disc font-medium">{text}</li>
        );
      }
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.replace(/^[-*]\s*/, "").replace(/\*\*/g, "");
      elements.push(
        <li key={key++} className="ml-5 mb-1.5 text-sm text-muted-foreground list-disc">{text}</li>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const cleanText = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "");
      elements.push(
        <div key={key++} className="ml-5 mb-1.5 text-sm text-muted-foreground">{cleanText}</div>
      );
    } else {
      const cleanText = trimmed.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground mb-3 leading-relaxed">{cleanText}</p>
      );
    }
  }

  if (inTable) flushTable();

  return <>{elements}</>;
}

export default function HelpGuidesPage() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("");
  const [tocOpen, setTocOpen] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: guideData, isLoading } = useQuery<GuideContent>({
    queryKey: ["/api/whatsapp/guide/content"],
  });

  const toc = useMemo(() => {
    if (!guideData?.markdown) return [];
    return parseMarkdownToToc(guideData.markdown);
  }, [guideData?.markdown]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
      const headings = document.querySelectorAll("h1[id], h2[id], h3[id]");
      let current = "";
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top < 150) current = heading.id;
      });
      if (current) setActiveSection(current);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {isAuthenticated && <Sidebar />}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 md:px-8">
          {!isAuthenticated && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1" data-testid="link-login">
                <Home className="h-4 w-4" /> Back to iMakePage
              </Link>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2" data-testid="heading-help-guides">
                <BookOpen className="h-7 w-7 text-blue-600" />
                Help & Guides
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Everything you need to know about WhatsApp bulk messaging, templates, and more
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/whatsapp/guide/download?format=pdf"
                download="WhatsApp-Bulk-Messaging-Guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-colors"
                data-testid="btn-download-pdf"
              >
                <FileText className="h-4 w-4" />
                Download PDF
              </a>
              <a
                href="/api/whatsapp/guide/download?format=docx"
                download="WhatsApp-Bulk-Messaging-Guide.docx"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/30 transition-colors"
                data-testid="btn-download-docx"
              >
                <FileText className="h-4 w-4" />
                Download Word
              </a>
            </div>
          </div>

          {guideData?.videos && guideData.videos.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-4 md:p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" data-testid="heading-video-tutorials">
                  <Play className="h-5 w-5 text-green-600" />
                  Video Tutorials
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {guideData.videos.map((vid) => (
                    <div key={vid.type} className="border rounded-lg overflow-hidden bg-muted/20">
                      <video
                        controls
                        preload="metadata"
                        playsInline
                        className="w-full aspect-video bg-black"
                        data-testid={`video-${vid.type}`}
                      >
                        <source
                          src={`/api/whatsapp/guide/video?type=${vid.type}`}
                          type="video/mp4"
                        />
                        Your browser does not support the video tag.
                      </video>
                      <div className="p-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{vid.label}</span>
                        <a
                          href={`/api/whatsapp/guide/video?type=${vid.type}&download=true`}
                          download={vid.type === "template" ? "How-to-Create-WhatsApp-Templates.mp4" : "How-to-Send-Bulk-Messages.mp4"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-muted transition-colors text-muted-foreground"
                          data-testid={`btn-download-video-${vid.type}`}
                        >
                          <Download className="h-4 w-4" />
                          Save
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-64 shrink-0">
              <Card className="lg:sticky lg:top-4">
                <CardContent className="p-3">
                  <button
                    onClick={() => setTocOpen(!tocOpen)}
                    className="flex items-center gap-1.5 w-full text-sm font-semibold text-foreground mb-2"
                    data-testid="btn-toggle-toc"
                  >
                    {tocOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Table of Contents
                  </button>
                  {tocOpen && (
                    <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto" data-testid="nav-toc">
                      {toc.filter(t => t.level <= 2).map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-xs py-1 px-2 rounded transition-colors truncate ${
                            item.level === 1 ? "font-semibold" : "ml-2"
                          } ${
                            activeSection === item.id
                              ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                          data-testid={`toc-${item.id}`}
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 min-w-0" ref={contentRef}>
              <Card>
                <CardContent className="p-4 md:p-8">
                  {isLoading ? (
                    <div className="space-y-4" data-testid="loading-skeleton">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-6 bg-muted rounded w-1/3 mb-3" />
                          <div className="h-4 bg-muted rounded w-full mb-2" />
                          <div className="h-4 bg-muted rounded w-4/5 mb-2" />
                          <div className="h-4 bg-muted rounded w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : guideData?.markdown ? (
                    <div data-testid="guide-content">
                      <MarkdownRenderer
                        markdown={guideData.markdown}
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">Failed to load guide content.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
            data-testid="btn-back-to-top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </main>
    </div>
  );
}

import type { ComplianceSettings } from "@shared/schema";

export interface ComplianceCheck {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  suggestions: string[];
  autoFixedContent?: string;
}

export interface ComplianceIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  field?: string;
}

export interface ContentToCheck {
  content: string;
  platform: string;
  postType?: string;
  hasMedia?: boolean;
  hasVideo?: boolean;
  mediaHasBrokerage?: boolean;
  videoHasBrokerageSpoken?: boolean;
}

const DEFAULT_BROKERAGE_NAME = "BHHS Ambassador Real Estate";
const DEFAULT_BROKERAGE_SHORT = "BHHS Ambassador";

const PROHIBITED_TERMS_FOR_NON_BROKERS = [
  "broker",
  "brokerage owner",
  "principal broker",
];

const ADVERTISING_INDICATORS = [
  "just listed",
  "just sold",
  "open house",
  "for sale",
  "price reduced",
  "new listing",
  "coming soon",
  "pending",
  "under contract",
  "sold!",
  "featured property",
  "dream home",
  "call me",
  "contact me",
  "dm me",
  "reach out",
  "schedule a showing",
  "home buyer",
  "home seller",
  "real estate",
  "property tour",
  "market update",
  "mortgage",
  "investment property",
  "first time buyer",
];

export class ComplianceService {
  private settings: ComplianceSettings | null = null;

  constructor(settings?: ComplianceSettings) {
    this.settings = settings || null;
  }

  setSettings(settings: ComplianceSettings) {
    this.settings = settings;
  }

  getBrokerageName(): string {
    return this.settings?.brokerageName || DEFAULT_BROKERAGE_NAME;
  }

  getBrokerageShortName(): string {
    return this.settings?.brokerageShortName || DEFAULT_BROKERAGE_SHORT;
  }

  isAdvertisingContent(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return ADVERTISING_INDICATORS.some((indicator) =>
      lowerContent.includes(indicator.toLowerCase())
    );
  }

  checkBrokerageInFirstLine(content: string): boolean {
    const lines = content.split("\n");
    const firstLine = lines[0]?.toLowerCase() || "";
    const brokerageName = this.getBrokerageName().toLowerCase();
    const shortName = this.getBrokerageShortName().toLowerCase();

    return (
      firstLine.includes(brokerageName) ||
      firstLine.includes(shortName) ||
      firstLine.includes("bhhs") ||
      firstLine.includes("berkshire")
    );
  }

  checkBrokerageAnywhere(content: string): boolean {
    const lowerContent = content.toLowerCase();
    const brokerageName = this.getBrokerageName().toLowerCase();
    const shortName = this.getBrokerageShortName().toLowerCase();

    return (
      lowerContent.includes(brokerageName) ||
      lowerContent.includes(shortName) ||
      lowerContent.includes("bhhs ambassador") ||
      lowerContent.includes("berkshire hathaway")
    );
  }

  checkProhibitedTerms(content: string, licenseType: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];
    const lowerContent = content.toLowerCase();

    if (licenseType !== "broker") {
      for (const term of PROHIBITED_TERMS_FOR_NON_BROKERS) {
        if (lowerContent.includes(term.toLowerCase())) {
          issues.push({
            type: "error",
            code: "PROHIBITED_TERM",
            message: `Use of "${term}" is not allowed unless you are licensed as a broker`,
            field: "content",
          });
        }
      }
    }

    return issues;
  }

  checkContent(data: ContentToCheck): ComplianceCheck {
    const issues: ComplianceIssue[] = [];
    const suggestions: string[] = [];
    const isEnabled = this.settings?.isEnabled !== false;

    if (!isEnabled) {
      return { isCompliant: true, issues: [], suggestions: [] };
    }

    const isAdvertising = this.isAdvertisingContent(data.content);
    const hasBrokerageAnywhere = this.checkBrokerageAnywhere(data.content);
    const hasBrokerageInFirstLine = this.checkBrokerageInFirstLine(data.content);

    if (isAdvertising) {
      if (!hasBrokerageAnywhere) {
        issues.push({
          type: "error",
          code: "MISSING_BROKERAGE",
          message: "Advertising content must include brokerage name",
          field: "content",
        });
        suggestions.push(
          `Add "${this.getBrokerageName()}" to your post`
        );
      } else if (!hasBrokerageInFirstLine) {
        issues.push({
          type: "warning",
          code: "BROKERAGE_NOT_FIRST_LINE",
          message:
            "Brokerage name should be in the first line of the caption for compliance",
          field: "content",
        });
        suggestions.push(
          `Move "${this.getBrokerageName()}" to the first line`
        );
      }

      if (data.hasMedia && !data.mediaHasBrokerage) {
        issues.push({
          type: "warning",
          code: "MEDIA_MISSING_BROKERAGE",
          message:
            "Images/graphics should include brokerage logo or watermark",
          field: "media",
        });
        suggestions.push(
          "Add brokerage logo watermark to your image"
        );
      }

      if (data.hasVideo) {
        if (!data.videoHasBrokerageSpoken && !hasBrokerageInFirstLine) {
          issues.push({
            type: "warning",
            code: "VIDEO_MISSING_BROKERAGE",
            message:
              "Video content should include brokerage name spoken within first 3 seconds OR shown visually at start",
            field: "video",
          });
          suggestions.push(
            "Add brokerage name to video intro or mention it in first 3 seconds"
          );
        }
      }
    }

    const licenseType = this.settings?.licenseType || "agent";
    const prohibitedTermIssues = this.checkProhibitedTerms(
      data.content,
      licenseType
    );
    issues.push(...prohibitedTermIssues);

    const hasErrors = issues.some((i) => i.type === "error");
    const autoFixedContent = this.autoFixContent(data.content);

    return {
      isCompliant: !hasErrors,
      issues,
      suggestions,
      autoFixedContent:
        autoFixedContent !== data.content ? autoFixedContent : undefined,
    };
  }

  autoFixContent(content: string): string {
    if (!this.settings?.autoAddBrokerage) {
      return content;
    }

    const isAdvertising = this.isAdvertisingContent(content);
    if (!isAdvertising) {
      return content;
    }

    const hasBrokerageInFirstLine = this.checkBrokerageInFirstLine(content);
    if (hasBrokerageInFirstLine) {
      return content;
    }

    const hasBrokerageAnywhere = this.checkBrokerageAnywhere(content);
    const brokerageName = this.getBrokerageName();

    if (!hasBrokerageAnywhere) {
      return `${brokerageName}\n\n${content}`;
    }

    const lines = content.split("\n");
    const firstLine = lines[0];
    
    const brokerageVariants = [
      this.getBrokerageName(),
      this.getBrokerageShortName(),
      "BHHS Ambassador Real Estate",
      "BHHS Ambassador",
      "Berkshire Hathaway HomeServices",
    ];

    let brokerageFound = "";
    let lineWithBrokerage = -1;

    for (let i = 0; i < lines.length; i++) {
      for (const variant of brokerageVariants) {
        if (lines[i].toLowerCase().includes(variant.toLowerCase())) {
          brokerageFound = variant;
          lineWithBrokerage = i;
          break;
        }
      }
      if (brokerageFound) break;
    }

    if (lineWithBrokerage > 0 && brokerageFound) {
      lines.splice(lineWithBrokerage, 1);
      return `${brokerageName}\n${lines.join("\n")}`;
    }

    return `${brokerageName} | ${firstLine}\n${lines.slice(1).join("\n")}`;
  }

  generateCompliancePrefix(platform: string): string {
    const brokerageName = this.getBrokerageName();
    
    switch (platform.toLowerCase()) {
      case "x":
      case "twitter":
        return `${this.getBrokerageShortName()} | `;
      case "instagram":
        return `📍 ${brokerageName}\n\n`;
      case "facebook":
        return `🏠 ${brokerageName}\n\n`;
      case "linkedin":
        return `${brokerageName}\n\n`;
      default:
        return `${brokerageName}\n\n`;
    }
  }

  makeCompliant(content: string, platform: string): string {
    const isAdvertising = this.isAdvertisingContent(content);
    if (!isAdvertising) {
      return content;
    }

    const hasBrokerageInFirstLine = this.checkBrokerageInFirstLine(content);
    if (hasBrokerageInFirstLine) {
      return content;
    }

    const prefix = this.generateCompliancePrefix(platform);
    return prefix + content;
  }

  getComplianceGuidelines(): string[] {
    return [
      `"${this.getBrokerageName()}" must be visible on the first screen`,
      `"${this.getBrokerageName()}" must be in the first line of caption/text`,
      "Brokerage name must be adjacent to and equal or larger than agent/team name on printed materials",
      "Video content must include visual brokerage name at start OR spoken within first 3 seconds",
      'Do not use "broker" in title unless licensed as one',
      "All advertising content requires prominent brokerage display",
    ];
  }

  getQuickComplianceQuestions(): { question: string; yesAnswer: string }[] {
    return [
      {
        question: "Does this promote me as an agent?",
        yesAnswer: "Brokerage must be prominent",
      },
      {
        question: "Does this promote a property?",
        yesAnswer: "Brokerage must be prominent",
      },
      {
        question:
          "Does this promote my services or educate potential clients?",
        yesAnswer: "Brokerage must be prominent",
      },
    ];
  }

  static getDefaultSettings(): Partial<ComplianceSettings> {
    return {
      brokerageName: DEFAULT_BROKERAGE_NAME,
      brokerageShortName: DEFAULT_BROKERAGE_SHORT,
      licenseType: "agent",
      requireBrokerageInFirstLine: true,
      requireBrokerageOnMedia: true,
      requireBrokerageInVideo: true,
      autoAddBrokerage: true,
      isEnabled: true,
    };
  }
}

export const complianceService = new ComplianceService();

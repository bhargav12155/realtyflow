import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Wand2, 
  ChevronDown,
  Shield,
  Building2,
  HelpCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ComplianceIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  field?: string;
}

interface ComplianceCheckResult {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  suggestions: string[];
  autoFixedContent?: string;
}

interface ComplianceGuidelines {
  guidelines: string[];
  quickQuestions: { question: string; yesAnswer: string }[];
  brokerageName: string;
}

interface ComplianceCheckerProps {
  content: string;
  platform: string;
  hasMedia?: boolean;
  hasVideo?: boolean;
  onContentFix?: (fixedContent: string) => void;
  showGuidelines?: boolean;
  className?: string;
}

export function ComplianceChecker({
  content,
  platform,
  hasMedia = false,
  hasVideo = false,
  onContentFix,
  showGuidelines = true,
  className = "",
}: ComplianceCheckerProps) {
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [localResult, setLocalResult] = useState<ComplianceCheckResult | null>(null);

  const { data: guidelines } = useQuery<ComplianceGuidelines>({
    queryKey: ["/api/compliance/guidelines"],
    staleTime: 1000 * 60 * 10,
  });

  const checkMutation = useMutation({
    mutationFn: async (data: { content: string; platform: string; hasMedia: boolean; hasVideo: boolean }) => {
      const response = await apiRequest("POST", "/api/compliance/check", data);
      return response.json();
    },
    onSuccess: (data) => {
      setLocalResult(data);
    },
  });

  const fixMutation = useMutation({
    mutationFn: async (data: { content: string; platform: string }) => {
      const response = await apiRequest("POST", "/api/compliance/fix", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.wasModified && onContentFix) {
        onContentFix(data.fixed);
      }
    },
  });

  // Properly debounced compliance check - doesn't block typing
  useEffect(() => {
    if (!content || content.trim().length <= 10) {
      setLocalResult(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkMutation.mutate({ content, platform, hasMedia, hasVideo });
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [content, platform, hasMedia, hasVideo]);

  const handleAutoFix = () => {
    if (content) {
      fixMutation.mutate({ content, platform });
    }
  };

  const result = localResult;
  const hasErrors = result?.issues.some((i) => i.type === "error");
  const hasWarnings = result?.issues.some((i) => i.type === "warning");

  return (
    <div className={`space-y-3 ${className}`} data-testid="compliance-checker">
      {result && (
        <Card className={`border-l-4 ${
          hasErrors 
            ? "border-l-red-500 bg-red-50 dark:bg-red-950/20" 
            : hasWarnings 
              ? "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" 
              : "border-l-green-500 bg-green-50 dark:bg-green-950/20"
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>BHHS Compliance Check</span>
              </div>
              <Badge 
                variant={hasErrors ? "destructive" : "default"}
                className={hasErrors ? "" : hasWarnings ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-500 hover:bg-green-600"}
                data-testid="compliance-status-badge"
              >
                {hasErrors ? "Non-Compliant" : hasWarnings ? "Needs Review" : "Compliant"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.issues.length > 0 && (
              <div className="space-y-2">
                {result.issues.map((issue, index) => (
                  <Alert 
                    key={index} 
                    variant={issue.type === "error" ? "destructive" : "default"}
                    className={issue.type === "warning" ? "border-yellow-500 text-yellow-800 dark:text-yellow-200" : ""}
                    data-testid={`compliance-issue-${index}`}
                  >
                    {issue.type === "error" ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription className="text-sm">
                      {issue.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {result.suggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  {result.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {(hasErrors || hasWarnings) && onContentFix && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoFix}
                disabled={fixMutation.isPending}
                className="w-full"
                data-testid="button-auto-fix-compliance"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {fixMutation.isPending ? "Fixing..." : "Auto-Fix Compliance"}
              </Button>
            )}

            {result.isCompliant && !hasWarnings && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Content meets BHHS compliance requirements</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showGuidelines && guidelines && (
        <Collapsible open={isGuidelinesOpen} onOpenChange={setIsGuidelinesOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between"
              data-testid="button-toggle-guidelines"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">BHHS Ambassador Compliance Guidelines</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isGuidelinesOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="pt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Requirements
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    {guidelines.guidelines.map((guideline, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{guideline}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Quick Compliance Check
                  </h4>
                  <div className="space-y-2">
                    {guidelines.quickQuestions.map((q, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs p-2 rounded bg-muted/50 cursor-help">
                              {q.question}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">If yes: {q.yesAnswer}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function ComplianceStatusBadge({ 
  content, 
  platform,
  className = "" 
}: { 
  content: string; 
  platform: string;
  className?: string;
}) {
  const [result, setResult] = useState<ComplianceCheckResult | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (data: { content: string; platform: string; hasMedia: boolean; hasVideo: boolean }) => {
      const response = await apiRequest("POST", "/api/compliance/check", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  useEffect(() => {
    if (content && content.trim().length > 10) {
      const timeoutId = setTimeout(() => {
        checkMutation.mutate({ content, platform, hasMedia: false, hasVideo: false });
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [content, platform]);

  if (!result) return null;

  const hasErrors = result.issues.some((i) => i.type === "error");
  const hasWarnings = result.issues.some((i) => i.type === "warning");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={hasErrors ? "destructive" : hasWarnings ? "secondary" : "default"}
            className={`${hasErrors ? "" : hasWarnings ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-500 hover:bg-green-600"} ${className}`}
            data-testid="compliance-mini-badge"
          >
            <Shield className="h-3 w-3 mr-1" />
            {hasErrors ? "!" : hasWarnings ? "?" : "✓"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {hasErrors 
              ? "Non-compliant: " + result.issues.filter(i => i.type === "error")[0]?.message
              : hasWarnings 
                ? "Review needed: " + result.issues.filter(i => i.type === "warning")[0]?.message
                : "Compliant with BHHS guidelines"
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

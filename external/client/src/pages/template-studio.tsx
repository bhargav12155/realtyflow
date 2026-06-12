import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sidebar } from "@/components/layout/sidebar";
import UserMenu from "@/components/UserMenu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Home, 
  Calendar, 
  TrendingUp, 
  User, 
  MapPin, 
  Play, 
  Eye, 
  FileText,
  Sparkles,
  ChevronRight,
  Clock,
  Video,
  CheckCircle2,
  Loader2,
  Wand2
} from "lucide-react";
import { useLocation } from "wouter";
import { useBusinessType } from "@/lib/businessContext";
import type { BusinessType } from "@/lib/businessContext";

const TEMPLATE_OVERRIDES: Record<string, Partial<Record<BusinessType, { name: string; description: string }>>> = {
  "just-listed": {
    restaurant: { name: "New Menu Item Launch", description: "Announce an exciting new dish or drink with style and energy" },
    home_services: { name: "New Service Launch", description: "Announce a new service offering to attract more customers" },
    retail: { name: "New Product Launch", description: "Introduce a new product and generate excitement with customers" },
    professional_services: { name: "New Service Offer", description: "Announce a new specialty or service area to grow your practice" },
    general: { name: "New Offering Launch", description: "Announce something new and exciting to your customers" },
  },
  "open-house-invitation": {
    restaurant: { name: "Special Event / Tasting", description: "Invite customers to a special event, tasting night, or promotion" },
    home_services: { name: "Free Estimate Event", description: "Invite prospects to a complimentary estimate or consultation event" },
    retail: { name: "Sale Event Invitation", description: "Invite customers to your upcoming sale, pop-up, or in-store event" },
    professional_services: { name: "Free Consultation Offer", description: "Invite prospects to a complimentary consultation session" },
    general: { name: "Upcoming Event", description: "Invite your audience to an upcoming event or promotion" },
  },
  "market-update": {
    restaurant: { name: "Menu Refresh Update", description: "Share news about updated menus, seasonal specials, or new offerings" },
    home_services: { name: "Industry Trends Update", description: "Share insights and trends relevant to your service area" },
    retail: { name: "New Collection Update", description: "Showcase your newest products, collections, or seasonal arrivals" },
    professional_services: { name: "Industry Insights", description: "Share expertise and current trends in your professional field" },
    general: { name: "Business Update", description: "Keep your audience informed about what's new with your business" },
  },
  "agent-introduction": {
    restaurant: { name: "Meet the Team / Chef", description: "Introduce yourself, your chef, or your team to build connection" },
    home_services: { name: "Meet the Expert", description: "Introduce yourself and your expertise to earn customer trust" },
    retail: { name: "Brand Story", description: "Tell your brand story and build a personal connection with customers" },
    professional_services: { name: "Meet the Professional", description: "Introduce yourself and build credibility with potential clients" },
    general: { name: "Business Introduction", description: "Introduce yourself or your business to your audience" },
  },
  "neighborhood-spotlight": {
    restaurant: { name: "Local Community Spotlight", description: "Highlight a local event, partnership, or community involvement" },
    home_services: { name: "Service Area Spotlight", description: "Highlight a local area or neighborhood you proudly serve" },
    retail: { name: "Community Connection", description: "Connect with your local community and showcase your roots" },
    professional_services: { name: "Community Involvement", description: "Share how you give back and stay engaged with your community" },
    general: { name: "Community Spotlight", description: "Highlight your local community and the connections you value" },
  },
};

const PAGE_SUBTITLE: Partial<Record<BusinessType, string>> = {
  real_estate: "Create professional real estate videos using pre-built templates",
  restaurant: "Create professional restaurant & food videos using pre-built templates",
  home_services: "Create professional service business videos using pre-built templates",
  retail: "Create professional retail & product videos using pre-built templates",
  professional_services: "Create professional service videos using pre-built templates",
  general: "Create professional business videos using pre-built templates",
};

interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  placeholder?: string | null;
  helperText?: string | null;
  required: boolean;
  options?: string[] | null;
  defaultValue?: string | null;
  orderIndex: number;
}

interface VideoTemplate {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  scriptTemplate: string;
  defaultAvatarId?: string | null;
  defaultVoiceId?: string | null;
  thumbnailUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface VideoTemplateWithVariables extends VideoTemplate {
  variables: TemplateVariable[];
}

interface GeneratedVideo {
  id: string;
  userId: string;
  templateId?: string | null;
  templateName: string;
  title: string;
  generatedScript: string;
  status: string;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, typeof Home> = {
  property: Home,
  market: TrendingUp,
  personal: User,
  community: MapPin,
};

const CATEGORY_COLORS: Record<string, string> = {
  property: "bg-blue-500/10 text-blue-600 border-blue-200",
  market: "bg-green-500/10 text-green-600 border-green-200",
  personal: "bg-purple-500/10 text-purple-600 border-purple-200",
  community: "bg-orange-500/10 text-orange-600 border-orange-200",
};

function TemplateCard({ template, onClick }: { template: VideoTemplate; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[template.category] || FileText;
  const colorClass = CATEGORY_COLORS[template.category] || "bg-gray-500/10 text-gray-600";
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group"
      onClick={onClick}
      data-testid={`template-card-${template.slug}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-lg ${colorClass} border`}>
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="capitalize text-xs">
            {template.category}
          </Badge>
        </div>
        <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors">
          {template.name}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardFooter className="pt-0">
        <Button variant="ghost" className="w-full group-hover:bg-primary/5">
          Use Template
          <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function VariableFormField({ variable, form }: { variable: TemplateVariable; form: any }) {
  const fieldName = `variables.${variable.key}`;
  
  return (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            {variable.label}
            {variable.required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            {variable.fieldType === "rich_text" ? (
              <Textarea 
                {...field} 
                placeholder={variable.placeholder || ""}
                className="min-h-[80px]"
                data-testid={`input-${variable.key}`}
              />
            ) : variable.fieldType === "date" ? (
              <Input 
                {...field} 
                type="text"
                placeholder={variable.placeholder || "e.g., Saturday, December 14th"}
                data-testid={`input-${variable.key}`}
              />
            ) : variable.fieldType === "number" ? (
              <Input 
                {...field} 
                type="number"
                placeholder={variable.placeholder || ""}
                data-testid={`input-${variable.key}`}
              />
            ) : (
              <Input 
                {...field} 
                placeholder={variable.placeholder || ""}
                data-testid={`input-${variable.key}`}
              />
            )}
          </FormControl>
          {variable.helperText && (
            <FormDescription>{variable.helperText}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TemplateDetailModal({ 
  template, 
  isOpen, 
  onClose,
  isLoading = false,
  isError = false,
  onRetry
}: { 
  template: VideoTemplateWithVariables | null; 
  isOpen: boolean; 
  onClose: () => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [generatedScript, setGeneratedScript] = useState<string>("");
  
  const hasVariables = template?.variables && template.variables.length > 0;
  
  const buildFormSchema = () => {
    if (!template?.variables || template.variables.length === 0) {
      return z.object({ 
        variables: z.object({}),
        title: z.string().optional(),
      });
    }
    
    const variableSchema: Record<string, z.ZodTypeAny> = {};
    template.variables.forEach((v) => {
      let fieldSchema: z.ZodTypeAny = z.string();
      if (v.required) {
        fieldSchema = z.string().min(1, `${v.label} is required`);
      } else {
        fieldSchema = z.string().optional().default("");
      }
      variableSchema[v.key] = fieldSchema;
    });
    
    return z.object({
      variables: z.object(variableSchema),
      title: z.string().optional(),
    });
  };
  
  const buildDefaultValues = () => {
    const defaults: Record<string, string> = {};
    if (template?.variables) {
      template.variables.forEach((v) => {
        defaults[v.key] = v.defaultValue || "";
      });
    }
    return { variables: defaults, title: "" };
  };
  
  const form = useForm({
    resolver: zodResolver(buildFormSchema()),
    defaultValues: buildDefaultValues(),
    mode: "onChange",
  });
  
  useEffect(() => {
    if (hasVariables) {
      form.reset(buildDefaultValues());
    }
  }, [template?.id, hasVariables]);
  
  const previewMutation = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      const response = await apiRequest("POST", `/api/video-templates/${template?.id}/preview`, { variables });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      setActiveTab("preview");
    },
    onError: () => {
      toast({
        title: "Preview Failed",
        description: "Could not generate script preview",
        variant: "destructive",
      });
    },
  });
  
  const generateMutation = useMutation({
    mutationFn: async (data: { variables: Record<string, string>; title?: string }) => {
      const response = await apiRequest("POST", `/api/video-templates/${template?.id}/generate`, {
        variables: data.variables,
        title: data.title || `${template?.name} - ${new Date().toLocaleDateString()}`,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Script Generated!",
        description: "Your video script has been created and saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generated-videos"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not create video script",
        variant: "destructive",
      });
    },
  });
  
  const handlePreview = () => {
    const values = form.getValues();
    previewMutation.mutate(values.variables);
  };
  
  const handleGenerate = () => {
    const values = form.getValues();
    generateMutation.mutate(values);
  };
  
  if (!template) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "form" | "preview")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form" data-testid="tab-form">
              <FileText className="mr-2 h-4 w-4" />
              Fill Details
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-preview">
              <Eye className="mr-2 h-4 w-4" />
              Preview Script
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="form" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {isError ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-destructive font-medium mb-2">Failed to load template details</p>
                  <p className="text-muted-foreground text-sm mb-4">Please try again.</p>
                  {onRetry && (
                    <Button variant="outline" size="sm" onClick={onRetry}>
                      Retry
                    </Button>
                  )}
                </div>
              ) : !hasVariables ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading template details...</p>
                </div>
              ) : (
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video Title (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder={`${template.name} - ${new Date().toLocaleDateString()}`}
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormDescription>Give your video a custom title</FormDescription>
                        </FormItem>
                      )}
                    />
                    
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Template Variables
                      </h4>
                      <div className="space-y-4">
                        {template.variables.map((variable) => (
                          <VariableFormField key={variable.id} variable={variable} form={form} />
                        ))}
                      </div>
                    </div>
                  </form>
                </Form>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="preview" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {generatedScript ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 border">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Generated Script
                    </h4>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {generatedScript}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Script preview generated. Click "Create Video Script" to save.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Eye className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center">
                    Fill in the template variables and click "Preview Script" to see your generated content.
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          {activeTab === "form" ? (
            <Button 
              onClick={handlePreview} 
              disabled={previewMutation.isPending || !hasVariables}
              data-testid="button-preview"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Script
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleGenerate} 
              disabled={generateMutation.isPending || !hasVariables}
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Video Script
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GeneratedVideoCard({ video }: { video: GeneratedVideo }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showScript, setShowScript] = useState(false);
  
  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    processing: "bg-blue-500/10 text-blue-600 border-blue-200",
    completed: "bg-green-500/10 text-green-600 border-green-200",
    failed: "bg-red-500/10 text-red-600 border-red-200",
  };
  
  const handleCreateVideo = () => {
    localStorage.setItem("templateScript", video.generatedScript);
    localStorage.setItem("templateTitle", video.title);
    toast({
      title: "Script Ready",
      description: "Opening Avatar Studio with your script...",
    });
    navigate("/dashboard#video-generation");
  };
  
  return (
    <>
      <Card className="hover:shadow-md transition-shadow" data-testid={`generated-video-${video.id}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{video.title}</CardTitle>
            <Badge variant="outline" className={`capitalize text-xs ${statusColors[video.status] || ""}`}>
              {video.status}
            </Badge>
          </div>
          <CardDescription className="text-xs flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {new Date(video.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {video.generatedScript.substring(0, 100)}...
          </p>
        </CardContent>
        <CardFooter className="pt-0 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowScript(true)} data-testid={`button-view-script-${video.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button 
            size="sm" 
            onClick={handleCreateVideo}
            className="flex-1 bg-primary hover:bg-primary/90"
            data-testid={`button-create-video-${video.id}`}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Create Video
          </Button>
        </CardFooter>
      </Card>
      
      <Dialog open={showScript} onOpenChange={setShowScript}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{video.title}</DialogTitle>
            <DialogDescription>Generated script from template</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm">{video.generatedScript}</pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScript(false)}>Close</Button>
            <Button onClick={handleCreateVideo}>
              <Wand2 className="mr-2 h-4 w-4" />
              Create Video with Avatar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TemplateStudioPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplateWithVariables | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { businessType } = useBusinessType();
  const isRealEstate = businessType === "real_estate";

  const applyOverride = (template: VideoTemplate): VideoTemplate => {
    if (isRealEstate) return template;
    const override = TEMPLATE_OVERRIDES[template.slug]?.[businessType as BusinessType];
    if (!override) return template;
    return { ...template, name: override.name, description: override.description };
  };

  const templatesQuery = useQuery<VideoTemplate[]>({
    queryKey: ["/api/video-templates"],
  });
  
  const generatedVideosQuery = useQuery<GeneratedVideo[]>({
    queryKey: ["/api/generated-videos"],
  });
  
  const templateDetailQuery = useQuery<VideoTemplateWithVariables>({
    queryKey: ["/api/video-templates", selectedTemplate?.id],
    enabled: !!selectedTemplate?.id && isModalOpen,
  });
  
  const handleTemplateClick = async (template: VideoTemplate) => {
    setSelectedTemplate(template as VideoTemplateWithVariables);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTemplate(null);
  };
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView="templates" />
      
      <main className="flex-1 overflow-auto">
        <header className="bg-card border-b border-border px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Video Template Studio
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden md:block">
                {PAGE_SUBTITLE[businessType as BusinessType] ?? PAGE_SUBTITLE.general}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <UserMenu />
            </div>
          </div>
        </header>
        
        <div className="p-3 sm:p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Choose a Template
            </h2>
            
            {templatesQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <Skeleton className="h-5 w-3/4 mt-3" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardFooter>
                      <Skeleton className="h-9 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : templatesQuery.isError ? (
              <Card className="p-8 text-center border-destructive/50 bg-destructive/5">
                <FileText className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-destructive font-medium mb-2">Failed to load templates</p>
                <p className="text-muted-foreground text-sm mb-4">
                  There was an error loading templates. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => templatesQuery.refetch()}
                >
                  Retry
                </Button>
              </Card>
            ) : templatesQuery.data?.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No templates available yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templatesQuery.data?.map((template) => (
                  <TemplateCard 
                    key={template.id} 
                    template={applyOverride(template)} 
                    onClick={() => handleTemplateClick(template)}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Video className="h-5 w-5" />
              Your Generated Scripts
            </h2>
            
            {generatedVideosQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : generatedVideosQuery.isError ? (
              <Card className="p-8 text-center border-destructive/50 bg-destructive/5">
                <Video className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-destructive font-medium mb-2">Failed to load generated scripts</p>
                <p className="text-muted-foreground text-sm mb-4">
                  There was an error loading your scripts. Please try again.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => generatedVideosQuery.refetch()}
                >
                  Retry
                </Button>
              </Card>
            ) : generatedVideosQuery.data?.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No generated scripts yet. Choose a template above to get started!
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedVideosQuery.data?.map((video) => (
                  <GeneratedVideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      <TemplateDetailModal
        template={templateDetailQuery.data || selectedTemplate}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isLoading={templateDetailQuery.isLoading}
        isError={templateDetailQuery.isError}
        onRetry={() => templateDetailQuery.refetch()}
      />
    </div>
  );
}

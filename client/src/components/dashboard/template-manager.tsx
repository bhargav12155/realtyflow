import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileVideo, Plus, Copy, Trash2, Edit, Play, Loader2, Home, TrendingUp, Users, Package, MapPin, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Template {
  template_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  duration: number;
  variables: TemplateVariable[];
  created_at: string;
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'image' | 'video' | 'avatar' | 'voice' | 'background';
  properties: any;
}

interface RealEstateTemplate {
  name: string;
  description: string;
  recommended_variables: Record<string, string>;
}

export function TemplateManager() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Query templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['/api/templates'],
  });

  // Query real estate templates
  const { data: realEstateTemplates, isLoading: isLoadingRealEstate } = useQuery({
    queryKey: ['/api/templates/real-estate'],
  });

  // Generate from template
  const generateMutation = useMutation({
    mutationFn: ({ templateId, variables, title }: any) =>
      apiRequest(`/api/templates/${templateId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ variables, title, test: false })
      }),
    onSuccess: (data) => {
      toast({
        title: "Video Generation Started",
        description: "Your video is being generated. This may take a few minutes.",
      });
      setIsGenerating(false);
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate video from template. Please try again.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  // Create custom template
  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; description: string; elements: any[] }) =>
      apiRequest('/api/templates', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      toast({
        title: "Template Created",
        description: "Your custom template has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      setNewTemplateName('');
      setNewTemplateDescription('');
    }
  });

  // Duplicate template
  const duplicateMutation = useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name: string }) =>
      apiRequest(`/api/templates/${templateId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name })
      }),
    onSuccess: () => {
      toast({
        title: "Template Duplicated",
        description: "Template has been duplicated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    }
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiRequest(`/api/templates/${templateId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
    }
  });

  const handleGenerateFromTemplate = () => {
    if (!selectedTemplate) return;
    
    setIsGenerating(true);
    generateMutation.mutate({
      templateId: selectedTemplate.template_id,
      variables,
      title: `${selectedTemplate.name} - ${new Date().toLocaleString()}`
    });
  };

  const handleVariableChange = (name: string, value: any) => {
    setVariables(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getTemplateIcon = (templateName: string) => {
    const name = templateName.toLowerCase();
    if (name.includes('property') || name.includes('tour')) return <Home className="w-4 h-4" />;
    if (name.includes('market')) return <TrendingUp className="w-4 h-4" />;
    if (name.includes('agent') || name.includes('introduction')) return <Users className="w-4 h-4" />;
    if (name.includes('listing')) return <Package className="w-4 h-4" />;
    if (name.includes('neighborhood')) return <MapPin className="w-4 h-4" />;
    return <FileVideo className="w-4 h-4" />;
  };

  const renderVariableInput = (variable: TemplateVariable) => {
    switch (variable.type) {
      case 'text':
        return (
          <div key={variable.name} className="space-y-2">
            <Label>{variable.name}</Label>
            <Textarea
              value={variables[variable.name] || ''}
              onChange={(e) => handleVariableChange(variable.name, e.target.value)}
              placeholder={`Enter ${variable.name}...`}
              rows={2}
              data-testid={`input-var-${variable.name}`}
            />
          </div>
        );
      
      case 'avatar':
        return (
          <div key={variable.name} className="space-y-2">
            <Label>{variable.name} (Avatar)</Label>
            <Input
              value={variables[variable.name]?.avatarId || ''}
              onChange={(e) => handleVariableChange(variable.name, {
                type: 'avatar',
                avatarId: e.target.value,
                isTalkingPhoto: false
              })}
              placeholder="Enter avatar ID..."
              data-testid={`input-avatar-${variable.name}`}
            />
          </div>
        );
      
      case 'image':
        return (
          <div key={variable.name} className="space-y-2">
            <Label>{variable.name} (Image URL)</Label>
            <Input
              value={variables[variable.name]?.url || ''}
              onChange={(e) => handleVariableChange(variable.name, {
                type: 'image',
                url: e.target.value
              })}
              placeholder="Enter image URL..."
              data-testid={`input-image-${variable.name}`}
            />
          </div>
        );
      
      default:
        return (
          <div key={variable.name} className="space-y-2">
            <Label>{variable.name}</Label>
            <Input
              value={variables[variable.name] || ''}
              onChange={(e) => handleVariableChange(variable.name, e.target.value)}
              placeholder={`Enter ${variable.name}...`}
              data-testid={`input-default-${variable.name}`}
            />
          </div>
        );
    }
  };

  return (
    <Card data-testid="card-template-manager">
      <CardHeader>
        <CardTitle>Video Templates</CardTitle>
        <CardDescription>
          Create videos from pre-designed templates optimized for real estate marketing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="browse">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse" data-testid="tab-browse">
              <FileVideo className="w-4 h-4 mr-2" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="real-estate" data-testid="tab-real-estate">
              <Home className="w-4 h-4 mr-2" />
              Real Estate
            </TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">
              <Plus className="w-4 h-4 mr-2" />
              Create
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4">
            {isLoadingTemplates ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading templates...</p>
              </div>
            ) : templates?.templates?.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No templates available. Create your first template or check the Real Estate tab for suggestions.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {templates?.templates?.map((template: Template) => (
                  <div
                    key={template.template_id}
                    className="border rounded-lg p-4 space-y-3 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedTemplate(template)}
                    data-testid={`card-template-${template.template_id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTemplateIcon(template.name)}
                        <h3 className="font-medium">{template.name}</h3>
                      </div>
                      <Badge variant="outline">
                        {template.duration}s
                      </Badge>
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-gray-600">{template.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{template.variables?.length || 0} variables</span>
                      <span>{new Date(template.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex gap-2 mt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplate(template);
                              setVariables({});
                            }}
                            data-testid={`button-use-${template.template_id}`}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Use
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Generate Video from Template</DialogTitle>
                            <DialogDescription>
                              Fill in the variables to generate your custom video
                            </DialogDescription>
                          </DialogHeader>
                          
                          <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-4">
                              {template.variables?.map(renderVariableInput)}
                            </div>
                          </ScrollArea>
                          
                          <div className="flex gap-2 justify-end mt-4">
                            <Button
                              onClick={handleGenerateFromTemplate}
                              disabled={isGenerating || generateMutation.isPending}
                              data-testid="button-generate-video"
                            >
                              {isGenerating || generateMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Generate Video
                                </>
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateMutation.mutate({
                            templateId: template.template_id,
                            name: `${template.name} (Copy)`
                          });
                        }}
                        data-testid={`button-duplicate-${template.template_id}`}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(template.template_id);
                        }}
                        data-testid={`button-delete-${template.template_id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="real-estate" className="space-y-4">
            {isLoadingRealEstate ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading real estate templates...</p>
              </div>
            ) : realEstateTemplates?.suggestions ? (
              <>
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    These are recommended template structures for real estate videos. 
                    Use these as inspiration to create your own custom templates.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  {realEstateTemplates.suggestions.map((template: RealEstateTemplate, index: number) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 space-y-3"
                      data-testid={`card-suggestion-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        {getTemplateIcon(template.name)}
                        <h3 className="font-medium">{template.name}</h3>
                      </div>
                      
                      <p className="text-sm text-gray-600">{template.description}</p>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Recommended Variables:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(template.recommended_variables).map(([key, type]) => (
                            <Badge key={key} variant="secondary">
                              {key}: {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => {
                          setNewTemplateName(template.name);
                          setNewTemplateDescription(template.description);
                        }}
                        data-testid={`button-create-from-${index}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create from this
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {realEstateTemplates?.templates?.map((template: Template) => (
                  <div
                    key={template.template_id}
                    className="border rounded-lg p-4 space-y-3"
                    data-testid={`card-re-template-${template.template_id}`}
                  >
                    <h3 className="font-medium">{template.name}</h3>
                    <p className="text-sm text-gray-600">{template.description}</p>
                    <Button
                      size="sm"
                      onClick={() => setSelectedTemplate(template)}
                      data-testid={`button-use-re-${template.template_id}`}
                    >
                      Use Template
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                  data-testid="input-template-name"
                />
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for..."
                  rows={3}
                  data-testid="textarea-template-description"
                />
              </div>
              
              <Alert>
                <AlertDescription>
                  Advanced template creation with custom elements and animations coming soon. 
                  For now, templates can be created from existing videos.
                </AlertDescription>
              </Alert>
              
              <Button
                onClick={() => {
                  if (newTemplateName && newTemplateDescription) {
                    createTemplateMutation.mutate({
                      name: newTemplateName,
                      description: newTemplateDescription,
                      elements: []
                    });
                  }
                }}
                disabled={!newTemplateName || !newTemplateDescription || createTemplateMutation.isPending}
                className="w-full"
                data-testid="button-create-template"
              >
                {createTemplateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
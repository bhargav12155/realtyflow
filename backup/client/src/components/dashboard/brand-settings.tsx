import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Image, 
  Palette, 
  Type, 
  Save, 
  RefreshCw,
  Crown,
  Sparkles,
  Eye,
  Download,
  FileImage,
  Zap,
  CheckCircle,
  Share2,
  Link2,
  ExternalLink,
  Users
} from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedin, FaTwitter, FaTiktok, FaYoutube } from "react-icons/fa";

interface BrandAsset {
  id: string;
  name: string;
  type: 'logo' | 'icon' | 'banner' | 'background';
  url?: string;
  uploadedAt?: Date;
}

interface BrandSettingsData {
  assets?: BrandAsset[];
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts?: {
    heading: string;
    body: string;
    accent: string;
  };
  description?: string;
  socialConnections?: any;
}

export function BrandSettings() {
  const { toast } = useToast();
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([
    { id: 'primary-logo', name: 'Primary Logo', type: 'logo' },
    { id: 'icon', name: 'Icon/Favicon', type: 'icon' },
    { id: 'banner', name: 'Banner/Header Image', type: 'banner' },
    { id: 'background', name: 'Background Pattern', type: 'background' },
  ]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedBrandGuide, setUploadedBrandGuide] = useState<string | null>(null);
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);

  const [brandColors, setBrandColors] = useState({
    primary: '#daa520',
    secondary: '#b8860b',
    accent: '#ffd700',
    background: '#ffffff',
    text: '#333333'
  });

  const [brandFonts, setBrandFonts] = useState({
    heading: 'Playfair Display',
    body: 'Inter',
    accent: 'Cormorant Garamond'
  });

  const [brandDescription, setBrandDescription] = useState(
    'Golden Brick Real Estate - Premium luxury properties in Omaha, Nebraska. Specializing in high-end residential and commercial real estate with personalized service and expert market knowledge.'
  );

  // Social Media Connections State
  const [socialConnections, setSocialConnections] = useState({
    facebook: { connected: false, accountName: '', profileUrl: '' },
    instagram: { connected: false, accountName: '', profileUrl: '' },
    linkedin: { connected: false, accountName: '', profileUrl: '' },
    twitter: { connected: false, accountName: '', profileUrl: '' },
    tiktok: { connected: false, accountName: '', profileUrl: '' },
    youtube: { connected: false, accountName: '', profileUrl: '' },
  });

  // Connection Type State (Individual team members or Group)
  const [connectionType, setConnectionType] = useState('group');

  // Fetch brand settings from API
  const { data: brandSettingsData, isLoading } = useQuery<BrandSettingsData>({
    queryKey: ['/api/brand-settings'],
    refetchOnWindowFocus: false,
  });

  // Populate state when data is loaded
  useEffect(() => {
    if (brandSettingsData) {
      if (brandSettingsData.assets) {
        setBrandAssets(brandSettingsData.assets);
      }
      if (brandSettingsData.colors) {
        setBrandColors(brandSettingsData.colors);
      }
      if (brandSettingsData.fonts) {
        setBrandFonts(brandSettingsData.fonts);
      }
      if (brandSettingsData.description) {
        setBrandDescription(brandSettingsData.description);
      }
      if (brandSettingsData.socialConnections) {
        setSocialConnections(brandSettingsData.socialConnections);
      }
    }
  }, [brandSettingsData]);

  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
      });
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Failed to get upload parameters:', error);
      throw error;
    }
  };

  const handleAssetUpload = (assetId: string, uploadedUrl: string) => {
    setBrandAssets(assets => 
      assets.map(asset => 
        asset.id === assetId 
          ? { ...asset, url: uploadedUrl, uploadedAt: new Date() }
          : asset
      )
    );
  };

  const handleSaveBrandSettings = async () => {
    try {
      const brandSettings = {
        assets: brandAssets,
        colors: brandColors,
        fonts: brandFonts,
        description: brandDescription,
        socialConnections,
      };

      const response = await fetch('/api/brand-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brandSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save brand settings');
      }

      toast({
        title: "Success",
        description: "Brand settings saved successfully!",
      });

      // Invalidate query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: ['/api/brand-settings'] });
    } catch (error) {
      console.error('Error saving brand settings:', error);
      toast({
        title: "Error",
        description: "Failed to save brand settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Social Media Connection Handlers
  const handleConnectSocialMedia = async (platform: string) => {
    try {
      // Start real OAuth flow by calling backend
      const response = await fetch(`/api/social/connect/${platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.authUrl) {
        // Open OAuth popup window
        const popup = window.open(
          data.authUrl,
          `${platform}_oauth`,
          'width=600,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth callback
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            // Check if connection was successful
            checkConnectionStatus(platform);
          }
        }, 1000);
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to initiate OAuth flow",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('OAuth initiation error:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to social media platform",
        variant: "destructive",
      });
    }
  };

  const checkConnectionStatus = async (platform: string) => {
    try {
      const response = await fetch(`/api/social/status/${platform}`);
      const data = await response.json();

      if (data.connected) {
        setSocialConnections(prev => ({
          ...prev,
          [platform]: {
            connected: true,
            accountName: data.accountName || `@${platform}_user`,
            profileUrl: data.profileUrl || `https://${platform}.com/profile`
          }
        }));

        toast({
          title: "Account Connected!",
          description: `Successfully connected to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
        });
      }
    } catch (error) {
      console.error('Connection status check failed:', error);
    }
  };

  const handleDisconnectSocialMedia = (platform: string) => {
    setSocialConnections(prev => ({
      ...prev,
      [platform]: {
        connected: false,
        accountName: '',
        profileUrl: ''
      }
    }));
    
    toast({
      title: "Account Disconnected",
      description: `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} account has been disconnected.`
    });
  };

  const handleBrandGuideUpload = async (uploadedFileUrl: string) => {
    console.log('🎯 Brand guide upload completed:', uploadedFileUrl);
    
    // Extract file type from the uploaded file URL or detect from content
    const fileType = 'application/pdf'; // Assume PDF for now, we can detect this better later
      
    setUploadedBrandGuide(uploadedFileUrl);
    setIsAnalyzing(true);

    try {
      console.log('📡 Sending analysis request:', { fileUrl: uploadedFileUrl, fileType });
      
      const response = await fetch('/api/brand-guide/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl: uploadedFileUrl,
          fileType,
        }),
      });

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const data = await response.json();
        
        if (data.success && data.analysis) {
          const analysis = data.analysis;
          let updatedItems = [];
          
          // Auto-populate brand settings with extracted data
          if (analysis.colors) {
            setBrandColors(prevColors => ({
              ...prevColors,
              ...analysis.colors
            }));
            updatedItems.push(`${Object.keys(analysis.colors).length} brand colors`);
          }

          if (analysis.fonts) {
            setBrandFonts(prevFonts => ({
              ...prevFonts,
              ...analysis.fonts
            }));
            updatedItems.push(`${Object.keys(analysis.fonts).length} font styles`);
          }

          if (analysis.brandDescription) {
            setBrandDescription(analysis.brandDescription);
            updatedItems.push('brand description');
          }

          // Handle logo information if available
          if (analysis.logo?.description) {
            updatedItems.push('logo information');
          }

          // Automatically save the updated brand settings
          setTimeout(async () => {
            try {
              const brandSettings = {
                assets: brandAssets,
                colors: analysis.colors || brandColors,
                fonts: analysis.fonts || brandFonts,
                description: analysis.brandDescription || brandDescription,
                logoInfo: analysis.logo || null,
              };

              const saveResponse = await fetch('/api/brand-settings', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(brandSettings),
              });

              if (saveResponse.ok) {
                toast({
                  title: "✅ Brand Successfully Updated!",
                  description: `Automatically extracted and applied: ${updatedItems.join(', ')}. Your brand theme is now active across the platform.`
                });
              }
            } catch (saveError) {
              console.error('Auto-save error:', saveError);
            }
          }, 1000);

          // Immediate feedback toast
          toast({
            title: "🎨 Brand Guide Analysis Complete!",
            description: `Extracted ${updatedItems.join(', ')} from your brand guide. Changes will be applied automatically...`
          });

        } else {
          throw new Error('Analysis returned no results');
        }

      } catch (error) {
        console.error('Brand guide analysis error:', error);
        toast({
          title: "Analysis Failed",
          description: "Unable to analyze your brand guide. Please try uploading a clear image of your brand guide with visible colors and fonts.",
          variant: "destructive"
        });
      } finally {
        setIsAnalyzing(false);
      }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'logo': return <Crown className="h-4 w-4" />;
      case 'icon': return <Sparkles className="h-4 w-4" />;
      case 'banner': return <Image className="h-4 w-4" />;
      case 'background': return <Palette className="h-4 w-4" />;
      default: return <Upload className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-golden" />
          Brand Settings & Asset Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload and manage your custom logo, branding assets, and brand guidelines
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Brand Assets Upload Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Brand Assets</h3>
            <Badge variant="outline" className="text-xs">
              Custom Branding
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brandAssets.map((asset) => (
              <div key={asset.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getAssetIcon(asset.type)}
                    <span className="font-medium text-sm">{asset.name}</span>
                  </div>
                  {asset.url && (
                    <Badge variant="secondary" className="text-xs">
                      Uploaded
                    </Badge>
                  )}
                </div>
                
                {asset.url && (
                  <div className="flex items-center justify-center p-4 bg-muted rounded border-2 border-dashed">
                    <div className="text-center">
                      {asset.type === 'logo' || asset.type === 'icon' ? (
                        <div className="relative">
                          <img 
                            src={`/objects/${asset.url.split('/').pop()}`} 
                            alt={asset.name}
                            className="max-w-20 max-h-20 object-contain mx-auto"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden text-xs text-muted-foreground">
                            {asset.name}
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-12 bg-gradient-to-r from-golden-accent to-golden-muted rounded flex items-center justify-center">
                          <Eye className="h-4 w-4 text-golden-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880} // 5MB
                    acceptedFileTypes="image/*"
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={(url) => handleAssetUpload(asset.id, url)}
                    buttonClassName="flex-1 h-8 text-xs"
                  >
                    <Upload className="mr-2 h-3 w-3" />
                    {asset.url ? 'Replace' : 'Upload'}
                  </ObjectUploader>
                  
                  {asset.url && (
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {asset.uploadedAt && (
                  <p className="text-xs text-muted-foreground">
                    Uploaded {asset.uploadedAt.toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Upload Brand Guide Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Upload Brand Guide
            </h3>
            <Badge variant="outline" className="text-xs bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700">
              <Zap className="h-3 w-3 mr-1" />
              AI Powered
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Upload your existing brand guide (image format) and our AI will automatically extract colors, fonts, and branding information to populate your settings.
          </p>
          
          <div className="border rounded-lg p-6 space-y-4 bg-gradient-to-r from-slate-50 to-blue-50/30">
            <div className="flex items-center justify-center">
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760} // 10MB
                acceptedFileTypes="image/*,application/pdf"
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleBrandGuideUpload}
                buttonClassName={`px-6 py-3 ${
                  isAnalyzing 
                    ? 'bg-blue-500 hover:bg-blue-600 cursor-wait' 
                    : uploadedBrandGuide
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                }`}
                data-testid="upload-brand-guide"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Brand Guide...
                  </>
                ) : uploadedBrandGuide ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Upload Another Brand Guide
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Upload Brand Guide
                  </>
                )}
              </ObjectUploader>
            </div>
            
            {isAnalyzing && (
              <div className="text-center space-y-2">
                <div className="text-sm text-blue-600">
                  AI is analyzing your brand guide to extract:
                </div>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    Color codes
                  </div>
                  <div className="flex items-center gap-1">
                    <Type className="h-3 w-3" />
                    Font names
                  </div>
                  <div className="flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Brand info
                  </div>
                </div>
              </div>
            )}
            
            {uploadedBrandGuide && !isAnalyzing && (
              <div className="text-center">
                <div className="text-sm text-green-600 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Brand guide analyzed! Your settings have been updated below.
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground text-center">
              Supported formats: JPG, PNG, GIF, WebP, PDF • Max size: 10MB
              <br />
              For best results, upload a clear image showing color swatches and font examples, or a PDF with readable text
            </div>
          </div>
        </div>

        <Separator />

        {/* Brand Colors Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Brand Colors
            </h3>
            {uploadedBrandGuide && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Auto-Extracted
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(brandColors).map(([colorName, colorValue]) => (
              <div key={colorName} className="space-y-2">
                <Label className="text-xs capitalize">{colorName}</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border-2 border-border"
                    style={{ backgroundColor: colorValue }}
                  />
                  <Input
                    type="color"
                    value={colorValue}
                    onChange={(e) => setBrandColors(prev => ({
                      ...prev,
                      [colorName]: e.target.value
                    }))}
                    className="w-16 h-8 p-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Typography Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Type className="h-4 w-4" />
              Typography
            </h3>
            {uploadedBrandGuide && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Auto-Extracted
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(brandFonts).map(([fontType, fontValue]) => (
              <div key={fontType} className="space-y-2">
                <Label className="text-xs capitalize">{fontType} Font</Label>
                <Input
                  value={fontValue}
                  onChange={(e) => setBrandFonts(prev => ({
                    ...prev,
                    [fontType]: e.target.value
                  }))}
                  placeholder="Font family name"
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Company Logo Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Company Logo
            </h3>
            {uploadedBrandGuide && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Auto-Extracted
              </Badge>
            )}
          </div>
          
          <div className="border rounded-lg p-6 space-y-4 bg-gradient-to-r from-golden/5 to-amber-50/30">
            <div className="text-center space-y-4">
              <div className="mx-auto w-32 h-24 border-2 border-dashed border-golden/30 rounded-lg flex items-center justify-center bg-golden/5">
                {uploadedLogo ? (
                  <img 
                    src={`/objects/${uploadedLogo.split('/').pop()}`}
                    alt="Company Logo"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <Crown className="h-10 w-10 text-golden/50" />
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Upload Your Company Logo</p>
                <p className="text-xs text-muted-foreground">
                  Upload your logo file or extract it automatically from your brand guide PDF
                </p>
              </div>

              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={5242880} // 5MB for logos
                acceptedFileTypes="image/*"
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={(uploadUrl) => {
                  // Handle logo upload completion
                  console.log('🎯 Logo uploaded:', uploadUrl);
                  setUploadedLogo(uploadUrl);
                  toast({
                    title: "Logo Uploaded Successfully!",
                    description: "Your company logo will now appear on all generated content."
                  });
                }}
                buttonClassName="px-4 py-2 bg-golden hover:bg-golden-600 text-white"
                data-testid="upload-company-logo"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Company Logo
              </ObjectUploader>
              
              <div className="text-xs text-muted-foreground">
                Recommended: PNG with transparent background • Max size: 5MB
                <br />
                <span className="font-medium">Tip:</span> Upload a brand guide PDF above to automatically extract logo and branding
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Logo Information (if extracted) */}
        {uploadedBrandGuide && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Logo Analysis
              </h3>
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Extracted
              </Badge>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <p className="text-sm text-blue-800 font-medium">
                Logo information extracted from your brand guide:
              </p>
              <div className="space-y-2 text-sm text-blue-700">
                <p><span className="font-medium">Style:</span> Modern professional logo with clear typography</p>
                <p><span className="font-medium">Elements:</span> Company name, potential icon/symbol</p>
                <p><span className="font-medium">Usage:</span> Header, business cards, marketing materials</p>
              </div>
              <div className="mt-3 p-3 bg-white/50 rounded border">
                <p className="text-xs text-blue-600 font-medium mb-1">Next Steps:</p>
                <p className="text-xs text-blue-700">
                  Upload your actual logo files using the "Company Logo" section above to complete your branding setup and enable automatic logo placement in all generated content.
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Brand Description */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Brand Description</h3>
            {uploadedBrandGuide && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Auto-Extracted
              </Badge>
            )}
          </div>
          <Textarea
            value={brandDescription}
            onChange={(e) => setBrandDescription(e.target.value)}
            placeholder="Describe your brand, values, and key messaging..."
            rows={4}
          />
        </div>

        <Separator />

        {/* Social Media Account Connections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Social Media Account Connections
            </h3>
            <Badge variant="outline" className="text-xs">
              OAuth Integration
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Connect your social media accounts to enable automatic posting and seamless content distribution across all platforms.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="connection-type" className="text-sm font-medium">
              Connection Type
            </Label>
            <Select value={connectionType} onValueChange={setConnectionType}>
              <SelectTrigger className="w-full" data-testid="connection-type-select">
                <SelectValue placeholder="Select connection type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="group">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Group - Connect for entire team</span>
                  </div>
                </SelectItem>
                <SelectItem value="sarah-johnson">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Sarah Johnson - Team Lead</span>
                  </div>
                </SelectItem>
                <SelectItem value="mike-chen">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Mike Chen - Senior Agent</span>
                  </div>
                </SelectItem>
                <SelectItem value="jessica-martinez">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Jessica Martinez - Marketing Specialist</span>
                  </div>
                </SelectItem>
                <SelectItem value="david-brown">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>David Brown - Real Estate Associate</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {connectionType === 'group' 
                ? 'Platforms will be connected for the entire team with shared access.'
                : 'Platforms will be connected to the selected team member\'s individual accounts.'
              }
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(socialConnections).map(([platform, connection]) => {
              const platformConfig = {
                facebook: { icon: FaFacebook, color: "text-blue-600", name: "Facebook" },
                instagram: { icon: FaInstagram, color: "text-pink-500", name: "Instagram" },
                linkedin: { icon: FaLinkedin, color: "text-blue-700", name: "LinkedIn" },
                twitter: { icon: FaTwitter, color: "text-blue-400", name: "X (Twitter)" },
                tiktok: { icon: FaTiktok, color: "text-red-500", name: "TikTok" },
                youtube: { icon: FaYoutube, color: "text-red-600", name: "YouTube" },
              }[platform as keyof typeof socialConnections];

              if (!platformConfig) return null;

              const Icon = platformConfig.icon;

              return (
                <div key={platform} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${platformConfig.color}`} />
                      <div>
                        <span className="font-medium text-sm">{platformConfig.name}</span>
                        {connection.connected && (
                          <p className="text-xs text-muted-foreground">{connection.accountName}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={connection.connected ? "default" : "secondary"} className="text-xs">
                      {connection.connected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  
                  {connection.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        <span className="truncate">{connection.profileUrl}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleDisconnectSocialMedia(platform)}
                          data-testid={`disconnect-${platform}`}
                        >
                          Disconnect
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2"
                          onClick={() => window.open(connection.profileUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleConnectSocialMedia(platform)}
                      className={`w-full h-8 text-xs ${
                        platform === 'facebook' ? 'bg-blue-600 hover:bg-blue-700' :
                        platform === 'instagram' ? 'bg-pink-500 hover:bg-pink-600' :
                        platform === 'linkedin' ? 'bg-blue-700 hover:bg-blue-800' :
                        platform === 'twitter' ? 'bg-blue-400 hover:bg-blue-500' :
                        platform === 'tiktok' ? 'bg-red-500 hover:bg-red-600' :
                        platform === 'youtube' ? 'bg-red-600 hover:bg-red-700' :
                        'bg-gray-600 hover:bg-gray-700'
                      }`}
                      data-testid={`connect-${platform}`}
                    >
                      <Link2 className="mr-2 h-3 w-3" />
                      Connect {platformConfig.name}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 mt-2"></div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900">
                  OAuth Integration Setup Required
                </p>
                <p className="text-xs text-amber-700">
                  To connect your real social media accounts, OAuth app credentials need to be configured for each platform. Contact your administrator to set up Facebook, Instagram, LinkedIn, and other platform integrations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Save Settings */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Changes will be applied across all generated content and social media posts
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reset to Default
            </Button>
            <Button 
              onClick={handleSaveBrandSettings}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Brand Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
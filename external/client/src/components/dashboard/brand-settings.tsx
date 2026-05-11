import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useToast } from '@/hooks/use-toast';
import { useDemo } from '@/contexts/DemoContext';
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
  Users,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Wand2,
  Settings,
  Check,
  Circle,
  AlertCircle,
  Loader2,
  Brain,
  Key,
  Shield,
  Trash2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const WIZARD_STEPS = [
  { id: 1, label: "Kickoff", description: "Upload brand guide or start fresh", icon: Zap },
  { id: 2, label: "Visual Identity", description: "Colors & typography", icon: Palette },
  { id: 3, label: "Assets & Channels", description: "Logo & social accounts", icon: Image },
  { id: 4, label: "Review & Apply", description: "Finalize your brand", icon: CheckCircle },
];

const FONT_OPTIONS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Playfair Display", "Merriweather", "Cormorant Garamond", "Libre Baskerville",
  "Oswald", "Raleway", "Source Sans Pro", "Nunito", "Work Sans"
];

export function BrandSettings() {
  const { toast } = useToast();
  const { isDemo, demoSocialAccounts } = useDemo();
  const [currentStep, setCurrentStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedBrandGuide, setUploadedBrandGuide] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [brandAssets, setBrandAssets] = useState<BrandAsset[]>([
    { id: 'primary-logo', name: 'Primary Logo', type: 'logo' },
    { id: 'broker-logo', name: 'Broker Logo', type: 'logo' },
    { id: 'icon', name: 'Icon/Favicon', type: 'icon' },
    { id: 'banner', name: 'Banner/Header Image', type: 'banner' },
    { id: 'background', name: 'Background Pattern', type: 'background' },
  ]);

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

  const [socialConnections, setSocialConnections] = useState({
    facebook: { connected: false, accountName: '', profileUrl: '' },
    instagram: { connected: false, accountName: '', profileUrl: '' },
    linkedin: { connected: false, accountName: '', profileUrl: '' },
    twitter: { connected: false, accountName: '', profileUrl: '' },
    tiktok: { connected: false, accountName: '', profileUrl: '' },
    youtube: { connected: false, accountName: '', profileUrl: '' },
  });

  // AI Engine preferences state
  const [selectedAiProvider, setSelectedAiProvider] = useState('platform');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [isSavingAiPrefs, setIsSavingAiPrefs] = useState(false);
  const [isRemovingApiKey, setIsRemovingApiKey] = useState(false);
  
  // Kling API key state
  const [klingApiKeyInput, setKlingApiKeyInput] = useState('');
  const [isSavingKlingKey, setIsSavingKlingKey] = useState(false);
  const [isRemovingKlingKey, setIsRemovingKlingKey] = useState(false);

  const { data: brandSettingsData, isLoading } = useQuery<BrandSettingsData>({
    queryKey: ['/api/brand-settings'],
    refetchOnWindowFocus: false,
  });

  // AI preferences query
  interface AiPreferences {
    aiProvider: string;
    hasCustomApiKey: boolean;
    aiApiKeyMasked: string | null;
    hasKlingApiKey: boolean;
    klingApiKeyMasked: string | null;
    availableProviders: { id: string; name: string; description: string }[];
  }

  const { data: aiPreferences, refetch: refetchAiPrefs } = useQuery<AiPreferences>({
    queryKey: ['/api/ai-preferences'],
    refetchOnWindowFocus: false,
  });

  // Default asset types - used to ensure new asset types appear for existing users
  const defaultAssetTypes: BrandAsset[] = [
    { id: 'primary-logo', name: 'Primary Logo', type: 'logo' },
    { id: 'broker-logo', name: 'Broker Logo', type: 'logo' },
    { id: 'icon', name: 'Icon/Favicon', type: 'icon' },
    { id: 'banner', name: 'Banner/Header Image', type: 'banner' },
    { id: 'background', name: 'Background Pattern', type: 'background' },
  ];

  useEffect(() => {
    if (brandSettingsData) {
      // Merge saved assets with default asset types to include new ones like broker-logo
      if (brandSettingsData.assets) {
        const savedAssets = brandSettingsData.assets;
        const mergedAssets = defaultAssetTypes.map(defaultAsset => {
          const savedAsset = savedAssets.find(a => a.id === defaultAsset.id);
          return savedAsset ? { ...defaultAsset, url: savedAsset.url } : defaultAsset;
        });
        setBrandAssets(mergedAssets);
      }
      if (brandSettingsData.colors) setBrandColors(brandSettingsData.colors);
      if (brandSettingsData.fonts) setBrandFonts(brandSettingsData.fonts);
      if (brandSettingsData.description) setBrandDescription(brandSettingsData.description);
      if (brandSettingsData.socialConnections) setSocialConnections(brandSettingsData.socialConnections);
    }
  }, [brandSettingsData]);

  useEffect(() => {
    if (isDemo && demoSocialAccounts.length > 0) {
      const demoConnections: typeof socialConnections = {
        facebook: { connected: false, accountName: '', profileUrl: '' },
        instagram: { connected: false, accountName: '', profileUrl: '' },
        linkedin: { connected: false, accountName: '', profileUrl: '' },
        twitter: { connected: false, accountName: '', profileUrl: '' },
        tiktok: { connected: false, accountName: '', profileUrl: '' },
        youtube: { connected: false, accountName: '', profileUrl: '' },
      };
      
      demoSocialAccounts.forEach(account => {
        const platform = account.platform === 'x' ? 'twitter' : account.platform;
        if (platform in demoConnections) {
          demoConnections[platform as keyof typeof demoConnections] = {
            connected: account.isConnected,
            accountName: account.accountUsername,
            profileUrl: '',
          };
        }
      });
      
      setSocialConnections(demoConnections);
    }
  }, [isDemo, demoSocialAccounts]);

  // Sync AI preferences when loaded
  useEffect(() => {
    if (aiPreferences) {
      setSelectedAiProvider(aiPreferences.aiProvider);
    }
  }, [aiPreferences]);

  // Save AI preferences handler
  const handleSaveAiPreferences = async () => {
    setIsSavingAiPrefs(true);
    try {
      const response = await fetch('/api/ai-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          aiProvider: selectedAiProvider,
          apiKey: aiApiKeyInput || undefined,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "AI preferences saved",
          description: result.message,
        });
        setAiApiKeyInput(''); // Clear input after save
        refetchAiPrefs();
      } else {
        toast({
          title: "Error saving preferences",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save AI preferences",
        variant: "destructive",
      });
    } finally {
      setIsSavingAiPrefs(false);
    }
  };

  // Remove API key handler
  const handleRemoveApiKey = async () => {
    setIsRemovingApiKey(true);
    try {
      const response = await fetch('/api/ai-preferences/api-key', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "API key removed",
          description: "Your custom API key has been removed",
        });
        refetchAiPrefs();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove API key",
        variant: "destructive",
      });
    } finally {
      setIsRemovingApiKey(false);
    }
  };

  // Save Kling API key handler
  const handleSaveKlingApiKey = async () => {
    if (!klingApiKeyInput) {
      toast({
        title: "Enter API Key",
        description: "Please enter your Kling API key",
        variant: "destructive",
      });
      return;
    }

    setIsSavingKlingKey(true);
    try {
      const response = await fetch('/api/kling-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: klingApiKeyInput,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Kling API key saved",
          description: "Your Kling API key has been securely stored",
        });
        setKlingApiKeyInput('');
        refetchAiPrefs();
      } else {
        toast({
          title: "Error saving key",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Kling API key",
        variant: "destructive",
      });
    } finally {
      setIsSavingKlingKey(false);
    }
  };

  // Remove Kling API key handler
  const handleRemoveKlingApiKey = async () => {
    setIsRemovingKlingKey(true);
    try {
      const response = await fetch('/api/kling-preferences/api-key', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Kling API key removed",
          description: "Your Kling API key has been removed",
        });
        refetchAiPrefs();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove Kling API key",
        variant: "destructive",
      });
    } finally {
      setIsRemovingKlingKey(false);
    }
  };

  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch('/api/objects/upload', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg' }),
        credentials: 'include',
      });
      const data = await response.json();
      return { method: 'PUT' as const, url: data.uploadURL, fileUrl: data.fileUrl };
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
    toast({
      title: "Asset Uploaded",
      description: "Your brand asset has been uploaded successfully.",
    });
  };

  const handleBrandGuideUpload = async (uploadedFileUrl: string) => {
    setUploadedBrandGuide(uploadedFileUrl);
    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/brand-guide/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: uploadedFileUrl, fileType: 'application/pdf' }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      
      if (data.success && data.analysis) {
        const analysis = data.analysis;
        let updatedItems = [];
        
        if (analysis.colors) {
          setBrandColors(prev => ({ ...prev, ...analysis.colors }));
          updatedItems.push(`${Object.keys(analysis.colors).length} colors`);
        }
        if (analysis.fonts) {
          setBrandFonts(prev => ({ ...prev, ...analysis.fonts }));
          updatedItems.push(`${Object.keys(analysis.fonts).length} fonts`);
        }
        if (analysis.brandDescription) {
          setBrandDescription(analysis.brandDescription);
          updatedItems.push('description');
        }

        toast({
          title: "Brand Guide Analyzed!",
          description: `Extracted: ${updatedItems.join(', ')}. Review and customize in the next steps.`
        });
        
        setTimeout(() => setCurrentStep(2), 1500);
      }
    } catch (error) {
      console.error('Brand guide analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Unable to analyze your brand guide. You can set up manually instead.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveBrandSettings = async () => {
    setIsSaving(true);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandSettings),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast({
        title: "Brand Settings Saved!",
        description: "Your brand theme is now active across the platform.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/brand-settings'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectSocialMedia = async (platform: string) => {
    try {
      const response = await fetch(`/api/social/connect/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok && data.authUrl) {
        const popup = window.open(data.authUrl, `${platform}_oauth`, 'width=600,height=600,scrollbars=yes');
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            checkConnectionStatus(platform);
          }
        }, 1000);
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect",
          variant: "destructive",
        });
      }
    } catch (error) {
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
            profileUrl: data.profileUrl || ''
          }
        }));
        toast({
          title: "Connected!",
          description: `Successfully connected to ${platform}`,
        });
      }
    } catch (error) {
      console.error('Connection status check failed:', error);
    }
  };

  const handleDisconnectSocialMedia = (platform: string) => {
    setSocialConnections(prev => ({
      ...prev,
      [platform]: { connected: false, accountName: '', profileUrl: '' }
    }));
    toast({ title: "Disconnected", description: `${platform} has been disconnected.` });
  };

  const getCompletionStatus = () => {
    const hasColors = Object.values(brandColors).every(c => c && c !== '#000000');
    const hasFonts = Object.values(brandFonts).every(f => f && f.length > 0);
    const hasLogo = brandAssets.find(a => a.id === 'primary-logo')?.url;
    const hasDescription = brandDescription.length > 20;
    const connectedSocials = Object.values(socialConnections).filter(s => s.connected).length;

    return {
      visualIdentity: hasColors && hasFonts,
      assets: !!hasLogo,
      description: hasDescription,
      socialCount: connectedSocials,
      overall: hasColors && hasFonts && hasLogo && hasDescription
    };
  };

  const status = getCompletionStatus();

  const goToNextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const goToPrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
        <div 
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
          style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
        />
        
        {WIZARD_STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div 
              key={step.id} 
              className="relative z-10 flex flex-col items-center cursor-pointer group"
              onClick={() => setCurrentStep(step.id)}
              data-testid={`step-${step.id}`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                ${isCompleted 
                  ? 'bg-green-500 text-white' 
                  : isCurrent 
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 group-hover:bg-gray-300 dark:group-hover:bg-gray-600'
                }
              `}>
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${isCurrent ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep1Kickoff = () => (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white mb-4">
          <Wand2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Let's Set Up Your Brand
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your brand guide for instant AI extraction, or set up manually
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 hover:shadow-lg transition-shadow cursor-pointer group">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                AI-Powered Setup
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload your brand guide PDF or image and let AI extract colors, fonts, and brand info automatically
              </p>
            </div>
            
            <div className="space-y-3">
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                acceptedFileTypes="image/*,application/pdf"
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleBrandGuideUpload}
                buttonClassName={`w-full py-3 ${isAnalyzing ? 'bg-amber-400' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'} text-white font-medium rounded-lg`}
                data-testid="upload-brand-guide"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Brand Guide
                  </>
                )}
              </ObjectUploader>
              
              <p className="text-xs text-gray-500">
                PDF, JPG, PNG • Max 10MB
              </p>
            </div>

            {isAnalyzing && (
              <div className="pt-4 space-y-2">
                <div className="flex items-center justify-center gap-6 text-sm text-amber-700 dark:text-amber-400">
                  <span className="flex items-center gap-1"><Palette className="w-4 h-4" /> Extracting colors</span>
                  <span className="flex items-center gap-1"><Type className="w-4 h-4" /> Finding fonts</span>
                </div>
              </div>
            )}

            {uploadedBrandGuide && !isAnalyzing && (
              <div className="flex items-center justify-center gap-2 text-green-600 pt-2">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Brand guide analyzed!</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all cursor-pointer group" onClick={goToNextStep}>
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Settings className="w-10 h-10 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Manual Setup
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose your colors, fonts, and upload assets step by step with full control
              </p>
            </div>
            <Button variant="outline" className="w-full py-3 group-hover:bg-gray-100 dark:group-hover:bg-gray-800" data-testid="manual-setup-btn">
              <ArrowRight className="mr-2 h-5 w-5" />
              Start Manual Setup
            </Button>
            <p className="text-xs text-gray-500">
              Set up everything your way
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep2VisualIdentity = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Visual Identity
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Define your brand colors and typography
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="w-5 h-5 text-amber-500" />
                Brand Colors
                {uploadedBrandGuide && (
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Extracted
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {Object.entries(brandColors).map(([name, value]) => (
                  <div key={name} className="space-y-2">
                    <Label className="text-xs capitalize text-gray-600 dark:text-gray-400">{name}</Label>
                    <div className="relative group">
                      <div 
                        className="w-full h-16 rounded-xl border-2 border-gray-200 dark:border-gray-700 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                        style={{ backgroundColor: value }}
                      />
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => setBrandColors(prev => ({ ...prev, [name]: e.target.value }))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid={`color-${name}`}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 text-center rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                        {value.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Type className="w-5 h-5 text-amber-500" />
                Typography
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                {Object.entries(brandFonts).map(([type, font]) => (
                  <div key={type} className="space-y-2">
                    <Label className="text-xs capitalize text-gray-600 dark:text-gray-400">{type} Font</Label>
                    <select
                      value={font}
                      onChange={(e) => setBrandFonts(prev => ({ ...prev, [type]: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                      style={{ fontFamily: font }}
                      data-testid={`font-${type}`}
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                    <p 
                      className="text-lg mt-2 truncate" 
                      style={{ fontFamily: font }}
                    >
                      The quick brown fox
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileImage className="w-5 h-5 text-amber-500" />
                Brand Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                placeholder="Describe your brand, values, and key messaging..."
                rows={3}
                className="resize-none"
                data-testid="brand-description"
              />
              <p className="text-xs text-gray-500 mt-2">
                This will be used for AI-generated content to match your brand voice
              </p>
            </CardContent>
          </Card>

          {/* AI Engine Preferences */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="w-5 h-5 text-amber-500" />
                AI Engine
                <Badge variant="outline" className="ml-2 text-xs">
                  Advanced
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  AI Provider
                </Label>
                <Select 
                  value={selectedAiProvider} 
                  onValueChange={setSelectedAiProvider}
                >
                  <SelectTrigger className="w-full" data-testid="select-ai-provider">
                    <SelectValue placeholder="Select AI provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        <span>Platform Default (OpenAI)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-blue-500" />
                        <span>OpenAI (GPT-4) - Your API Key</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="anthropic">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-orange-500" />
                        <span>Anthropic (Claude) - Your API Key</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="google">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-purple-500" />
                        <span>Google (Gemini) - Your API Key</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {selectedAiProvider === 'platform' 
                    ? "Use the platform's built-in AI service - no API key required" 
                    : "Use your own API key for more control and cost management"}
                </p>
              </div>

              {selectedAiProvider !== 'platform' && (
                <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      API Key
                    </Label>
                    {aiPreferences?.hasCustomApiKey && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    )}
                  </div>
                  
                  {aiPreferences?.hasCustomApiKey ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400">
                        {aiPreferences.aiApiKeyMasked || '****...****'}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveApiKey}
                        disabled={isRemovingApiKey}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid="remove-api-key"
                      >
                        {isRemovingApiKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="password"
                      value={aiApiKeyInput}
                      onChange={(e) => setAiApiKeyInput(e.target.value)}
                      placeholder={
                        selectedAiProvider === 'openai' ? 'sk-...' :
                        selectedAiProvider === 'anthropic' ? 'sk-ant-...' :
                        'Enter your API key'
                      }
                      className="font-mono"
                      data-testid="input-api-key"
                    />
                  )}
                  
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Your API key is encrypted and securely stored. We never expose or share your keys.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveAiPreferences}
                  disabled={isSavingAiPrefs}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  data-testid="save-ai-preferences"
                >
                  {isSavingAiPrefs ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save AI Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Kling AI Motion Generator API */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Kling AI Motion
                <Badge variant="outline" className="ml-2 text-xs">
                  Video
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transform your avatar images into dynamic videos with Kling AI. Add natural motion, gestures, and lifelike animation to static photos.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Kling API Key
                  </Label>
                  {aiPreferences?.hasKlingApiKey && (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Configured
                    </Badge>
                  )}
                </div>
                
                {aiPreferences?.hasKlingApiKey ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-400">
                      {aiPreferences.klingApiKeyMasked || '****...****'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveKlingApiKey}
                      disabled={isRemovingKlingKey}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid="remove-kling-api-key"
                    >
                      {isRemovingKlingKey ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      type="password"
                      value={klingApiKeyInput}
                      onChange={(e) => setKlingApiKeyInput(e.target.value)}
                      placeholder="Enter your Kling API key"
                      className="font-mono"
                      data-testid="input-kling-api-key"
                    />
                    <Button
                      onClick={handleSaveKlingApiKey}
                      disabled={isSavingKlingKey || !klingApiKeyInput}
                      size="sm"
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      data-testid="save-kling-api-key"
                    >
                      {isSavingKlingKey ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Key className="w-4 h-4 mr-2" />
                          Save Kling API Key
                        </>
                      )}
                    </Button>
                  </div>
                )}
                
                <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <Shield className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-purple-700 dark:text-purple-400">
                    <p>Get your API key from <a href="https://app.klingai.com/global/dev" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Kling AI Developer Portal</a></p>
                    <p className="mt-1 opacity-80">Enables: Image-to-video motion, gesture animation, video effects</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="w-5 h-5 text-amber-500" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="rounded-xl p-4 space-y-3"
                style={{ backgroundColor: brandColors.background }}
              >
                <div 
                  className="h-12 rounded-lg flex items-center px-4"
                  style={{ backgroundColor: brandColors.primary }}
                >
                  <span 
                    className="font-semibold text-white"
                    style={{ fontFamily: brandFonts.heading }}
                  >
                    Your Brand Name
                  </span>
                </div>
                
                <div className="space-y-2 px-2">
                  <h3 
                    className="text-lg font-semibold"
                    style={{ fontFamily: brandFonts.heading, color: brandColors.text }}
                  >
                    Sample Heading
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ fontFamily: brandFonts.body, color: brandColors.text }}
                  >
                    This is how your body text will appear in generated content.
                  </p>
                  <button
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: brandColors.accent }}
                  >
                    Call to Action
                  </button>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 text-center">
                  Preview shows how your brand will appear in generated content
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderStep3AssetsChannels = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Assets & Channels
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload brand assets and connect your social accounts
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="w-5 h-5 text-amber-500" />
              Brand Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {brandAssets.map((asset) => (
              <div 
                key={asset.id} 
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
              >
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {asset.url ? (
                    <img 
                      src={asset.url.startsWith('http') ? asset.url : `/objects/${asset.url.split('/').pop()}`}
                      alt={asset.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Image className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{asset.name}</p>
                  <p className="text-xs text-gray-500">
                    {asset.url ? 'Uploaded' : 'Not uploaded'}
                  </p>
                </div>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880}
                  acceptedFileTypes="image/*"
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={(url) => handleAssetUpload(asset.id, url)}
                  buttonClassName={`${asset.url ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-amber-500 hover:bg-amber-600 text-white'} px-4 py-2 rounded-lg text-sm font-medium`}
                  data-testid={`upload-${asset.id}`}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {asset.url ? 'Replace' : 'Upload'}
                </ObjectUploader>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="w-5 h-5 text-amber-500" />
              Social Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'facebook', icon: FaFacebook, color: 'bg-blue-600', name: 'Facebook' },
              { key: 'instagram', icon: FaInstagram, color: 'bg-gradient-to-r from-purple-500 to-pink-500', name: 'Instagram' },
              { key: 'linkedin', icon: FaLinkedin, color: 'bg-blue-700', name: 'LinkedIn' },
              { key: 'twitter', icon: FaTwitter, color: 'bg-sky-500', name: 'X (Twitter)' },
              { key: 'tiktok', icon: FaTiktok, color: 'bg-black', name: 'TikTok' },
              { key: 'youtube', icon: FaYoutube, color: 'bg-red-600', name: 'YouTube' },
            ].map(({ key, icon: Icon, color, name }) => {
              const connection = socialConnections[key as keyof typeof socialConnections];
              return (
                <div 
                  key={key}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{name}</p>
                    {connection.connected ? (
                      <p className="text-xs text-green-600">{connection.accountName || 'Connected'}</p>
                    ) : (
                      <p className="text-xs text-gray-500">Not connected</p>
                    )}
                  </div>
                  {connection.connected ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDisconnectSocialMedia(key)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      data-testid={`disconnect-${key}`}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => handleConnectSocialMedia(key)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      data-testid={`connect-${key}`}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderStep4Review = () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Review & Apply
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Review your brand settings before applying
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Brand Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Visual Identity</span>
                  {status.visualIdentity ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="w-3 h-3 mr-1" /> Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600">
                      <AlertCircle className="w-3 h-3 mr-1" /> Incomplete
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {Object.values(brandColors).map((color, i) => (
                    <div 
                      key={i}
                      className="w-8 h-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>Heading: <span className="font-medium" style={{ fontFamily: brandFonts.heading }}>{brandFonts.heading}</span></p>
                  <p>Body: <span className="font-medium" style={{ fontFamily: brandFonts.body }}>{brandFonts.body}</span></p>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentStep(2)}
                  className="text-amber-600 hover:text-amber-700"
                >
                  Edit Visual Identity
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand Assets</span>
                  {status.assets ? (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="w-3 h-3 mr-1" /> Logo uploaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600">
                      <AlertCircle className="w-3 h-3 mr-1" /> No logo
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {brandAssets.filter(a => a.url).map(asset => (
                    <div key={asset.id} className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <img 
                        src={asset.url?.startsWith('http') ? asset.url : `/objects/${asset.url?.split('/').pop()}`}
                        alt={asset.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                  {brandAssets.filter(a => a.url).length === 0 && (
                    <p className="text-sm text-gray-500">No assets uploaded</p>
                  )}
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentStep(3)}
                  className="text-amber-600 hover:text-amber-700"
                >
                  Edit Assets
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Social Channels</span>
                <Badge variant="outline">
                  {status.socialCount} of 6 connected
                </Badge>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(socialConnections).map(([key, value]) => (
                  <div 
                    key={key}
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                      value.connected 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                    }`}
                  >
                    {value.connected && <Check className="w-3 h-3" />}
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand Description</span>
                {status.description ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" /> Set
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">
                    <AlertCircle className="w-3 h-3 mr-1" /> Too short
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {brandDescription || 'No description set'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl border border-amber-200 dark:border-amber-800">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Ready to apply your brand?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your brand settings will be used across all generated content
            </p>
          </div>
          <Button 
            size="lg"
            onClick={handleSaveBrandSettings}
            disabled={isSaving}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/25"
            data-testid="save-brand-settings"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Apply Brand Theme
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Palette className="h-6 w-6 text-amber-500" />
              Brand Settings
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Configure your brand identity for consistent marketing
            </p>
          </div>
          {status.overall && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="w-4 h-4 mr-1" />
              Brand Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 md:p-8">
        {renderStepIndicator()}
        
        <div className="min-h-[500px]">
          {currentStep === 1 && renderStep1Kickoff()}
          {currentStep === 2 && renderStep2VisualIdentity()}
          {currentStep === 3 && renderStep3AssetsChannels()}
          {currentStep === 4 && renderStep4Review()}
        </div>

        {currentStep > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline" 
              onClick={goToPrevStep}
              className="flex items-center gap-2"
              data-testid="prev-step"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            {currentStep < 4 ? (
              <Button 
                onClick={goToNextStep}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="next-step"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSaveBrandSettings}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                data-testid="save-brand-btn"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save & Apply
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

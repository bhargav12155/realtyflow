import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, Shield, Zap, AlertTriangle, Settings, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface APIKeyStatus {
  totalKeys: number;
  availableKeys: number;
  keys: {
    name: string;
    isAvailable: boolean;
    requestCount: number;
    priority: number;
    capabilities: string[];
    costTier: 'free' | 'paid' | 'premium';
    lastError?: string;
    quotaResetTime?: string;
  }[];
}

export function APIKeyManager() {
  const [showInstructions, setShowInstructions] = useState(false);

  const { data: keyStatus, isLoading } = useQuery<APIKeyStatus>({
    queryKey: ['/api/openai/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium': return 'bg-yellow-500 text-white';
      case 'paid': return 'bg-green-500 text-white';
      case 'free': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (isAvailable: boolean, lastError?: string) => {
    if (isAvailable) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (lastError) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatResetTime = (resetTime?: string) => {
    if (!resetTime) return null;
    const date = new Date(resetTime);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return "Ready";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.ceil(diffMins / 60)}h`;
    return `${Math.ceil(diffMins / 1440)}d`;
  };

  const healthPercentage = keyStatus ? (keyStatus.availableKeys / keyStatus.totalKeys) * 100 : 0;

  if (isLoading) {
    return (
      <Card data-testid="api-key-manager-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            API Key Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="api-key-manager">
      {/* Header Card with Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle className="flex items-center gap-2">
                API Key Health Monitor
                <Badge variant="outline" className="text-xs">Task-Specific Routing</Badge>
              </CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              data-testid="button-toggle-instructions"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Keys
            </Button>
          </div>
          <CardDescription>
            Monitor your OpenAI API keys and automatic rotation system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Health */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium">System Health</div>
                <div className="text-xs text-muted-foreground">
                  {keyStatus?.availableKeys || 0} of {keyStatus?.totalKeys || 0} keys available
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${healthPercentage >= 80 ? 'text-green-600' : healthPercentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {healthPercentage.toFixed(0)}%
                </div>
              </div>
            </div>
            
            <Progress 
              value={healthPercentage} 
              className="h-2"
              data-testid="health-progress"
            />

            {/* Alert if health is low */}
            {healthPercentage < 50 && (
              <Alert data-testid="alert-low-health">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {healthPercentage === 0 
                    ? "All API keys are unavailable. Content generation will use fallback mode."
                    : "API key health is low. Consider adding backup keys to prevent service interruption."
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Details */}
      {keyStatus?.keys && keyStatus.keys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active API Keys</CardTitle>
            <CardDescription>
              Real-time status of all configured OpenAI API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keyStatus.keys.map((key, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`key-${index}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(key.isAvailable, key.lastError)}
                    <div>
                      <div className="font-medium">{key.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {key.requestCount} requests • Priority: {key.priority}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Capabilities */}
                    <div className="flex gap-1">
                      {key.capabilities.includes('vision') && (
                        <Badge variant="outline" className="text-xs">Vision</Badge>
                      )}
                      {key.capabilities.includes('advanced') && (
                        <Badge variant="outline" className="text-xs">Advanced</Badge>
                      )}
                    </div>
                    
                    {/* Cost Tier */}
                    {key.costTier && (
                      <Badge className={`text-xs ${getTierColor(key.costTier)}`}>
                        {key.costTier.charAt(0).toUpperCase() + key.costTier.slice(1)}
                      </Badge>
                    )}
                    
                    {/* Reset Time */}
                    {key.quotaResetTime && (
                      <div className="text-xs text-muted-foreground min-w-12 text-center">
                        {formatResetTime(key.quotaResetTime)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      {showInstructions && (
        <Card data-testid="instructions-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Add More API Keys
            </CardTitle>
            <CardDescription>
              Set up multiple OpenAI API keys for automatic rotation and improved reliability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="font-medium text-sm">Primary Keys (Recommended)</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><code>OPENAI_API_KEY</code> - Your main API key</div>
                    <div><code>OPENAI_API_KEY_2</code> - Secondary backup</div>
                    <div><code>OPENAI_API_KEY_3</code> - Content-focused key</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="font-medium text-sm">Specialized Keys (Optional)</div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><code>OPENAI_API_KEY_PREMIUM</code> - High priority</div>
                    <div><code>OPENAI_API_KEY_4</code> - Backup/fallback</div>
                  </div>
                </div>
              </div>

              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  <strong>Smart Rotation:</strong> The system automatically chooses the best key for each task based on availability, capabilities, and usage. Premium keys handle advanced tasks, while backup keys provide redundancy.
                </AlertDescription>
              </Alert>

              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <strong>Deployment Ready:</strong> Social media tasks will route to Jasper AI and video/avatar tasks to Heygen once API keys are provided. Currently using OpenAI as fallback for all tasks.
                </AlertDescription>
              </Alert>

              <div className="text-xs text-muted-foreground">
                Add keys as environment variables in your Replit secrets. The system will automatically detect and use them for improved reliability and quota management.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}